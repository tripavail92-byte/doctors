import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BodySide, DentalPlanStatus, FindingStatus, Prisma, ToothType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant, getTenantId } from '../common/tenant/tenant-context';
import { BillingService } from '../billing/billing.service';
import {
  FDI_PERMANENT,
  FDI_PRIMARY,
  SURFACES,
  TOOTH_CONDITIONS,
  archSideOf,
  isValidCondition,
  isValidTooth,
  isValidToothAny,
  toothTypeOf,
} from './tooth-reference';
import { buildOdontogram } from './odontogram.engine';
import {
  interpretBpe,
  summarizePerio,
  validateSites,
} from './perio.engine';
import { RecordToothDto } from './dto/record-tooth.dto';
import { RecordFindingDto } from './dto/tooth-finding.dto';
import { currentChart, dmftFromChart } from './tooth-finding.engine';
import { RecordPerioExamDto } from './dto/record-perio-exam.dto';
import { CompleteToothPlanItemDto, CreateToothPlanItemDto } from './dto/tooth-plan.dto';
import { AddOrthoEventDto, CreateOrthoCaseDto } from './dto/ortho.dto';

/**
 * Dental charting. Records the current state of individual teeth (FDI notation)
 * and assembles the full odontogram + DMFT index via the pure engine, plus
 * periodontal charting, tooth-level plan-to-billing, and the ortho add-on.
 */
