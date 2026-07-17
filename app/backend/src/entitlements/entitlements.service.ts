import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { editionsCatalog } from './editions';

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns true if the tenant has the given feature key enabled.
   * Reads TenantEntitlement (@@unique([tenantId, featureKey])).
   */
  async check(tenantId: string, featureKey: string): Promise<boolean> {
    // Read inside forTenant so app.tenant_id is set and the TenantEntitlement
    // RLS policy is satisfied under a non-superuser DB role.
    const entitlement = await this.prisma.forTenant(tenantId, (tx) =>
      tx.tenantEntitlement.findUnique({
        where: { tenantId_featureKey: { tenantId, featureKey } },
      }),
    );
    return entitlement?.enabled === true;
  }

  /** All enabled feature keys for a tenant. */
  async enabledFeatures(tenantId: string): Promise<string[]> {
    const rows = await this.prisma.forTenant(tenantId, (tx) =>
      tx.tenantEntitlement.findMany({ where: { enabled: true } }),
    );
    return rows.map((r) => r.featureKey).sort();
  }

  /** True only if EVERY required feature is enabled (used for pack activation). */
  async hasAll(tenantId: string, featureKeys: string[]): Promise<boolean> {
    if (featureKeys.length === 0) return true;
    const enabled = new Set(await this.enabledFeatures(tenantId));
    return featureKeys.every((k) => enabled.has(k));
  }

  /** The static editions catalog (edition -> bundled features). */
  editions() {
    return editionsCatalog();
  }
}