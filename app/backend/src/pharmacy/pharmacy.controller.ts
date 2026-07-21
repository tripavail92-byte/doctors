import {
  BadRequestException,
  Body,
  Req,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
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
  dispense(@Req() req: Request, @Body() dto: DispenseDto) {
    // Read quantities from the PRE-TRANSFORM body.
    //
    // The global ValidationPipe runs with enableImplicitConversion, so
    // `"quantity": true` becomes Number(true) === 1 BEFORE @IsInt() ever sees
    // it. By the time the DTO is validated a coerced boolean is indistinguishable
    // from an honest 1, and a real drug leaves the shelf against a nonsense
    // request. Verified: quantity true dispensed 1 tablet, PKR 5, receipt and
    // stock decrement included.
    //
    // Same defect and same remedy as the dermatology erythema grade — see
    // dermatology.controller.ts. A @Transform on the DTO does NOT work, because
    // coercion happens first.
    const rawItems = (req.body as { items?: unknown } | undefined)?.items;
    if (Array.isArray(rawItems)) {
      for (const it of rawItems) {
        const q = (it as { quantity?: unknown } | null)?.quantity;
        if (typeof q === 'boolean' || (typeof q === 'string' && q.trim() === '')) {
          throw new BadRequestException(
            'Each item quantity must be a whole number of units. ' +
              'A true/false or blank quantity is not a quantity.',
          );
        }
      }
    }
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
