import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdmissionStatus, BedStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';
import { CreateWardDto } from './dto/create-ward.dto';
import { AdmitDto } from './dto/admit.dto';

const ADM_DETAIL = {
  patient: { select: { name: true, mrn: true } },
  bed: { include: { ward: { select: { name: true, floor: true } } } },
} as const;

/**
 * Hospital / IPD: wards, beds, and admissions. Admitting locks the bed row so
 * two admissions can't occupy the same bed; discharge frees it.
 */
@Injectable()
export class IpdService {
  constructor(private readonly prisma: PrismaService) {}

  createWard(dto: CreateWardDto) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const ward = await tx.ward.create({
        data: { tenantId: tenantId!, name: dto.name, floor: dto.floor ?? null },
      });
      if (dto.bedCodes && dto.bedCodes.length) {
        await tx.bed.createMany({
          data: dto.bedCodes.map((code) => ({ tenantId: tenantId!, wardId: ward.id, code })),
        });
      }
      return tx.ward.findUnique({ where: { id: ward.id }, include: { beds: true } });
    });
  }

  listWards() {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.ward.findMany({ include: { beds: true }, orderBy: { name: 'asc' } }),
    );
  }

  beds(status?: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.bed.findMany({
        where: status ? { status: status as BedStatus } : {},
        include: { ward: { select: { name: true } } },
        orderBy: [{ wardId: 'asc' }, { code: 'asc' }],
      }),
    );
  }

  async occupancy() {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.bed.groupBy({ by: ['status'], _count: { _all: true } });
      const map: Record<string, number> = {};
      let total = 0;
      for (const r of rows) {
        map[String(r.status)] = r._count._all;
        total += r._count._all;
      }
      const occupied = map[BedStatus.OCCUPIED] ?? 0;
      return {
        totalBeds: total,
        available: map[BedStatus.AVAILABLE] ?? 0,
        occupied,
        maintenance: map[BedStatus.MAINTENANCE] ?? 0,
        occupancyRatePct: total ? Math.round((occupied / total) * 100) : 0,
      };
    });
  }

  admit(dto: AdmitDto) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      await ensurePatient(tx, dto.patientId);
      // Fast, friendly path — but NOT the guard. This read and the create below
      // are a read-then-write: two concurrent admits of the same patient to
      // different beds both pass here (the bed lock only serialises the same
      // bed), and one patient lands in two beds. The real guard is the partial
      // unique index "one ADMITTED per patient" (prisma/constraints.sql); this
      // read just turns the common case into a clean message instead of a
      // caught constraint violation.
      const active = await tx.admission.findFirst({
        where: { patientId: dto.patientId, status: AdmissionStatus.ADMITTED },
      });
      if (active) throw new BadRequestException('Patient is already admitted');

      // Lock the bed so concurrent admissions can't both take it.
      await tx.$executeRaw`SELECT id FROM "Bed" WHERE id = ${dto.bedId}::uuid FOR UPDATE`;
      const bed = await tx.bed.findUnique({ where: { id: dto.bedId } });
      if (!bed) throw new NotFoundException(`Bed ${dto.bedId} not found`);
      if (bed.status !== BedStatus.AVAILABLE) {
        throw new BadRequestException(`Bed is ${bed.status.toLowerCase()} — not available`);
      }

      let admission;
      try {
        admission = await tx.admission.create({
          data: {
            tenantId: tenantId!,
            patientId: dto.patientId,
            bedId: dto.bedId,
            admittingDoctorId: dto.admittingDoctorId ?? null,
            diagnosis: dto.diagnosis ?? null,
          },
        });
      } catch (e) {
        // The index is what actually holds under a race — the loser lands here.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new BadRequestException('Patient is already admitted');
        }
        throw e;
      }
      await tx.bed.update({ where: { id: dto.bedId }, data: { status: BedStatus.OCCUPIED } });
      return tx.admission.findUnique({ where: { id: admission.id }, include: ADM_DETAIL });
    });
  }

  async discharge(id: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Admission" WHERE id = ${id}::uuid FOR UPDATE`;
      const admission = await tx.admission.findUnique({ where: { id } });
      if (!admission) throw new NotFoundException(`Admission ${id} not found`);
      if (admission.status !== AdmissionStatus.ADMITTED) {
        throw new BadRequestException('Admission is already discharged');
      }
      await tx.admission.update({
        where: { id },
        data: { status: AdmissionStatus.DISCHARGED, dischargedAt: new Date() },
      });
      await tx.bed.update({ where: { id: admission.bedId }, data: { status: BedStatus.AVAILABLE } });
      return tx.admission.findUnique({ where: { id }, include: ADM_DETAIL });
    });
  }

  listAdmissions(status?: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.admission.findMany({
        where: status ? { status: status as AdmissionStatus } : {},
        include: ADM_DETAIL,
        orderBy: { admittedAt: 'desc' },
      }),
    );
  }
}

async function ensurePatient(tx: Prisma.TransactionClient, patientId: string): Promise<void> {
  const patient = await tx.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
}
