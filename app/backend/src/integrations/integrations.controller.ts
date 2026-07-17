import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { FRONT_DESK_ROLES, FINANCE_ROLES, CLINICAL_ROLES } from '../rbac/role-groups';
import { WhatsAppService } from './whatsapp/whatsapp.service';
import { FbrService } from './fbr/fbr.service';
import { TelehealthService } from './telehealth/telehealth.service';
import { SendWhatsAppDto } from './dto/send-whatsapp.dto';
import { CreateRoomDto } from './dto/create-room.dto';

@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('integrations.core')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly fbr: FbrService,
    private readonly telehealth: TelehealthService,
  ) {}

  /** Observability: which providers are live vs stub. Any authenticated user. */
  @Get('status')
  status() {
    return {
      whatsapp: { provider: 'meta-cloud', mode: this.whatsapp.mode() },
      fbr: { provider: 'fbr-digital-invoicing', mode: this.fbr.mode() },
      telehealth: { provider: 'livekit', mode: this.telehealth.mode() },
    };
  }

  @Post('whatsapp/messages')
  @Roles(...FRONT_DESK_ROLES)
  sendWhatsApp(@Body() dto: SendWhatsAppDto) {
    if (dto.template) {
      return this.whatsapp.sendTemplate({
        to: dto.to,
        template: dto.template,
        params: dto.params,
        languageCode: dto.languageCode,
      });
    }
    return this.whatsapp.sendText({ to: dto.to, body: dto.body! });
  }

  @Post('fbr/invoices/:invoiceId/submit')
  @Roles(...FINANCE_ROLES)
  submitToFbr(@Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.fbr.submitInvoice(invoiceId);
  }

  @Post('telehealth/rooms')
  @Roles(...CLINICAL_ROLES)
  createRoom(@Body() dto: CreateRoomDto) {
    return this.telehealth.createRoom(dto);
  }
}
