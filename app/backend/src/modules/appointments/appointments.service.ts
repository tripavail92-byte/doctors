import { Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenant } from '../../common/tenant/tenant-context';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

/**
 * Appointments domain service. All queries run through
 * prisma.forTenant(getTenant().tenantId, tx => ...) so Postgres RLS
 * scopes rows to the active tenant.
 */
@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // List appointments for the current tenant, soonest first.
  async list() {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.appointment.findMany({
        orderBy: { start: 'asc' },
        include: { patient: true },
      }),
    );
  }

  async get(id: string) {
    const { tenantId } = getTenant();
    const appointment = await this.prisma.forTenant(tenantId, (tx) =>
      tx.appointment.findUnique({ where: { id } }),
    );
    if (!appointment) {
      throw new NotFoundException(`Appointment ${id} not found`);
    }
    return appointment;
  }

  // Book a new appointment scoped to the current tenant.
  async create(dto: CreateAppointmentDto) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.appointment.create({
        data: {
          tenantId: tenantId!,
          patientId: dto.patientId,
          providerId: dto.providerId,
          start: new Date(dto.start),
          end: new Date(dto.end),
          service: dto.service,
          status: dto.status ?? AppointmentStatus.BOOKED,
        },
      }),
    );
  }

  // Update the workflow status (check-in, complete, cancel, ...).
  async updateStatus(id: string, status: AppointmentStatus) {
    const { tenantId } = getTenant();
    await this.get(id);
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.appointment.update({ where: { id }, data: { status } }),
    );
  }
}