// PrismaService
//
// Thin wrapper over PrismaClient that:
//  - connects on module init,
//  - exposes forTenant<T>() which runs a callback inside a transaction after
//    setting the `app.tenant_id` Postgres session variable, so row-level
//    security (RLS) policies scope every query to the current tenant.
//
// Usage from services:
//   return this.prisma.forTenant(getTenant().tenantId, (tx) =>
//     tx.patient.findMany(),
//   );

import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { getTenantId } from '../tenant/tenant-context';

// The transactional client handed to forTenant callbacks. It is a PrismaClient
// minus the top-level connection/transaction management methods.
export type TenantTransaction = Prisma.TransactionClient;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.assertRlsIsEnforceable();
  }

  /**
   * Fail fast if the runtime DB role can bypass RLS.
   *
   * Postgres skips every RLS policy for a role with SUPERUSER or BYPASSRLS.
   * Tenant-scoped queries here deliberately carry no `tenantId` in their WHERE
   * clause (e.g. `tx.patient.findMany()`) and lean on the tenant_isolation
   * policies instead — so a bypassing role silently turns every such query into
   * a cross-tenant read. Nothing errors, nothing logs; it only shows up once a
   * second tenant exists. That is a data breach, not a degraded mode, so we
   * refuse to boot rather than serve traffic with isolation quietly disabled.
   *
   * Connect as healthos_app (see prisma/rls-roles.sql), not the table owner.
   */
  private async assertRlsIsEnforceable(): Promise<void> {
    const rows = await this.$queryRaw<
      { current_user: string; rolsuper: boolean; rolbypassrls: boolean }[]
    >`SELECT current_user, r.rolsuper, r.rolbypassrls
        FROM pg_roles r WHERE r.rolname = current_user`;

    const me = rows[0];
    if (!me) {
      throw new Error('RLS preflight: could not resolve the current DB role.');
    }
    if (me.rolsuper || me.rolbypassrls) {
      throw new Error(
        `RLS preflight FAILED: connected as "${me.current_user}" which can bypass ` +
          `row-level security (superuser=${me.rolsuper}, bypassrls=${me.rolbypassrls}). ` +
          `Tenant isolation would be silently inert and tenants could read each ` +
          `other's data. Point DATABASE_URL at a NOSUPERUSER/NOBYPASSRLS role ` +
          `(see prisma/rls-roles.sql); keep the owner role for DIRECT_DATABASE_URL.`,
      );
    }
    this.logger.log(`RLS enforceable: connected as non-bypassing role "${me.current_user}".`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Run `fn` inside a transaction scoped to `tenantId` for RLS.
   *
   * Opens a transaction, sets `app.tenant_id` for the transaction's lifetime
   * (third `set_config` arg `true` = local to the transaction) and then runs
   * the callback with the transactional client. All queries issued through the
   * passed `tx` are therefore subject to the tenant's RLS policies.
   *
   * A null tenantId is REJECTED, not coerced.
   *
   * This previously passed the empty string for platform admins (who have no
   * tenant), with a comment claiming policies could read '' as "no tenant
   * scope". No policy did, and none should: Postgres does not treat '' as NULL,
   * so `''::uuid` RAISES — every tenant-scoped endpoint 500'd for a platform
   * admin. The tempting fix (making '' mean "no scope" in the policy) would
   * turn a loud crash into a silent cross-tenant read across every table. So
   * the empty string is not a tenant, and asking for one is a programming
   * error. Cross-tenant access, if ever needed, gets an explicit audited path.
   */
  async forTenant<T>(
    tenantId: string | null,
    fn: (tx: TenantTransaction) => Promise<T>,
  ): Promise<T> {
    if (!tenantId) {
      throw new ForbiddenException('This operation requires a tenant context.');
    }
    return this.$transaction(async (tx) => {
      // set_config(setting, value, is_local) — is_local=true keeps it bound to
      // this transaction only. Parameterized to avoid injection.
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenantId);
      return fn(tx);
    });
  }

  /**
   * Convenience over `forTenant`: resolves the tenant from the current request
   * context and asserts it is non-null (throws otherwise). Lets tenant-scoped
   * services drop the `getTenant().tenantId!` non-null assertion:
   *
   *   return this.prisma.forCurrentTenant((tx) => tx.patient.findMany());
   */
  forCurrentTenant<T>(fn: (tx: TenantTransaction) => Promise<T>): Promise<T> {
    return this.forTenant(getTenantId(), fn);
  }
}