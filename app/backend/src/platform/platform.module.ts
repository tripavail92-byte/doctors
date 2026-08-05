import { Module } from '@nestjs/common';
import { PlatformTenantsController } from './platform-tenants.controller';
import { PlatformTenantsService } from './platform-tenants.service';
import { PlatformDashboardController } from './platform-dashboard.controller';
import { PlatformDashboardService } from './platform-dashboard.service';
import { OrgHierarchyController } from './org-hierarchy.controller';
import { OrgHierarchyService } from './org-hierarchy.service';

// PrismaService is provided globally by PrismaModule.
@Module({
  controllers: [PlatformTenantsController, PlatformDashboardController, OrgHierarchyController],
  providers: [PlatformTenantsService, PlatformDashboardService, OrgHierarchyService],
})
export class PlatformModule {}
