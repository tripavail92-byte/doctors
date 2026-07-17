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
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CLINICAL_ROLES } from '../rbac/role-groups';
import { LabService } from './lab.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { CollectOrderDto } from './dto/collect-order.dto';
import { AddResultDto } from './dto/add-result.dto';

@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('lab.core')
@Roles(...CLINICAL_ROLES)
@Controller('lab')
export class LabController {
  constructor(private readonly lab: LabService) {}

  @Get('tests')
  tests() {
    return this.lab.tests();
  }

  @Post('orders')
  create(@Body() dto: CreateLabOrderDto) {
    return this.lab.createOrder(dto);
  }

  @Get('patients/:patientId/orders')
  list(@Param('patientId') patientId: string) {
    return this.lab.list(patientId);
  }

  @Get('orders/:id')
  get(@Param('id') id: string) {
    return this.lab.get(id);
  }

  @Patch('orders/:id/collect')
  collect(@Param('id') id: string, @Body() dto: CollectOrderDto) {
    return this.lab.collect(id, dto.accessionNumber);
  }

  @Post('orders/:id/results')
  result(@Param('id') id: string, @Body() dto: AddResultDto) {
    return this.lab.addResult(id, dto);
  }

  @Patch('orders/:id/report')
  report(@Param('id') id: string) {
    return this.lab.report(id);
  }

  @Patch('orders/:id/cancel')
  cancel(@Param('id') id: string) {
    return this.lab.cancel(id);
  }
}
