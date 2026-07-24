import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant, getTenantId } from '../common/tenant/tenant-context';
import { JwtPayload } from './jwt.strategy';

// Raw row returned by auth_find_memberships_for_user (column names match the
// SQL RETURNS TABLE definition exactly — Postgres returns them lowercased).
type MembershipRow = {
  membership_id: string;
  organizationId: string;
  organization_name: string;
  tenantId: string;
  clinic_name: string;
  clinicId: string;
  branchId: string | null;
  branch_name: string | null;
  departmentId: string | null;
  department_name: string | null;
  role: string;
  isDefaultContext: boolean;
};

export interface AuthContextItem {
  membershipId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  clinicId: string | null;
  clinicName: string | null;
  clinicTenantId: string | null;
  branchId: string | null;
  branchName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  role: string;
  isDefault: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Look up a user by (globally unique) email and verify the password.
   *
   * Login is the one read that legitimately has no tenant context — you cannot
   * know the tenant until you have found the user. "User" carries RLS like
   * every other tenant table, so a plain `prisma.user.findUnique` here would
   * evaluate the policy with no `app.tenant_id` and find nothing: every login
   * would fail. It goes through auth_find_user_by_email (SECURITY DEFINER, see
   * prisma/rls-user.sql), which is the single sanctioned way past the policy —
   * deliberately narrow: lookup by unique email, no list variant.
   */
  async validateUser(email: string, password: string): Promise<User> {
    const rows = await this.prisma.$queryRaw<User[]>`
      SELECT * FROM auth_find_user_by_email(${email})
    `;
    const user = rows[0];
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  /**
   * Validate credentials and return a signed access token.
   */
  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.validateUser(email, password);
    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      isPlatformAdmin: user.isPlatformAdmin,
    };
    return { accessToken: await this.jwt.signAsync(payload) };
  }

  async contextsForUser(userId: string): Promise<{ contexts: AuthContextItem[] }> {
    if (getTenant().isPlatformAdmin) {
      return { contexts: [] };
    }

    // Use the SECURITY DEFINER function to enumerate memberships across ALL
    // tenants the user belongs to. A plain forCurrentTenant() call is
    // intentionally scoped to one tenant and cannot cross that boundary.
    // auth_find_memberships_for_user is the single sanctioned bypass path —
    // it only returns rows where userId = the supplied UUID, so a spoofed call
    // (impossible here, userId comes from the verified JWT) would only return
    // the attacker's own memberships. See prisma/rls-user.sql.
    const rows = await this.prisma.$queryRaw<MembershipRow[]>`
      SELECT * FROM auth_find_memberships_for_user(${userId}::uuid)
    `;

    if (rows.length > 0) {
      return {
        contexts: rows.map((r) => ({
          membershipId: r.membership_id,
          organizationId: r.organizationId,
          organizationName: r.organization_name,
          clinicId: r.clinicId,
          clinicName: r.clinic_name,
          clinicTenantId: r.tenantId,
          branchId: r.branchId,
          branchName: r.branch_name,
          departmentId: r.departmentId,
          departmentName: r.department_name,
          role: r.role,
          isDefault: r.isDefaultContext,
        })),
      };
    }

    // Backward-compatible fallback: users who pre-date Phase A have no
    // membership rows yet. Return a synthetic context from the current tenant.
    const tenantId = getTenantId();
    return this.prisma.forCurrentTenant(async (tx) => {
      const [user, tenant] = await Promise.all([
        tx.user.findFirst({ where: { id: userId, tenantId } }),
        tx.tenant.findUnique({ where: { id: tenantId } }),
      ]);
      if (!user || !tenant || user.status !== 'active') {
        return { contexts: [] };
      }
      return {
        contexts: [
          {
            membershipId: null,
            organizationId: null,
            organizationName: null,
            clinicId: null,
            clinicName: tenant.name,
            clinicTenantId: tenant.id,
            branchId: null,
            branchName: null,
            departmentId: null,
            departmentName: null,
            role: user.role,
            isDefault: true,
          },
        ],
      };
    });
  }

  async switchContext(userId: string, input: { membershipId?: string; tenantId?: string }) {
    if (getTenant().isPlatformAdmin) {
      throw new BadRequestException('Platform admin does not use clinic context switching');
    }

    const { contexts } = await this.contextsForUser(userId);
    if (!contexts.length) {
      throw new BadRequestException('No clinic contexts are available for this user');
    }

    let chosen: AuthContextItem | undefined;
    if (input.membershipId) {
      chosen = contexts.find((c) => c.membershipId === input.membershipId);
    } else if (input.tenantId) {
      chosen = contexts.find((c) => c.clinicTenantId === input.tenantId);
    } else {
      chosen = contexts.find((c) => c.isDefault) ?? contexts[0];
    }
    if (!chosen?.clinicTenantId) {
      throw new BadRequestException('Requested clinic context not found');
    }

    // Persist the last-active context using the SECURITY DEFINER write path.
    // forCurrentTenant is insufficient here: after a cross-tenant switch the
    // user's UserContextPreference row is scoped to their home tenant (the one
    // their User row lives in), but their current JWT may carry a different
    // tenantId, making the row invisible under the bespoke policy. The
    // SECURITY DEFINER function bypasses that scoping for this one write,
    // which is safe because the userId comes from a verified JWT claim.
    if (chosen.membershipId) {
      await this.prisma.$executeRaw`
        SELECT auth_set_context_preference(
          ${userId}::uuid,
          ${chosen.organizationId}::uuid,
          ${chosen.clinicId}::uuid,
          ${chosen.branchId ?? null}::uuid,
          ${chosen.departmentId ?? null}::uuid
        )
      `;
    }

    const payload: JwtPayload = {
      sub: userId,
      tenantId: chosen.clinicTenantId,
      role: chosen.role,
      isPlatformAdmin: false,
      organizationId: chosen.organizationId,
      clinicId: chosen.clinicId,
      branchId: chosen.branchId,
      departmentId: chosen.departmentId,
      membershipId: chosen.membershipId,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      context: chosen,
    };
  }
}