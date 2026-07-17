import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EntitlementGuard } from './entitlement.guard';
import { EntitlementsService } from './entitlements.service';
import { EntitlementsController } from './entitlements.controller';

// Global so EntitlementGuard (applied on controllers across many feature
// modules) can resolve EntitlementsService without every module re-importing
// this one — same pattern as the global PrismaModule. JwtAuthGuard works
// app-wide (AuthModule registers the passport strategy globally).
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [EntitlementsController],
  providers: [EntitlementsService, EntitlementGuard],
  // Exported so feature modules can apply EntitlementGuard on their controllers.
  exports: [EntitlementsService, EntitlementGuard],
})
export class EntitlementsModule {}