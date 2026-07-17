import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaymentGatewayService } from './payment-gateway.service';

// PrismaService is provided globally by PrismaModule.
@Module({
  controllers: [BillingController],
  providers: [BillingService, PaymentGatewayService],
  exports: [BillingService],
})
export class BillingModule {}
