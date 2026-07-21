import {
  BadRequestException,
  ConflictException,
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
      try {
        await tx.imagingOrder.update({
          where: { id },
          data: { status: ImagingOrderStatus.ACQUIRED, accessionNumber: accession },
        });
      } catch (e) {
        // The (tenantId, accessionNumber) unique index is the guarantee. A
        // client-supplied accession that is already in use, or a race, surfaces
        // as a clean 409 rather than filing two orders under one accession.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException(`Accession number "${accession}" is already in use.`);
        }
        throw e;
      }
      return reload(tx, id);
    });
  }

  async addReport(id: string, dto: AddImagingReportDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const order = await lockOrder(tx, id);
      // ACQUIRED only. A REPORTED order is finalized — admitting it here let the
      // upsert below rewrite an existing report in place, so a signed "acute
      // intracranial haemorrhage" became "no acute abnormality" on the same row,
      // same reportedAt, with nothing recording that it changed (reproduced).
      // A report is written once per study; a correction is an amendment, which
      // is a future feature, not a silent overwrite.
      if (order.status !== ImagingOrderStatus.ACQUIRED) {
        throw new BadRequestException(
          order.status === ImagingOrderStatus.ORDERED
            ? 'Acquire the study before reporting'
            : `Order is ${order.status.toLowerCase()} — its report is final and cannot be overwritten`,
        );
      }
      const items = await tx.imagingOrderItem.findMany({ where: { orderId: id } });
      if (!items.some((i) => i.studyCode === dto.studyCode)) {
        throw new BadRequestException(`Study "${dto.studyCode}" was not ordered`);
      }
      const existing = await tx.imagingReport.findUnique({
        where: { tenantId_orderId_studyCode: { tenantId, orderId: id, studyCode: dto.studyCode } },
      });
      if (existing) {
        throw new ConflictException(
          `Study "${dto.studyCode}" already has a report — a finalized report cannot be overwritten.`,
        );
      }
      await tx.imagingReport.create({
        data: {
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
  // MAX+1, not count()+1. count() assumes the series is dense; a deleted or
  // cancelled row leaves a hole and count() then re-issues an existing number,
  // hitting the unique index and 500ing. Same defect as the MRN and invoice
  // generators. The advisory lock still serialises concurrent minting.
  const col = column === 'orderNumber' ? 'orderNumber' : 'accessionNumber';
  const rows = await tx.$queryRawUnsafe<{ max: number | null }[]>(
    `SELECT MAX(SUBSTRING("${col}" FROM '^${prefix}-${year}-([0-9]+)$')::int) AS max
       FROM "ImagingOrder" WHERE "${col}" ~ '^${prefix}-${year}-[0-9]+$'`,
  );
  const next = (rows[0]?.max ?? 0) + 1;
  return `${like}${String(next).padStart(4, '0')}`;
}

function reload(tx: Prisma.TransactionClient, id: string) {
  return tx.imagingOrder.findUnique({ where: { id }, include: WITH_DETAIL });
}
