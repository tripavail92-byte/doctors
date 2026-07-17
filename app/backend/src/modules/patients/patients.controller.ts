import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { EntitlementGuard } from '../../auth/guards/entitlement.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequiresEntitlement } from '../../auth/decorators/requires-entitlement.decorator';
import { UserRole } from '@prisma/client';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

/**
 * Patients CRUD.
 *
 * Guard order matters: JwtAuthGuard authenticates and sets the request user,
 * RolesGuard checks @Roles, EntitlementGuard checks @RequiresEntitlement.
 * The whole controller requires the "patients.core" entitlement.
 */
@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('patients.core')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  // Read is available to any authenticated role with the entitlement.
  @Get()
  list() {
    return this.patients.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.patients.get(id);
  }

  // Writes are limited to front-desk / clinical roles.
  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.RECEPTION, UserRole.DOCTOR)
  create(@Body() dto: CreatePatientDto) {
    return this.patients.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.RECEPTION, UserRole.DOCTOR)
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patients.update(id, dto);
  }
}