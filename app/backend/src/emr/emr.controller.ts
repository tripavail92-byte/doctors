import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { EntitlementGuard } from '../entitlements/entitlement.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CLINICAL_ROLES } from '../rbac/role-groups';
import { EmrService } from './emr.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { UpdateEncounterStatusDto } from './dto/update-encounter-status.dto';
import { CreateIntakeSubmissionDto } from './dto/create-intake-submission.dto';
import { CreateNoteInstanceDto } from './dto/create-note-instance.dto';
import { CreateTreatmentPlanDto } from './dto/create-treatment-plan.dto';
import { UpdatePlanStatusDto } from './dto/update-plan-status.dto';

/**
 * EMR API — encounters and their filled artifacts. All endpoints are clinical
 * (they read/write PHI), so the whole controller is gated to clinical roles.
 */
@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@Roles(...CLINICAL_ROLES)
@RequiresEntitlement('emr.core')
@Controller()
export class EmrController {
  constructor(private readonly emr: EmrService) {}

  // --- Encounters --------------------------------------------------------
  @Post('encounters')
  createEncounter(@Body() dto: CreateEncounterDto) {
    return this.emr.createEncounter(dto);
  }

  @Get('patients/:patientId/encounters')
  encounters(@Param('patientId') patientId: string) {
    return this.emr.listEncounters(patientId);
  }

  @Get('encounters/:id')
  encounter(@Param('id') id: string) {
    return this.emr.getEncounter(id);
  }

  @Patch('encounters/:id/status')
  updateEncounter(@Param('id') id: string, @Body() dto: UpdateEncounterStatusDto) {
    return this.emr.updateEncounterStatus(id, dto.status);
  }

  // --- Intake ------------------------------------------------------------
  @Post('intake-submissions')
  createIntake(@Body() dto: CreateIntakeSubmissionDto) {
    return this.emr.createIntake(dto);
  }

  @Get('patients/:patientId/intake-submissions')
  intake(@Param('patientId') patientId: string) {
    return this.emr.listIntake(patientId);
  }

  // --- Notes -------------------------------------------------------------
  @Post('note-instances')
  createNote(@Body() dto: CreateNoteInstanceDto) {
    return this.emr.createNote(dto);
  }

  @Get('patients/:patientId/note-instances')
  notes(@Param('patientId') patientId: string) {
    return this.emr.listNotes(patientId);
  }

  // --- Treatment plans ---------------------------------------------------
  @Post('treatment-plans')
  createPlan(@Body() dto: CreateTreatmentPlanDto) {
    return this.emr.createPlan(dto);
  }

  @Get('patients/:patientId/treatment-plans')
  plans(@Param('patientId') patientId: string) {
    return this.emr.listPlans(patientId);
  }

  @Patch('treatment-plans/:id/status')
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanStatusDto) {
    return this.emr.updatePlanStatus(id, dto.status);
  }
}
