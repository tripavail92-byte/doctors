import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';
import { Prisma } from '@prisma/client';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LogActivityDto } from './dto/log-activity.dto';

// Generate the next auto MRN (P-00001…) under a per-tenant advisory lock, so
// concurrent conversions cannot count the same N and mint the same MRN — the
// same collision-safe scheme the lab and invoice numbers use. Reproduced without
// it: 8 concurrent converts produced P-00753 six times.
async function nextMrn(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  await tx.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
    `patient-mrn:${tenantId}`,
  );
  // Derive from the HIGHEST P-number already issued, not from the row count.
  //
  // count+1 assumes the P-series is dense and is the only source of MRNs, and
  // neither holds: the demo data uses GD-####, patients can be registered with
  // any MRN at the front desk, and a deletion leaves a hole. With 12 GD-*
  // patients present, count+1 returns P-00013 while P-00013 may already exist —
  // previously that silently minted a duplicate chart, and now that
  // (tenantId, mrn) is unique it would be a 500 on a lead conversion.
  //
  // The advisory lock still matters: it serialises two conversions so they
  // cannot read the same maximum.
  const rows = await tx.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(SUBSTRING(mrn FROM '^P-([0-9]+)$')::int) AS max
      FROM "Patient"
     WHERE mrn ~ '^P-[0-9]+$'`;
  const next = (rows[0]?.max ?? 0) + 1;
  return `P-${String(next).padStart(5, '0')}`;
}

/**
 * CRM / marketing: lead pipeline. Leads are worked through activities and
 * status changes, and converted into Patient records; a funnel report shows
 * the pipeline + conversion rate.
 */
@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  createLead(dto: CreateLeadDto) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.lead.create({
        data: {
          tenantId: tenantId!,
          name: dto.name,
          phone: dto.phone,
          source: dto.source ?? null,
          interest: dto.interest ?? null,
          assignedToId: dto.assignedToId ?? null,
          note: dto.note ?? null,
        },
      }),
    );
  }

  listLeads(status?: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.lead.findMany({
        where: status ? { status: status as LeadStatus } : {},
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async getLead(id: string) {
    const { tenantId } = getTenant();
    const lead = await this.prisma.forTenant(tenantId, (tx) =>
      tx.lead.findUnique({ where: { id }, include: { activities: { orderBy: { createdAt: 'desc' } } } }),
    );
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  async updateStatus(id: string, status: LeadStatus) {
    const { tenantId } = getTenant();
    await this.getLead(id);
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.lead.update({ where: { id }, data: { status } }),
    );
  }

  async logActivity(leadId: string, dto: LogActivityDto) {
    const { tenantId, userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);
      return tx.leadActivity.create({
        data: {
          tenantId: tenantId!,
          leadId,
          type: dto.type,
          note: dto.note ?? null,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          createdById: userId ?? null,
        },
      });
    });
  }

  async markActivityDone(leadId: string, activityId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const act = await tx.leadActivity.findUnique({ where: { id: activityId } });
      if (!act || act.leadId !== leadId) throw new NotFoundException('Activity not found');
      return tx.leadActivity.update({ where: { id: activityId }, data: { done: true } });
    });
  }

  // Convert a lead into a Patient record.
  async convert(leadId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      // Lock the lead first. Without it, convert was a read-then-write: two
      // concurrent converts of one lead both saw status != CONVERTED and both
      // created a Patient — reproduced 5-6 duplicate patient records from a
      // single lead. The lock serialises them so the loser sees CONVERTED.
      await tx.$executeRaw`SELECT id FROM "Lead" WHERE id = ${leadId}::uuid FOR UPDATE`;
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);
      if (lead.status === LeadStatus.CONVERTED) {
        throw new BadRequestException('Lead is already converted');
      }

      const mrn = await nextMrn(tx, tenantId!);
      const patient = await tx.patient.create({
        data: { tenantId: tenantId!, mrn, name: lead.name, phone: lead.phone },
      });
      const updated = await tx.lead.update({
        where: { id: leadId },
        data: { status: LeadStatus.CONVERTED, convertedPatientId: patient.id },
      });
      return { lead: updated, patient };
    });
  }

  async funnel() {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.lead.groupBy({ by: ['status'], _count: { _all: true } });
      const byStatus: Record<string, number> = {};
      let total = 0;
      for (const r of rows) {
        byStatus[String(r.status)] = r._count._all;
        total += r._count._all;
      }
      const converted = byStatus[LeadStatus.CONVERTED] ?? 0;
      return { total, byStatus, conversionRatePct: total ? Math.round((converted / total) * 100) : 0 };
    });
  }

  pendingFollowups() {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.leadActivity.findMany({
        where: { done: false, dueAt: { not: null } },
        orderBy: { dueAt: 'asc' },
        include: { lead: { select: { name: true, phone: true, status: true } } },
      }),
    );
  }
}
