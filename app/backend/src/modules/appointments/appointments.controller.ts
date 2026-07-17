import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { EntitlementGuard } from '../../auth/guards/entitlement.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequiresEntitlement } from '../../auth/decorators/requires-entitlement.decorator';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';

/**
 * Appointments CRUD. Requires the "appointments.schedule" entitlement
 * (the key seeded for the specialty edition).
 * Reads are open to any authenticated role; writes are restricted.
 */
@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('appointments.core')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  list() {
    return this.appointments.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.appointments.get(id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.RECEPTION, UserRole.DOCTOR)
  create(@Body() dto: CreateAppointmentDto) {
    return this.appointments.create(dto);
  }

  // Simple status transition endpoint (check-in / complete / cancel).
  @Patch(':id/status')
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.RECEPTION,
    UserRole.DOCTOR,
    UserRole.TREATMENT,
  )
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.appointments.updateStatus(id, dto.status);
  }
}