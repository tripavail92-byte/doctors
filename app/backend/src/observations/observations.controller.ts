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
}
