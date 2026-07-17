import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant, getTenantId } from '../common/tenant/tenant-context';
import { computeDose, DoseResult } from './dose-engine';
import { Concentration, Drug } from './drug-catalog';
import { DoseRuleView, defaultConcentration, ruleToView } from './dose-rule.mapper';
import { buildSig } from './prescription.sig';
import { DoseDto } from './dto/dose.dto';
import { CommitDoseDto } from './dto/commit-dose.dto';

/**
 * Weight-based dosing service. Pairs the pure dose engine with the drug catalog
 * and the Observation substrate (latest recorded weight). Computation is
 * server-authoritative; a committed calculation is persisted to the medico-
 * legal DoseCalculationLog.
 */
@Injectable()
export class DosingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The tenant's active dose rules.
   *
   * Read from the DB, not the TS catalog: a clinic must be able to correct a
   * regimen or add a local formulary entry without a code deploy. The pure
   * engine still consumes the same `Drug` shape (see dose-rule.mapper).
   */
  async rules(drugKey?: string): Promise<DoseRuleView[]> {
    const rows = await this.prisma.forCurrentTenant((tx) =>
      tx.doseRule.findMany({
        where: { active: true, ...(drugKey ? { drugKey } : {}) },
        orderBy: { displayName: 'asc' },
      }),
    );
    if (drugKey && rows.length === 0) {
      throw new BadRequestException(`Unknown drug "${drugKey}"`);
    }
    return rows.map(ruleToView);
  }

  /** Load one active rule, or fail loudly. Replaces the old getDrug() lookup. */
  private async loadRule(drugKey: string): Promise<DoseRuleView> {
    const row = await this.prisma.forCurrentTenant((tx) =>
      tx.doseRule.findFirst({ where: { drugKey, active: true } }),
    );
    if (!row) throw new BadRequestException(`Unknown drug "${drugKey}"`);
    return ruleToView(row);
  }

  // Compute from an explicit request (drug key or raw mg/kg/day).
  async calculate(dto: DoseDto): Promise<DoseResult & { drug?: string; form?: string }> {
    if (dto.drug) {
      const drug = await this.loadRule(dto.drug);
      return this.forDrug(drug, dto.weightKg, {
        ageMonths: dto.ageMonths,
        concentrationMgPerMl: dto.concentrationMgPerMl ?? defaultConcentration(drug)?.mgPerMl,
      });
    }
    if (dto.mgPerKgPerDay == null || dto.dosesPerDay == null) {
      throw new BadRequestException(
        'Provide a "drug" key, or both "mgPerKgPerDay" and "dosesPerDay".',
      );
    }
    return computeDose({
      weightKg: dto.weightKg,
      mgPerKgPerDay: dto.mgPerKgPerDay,
      dosesPerDay: dto.dosesPerDay,
      maxSingleMg: dto.maxSingleMg,
      maxDailyMg: dto.maxDailyMg,
      ageMonths: dto.ageMonths,
      concentrationMgPerMl: dto.concentrationMgPerMl,
    });
  }

  private forDrug(
    drug: Drug,
    weightKg: number,
    opts?: { ageMonths?: number; concentrationMgPerMl?: number },
  ) {
    const result = computeDose({
      weightKg,
      mgPerKgPerDay: drug.mgPerKgPerDay,
      dosesPerDay: drug.dosesPerDay,
      maxSingleMg: drug.maxSingleMg,
      maxDailyMg: drug.maxDailyMg,
      ageMonths: opts?.ageMonths,
      minAgeMonths: drug.minAgeMonths,
      maxWeightKgForRule: drug.maxWeightKgForRule,
      concentrationMgPerMl: opts?.concentrationMgPerMl,
      roundingStepMl: drug.roundingStepMl,
      cautions: drug.cautions,
    });
    return { drug: drug.name, form: drug.form, highRisk: drug.highRisk ?? false, ...result };
  }

  // Compute a dose using the patient's most recent recorded weight.
  async forPatient(patientId: string, drugKey: string) {
    const drug = await this.loadRule(drugKey);
    const { tenantId } = getTenant();
    const latest = await this.prisma.forTenant(tenantId, (tx) =>
      tx.observation.findFirst({
        where: { patientId, metric: 'weight_kg' },
        orderBy: { recordedAt: 'desc' },
      }),
    );
    if (!latest) {
      throw new NotFoundException('No weight_kg observation recorded for this patient');
    }
    return {
      patientId,
      weightSource: { value: latest.value, recordedAt: latest.recordedAt },
      ...this.forDrug(drug, latest.value, {
        concentrationMgPerMl: defaultConcentration(drug)?.mgPerMl,
      }),
    };
  }

  /**
   * Commit a confirmed dose to the medico-legal log. Recomputes server-side;
   * refuses to commit a blocked (invalid) dose. Never auto-commits — this is
   * called only after explicit clinician confirmation.
   */
  async commit(dto: CommitDoseDto) {
    const drug = await this.loadRule(dto.drug);
    const { userId } = getTenant();
    const tenantId = getTenantId();

    const concentration =
      dto.concentrationMgPerMl != null
        ? { label: `${dto.concentrationMgPerMl} mg/mL`, mgPerMl: dto.concentrationMgPerMl }
        : defaultConcentration(drug);

    const result = this.forDrug(drug, dto.weightKg, {
      ageMonths: dto.ageMonths,
      concentrationMgPerMl: concentration?.mgPerMl,
    });
    if (result.blocked) {
      throw new BadRequestException(`Cannot commit — ${result.blockReason}`);
    }

    return this.prisma.forTenant(tenantId, async (tx) => {
      const patient = await tx.patient.findUnique({ where: { id: dto.patientId } });
      if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found`);
      const log = await tx.doseCalculationLog.create({
        data: {
          tenantId,
          patientId: dto.patientId,
          encounterId: dto.encounterId ?? null,
          drugKey: drug.key,
          weightKg: dto.weightKg,
          ageMonths: dto.ageMonths ?? null,
          computedMgPerDose: result.perDoseMg,
          computedMgPerDay: result.perDayMg,
          cappedByMax: result.cappedSingle || result.cappedDaily,
          chosenConcentration: (concentration ?? undefined) as Prisma.InputJsonValue | undefined,
          volumeMl: result.volumePerDoseMl,
          clinicianId: userId ?? null,
        },
      });
      // The order itself, in the SAME transaction as the medico-legal log:
      // a prescription without its calculation, or a calculation that claims to
      // have produced an order that does not exist, are both worse than neither.
      const rx = await tx.prescription.create({
        data: {
          tenantId: tenantId!,
          patientId: dto.patientId,
          encounterId: dto.encounterId ?? null,
          drugKey: drug.key,
          // Snapshot, not a join: DoseRule is tenant-editable now, and a record
          // that silently changes when the rule is corrected is not a record.
          displayName: drug.name,
          route: 'oral',
          mgPerDose: result.perDoseMg,
          dosesPerDay: result.dosesPerDay,
          mgPerDay: result.perDayMg,
          volumePerDoseMl: result.volumePerDoseMl,
          concentrationLabel: concentration?.label ?? null,
          instructions: buildSig(drug, result, concentration),
          doseCalculationLogId: log.id,
          prescribedById: userId ?? null,
        },
      });
      // Return the UPDATED log, not the pre-update object: the row in the DB
      // carries the backlink, and a response that says medicationRequestId is
      // null while the database says otherwise is a lie the caller will cache.
      const linkedLog = await tx.doseCalculationLog.update({
        where: { id: log.id },
        data: { medicationRequestId: rx.id },
      });

      return { log: linkedLog, prescription: rx, result };
    });
  }

  listPrescriptions(patientId: string) {
    return this.prisma.forCurrentTenant((tx) =>
      tx.prescription.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } }),
    );
  }
}

