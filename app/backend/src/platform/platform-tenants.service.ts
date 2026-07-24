import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Edition, Prisma, SubscriptionStatus, TenantStatus, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { featuresForEdition } from '../entitlements/editions';
import { BUILTIN_MANIFESTS } from '../packs/manifests';
import { seedPackForTenant } from '../packs/pack-seeding';
import { CreateTenantDto } from './dto/create-tenant.dto';

/**
 * Onboarding a clinic.
 *
 * Until this existed there was no way to create a tenant at all. The isolation
 * underneath is the most heavily verified thing in the codebase — 81 tables with
 * RLS forced, a runtime role that cannot bypass it, audited live on every deploy
 * — and the only tenant that could ever exist was the one the seed wrote. A
 * second customer meant someone running SQL by hand.
 *
 * WHY THIS IS NOT SIMPLY A `prisma.tenant.create`
 * -----------------------------------------------
 * Creating a tenant is a PRE-tenant operation, and the app connects as
 * healthos_app, which cannot bypass RLS. The tenant_isolation policies have no
 * WITH CHECK, so Postgres reuses their USING expression as the INSERT check:
 * writing any tenant-scoped row requires `app.tenant_id` to already equal the
 * tenant being written.
 *
 * So the work is split at exactly that line:
 *
 *   "Tenant" itself carries NO policy — it is a platform table, not a
 *   tenant-scoped one — so it is created outside any tenant context.
 *
 *   Everything else (facility, owner user, subscription, entitlements, pack
 *   activations) is tenant-scoped and is written INSIDE forTenant(newId), where
 *   the GUC satisfies each policy.
 *
 * No new SECURITY DEFINER function is introduced. The one that exists
 * (auth_find_user_by_email) is the single sanctioned way past a policy, and it
 * should stay that way — every addition is another thing that runs as the owner.
 */
