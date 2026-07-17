import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { GrowthService } from './growth.service';
import { GrowthIndicator } from './growth-engine';
import { Sex } from './who-lms';
import { ZscoreDto } from './dto/zscore.dto';

@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('growth.core')
@Controller()
export class GrowthController {
  constructor(private readonly growth: GrowthService) {}

  // Stateless z-score calculation.
  @Post('growth/zscore')
  zscore(@Body() dto: ZscoreDto) {
    return this.growth.zscore(dto);
  }

  // Reference z-line curves for plotting: /growth/curves?indicator=wfa&sex=male
  @Get('growth/curves')
  curves(
    @Query('indicator', new DefaultValuePipe('wfa')) indicator: GrowthIndicator,
    @Query('sex', new DefaultValuePipe('male')) sex: Sex,
  ) {
    return this.growth.curves(sex, indicator);
  }

  // A patient's growth series (defaults to weight-for-age).
  @Get('patients/:patientId/growth')
  series(
    @Param('patientId') patientId: string,
    @Query('indicator', new DefaultValuePipe('wfa')) indicator: GrowthIndicator,
  ) {
    return this.growth.growthSeries(patientId, indicator);
  }
}
