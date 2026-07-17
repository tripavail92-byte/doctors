import { Module } from '@nestjs/common';
import { ImagingService } from './imaging.service';
import { ImagingController } from './imaging.controller';

@Module({
  controllers: [ImagingController],
  providers: [ImagingService],
  exports: [ImagingService],
})
export class ImagingModule {}
