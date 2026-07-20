import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EncounterStatus, Prisma, TreatmentPlanStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { CreateIntakeSubmissionDto } from './dto/create-intake-submission.dto';
import { CreateNoteInstanceDto } from './dto/create-note-instance.dto';
import { CreateTreatmentPlanDto } from './dto/create-treatment-plan.dto';

// int4 ceiling. Money columns are int4; the DTO caps each field but not their product.
const MAX_INT4 = 2_147_483_647;

/**
 * EMR persistence: the visit envelope (Encounter) and the filled clinical
 * artifacts (IntakeSubmission, NoteInstance, TreatmentPlan). Every write
 * verifies the target patient is visible to the tenant (inside the same
 * RLS-scoped transaction, so an out-of-tenant patientId 404s instead of
 * silently passing the FK check), and plan totals are recomputed server-side.
 */
@Injectable()
export class EmrService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Encounters --------------------------------------------------------
  createEncounter(dto: CreateEncounterDto) {
    const { tenantId, userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      await ensurePatient(tx, dto.patientId);
      return tx.encounter.create({
        data: {
          tenantId: tenantId!,
          patientId: dto.patientId,
          appointmentId: dto.appointmentId ?? null,
          providerId: dto.providerId ?? null,
          packKey: dto.packKey ?? null,
          reason: dto.reason ?? null,
          occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
          createdById: userId ?? null,
        },
      });
    });
  }

  listEncounters(patientId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.encounter.findMany({
        where: { patientId },
        orderBy: { occurredAt: 'desc' },
        include: {
          _count: { select: { noteInstances: true, intakeSubmissions: true, treatmentPlans: true } },
        },
      }),
    );
  }

  async getEncounter(id: string) {
    const { tenantId } = getTenant();
    const enc = await this.prisma.forTenant(tenantId, (tx) =>
      tx.encounter.findUnique({
        where: { id },
        include: {
          noteInstances: true,
          intakeSubmissions: true,
          treatmentPlans: { include: { items: true } },
        },
      }),
    );
    if (!enc) throw new NotFoundException(`Encounter ${id} not found`);
    return enc;
  }

  async updateEncounterStatus(id: string, status: EncounterStatus) {
    const { tenantId } = getTenant();
    await this.getEncounter(id);
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.encounter.update({ where: { id }, data: { status } }),
    );
  }

  // --- Intake ------------------------------------------------------------
  createIntake(dto: CreateIntakeSubmissionDto) {
    const { tenantId, userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      await ensurePatient(tx, dto.patientId);
      await ensureEncounterMatchesPatient(tx, dto.encounterId, dto.patientId);
      return tx.intakeSubmission.create({
        data: {
          tenantId: tenantId!,
          patientId: dto.patientId,
          encounterId: dto.encounterId ?? null,
          packKey: dto.packKey,
          answers: dto.answers as unknown as Prisma.InputJsonValue,
          submittedById: userId ?? null,
        },
      });
    });
  }

  listIntake(patientId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.intakeSubmission.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  // --- Notes -------------------------------------------------------------
  createNote(dto: CreateNoteInstanceDto) {
    const { tenantId, userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      await ensurePatient(tx, dto.patientId);
      await ensureEncounterMatchesPatient(tx, dto.encounterId, dto.patientId);
      return tx.noteInstance.create({
        data: {
          tenantId: tenantId!,
          patientId: dto.patientId,
          encounterId: dto.encounterId ?? null,
          templateId: dto.templateId ?? null,
          templateKey: dto.templateKey,
          data: dto.data as unknown as Prisma.InputJsonValue,
          authoredById: userId ?? null,
        },
      });
    });
  }

  listNotes(patientId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.noteInstance.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  // --- Treatment plans ---------------------------------------------------
  createPlan(dto: CreateTreatmentPlanDto) {
    const { tenantId, userId } = getTenant();
    // Server computes line totals + total — the client figure is display-only.
    // The DTO caps each field, but the caps alone do not bound the PRODUCT:
    // 100,000,000 x 10,000 is 1e12, three orders of magnitude past int4. Both
    // lineTotalPkr and totalPkr are int4 columns, so the multiply and the sum each
    // need their own check — otherwise the write reaches Postgres and comes back
    // as an HTTP 500 "Internal server error", which tells the caller nothing and
    // reads to us like a crash rather than bad input.
    const items = dto.items.map((it) => {
      const quantity = it.quantity ?? 1;
      const lineTotalPkr = it.unitPricePkr * quantity;
      if (lineTotalPkr > MAX_INT4) {
        throw new BadRequestException(
          `Line "${it.name}" totals ${lineTotalPkr} PKR, which exceeds the maximum of ${MAX_INT4}`,
        );
      }
      return {
        serviceCatalogItemId: it.serviceCatalogItemId ?? null,
        code: it.code,
        name: it.name,
        unitPricePkr: it.unitPricePkr,
        quantity,
        lineTotalPkr,
      };
    });
    const totalPkr = items.reduce((sum, i) => sum + i.lineTotalPkr, 0);
    if (totalPkr > MAX_INT4) {
      throw new BadRequestException(
        `Plan totals ${totalPkr} PKR, which exceeds the maximum of ${MAX_INT4}`,
      );
    }

    return this.prisma.forTenant(tenantId, async (tx) => {
      await ensurePatient(tx, dto.patientId);
      await ensureEncounterMatchesPatient(tx, dto.encounterId, dto.patientId);
      const plan = await tx.treatmentPlan.create({
        data: {
          tenantId: tenantId!,
          patientId: dto.patientId,
          encounterId: dto.encounterId ?? null,
          totalPkr,
          createdById: userId ?? null,
        },
      });
      await tx.treatmentPlanItem.createMany({
        data: items.map((i) => ({ tenantId: tenantId!, planId: plan.id, ...i })),
      });
      return tx.treatmentPlan.findUnique({ where: { id: plan.id }, include: { items: true } });
    });
  }

  listPlans(patientId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.treatmentPlan.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
    );
  }

  async updatePlanStatus(id: string, status: TreatmentPlanStatus) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      // Lock the plan and read+write in ONE transaction. The old code read the
      // plan in one forTenant tx and updated it in another, and enforced no
      // transition at all — so any status could move to any other. The break
      // that mattered: billing invoices a plan only while it is PROPOSED and
      // flips it to ACCEPTED under a row lock, so a plan bills once. Resetting
      // ACCEPTED -> PROPOSED here re-armed that guard, and one plan was invoiced
      // three times (reproduced: 240,000 PKR from an 80,000 plan). A terminal
      // status must not walk backwards.
      await tx.$executeRaw`SELECT id FROM "TreatmentPlan" WHERE id = ${id}::uuid FOR UPDATE`;
      const plan = await tx.treatmentPlan.findUnique({ where: { id } });
      if (!plan) throw new NotFoundException(`Treatment plan ${id} not found`);

      if (!PLAN_TRANSITIONS[plan.status].includes(status)) {
        throw new BadRequestException(
          `A treatment plan cannot move from ${plan.status} to ${status}.`,
        );
      }
      return tx.treatmentPlan.update({ where: { id }, data: { status } });
    });
  }
}

