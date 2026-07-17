// Global Prisma module.
//
// Marked @Global so PrismaService can be injected anywhere without importing
// this module in every feature module.

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}