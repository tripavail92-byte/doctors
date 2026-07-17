import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';

/**
 * Read side of the pack layer: exposes the tenant-scoped config that pack
 * activation seeded (service catalog, note templates, intake groups, order
 * sets). This is the bridge a specialty UI reads to render itself from the
 * pack rather than from hard-coded screens.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  serviceCatalog(packKey?: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.serviceCatalogItem.findMany({
        where: { active: true, ...(packKey ? { packKey } : {}) },
        orderBy: [{ packKey: 'asc' }, { name: 'asc' }],
      }),
    );
  }

  noteTemplates(packKey?: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.noteTemplate.findMany({
        where: { ...(packKey ? { packKey } : {}) },
        orderBy: { name: 'asc' },
      }),
    );
  }

  intakeGroups(packKey?: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.intakeFieldGroup.findMany({
        where: { ...(packKey ? { packKey } : {}) },
        orderBy: { name: 'asc' },
      }),
    );
  }

  orderSets(packKey?: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.orderSet.findMany({
        where: { ...(packKey ? { packKey } : {}) },
        orderBy: { name: 'asc' },
      }),
    );
  }
}
