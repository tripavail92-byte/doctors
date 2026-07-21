import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { EntitlementGuard } from '../entitlements/entitlement.guard';
import { CatalogService } from './catalog.service';

/**
 * Tenant-scoped read API over the seeded pack config. All open to any
 * authenticated role; each accepts an optional ?packKey= filter.
 */
@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('catalog.core')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('service-catalog')
  serviceCatalog(@Query('packKey') packKey?: string) {
    return this.catalog.serviceCatalog(packKey);
  }

  @Get('note-templates')
  noteTemplates(@Query('packKey') packKey?: string) {
    return this.catalog.noteTemplates(packKey);
  }

  @Get('intake-groups')
  intakeGroups(@Query('packKey') packKey?: string) {
    return this.catalog.intakeGroups(packKey);
  }

  @Get('order-sets')
  orderSets(@Query('packKey') packKey?: string) {
    return this.catalog.orderSets(packKey);
  }
}
