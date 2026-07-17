import { Module } from '@nestjs/common';
import { LabController } from './lab.controller';
import { LabService } from './lab.service';

// PrismaService is provided globally by PrismaModule.
@Module({
  controllers: [LabController],
  providers: [LabService],
  exports: [LabService],
})
export class LabModule {}
