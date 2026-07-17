import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CLINICAL_ROLES, PRESCRIBER_ROLES } from '../rbac/role-groups';
import { EntitlementGuard } from '../entitlements/entitlement.guard';
import { RequiresEntitlement } from '../entitlements/requires-entitlement.decorator';
import { DermatologyService } from './dermatology.service';
import {
  CreateCourseDto,
  CreateLesionDto,
  GradeDto,
  RecordSessionDto,
  UpdateCourseStatusDto,
} from './dto/dermatology.dto';

@Controller('dermatology')
@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('pack.dermatology')
export class DermatologyController {
  constructor(private readonly derma: DermatologyService) {}

  /** Region/sign metadata so the grading widget renders from config. */
  @Get('instruments')
  instruments() {
    return this.derma.instrumentCatalog();
  }

  @Post('grades')
  @Roles(...CLINICAL_ROLES)
  grade(@Body() dto: GradeDto) {
    return this.derma.grade(dto);
  }

  @Get('patients/:patientId/grades')
  listGrades(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('instrument') instrument?: string,
  ) {
    return this.derma.listGrades(patientId, instrument);
  }

  @Post('phototherapy/courses')
  @Roles(...PRESCRIBER_ROLES)
  createCourse(@Body() dto: CreateCourseDto) {
    return this.derma.createCourse(dto);
  }

  @Get('phototherapy/courses/:id')
  getCourse(@Param('id', ParseUUIDPipe) id: string) {
    return this.derma.getCourse(id);
  }

  @Get('patients/:patientId/phototherapy/courses')
  listCourses(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.derma.listCourses(patientId);
  }

  /** Pre-fills the ledger's dose field, with the engine's rationale. */
  @Get('phototherapy/courses/:id/next-dose')
  nextDose(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('lastErythemaGrade') grade?: string,
  ) {
    // Number.isFinite alone let 2.5 and -1 through to the engine, where they
    // missed every === comparison and fell into the escalate branch: a WORSE
    // reaction than grade 2 previewed a HIGHER dose than grade 2.
    if (grade == null || grade === '') return this.derma.previewNextDose(id, undefined);
    const parsed = Number(grade);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 3) {
      throw new BadRequestException(`lastErythemaGrade must be an integer 0-3 (got "${grade}")`);
    }
    return this.derma.previewNextDose(id, parsed);
  }

  // PRESCRIBER, not CLINICAL: this route can override the burn interlock and
  // set the delivered dose. A receptionist must not be able to POST
  // {lastErythemaGrade: 3, overrideBurnHold: true} and put a full-ceiling dose
  // onto blistered skin — the engine's own rationale says "notify prescriber".
  @Post('phototherapy/courses/:id/sessions')
  @Roles(...PRESCRIBER_ROLES)
  recordSession(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordSessionDto) {
    return this.derma.recordSession(id, dto);
  }

  @Patch('phototherapy/courses/:id/status')
  @Roles(...PRESCRIBER_ROLES)
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCourseStatusDto) {
    return this.derma.updateCourseStatus(id, dto);
  }

  @Post('lesions')
  @Roles(...CLINICAL_ROLES)
  createLesion(@Body() dto: CreateLesionDto) {
    return this.derma.createLesion(dto);
  }

  @Get('patients/:patientId/lesions')
  listLesions(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.derma.listLesions(patientId);
  }
}
