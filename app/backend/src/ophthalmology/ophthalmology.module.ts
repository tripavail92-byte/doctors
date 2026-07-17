import { Module } from '@nestjs/common';
import { ObservationsModule } from '../observations/observations.module';
import { OphthalmologyService } from './ophthalmology.service';
import { OphthalmologyController } from './ophthalmology.controller';

@Module({
  imports: [ObservationsModule],
  controllers: [OphthalmologyController],
  providers: [OphthalmologyService],
  exports: [OphthalmologyService],
})
export class OphthalmologyModule {}
