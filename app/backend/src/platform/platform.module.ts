import { Module } from '@nestjs/common';
import { PlatformTenantsController } from './platform-tenants.controller';
import { PlatformTenantsService } from './platform-tenants.service';
import { OrgHierarchyController } from './org-hierarchy.controller';
import { OrgHierarchyService } from './org-hierarchy.service';

// PrismaService is provided globally by PrismaModule.
@Module({
  controllers: [PlatformTenantsController, OrgHierarchyController],
  providers: [PlatformTenantsService, OrgHierarchyService],
})
export class PlatformModule {}
