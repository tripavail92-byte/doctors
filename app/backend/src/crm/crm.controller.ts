import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CrmService } from './crm.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LogActivityDto } from './dto/log-activity.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('crm.core')
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.SALES, UserRole.RECEPTION)
@Controller('crm')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Post('leads')
  createLead(@Body() dto: CreateLeadDto) {
    return this.crm.createLead(dto);
  }

  @Get('leads')
  leads(@Query('status') status?: string) {
    return this.crm.listLeads(status);
  }

  @Get('funnel')
  funnel() {
    return this.crm.funnel();
  }

  @Get('followups')
  followups() {
    return this.crm.pendingFollowups();
  }

  @Get('leads/:id')
  lead(@Param('id') id: string) {
    return this.crm.getLead(id);
  }

  @Patch('leads/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateLeadStatusDto) {
    return this.crm.updateStatus(id, dto.status);
  }

  @Post('leads/:id/activities')
  logActivity(@Param('id') id: string, @Body() dto: LogActivityDto) {
    return this.crm.logActivity(id, dto);
  }

  @Patch('leads/:id/activities/:activityId/done')
  markDone(@Param('id') id: string, @Param('activityId') activityId: string) {
    return this.crm.markActivityDone(id, activityId);
  }

  @Post('leads/:id/convert')
  convert(@Param('id') id: string) {
    return this.crm.convert(id);
  }
}
