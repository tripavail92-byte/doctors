import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';
import { EPI_SCHEDULE } from './epi-schedule';
import { computeSchedule, scheduleSummary } from './schedule.engine';
import { RecordImmunizationDto } from './dto/record-immunization.dto';
import {
  DiscardBatchDto,
  MarkReportedDto,
  ReceiveBatchDto,
  ReportAefiDto,
  UpdateVvmDto,
} from './dto/cold-chain.dto';
import { batchUsability, expiredOrDamaged, pickBatch } from './cold-chain.engine';
import { classifyAefi, SeriousCriterion, SERIOUS_CRITERIA } from './aefi.engine';

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
    return { schedule: EPI_SCHEDULE, seriousCriteria: SERIOUS_CRITERIA };
  }

  // -------------------------------------------------------------------------
  // Cold chain
  // -------------------------------------------------------------------------

  receiveBatch(dto: ReceiveBatchDto) {
    const { tenantId } = getTenant();
    const expiry = new Date(dto.expiry);
    if (expiry.getTime() <= Date.now()) {
      throw new BadRequestException(
        `Lot ${dto.lotNumber} expired on ${dto.expiry.slice(0, 10)} — do not receive it into stock.`,
      );
    }
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.vaccineBatch.upsert({
        where: {
          tenantId_vaccineCode_lotNumber: {
            tenantId: tenantId!,
            vaccineCode: dto.vaccineCode,
            lotNumber: dto.lotNumber,
          },
        },
        update: {
          expiry,
          vvmStage: dto.vvmStage ?? 'STAGE_1',
          storageLocation: dto.storageLocation ?? null,
        },
        create: {
          tenantId: tenantId!,
          vaccineCode: dto.vaccineCode,
          lotNumber: dto.lotNumber,
          manufacturer: dto.manufacturer ?? null,
          expiry,
          vvmStage: dto.vvmStage ?? 'STAGE_1',
          dosesReceived: dto.dosesReceived,
          dosesRemaining: dto.dosesReceived,
          storageLocation: dto.storageLocation ?? null,
        },
      }),
    );
  }

  async listBatches(vaccineCode?: string) {
    const rows = await this.prisma.forCurrentTenant((tx) =>
      tx.vaccineBatch.findMany({
        where: vaccineCode ? { vaccineCode } : {},
        orderBy: [{ vaccineCode: 'asc' }, { expiry: 'asc' }],
      }),
    );
    const now = new Date();
    return rows.map((b) => ({ ...b, usability: batchUsability(b, now) }));
  }

  /** What to pull from the fridge now, and why — the discard worklist. */
  async coldChainAlerts() {
    const rows = await this.prisma.forCurrentTenant((tx) =>
      tx.vaccineBatch.findMany({ where: { discardedAt: null } }),
    );
    return { pull: expiredOrDamaged(rows, new Date()) };
  }

  /**
   * Update a vial's VVM stage.
   *
   * One-way: the VVM square darkens with cumulative heat and never lightens, so
   * a "correction" back down the scale is either a misread now or a misread
   * before — and if it is wrong in the unsafe direction, a discard-grade vial
   * goes back into an arm. Refuse it and make someone look at the vial.
   */
  async updateVvm(id: string, dto: UpdateVvmDto) {
    const order = ['STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4'];
    return this.prisma.forCurrentTenant(async (tx) => {
      const batch = await tx.vaccineBatch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundException(`Batch ${id} not found`);
      if (order.indexOf(dto.vvmStage) < order.indexOf(batch.vvmStage)) {
        throw new BadRequestException(
          `Lot ${batch.lotNumber} is recorded at ${batch.vvmStage}; a VVM cannot go back to ` +
            `${dto.vvmStage}. The square darkens irreversibly — re-read the vial, and if the ` +
            `earlier reading was wrong, discard it and record why.`,
        );
      }
      const discard = dto.vvmStage === 'STAGE_3' || dto.vvmStage === 'STAGE_4';
      return tx.vaccineBatch.update({
        where: { id },
        data: {
          vvmStage: dto.vvmStage,
          // A vial at stage 3/4 is waste by definition — discard it here rather
          // than leave it in stock waiting for someone to notice.
          ...(discard
            ? {
                discardedAt: new Date(),
                discardReason: `VVM ${dto.vvmStage}${dto.note ? ` — ${dto.note}` : ''}`,
              }
            : {}),
        },
      });
    });
  }

  discardBatch(id: string, dto: DiscardBatchDto) {
    return this.prisma.forCurrentTenant(async (tx) => {
      const batch = await tx.vaccineBatch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundException(`Batch ${id} not found`);
      return tx.vaccineBatch.update({
        where: { id },
        data: { discardedAt: new Date(), discardReason: dto.reason },
      });
    });
  }

  // -------------------------------------------------------------------------
  // AEFI
  // -------------------------------------------------------------------------

  async reportAefi(dto: ReportAefiDto) {
    const { tenantId, userId } = getTenant();
    const classification = classifyAefi({
      symptoms: dto.symptoms,
      criteriaMet: dto.criteriaMet as SeriousCriterion[] | undefined,
      outcome: dto.outcome,
      statedSeverity: dto.severity,
    });
    return this.prisma.forTenant(tenantId, async (tx) => {
      await ensurePatient(tx, dto.patientId);
      const aefi = await tx.aefi.create({
        data: {
          tenantId: tenantId!,
          patientId: dto.patientId,
          immunizationId: dto.immunizationId ?? null,
          batchId: dto.batchId ?? null,
          onsetAt: new Date(dto.onsetAt),
          symptoms: dto.symptoms,
          // The engine's severity, not the client's — it may raise what the
          // clinician typed but never lower it.
          severity: classification.severity,
          outcome: dto.outcome ?? 'UNKNOWN',
          narrative: dto.narrative ?? null,
          reportedById: userId ?? null,
        },
      });
      return { aefi, classification };
    });
  }

  listAefi(patientId?: string) {
    return this.prisma.forCurrentTenant((tx) =>
      tx.aefi.findMany({
        where: patientId ? { patientId } : {},
        orderBy: { onsetAt: 'desc' },
      }),
    );
  }

  /**
   * AEFI grouped by lot — the whole reason batchId is recorded.
   *
   * An individual event is usually noise. A cluster on one lot is a signal, and
   * it is only visible if someone counts.
   */
  async aefiByBatch() {
    const rows = await this.prisma.forCurrentTenant((tx) =>
      tx.aefi.findMany({ where: { batchId: { not: null } } }),
    );
    if (!rows.length) return [];
    const batches = await this.prisma.forCurrentTenant((tx) =>
      tx.vaccineBatch.findMany({
        where: { id: { in: rows.map((r) => r.batchId as string) } },
      }),
    );
    const byId = new Map(batches.map((b) => [b.id, b]));
    const groups = new Map<
      string,
      { lotNumber: string; vaccineCode: string; total: number; serious: number }
    >();
    for (const r of rows) {
      const b = byId.get(r.batchId as string);
      if (!b) continue;
      const g = groups.get(b.id) ?? {
        lotNumber: b.lotNumber,
        vaccineCode: b.vaccineCode,
        total: 0,
        serious: 0,
      };
      g.total++;
      if (r.severity === 'SERIOUS') g.serious++;
      groups.set(b.id, g);
    }
    return Array.from(groups.entries())
      .map(([batchId, g]) => ({ batchId, ...g }))
      .sort((a, b) => b.serious - a.serious || b.total - a.total);
  }

  markAefiReported(id: string, dto: MarkReportedDto) {
    return this.prisma.forCurrentTenant(async (tx) => {
      const aefi = await tx.aefi.findUnique({ where: { id } });
      if (!aefi) throw new NotFoundException(`AEFI ${id} not found`);
      return tx.aefi.update({
        where: { id },
        data: {
          reportedToAuthorityAt: dto.reportedAt ? new Date(dto.reportedAt) : new Date(),
        },
      });
    });
  }

  /**
   * Record an administered dose, consuming a real vial.
   *
   * The dose is tied to a physical batch, and the batch is checked before it is
   * decremented: expired or VVM stage 3/4 is refused. Recording a dose from a
   * dead vial is the worst outcome this module can produce — the child is
   * immunised on paper and susceptible in fact, and nobody finds out until an
   * outbreak. So the check is here, at administration, not on a report someone
   * reads later.
   *
   * If no batch is nominated the vial is picked by cold-chain priority (VVM
   * stage 2 first, then earliest expiry — see pickBatch, which is deliberately
   * NOT the pharmacy's plain FEFO).
   */
  record(dto: RecordImmunizationDto) {
    const { tenantId, userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      await ensurePatient(tx, dto.patientId);
      const givenAt = dto.givenAt ? new Date(dto.givenAt) : new Date();

      // Serialise per vaccine: read-then-decrement across concurrent jabs would
      // otherwise oversell a vial. Same idiom the pharmacy uses for stock.
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`,
        `vaccine:${tenantId}:${dto.vaccineCode}`,
      );

      // Discarded lots are fetched too, deliberately.
      //
      // Filtering them out at the query made a nurse holding a heat-damaged
      // vial see "no such lot in stock" — which reads as a typo and invites
      // them to try a different lot number. The truth is "this vial is dead and
      // so may its neighbours be": the reason has to name the VVM, because it
      // implicates the fridge and the rest of the shipment, not just this vial.
      const stock = await tx.vaccineBatch.findMany({ where: { vaccineCode: dto.vaccineCode } });

      let batch = null as (typeof stock)[number] | null;
      if (dto.lotNumber) {
        batch = stock.find((b) => b.lotNumber === dto.lotNumber) ?? null;
        if (!batch) {
          throw new NotFoundException(
            `No ${dto.vaccineCode} lot "${dto.lotNumber}" in stock.`,
          );
        }
        const verdict = batchUsability(batch, givenAt);
        if (!verdict.usable) {
          throw new BadRequestException(`${verdict.reason} Do not administer this dose.`);
        }
      } else if (stock.some((b) => !b.discardedAt)) {
        batch = pickBatch(stock, givenAt);
        if (!batch) {
          throw new BadRequestException(
            `No usable ${dto.vaccineCode} stock: every lot is expired, VVM-discarded or empty.`,
          );
        }
      }
      // batch may still be null: a clinic that has not loaded its fridge into
      // the system yet can still record history. Once stock exists, it is used.

      if (batch) {
        await tx.vaccineBatch.update({
          where: { id: batch.id },
          data: { dosesRemaining: { decrement: 1 } },
        });
      }

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
          lotNumber: batch?.lotNumber ?? dto.lotNumber ?? null,
          batchId: batch?.id ?? null,
          site: dto.site ?? null,
          givenById: userId ?? null,
        },
        create: {
          tenantId: tenantId!,
          patientId: dto.patientId,
          vaccineCode: dto.vaccineCode,
          dose: dto.dose,
          givenAt,
          lotNumber: batch?.lotNumber ?? dto.lotNumber ?? null,
          batchId: batch?.id ?? null,
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
