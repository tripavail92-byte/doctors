import { Module } from '@nestjs/common';
import { IpdController } from './ipd.controller';
import { IpdService } from './ipd.service';

// PrismaService is provided globally by PrismaModule.
@Module({
  controllers: [IpdController],
  providers: [IpdService],
  exports: [IpdService],
})
export class IpdModule {}
