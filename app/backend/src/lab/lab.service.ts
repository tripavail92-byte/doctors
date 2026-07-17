import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LabOrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';
import { LAB_TESTS, getTest } from './lab-catalog';
import { flagResult } from './lab.engine';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { AddResultDto } from './dto/add-result.dto';

const WITH_DETAIL = { items: true, results: true } as const;

/**
 * Lab / LIS: order -> accession (collect) -> result (auto-flagged vs reference
 * range) -> report. Order/accession numbers are generated under a per-tenant
 * advisory lock; status transitions are enforced.
 */
@Injectable()
export class LabService {
  constructor(private readonly prisma: PrismaService) {}

  tests() {
    return LAB_TESTS;
  }

  createOrder(dto: CreateLabOrderDto) {
    const { tenantId, userId } = getTenant();
    // Validate + snapshot the ordered tests from the catalog.
    //
    // Dedupe first. A result is keyed by (order, testCode) and upserted, so a
    // test can hold exactly one result — but nothing stopped the same code being
    // ordered twice, creating two items one result could never satisfy. The order
    // then stuck in COLLECTED forever: report() counts results < items and
    // refuses, even though every test IS resulted. A test ordered twice is still
    // one test to run; deduping is the honest model, not a workaround.
    const seen = new Set<string>();
    const codes = dto.testCodes.filter((c) => {
      const key = getTest(c)?.code ?? c;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const items = codes.map((code) => {
      const test = getTest(code);
      if (!test) throw new BadRequestException(`Unknown lab test "${code}"`);
      return { testCode: test.code, testName: test.name, pricePkr: test.pricePkr };
    });
    return this.prisma.forTenant(tenantId, async (tx) => {
      await ensurePatient(tx, dto.patientId);
      const orderNumber = await nextNumber(tx, tenantId!, 'LAB', 'order', 'orderNumber');
      const order = await tx.labOrder.create({
        data: {
          tenantId: tenantId!,
          patientId: dto.patientId,
          orderNumber,
          note: dto.note ?? null,
          orderedById: userId ?? null,
        },
      });
      await tx.labOrderItem.createMany({
        data: items.map((i) => ({ tenantId: tenantId!, orderId: order.id, ...i })),
      });
      return reload(tx, order.id);
    });
  }

  list(patientId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.labOrder.findMany({
        where: { patientId },
        orderBy: { orderedAt: 'desc' },
        include: WITH_DETAIL,
      }),
    );
  }

  async get(id: string) {
    const { tenantId } = getTenant();
    const order = await this.prisma.forTenant(tenantId, (tx) =>
      tx.labOrder.findUnique({ where: { id }, include: WITH_DETAIL }),
    );
    if (!order) throw new NotFoundException(`Lab order ${id} not found`);
    return order;
  }

  // Mark the specimen collected and assign an accession number.
  async collect(id: string, accessionNumber?: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const order = await lockOrder(tx, id);
      if (order.status !== LabOrderStatus.ORDERED) {
        throw new BadRequestException(`Order is ${order.status.toLowerCase()} — cannot collect`);
      }
      const accession = accessionNumber || (await nextNumber(tx, tenantId!, 'ACC', 'accession', 'accessionNumber'));
      await tx.labOrder.update({
        where: { id },
        data: { status: LabOrderStatus.COLLECTED, accessionNumber: accession },
      });
      return reload(tx, id);
    });
  }

  // Enter a result for one ordered test; auto-flag against the reference range.
  async addResult(id: string, dto: AddResultDto) {
    if (dto.value === undefined && (dto.valueText === undefined || dto.valueText === '')) {
      throw new BadRequestException('Provide a numeric "value" or a "valueText"');
    }
    const { tenantId, userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const order = await lockOrder(tx, id);
      if (order.status !== LabOrderStatus.COLLECTED && order.status !== LabOrderStatus.RESULTED) {
        throw new BadRequestException(
          order.status === LabOrderStatus.ORDERED
            ? 'Collect the specimen before entering results'
            : `Order is ${order.status.toLowerCase()} — cannot add results`,
        );
      }
      const items = await tx.labOrderItem.findMany({ where: { orderId: id } });
      const item = items.find((i) => i.testCode === dto.testCode);
      if (!item) throw new BadRequestException(`Test "${dto.testCode}" was not ordered`);

      const test = getTest(dto.testCode);
      const flag = test ? flagResult(test, dto.value ?? null, dto.valueText) : 'unknown';
      await tx.labResult.upsert({
        where: { tenantId_orderId_testCode: { tenantId: tenantId!, orderId: id, testCode: dto.testCode } },
        update: {
          value: dto.value ?? null,
          valueText: dto.valueText ?? null,
          unit: test?.unit ?? null,
          refLow: test?.refLow ?? null,
          refHigh: test?.refHigh ?? null,
          flag,
          resultedById: userId ?? null,
        },
        create: {
          tenantId: tenantId!,
          orderId: id,
          testCode: dto.testCode,
          value: dto.value ?? null,
          valueText: dto.valueText ?? null,
          unit: test?.unit ?? null,
          refLow: test?.refLow ?? null,
          refHigh: test?.refHigh ?? null,
          flag,
          resultedById: userId ?? null,
        },
      });

      // When every ordered test has a result, the order is RESULTED.
      const resultCount = await tx.labResult.count({ where: { orderId: id } });
      if (resultCount >= items.length && order.status === LabOrderStatus.COLLECTED) {
        await tx.labOrder.update({ where: { id }, data: { status: LabOrderStatus.RESULTED } });
      }
      return reload(tx, id);
    });
  }

  // Finalize the report (all tests must be resulted).
  async report(id: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const order = await lockOrder(tx, id);
      const [items, results] = await Promise.all([
        tx.labOrderItem.count({ where: { orderId: id } }),
        tx.labResult.count({ where: { orderId: id } }),
      ]);
      if (results < items) {
        throw new BadRequestException('All ordered tests must be resulted before reporting');
      }
      if (order.status === LabOrderStatus.REPORTED) {
        throw new BadRequestException('Order is already reported');
      }
      if (order.status === LabOrderStatus.CANCELLED) {
        throw new BadRequestException('Cannot report a cancelled order');
      }
      await tx.labOrder.update({ where: { id }, data: { status: LabOrderStatus.REPORTED } });
      return reload(tx, id);
    });
  }

  async cancel(id: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const order = await lockOrder(tx, id);
      if (order.status === LabOrderStatus.REPORTED) {
        throw new BadRequestException('Cannot cancel a reported order');
      }
      await tx.labOrder.update({ where: { id }, data: { status: LabOrderStatus.CANCELLED } });
      return reload(tx, id);
    });
  }
}

async function ensurePatient(tx: Prisma.TransactionClient, patientId: string): Promise<void> {
  const patient = await tx.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
}

async function lockOrder(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`SELECT id FROM "LabOrder" WHERE id = ${id}::uuid FOR UPDATE`;
  const order = await tx.labOrder.findUnique({ where: { id } });
  if (!order) throw new NotFoundException(`Lab order ${id} not found`);
  return order;
}

// Per-tenant sequential number (LAB-2026-0001 / ACC-2026-0001), collision-safe
// under a per-tenant advisory lock + the column's unique constraint.
async function nextNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  prefix: string,
  lockKey: string,
  column: 'orderNumber' | 'accessionNumber',
): Promise<string> {
  await tx.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
    `lab-${lockKey}:${tenantId}`,
  );
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-`;
  const count =
    column === 'orderNumber'
      ? await tx.labOrder.count({ where: { orderNumber: { startsWith: like } } })
      : await tx.labOrder.count({ where: { accessionNumber: { startsWith: like } } });
  return `${like}${String(count + 1).padStart(4, '0')}`;
}

function reload(tx: Prisma.TransactionClient, id: string) {
  return tx.labOrder.findUnique({ where: { id }, include: WITH_DETAIL });
}
