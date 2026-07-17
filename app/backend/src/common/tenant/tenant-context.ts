// Tenant context using AsyncLocalStorage.
//
// Every request runs inside `runWithTenant(ctx, fn)`, which binds the resolved
// tenant/user context for the duration of the async call chain. Services and
// the PrismaService read it back via `getTenant()` (e.g.
// `prisma.forTenant(getTenant().tenantId, tx => ...)`), so no explicit
// tenant plumbing is needed through every function signature.

import { AsyncLocalStorage } from 'node:async_hooks';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * The per-request tenant context. Derived from the validated JWT payload by
 * TenantMiddleware. `tenantId` is null for platform admins that operate across
 * tenants.
 */
export interface TenantCtx {
  /** Owning tenant of the request. Null for platform admins. */
  tenantId: string | null;
  /** Authenticated user id. Null for anonymous/public routes. */
  userId: string | null;
  /** The user's role. Null for anonymous/public routes. */
  role: UserRole | null;
  /** True when the user is a cross-tenant platform administrator. */
  isPlatformAdmin: boolean;
}

// The single AsyncLocalStorage instance holding the current TenantCtx.
const storage = new AsyncLocalStorage<TenantCtx>();

/**
 * Run `fn` with the given tenant context bound for the whole async chain.
 * Anything executed inside (controllers, services, Prisma calls) can recover
 * the context via `getTenant()`.
 */
export function runWithTenant<T>(ctx: TenantCtx, fn: () => T): T {
  return storage.run(ctx, fn);
}

/**
 * Return the current request's tenant context.
 *
 * Throws if called outside of a `runWithTenant` scope, which almost always
 * indicates a missing TenantMiddleware or a background job that forgot to
 * establish context. Use `getTenantOrNull()` when absence is expected.
 */
export function getTenant(): TenantCtx {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      'No tenant context available. Ensure the request runs through TenantMiddleware ' +
        'or wrap the work in runWithTenant().',
    );
  }
  return ctx;
}

/**
 * Like `getTenant()` but returns undefined instead of throwing when no context
 * is bound. Handy for code paths that may run both in and out of a request.
 */
export function getTenantOrNull(): TenantCtx | undefined {
  return storage.getStore();
}

/**
 * Return the current request's tenantId, guaranteed non-null.
 *
 * Use in tenant-scoped write/read paths that require an owning tenant (i.e.
 * everything except cross-tenant platform-admin operations). Throws a 403-style
 * error if there is no tenant on the context — this replaces the unchecked
 * `getTenant().tenantId!` non-null assertion with a real runtime guard.
 */
export function getTenantId(): string {
  const { tenantId } = getTenant();
  if (!tenantId) {
    throw new ForbiddenException('This operation requires a tenant context');
  }
  return tenantId;
}