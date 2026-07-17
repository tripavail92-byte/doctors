import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { ConsentService } from './consent.service';

// PrismaService (global) + StorageService (global StorageModule) are injected.
@Module({
  controllers: [MediaController],
  providers: [MediaService, ConsentService],
  exports: [MediaService, ConsentService],
})
export class MediaModule {}
