import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CLINICAL_ROLES } from '../rbac/role-groups';
import { ImmunizationService } from './immunization.service';
import { RecordImmunizationDto } from './dto/record-immunization.dto';
import {
  DiscardBatchDto,
  MarkReportedDto,
  ReceiveBatchDto,
  ReportAefiDto,
  UpdateVvmDto,
} from './dto/cold-chain.dto';

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
  // --- Cold chain ---------------------------------------------------------

  @Post('vaccine-batches')
  receiveBatch(@Body() dto: ReceiveBatchDto) {
    return this.immunization.receiveBatch(dto);
  }

  @Get('vaccine-batches')
  listBatches(@Query('vaccine') vaccine?: string) {
    return this.immunization.listBatches(vaccine);
  }

  /** What to pull from the fridge now, and why. */
  @Get('vaccine-batches/alerts')
  alerts() {
    return this.immunization.coldChainAlerts();
  }

  @Patch('vaccine-batches/:id/vvm')
  updateVvm(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVvmDto) {
    return this.immunization.updateVvm(id, dto);
  }

  @Patch('vaccine-batches/:id/discard')
  discardBatch(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DiscardBatchDto) {
    return this.immunization.discardBatch(id, dto);
  }

  // --- AEFI ---------------------------------------------------------------

  @Post('aefi')
  reportAefi(@Body() dto: ReportAefiDto) {
    return this.immunization.reportAefi(dto);
  }

  @Get('aefi')
  listAefi(@Query('patientId') patientId?: string) {
    return this.immunization.listAefi(patientId);
  }

  /** Events grouped by lot — a bad batch is only visible as a cluster. */
  @Get('aefi/by-batch')
  aefiByBatch() {
    return this.immunization.aefiByBatch();
  }

  @Patch('aefi/:id/reported')
  markReported(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MarkReportedDto) {
    return this.immunization.markAefiReported(id, dto);
  }
}
