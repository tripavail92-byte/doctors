import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PregnancyStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant, getTenantId } from '../common/tenant/tenant-context';
import {
  addDays,
  eddFromLmp,
  eddFromUsg,
  gestationalAge,
  redatingDecision,
} from './engines/edd.engine';
import { estimateFetalWeight } from './engines/efw.engine';
import { computeAncAlerts, hasSevereAlert } from './engines/anc-alerts.engine';
import { suggestContactNumber } from './engines/anc-schedule';
import {
  labourProgressAlerts,
  partogramEntryAlerts,
} from './engines/partogram-alerts.engine';
import { computeTdSchedule } from './engines/td-schedule';
import {
  computeAutoRiskFlags,
  validateObstetricHistory,
} from './engines/booking';
import { StartEpisodeDto } from './dto/start-episode.dto';
import { AddAncVisitDto } from './dto/add-anc-visit.dto';
import { AddUltrasoundDto } from './dto/add-ultrasound.dto';
import { RedateDto } from './dto/redate.dto';
import { CloseEpisodeDto } from './dto/close-episode.dto';
import { UpsertGynaeProfileDto } from './dto/upsert-gynae-profile.dto';
import { StartPartogramDto } from './dto/start-partogram.dto';
import { AddPartogramEntryDto, ClosePartogramDto } from './dto/add-partogram-entry.dto';

const TD_VACCINE_CODE = 'TD';
const MAX_LMP_AGE_DAYS = 44 * 7; // 308 days — past this, dating is implausible

/** Terminal statuses that end a pregnancy without a live birth ⇒ unenrol journeys. */
const LOSS_STATUSES: PregnancyStatus[] = [
  PregnancyStatus.MISCARRIED,
  PregnancyStatus.TERMINATED,
  PregnancyStatus.ECTOPIC,
  PregnancyStatus.TRANSFERRED_OUT,
  PregnancyStatus.LOST_TO_FOLLOWUP,
];

