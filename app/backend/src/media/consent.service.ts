import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConsentMethod, ConsentRecord, ConsentScope } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';

/**
 * Consent as a reusable clinical component. Records granular, scoped consent
 * (photography, treatment, data-sharing, telehealth) and answers the question
 * other features ask: "does this patient have valid consent for X right now?"
 */
@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  record(
    patientId: string,
    scope: ConsentScope,
    granted: boolean,
    method: ConsentMethod,
    expiresAt?: string,
    note?: string,
  ) {
    const { tenantId, userId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.consentRecord.create({
        data: {
          tenantId: tenantId!,
          patientId,
          scope,
          granted,
          method,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          note: note ?? null,
          capturedById: userId ?? null,
        },
      }),
    );
  }

  list(patientId: string, scope?: ConsentScope) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.consentRecord.findMany({
        where: { patientId, ...(scope ? { scope } : {}) },
        orderBy: { grantedAt: 'desc' },
      }),
    );
  }

  // Latest granted, unexpired consent for a scope — or null.
  async findValid(patientId: string, scope: ConsentScope): Promise<ConsentRecord | null> {
    const { tenantId } = getTenant();
    const rows = await this.prisma.forTenant(tenantId, (tx) =>
      tx.consentRecord.findMany({
        where: { patientId, scope, granted: true },
        orderBy: { grantedAt: 'desc' },
      }),
    );
    return rows.find((r) => isCurrent(r)) ?? null;
  }

  async requireValid(patientId: string, scope: ConsentScope): Promise<ConsentRecord> {
    const consent = await this.findValid(patientId, scope);
    if (!consent) {
      throw new ForbiddenException(`No valid ${scope} consent on file for this patient`);
    }
    return consent;
  }
}

// A consent is current when granted and either non-expiring or not yet expired.
export function isCurrent(c: ConsentRecord): boolean {
  return c.granted && (!c.expiresAt || c.expiresAt.getTime() > Date.now());
}
