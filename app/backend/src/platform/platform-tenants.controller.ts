import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PlatformTenantsService } from './platform-tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

/**
 * Clinic onboarding. PLATFORM_ADMIN only.
 *
 * Every route here crosses the tenant boundary by design — listing clinics, and
 * creating one — which makes this the most privileged surface in the product.
 * A clinic OWNER must never reach it: they would see the names, editions and
 * patient counts of every competitor on the platform, and could mint a clinic.
 *
 * Note there is deliberately NO EntitlementGuard: entitlements answer "does this
 * clinic's plan include X", and a platform admin has no clinic. Adding one would
 * make the route depend on a tenant context that does not exist.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
@Controller('platform/tenants')
export class PlatformTenantsController {
  constructor(private readonly tenants: PlatformTenantsService) {}

  @Get()
  list() {
    return this.tenants.list();
  }

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }
}
