import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';
import { EPI_SCHEDULE } from './epi-schedule';
import { computeSchedule, scheduleSummary } from './immunization.engine';
import { RecordImmunizationDto } from './dto/record-immunization.dto';

/**
 * Immunization: records administered vaccine doses and computes a child's EPI
 * schedule (due / overdue / given) from their DOB. The schedule itself is
 * reference data (epi-schedule.ts) driven by the pure engine.
 */
@Injectable()
export class ImmunizationService {
  constructor(private readonly prisma: PrismaService) {}

  // The EPI schedule reference (for pickers / display).
  vaccines() {
    return EPI_SCHEDULE;
  }

  // Record (or update) an administered dose. Unique per patient+vaccine+dose.
  record(dto: RecordImmunizationDto) {
    const { tenantId, userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      await ensurePatient(tx, dto.patientId);
      const givenAt = dto.givenAt ? new Date(dto.givenAt) : new Date();
      return tx.immunization.upsert({
        where: {
          tenantId_patientId_vaccineCode_dose: {
            tenantId: tenantId!,
            patientId: dto.patientId,
            vaccineCode: dto.vaccineCode,
            dose: dto.dose,
          },
        },
        update: {
          givenAt,
          lotNumber: dto.lotNumber ?? null,
          site: dto.site ?? null,
          givenById: userId ?? null,
        },
        create: {
          tenantId: tenantId!,
          patientId: dto.patientId,
          vaccineCode: dto.vaccineCode,
          dose: dto.dose,
          givenAt,
          lotNumber: dto.lotNumber ?? null,
          site: dto.site ?? null,
          givenById: userId ?? null,
        },
      });
    });
  }

  list(patientId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.immunization.findMany({ where: { patientId }, orderBy: { givenAt: 'desc' } }),
    );
  }

  async schedule(patientId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const patient = await tx.patient.findUnique({ where: { id: patientId } });
      if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
      if (!patient.dob) {
        throw new BadRequestException('Patient has no date of birth — cannot build a schedule');
      }
      const given = await tx.immunization.findMany({ where: { patientId } });
      const rows = computeSchedule(
        patient.dob,
        new Date(),
        given.map((g) => ({
          vaccineCode: g.vaccineCode,
          dose: g.dose,
          givenAt: g.givenAt,
          lotNumber: g.lotNumber,
        })),
      );
      return {
        patientId,
        dob: patient.dob.toISOString().slice(0, 10),
        summary: scheduleSummary(rows),
        schedule: rows,
      };
    });
  }
}

async function ensurePatient(tx: Prisma.TransactionClient, patientId: string): Promise<void> {
  const patient = await tx.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
}