@Injectable()
export class ObstetricsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Episode lifecycle --------------------------------------------------

  async startEpisode(dto: StartEpisodeDto) {
    const tenantId = getTenantId();
    const historyError = validateObstetricHistory(dto);
    if (historyError) throw new BadRequestException(historyError);

    const now = new Date();
    const lmp = dto.lmp ? new Date(dto.lmp) : null;
    if (lmp) {
      if (lmp.getTime() > now.getTime()) throw new BadRequestException('LMP cannot be in the future');
      if (now.getTime() - lmp.getTime() > MAX_LMP_AGE_DAYS * 86_400_000) {
        throw new BadRequestException('LMP is more than 44 weeks ago — check dates, consider USG dating');
      }
    }

    const eddByLmp = lmp ? eddFromLmp(lmp) : null;
    const eddByUsg = dto.eddByUsg ? new Date(dto.eddByUsg) : null;
    // Choose the working EDD method: explicit > USG-if-provided > LMP-if-present.
    const eddMethod = dto.eddMethod ?? (eddByUsg ? 'USG' : lmp ? 'LMP' : 'CLINICAL');
    const eddFinal = eddMethod === 'USG' ? eddByUsg : eddMethod === 'LMP' ? eddByLmp : null;

    return this.prisma.forTenant(tenantId, async (tx) => {
      const patient = await tx.patient.findUnique({ where: { id: dto.patientId } });
      if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found`);
      const g = (patient.gender ?? '').trim().toLowerCase();
      if (g === 'male' || g === 'm') {
        throw new BadRequestException('Pregnancy episodes can only be created for female patients');
      }

      // One ACTIVE episode per patient.
      const active = await tx.pregnancyEpisode.count({
        where: { patientId: dto.patientId, status: PregnancyStatus.ACTIVE },
      });
      if (active > 0) {
        throw new ConflictException('Patient already has an active pregnancy episode — close it first');
      }

      const autoFlags = computeAutoRiskFlags({
        dob: patient.dob ?? null,
        bookingDate: now,
        gravida: dto.gravida,
        para: dto.para,
        abortus: dto.abortus,
        rhFactor: dto.rhFactor ?? null,
        prevCsCount: dto.prevCsCount ?? null,
        fetusCount: dto.fetusCount ?? null,
      });
      const riskFlags = [...new Set([...(dto.riskFlags ?? []), ...autoFlags])];

      const episode = await tx.pregnancyEpisode.create({
        data: {
          tenantId,
          patientId: dto.patientId,
          lmp,
          lmpReliable: dto.lmpReliable ?? false,
          eddByLmp,
          eddByUsg,
          eddFinal,
          eddMethod,
          gravida: dto.gravida,
          para: dto.para,
          abortus: dto.abortus,
          livingChildren: dto.livingChildren ?? 0,
          bloodGroup: dto.bloodGroup ?? null,
          rhFactor: dto.rhFactor ?? null,
          heightCm: dto.heightCm ?? null,
          prePregnancyWeightKg: dto.prePregnancyWeightKg ?? null,
          prevCsCount: dto.prevCsCount ?? 0,
          riskFlags,
          riskNotes: dto.riskNotes ?? null,
          fetusCount: dto.fetusCount ?? 1,
          treatmentPlanId: dto.treatmentPlanId ?? null,
        },
      });
      return this.decorate(episode);
    });
  }

  listEpisodes(patientId: string) {
    return this.prisma.forCurrentTenant(async (tx) => {
      const episodes = await tx.pregnancyEpisode.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
      });
      return episodes.map((e) => this.decorate(e));
    });
  }

  async getEpisode(id: string) {
    return this.prisma.forCurrentTenant(async (tx) => {
      const episode = await tx.pregnancyEpisode.findUnique({
        where: { id },
        include: {
          ancVisits: { orderBy: { visitDate: 'asc' } },
          ultrasounds: { orderBy: { scanDate: 'asc' } },
          partograms: { orderBy: { startedAt: 'desc' } },
        },
      });
      if (!episode) throw new NotFoundException(`Pregnancy episode ${id} not found`);
      const patient = await tx.patient.findUnique({ where: { id: episode.patientId } });
      const tdDoses = await tx.immunization.findMany({
        where: { patientId: episode.patientId, vaccineCode: TD_VACCINE_CODE },
      });
      const tdSchedule = computeTdSchedule(
        tdDoses.map((d) => ({ dose: parseInt(d.dose, 10), date: d.givenAt })),
        new Date(),
      );
      return { ...this.decorate(episode), tdSchedule, patient };
    });
  }

  // ---- ANC visits ---------------------------------------------------------

  async addAncVisit(episodeId: string, dto: AddAncVisitDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const episode = await requireActiveEpisode(tx, episodeId);
      const visitDate = dto.visitDate ? new Date(dto.visitDate) : new Date();

      // GA derives from the working EDD (never recomputed later).
      let gaWeeks: number | null = null;
      let gaDays: number | null = null;
      if (episode.eddFinal) {
        const ga = gestationalAge(episode.eddFinal, visitDate);
        gaWeeks = ga.weeks;
        gaDays = ga.days;
      }
      const contactNumber =
        dto.contactNumber ?? (gaWeeks != null ? suggestContactNumber(gaWeeks) : null);

      const alertFlags = computeAncAlerts({
        gaWeeks,
        bpSystolic: dto.bpSystolic ?? null,
        bpDiastolic: dto.bpDiastolic ?? null,
        hbGdl: dto.hbGdl ?? null,
        fhrBpm: dto.fhrBpm ?? null,
        presentation: dto.presentation ?? null,
        fundalHeightCm: dto.fundalHeightCm ?? null,
        urineAlbumin: dto.urineAlbumin ?? null,
      });

      // Optional Td dose ⇒ record an Immunization + link it.
      let ttImmunizationId: string | null = null;
      if (dto.tdDoseNumber != null) {
        const imm = await tx.immunization.upsert({
          where: {
            tenantId_patientId_vaccineCode_dose: {
              tenantId,
              patientId: episode.patientId,
              vaccineCode: TD_VACCINE_CODE,
              dose: String(dto.tdDoseNumber),
            },
          },
          update: { givenAt: visitDate, lotNumber: dto.tdLotNumber ?? null, givenById: userId ?? null },
          create: {
            tenantId,
            patientId: episode.patientId,
            vaccineCode: TD_VACCINE_CODE,
            dose: String(dto.tdDoseNumber),
            givenAt: visitDate,
            lotNumber: dto.tdLotNumber ?? null,
            givenById: userId ?? null,
          },
        });
        ttImmunizationId = imm.id;
      }

      const visit = await tx.ancVisit.create({
        data: {
          tenantId,
          pregnancyEpisodeId: episodeId,
          visitDate,
          contactNumber,
          gaWeeks,
          gaDays,
          weightKg: dto.weightKg ?? null,
          bpSystolic: dto.bpSystolic ?? null,
          bpDiastolic: dto.bpDiastolic ?? null,
          fundalHeightCm: dto.fundalHeightCm ?? null,
          fhrBpm: dto.fhrBpm ?? null,
          fhrMethod: dto.fhrMethod ?? null,
          presentation: dto.presentation ?? null,
          engagementFifths: dto.engagementFifths ?? null,
          urineAlbumin: dto.urineAlbumin ?? null,
          urineSugar: dto.urineSugar ?? null,
          hbGdl: dto.hbGdl ?? null,
          oedema: dto.oedema ?? null,
          fetalMovements: dto.fetalMovements ?? null,
          dangerSigns: dto.dangerSigns ?? [],
          ironFolateGiven: dto.ironFolateGiven ?? false,
          calciumGiven: dto.calciumGiven ?? false,
          ttImmunizationId,
          planNotes: dto.planNotes ?? null,
          nextVisitDate: dto.nextVisitDate ? new Date(dto.nextVisitDate) : null,
          alertFlags,
          createdById: userId ?? null,
        },
      });
      return { visit, alertFlags, severe: hasSevereAlert(alertFlags) };
    });
  }

  // ---- Ultrasound ---------------------------------------------------------

  async addUltrasound(episodeId: string, dto: AddUltrasoundDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const episode = await requireActiveEpisode(tx, episodeId);
      const scanDate = dto.scanDate ? new Date(dto.scanDate) : new Date();

      const efw = estimateFetalWeight({
        hcMm: dto.hcMm ?? null,
        acMm: dto.acMm ?? null,
        flMm: dto.flMm ?? null,
        bpdMm: dto.bpdMm ?? null,
      });

      // Re-dating advisory: dating scan GA vs LMP-EDD (does NOT auto-apply).
      let redating: ReturnType<typeof redatingDecision> | null = null;
      if (episode.eddByLmp && dto.gaByUsgWeeks != null) {
        const eddByUsg = eddFromUsg(scanDate, dto.gaByUsgWeeks, dto.gaByUsgDays ?? 0);
        redating = redatingDecision(episode.eddByLmp, eddByUsg, dto.gaByUsgWeeks);
      }

      // Findings that add a risk flag to the episode.
      const newRiskFlags = new Set(episode.riskFlags);
      if (dto.placentaSite === 'PREVIA_MARGINAL' || dto.placentaSite === 'PREVIA_COMPLETE') {
        newRiskFlags.add('PLACENTA_PREVIA');
      }
      if (dto.liquorAssessment && dto.liquorAssessment !== 'NORMAL') {
        newRiskFlags.add(dto.liquorAssessment);
      }
      if (newRiskFlags.size !== episode.riskFlags.length) {
        await tx.pregnancyEpisode.update({
          where: { id: episodeId },
          data: { riskFlags: [...newRiskFlags] },
        });
      }

      // Fetal demise pathway: no heart activity at/after 12 wk ⇒ pause journeys,
      // do NOT auto-close (clinician confirms).
      const gaAtScan = dto.gaByUsgWeeks ?? (episode.eddFinal ? gestationalAge(episode.eddFinal, scanDate).weeks : null);
      const fetalDemiseSuspected =
        dto.fetalHeartActivity === false && gaAtScan != null && gaAtScan >= 12;

      const scan = await tx.obstetricUltrasound.create({
        data: {
          tenantId,
          pregnancyEpisodeId: episodeId,
          scanDate,
          scanType: dto.scanType,
          fetusNumber: dto.fetusNumber ?? 1,
          studyId: dto.studyId ?? `STUDY-${scanDate.getTime()}`,
          crlMm: dto.crlMm ?? null,
          gsMm: dto.gsMm ?? null,
          bpdMm: dto.bpdMm ?? null,
          hcMm: dto.hcMm ?? null,
          acMm: dto.acMm ?? null,
          flMm: dto.flMm ?? null,
          efwGrams: efw?.efwGrams ?? null,
          efwFormula: efw?.formula ?? null,
          gaByUsgWeeks: dto.gaByUsgWeeks ?? null,
          gaByUsgDays: dto.gaByUsgDays ?? null,
          fetalHeartActivity: dto.fetalHeartActivity ?? null,
          fhrBpm: dto.fhrBpm ?? null,
          presentation: dto.presentation ?? null,
          placentaSite: dto.placentaSite ?? null,
          liquorAfiCm: dto.liquorAfiCm ?? null,
          liquorDvpCm: dto.liquorDvpCm ?? null,
          liquorAssessment: dto.liquorAssessment ?? null,
          cervicalLengthMm: dto.cervicalLengthMm ?? null,
          impression: dto.impression,
          performedById: userId ?? null,
        },
      });
      return { scan, efw, redating, fetalDemiseSuspected };
    });
  }

  async redate(episodeId: string, dto: RedateDto) {
    return this.prisma.forCurrentTenant(async (tx) => {
      const episode = await tx.pregnancyEpisode.findUnique({ where: { id: episodeId } });
      if (!episode) throw new NotFoundException(`Pregnancy episode ${episodeId} not found`);
      const eddByUsg = new Date(dto.eddByUsg);
      const updated = await tx.pregnancyEpisode.update({
        where: { id: episodeId },
        data: {
          eddByUsg,
          eddFinal: eddByUsg,
          eddMethod: 'USG',
          eddLockedAt: new Date(),
          riskNotes: appendNote(episode.riskNotes, `EDD re-dated to USG: ${dto.reason}`),
        },
      });
      return this.decorate(updated);
    });
  }

  async closeEpisode(episodeId: string, dto: CloseEpisodeDto) {
    if (dto.status === PregnancyStatus.ACTIVE) {
      throw new BadRequestException('Closing requires a terminal status, not ACTIVE');
    }
    return this.prisma.forCurrentTenant(async (tx) => {
      const episode = await tx.pregnancyEpisode.findUnique({ where: { id: episodeId } });
      if (!episode) throw new NotFoundException(`Pregnancy episode ${episodeId} not found`);
      if (episode.status !== PregnancyStatus.ACTIVE) {
        throw new BadRequestException(`Episode is already ${episode.status.toLowerCase()}`);
      }
      const updated = await tx.pregnancyEpisode.update({
        where: { id: episodeId },
        data: {
          status: dto.status,
          deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : null,
          deliveryMode: dto.deliveryMode ?? null,
          babyRecords: (dto.babyRecords ?? undefined) as Prisma.InputJsonValue | undefined,
          complications: dto.complications ?? [],
          riskNotes: appendNote(episode.riskNotes, dto.closureNote),
        },
      });
      const isLoss = LOSS_STATUSES.includes(dto.status);
      return {
        episode: this.decorate(updated),
        // Journey safety: any non-live-birth closure halts pregnancy messaging;
        // DELIVERED enrols the postnatal journey. (The journey engine reads these.)
        pregnancyJourneysActive: false,
        postnatalJourneyEnrolled: dto.status === PregnancyStatus.DELIVERED,
        lossPathway: isLoss,
      };
    });
  }

  // ---- Partogram (WHO LCG) ------------------------------------------------

  async startPartogram(episodeId: string, dto: StartPartogramDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();
    if (dto.startDilationCm < 5) {
      throw new BadRequestException('WHO LCG active-phase partogram starts at ≥5 cm dilation');
    }
    return this.prisma.forTenant(tenantId, async (tx) => {
      await requireActiveEpisode(tx, episodeId);
      const now = new Date();
      const partogram = await tx.partogram.create({
        data: {
          tenantId,
          pregnancyEpisodeId: episodeId,
          startedAt: now,
          parity: dto.parity,
          membraneStatus: dto.membraneStatus ?? 'INTACT',
          companionPresent: dto.companionPresent ?? null,
          painReliefOffered: dto.painReliefOffered ?? null,
          oralFluidsAllowed: dto.oralFluidsAllowed ?? null,
        },
      });
      // Seed the first entry with the confirmed starting dilation.
      await tx.partogramEntry.create({
        data: {
          tenantId,
          partogramId: partogram.id,
          recordedAt: now,
          recordedById: userId ?? null,
          cervicalDilationCm: dto.startDilationCm,
          alertFlags: [],
        },
      });
      return this.reloadPartogram(tx, partogram.id);
    });
  }

  async addPartogramEntry(partogramId: string, dto: AddPartogramEntryDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const partogram = await tx.partogram.findUnique({
        where: { id: partogramId },
        include: { entries: true },
      });
      if (!partogram) throw new NotFoundException(`Partogram ${partogramId} not found`);
      if (partogram.status !== 'ACTIVE') {
        throw new BadRequestException(`Partogram is ${partogram.status.toLowerCase()} — no new entries`);
      }

      const recordedAt = new Date(); // server clock is authoritative

      // Dilation may never decrease (except via an explicit correction).
      if (dto.cervicalDilationCm != null && !dto.correctsEntryId) {
        const lastDil = [...partogram.entries]
          .filter((e) => e.cervicalDilationCm != null)
          .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
          .pop();
        if (lastDil && dto.cervicalDilationCm < lastDil.cervicalDilationCm!) {
          throw new BadRequestException(
            'Cervical dilation cannot decrease — use a correction (correctsEntryId) if the prior entry was wrong',
          );
        }
      }
      if (dto.correctsEntryId) {
        const target = partogram.entries.find((e) => e.id === dto.correctsEntryId);
        if (!target) throw new BadRequestException('correctsEntryId does not reference an entry on this partogram');
      }

      const entryObs = { recordedAt, ...toObs(dto) };
      const entryFlags = partogramEntryAlerts(entryObs);
      const progressFlags = labourProgressAlerts({
        entries: [...partogram.entries.map((e) => ({ recordedAt: e.recordedAt, cervicalDilationCm: e.cervicalDilationCm })), entryObs],
        parity: partogram.parity,
        asOf: recordedAt,
      });
      const alertFlags = [...new Set([...entryFlags, ...progressFlags])];

      const entry = await tx.partogramEntry.create({
        data: {
          tenantId,
          partogramId,
          recordedAt,
          recordedById: userId ?? null,
          correctsEntryId: dto.correctsEntryId ?? null,
          cervicalDilationCm: dto.cervicalDilationCm ?? null,
          descentFifths: dto.descentFifths ?? null,
          contractionsPer10Min: dto.contractionsPer10Min ?? null,
          contractionDurationSec: dto.contractionDurationSec ?? null,
          fhrBpm: dto.fhrBpm ?? null,
          fhrDeceleration: dto.fhrDeceleration ?? null,
          amnioticFluid: dto.amnioticFluid ?? null,
          caput: dto.caput ?? null,
          moulding: dto.moulding ?? null,
          maternalPulse: dto.maternalPulse ?? null,
          bpSystolic: dto.bpSystolic ?? null,
          bpDiastolic: dto.bpDiastolic ?? null,
          temperatureC: dto.temperatureC ?? null,
          urineOutput: dto.urineOutput ?? null,
          urineProtein: dto.urineProtein ?? null,
          oxytocinUnitsPerL: dto.oxytocinUnitsPerL ?? null,
          oxytocinDropsPerMin: dto.oxytocinDropsPerMin ?? null,
          medicines: dto.medicines ?? null,
          ivFluids: dto.ivFluids ?? null,
          assessment: dto.assessment ?? null,
          plan: dto.plan ?? null,
          alertFlags,
        },
      });
      return { entry, alertFlags };
    });
  }

  async getPartogram(id: string) {
    return this.prisma.forCurrentTenant((tx) => this.reloadPartogram(tx, id));
  }

  async closePartogram(id: string, dto: ClosePartogramDto) {
    return this.prisma.forCurrentTenant(async (tx) => {
      const partogram = await tx.partogram.findUnique({ where: { id } });
      if (!partogram) throw new NotFoundException(`Partogram ${id} not found`);
      if (partogram.status !== 'ACTIVE') {
        throw new BadRequestException(`Partogram is already ${partogram.status.toLowerCase()}`);
      }
      await tx.partogram.update({
        where: { id },
        data: { status: dto.status, closedAt: new Date(), closureNote: dto.closureNote ?? null },
      });
      return this.reloadPartogram(tx, id);
    });
  }

  // ---- Gynae profile ------------------------------------------------------

  async upsertGynaeProfile(patientId: string, dto: UpsertGynaeProfileDto) {
    const tenantId = getTenantId();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const patient = await tx.patient.findUnique({ where: { id: patientId } });
      if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
      const data = {
        menarcheAgeYears: dto.menarcheAgeYears ?? null,
        cycleLengthDays: dto.cycleLengthDays ?? null,
        cycleRegularity: dto.cycleRegularity ?? null,
        flowDurationDays: dto.flowDurationDays ?? null,
        flowAmount: dto.flowAmount ?? null,
        dysmenorrhea: dto.dysmenorrhea ?? null,
        lmpRecorded: dto.lmpRecorded ? new Date(dto.lmpRecorded) : null,
        contraceptionMethod: dto.contraceptionMethod ?? null,
        papSmearLastDate: dto.papSmearLastDate ? new Date(dto.papSmearLastDate) : null,
        pcosRotterdam: (dto.pcosRotterdam ?? undefined) as Prisma.InputJsonValue | undefined,
        infertilityType: dto.infertilityType ?? null,
        infertilityDurationMonths: dto.infertilityDurationMonths ?? null,
        partnerSemenAnalysisDone: dto.partnerSemenAnalysisDone ?? null,
        tubalPatencyTest: dto.tubalPatencyTest ?? null,
        priorTreatments: dto.priorTreatments ?? null,
      };
      return tx.gynaeProfile.upsert({
        where: { tenantId_patientId: { tenantId, patientId } },
        update: data,
        create: { tenantId, patientId, ...data },
      });
    });
  }

  async getGynaeProfile(patientId: string) {
    return this.prisma.forCurrentTenant((tx) =>
      tx.gynaeProfile.findUnique({ where: { tenantId_patientId: { tenantId: getTenantId(), patientId } } }),
    );
  }

  // ---- helpers ------------------------------------------------------------

  /** Attach the live gestational age (computed now from eddFinal). */
  private decorate<T extends { eddFinal: Date | null }>(episode: T) {
    const ga = episode.eddFinal ? gestationalAge(episode.eddFinal, new Date()) : null;
    return { ...episode, gaNow: ga ? { weeks: ga.weeks, days: ga.days, label: ga.label } : null };
  }

  private reloadPartogram(tx: Prisma.TransactionClient, id: string) {
    return tx.partogram.findUnique({
      where: { id },
      include: { entries: { orderBy: { recordedAt: 'asc' } } },
    });
  }
}

async function requireActiveEpisode(tx: Prisma.TransactionClient, id: string) {
  const episode = await tx.pregnancyEpisode.findUnique({ where: { id } });
  if (!episode) throw new NotFoundException(`Pregnancy episode ${id} not found`);
  if (episode.status !== PregnancyStatus.ACTIVE) {
    throw new BadRequestException(`Episode is ${episode.status.toLowerCase()} — cannot add records`);
  }
  return episode;
}

function appendNote(existing: string | null, addition?: string | null): string | null {
  if (!addition) return existing;
  return existing ? `${existing}\n${addition}` : addition;
}

/** Map a partogram-entry DTO to the engine's observation shape. */
function toObs(dto: AddPartogramEntryDto) {
  return {
    cervicalDilationCm: dto.cervicalDilationCm ?? null,
    contractionsPer10Min: dto.contractionsPer10Min ?? null,
    contractionDurationSec: dto.contractionDurationSec ?? null,
    fhrBpm: dto.fhrBpm ?? null,
    amnioticFluid: dto.amnioticFluid ?? null,
    moulding: dto.moulding ?? null,
    maternalPulse: dto.maternalPulse ?? null,
    bpSystolic: dto.bpSystolic ?? null,
    bpDiastolic: dto.bpDiastolic ?? null,
    temperatureC: dto.temperatureC ?? null,
  };
}
