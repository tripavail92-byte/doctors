import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';
import { FORMULARY, getDrug } from './formulary';
import { ReceiveStockDto } from './dto/receive-stock.dto';
import { DispenseDto } from './dto/dispense.dto';

/**
 * Pharmacy: formulary (reference) + batch stock + dispensing (POS). A dispense
 * decrements stock FEFO (first-expiry-first-out) under a row lock, rejecting
 * insufficient stock, and snapshots prices onto the receipt.
 */
@Injectable()
export class PharmacyService {
  constructor(private readonly prisma: PrismaService) {}

  formulary() {
    return FORMULARY;
  }

  // Receive a batch of stock.
  receiveStock(dto: ReceiveStockDto) {
    const drug = getDrug(dto.formularyCode);
    if (!drug) throw new BadRequestException(`Unknown drug "${dto.formularyCode}"`);
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.stockItem.create({
        data: {
          tenantId: tenantId!,
          formularyCode: drug.code,
          name: drug.name,
          batchNo: dto.batchNo,
          expiry: new Date(dto.expiry),
          quantityOnHand: dto.quantity,
          unitCostPkr: dto.unitCostPkr,
        },
      }),
    );
  }

  // On-hand quantity per drug (optionally one drug) + its batches.
  //
  // `onHand` is the DISPENSABLE quantity — expired batches are excluded from it,
  // because counting them would tell a pharmacist they have stock they are not
  // allowed to hand out. Expired units are surfaced separately as a pull
  // worklist, the same way the cold chain surfaces vials to remove from the
  // fridge: they exist, they must come off the shelf, and they are not stock.
  async stock(formularyCode?: string) {
    const { tenantId } = getTenant();
    const today = startOfToday();
    const batches = await this.prisma.forTenant(tenantId, (tx) =>
      tx.stockItem.findMany({
        where: { ...(formularyCode ? { formularyCode } : {}), quantityOnHand: { gt: 0 } },
        orderBy: [{ formularyCode: 'asc' }, { expiry: 'asc' }],
      }),
    );
    const byDrug = new Map<
      string,
      {
        formularyCode: string;
        name: string;
        onHand: number;
        expired: number;
        batches: (typeof batches[number] & { expired: boolean })[];
      }
    >();
    for (const b of batches) {
      const g =
        byDrug.get(b.formularyCode) ??
        { formularyCode: b.formularyCode, name: b.name, onHand: 0, expired: 0, batches: [] };
      const expired = b.expiry < today;
      if (expired) g.expired += b.quantityOnHand;
      else g.onHand += b.quantityOnHand;
      g.batches.push({ ...b, expired });
      byDrug.set(b.formularyCode, g);
    }
    return Array.from(byDrug.values());
  }

  // Dispense a sale: FEFO-decrement stock, snapshot prices, generate a receipt.
  dispense(dto: DispenseDto) {
    const { tenantId, userId } = getTenant();
    const lines = dto.items.map((it) => {
      const drug = getDrug(it.code);
      if (!drug) throw new BadRequestException(`Unknown drug "${it.code}"`);
      return {
        formularyCode: drug.code,
        name: drug.name,
        quantity: it.quantity,
        unitPricePkr: drug.pricePkr,
        lineTotalPkr: drug.pricePkr * it.quantity,
      };
    });
    const totalPkr = lines.reduce((s, l) => s + l.lineTotalPkr, 0);

    return this.prisma.forTenant(tenantId, async (tx) => {
      if (dto.patientId) await ensurePatient(tx, dto.patientId);

      const today = startOfToday();
      // What each LINE actually drew, per batch. Keyed by line index, not by
      // drug: two lines of the same drug draw separately, and a single line can
      // span batches. Each line's FIRST entry is what the receipt shows.
      const drawn: { batchNo: string; quantity: number; expiry: Date }[][] = lines.map(() => []);

      // Lock drugs in a DETERMINISTIC order, not the order the client listed
      // them. Two carts naming the same two drugs in opposite order each held
      // one lock and waited on the other: 19 of 20 concurrent two-drug sales
      // returned 500 (reproduced). Sorting by formularyCode means every caller
      // acquires in the same sequence, so the cycle cannot form. The receipt
      // still lists lines in the order the user entered them.
      const lockOrder = lines.map((l, i) => i).sort((a, b) => lines[a].formularyCode.localeCompare(lines[b].formularyCode));
      for (const idx of lockOrder) {
        const line = lines[idx];
        // Lock this drug's stock rows, then decrement FEFO. ORDER BY id so rows
        // WITHIN a drug are also locked consistently between transactions.
        await tx.$executeRaw`SELECT id FROM "StockItem" WHERE "tenantId" = ${tenantId}::uuid AND "formularyCode" = ${line.formularyCode} AND "quantityOnHand" > 0 ORDER BY id FOR UPDATE`;
        const allBatches = await tx.stockItem.findMany({
          where: { formularyCode: line.formularyCode, quantityOnHand: { gt: 0 } },
          orderBy: { expiry: 'asc' },
        });
        // FEFO among IN-DATE batches only. Ordering earliest-first without this
        // filter dispenses the MOST expired batch first — verified live handing
        // out paracetamol dated 2020. Expired medicine is not stock; it is a
        // recall waiting to happen. Refused at dispensing, the same place the
        // cold chain refuses a dead vaccine vial — a report nobody reads later
        // is not a control.
        const batches = allBatches.filter((b) => b.expiry >= today);
        const available = batches.reduce((s, b) => s + b.quantityOnHand, 0);
        if (available < line.quantity) {
          const expiredQty = allBatches
            .filter((b) => b.expiry < today)
            .reduce((s, b) => s + b.quantityOnHand, 0);
          const expiredNote = expiredQty
            ? ` (${expiredQty} more on hand but EXPIRED — pull from shelf, do not dispense)`
            : '';
          throw new BadRequestException(
            `Insufficient in-date stock for ${line.name}: ${available} usable, ${line.quantity} requested${expiredNote}`,
          );
        }
        let need = line.quantity;
        for (const b of batches) {
          if (need <= 0) break;
          const take = Math.min(need, b.quantityOnHand);
          await tx.stockItem.update({
            where: { id: b.id },
            data: { quantityOnHand: b.quantityOnHand - take },
          });
          // Record EVERY batch this line drew, with how much. Without this a
          // recall of batch B2 cannot find the patient who received 50 of its
          // units, because the receipt names only B1.
          drawn[idx].push({ batchNo: b.batchNo, quantity: take, expiry: b.expiry });
          need -= take;
        }
      }

      const receiptNumber = await nextReceipt(tx, tenantId!);
      const dispenseRow = await tx.dispense.create({
        data: {
          tenantId: tenantId!,
          patientId: dto.patientId ?? null,
          receiptNumber,
          totalPkr,
          paymentMethod: dto.paymentMethod as PaymentMethod,
          dispensedById: userId ?? null,
        },
      });
      // One create per line rather than createMany, because createMany returns
      // no ids and each line's batch provenance has to hang off its own row.
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        await tx.dispenseItem.create({
          data: {
            tenantId: tenantId!,
            dispenseId: dispenseRow.id,
            formularyCode: l.formularyCode,
            name: l.name,
            quantity: l.quantity,
            unitPricePkr: l.unitPricePkr,
            lineTotalPkr: l.lineTotalPkr,
            // THIS line's first batch. Previously keyed by drug, so a second
            // line of the same drug inherited the first line's batch even when
            // it drew from somewhere else entirely.
            batchNo: drawn[i][0]?.batchNo ?? null,
            batches: {
              create: drawn[i].map((d) => ({
                tenantId: tenantId!,
                batchNo: d.batchNo,
                quantity: d.quantity,
                expiry: d.expiry,
              })),
            },
          },
        });
      }
      return reload(tx, dispenseRow.id);
    });
  }

  async get(id: string) {
    const { tenantId } = getTenant();
    const d = await this.prisma.forTenant(tenantId, (tx) =>
      tx.dispense.findUnique({ where: { id }, include: { items: { include: { batches: true } } } }),
    );
    if (!d) throw new NotFoundException(`Dispense ${id} not found`);
    return d;
  }

  list(patientId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.dispense.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        // Provenance on the READ path too. Without it, the batch split existed
        // only in the POST response — discard that and a recall is unanswerable
        // through any UI.
        include: { items: { include: { batches: true } } },
      }),
    );
  }
}

// Start of the local day. A batch is expired once its expiry DATE has passed —
// a batch expiring today is still usable today, so compare against midnight, not
// the current instant.
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function ensurePatient(tx: Prisma.TransactionClient, patientId: string): Promise<void> {
  const patient = await tx.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
}

async function nextReceipt(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  await tx.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
    `dispense-receipt:${tenantId}`,
  );
  const year = new Date().getFullYear();
  const like = `RX-${year}-`;
  const count = await tx.dispense.count({ where: { receiptNumber: { startsWith: like } } });
  return `${like}${String(count + 1).padStart(4, '0')}`;
}

function reload(tx: Prisma.TransactionClient, id: string) {
  // `batches` is included deliberately: it is the only complete record of which
  // lots a sale drew from, and a recall is answered from it. `item.batchNo` is
  // the first batch only and is kept for the printed receipt.
  return tx.dispense.findUnique({
    where: { id },
    include: { items: { include: { batches: true } } },
  });
}
