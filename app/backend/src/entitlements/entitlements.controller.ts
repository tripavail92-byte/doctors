import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { getTenantId } from '../common/tenant/tenant-context';
import { EntitlementsService } from './entitlements.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  /** The editions catalog (edition -> bundled feature keys). Public to any auth user. */
  @Get('editions')
  editions() {
    return this.entitlements.editions();
  }

  /** The current tenant's enabled feature keys. */
  @Get('entitlements')
  async mine() {
    const features = await this.entitlements.enabledFeatures(getTenantId());
    return { features };
  }
}
