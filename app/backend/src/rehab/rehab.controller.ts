import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CLINICAL_ROLES } from '../rbac/role-groups';
import { RehabService } from './rehab.service';
import {
  AddExerciseDto,
  AddRomDto,
  AddSessionDto,
  CreateAssessmentDto,
  CreateEpisodeDto,
  DischargeDto,
} from './dto/rehab.dto';

@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('pack.physiotherapy')
@Roles(...CLINICAL_ROLES)
@Controller('rehab')
export class RehabController {
  constructor(private readonly rehab: RehabService) {}

  @Get('rom-reference')
  romReference() {
    return this.rehab.romReference();
  }

  @Post('episodes')
  createEpisode(@Body() dto: CreateEpisodeDto) {
    return this.rehab.createEpisode(dto);
  }

  @Get('patients/:patientId/episodes')
  listEpisodes(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.rehab.listEpisodes(patientId);
  }

  @Get('episodes/:id')
  getEpisode(@Param('id', ParseUUIDPipe) id: string) {
    return this.rehab.getEpisode(id);
  }

  @Post('episodes/:id/assessments')
  createAssessment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAssessmentDto) {
    return this.rehab.createAssessment(id, dto);
  }

  @Post('assessments/:id/rom')
  addRom(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddRomDto) {
    return this.rehab.addRom(id, dto);
  }

  @Post('episodes/:id/sessions')
  addSession(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddSessionDto) {
    return this.rehab.addSession(id, dto);
  }

  @Post('episodes/:id/exercises')
  addExercise(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddExerciseDto) {
    return this.rehab.addExercise(id, dto);
  }

  @Patch('episodes/:id/discharge')
  discharge(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DischargeDto) {
    return this.rehab.discharge(id, dto);
  }
}
