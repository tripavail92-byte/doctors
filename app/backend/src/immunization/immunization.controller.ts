import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CLINICAL_ROLES } from '../rbac/role-groups';
import { ImmunizationService } from './immunization.service';
import { RecordImmunizationDto } from './dto/record-immunization.dto';

@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('immunization.core')
@Roles(...CLINICAL_ROLES)
@Controller()
export class ImmunizationController {
  constructor(private readonly immunization: ImmunizationService) {}

  @Get('vaccines')
  vaccines() {
    return this.immunization.vaccines();
  }

  @Post('immunizations')
  record(@Body() dto: RecordImmunizationDto) {
    return this.immunization.record(dto);
  }

  @Get('patients/:patientId/immunizations')
  list(@Param('patientId') patientId: string) {
    return this.immunization.list(patientId);
  }

  @Get('patients/:patientId/immunization-schedule')
  schedule(@Param('patientId') patientId: string) {
    return this.immunization.schedule(patientId);
  }
}