@Injectable()
export class DentalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  reference() {
    return {
      teeth: FDI_PERMANENT,
      // Primary dentition: a paediatric clinic charting a 4-year-old has no
      // permanent teeth to record.
      primaryTeeth: FDI_PRIMARY,
      conditions: TOOTH_CONDITIONS,
      surfaces: SURFACES,
    };
  }

  // -------------------------------------------------------------------------
  // Append-only tooth findings (the chart's history)
  // -------------------------------------------------------------------------

  /**
   * Record a finding. Never updates a prior row — a correction supersedes it.
   *
   * ToothRecord (the current-state projection) is refreshed alongside so the
   * existing odontogram keeps working unchanged.
   */
  async recordFinding(dto: RecordFindingDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();

    const toothType = dto.toothType ?? toothTypeOf(dto.toothFdi) ?? undefined;
    if (toothType !== 'SUPERNUMERARY' && !isValidToothAny(dto.toothFdi)) {
      throw new BadRequestException(
        `"${dto.toothFdi}" is not an FDI tooth number (11-48 permanent, 51-85 primary)`,
      );
    }
    if (!isValidCondition(dto.condition)) {
      throw new BadRequestException(`Unknown tooth condition "${dto.condition}"`);
    }
    if (dto.mobilityGrade != null && dto.condition !== 'mobile') {
      throw new BadRequestException(
        `mobilityGrade only applies to a MOBILE tooth (condition is "${dto.condition}")`,
      );
    }

    // Derived, never accepted: the tooth number already states the side.
    const archSide = (archSideOf(dto.toothFdi) as BodySide | null) ?? null;

    return this.prisma.forTenant(tenantId, async (tx) => {
      const patient = await tx.patient.findUnique({ where: { id: dto.patientId } });
      if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found`);

      if (dto.supersedesId) {
        const prior = await tx.toothFinding.findUnique({ where: { id: dto.supersedesId } });
        if (!prior) throw new NotFoundException(`Finding ${dto.supersedesId} not found`);
        if (prior.toothFdi !== dto.toothFdi) {
          throw new BadRequestException(
            `Finding ${dto.supersedesId} is for tooth ${prior.toothFdi}, not ${dto.toothFdi}`,
          );
        }
        if (prior.supersededById) {
          throw new BadRequestException(
            `Finding ${dto.supersedesId} was already superseded — correct the current tip instead.`,
          );
        }
      }

      const finding = await tx.toothFinding.create({
        data: {
          tenantId: tenantId!,
          patientId: dto.patientId,
          encounterId: dto.encounterId ?? null,
          toothFdi: dto.toothFdi,
          toothType: (toothType ?? 'PERMANENT') as ToothType,
          supernumeraryRef: dto.supernumeraryRef ?? null,
          surfaces: dto.surfaces ?? [],
          condition: dto.condition,
          status: (dto.status ?? 'EXISTING') as FindingStatus,
          mobilityGrade: dto.mobilityGrade ?? null,
          archSide,
          note: dto.note ?? null,
          recordedById: userId ?? null,
        },
      });

      if (dto.supersedesId) {
        await tx.toothFinding.update({
          where: { id: dto.supersedesId },
          data: { supersededById: finding.id },
        });
      }

      return finding;
    });
  }

  /** The full append-only chain for a patient, superseded rows included. */
  listFindings(patientId: string, toothFdi?: string) {
    return this.prisma.forCurrentTenant((tx) =>
      tx.toothFinding.findMany({
        where: { patientId, ...(toothFdi ? { toothFdi } : {}) },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  /** The chart projected from the chain: the active tip per tooth, plus DMFT. */
  async chartFromFindings(patientId: string) {
    const rows = await this.listFindings(patientId);
    const chart = currentChart(rows);
    return {
      chart,
      // Permanent teeth only — the primary index is dmft (lowercase) and is a
      // different measure; mixing them inflates both.
      dmft: dmftFromChart(chart, isValidTooth),
      findingsTotal: rows.length,
      supersededTotal: rows.filter((r) => r.supersededById !== null).length,
    };
  }

  // Record/update one tooth (unique per patient + tooth).
  recordTooth(dto: RecordToothDto) {
    if (!isValidTooth(dto.toothFdi)) {
      throw new BadRequestException(`"${dto.toothFdi}" is not a valid FDI permanent tooth`);
    }
    if (!isValidCondition(dto.condition)) {
      throw new BadRequestException(`Unknown tooth condition "${dto.condition}"`);
    }
    const { tenantId, userId } = getTenant();
    const surfaces = dto.surfaces
      ? (dto.surfaces as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull;
    return this.prisma.forTenant(tenantId, async (tx) => {
      await ensurePatient(tx, dto.patientId);
      return tx.toothRecord.upsert({
        where: {
          tenantId_patientId_toothFdi: {
            tenantId: tenantId!,
            patientId: dto.patientId,
            toothFdi: dto.toothFdi,
          },
        },
        update: {
          condition: dto.condition,
          surfaces,
          note: dto.note ?? null,
          recordedById: userId ?? null,
        },
        create: {
          tenantId: tenantId!,
          patientId: dto.patientId,
          toothFdi: dto.toothFdi,
          condition: dto.condition,
          surfaces,
          note: dto.note ?? null,
          recordedById: userId ?? null,
        },
      });
    });
  }

  async odontogram(patientId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const patient = await tx.patient.findUnique({ where: { id: patientId } });
      if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
      const records = await tx.toothRecord.findMany({ where: { patientId } });
      const chart = buildOdontogram(
        records.map((r) => ({
          toothFdi: r.toothFdi,
          condition: r.condition,
          surfaces: r.surfaces,
          note: r.note,
        })),
      );
      return { patientId, ...chart };
    });
  }

  // ---- Periodontal charting ----------------------------------------------

  async recordPerioExam(dto: RecordPerioExamDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();
    const teeth = dto.teeth ?? [];
    for (const t of teeth) {
      if (!isValidTooth(t.toothFdi)) throw new BadRequestException(`"${t.toothFdi}" is not a valid FDI tooth`);
      for (const [name, arr, kind] of [
        ['pocketMm', t.pocketMm, 'mm'],
        ['recessionMm', t.recessionMm, 'mm'],
        ['bleeding', t.bleeding, 'bool'],
      ] as const) {
        const err = validateSites(`${t.toothFdi}.${name}`, arr, kind);
        if (err) throw new BadRequestException(err);
      }
    }

    return this.prisma.forTenant(tenantId, async (tx) => {
      await ensurePatient(tx, dto.patientId);
      const exam = await tx.perioExam.create({
        data: {
          tenantId,
          patientId: dto.patientId,
          encounterId: dto.encounterId ?? null,
          examType: dto.examType ?? 'FULL',
          bpeSextants: dto.bpeSextants ?? [],
          createdById: userId ?? null,
        },
      });
      if (teeth.length) {
        await tx.perioToothRecord.createMany({
          data: teeth.map((t) => ({
            tenantId,
            perioExamId: exam.id,
            toothFdi: t.toothFdi,
            pocketMm: t.pocketMm,
            recessionMm: t.recessionMm,
            bleeding: t.bleeding,
            suppuration: t.suppuration ?? [],
            plaque: t.plaque ?? [],
            furcation: t.furcation ?? 'NONE',
            mobility: t.mobility ?? null,
          })),
        });
      }
      const summary = summarizePerio(
        teeth.map((t) => ({
          toothFdi: t.toothFdi,
          pocketMm: t.pocketMm,
          recessionMm: t.recessionMm,
          bleeding: t.bleeding,
          furcation: t.furcation,
          mobility: t.mobility,
        })),
      );
      const bpe = dto.bpeSextants?.length ? interpretBpe(dto.bpeSextants) : null;
      return { exam, summary, bpe };
    });
  }

  async getPerioExam(id: string) {
    const exam = await this.prisma.forCurrentTenant((tx) =>
      tx.perioExam.findUnique({ where: { id }, include: { teeth: true } }),
    );
    if (!exam) throw new NotFoundException(`Perio exam ${id} not found`);
    const summary = summarizePerio(
      exam.teeth.map((t) => ({
        toothFdi: t.toothFdi,
        pocketMm: t.pocketMm,
        recessionMm: t.recessionMm,
        bleeding: t.bleeding,
        furcation: t.furcation,
        mobility: t.mobility,
      })),
    );
    return { exam, summary };
  }

  listPerioExams(patientId: string) {
    return this.prisma.forCurrentTenant((tx) =>
      tx.perioExam.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' }, include: { teeth: true } }),
    );
  }

  // ---- Tooth-level plan -> billing ---------------------------------------

  createPlanItem(dto: CreateToothPlanItemDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();
    if (dto.toothFdi && !isValidTooth(dto.toothFdi)) {
      throw new BadRequestException(`"${dto.toothFdi}" is not a valid FDI tooth`);
    }
    if (dto.conditionOnComplete && !isValidCondition(dto.conditionOnComplete)) {
      throw new BadRequestException(`Unknown tooth condition "${dto.conditionOnComplete}"`);
    }
    return this.prisma.forTenant(tenantId, async (tx) => {
      await ensurePatient(tx, dto.patientId);
      return tx.toothPlanItem.create({
        data: {
          tenantId,
          patientId: dto.patientId,
          encounterId: dto.encounterId ?? null,
          catalogCode: dto.catalogCode,
          name: dto.name,
          toothFdi: dto.toothFdi ?? null,
          surfaces: (dto.surfaces ?? undefined) as Prisma.InputJsonValue | undefined,
          pricePkr: dto.pricePkr,
          conditionOnComplete: dto.conditionOnComplete ?? null,
          createdById: userId ?? null,
        },
      });
    });
  }

  listPlanItems(patientId: string) {
    return this.prisma.forCurrentTenant((tx) =>
      tx.toothPlanItem.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  /**
   * Complete a tooth-plan item: mark COMPLETED, write the resulting ToothRecord
   * condition, and emit a billing line (append to an invoice or raise a new one).
   */
  async completePlanItem(id: string, dto: CompleteToothPlanItemDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();

    // Load + guard + mark completed + write ToothRecord (one tx).
    const item = await this.prisma.forTenant(tenantId, async (tx) => {
      const found = await tx.toothPlanItem.findUnique({ where: { id } });
      if (!found) throw new NotFoundException(`Tooth-plan item ${id} not found`);
      if (found.status === DentalPlanStatus.COMPLETED) {
        throw new BadRequestException('Plan item is already completed');
      }
      if (found.status === DentalPlanStatus.CANCELLED) {
        throw new BadRequestException('Cannot complete a cancelled plan item');
      }
      // Write the completion condition onto the odontogram, if applicable.
      if (found.toothFdi && found.conditionOnComplete) {
        await tx.toothRecord.upsert({
          where: {
            tenantId_patientId_toothFdi: { tenantId, patientId: found.patientId, toothFdi: found.toothFdi },
          },
          update: {
            condition: found.conditionOnComplete,
            surfaces: (found.surfaces ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            recordedById: userId ?? null,
          },
          create: {
            tenantId,
            patientId: found.patientId,
            toothFdi: found.toothFdi,
            condition: found.conditionOnComplete,
            surfaces: (found.surfaces ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            recordedById: userId ?? null,
          },
        });
      }
      return found;
    });

    // Emit the billing line (own transaction: invoice locking / numbering).
    const description = billingDescription(item.name, item.toothFdi, item.surfaces);
    const lineInput = { code: item.catalogCode, name: description, unitPricePkr: item.pricePkr, quantity: 1 };
    let invoiceId: string;
    let invoiceLineItemId: string;
    if (dto.invoiceId) {
      const res = await this.billing.appendLine(dto.invoiceId, lineInput);
      invoiceId = dto.invoiceId;
      invoiceLineItemId = res.line.id;
    } else {
      const invoice = (await this.billing.createInvoice({ patientId: item.patientId, items: [lineInput] })) as {
        id: string;
        lines: { id: string }[];
      };
      invoiceId = invoice.id;
      invoiceLineItemId = invoice.lines[0]?.id ?? '';
    }

    // Record completion metadata on the plan item.
    const updated = await this.prisma.forTenant(tenantId, (tx) =>
      tx.toothPlanItem.update({
        where: { id },
        data: {
          status: DentalPlanStatus.COMPLETED,
          completedAt: new Date(),
          completedEncounterId: dto.encounterId ?? item.encounterId,
          invoiceLineItemId: invoiceLineItemId || null,
        },
      }),
    );
    return { planItem: updated, invoiceId, invoiceLineItemId, billedPkr: item.pricePkr };
  }

  // ---- Orthodontics -------------------------------------------------------

  createOrthoCase(dto: CreateOrthoCaseDto) {
    const tenantId = getTenantId();
    return this.prisma.forTenant(tenantId, async (tx) => {
      await ensurePatient(tx, dto.patientId);
      return tx.orthoCase.create({
        data: {
          tenantId,
          patientId: dto.patientId,
          appliance: dto.appliance,
          angleClass: dto.angleClass ?? null,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          plannedMonths: dto.plannedMonths ?? null,
          applianceMap: dto.applianceMap as Prisma.InputJsonValue,
          photoTimelineTag: dto.photoTimelineTag ?? null,
          status: dto.startDate ? 'ACTIVE' : 'PLANNED',
        },
      });
    });
  }

  async addOrthoEvent(caseId: string, dto: AddOrthoEventDto) {
    const tenantId = getTenantId();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const orthoCase = await tx.orthoCase.findUnique({ where: { id: caseId } });
      if (!orthoCase) throw new NotFoundException(`Ortho case ${caseId} not found`);
      const event = await tx.orthoEvent.create({
        data: {
          tenantId,
          orthoCaseId: caseId,
          encounterId: dto.encounterId ?? null,
          eventType: dto.eventType,
          wireUpper: dto.wireUpper ?? null,
          wireLower: dto.wireLower ?? null,
          elastics: dto.elastics ?? null,
          note: dto.note ?? null,
          occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        },
      });
      // DEBOND transitions the case to retention.
      if (dto.eventType === 'DEBOND') {
        await tx.orthoCase.update({ where: { id: caseId }, data: { status: 'RETENTION', debondDate: event.occurredAt } });
      }
      return event;
    });
  }

  getOrthoCase(id: string) {
    return this.prisma.forCurrentTenant(async (tx) => {
      const orthoCase = await tx.orthoCase.findUnique({
        where: { id },
        include: { events: { orderBy: { occurredAt: 'asc' } } },
      });
      if (!orthoCase) throw new NotFoundException(`Ortho case ${id} not found`);
      return orthoCase;
    });
  }

  listOrthoCases(patientId: string) {
    return this.prisma.forCurrentTenant((tx) =>
      tx.orthoCase.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' }, include: { events: true } }),
    );
  }
}

/** "Composite filling — 36 (MO)" style line description. */
function billingDescription(name: string, toothFdi: string | null, surfaces: Prisma.JsonValue): string {
  let s = name;
  if (toothFdi) s += ` — ${toothFdi}`;
  if (Array.isArray(surfaces) && surfaces.length) s += ` (${surfaces.join('')})`;
  return s;
}

async function ensurePatient(tx: Prisma.TransactionClient, patientId: string): Promise<void> {
  const patient = await tx.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
}
