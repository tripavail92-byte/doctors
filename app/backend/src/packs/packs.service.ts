import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant, getTenantId } from '../common/tenant/tenant-context';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { BUILTIN_MANIFESTS } from './manifests';
import { PackManifest } from './manifest.types';
import { validateManifest, ValidationResult } from './manifest.validate';
import { seedPackForTenant } from './pack-seeding';

/**
 * Specialty-pack registry & activation.
 *
 * Pack / PackVersion are global catalog rows (registered from the built-in
 * manifests at boot). Activation is tenant-scoped: it records a PackActivation
 * and expands the manifest into tenant-scoped rows, all inside one RLS-scoped
 * transaction.
 */
@Injectable()
export class PacksService implements OnModuleInit {
  private readonly logger = new Logger(PacksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const n = await this.registerBuiltins();
      this.logger.log(`Registered ${n} packs into the catalog.`);
    } catch (e) {
      this.logger.warn(
        `Pack catalog not registered (DB not ready?): ${String(e)}`,
      );
    }
  }

  // Upsert Pack + PackVersion for every built-in manifest (idempotent).
  async registerBuiltins(): Promise<number> {
    for (const m of BUILTIN_MANIFESTS) {
      const pack = await this.prisma.pack.upsert({
        where: { key: m.key },
        update: {
          name: m.name,
          specialty: m.specialty,
          tier: m.tier,
          description: m.description,
          latestVersion: m.version,
        },
        create: {
          key: m.key,
          name: m.name,
          specialty: m.specialty,
          tier: m.tier,
          description: m.description,
          latestVersion: m.version,
        },
      });
      await this.prisma.packVersion.upsert({
        where: { packId_version: { packId: pack.id, version: m.version } },
        update: { manifest: m as unknown as Prisma.InputJsonValue },
        create: {
          packId: pack.id,
          version: m.version,
          manifest: m as unknown as Prisma.InputJsonValue,
        },
      });
    }
    return BUILTIN_MANIFESTS.length;
  }

  // Catalog of all available packs (global).
  listAvailable() {
    return this.prisma.pack.findMany({ orderBy: { name: 'asc' } });
  }

  // ---- Authoring & versioning (platform-level) --------------------------

  // Dry-run structural validation of a manifest (for authoring UIs).
  validate(input: unknown): ValidationResult {
    return validateManifest(input);
  }

  /**
   * Publish a manifest into the catalog: validate, upsert the Pack, and upsert
   * an immutable PackVersion holding the manifest JSON. Sets the pack's
   * latestVersion to the published version (publish-forward). Tenants pick up
   * the new manifest the next time they (re)activate the pack.
   */
  async publish(input: unknown) {
    const v = validateManifest(input);
    if (!v.ok || !v.manifest) {
      throw new BadRequestException({ message: 'Invalid manifest', errors: v.errors });
    }
    const m = v.manifest;
    const pack = await this.prisma.pack.upsert({
      where: { key: m.key },
      update: {
        name: m.name,
        specialty: m.specialty,
        tier: m.tier,
        description: m.description,
        latestVersion: m.version,
      },
      create: {
        key: m.key,
        name: m.name,
        specialty: m.specialty,
        tier: m.tier,
        description: m.description,
        latestVersion: m.version,
      },
    });
    const version = await this.prisma.packVersion.upsert({
      where: { packId_version: { packId: pack.id, version: m.version } },
      update: { manifest: m as unknown as Prisma.InputJsonValue },
      create: {
        packId: pack.id,
        version: m.version,
        manifest: m as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      published: true,
      pack: pack.key,
      version: version.version,
      latestVersion: pack.latestVersion,
    };
  }

  // List all versions of a pack (newest first).
  async listVersions(key: string) {
    const pack = await this.prisma.pack.findUnique({ where: { key } });
    if (!pack) throw new NotFoundException(`Pack ${key} not found`);
    const versions = await this.prisma.packVersion.findMany({
      where: { packId: pack.id },
      orderBy: { createdAt: 'desc' },
      select: { version: true, createdAt: true },
    });
    return { key, latestVersion: pack.latestVersion, versions };
  }

  // Fetch a specific version's manifest.
  async getVersion(key: string, version: string) {
    const pack = await this.prisma.pack.findUnique({ where: { key } });
    if (!pack) throw new NotFoundException(`Pack ${key} not found`);
    const v = await this.prisma.packVersion.findUnique({
      where: { packId_version: { packId: pack.id, version } },
    });
    if (!v) throw new NotFoundException(`Pack ${key} has no version ${version}`);
    return v.manifest;
  }

  // Packs the current tenant has activated.
  listActivated() {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.packActivation.findMany({
        include: { pack: true },
        orderBy: { activatedAt: 'desc' },
      }),
    );
  }

  // Activate a pack for the current tenant: record activation + seed rows.
  async activate(key: string) {
    const { pack, version, manifest } = await this.resolveLatest(key);
    const tenantId = getTenantId();
    // Enforce the manifest's declared entitlements: a tenant can only activate a
    // pack whose required features its edition grants.
    // Runtime backstop for the type change in manifest.types.ts. Manifests can
    // also arrive as authored PackVersion rows, which TypeScript never sees, so
    // a missing field has to be refused here too rather than defaulting to `[]`
    // — which hasAll() treats as satisfied, making the pack free to everyone.
    const required = manifest.requiresEntitlements;
    if (!Array.isArray(required)) {
      throw new ForbiddenException(
        `Pack "${key}" does not declare requiresEntitlements. A pack must state which ` +
          `entitlements it needs (use an empty list to mean free to all).`,
      );
    }
    if (!(await this.entitlements.hasAll(tenantId, required))) {
      throw new ForbiddenException(
        `Pack "${key}" requires entitlements not enabled for this tenant: ${required.join(', ')}`,
      );
    }
    return this.prisma.forTenant(tenantId, async (tx) => {
      const activation = await tx.packActivation.upsert({
        where: { tenantId_packId: { tenantId: tenantId!, packId: pack.id } },
        update: { status: 'ACTIVE', packVersionId: version.id },
        create: {
          tenantId: tenantId!,
          packId: pack.id,
          packVersionId: version.id,
          status: 'ACTIVE',
        },
      });
      const seeded = await seedPackForTenant(tx, tenantId!, manifest);
      return { pack: pack.key, version: version.version, activation, seeded };
    });
  }

  // Disable a pack for the current tenant (seeded rows are left in place).
  async deactivate(key: string) {
    const pack = await this.prisma.pack.findUnique({ where: { key } });
    if (!pack) throw new NotFoundException(`Pack ${key} not found`);
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.packActivation.update({
        where: { tenantId_packId: { tenantId: tenantId!, packId: pack.id } },
        data: { status: 'DISABLED' },
      }),
    );
  }

  // Look up a pack and its latest version manifest (global reads).
  private async resolveLatest(key: string): Promise<{
    pack: { id: string; key: string; latestVersion: string };
    version: { id: string; version: string };
    manifest: PackManifest;
  }> {
    const pack = await this.prisma.pack.findUnique({ where: { key } });
    if (!pack) throw new NotFoundException(`Pack ${key} not found`);
    const version = await this.prisma.packVersion.findUnique({
      where: { packId_version: { packId: pack.id, version: pack.latestVersion } },
    });
    if (!version) {
      throw new NotFoundException(
        `Pack ${key} has no version ${pack.latestVersion}`,
      );
    }
    return {
      pack,
      version,
      manifest: version.manifest as unknown as PackManifest,
    };
  }
}
