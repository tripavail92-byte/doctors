import { Module } from '@nestjs/common';
import { ObservationsModule } from '../observations/observations.module';
import { RehabService } from './rehab.service';
import { RehabController } from './rehab.controller';

@Module({
  imports: [ObservationsModule],
  controllers: [RehabController],
  providers: [RehabService],
  exports: [RehabService],
})
export class RehabModule {}
