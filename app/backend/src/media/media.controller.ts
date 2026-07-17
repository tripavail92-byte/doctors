import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ConsentMethod,
  ConsentScope,
  PhotoKind,
  UserRole,
} from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ConsentService } from './consent.service';
import { MediaService } from './media.service';
import { RecordConsentDto } from './dto/record-consent.dto';
import { CreatePhotoSessionDto } from './dto/create-photo-session.dto';
import { UploadPhotoDto } from './dto/upload-photo.dto';

const CLINICAL = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.DOCTOR,
  UserRole.TREATMENT,
  UserRole.RECEPTION,
];

// Clinical roles for the whole controller — reads expose PHI (before/after
// photos, consent), so they are gated to the same roles as the writes.
@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('media.core')
@Roles(...CLINICAL)
@Controller()
export class MediaController {
  constructor(
    private readonly consent: ConsentService,
    private readonly media: MediaService,
  ) {}

  // ---- Consent ----------------------------------------------------------
  @Post('consent')
  @Roles(...CLINICAL)
  recordConsent(@Body() dto: RecordConsentDto) {
    return this.consent.record(
      dto.patientId,
      dto.scope as ConsentScope,
      dto.granted ?? true,
      (dto.method ?? 'WRITTEN') as ConsentMethod,
      dto.expiresAt,
      dto.note,
    );
  }

  @Get('patients/:patientId/consent')
  listConsent(
    @Param('patientId') patientId: string,
    @Query('scope') scope?: string,
  ) {
    return this.consent.list(patientId, scope as ConsentScope | undefined);
  }

  // ---- Photo sessions (before/after) ------------------------------------
  @Post('photo-sessions')
  @Roles(...CLINICAL)
  createSession(@Body() dto: CreatePhotoSessionDto) {
    return this.media.createSession(
      dto.patientId,
      dto.kind as PhotoKind,
      dto.consentId,
      dto.label,
      dto.area,
      dto.note,
    );
  }

  @Get('patients/:patientId/photo-sessions')
  gallery(@Param('patientId') patientId: string) {
    return this.media.listSessions(patientId);
  }

  @Get('photo-sessions/:id')
  session(@Param('id') id: string) {
    return this.media.getSession(id);
  }

  @Post('photo-sessions/:id/photos')
  @Roles(...CLINICAL)
  upload(@Param('id') id: string, @Body() dto: UploadPhotoDto) {
    return this.media.uploadPhoto(id, dto.imageBase64, dto.contentType);
  }

  // Raw image bytes. (Production would issue a short-lived presigned URL
  // instead of streaming through the API.)
  @Get('photos/:assetId/raw')
  async raw(@Param('assetId') assetId: string, @Res() res: Response) {
    const { asset, buffer } = await this.media.readAsset(assetId);
    // contentType is a byte-verified raster type (png/jpeg/webp); still send
    // nosniff + attachment so nothing is ever interpreted as inline HTML/SVG.
    res.setHeader('Content-Type', asset.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'attachment; filename="photo"');
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  }
}
