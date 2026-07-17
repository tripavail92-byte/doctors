import { Module } from '@nestjs/common';
import { ObservationsModule } from '../observations/observations.module';
import { DermatologyService } from './dermatology.service';
import { DermatologyController } from './dermatology.controller';

@Module({
  imports: [ObservationsModule],
  controllers: [DermatologyController],
  providers: [DermatologyService],
  exports: [DermatologyService],
})
export class DermatologyModule {}
