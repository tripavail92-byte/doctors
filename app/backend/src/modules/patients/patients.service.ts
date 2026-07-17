import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenant } from '../../common/tenant/tenant-context';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

/**
 * Patients domain service.
 *
 * Every query runs through prisma.forTenant(getTenant().tenantId, tx => ...),
 * which opens a transaction and sets `app.tenant_id` via set_config so that
 * Postgres row-level security scopes rows to the current tenant.
 */
@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  // List patients for the current tenant (newest first).
  async list() {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.patient.findMany({ orderBy: { createdAt: 'desc' } }),
    );
  }

  // Fetch a single patient by id (RLS guarantees tenant isolation).
  async get(id: string) {
    const { tenantId } = getTenant();
    const patient = await this.prisma.forTenant(tenantId, (tx) =>
      tx.patient.findUnique({ where: { id } }),
    );
    if (!patient) {
      throw new NotFoundException(`Patient ${id} not found`);
    }
    return patient;
  }

  // Create a patient scoped to the current tenant.
  async create(dto: CreatePatientDto) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.patient.create({
        data: {
          tenantId: tenantId!,
          mrn: dto.mrn,
          name: dto.name,
          phone: dto.phone,
          dob: dto.dob ? new Date(dto.dob) : null,
          gender: dto.gender ?? null,
        },
      }),
    );
  }

  // Partial update. Re-uses get() to produce a 404 when absent.
  async update(id: string, dto: UpdatePatientDto) {
    const { tenantId } = getTenant();
    await this.get(id);
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.patient.update({
        where: { id },
        data: {
          ...(dto.mrn !== undefined ? { mrn: dto.mrn } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.dob !== undefined ? { dob: dto.dob ? new Date(dto.dob) : null } : {}),
          ...(dto.gender !== undefined ? { gender: dto.gender ?? null } : {}),
        },
      }),
    );
  }
}