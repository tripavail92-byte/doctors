import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getTenant } from '../common/tenant/tenant-context';
import { ENTITLEMENT_KEY } from './requires-entitlement.decorator';
import { EntitlementsService } from './entitlements.service';

/**
 * Enforces @RequiresEntitlement('module.key'): resolves the current tenant from
 * the AsyncLocalStorage tenant context and asks EntitlementsService whether the
 * feature is enabled. Platform admins bypass entitlement checks.
 * Must run after JwtAuthGuard and TenantMiddleware.
 */
@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.getAllAndOverride<string>(ENTITLEMENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @RequiresEntitlement => nothing to enforce.
    if (!featureKey) {
      return true;
    }

    const tenant = getTenant();
    if (!tenant) {
      throw new ForbiddenException('Missing tenant context');
    }

    // Platform admins are not gated by per-tenant entitlements.
    if (tenant.isPlatformAdmin) {
      return true;
    }

    if (!tenant.tenantId) {
      throw new ForbiddenException('Tenant required for this feature');
    }

    const allowed = await this.entitlements.check(tenant.tenantId, featureKey);
    if (!allowed) {
      throw new ForbiddenException(`Feature not enabled: ${featureKey}`);
    }
    return true;
  }
}