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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CLINICAL_ROLES } from '../rbac/role-groups';
import { IpdService } from './ipd.service';
import { CreateWardDto } from './dto/create-ward.dto';
import { AdmitDto } from './dto/admit.dto';

@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('ipd.core')
@Roles(...CLINICAL_ROLES)
@Controller('ipd')
export class IpdController {
  constructor(private readonly ipd: IpdService) {}

  @Post('wards')
  createWard(@Body() dto: CreateWardDto) {
    return this.ipd.createWard(dto);
  }

  @Get('wards')
  wards() {
    return this.ipd.listWards();
  }

  @Get('beds')
  beds(@Query('status') status?: string) {
    return this.ipd.beds(status);
  }

  @Get('occupancy')
  occupancy() {
    return this.ipd.occupancy();
  }

  @Post('admissions')
  admit(@Body() dto: AdmitDto) {
    return this.ipd.admit(dto);
  }

  @Get('admissions')
  admissions(@Query('status') status?: string) {
    return this.ipd.listAdmissions(status);
  }

  @Patch('admissions/:id/discharge')
  discharge(@Param('id') id: string) {
    return this.ipd.discharge(id);
  }
}
