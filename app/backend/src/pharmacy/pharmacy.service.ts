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
  async stock(formularyCode?: string) {
    const { tenantId } = getTenant();
    const batches = await this.prisma.forTenant(tenantId, (tx) =>
      tx.stockItem.findMany({
        where: { ...(formularyCode ? { formularyCode } : {}), quantityOnHand: { gt: 0 } },
        orderBy: [{ formularyCode: 'asc' }, { expiry: 'asc' }],
      }),
    );
    const byDrug = new Map<string, { formularyCode: string; name: string; onHand: number; batches: typeof batches }>();
    for (const b of batches) {
      const g = byDrug.get(b.formularyCode) ?? { formularyCode: b.formularyCode, name: b.name, onHand: 0, batches: [] };
      g.onHand += b.quantityOnHand;
      g.batches.push(b);
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

      const usedBatch: Record<string, string> = {};
      for (const line of lines) {
        // Lock this drug's stock rows, then decrement FEFO.
        await tx.$executeRaw`SELECT id FROM "StockItem" WHERE "tenantId" = ${tenantId}::uuid AND "formularyCode" = ${line.formularyCode} AND "quantityOnHand" > 0 FOR UPDATE`;
        const batches = await tx.stockItem.findMany({
          where: { formularyCode: line.formularyCode, quantityOnHand: { gt: 0 } },
          orderBy: { expiry: 'asc' },
        });
        const available = batches.reduce((s, b) => s + b.quantityOnHand, 0);
        if (available < line.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${line.name}: ${available} on hand, ${line.quantity} requested`,
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
          if (!usedBatch[line.formularyCode]) usedBatch[line.formularyCode] = b.batchNo;
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
      await tx.dispenseItem.createMany({
        data: lines.map((l) => ({
          tenantId: tenantId!,
          dispenseId: dispenseRow.id,
          formularyCode: l.formularyCode,
          name: l.name,
          quantity: l.quantity,
          unitPricePkr: l.unitPricePkr,
          lineTotalPkr: l.lineTotalPkr,
          batchNo: usedBatch[l.formularyCode] ?? null,
        })),
      });
      return reload(tx, dispenseRow.id);
    });
  }

  async get(id: string) {
    const { tenantId } = getTenant();
    const d = await this.prisma.forTenant(tenantId, (tx) =>
      tx.dispense.findUnique({ where: { id }, include: { items: true } }),
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
        include: { items: true },
      }),
    );
  }
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
  return tx.dispense.findUnique({ where: { id }, include: { items: true } });
}
