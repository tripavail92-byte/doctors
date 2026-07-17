import { Module } from '@nestjs/common';
import { ImmunizationController } from './immunization.controller';
import { ImmunizationService } from './immunization.service';

// PrismaService is provided globally by PrismaModule.
@Module({
  controllers: [ImmunizationController],
  providers: [ImmunizationService],
  exports: [ImmunizationService],
})
export class ImmunizationModule {}
