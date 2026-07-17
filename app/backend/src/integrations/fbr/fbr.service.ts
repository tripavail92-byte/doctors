import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getTenant } from '../../common/tenant/tenant-context';
import { postJson } from '../http';

export interface FbrSubmitResult {
  provider: 'fbr-digital-invoicing';
  mode: 'live' | 'stub';
  invoiceId: string;
  invoiceNumber: string;
  fbrInvoiceNumber: string; // IRN
  fbrStatus: string;
}

/**
 * FBR Digital Invoicing (Pakistan). Submits a finalized Invoice to the FBR
 * IMS/PRAL endpoint and stores the returned IRN back on the invoice.
 *
 * Live mode requires FBR_TOKEN + FBR_SELLER_NTN + FBR_POS_ID; otherwise stub
 * mode returns a deterministic synthetic IRN so downstream flows (printing a
 * compliant receipt, reconciliation) can be built and demoed.
 */
@Injectable()
export class FbrService {
  private readonly logger = new Logger(FbrService.name);
  private readonly cfg: AppConfig['integrations']['fbr'];

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.cfg = config.get('integrations', { infer: true }).fbr;
  }

  mode(): 'live' | 'stub' {
    return this.cfg.token && this.cfg.sellerNtn && this.cfg.posId ? 'live' : 'stub';
  }

  async submitInvoice(invoiceId: string): Promise<FbrSubmitResult> {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { lines: true } });
      if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);
      if (invoice.status === 'DRAFT') {
        throw new BadRequestException('Cannot submit a DRAFT invoice to FBR — finalize it first');
      }
      if (invoice.fbrInvoiceNumber) {
        throw new BadRequestException(`Invoice already submitted (IRN ${invoice.fbrInvoiceNumber})`);
      }

      const payload = this.buildPayload(invoice);
      const { fbrInvoiceNumber, fbrStatus, mode } = await this.dispatch(payload, invoice.number);

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { fbrInvoiceNumber, fbrStatus, fbrSubmittedAt: new Date() },
      });

      return {
        provider: 'fbr-digital-invoicing',
        mode,
        invoiceId,
        invoiceNumber: invoice.number,
        fbrInvoiceNumber,
        fbrStatus,
      };
    });
  }

  private buildPayload(invoice: {
    number: string;
    total: number;
    lines: { name: string; quantity: number; unitPricePkr: number; lineTotalPkr: number }[];
  }) {
    return {
      InvoiceType: 'Sale Invoice',
      POSID: this.cfg.posId,
      USIN: invoice.number, // unique sale invoice number (our number)
      SellerNTNCNIC: this.cfg.sellerNtn,
      TotalBillAmount: invoice.total,
      TotalSaleValue: invoice.total,
      TotalQuantity: invoice.lines.reduce((n, l) => n + l.quantity, 0),
      PaymentMode: 1,
      items: invoice.lines.map((l) => ({
        ItemName: l.name,
        Quantity: l.quantity,
        PCTCode: '0000.0000',
        TaxRate: 0,
        SaleValue: l.lineTotalPkr,
        TotalAmount: l.lineTotalPkr,
      })),
    };
  }

  private async dispatch(
    payload: Record<string, unknown>,
    usin: string,
  ): Promise<{ fbrInvoiceNumber: string; fbrStatus: string; mode: 'live' | 'stub' }> {
    if (this.mode() === 'stub') {
      const irn = `FBR-STUB-${new Date().getFullYear()}-${hash(usin)}`;
      this.logger.log(`[stub] FBR submit USIN=${usin} -> IRN ${irn}`);
      return { fbrInvoiceNumber: irn, fbrStatus: 'SUBMITTED', mode: 'stub' };
    }
    const url = `${this.cfg.apiBase}/postinvoicedata`;
    const { status, data } = await postJson<{ InvoiceNumber?: string; ValidationResponse?: { Status?: string } }>(
      url,
      payload,
      { Authorization: `Bearer ${this.cfg.token}` },
    );
    if (status < 200 || status >= 300 || !data.InvoiceNumber) {
      throw new BadRequestException(`FBR rejected invoice: ${JSON.stringify(data).slice(0, 200)}`);
    }
    return {
      fbrInvoiceNumber: data.InvoiceNumber,
      fbrStatus: data.ValidationResponse?.Status ?? 'SUBMITTED',
      mode: 'live',
    };
  }
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase();
}
