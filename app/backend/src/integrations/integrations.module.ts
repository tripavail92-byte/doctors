import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsController } from './integrations.controller';
import { WhatsAppService } from './whatsapp/whatsapp.service';
import { FbrService } from './fbr/fbr.service';
import { TelehealthService } from './telehealth/telehealth.service';

/**
 * Third-party integrations (WhatsApp / FBR e-invoicing / LiveKit telehealth).
 *
 * Each provider self-selects live vs stub mode from config at runtime.
 * AuthModule is imported for the JwtAuthGuard used by the controller and for
 * its exported JwtService — the telehealth signer overrides the secret
 * per-call to mint LiveKit grant tokens (independent of the app auth secret).
 */
@Module({
  imports: [AuthModule],
  controllers: [IntegrationsController],
  providers: [WhatsAppService, FbrService, TelehealthService],
  exports: [WhatsAppService, FbrService, TelehealthService],
})
export class IntegrationsModule {}
