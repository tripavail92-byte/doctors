import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { DentalController } from './dental.controller';
import { DentalService } from './dental.service';

// PrismaService is provided globally by PrismaModule. BillingModule provides
// BillingService for the tooth-plan -> invoice glue.
@Module({
  imports: [BillingModule],
  controllers: [DentalController],
  providers: [DentalService],
  exports: [DentalService],
})
export class DentalModule {}
