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
import { ImagingService } from './imaging.service';
import { CreateImagingOrderDto } from './dto/create-imaging-order.dto';
import { AcquireDto } from './dto/acquire.dto';
import { AddImagingReportDto } from './dto/add-imaging-report.dto';
import { AmendImagingReportDto } from './dto/amend-imaging-report.dto';
import { RecordCommunicationDto } from './dto/record-communication.dto';

@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('imaging.core')
@Controller('imaging')
@Roles(...CLINICAL_ROLES)
export class ImagingController {
  constructor(private readonly imaging: ImagingService) {}

  @Get('studies')
  studies() {
    return this.imaging.studies();
  }

  @Post('orders')
  createOrder(@Body() dto: CreateImagingOrderDto) {
    return this.imaging.createOrder(dto);
  }

  @Get('patients/:patientId/orders')
  list(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.imaging.list(patientId);
  }

  @Get('orders/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.imaging.get(id);
  }

  @Patch('orders/:id/acquire')
  acquire(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AcquireDto) {
    return this.imaging.acquire(id, dto.accessionNumber);
  }

  @Post('orders/:id/reports')
  addReport(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddImagingReportDto) {
    return this.imaging.addReport(id, dto);
  }

  // Amend a finalized report. The original is preserved; this creates a new
  // version that supersedes it.
  @Post('reports/:reportId/amend')
  amend(@Param('reportId') reportId: string, @Body() dto: AmendImagingReportDto) {
    return this.imaging.amendReport(reportId, dto);
  }

  // Record that a report was communicated to the referring clinician.
  @Post('reports/:reportId/communications')
  recordCommunication(@Param('reportId') reportId: string, @Body() dto: RecordCommunicationDto) {
    return this.imaging.recordCommunication(reportId, dto);
  }

  @Patch('orders/:id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.imaging.cancel(id);
  }
}
