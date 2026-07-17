import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DosingService } from './dosing.service';
import { DoseDto } from './dto/dose.dto';
import { CommitDoseDto } from './dto/commit-dose.dto';

const PRESCRIBERS = [UserRole.OWNER, UserRole.ADMIN, UserRole.DOCTOR, UserRole.TREATMENT];

@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('dosing.core')
@Controller()
export class DosingController {
  constructor(private readonly dosing: DosingService) {}

  // Kept for the existing UI; same data as /dose/rules. Both read DoseRule
  // rows now, so a tenant's formulary edits show up in either.
  @Get('drugs')
  drugs() {
    return this.dosing.rules();
  }

  // DoseRule view for the prescriber UI: /dose/rules?drug=paracetamol
  @Get('dose/rules')
  rules(@Query('drug') drug?: string) {
    return this.dosing.rules(drug);
  }

  @Post('dose')
  @Roles(...PRESCRIBERS)
  calculate(@Body() dto: DoseDto) {
    return this.dosing.calculate(dto);
  }

  // Alias matching the spec API surface.
  @Post('dose/calculate')
  @Roles(...PRESCRIBERS)
  calculateAlias(@Body() dto: DoseDto) {
    return this.dosing.calculate(dto);
  }

  // Persist a confirmed calculation to the medico-legal log.
  @Post('dose/commit')
  @Roles(...PRESCRIBERS)
  commit(@Body() dto: CommitDoseDto) {
    return this.dosing.commit(dto);
  }

  // Dose a patient from their latest recorded weight: /patients/:id/dose?drug=amoxicillin
  @Get('patients/:patientId/dose')
  forPatient(
    @Param('patientId') patientId: string,
    @Query('drug') drug: string,
  ) {
    return this.dosing.forPatient(patientId, drug);
  }
  /** Orders produced by committed dose calculations. */
  @Get('patients/:patientId/prescriptions')
  prescriptions(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.dosing.listPrescriptions(patientId);
  }
}
