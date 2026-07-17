import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BodySide, Prisma, RehabEpisodeStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant, getTenantId } from '../common/tenant/tenant-context';
import { ObservationsService } from '../observations/observations.service';
import { normalizeSide } from '../observations/laterality';
import { ROM_REFERENCE, romRef } from './rom-reference';
import { romDeficit, validateRom } from './engines/rom.engine';
import { checkModalitySafety, SafetyHit, worstVerdict } from './engines/modality-safety';
import {
  AddExerciseDto,
  AddRomDto,
  AddSessionDto,
  CreateAssessmentDto,
  CreateEpisodeDto,
  DischargeDto,
} from './dto/rehab.dto';

const WITH_DETAIL = {
  assessments: { include: { rom: true } },
  sessions: true,
  exercises: true,
} as const;

/**
 * Physiotherapy & rehab: an episode of care with MSK assessments (per-joint ROM
 * with deficit banding), safety-gated treatment sessions, and a home exercise
 * programme. Outcome measures reuse the shared instrument engine; pain (NPRS)
 * rides the core Observation substrate.
 */
@Injectable()
export class RehabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly observations: ObservationsService,
  ) {}

  romReference() {
    return ROM_REFERENCE;
  }

  createEpisode(dto: CreateEpisodeDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const patient = await tx.patient.findUnique({ where: { id: dto.patientId } });
      if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found`);
      return tx.rehabEpisode.create({
        data: {
          tenantId,
          patientId: dto.patientId,
          diagnosis: dto.diagnosis,
          bodyRegion: dto.bodyRegion,
          onsetDate: dto.onsetDate ? new Date(dto.onsetDate) : null,
          sessionsPlanned: dto.sessionsPlanned ?? 0,
          goals: dto.goals ?? null,
          safetyIntake: (dto.safetyIntake ?? undefined) as Prisma.InputJsonValue | undefined,
          createdById: userId ?? null,
        },
      });
    });
  }

  listEpisodes(patientId: string) {
    return this.prisma.forCurrentTenant((tx) =>
      tx.rehabEpisode.findMany({ where: { patientId }, orderBy: { startDate: 'desc' }, include: WITH_DETAIL }),
    );
  }

  async getEpisode(id: string) {
    const ep = await this.prisma.forCurrentTenant((tx) =>
      tx.rehabEpisode.findUnique({ where: { id }, include: WITH_DETAIL }),
    );
    if (!ep) throw new NotFoundException(`Rehab episode ${id} not found`);
    return ep;
  }

  async createAssessment(episodeId: string, dto: CreateAssessmentDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      await requireActiveEpisode(tx, episodeId);
      return tx.mskAssessment.create({
        data: {
          tenantId,
          rehabEpisodeId: episodeId,
          encounterId: dto.encounterId ?? null,
          posture: dto.posture ?? null,
          gait: dto.gait ?? null,
          palpation: dto.palpation ?? null,
          notes: dto.notes ?? null,
          specialTests: (dto.specialTests ?? undefined) as Prisma.InputJsonValue | undefined,
          assessedById: userId ?? null,
        },
      });
    });
  }

  /** Record one ROM cell: validated against the reference ceiling, deficit-banded. */
  async addRom(assessmentId: string, dto: AddRomDto) {
    const tenantId = getTenantId();
    const ref = romRef(dto.joint.toUpperCase(), dto.movement.toUpperCase());
    if (!ref) throw new BadRequestException(`No ROM reference for ${dto.joint}/${dto.movement}`);

    const check = validateRom({
      activeDegrees: dto.activeDegrees,
      passiveDegrees: dto.passiveDegrees,
      maxDegrees: ref.maxDegrees,
    });
    if (check.error) throw new BadRequestException(check.error);

    // Band on the ACTIVE measure (falls back to passive) vs the normal.
    const measured = dto.activeDegrees ?? dto.passiveDegrees ?? null;
    const deficit = measured != null ? romDeficit(measured, ref.normalDegrees) : null;

    let side: BodySide | null = null;
    if (dto.side) {
      const norm = normalizeSide(dto.side);
      if (!norm) throw new BadRequestException(`Unrecognized side "${dto.side}"`);
      side = norm.toUpperCase() as BodySide;
    }

    return this.prisma.forTenant(tenantId, async (tx) => {
      const assessment = await tx.mskAssessment.findUnique({ where: { id: assessmentId } });
      if (!assessment) throw new NotFoundException(`Assessment ${assessmentId} not found`);
      const rom = await tx.romMeasurement.create({
        data: {
          tenantId,
          mskAssessmentId: assessmentId,
          joint: ref.joint,
          movement: ref.movement,
          laterality: side,
          activeDegrees: dto.activeDegrees ?? null,
          passiveDegrees: dto.passiveDegrees ?? null,
          normalDegrees: ref.normalDegrees,
          deficitPct: deficit?.deficitPct ?? null,
          deficitBand: deficit?.band ?? null,
          note: dto.note ?? null,
        },
      });
      return { rom, deficit, warning: check.warn ?? null, normalDegrees: ref.normalDegrees };
    });
  }

  /**
   * Record a treatment session. Every modality is checked against the episode's
   * safety intake; a BLOCK stops the write unless a senior override + reason is
   * supplied (and the hits are persisted for audit).
   */
  async addSession(episodeId: string, dto: AddSessionDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      // Serialize session writes on the episode row. addSession reads the last
      // session number then inserts (a read-then-write), and also writes a shared
      // pain Observation. Fired concurrently — two physios on one episode, or a
      // double-click — those collided: one succeeded and the rest came back as
      // opaque HTTP 500s, so a session a clinician thought they recorded was
      // silently lost. The lock makes them run one at a time, as IPD locks a bed.
      await tx.$executeRaw`SELECT id FROM "RehabEpisode" WHERE id = ${episodeId}::uuid FOR UPDATE`;
      const episode = await requireActiveEpisode(tx, episodeId);
      const intake = (episode.safetyIntake ?? {}) as Record<string, boolean>;

      const hits: SafetyHit[] = dto.modalities.flatMap((m) =>
        checkModalitySafety(m, episode.bodyRegion, intake),
      );
      const verdict = worstVerdict(hits);
      if (verdict === 'BLOCK' && !dto.overrideBlock) {
        throw new BadRequestException(
          `Modality contraindicated: ${hits.filter((h) => h.verdict === 'BLOCK').map((h) => h.message).join('; ')} — senior override required`,
        );
      }
      if (verdict === 'BLOCK' && dto.overrideBlock && !dto.overrideReason) {
        throw new BadRequestException('overrideReason is required to override a contraindication');
      }

      const last = await tx.rehabSession.findFirst({
        where: { rehabEpisodeId: episodeId },
        orderBy: { sessionNumber: 'desc' },
      });
      const sessionNumber = (last?.sessionNumber ?? 0) + 1;

      const session = await tx.rehabSession.create({
        data: {
          tenantId,
          rehabEpisodeId: episodeId,
          encounterId: dto.encounterId ?? null,
          sessionNumber,
          status: dto.status ?? 'COMPLETED',
          modalities: dto.modalities,
          safetyNotes: (hits.length
            ? { verdict, hits, override: dto.overrideBlock ?? false, overrideReason: dto.overrideReason ?? null }
            : undefined) as Prisma.InputJsonValue | undefined,
          painPre: dto.painPre ?? null,
          painPost: dto.painPost ?? null,
          notes: dto.notes ?? null,
          performedById: userId ?? null,
        },
      });

      // Pain rides the core Observation substrate (NPRS 0-10) so it trends.
      if (dto.painPost != null) {
        await this.observations.recordIn(tx, episode.patientId, 'nprs', dto.painPost, 'score', `Session ${sessionNumber} post-treatment`);
      }
      return { session, safety: { verdict, hits } };
    });
  }

  addExercise(episodeId: string, dto: AddExerciseDto) {
    const tenantId = getTenantId();
    return this.prisma.forTenant(tenantId, async (tx) => {
      await requireActiveEpisode(tx, episodeId);
      return tx.exercisePrescription.create({
        data: {
          tenantId,
          rehabEpisodeId: episodeId,
          exerciseCode: dto.exerciseCode,
          name: dto.name,
          sets: dto.sets ?? null,
          reps: dto.reps ?? null,
          holdSeconds: dto.holdSeconds ?? null,
          frequencyPerWeek: dto.frequencyPerWeek ?? null,
          progression: dto.progression ?? null,
          instructions: dto.instructions ?? null,
        },
      });
    });
  }

  async discharge(episodeId: string, dto: DischargeDto) {
    if (dto.status === RehabEpisodeStatus.ACTIVE) {
      throw new BadRequestException('Discharge requires a terminal status');
    }
    return this.prisma.forCurrentTenant(async (tx) => {
      const episode = await tx.rehabEpisode.findUnique({ where: { id: episodeId } });
      if (!episode) throw new NotFoundException(`Rehab episode ${episodeId} not found`);
      if (episode.status !== RehabEpisodeStatus.ACTIVE) {
        throw new BadRequestException(`Episode is already ${episode.status.toLowerCase()}`);
      }
      return tx.rehabEpisode.update({
        where: { id: episodeId },
        data: { status: dto.status, dischargedAt: new Date(), dischargeNote: dto.dischargeNote ?? null },
      });
    });
  }
}

async function requireActiveEpisode(tx: Prisma.TransactionClient, id: string) {
  const episode = await tx.rehabEpisode.findUnique({ where: { id } });
  if (!episode) throw new NotFoundException(`Rehab episode ${id} not found`);
  if (episode.status !== RehabEpisodeStatus.ACTIVE) {
    throw new BadRequestException(`Episode is ${episode.status.toLowerCase()} — cannot add records`);
  }
  return episode;
}
