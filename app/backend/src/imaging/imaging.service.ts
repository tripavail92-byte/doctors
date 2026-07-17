import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImagingOrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant, getTenantId } from '../common/tenant/tenant-context';
import { IMAGING_STUDIES, getStudy } from './imaging-catalog';
import { CreateImagingOrderDto } from './dto/create-imaging-order.dto';
import { AddImagingReportDto } from './dto/add-imaging-report.dto';

const WITH_DETAIL = { items: true, reports: true } as const;

/**
 * Imaging / RIS: order -> acquire (assign accession) -> radiologist report per
 * study -> auto-REPORTED when every study is read. Mirrors the LIS lifecycle.
 */
@Injectable()
export class ImagingService {
  constructor(private readonly prisma: PrismaService) {}

  studies() {
    return IMAGING_STUDIES;
  }

  createOrder(dto: CreateImagingOrderDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();
    const items = dto.studyCodes.map((code) => {
      const st = getStudy(code);
      if (!st) throw new BadRequestException(`Unknown imaging study "${code}"`);
      return { studyCode: st.code, studyName: st.name, modality: st.modality, pricePkr: st.pricePkr };
    });
    return this.prisma.forTenant(tenantId, async (tx) => {
      await ensurePatient(tx, dto.patientId);
      const orderNumber = await nextNumber(tx, tenantId, 'RAD', 'order', 'orderNumber');
      const order = await tx.imagingOrder.create({
        data: { tenantId, patientId: dto.patientId, orderNumber, note: dto.note ?? null, orderedById: userId ?? null },
      });
      await tx.imagingOrderItem.createMany({
        data: items.map((i) => ({ tenantId, orderId: order.id, ...i })),
      });
      return reload(tx, order.id);
    });
  }

  list(patientId: string) {
    return this.prisma.forCurrentTenant((tx) =>
      tx.imagingOrder.findMany({ where: { patientId }, orderBy: { orderedAt: 'desc' }, include: WITH_DETAIL }),
    );
  }

  async get(id: string) {
    const order = await this.prisma.forCurrentTenant((tx) =>
      tx.imagingOrder.findUnique({ where: { id }, include: WITH_DETAIL }),
    );
    if (!order) throw new NotFoundException(`Imaging order ${id} not found`);
    return order;
  }

  async acquire(id: string, accessionNumber?: string) {
    const tenantId = getTenantId();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const order = await lockOrder(tx, id);
      if (order.status !== ImagingOrderStatus.ORDERED) {
        throw new BadRequestException(`Order is ${order.status.toLowerCase()} — cannot acquire`);
      }
      const accession = accessionNumber || (await nextNumber(tx, tenantId, 'IMG', 'accession', 'accessionNumber'));
      await tx.imagingOrder.update({
        where: { id },
        data: { status: ImagingOrderStatus.ACQUIRED, accessionNumber: accession },
      });
      return reload(tx, id);
    });
  }

  async addReport(id: string, dto: AddImagingReportDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const order = await lockOrder(tx, id);
      if (order.status !== ImagingOrderStatus.ACQUIRED && order.status !== ImagingOrderStatus.REPORTED) {
        throw new BadRequestException(
          order.status === ImagingOrderStatus.ORDERED
            ? 'Acquire the study before reporting'
            : `Order is ${order.status.toLowerCase()} — cannot report`,
        );
      }
      const items = await tx.imagingOrderItem.findMany({ where: { orderId: id } });
      if (!items.some((i) => i.studyCode === dto.studyCode)) {
        throw new BadRequestException(`Study "${dto.studyCode}" was not ordered`);
      }
      await tx.imagingReport.upsert({
        where: { tenantId_orderId_studyCode: { tenantId, orderId: id, studyCode: dto.studyCode } },
        update: { findings: dto.findings, impression: dto.impression, reportedById: userId ?? null },
        create: {
          tenantId,
          orderId: id,
          studyCode: dto.studyCode,
          findings: dto.findings,
          impression: dto.impression,
          reportedById: userId ?? null,
        },
      });
      const reportCount = await tx.imagingReport.count({ where: { orderId: id } });
      if (reportCount >= items.length && order.status === ImagingOrderStatus.ACQUIRED) {
        await tx.imagingOrder.update({ where: { id }, data: { status: ImagingOrderStatus.REPORTED } });
      }
      return reload(tx, id);
    });
  }

  async cancel(id: string) {
    return this.prisma.forCurrentTenant(async (tx) => {
      const order = await lockOrder(tx, id);
      if (order.status === ImagingOrderStatus.REPORTED) {
        throw new BadRequestException('Cannot cancel a reported order');
      }
      await tx.imagingOrder.update({ where: { id }, data: { status: ImagingOrderStatus.CANCELLED } });
      return reload(tx, id);
    });
  }
}

async function ensurePatient(tx: Prisma.TransactionClient, patientId: string): Promise<void> {
  const patient = await tx.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
}

async function lockOrder(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`SELECT id FROM "ImagingOrder" WHERE id = ${id}::uuid FOR UPDATE`;
  const order = await tx.imagingOrder.findUnique({ where: { id } });
  if (!order) throw new NotFoundException(`Imaging order ${id} not found`);
  return order;
}

async function nextNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  prefix: string,
  lockKey: string,
  column: 'orderNumber' | 'accessionNumber',
): Promise<string> {
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', `imaging-${lockKey}:${tenantId}`);
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-`;
  const count =
    column === 'orderNumber'
      ? await tx.imagingOrder.count({ where: { orderNumber: { startsWith: like } } })
      : await tx.imagingOrder.count({ where: { accessionNumber: { startsWith: like } } });
  return `${like}${String(count + 1).padStart(4, '0')}`;
}

function reload(tx: Prisma.TransactionClient, id: string) {
  return tx.imagingOrder.findUnique({ where: { id }, include: WITH_DETAIL });
}
