import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ObservationsService } from './observations.service';
import { RecordObservationDto } from './dto/record-observation.dto';
import { CreateTrendAnnotationDto } from './dto/create-trend-annotation.dto';

/**
 * Observations + trends API. No controller prefix — routes are namespaced by
 * resource (`/metrics`, `/observations`, `/patients/:id/...`).
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ObservationsController {
  constructor(private readonly obs: ObservationsService) {}

  @Get('metrics')
  metrics() {
    return this.obs.metrics();
  }

  @Post('observations')
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.DOCTOR,
    UserRole.TREATMENT,
    UserRole.RECEPTION,
  )
  record(@Body() dto: RecordObservationDto) {
    return this.obs.record(
      dto.patientId,
      dto.metric,
      dto.value,
      dto.unit,
      dto.note,
      dto.recordedAt,
      dto.side,
    );
  }

  @Get('patients/:patientId/observations')
  list(
    @Param('patientId') patientId: string,
    @Query('metric') metric?: string,
    @Query('side') side?: string,
  ) {
    return this.obs.list(patientId, metric, side);
  }

  @Get('patients/:patientId/trends')
  trends(@Param('patientId') patientId: string) {
    return this.obs.trendsAll(patientId);
  }

  @Get('patients/:patientId/trends/:metric')
  trend(
    @Param('patientId') patientId: string,
    @Param('metric') metric: string,
    @Query('side') side?: string,
  ) {
    return this.obs.trend(patientId, metric, side);
  }

  // --- Declarative trend charts ---

  @Get('trends/definitions')
  definitions(@Query('packKey') packKey?: string) {
    return this.obs.listDefinitions(packKey);
  }

  @Get('trends/:chartKey/patient/:patientId')
  chart(
    @Param('chartKey') chartKey: string,
    @Param('patientId') patientId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('laterality') laterality?: string,
  ) {
    return this.obs.chartForPatient(chartKey, patientId, { from, to, side: laterality });
  }

  @Get('trends/:chartKey/patient/:patientId/summary')
  chartSummary(
    @Param('chartKey') chartKey: string,
    @Param('patientId') patientId: string,
    @Query('laterality') laterality?: string,
  ) {
    return this.obs.chartSummary(chartKey, patientId, laterality);
  }

  // Pinning a note onto a chart is a clinical act (it explains a change in the
  // data), so it is restricted to clinicians, not front desk.
  @Post('trends/annotations')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DOCTOR, UserRole.TREATMENT)
  annotate(@Body() dto: CreateTrendAnnotationDto) {
    return this.obs.createAnnotation(dto);
  }
}
