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

  /**
   * File an invoice with FBR, exactly once.
   *
   * This used to read the invoice, check `fbrInvoiceNumber` was null, dispatch,
   * and write the IRN back — with no lock. Two clicks (or two webhook retries)
   * both passed the read and both filed. Reproduced at 6/6 and 8/8 concurrent
   * submits all returning 201 against one invoice.
   *
   * In stub mode the IRN is derived from the invoice number, so every writer
   * stores the same string and the row looks innocent — only the response count
   * reveals it. In live mode each call is a real POST returning a DIFFERENT
   * server-assigned IRN: the tax authority records N sales for one sale, the last
   * write wins, and the orphaned IRNs exist nowhere in our database. (Live-mode
   * multi-IRN behaviour is inferred from dispatch(), not reproduced — nobody
   * fabricated FBR credentials. The inference is sound; the code is unambiguous.)
   *
   * The fix is a claim, not a lock: `lockInvoice` would hold a row lock across a
   * third-party HTTP round trip, which is its own outage. A single conditional
   * UPDATE decides the winner atomically, then the dispatch happens OUTSIDE any
   * transaction.
   */
  async submitInvoice(invoiceId: string): Promise<FbrSubmitResult> {
    const { tenantId } = getTenant();

    const invoice = await this.prisma.forTenant(tenantId, async (tx) => {
      const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { lines: true } });
      if (!inv) throw new NotFoundException(`Invoice ${invoiceId} not found`);
      if (inv.status === 'DRAFT') {
        throw new BadRequestException('Cannot submit a DRAFT invoice to FBR — finalize it first');
      }
      // A cancelled bill is not a sale. Absent before, and reachable: a void
      // invoice that had been resurrected by the confirmGateway hole filed
      // cleanly with the tax authority.
      if (inv.status === 'VOID') {
        throw new BadRequestException('Cannot submit a void invoice to FBR');
      }
      if (inv.fbrInvoiceNumber) {
        throw new BadRequestException(`Invoice already submitted (IRN ${inv.fbrInvoiceNumber})`);
      }
      return inv;
    });

    // Claim the submission. Exactly one caller can win this: the WHERE clause is
    // evaluated under the row lock the UPDATE itself takes.
    const claimed = await this.prisma.forTenant(tenantId, (tx) =>
      tx.$executeRaw`
        UPDATE "Invoice"
           SET "fbrStatus" = 'SUBMITTING'
         WHERE id = ${invoiceId}::uuid
           AND "fbrInvoiceNumber" IS NULL
           AND ("fbrStatus" IS NULL OR "fbrStatus" <> 'SUBMITTING')`,
    );
    if (claimed === 0) {
      throw new BadRequestException(
        'This invoice is already being submitted to FBR, or has been submitted already.',
      );
    }

    let result: { fbrInvoiceNumber: string; fbrStatus: string; mode: 'live' | 'stub' };
    try {
      result = await this.dispatch(this.buildPayload(invoice), invoice.number);
    } catch (e) {
      // Release the claim, or a failed filing wedges the invoice in SUBMITTING
      // forever and it can never be filed at all — trading a double-file for a
      // permanent no-file is not a fix.
      await this.prisma.forTenant(tenantId, (tx) =>
        tx.$executeRaw`
          UPDATE "Invoice" SET "fbrStatus" = NULL
           WHERE id = ${invoiceId}::uuid AND "fbrInvoiceNumber" IS NULL`,
      );
      throw e;
    }

    await this.prisma.forTenant(tenantId, (tx) =>
      tx.invoice.update({
        where: { id: invoiceId },
        data: {
          fbrInvoiceNumber: result.fbrInvoiceNumber,
          fbrStatus: result.fbrStatus,
          fbrSubmittedAt: new Date(),
        },
      }),
    );

    return {
      provider: 'fbr-digital-invoicing',
      mode: result.mode,
      invoiceId,
      invoiceNumber: invoice.number,
      fbrInvoiceNumber: result.fbrInvoiceNumber,
      fbrStatus: result.fbrStatus,
    };
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
