import { Module } from '@nestjs/common';
import { PlatformTenantsController } from './platform-tenants.controller';
import { PlatformTenantsService } from './platform-tenants.service';

// PrismaService is provided globally by PrismaModule.
@Module({
  controllers: [PlatformTenantsController],
  providers: [PlatformTenantsService],
})
export class PlatformModule {}
