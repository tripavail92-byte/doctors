import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PlatformDashboardService } from './platform-dashboard.service';
import {
  OnboardingActivityQueryDto,
  PlatformSummaryQueryDto,
  PlatformTenantsListQueryDto,
} from './dto/dashboard-query.dto';

/**
 * Platform-admin dashboard endpoints.
 *
 * PLATFORM_ADMIN only. No EntitlementGuard — a platform admin has no tenant,
 * so tenant-scoped entitlements do not apply here. Same reasoning as
 * PlatformTenantsController, kept adjacent to it for consistency.
 *
 * All six routes are documented at docs/contracts/platform-*.md; the
 * TypeScript response shape lives at app/web/src/api/contracts/platform.ts.
 * The frontend consumes the same shape today, first through a dev-time stub
 * (VITE_STUB_API=1) and now against this controller in production. Contract
 * drift shows up as a shape mismatch at the browser, not silently — see
 * PlatformDashboardPage's WidgetBoundary for what happens if it does.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
@Controller('platform')
export class PlatformDashboardController {
  constructor(private readonly dashboard: PlatformDashboardService) {}

  @Get('summary')
  summary(@Query() query: PlatformSummaryQueryDto) {
    return this.dashboard.summary(query.period ?? 'this-month', query.from, query.to);
  }

  @Get('clinic-distribution')
  distribution() {
    return this.dashboard.clinicDistribution();
  }

  // Deliberately a NEW path from the legacy GET /platform/tenants (which
  // remains, serving TenantsPage.tsx). Two shapes for two consumers; the
  // legacy endpoint returns Tenant[] and this one returns the paginated
  // {total, limit, offset, rows} contract. Frontend uses an adapter today
  // that tolerates either — see adaptTenantList().
  @Get('tenants/paged')
  tenants(@Query() query: PlatformTenantsListQueryDto) {
    return this.dashboard.tenants(query.limit, query.offset, query.q, query.status);
  }

  @Get('onboarding-activity')
  onboardingActivity(@Query() query: OnboardingActivityQueryDto) {
    return this.dashboard.onboardingActivity(query.limit);
  }

  @Get('popular-modules')
  popularModules() {
    return this.dashboard.popularModules();
  }

  @Get('health')
  health() {
    return this.dashboard.health();
  }
}
