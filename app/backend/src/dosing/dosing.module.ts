import { Module } from '@nestjs/common';
import { DosingController } from './dosing.controller';
import { DosingService } from './dosing.service';

// PrismaService is provided globally by PrismaModule.
@Module({
  controllers: [DosingController],
  providers: [DosingService],
  exports: [DosingService],
})
export class DosingModule {}
