import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant, getTenantId } from '../common/tenant/tenant-context';
import { ObservationsService } from '../observations/observations.service';
import { normalizeSide } from '../observations/laterality';
import { ageYears } from '../obstetrics/engines/booking';
import { BodySide } from '@prisma/client';
import {
  GRADING_INSTRUMENTS,
  GAGS_REGIONS,
  PASI_REGIONS,
  EASI_REGIONS_ADULT,
  EASI_REGIONS_CHILD,
  MASI_REGIONS,
  VASI_REGIONS,
  VASI_DEPIGMENTATION,
  VASI_MAX,
  AREA_BANDS,
  SCORAD_SIGNS,
  scoreGrading,
} from './engines/grading.engine';
import {
  NBUVB_STANDARD,
  suggestDose,
  startDoseFor,
  ceilingFor,
  cumulativeWarning,
  DoseDecision,
} from './engines/phototherapy.engine';
import {
  CreateCourseDto,
  CreateLesionDto,
  GradeDto,
  RecordSessionDto,
  UpdateCourseStatusDto,
} from './dto/dermatology.dto';

// Each grading score also lands on the shared Observation substrate so it
// trends alongside vitals/labs without any per-pack charting code.
const TREND_METRIC: Record<string, string> = {
  gags: 'gags_score',
  pasi: 'pasi_score',
  easi: 'easi_score',
  scorad: 'scorad_score',
  masi: 'masi_score',
  mmasi: 'mmasi_score',
  vasi: 'vasi_score',
};