// Allowed treatment-plan status moves. PROPOSED may still be revised or
// abandoned before it is acted on; ACCEPTED (billing has invoiced it) may only
// go on to COMPLETED or be CANCELLED; COMPLETED and CANCELLED are terminal.
// Crucially, nothing returns to PROPOSED — that is the state billing treats as
// "not yet invoiced", so re-entering it is what let one plan bill repeatedly.
const PLAN_TRANSITIONS: Record<TreatmentPlanStatus, TreatmentPlanStatus[]> = {
  PROPOSED: [TreatmentPlanStatus.ACCEPTED, TreatmentPlanStatus.CANCELLED],
  ACCEPTED: [TreatmentPlanStatus.COMPLETED, TreatmentPlanStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

// An encounter is one patient's visit. A note, intake or plan may name an
// encounterId, and nothing checked it belonged to the same patient — so a note
// for patient B carrying patient A's encounterId was accepted, and getEncounter
// then served it under A. That files B's "penicillin ANAPHYLAXIS" in A's chart
// and hides it from B's. The FK only proves the encounter exists in-tenant, not
// that it is THIS patient's. Reproduced live before this guard existed.
async function ensureEncounterMatchesPatient(
  tx: Prisma.TransactionClient,
  encounterId: string | null | undefined,
  patientId: string,
): Promise<void> {
  if (!encounterId) return; // no envelope claimed — nothing to cross-check
  const enc = await tx.encounter.findUnique({ where: { id: encounterId } });
  if (!enc) throw new NotFoundException(`Encounter ${encounterId} not found`);
  if (enc.patientId !== patientId) {
    throw new BadRequestException(
      `Encounter ${encounterId} belongs to a different patient — an artifact cannot be filed under another patient's visit.`,
    );
  }
}

// Verify the patient is visible to the current tenant inside the RLS-scoped tx.
async function ensurePatient(tx: Prisma.TransactionClient, patientId: string): Promise<void> {
  const patient = await tx.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
}
