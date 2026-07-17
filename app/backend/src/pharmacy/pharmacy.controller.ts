import {
  Body,
  Controller,
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
import { Roles } from '../auth/decorators/roles.decorator';
import { PHARMACY_ROLES } from '../rbac/role-groups';
import { PharmacyService } from './pharmacy.service';
import { ReceiveStockDto } from './dto/receive-stock.dto';
import { DispenseDto } from './dto/dispense.dto';

@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('pharmacy.core')
@Roles(...PHARMACY_ROLES)
@Controller('pharmacy')
export class PharmacyController {
  constructor(private readonly pharmacy: PharmacyService) {}

  @Get('formulary')
  formulary() {
    return this.pharmacy.formulary();
  }

  @Post('stock')
  receive(@Body() dto: ReceiveStockDto) {
    return this.pharmacy.receiveStock(dto);
  }

  @Get('stock')
  stock(@Query('formularyCode') formularyCode?: string) {
    return this.pharmacy.stock(formularyCode);
  }

  @Post('dispense')
  dispense(@Body() dto: DispenseDto) {
    return this.pharmacy.dispense(dto);
  }

  @Get('dispense/:id')
  get(@Param('id') id: string) {
    return this.pharmacy.get(id);
  }

  @Get('patients/:patientId/dispenses')
  list(@Param('patientId') patientId: string) {
    return this.pharmacy.list(patientId);
  }
}
