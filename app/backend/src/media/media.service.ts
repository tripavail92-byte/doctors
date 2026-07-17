import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConsentRecord, PhotoKind } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';
import { StorageService } from '../storage/storage.service';
import { ConsentService, isCurrent } from './consent.service';

/**
 * Clinical media (before/after photography).
 *
 * The invariant enforced here — not just in the schema — is that a PhotoSession
 * (and every upload into it) requires a granted, unexpired CLINICAL_PHOTOGRAPHY
 * consent. Bytes are written through the StorageService; only an opaque key is
 * stored on PhotoAsset.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consent: ConsentService,
    private readonly storage: StorageService,
  ) {}

  async createSession(
    patientId: string,
    kind: PhotoKind,
    consentId?: string,
    label?: string,
    area?: string,
    note?: string,
  ) {
    const consent = consentId
      ? await this.resolveExplicitConsent(consentId, patientId)
      : await this.consent.requireValid(patientId, 'CLINICAL_PHOTOGRAPHY');

    const { tenantId, userId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.photoSession.create({
        data: {
          tenantId: tenantId!,
          patientId,
          consentId: consent.id,
          kind,
          label: label ?? null,
          area: area ?? null,
          note: note ?? null,
          capturedById: userId ?? null,
        },
      }),
    );
  }

  async uploadPhoto(sessionId: string, imageBase64: string, contentTypeHint?: string) {
    const { tenantId } = getTenant();
    const session = await this.prisma.forTenant(tenantId, (tx) =>
      tx.photoSession.findUnique({ where: { id: sessionId }, include: { consent: true } }),
    );
    if (!session) throw new NotFoundException('Photo session not found');
    if (!isCurrent(session.consent)) {
      throw new ForbiddenException('Consent for this session is no longer valid');
    }

    const { buffer, contentType } = parseImage(imageBase64, contentTypeHint);
    if (buffer.length === 0) throw new BadRequestException('Empty image payload');
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image exceeds the 6 MB limit');
    }

    const stored = await this.storage.put(buffer);
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.photoAsset.create({
        data: {
          tenantId: tenantId!,
          sessionId,
          storageKey: stored.key,
          contentType,
          sizeBytes: stored.sizeBytes,
        },
      }),
    );
  }

  // Before/after gallery for a patient.
  listSessions(patientId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.photoSession.findMany({
        where: { patientId },
        include: { assets: true },
        orderBy: { capturedAt: 'desc' },
      }),
    );
  }

  async getSession(id: string) {
    const { tenantId } = getTenant();
    const s = await this.prisma.forTenant(tenantId, (tx) =>
      tx.photoSession.findUnique({ where: { id }, include: { assets: true, consent: true } }),
    );
    if (!s) throw new NotFoundException('Photo session not found');
    return s;
  }

  async readAsset(assetId: string) {
    const { tenantId } = getTenant();
    const asset = await this.prisma.forTenant(tenantId, (tx) =>
      tx.photoAsset.findUnique({ where: { id: assetId } }),
    );
    if (!asset) throw new NotFoundException('Photo not found');
    const buffer = await this.storage.readBuffer(asset.storageKey);
    return { asset, buffer };
  }

  private async resolveExplicitConsent(
    consentId: string,
    patientId: string,
  ): Promise<ConsentRecord> {
    const { tenantId } = getTenant();
    const consent = await this.prisma.forTenant(tenantId, (tx) =>
      tx.consentRecord.findUnique({ where: { id: consentId } }),
    );
    if (
      !consent ||
      consent.patientId !== patientId ||
      consent.scope !== 'CLINICAL_PHOTOGRAPHY' ||
      !isCurrent(consent)
    ) {
      throw new ForbiddenException('Provided consent is not valid for clinical photography');
    }
    return consent;
  }
}

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

// Sniff the real image type from magic bytes. Returns null for anything not a
// supported raster image (in particular SVG/HTML are rejected — they would
// otherwise execute as script when served inline).
function detectImageType(b: Buffer): string | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return 'image/png';
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return 'image/jpeg';
  }
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

// Parse base64 / a data: URL into bytes and a TRUSTED content type derived from
// the actual bytes (the client-declared type is only used to reject mismatches).
function parseImage(
  input: string,
  ctHint?: string,
): { buffer: Buffer; contentType: string } {
  let data = input.trim();
  let declared = (ctHint || '').toLowerCase();
  const m = /^data:([^;]+);base64,(.*)$/s.exec(data);
  if (m) {
    declared = m[1].toLowerCase();
    data = m[2];
  }
  const buffer = Buffer.from(data, 'base64');
  const detected = detectImageType(buffer);
  if (!detected) {
    throw new BadRequestException(
      'Unsupported image — only PNG, JPEG and WEBP are accepted',
    );
  }
  if (declared && declared !== detected) {
    throw new BadRequestException(
      `Declared type "${declared}" does not match the image bytes (${detected})`,
    );
  }
  return { buffer, contentType: detected };
}
