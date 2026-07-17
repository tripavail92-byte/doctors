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
import { OphthalmologyService } from './ophthalmology.service';
import {
  AddIopDto,
  AddRefractionDto,
  AddSegmentFindingDto,
  AddVaDto,
  CreateEyeExamDto,
} from './dto/eye-exam.dto';
import { CreatePrescriptionDto } from './dto/prescription.dto';

@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('pack.ophthalmology')
@Roles(...CLINICAL_ROLES)
@Controller('ophthalmology')
export class OphthalmologyController {
  constructor(private readonly ophthalmology: OphthalmologyService) {}

  @Post('exams')
  createExam(@Body() dto: CreateEyeExamDto) {
    return this.ophthalmology.createExam(dto);
  }

  @Get('exams/:id')
  getExam(@Param('id', ParseUUIDPipe) id: string) {
    return this.ophthalmology.getExam(id);
  }

  @Get('patients/:patientId/exams')
  listExams(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.ophthalmology.listExams(patientId);
  }

  @Post('exams/:id/va')
  addVa(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddVaDto) {
    return this.ophthalmology.addVa(id, dto);
  }

  @Post('exams/:id/refraction')
  addRefraction(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddRefractionDto) {
    return this.ophthalmology.addRefraction(id, dto);
  }

  @Post('exams/:id/iop')
  addIop(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddIopDto) {
    return this.ophthalmology.addIop(id, dto);
  }

  @Post('exams/:id/segment-findings')
  addSegmentFinding(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddSegmentFindingDto) {
    return this.ophthalmology.addSegmentFinding(id, dto);
  }

  @Patch('exams/:id/sign')
  signExam(@Param('id', ParseUUIDPipe) id: string) {
    return this.ophthalmology.signExam(id);
  }

  @Post('prescriptions')
  createPrescription(@Body() dto: CreatePrescriptionDto) {
    return this.ophthalmology.createPrescription(dto);
  }
}
