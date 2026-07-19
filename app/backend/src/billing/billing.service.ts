import {
  BadRequestException,
  ConflictException,
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
        const dup = await this.findByReference(tx, tenantId!, opts.reference, invoiceId, amountPkr);
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

  /**
   * Retire every PENDING intent on an invoice.
   *
   * An intent snapshots `total - paid` at mint time and then stops tracking
   * reality. Anything that moves the balance invalidates it, so every such path
   * must call this in the SAME transaction as the change: otherwise the window
   * between the two is a window in which the stale link still pays.
   *
   * `exceptId` exists for confirmGateway, which is consuming one intent while
   * retiring its siblings — without it, the intent being consumed would cancel
   * itself.
   */
  private async cancelPendingIntents(
    tx: Prisma.TransactionClient,
    tenantId: string,
    invoiceId: string,
    exceptId?: string,
  ) {
    await tx.paymentIntent.updateMany({
      where: {
        tenantId,
        invoiceId,
        status: 'PENDING',
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { status: 'CANCELLED' },
    });
  }

  // Confirm a gateway payment (simulated webhook). Validated against the
  // persisted intent: right invoice, still pending, pay the STORED amount.
  async confirmGateway(invoiceId: string, reference: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const invoice = await this.lockInvoice(tx, invoiceId); // serialize on the invoice

      // BEFORE the duplicate short-circuit, not after: a replayed webhook must
      // not return a cheerful 200 against a cancelled bill either.
      //
      // This was the one money-moving path without this guard (recordPayment,
      // createPayLink, refund and appendLine all had it). It was reachable by the
      // most ordinary sequence there is: send a pay link, patient doesn't pay,
      // clinic voids the bill. The void is permitted precisely because paid == 0
      // -- which is exactly the condition applyPayment tests to accept money. The
      // precondition for voiding an invoice was the precondition for collecting
      // on it, so two individually-correct guards composed into a hole, and the
      // cancelled invoice came back PAID with nothing recording it had been void.
      if (invoice.status === InvoiceStatus.VOID) {
        throw new BadRequestException('Cannot pay a void invoice');
      }

      const intent = await tx.paymentIntent.findUnique({
        where: { tenantId_reference: { tenantId: tenantId!, reference } },
      });
      if (!intent) throw new BadRequestException('Unknown payment reference');
      if (intent.invoiceId !== invoiceId) {
        throw new BadRequestException('Reference does not belong to this invoice');
      }
      if (intent.status === 'CANCELLED') {
        // Name staleness explicitly. The alternative was an accidental 400 from
        // balance arithmetic ("amount exceeds outstanding"), which sends whoever
        // reads it hunting the wrong bug.
        throw new BadRequestException(
          'This payment link is no longer valid — the invoice balance changed after it was issued. Issue a new link.',
        );
      }
      if (intent.status === 'CONSUMED') {
        const payment = await tx.payment.findUnique({
          where: { tenantId_reference: { tenantId: tenantId!, reference } },
        });
        return { duplicate: true, payment, invoice: await reload(tx, invoiceId) };
      }

      // The intent being PENDING does not mean the reference is unused: a Payment
      // can already carry it (the reference is public — it is in the pay-link body
      // and in the checkout URL). applyPayment's unguarded create would then hit
      // the (tenantId, reference) unique index and 500, on every webhook retry,
      // forever. recordPayment already short-circuits on this key; confirmGateway
      // checked only the intent's status, which is a different key.
      const already = await this.findByReference(tx, tenantId!, reference, invoiceId, intent.amountPkr);
      if (already) {
        await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: 'CONSUMED' } });
        return { duplicate: true, payment: already, invoice: await reload(tx, invoiceId) };
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
      // Any sibling link for this invoice is now priced against a balance that no
      // longer exists.
      await this.cancelPendingIntents(tx, tenantId!, invoiceId, intent.id);
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

      // A refunded invoice re-enters collections: paid collapses to 0 and the
      // status derives to UNPAID, making it byte-identical to a never-paid bill.
      // Any pay link minted before the refund therefore still confirms — the
      // patient clicks the link they were emailed before their refund, is charged
      // a second time, and the refund is silently reversed. The ledger stays
      // arithmetically balanced through all of it (payments - refunds == paid), so
      // no reconciliation job would ever flag it.
      await this.cancelPendingIntents(tx, tenantId!, invoiceId);
      return { refund: refundRow, invoice: await reload(tx, invoiceId) };
    });
  }

  // Void an invoice. Only allowed once fully refunded (paid == 0).
  async voidInvoice(invoiceId: string, reason?: string) {
    const { tenantId, userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const invoice = await this.lockInvoice(tx, invoiceId);
      if (invoice.status === InvoiceStatus.VOID) {
        throw new BadRequestException('Invoice is already void');
      }
      if (invoice.paid > 0) {
        throw new BadRequestException('Refund all payments before voiding this invoice');
      }
      // Stamp WHO cancelled the bill and when. A void erases a charge; leaving it
      // unattributable meant nobody could later answer "who cancelled this, and
      // on whose say-so?" — the one question an audit asks first. The reason is
      // recorded when given (whether to REQUIRE one is the clinic's policy).
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.VOID,
          voidedById: userId ?? null,
          voidedAt: new Date(),
          voidReason: reason ?? null,
        },
      });
      // The patient may be holding a live checkout link to a bill we just
      // cancelled. Killing the invoice is not enough; kill the links to it.
      await this.cancelPendingIntents(tx, tenantId!, invoiceId);
      return reload(tx, invoiceId);
    });
  }

  /**
   * Append a single line to an existing (non-void) invoice — used by packs that
   * bill procedures as they are completed (e.g. dental tooth-plan completion).
   * Total only ever increases, so the paid<=total invariant is preserved; the
   * status is recomputed. Locks the invoice to serialize with payments.
   *
   * `expectedPatientId` is REQUIRED and is not ceremony. Callers hand this method
   * an invoiceId that ultimately came from a request body, and it used to append
   * to whatever id it was given. A DOCTOR — a role that gets 403 on every billing
   * route, including reading the invoice — could complete a PKR 150,000 plan item
   * for one patient onto a different patient's paid invoice, which then carried a
   * debt for a procedure performed on someone else.
   *
   * The role bypass was the visible half; this ownership check is the half that
   * matters, because a FINANCE user with a mistyped id does the same damage. Who
   * may write money must not be decided by whichever controller happens to call
   * in.
   */
  async appendLine(invoiceId: string, item: InvoiceLineInput, expectedPatientId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const invoice = await this.lockInvoice(tx, invoiceId);
      if (invoice.patientId !== expectedPatientId) {
        throw new BadRequestException(
          'This invoice belongs to a different patient — a procedure cannot be billed to someone else.',
        );
      }
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

  /**
   * Idempotency lookup for a payment reference.
   *
   * `amountPkr` is compared, not ignored. Matching on the reference alone treats
   * a reused receipt-book number as a replay of the first payment: the front desk
   * takes PKR 3,000 in cash against reference RCPT-42 that was already used for
   * PKR 5,000, gets a cheerful 201 back, and the 3,000 is silently discarded
   * while the patient still shows as owing it. Reusing a receipt number is
   * clerical, not adversarial — it will happen.
   *
   * An idempotency key must be validated against the request it claims to
   * repeat. Same reference and same amount is a genuine replay; same reference
   * and a different amount is two different payments wearing one name.
   */
  private async findByReference(
    tx: Prisma.TransactionClient,
    tenantId: string,
    reference: string,
    invoiceId: string,
    amountPkr?: number,
  ) {
    const existing = await tx.payment.findUnique({
      where: { tenantId_reference: { tenantId, reference } },
    });
    if (!existing) return null;
    if (existing.invoiceId !== invoiceId) {
      throw new BadRequestException('Reference already used on another invoice');
    }
    if (amountPkr !== undefined && existing.amount !== amountPkr) {
      throw new ConflictException(
        `Reference ${reference} was already used for PKR ${existing.amount} — use a distinct reference for this PKR ${amountPkr} payment.`,
      );
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
    // The cross-invoice reference check in findByReference is a READ, so two
    // concurrent payments reusing one reference on DIFFERENT invoices both pass
    // it and both insert — the loser hit the (tenantId, reference) unique index
    // and surfaced as a 500. A reused receipt number is bad INPUT; it should get
    // the same clean refusal whether it loses a race or not.
    let payment;
    try {
      payment = await tx.payment.create({
        data: { tenantId, invoiceId: invoice.id, amount: amountPkr, method, provider, reference },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && reference) {
        throw new ConflictException(
          `Reference ${reference} is already in use — use a distinct reference for this payment.`,
        );
      }
      throw e;
    }
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