@Injectable()
export class DermatologyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly observations: ObservationsService,
  ) {}

  /** The region/sign metadata the grading widget renders itself from. */
  instrumentCatalog() {
    return {
      instruments: GRADING_INSTRUMENTS,
      areaBands: AREA_BANDS,
      gags: { regions: GAGS_REGIONS, max: 44 },
      // The per-region sign keys are part of the config the widget renders from,
      // not just knowledge living in the engine. Without them a config-driven
      // form knows a PASI region takes "signs 0-4" but not WHICH signs, and has
      // to hardcode them — which is exactly the drift this catalog exists to
      // prevent. SCORAD already listed its signs; PASI/EASI/MASI did not.
      pasi: {
        regions: PASI_REGIONS,
        signs: ['erythema', 'induration', 'desquamation'],
        signRange: [0, 4],
        max: 72,
      },
      easi: {
        regionsAdult: EASI_REGIONS_ADULT,
        regionsChild: EASI_REGIONS_CHILD,
        signs: ['erythema', 'induration', 'excoriation', 'lichenification'],
        signRange: [0, 3],
        max: 72,
      },
      scorad: { signs: SCORAD_SIGNS, signRange: [0, 3], max: 103 },
      masi: {
        regions: MASI_REGIONS,
        signs: ['darkness', 'homogeneity'],
        modifiedSigns: ['darkness'],
        signRange: [0, 4],
        max: 48,
        modifiedMax: 24,
      },
      // max derived from the region table, not restated — a hardcoded 100 is
      // exactly how the table came to sum to 107 without anyone noticing.
      vasi: { regions: VASI_REGIONS, depigmentationGrades: VASI_DEPIGMENTATION, max: VASI_MAX },
    };
  }

  /**
   * Score a grading instrument and persist it.
   *
   * The band is computed by the engine and never taken from the client, and a
   * partial region entry throws rather than saving a misleading total.
   */
  async grade(dto: GradeDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();

    return this.prisma.forTenant(tenantId, async (tx) => {
      const patient = await tx.patient.findUnique({ where: { id: dto.patientId } });
      if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found`);

      // EASI's region weights depend on whether the patient is a child (<=7y).
      // That is a fact derivable from the DOB on the record in front of us, not
      // a clinician judgement — so it is NOT taken from the client. The engine
      // already refuses to accept a computed BAND from the client; accepting
      // the weights that produce the score the band derives from would be the
      // same hole one level down. (growth and immunization already do this.)
      let isChild = false;
      if (dto.instrument.toLowerCase() === 'easi') {
        if (!patient.dob) {
          throw new BadRequestException(
            'EASI requires the patient date of birth: region weights differ for ' +
              'children aged 7 and under. Record the DOB on the patient first.',
          );
        }
        const age = ageYears(patient.dob, new Date());
        if (age < 0) {
          throw new BadRequestException(
            `Patient date of birth ${patient.dob.toISOString().slice(0, 10)} is in the future; ` +
              `EASI region weights depend on age and cannot be derived from it.`,
          );
        }
        isChild = age <= 7;
      }

      let result;
      try {
        result = scoreGrading(dto.instrument, dto.answers, { child: isChild });
      } catch (e) {
        // Engine validation failures are client errors, not 500s.
        throw new BadRequestException((e as Error).message);
      }

      const saved = await tx.scoredInstrumentResponse.create({
        data: {
          tenantId: tenantId!,
          patientId: dto.patientId,
          instrumentKey: result.key,
          answers: {
            answers: dto.answers,
            subscores: result.subscores,
            child: isChild,
          } as unknown as Prisma.InputJsonValue,
          score: result.score,
          band: result.band,
          flags: [],
          recordedById: userId ?? null,
        },
      });

      const metric = TREND_METRIC[result.key];
      if (metric) {
        // recordIn, not record: we are already inside a transaction. record()
        // would open a second one and check out another pooled connection.
        await this.observations.recordIn(
          tx,
          dto.patientId,
          metric,
          result.score,
          'score',
          `${result.key.toUpperCase()}${result.band ? ` (${result.band})` : ''}`,
        );
      }

      return { response: saved, ...result };
    });
  }

  async listGrades(patientId: string, instrument?: string) {
    return this.prisma.forCurrentTenant((tx) =>
      tx.scoredInstrumentResponse.findMany({
        where: {
          patientId,
          instrumentKey: instrument ? instrument.toLowerCase() : { in: GRADING_INSTRUMENTS },
        },
        orderBy: { recordedAt: 'desc' },
      }),
    );
  }

  // -------------------------------------------------------------------------
  // Phototherapy
  // -------------------------------------------------------------------------

  async createCourse(dto: CreateCourseDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();

    let side: BodySide | null = null;
    if (dto.laterality) {
      const norm = normalizeSide(dto.laterality);
      if (!norm) throw new BadRequestException(`Unrecognized side "${dto.laterality}"`);
      side = norm.toUpperCase() as BodySide;
    }

    const ctx = {
      fitzpatrickType: dto.fitzpatrickType,
      protocol: NBUVB_STANDARD,
      medMj: dto.medMj ?? null,
      incrementPct: dto.incrementPct ?? null,
    };

    let startDoseMj: number;
    let maxDoseMj: number;
    try {
      startDoseMj = startDoseFor(ctx);
      maxDoseMj = ceilingFor(ctx);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    // A MED far above the protocol's own start dose is a unit slip (J/cm2
    // entered as mJ/cm2), not a measurement.
    //
    // Anchored to the CEILING this guard was dead for skin types V/VI — it
    // needed medMj > 10714 while the DTO caps at 10000, so a type VI course
    // with medMj 10000 sailed through and delivered 5000 mJ against a protocol
    // start of 800. The start dose is the right reference: a real MED never
    // lands at many times the naive starting dose for that skin type.
    const protocolStart = NBUVB_STANDARD.startBySkinType[String(dto.fitzpatrickType)];
    if (dto.medMj && startDoseMj > protocolStart * 2) {
      throw new BadRequestException(
        `A measured MED of ${dto.medMj} mJ/cm2 gives a start dose of ${startDoseMj}, more than ` +
          `double the skin type ${dto.fitzpatrickType} protocol start of ${protocolStart}. ` +
          `Check the units — MED is entered in mJ/cm2, not J/cm2.`,
      );
    }
    // Keep the row internally coherent: startDoseMj must never exceed maxDoseMj.
    if (startDoseMj > maxDoseMj) startDoseMj = maxDoseMj;

    // Only NB-UVB has a protocol table here. The enum accepts BB_UVB/PUVA/
    // EXCIMER and the column stored them, but every dose still came off the
    // NB-UVB table — a broadband start is ~10-15x lower, so a BB_UVB course
    // would have been dosed off the wrong protocol entirely. Refuse until each
    // modality has its own table.
    const modality = dto.modality ?? 'NB_UVB';
    if (modality !== 'NB_UVB') {
      throw new BadRequestException(
        `Only NB_UVB is supported: no dosing protocol is defined for ${modality}, and using ` +
          `the NB-UVB table for it would be unsafe.`,
      );
    }

    return this.prisma.forTenant(tenantId, async (tx) => {
      const patient = await tx.patient.findUnique({ where: { id: dto.patientId } });
      if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found`);

      return tx.phototherapyCourse.create({
        data: {
          tenantId: tenantId!,
          patientId: dto.patientId,
          modality,
          bodySite: dto.bodySite ?? 'WHOLE_BODY',
          laterality: side,
          fitzpatrickType: dto.fitzpatrickType,
          indication: dto.indication,
          protocolKey: dto.protocolKey ?? 'NBUVB_STANDARD',
          startDoseMj,
          incrementPct: dto.incrementPct ?? NBUVB_STANDARD.incrementPct,
          maxDoseMj,
          medMj: dto.medMj ?? null,
          createdById: userId ?? null,
        },
      });
    });
  }

  /**
   * Lifetime UV load for a PATIENT, across every course.
   *
   * The warning is about cumulative carcinogenic risk, which does not reset when
   * a course ends. Feeding it a per-course total meant a skin-type I patient at
   * 700,000 mJ/cm2 spread over five courses was never warned once — the metric
   * said "lifetime" while the number was per-course.
   */
  private async lifetimeMj(tx: Prisma.TransactionClient, patientId: string): Promise<number> {
    const rows = await tx.phototherapySession.findMany({
      where: { skipped: false, course: { patientId } },
      select: { doseMj: true },
    });
    return rows.reduce((sum, r) => sum + r.doseMj, 0);
  }

  /**
   * The lowest unresolved burn anchor across ALL of this patient's courses.
   *
   * Skin belongs to the patient, not to a course. Keying the interlock on the
   * course meant a burn was escapable by starting a new one: course A holds at
   * 575 after a blister, a second course opens the same day with a clean
   * burnHoldDoseMj, and its first session delivers the naive 500 onto the skin
   * that just blistered — or the full ceiling with an override, since the
   * downward-only guard has no anchor to arm against.
   *
   * Lowest, not latest: a smaller burn is the tighter constraint, and the
   * interlock may only ever ratchet down.
   */
  private async patientBurnHold(
    tx: Prisma.TransactionClient,
    patientId: string,
  ): Promise<number | null> {
    const rows = await tx.phototherapyCourse.findMany({
      where: { patientId, burnHoldDoseMj: { not: null } },
      select: { burnHoldDoseMj: true },
    });
    if (!rows.length) return null;
    return Math.min(...rows.map((r) => r.burnHoldDoseMj as number));
  }

  async getCourse(id: string) {
    return this.prisma.forCurrentTenant(async (tx) => {
      const course = await tx.phototherapyCourse.findUnique({
        where: { id },
        include: { sessions: { orderBy: { sessionNo: 'desc' } } },
      });
      if (!course) throw new NotFoundException(`Phototherapy course ${id} not found`);
      const delivered = course.sessions.filter((s) => !s.skipped);
      const cumulativeMj = delivered.reduce((sum, s) => sum + s.doseMj, 0);
      const lifetime = await this.lifetimeMj(tx, course.patientId);
      return {
        ...course,
        cumulativeMj,
        lifetimeMj: lifetime,
        sessionsDelivered: delivered.length,
        cumulativeWarning: cumulativeWarning(lifetime, course.fitzpatrickType),
      };
    });
  }

  async listCourses(patientId: string) {
    return this.prisma.forCurrentTenant((tx) =>
      tx.phototherapyCourse.findMany({
        where: { patientId },
        orderBy: { startedAt: 'desc' },
      }),
    );
  }

  /**
   * What the engine would advise for the next session — the ledger widget
   * pre-fills its dose field from this, with the rationale shown to the user.
   */
  async previewNextDose(courseId: string, lastErythemaGrade?: number) {
    return this.prisma.forCurrentTenant(async (tx) => {
      const course = await tx.phototherapyCourse.findUnique({ where: { id: courseId } });
      if (!course) throw new NotFoundException(`Phototherapy course ${courseId} not found`);

      const { decision, lastDelivered } = await this.computeDecision(tx, course, lastErythemaGrade);

      // Preview must not answer a question it wasn't asked.
      //
      // Once UV has been delivered, the erythema reaction is a required input —
      // recordSession refuses to proceed without it. Preview had no such rule,
      // so omitting the grade fell through to the `?? 0` default and the widget
      // pre-filled an ESCALATION for a reaction nobody had assessed. Worse, the
      // stored sentinel for "not yet assessed" IS 0, so the preview could not
      // tell "no erythema" from "nobody looked" — and it rendered the second as
      // the first. The two endpoints then disagreed: the UI showed a dose the
      // record path would reject.
      if (lastDelivered && lastErythemaGrade == null) {
        return {
          gradeRequired: true,
          lastDeliveredMj: lastDelivered.doseMj,
          rationale:
            `Record the erythema reaction to the last session (${lastDelivered.doseMj} mJ/cm2) ` +
            `before a dose can be suggested — it is what determines whether this dose may ` +
            `escalate. Pass 0 explicitly if there was no erythema.`,
        };
      }
      return decision;
    });
  }

  /** Shared by preview and record so the suggestion can never drift. */
  private async computeDecision(
    tx: Prisma.TransactionClient,
    course: {
      id: string;
      fitzpatrickType: number;
      incrementPct: number;
      maxDoseMj: number;
      medMj: number | null;
      burnHoldDoseMj: number | null;
      patientId: string;
    },
    lastErythemaGrade?: number,
  ): Promise<{
    decision: DoseDecision;
    lastDelivered: {
      id: string;
      doseMj: number;
      deliveredAt: Date | null;
      erythemaGrade: number;
      burnFlag: boolean;
    } | null;
    cumulativeMj: number;
    gapDays: number | null;
    patientHold: number | null;
  }> {
    // Patient-scoped, not course-scoped: skin belongs to the patient, and a
    // burn was otherwise escapable by opening a new course.
    const patientHold = await this.patientBurnHold(tx, course.patientId);

    const sessions = await tx.phototherapySession.findMany({
      where: { courseId: course.id },
      orderBy: { sessionNo: 'desc' },
    });
    const delivered = sessions.filter((s) => !s.skipped && s.deliveredAt);
    const last = delivered[0] ?? null;
    const cumulativeMj = delivered.reduce((sum, s) => sum + s.doseMj, 0);

    // Gap is measured from the last DELIVERED session because it models decay
    // of UV tolerance — a held session delivered no UV, so the clock keeps
    // running. (A burn hold is therefore correctly treated as "no UV since",
    // while the burn itself is carried separately by course.burnHoldDoseMj.)
    let gapDays: number | null = null;
    if (last?.deliveredAt) {
      const ms = Date.now() - new Date(last.deliveredAt).getTime();
      gapDays = Math.floor(ms / 86_400_000);
    }

    // The grade describes the reaction to the last DELIVERED session, and is
    // stored on that session's row (recordSession back-writes it). The `?? 0`
    // fallback only applies when nothing has been recorded either way — see
    // requireErythemaGrade() in recordSession, which refuses to let a caller
    // silently default it once a delivered session exists.
    const grade = lastErythemaGrade ?? last?.erythemaGrade ?? 0;

    let decision: DoseDecision;
    try {
      decision = suggestDose({
        fitzpatrickType: course.fitzpatrickType,
        protocol: NBUVB_STANDARD,
        lastDoseMj: last?.doseMj ?? null,
        lastErythemaGrade: grade,
        gapDays,
        burnHoldDoseMj: patientHold,
        medMj: course.medMj,
        incrementPct: course.incrementPct,
        maxDoseMj: course.maxDoseMj,
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    return {
      decision,
      lastDelivered: last
        ? {
            id: last.id,
            doseMj: last.doseMj,
            deliveredAt: last.deliveredAt,
            erythemaGrade: last.erythemaGrade,
            burnFlag: last.burnFlag,
          }
        : null,
      cumulativeMj,
      gapDays,
      patientHold,
    };
  }

  /**
   * Record a session. The dose is decided server-side; the cumulative total is
   * recomputed from the ledger and never accepted from the client.
   *
   * A grade-3 burn does NOT throw: it is persisted as a held ledger row
   * (skipped, no dose, burnFlag) and returned with `held: true`. Throwing would
   * roll back the very transaction that recorded the burn, leaving the clinical
   * event with no trace — and leaving the next visit unable to tell a burn hold
   * from a no-show.
   */
  /**
   * Commit the reaction to the LAST DELIVERED session, in its own transaction.
   *
   * WHY THIS IS SEPARATE, AND WHY IT COMMITS FIRST:
   *
   * The grade is a clinical fact about a session that already happened. It is
   * NOT contingent on whether the session being requested now is accepted.
   *
   * Both were once in one transaction, and that quietly destroyed burns: a
   * clinician reporting grade-3 while also requesting an illegal dose got a 400
   * — which rolled back the very write that recorded the blister. The 400 looked
   * like the interlock working. It wasn't: the burn vanished, and two weeks later
   * the erythema faded, a clinician honestly graded 0, and the engine escalated
   * onto skin that had blistered at a lower dose. Nobody had to lie for it.
   *
   * So the reaction lands first and stays landed. Rejecting the request that
   * carried it cannot unsay it.
   */
  private async commitReaction(courseId: string, grade: number | undefined) {
    if (grade == null) return;
    const tenantId = getTenantId();
    await this.prisma.forTenant(tenantId, async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`,
        `phototherapy:${courseId}`,
      );
      const course = await tx.phototherapyCourse.findUnique({ where: { id: courseId } });
      if (!course) return;

      const sessions = await tx.phototherapySession.findMany({
        where: { courseId },
        orderBy: { sessionNo: 'desc' },
      });
      const last = sessions.find((s) => !s.skipped && s.deliveredAt);
      if (!last) return; // nothing delivered yet — no reaction to record

      // Never LOWER a recorded reaction, and never clear a burnFlag set at
      // delivery time ("dosed under a hold" is a different fact from "caused a
      // burn"; recomputing it from the grade alone erased the first).
      const merged = Math.max(grade, last.erythemaGrade);
      await tx.phototherapySession.update({
        where: { id: last.id },
        data: { erythemaGrade: merged, burnFlag: merged >= 3 || last.burnFlag },
      });

      if (merged >= 3) {
        // Arm the hold on the dose that burned. Ratchets DOWN only.
        const anchor =
          course.burnHoldDoseMj != null
            ? Math.min(course.burnHoldDoseMj, last.doseMj)
            : last.doseMj;
        await tx.phototherapyCourse.update({
          where: { id: courseId },
          data: { burnHoldDoseMj: anchor, burnHoldAt: new Date() },
        });
      }
    });
  }

  async recordSession(courseId: string, dto: RecordSessionDto) {
    const tenantId = getTenantId();
    const { userId } = getTenant();

    // The reaction is committed BEFORE the session request is evaluated, so a
    // rejection below cannot discard it. See commitReaction().
    await this.commitReaction(courseId, dto.lastErythemaGrade);

    return this.prisma.forTenant(tenantId, async (tx) => {
      // Serialise per course: sessionNo is read-max-then-insert, and the dose
      // decision itself reads the ledger. Without this, two concurrent posts
      // both compute against the same history — the unique constraint would
      // stop the duplicate row, but only after both had already decided a dose.
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`,
        `phototherapy:${courseId}`,
      );

      const course = await tx.phototherapyCourse.findUnique({ where: { id: courseId } });
      if (!course) throw new NotFoundException(`Phototherapy course ${courseId} not found`);
      if (course.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Course is ${course.status} — only an ACTIVE course can record sessions.`,
        );
      }

      const { decision, cumulativeMj, gapDays, lastDelivered, patientHold } =
        await this.computeDecision(tx, course, dto.lastErythemaGrade);

      // Once a session has been delivered, its erythema reaction is a required
      // clinical input — it is what gates escalation. Defaulting it to 0 would
      // manufacture an assertion ("no reaction") that no clinician made, and
      // write it into the audit trail as fact.
      if (lastDelivered && dto.lastErythemaGrade == null) {
        throw new BadRequestException(
          `lastErythemaGrade is required: it records the reaction to session ` +
            `${lastDelivered.doseMj} mJ/cm2 and determines whether this dose may escalate. ` +
            `Pass 0 explicitly if there was no erythema.`,
        );
      }

      // ------------------------------------------------------------------
      // VALIDATE FIRST. Every throw below this comment must happen BEFORE any
      // write in this transaction.
      //
      // The override guard used to sit AFTER the grade back-write. Rejecting an
      // illegal override therefore rolled back the very transaction that was
      // recording the grade-3 — so a refused override destroyed the burn it had
      // just detected. Nobody had to lie for it to bite: the 400 looked like the
      // interlock working, the burn vanished, and two weeks later a clinician
      // honestly graded the faded erythema 0 and the engine escalated to 760 on
      // skin that had blistered at 661.
      //
      // A rejection must never be able to discard a clinical fact.
      // ------------------------------------------------------------------

      if (decision.skip && dto.overrideBurnHold && !dto.overrideReason) {
        throw new BadRequestException('overrideReason is required to override a burn hold.');
      }

      // THE burn anchor for this request — derived ONCE and used by every
      // decision below. A burn reported NOW is a burn, whether or not a column
      // says so yet, so this reads the CURRENT decision, not just the stored
      // column (which is still null on the visit a grade-3 is first reported).
      const reportedBurn = decision.burnFlag && lastDelivered ? lastDelivered.doseMj : null;
      const burnAnchor: number | null =
        patientHold != null && reportedBurn != null
          ? Math.min(patientHold, reportedBurn) // ratchet down only
          : (patientHold ?? reportedBurn);

      // Manual dose override — reason required, ceiling still applies.
      let appliedMj = decision.suggestedMj;
      let overridden = false;
      if (dto.overrideDoseMj != null && dto.overrideDoseMj !== decision.suggestedMj) {
        if (!dto.overrideReason) {
          throw new BadRequestException(
            'overrideReason is required when overriding the suggested dose.',
          );
        }
        if (dto.overrideDoseMj > course.maxDoseMj) {
          throw new BadRequestException(
            `Dose ${dto.overrideDoseMj} exceeds the ceiling of ${course.maxDoseMj} mJ/cm2 for this course. The ceiling cannot be overridden.`,
          );
        }
        // While a burn is unresolved the override may only go DOWN — including
        // on the visit the burn is first reported.
        if (burnAnchor != null && dto.overrideDoseMj > decision.suggestedMj) {
          throw new BadRequestException(
            `A grade-3 burn at ${burnAnchor} mJ/cm2 is unresolved for this patient. While it is, ` +
              `the dose may only be overridden DOWNWARD — ${decision.suggestedMj} mJ/cm2 or less ` +
              `(requested ${dto.overrideDoseMj}).`,
          );
        }
        appliedMj = dto.overrideDoseMj;
        overridden = true;
      }

      // ------------------------------------------------------------------
      // WRITES START HERE. Nothing below may throw a validation error.
      // ------------------------------------------------------------------


      const lastNo = await tx.phototherapySession.findFirst({
        where: { courseId },
        orderBy: { sessionNo: 'desc' },
      });
      const sessionNo = (lastNo?.sessionNo ?? 0) + 1;

      // A held session delivers no dose and does not advance the cumulative.
      const skipped = decision.skip && !dto.overrideBurnHold;
      const doseMj = skipped ? 0 : appliedMj;

      // Carry the burn across visits. The held row is invisible to the "last
      // delivered" filter, so without this the interlock fires once and the
      // next visit escalates above the dose that blistered the patient.
      // Cleared as soon as a session is actually delivered — that delivery has
      // already applied the reduction, so escalation may resume from there.
      // ONE place decides the persisted burn state, from the single anchor
      // derived above. Previously an arm branch and a clear branch each
      // recomputed it and disagreed.
      // Arming happens in commitReaction, which has already committed. This
      // block only RESOLVES a hold — and only when a session actually delivered
      // UV at or below the reduced dose.
      //
      // `doseMj > 0` matters: a 0 mJ row (a lamp fault) is not evidence of
      // tolerance, and clearing on it re-armed the full-dose override.
      //
      // The hold may live on a DIFFERENT course of the same patient, so the
      // clear is scoped to the patient — skin does not heal per course.
      if (burnAnchor != null && !skipped && !decision.burnFlag && doseMj > 0) {
        if (doseMj <= Math.round(burnAnchor * 0.5)) {
          await tx.phototherapyCourse.updateMany({
            where: { patientId: course.patientId, burnHoldDoseMj: { not: null } },
            data: { burnHoldDoseMj: null, burnHoldAt: null },
          });
        }
      }

      const session = await tx.phototherapySession.create({
        data: {
          tenantId: tenantId!,
          courseId,
          sessionNo,
          deliveredAt: skipped ? null : new Date(),
          doseMj,
          cumulativeMj: cumulativeMj + doseMj,
          lampHours: dto.lampHours ?? null,
          gapDays,
          // This row's OWN reaction is not known yet — it is captured at the
          // next visit and back-written above. 0 here means "not yet assessed",
          // never "no erythema".
          erythemaGrade: 0,
          burnFlag: decision.burnFlag,
          doseDecision: {
            suggested: decision.suggestedMj,
            applied: doseMj,
            action: decision.action,
            ruleFired: decision.ruleFired,
            rationale: decision.rationale,
            capped: decision.capped,
            consideredRules: decision.consideredRules ?? [],
            priorErythemaGrade: dto.lastErythemaGrade ?? null,
            override: overridden,
            overrideBurnHold: dto.overrideBurnHold ?? false,
            overrideReason: dto.overrideReason ?? null,
          } as unknown as Prisma.InputJsonValue,
          skipped,
          skipReason: skipped ? decision.ruleFired : null,
          notes: dto.notes ?? null,
          deliveredById: userId ?? null,
        },
      });

      const newCumulative = cumulativeMj + doseMj;
      const lifetime = await this.lifetimeMj(tx, course.patientId);
      return {
        // `held` is the burn interlock's outward signal. It replaces a thrown
        // 400: the hold IS the clinically-correct outcome and must be recorded,
        // and throwing would roll back the row that records it.
        held: skipped,
        session,
        decision,
        cumulativeMj: newCumulative,
        lifetimeMj: lifetime,
        cumulativeWarning: cumulativeWarning(lifetime, course.fitzpatrickType),
      };
    });
  }

  async updateCourseStatus(id: string, dto: UpdateCourseStatusDto) {
    return this.prisma.forCurrentTenant(async (tx) => {
      const course = await tx.phototherapyCourse.findUnique({ where: { id } });
      if (!course) throw new NotFoundException(`Phototherapy course ${id} not found`);
      return tx.phototherapyCourse.update({
        where: { id },
        data: {
          status: dto.status,
          endedAt: dto.status === 'COMPLETED' || dto.status === 'ABANDONED' ? new Date() : null,
        },
      });
    });
  }

  // -------------------------------------------------------------------------
  // Lesions
  // -------------------------------------------------------------------------

  async createLesion(dto: CreateLesionDto) {
    const tenantId = getTenantId();
    let side: BodySide | null = null;
    if (dto.laterality) {
      const norm = normalizeSide(dto.laterality);
      if (!norm) throw new BadRequestException(`Unrecognized side "${dto.laterality}"`);
      side = norm.toUpperCase() as BodySide;
    }
    return this.prisma.forTenant(tenantId, async (tx) => {
      const patient = await tx.patient.findUnique({ where: { id: dto.patientId } });
      if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found`);
      return tx.skinLesion.create({
        data: {
          tenantId: tenantId!,
          patientId: dto.patientId,
          encounterId: dto.encounterId ?? null,
          bodyRegion: dto.bodyRegion,
          laterality: side,
          morphology: dto.morphology,
          diagnosisCode: dto.diagnosisCode ?? null,
          abcde: (dto.abcde ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    });
  }

  async listLesions(patientId: string) {
    return this.prisma.forCurrentTenant((tx) =>
      tx.skinLesion.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } }),
    );
  }
}
