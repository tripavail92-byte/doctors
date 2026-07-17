import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BodySide, EyeExamStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant, getTenantId } from '../common/tenant/tenant-context';
import { ObservationsService } from '../observations/observations.service';
import { normalizeSide } from '../observations/laterality';
import { toLogmar } from './engines/va.engine';
import { validateRefraction } from './engines/refraction.engine';
import { iopAlert } from './engines/iop.engine';
import {
  AddIopDto,
  AddRefractionDto,
  AddSegmentFindingDto,
  AddVaDto,
  CreateEyeExamDto,
} from './dto/eye-exam.dto';
import { CreatePrescriptionDto } from './dto/prescription.dto';

const WITH_DETAIL = {
  visualAcuities: true,
  refractions: true,
  iopMeasurements: true,
  segmentFindings: true,
  prescriptions: true,
} as const;

/** Map an eye token (OD/OS/L/R/OU) to the shared BodySide enum. */
function toBodySide(eye: string): BodySide {
  const norm = normalizeSide(eye); // 'left' | 'right' | 'bilateral' | null | undefined
  if (!norm) throw new BadRequestException(`Unrecognized eye "${eye}" (use OD/OS/OU)`);
  return norm.toUpperCase() as BodySide;
}

@Injectable()
export class OphthalmologyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly observations: ObservationsService,
  ) {}

  createExam(dto: CreateEyeExamDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const patient = await tx.patient.findUnique({ where: { id: dto.patientId } });
      if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found`);
      return tx.eyeExam.create({
        data: {
          tenantId,
          patientId: dto.patientId,
          encounterId: dto.encounterId ?? null,
          chiefComplaint: dto.chiefComplaint ?? null,
          createdById: userId ?? null,
        },
      });
    });
  }

  async addVa(examId: string, dto: AddVaDto) {
    const tenantId = getTenantId();
    const side = toBodySide(dto.eye);
    const logmar = toLogmar(dto.displayValue);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const exam = await this.requireOpenExam(tx, examId);
      const va = await tx.visualAcuityMeasure.create({
        data: {
          tenantId,
          eyeExamId: examId,
          laterality: side,
          condition: dto.condition,
          notation: dto.notation,
          displayValue: dto.displayValue,
          logmarValue: logmar,
          chartDistanceM: dto.chartDistanceM ?? null,
        },
      });
      // Mirror best-corrected/unaided VA into the core trends substrate.
      if (logmar != null) {
        await this.observations.recordIn(tx, exam.patientId, 'va_logmar', logmar, 'logMAR', `${dto.condition} ${dto.displayValue}`, undefined, dto.eye);
      }
      return { va, logmar };
    });
  }

  async addRefraction(examId: string, dto: AddRefractionDto) {
    const tenantId = getTenantId();
    const side = toBodySide(dto.eye);
    const check = validateRefraction(dto);
    if (check.errors.length) throw new BadRequestException(check.errors.join('; '));
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.requireOpenExam(tx, examId);
      const refraction = await tx.refraction.create({
        data: {
          tenantId,
          eyeExamId: examId,
          laterality: side,
          method: dto.method,
          sphere: dto.sphere,
          cylinder: dto.cylinder ?? null,
          axis: dto.axis ?? null,
          add: dto.add ?? null,
          pdBinocularMm: dto.pdBinocularMm ?? null,
          vaAchieved: dto.vaAchieved ?? null,
        },
      });
      return { refraction, warnings: check.warnings };
    });
  }

  async addIop(examId: string, dto: AddIopDto) {
    const tenantId = getTenantId();
    const side = toBodySide(dto.eye);
    // The engine rejects physiologically implausible pressures by throwing — but
    // the DTO bound (0..90) is wider than the engine's plausible range (1..80),
    // so a value like 85 or 0 passes validation and then throws a RAW error,
    // which NestJS renders as a 500. An out-of-range reading is bad INPUT, not a
    // server fault: translate it to a 400, the same way the lab and grading
    // engines' validation failures are surfaced.
    let alert;
    try {
      alert = iopAlert(dto.valueMmHg);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    return this.prisma.forTenant(tenantId, async (tx) => {
      const exam = await this.requireOpenExam(tx, examId);
      // Mirror into the core iop_mmhg Observation (per-eye trends reuse).
      const obs = await this.observations.recordIn(tx, exam.patientId, 'iop_mmhg', dto.valueMmHg, 'mmHg', `IOP ${dto.method}`, undefined, dto.eye);
      const iop = await tx.iopMeasurement.create({
        data: {
          tenantId,
          eyeExamId: examId,
          laterality: side,
          valueMmHg: dto.valueMmHg,
          method: dto.method,
          cctMicrons: dto.cctMicrons ?? null,
          postDilation: dto.postDilation ?? false,
          alertSeverity: alert.severity,
          observationId: (obs as { id?: string })?.id ?? null,
        },
      });
      return { iop, alert };
    });
  }

  async addSegmentFinding(examId: string, dto: AddSegmentFindingDto) {
    const tenantId = getTenantId();
    const side = toBodySide(dto.eye);
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.requireOpenExam(tx, examId);
      return tx.eyeSegmentFinding.upsert({
        where: {
          tenantId_eyeExamId_laterality_structure: {
            tenantId,
            eyeExamId: examId,
            laterality: side,
            structure: dto.structure,
          },
        },
        update: { status: dto.status, findingCode: dto.findingCode ?? null, gradeValue: dto.gradeValue ?? null, freeText: dto.freeText ?? null, segment: dto.segment },
        create: {
          tenantId,
          eyeExamId: examId,
          laterality: side,
          segment: dto.segment,
          structure: dto.structure,
          status: dto.status,
          findingCode: dto.findingCode ?? null,
          gradeValue: dto.gradeValue ?? null,
          freeText: dto.freeText ?? null,
        },
      });
    });
  }

  async signExam(examId: string) {
    const tenantId = getTenantId();
    const { userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const exam = await tx.eyeExam.findUnique({ where: { id: examId } });
      if (!exam) throw new NotFoundException(`Eye exam ${examId} not found`);
      if (exam.status === EyeExamStatus.SIGNED) throw new BadRequestException('Exam is already signed');
      await tx.eyeExam.update({ where: { id: examId }, data: { status: EyeExamStatus.SIGNED, signedAt: new Date(), signedById: userId ?? null } });
      return this.reload(tx, examId);
    });
  }

  getExam(id: string) {
    return this.prisma.forCurrentTenant(async (tx) => {
      const exam = await tx.eyeExam.findUnique({ where: { id }, include: WITH_DETAIL });
      if (!exam) throw new NotFoundException(`Eye exam ${id} not found`);
      return exam;
    });
  }

  listExams(patientId: string) {
    return this.prisma.forCurrentTenant((tx) =>
      tx.eyeExam.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' }, include: WITH_DETAIL }),
    );
  }

  createPrescription(dto: CreatePrescriptionDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();
    // Validate each eye's numbers.
    for (const [eye, sph, cyl, axis, add] of [
      ['OD', dto.odSphere, dto.odCylinder, dto.odAxis, dto.odAdd],
      ['OS', dto.osSphere, dto.osCylinder, dto.osAxis, dto.osAdd],
    ] as const) {
      if (sph == null) continue;
      const check = validateRefraction({ sphere: sph, cylinder: cyl, axis, add, pdBinocularMm: dto.pdBinocularMm });
      if (check.errors.length) throw new BadRequestException(`${eye}: ${check.errors.join('; ')}`);
    }
    return this.prisma.forTenant(tenantId, async (tx) => {
      const patient = await tx.patient.findUnique({ where: { id: dto.patientId } });
      if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found`);
      return tx.opticalPrescription.create({
        data: {
          tenantId,
          patientId: dto.patientId,
          eyeExamId: dto.eyeExamId ?? null,
          type: dto.type,
          odSphere: dto.odSphere ?? null,
          odCylinder: dto.odCylinder ?? null,
          odAxis: dto.odAxis ?? null,
          odAdd: dto.odAdd ?? null,
          osSphere: dto.osSphere ?? null,
          osCylinder: dto.osCylinder ?? null,
          osAxis: dto.osAxis ?? null,
          osAdd: dto.osAdd ?? null,
          pdBinocularMm: dto.pdBinocularMm ?? null,
          lensRecommendation: (dto.lensRecommendation ?? undefined) as Prisma.InputJsonValue | undefined,
          validUntil: new Date(dto.validUntil),
          prescribedById: userId ?? null,
        },
      });
    });
  }

  private async requireOpenExam(tx: Prisma.TransactionClient, examId: string) {
    const exam = await tx.eyeExam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException(`Eye exam ${examId} not found`);
    if (exam.status === EyeExamStatus.SIGNED) {
      throw new BadRequestException('Exam is signed — amend it before adding findings');
    }
    return exam;
  }

  private reload(tx: Prisma.TransactionClient, id: string) {
    return tx.eyeExam.findUnique({ where: { id }, include: WITH_DETAIL });
  }
}
