import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CLINICAL_ROLES } from '../rbac/role-groups';
import { DentalService } from './dental.service';
import { RecordToothDto } from './dto/record-tooth.dto';
import { RecordFindingDto } from './dto/tooth-finding.dto';
import { RecordPerioExamDto } from './dto/record-perio-exam.dto';
import { CompleteToothPlanItemDto, CreateToothPlanItemDto } from './dto/tooth-plan.dto';
import { AddOrthoEventDto, CreateOrthoCaseDto } from './dto/ortho.dto';

@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('pack.dental')
@Roles(...CLINICAL_ROLES)
@Controller()
export class DentalController {
  constructor(private readonly dental: DentalService) {}

  // Odontogram
  @Get('teeth')
  reference() {
    return this.dental.reference();
  }

  @Post('odontogram/teeth')
  record(@Body() dto: RecordToothDto) {
    return this.dental.recordTooth(dto);
  }

  @Get('patients/:patientId/odontogram')
  odontogram(@Param('patientId') patientId: string) {
    return this.dental.odontogram(patientId);
  }

  // Periodontal charting
  @Post('perio-exams')
  recordPerio(@Body() dto: RecordPerioExamDto) {
    return this.dental.recordPerioExam(dto);
  }

  @Get('perio-exams/:id')
  getPerio(@Param('id', ParseUUIDPipe) id: string) {
    return this.dental.getPerioExam(id);
  }

  @Get('patients/:patientId/perio-exams')
  listPerio(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.dental.listPerioExams(patientId);
  }

  // Tooth-level plan -> billing
  @Post('dental/plan-items')
  createPlanItem(@Body() dto: CreateToothPlanItemDto) {
    return this.dental.createPlanItem(dto);
  }

  @Get('patients/:patientId/plan-items')
  listPlanItems(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.dental.listPlanItems(patientId);
  }

  @Patch('dental/plan-items/:id/complete')
  completePlanItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteToothPlanItemDto) {
    return this.dental.completePlanItem(id, dto);
  }

  // Orthodontics
  @Post('dental/ortho-cases')
  createOrthoCase(@Body() dto: CreateOrthoCaseDto) {
    return this.dental.createOrthoCase(dto);
  }

  @Post('dental/ortho-cases/:id/events')
  addOrthoEvent(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddOrthoEventDto) {
    return this.dental.addOrthoEvent(id, dto);
  }

  @Get('dental/ortho-cases/:id')
  getOrthoCase(@Param('id', ParseUUIDPipe) id: string) {
    return this.dental.getOrthoCase(id);
  }

  @Get('patients/:patientId/ortho-cases')
  listOrthoCases(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.dental.listOrthoCases(patientId);
  }
  // --- Append-only tooth findings -----------------------------------------

  /** Record a finding. Corrections supersede; nothing is ever overwritten. */
  @Post('tooth-findings')
  recordFinding(@Body() dto: RecordFindingDto) {
    return this.dental.recordFinding(dto);
  }

  /** The full chain, superseded rows included — the medico-legal history. */
  @Get('patients/:patientId/tooth-findings')
  listFindings(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('tooth') tooth?: string,
  ) {
    return this.dental.listFindings(patientId, tooth);
  }

  /** The chart projected from the chain: active tip per tooth + DMFT. */
  @Get('patients/:patientId/tooth-chart')
  chart(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.dental.chartFromFindings(patientId);
  }
}
