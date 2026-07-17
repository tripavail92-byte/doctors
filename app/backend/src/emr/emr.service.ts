import { Injectable, NotFoundException } from '@nestjs/common';
import { EncounterStatus, Prisma, TreatmentPlanStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { CreateIntakeSubmissionDto } from './dto/create-intake-submission.dto';
import { CreateNoteInstanceDto } from './dto/create-note-instance.dto';
import { CreateTreatmentPlanDto } from './dto/create-treatment-plan.dto';

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
    const items = dto.items.map((it) => {
      const quantity = it.quantity ?? 1;
      return {
        serviceCatalogItemId: it.serviceCatalogItemId ?? null,
        code: it.code,
        name: it.name,
        unitPricePkr: it.unitPricePkr,
        quantity,
        lineTotalPkr: it.unitPricePkr * quantity,
      };
    });
    const totalPkr = items.reduce((sum, i) => sum + i.lineTotalPkr, 0);

    return this.prisma.forTenant(tenantId, async (tx) => {
      await ensurePatient(tx, dto.patientId);
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
    const plan = await this.prisma.forTenant(tenantId, (tx) =>
      tx.treatmentPlan.findUnique({ where: { id } }),
    );
    if (!plan) throw new NotFoundException(`Treatment plan ${id} not found`);
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.treatmentPlan.update({ where: { id }, data: { status } }),
    );
  }
}

// Verify the patient is visible to the current tenant inside the RLS-scoped tx.
async function ensurePatient(tx: Prisma.TransactionClient, patientId: string): Promise<void> {
  const patient = await tx.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
}
