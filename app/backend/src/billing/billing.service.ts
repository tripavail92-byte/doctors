import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BodySide, InvoiceStatus, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';
import {
  GatewayProvider,
  PaymentGatewayService,
} from './payment-gateway.service';
import { CreateInvoiceDto, InvoiceLineInput } from './dto/create-invoice.dto';
import { expandLaterality } from './laterality-pricing';
import { normalizeSide } from '../observations/laterality';

const MAX_INT4 = 2_147_483_647;
const WITH_DETAIL = { lines: true, payments: true, refunds: true } as const;

type Line = {
  code: string;
  name: string;
  unitPricePkr: number;
  quantity: number;
  lineTotalPkr: number;
  side: BodySide | null;
};

/**
 * Billing: itemized invoices, payments (manual or via a Pakistan gateway), and
 * status transitions. Money integrity is enforced at the DB, not just in JS:
 *  - the invoice row is locked FOR UPDATE before any read-modify-write of paid,
 *    and a CHECK (paid <= total) backstops overpayment;
 *  - invoice numbers are generated under a per-tenant advisory lock + a unique
 *    constraint;
 *  - gateway confirmations are validated against a persisted PaymentIntent
 *    (right invoice, still pending, stored amount) — never a raw client string;
 *  - totals/line totals are recomputed server-side and bounded to int4.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGatewayService,
  ) {}

  createInvoice(dto: CreateInvoiceDto) {
    if (dto.planId) return this.createFromPlan(dto.planId);
    if (dto.patientId && dto.items && dto.items.length) {
      return this.createManual(dto.patientId, dto.items);
    }
    throw new BadRequestException('Provide either "planId", or "patientId" + "items"');
  }

  list(patientId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.invoice.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        include: WITH_DETAIL,
      }),
    );
  }

  async get(id: string) {
    const { tenantId } = getTenant();
    const inv = await this.prisma.forTenant(tenantId, (tx) =>
      tx.invoice.findUnique({ where: { id }, include: WITH_DETAIL }),
    );
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
    return inv;
  }

  // Manual payment (cash/card/bank/POS). Idempotent on a supplied reference.
  async recordPayment(
    invoiceId: string,
    amountPkr: number,
    method: PaymentMethod,
    opts?: { provider?: GatewayProvider | null; reference?: string | null },
  ) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const invoice = await this.lockInvoice(tx, invoiceId);
      if (invoice.status === InvoiceStatus.VOID) {
        throw new BadRequestException('Cannot pay a void invoice');
      }
      if (opts?.reference) {
        const dup = await this.findByReference(tx, tenantId!, opts.reference, invoiceId);
        if (dup) return dup;
      }
      return this.applyPayment(tx, tenantId!, invoice, amountPkr, method, opts?.provider ?? null, opts?.reference ?? null);
    });
  }

  // Open a hosted-checkout link, persisting a PENDING intent for the balance.
  async createPayLink(invoiceId: string, provider: GatewayProvider) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const invoice = await this.lockInvoice(tx, invoiceId);
      if (invoice.status === InvoiceStatus.VOID) {
        throw new BadRequestException('Cannot pay a void invoice');
      }
      const outstanding = invoice.total - invoice.paid;
      if (outstanding <= 0) throw new BadRequestException('Nothing due on this invoice');
      const intent = this.gateway.createIntent(provider, outstanding);
      await tx.paymentIntent.create({
        data: {
          tenantId: tenantId!,
          invoiceId,
          provider,
          reference: intent.reference,
          amountPkr: outstanding,
        },
      });
      return { invoiceId, number: invoice.number, ...intent };
    });
  }

  // Confirm a gateway payment (simulated webhook). Validated against the
  // persisted intent: right invoice, still pending, pay the STORED amount.
  async confirmGateway(invoiceId: string, reference: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const invoice = await this.lockInvoice(tx, invoiceId); // serialize on the invoice
      const intent = await tx.paymentIntent.findUnique({
        where: { tenantId_reference: { tenantId: tenantId!, reference } },
      });
      if (!intent) throw new BadRequestException('Unknown payment reference');
      if (intent.invoiceId !== invoiceId) {
        throw new BadRequestException('Reference does not belong to this invoice');
      }
      if (intent.status === 'CONSUMED') {
        const payment = await tx.payment.findUnique({
          where: { tenantId_reference: { tenantId: tenantId!, reference } },
        });
        return { duplicate: true, payment, invoice: await reload(tx, invoiceId) };
      }
      const method = this.gateway.methodFor(intent.provider as GatewayProvider);
      const result = await this.applyPayment(
        tx,
        tenantId!,
        invoice,
        intent.amountPkr,
        method,
        intent.provider,
        reference,
      );
      await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: 'CONSUMED' } });
      return result;
    });
  }

  // Refund against an invoice: reduces paid (never below 0), recomputes status.
  async refund(invoiceId: string, amountPkr: number, method: PaymentMethod, reason?: string) {
    const { tenantId, userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const invoice = await this.lockInvoice(tx, invoiceId);
      if (invoice.status === InvoiceStatus.VOID) {
        throw new BadRequestException('Cannot refund a void invoice');
      }
      if (amountPkr > invoice.paid) {
        throw new BadRequestException(
          `Refund ${amountPkr} exceeds the amount paid ${invoice.paid}`,
        );
      }
      const refundRow = await tx.refund.create({
        data: {
          tenantId: tenantId!,
          invoiceId,
          amountPkr,
          method,
          reason: reason ?? null,
          createdById: userId ?? null,
        },
      });
      const paid = invoice.paid - amountPkr;
      const status = paid <= 0 ? InvoiceStatus.UNPAID : InvoiceStatus.PARTIAL;
      await tx.invoice.update({ where: { id: invoiceId }, data: { paid, status } });
      return { refund: refundRow, invoice: await reload(tx, invoiceId) };
    });
  }

  // Void an invoice. Only allowed once fully refunded (paid == 0).
  async voidInvoice(invoiceId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const invoice = await this.lockInvoice(tx, invoiceId);
      if (invoice.status === InvoiceStatus.VOID) {
        throw new BadRequestException('Invoice is already void');
      }
      if (invoice.paid > 0) {
        throw new BadRequestException('Refund all payments before voiding this invoice');
      }
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: InvoiceStatus.VOID } });
      return reload(tx, invoiceId);
    });
  }

  /**
   * Append a single line to an existing (non-void) invoice — used by packs that
   * bill procedures as they are completed (e.g. dental tooth-plan completion).
   * Total only ever increases, so the paid<=total invariant is preserved; the
   * status is recomputed. Locks the invoice to serialize with payments.
   */
  async appendLine(invoiceId: string, item: InvoiceLineInput) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const invoice = await this.lockInvoice(tx, invoiceId);
      if (invoice.status === InvoiceStatus.VOID) {
        throw new BadRequestException('Cannot add a line to a void invoice');
      }
      // Same expansion as buildLines: a bilateral item appended to an existing
      // invoice must still become two lines, or the second side is done and
      // never billed. Reusing buildLines keeps the two paths from drifting.
      const { lines: expanded, total: added } = this.buildLines([item]);
      const newTotal = invoice.total + added;
      if (newTotal > MAX_INT4) throw new BadRequestException('Invoice total exceeds the maximum');

      const created = [];
      for (const l of expanded) {
        created.push(
          await tx.invoiceLineItem.create({ data: { tenantId: tenantId!, invoiceId, ...l } }),
        );
      }
      const status =
        invoice.paid >= newTotal
          ? InvoiceStatus.PAID
          : invoice.paid > 0
            ? InvoiceStatus.PARTIAL
            : InvoiceStatus.UNPAID;
      await tx.invoice.update({ where: { id: invoiceId }, data: { total: newTotal, status } });
      return {
        // `lines` (plural): one bilateral request yields two rows. `line` stays
        // for existing callers, which only ever append single-sided items.
        lines: created,
        line: created[0],
        invoice: await reload(tx, invoiceId),
      };
    });
  }

  // ---- internals --------------------------------------------------------

  // Lock the invoice row so concurrent payments serialize (Prisma has no native
  // FOR UPDATE, so use a raw statement inside the same transaction).
  private async lockInvoice(tx: Prisma.TransactionClient, id: string) {
    await tx.$executeRaw`SELECT id FROM "Invoice" WHERE id = ${id}::uuid FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    return invoice;
  }

  private async findByReference(
    tx: Prisma.TransactionClient,
    tenantId: string,
    reference: string,
    invoiceId: string,
  ) {
    const existing = await tx.payment.findUnique({
      where: { tenantId_reference: { tenantId, reference } },
    });
    if (!existing) return null;
    if (existing.invoiceId !== invoiceId) {
      throw new BadRequestException('Reference already used on another invoice');
    }
    return { duplicate: true, payment: existing, invoice: await reload(tx, invoiceId) };
  }

  // Guarded write of a payment against a LOCKED invoice.
  private async applyPayment(
    tx: Prisma.TransactionClient,
    tenantId: string,
    invoice: { id: string; total: number; paid: number },
    amountPkr: number,
    method: PaymentMethod,
    provider: string | null,
    reference: string | null,
  ) {
    const outstanding = invoice.total - invoice.paid;
    if (outstanding <= 0) throw new BadRequestException('Invoice is already fully paid');
    if (amountPkr <= 0) throw new BadRequestException('Payment amount must be positive');
    if (amountPkr > outstanding) {
      throw new BadRequestException(
        `Amount ${amountPkr} exceeds the outstanding balance ${outstanding}`,
      );
    }
    const payment = await tx.payment.create({
      data: { tenantId, invoiceId: invoice.id, amount: amountPkr, method, provider, reference },
    });
    const paid = invoice.paid + amountPkr;
    const status = paid >= invoice.total ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL;
    await tx.invoice.update({ where: { id: invoice.id }, data: { paid, status } });
    return { duplicate: false, payment, invoice: await reload(tx, invoice.id) };
  }

  /**
   * Expand each requested item into the line(s) actually billed, then price them.
   *
   * A bilateral procedure is two procedures: without a bundled both-sides price
   * it becomes TWO lines, which is why one input can yield two outputs here.
   */
  private buildLines(items: InvoiceLineInput[]): { lines: Line[]; total: number } {
    const lines = items.flatMap((it) => {
      const side = normalizeSide(it.side);
      if (side === undefined) throw new BadRequestException(`Unrecognized side "${it.side}"`);
      return expandLaterality({
        code: it.code,
        name: it.name,
        unitPricePkr: it.unitPricePkr,
        quantity: it.quantity,
        side,
        lateralizable: it.lateralizable,
        bilateralPricePkr: it.bilateralPricePkr,
        sideContext: it.sideContext,
      }).map((e) => {
        const lineTotalPkr = e.unitPricePkr * e.quantity;
        if (lineTotalPkr > MAX_INT4) {
          throw new BadRequestException(`Line total for "${e.name}" exceeds the maximum`);
        }
        return { ...e, lineTotalPkr, side: (e.side as BodySide | null) ?? null };
      });
    });
    const total = lines.reduce((s, l) => s + l.lineTotalPkr, 0);
    if (total > MAX_INT4) throw new BadRequestException('Invoice total exceeds the maximum');
    return { lines, total };
  }

  private createManual(patientId: string, items: InvoiceLineInput[]) {
    const { tenantId } = getTenant();
    const { lines, total } = this.buildLines(items);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const patient = await tx.patient.findUnique({ where: { id: patientId } });
      if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
      return this.materialize(tx, tenantId!, patientId, lines, total, null);
    });
  }

  private createFromPlan(planId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      // Lock the plan row so it can only be invoiced once.
      await tx.$executeRaw`SELECT id FROM "TreatmentPlan" WHERE id = ${planId}::uuid FOR UPDATE`;
      const plan = await tx.treatmentPlan.findUnique({
        where: { id: planId },
        include: { items: true },
      });
      if (!plan) throw new NotFoundException(`Treatment plan ${planId} not found`);
      if (plan.status !== 'PROPOSED') {
        throw new BadRequestException(`Treatment plan is already ${plan.status.toLowerCase()} — cannot re-invoice`);
      }
      // Recompute line totals server-side (don't trust stored values).
      const { lines, total } = this.buildLines(
        plan.items.map((i) => ({ code: i.code, name: i.name, unitPricePkr: i.unitPricePkr, quantity: i.quantity })),
      );
      const invoice = await this.materialize(tx, tenantId!, plan.patientId, lines, total, plan.id);
      await tx.treatmentPlan.update({ where: { id: plan.id }, data: { status: 'ACCEPTED' } });
      return invoice;
    });
  }

  private async materialize(
    tx: Prisma.TransactionClient,
    tenantId: string,
    patientId: string,
    lines: Line[],
    total: number,
    planId: string | null,
  ) {
    // Serialize invoice numbering per tenant so count()-based numbers don't collide.
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
      `invoice-number:${tenantId}`,
    );
    const year = new Date().getFullYear();
    const count = await tx.invoice.count({ where: { number: { startsWith: `INV-${year}-` } } });
    const number = `INV-${year}-${String(count + 1).padStart(4, '0')}`;

    const invoice = await tx.invoice.create({
      data: {
        tenantId,
        patientId,
        number,
        total,
        planId,
        status: total > 0 ? InvoiceStatus.UNPAID : InvoiceStatus.PAID,
      },
    });
    if (lines.length) {
      await tx.invoiceLineItem.createMany({
        data: lines.map((l) => ({ tenantId, invoiceId: invoice.id, ...l })),
      });
    }
    return reload(tx, invoice.id);
  }
}

function reload(tx: Prisma.TransactionClient, invoiceId: string) {
  return tx.invoice.findUnique({ where: { id: invoiceId }, include: WITH_DETAIL });
}
