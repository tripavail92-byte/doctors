import { Module } from '@nestjs/common';
import { ObstetricsService } from './obstetrics.service';
import { ObstetricsController } from './obstetrics.controller';

@Module({
  controllers: [ObstetricsController],
  providers: [ObstetricsService],
  exports: [ObstetricsService],
})
export class ObstetricsModule {}
