import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FINANCE_ROLES } from '../rbac/role-groups';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { PayLinkDto } from './dto/pay-link.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { RefundDto } from './dto/refund.dto';
import { VoidInvoiceDto } from './dto/void-invoice.dto';

/**
 * Billing API — invoices + payments. Gated to finance/front-desk roles.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...FINANCE_ROLES)
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('invoices')
  create(@Body() dto: CreateInvoiceDto) {
    return this.billing.createInvoice(dto);
  }

  @Get('patients/:patientId/invoices')
  list(@Param('patientId') patientId: string) {
    return this.billing.list(patientId);
  }

  @Get('invoices/:id')
  get(@Param('id') id: string) {
    return this.billing.get(id);
  }

  // Record a manual payment (cash/card/bank/POS).
  @Post('invoices/:id/payments')
  pay(@Param('id') id: string, @Body() dto: RecordPaymentDto) {
    return this.billing.recordPayment(id, dto.amountPkr, dto.method, {
      reference: dto.reference,
    });
  }

  // Open a gateway checkout link for the outstanding balance.
  @Post('invoices/:id/pay-link')
  payLink(@Param('id') id: string, @Body() dto: PayLinkDto) {
    return this.billing.createPayLink(id, dto.provider);
  }

  // Confirm a gateway payment (simulates the provider's webhook).
  @Post('invoices/:id/confirm')
  confirm(@Param('id') id: string, @Body() dto: ConfirmPaymentDto) {
    return this.billing.confirmGateway(id, dto.reference);
  }

  // Refund against an invoice (reduces paid).
  @Post('invoices/:id/refunds')
  refund(@Param('id') id: string, @Body() dto: RefundDto) {
    return this.billing.refund(id, dto.amountPkr, dto.method, dto.reason);
  }

  // Void an invoice (only once fully refunded). The actor is taken from the
  // authenticated user, never the body — a caller must not be able to attribute
  // a cancellation to someone else.
  @Patch('invoices/:id/void')
  void(@Param('id') id: string, @Body() dto?: VoidInvoiceDto) {
    return this.billing.voidInvoice(id, dto?.reason);
  }
}