@Injectable()
export class PlatformTenantsService {
  private readonly logger = new Logger(PlatformTenantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Every clinic on the platform. Platform-admin only — see the controller. */
  async list() {
    // Deliberately NOT forTenant: a platform admin has no tenant, and "Tenant"
    // has no policy to satisfy. Counts come from grouped queries rather than
    // per-tenant reads, which would each need their own context.
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, slug: true, edition: true, status: true, createdAt: true },
    });
    const [patients, users] = await Promise.all([
      this.prisma.patient.groupBy({ by: ['tenantId'], _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['tenantId'], _count: { _all: true } }),
    ]);
    const pc = new Map(patients.map((p) => [p.tenantId, p._count._all]));
    const uc = new Map(users.map((u) => [u.tenantId, u._count._all]));
    return tenants.map((t) => ({
      ...t,
      patients: pc.get(t.id) ?? 0,
      users: uc.get(t.id) ?? 0,
    }));
  }

  async create(dto: CreateTenantDto) {
    // "Tenant" carries no RLS policy, so this read sees every clinic and is a
    // useful courtesy. The unique index is still the actual guarantee — a read
    // is not a constraint, and two simultaneous creates would both pass here.
    const slugTaken = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });
    if (slugTaken) {
      throw new ConflictException(
        `The slug "${dto.slug}" already belongs to another clinic. Pick a different one — ` +
          `it is how this clinic is identified everywhere.`,
      );
    }

    // THERE IS DELIBERATELY NO PRE-CHECK ON THE EMAIL.
    //
    // The obvious `prisma.user.findUnique({ where: { email } })` is BLIND here:
    // "User" is RLS-protected, a platform admin has no tenant, so
    // `app.tenant_id` is unset, the policy qual is NULL and the query returns
    // nothing however many accounts hold that address. The check passed, the
    // insert then hit the unique index, and the caller got a 500 — reproduced.
    //
    // Rather than reach past the policy for a nicer error, the index is left to
    // do the work and P2002 is translated below. That is the correct shape
    // anyway: the constraint is what makes it true, the message only explains it.

    const passwordHash = await bcrypt.hash(dto.ownerPassword, 10);

    // "Tenant" has no RLS policy, so this is written without tenant context.
    let tenant;
    try {
      tenant = await this.prisma.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          edition: dto.edition,
          status: TenantStatus.ACTIVE,
        },
      });
    } catch (e) {
      // The index is what actually enforces it; translate rather than 500.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`The slug "${dto.slug}" already belongs to another clinic.`);
      }
      throw e;
    }

    // From here everything is tenant-scoped, so it runs under the new tenant's
    // context. One transaction: a clinic that exists with no owner is worse
    // than no clinic, because nobody can sign in to fix it.
    //
    // "Tenant" was written OUTSIDE that transaction — it has to be, because the
    // tenant id is what the context is set to — so a failure inside would strand
    // an ownerless clinic in the list. Reproduced with a duplicate owner email.
    // The catch below removes it, so the operation is all-or-nothing across the
    // boundary the transaction cannot span.
    let result;
    try {
      result = await this.provision(tenant.id, dto, passwordHash);
    } catch (e) {
      await this.prisma.tenant.delete({ where: { id: tenant.id } }).catch((cleanupError) => {
        // Say so loudly rather than swallow it: an ownerless clinic that also
        // could not be removed is a row someone has to find by hand.
        this.logger.error(
          `Provisioning "${dto.slug}" failed AND the empty tenant row could not be removed ` +
            `(${tenant.id}). It must be deleted manually. Cleanup error: ${String(cleanupError)}`,
        );
      });
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = String((e.meta as { target?: unknown })?.target ?? '');
        // P2002's meta.target is not always populated (it was undefined for the
        // MRN constraint on this project, which made a `.includes()` match every
        // duplicate). Default to the email, which is the only unique field this
        // transaction writes.
        throw new ConflictException(
          target.includes('slug')
            ? `The slug "${dto.slug}" already belongs to another clinic.`
            : `${dto.ownerEmail} already has an account on this platform. One email, one ` +
              `account: reusing it would make it ambiguous which clinic that person belongs to. ` +
              `Nothing has been created.`,
        );
      }
      throw e;
    }

    this.logger.log(
      `Onboarded clinic "${tenant.name}" (${tenant.slug}, ${tenant.edition}) — ` +
        `${result.entitlements} entitlements, packs: ${result.packs.join(', ') || 'none'}`,
    );

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      edition: tenant.edition,
      status: tenant.status,
      facility: { id: result.facility.id, name: result.facility.name },
      owner: result.owner,
      entitlements: result.entitlements,
      packs: result.packs,
    };
  }

  /**
   * Everything a clinic needs beyond its Tenant row, written under the new
   * tenant's RLS context.
   */
  private provision(tenantId: string, dto: CreateTenantDto, passwordHash: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const facility = await tx.facility.create({
        data: {
          tenantId,
          name: dto.facilityName?.trim() || dto.name,
          // Facility.city is non-nullable, so an omitted city becomes '' rather
          // than null — same absence, and it avoids a schema change here.
          city: dto.city?.trim() || '',
        },
      });

      const owner = await tx.user.create({
        data: {
          tenantId,
          email: dto.ownerEmail,
          passwordHash,
          name: dto.ownerName,
          role: UserRole.OWNER,
        },
        select: { id: true, email: true, name: true, role: true },
      });

      // Phase A hierarchy bootstrap for every newly onboarded clinic.
      const orgCode =
        `org-${dto.slug}-${tenantId.slice(0, 8)}`
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40) || `org-${tenantId.slice(0, 8)}`;
      const organizationId = randomUUID();
      // Organization SELECT visibility is clinic-linked; create it via explicit
      // insert first, then create OrganizationClinic in the same transaction.
      await tx.$executeRaw`
        INSERT INTO "Organization" ("id", "code", "name", "ownerUserId", "status", "createdAt", "updatedAt")
        VALUES (
          ${organizationId}::uuid,
          ${orgCode},
          ${`${dto.name} Organization`},
          ${owner.id}::uuid,
          'ACTIVE'::"OrganizationStatus",
          now(),
          now()
        )
      `;
      const clinic = await tx.organizationClinic.create({
        data: {
          organizationId,
          tenantId,
          displayName: dto.name,
          isPrimary: true,
        },
      });
      const branch = await tx.branch.create({
        data: {
          tenantId,
          organizationId,
          clinicId: clinic.id,
          name: dto.facilityName?.trim() || dto.name,
          code: 'MAIN',
          city: dto.city?.trim() || null,
        },
      });
      await tx.userMembership.create({
        data: {
          userId: owner.id,
          organizationId,
          tenantId,
          clinicId: clinic.id,
          branchId: branch.id,
          role: UserRole.OWNER,
          isDefaultContext: true,
          isActive: true,
        },
      });
      await tx.userContextPreference.upsert({
        where: { userId: owner.id },
        update: {
          lastOrganizationId: organizationId,
          lastClinicId: clinic.id,
          lastBranchId: branch.id,
        },
        create: {
          userId: owner.id,
          lastOrganizationId: organizationId,
          lastClinicId: clinic.id,
          lastBranchId: branch.id,
        },
      });

      // A Subscription hangs off a Plan row, not off the edition directly —
      // Plan is what carries the price. No plan for this edition means the
      // platform catalog was never seeded, and a clinic with no subscription
      // is one nobody can bill.
      const plan = await tx.plan.findFirst({
        where: { edition: dto.edition },
        select: { id: true },
      });
      if (!plan) {
        throw new ConflictException(
          `No Plan exists for edition ${dto.edition}. Run the platform seed before onboarding ` +
            `a clinic — a clinic created without a subscription cannot be billed.`,
        );
      }
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await tx.subscription.create({
        data: {
          tenantId,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: periodEnd,
        },
      });

      // Only this edition's bundle. The seed grants the demo tenant everything,
      // which is right for a demo and wrong for a customer: entitlements are
      // what the editions are SOLD on, so a clinic that receives more than it
      // paid for is a pricing bug that looks like generosity.
      const keys = featuresForEdition(dto.edition);
      if (!keys.length) {
        throw new ConflictException(
          `Edition ${dto.edition} grants no features. A clinic created this way would open ` +
            `onto "not included in your plan" on every screen.`,
        );
      }
      // TenantEntitlement keys on featureKey (a string), not a Feature row id —
      // so an entitlement can be granted before the catalog row exists and does
      // not need a join to check.
      await tx.tenantEntitlement.createMany({
        data: keys.map((key) => ({ tenantId, featureKey: key, enabled: true })),
      });

      // Activate the packs this edition includes, and seed each one's service
      // catalog, instruments and config so the clinic opens onto a working
      // workspace rather than empty dropdowns.
      const activated: string[] = [];
      for (const m of BUILTIN_MANIFESTS) {
        const pack = await tx.pack.findUnique({ where: { key: m.key }, select: { id: true } });
        if (!pack) continue;
        const version = await tx.packVersion.findUnique({
          where: { packId_version: { packId: pack.id, version: m.version } },
          select: { id: true },
        });
        if (!version) continue;
        // Activate a pack only if this edition grants everything the pack's own
        // manifest declares it needs. Deriving it from `requiresEntitlements`
        // rather than a second list means the price list and the activation
        // rule cannot drift apart — and a CLINIC-edition customer does not
        // silently receive the specialty packs they did not pay for.
        const required = m.requiresEntitlements ?? [];
        if (!required.every((k) => keys.includes(k))) continue;

        await tx.packActivation.create({
          data: {
            tenantId,
            packId: pack.id,
            packVersionId: version.id,
            status: 'ACTIVE',
          },
        });
        await seedPackForTenant(tx, tenantId, m);
        activated.push(m.key);
      }

      return { facility, owner, entitlements: keys.length, packs: activated };
    });
  }
}
