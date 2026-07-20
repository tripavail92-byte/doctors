import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  //
  // The MRN is unique per tenant at the DATABASE level, not by a read-then-write
  // check here. Two receptionists registering the same walk-in at the same
  // moment would both pass a read and both insert — the same TOCTOU that let one
  // MRN accumulate five charts. The index is the guard; this only translates it.
  async create(dto: CreatePatientDto) {
    const { tenantId } = getTenant();
    try {
      return await this.prisma.forTenant(tenantId, (tx) =>
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
    } catch (e) {
      throw this.translateMrnConflict(e, dto.mrn);
    }
  }

  // Partial update. Re-uses get() to produce a 404 when absent.
  async update(id: string, dto: UpdatePatientDto) {
    const { tenantId } = getTenant();
    await this.get(id);
    try {
      return await this.prisma.forTenant(tenantId, (tx) =>
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
    } catch (e) {
      // Renaming a chart onto an MRN another chart already holds is the same
      // collision arriving by a different route, and merges two people just as
      // effectively.
      throw this.translateMrnConflict(e, dto.mrn);
    }
  }

  /**
   * Turn the unique-index violation into an answer the front desk can act on.
   *
   * Left as a raw P2002 this surfaces as a 500, which reads as "the system is
   * broken" when the truth is "that MRN is taken" — and a receptionist who
   * believes the system is broken invents a new MRN, which is how duplicate
   * charts get created in the first place.
   */
  private translateMrnConflict(e: unknown, mrn?: string): unknown {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return e;

    // Do NOT require meta.target to name the column. Prisma reports this
    // violation as "Unique constraint failed on the (not available)" — target is
    // undefined — so an `includes('mrn')` guard silently never matched and every
    // duplicate still surfaced as a 500. Verified from the server log, after the
    // regression suite failed on exactly that.
    //
    // Patient carries one unique constraint, (tenantId, mrn), so any P2002 from
    // a patient write IS an MRN collision. If a second unique is ever added,
    // target should start being populated for both and this check tightens
    // rather than breaks: an unrecognised target is rethrown below.
    const target = (e.meta as { target?: string[] | string } | undefined)?.target;
    if (target != null && !String(target).includes('mrn')) return e;
    {
      return new ConflictException(
        `MRN ${mrn ?? ''} already belongs to another patient in this clinic. ` +
          `Open that record instead of creating a second one.`.trim(),
      );
    }
    return e;
  }
}