import { Prisma } from '@prisma/client';
import { PackManifest } from './manifest.types';
import { assertDefinitionSane } from '../observations/trend-aggregation';

export interface SeedCounts {
  services: number;
  notes: number;
  intake: number;
  orderSets: number;
  trendCharts: number;
}

/**
 * Expand a pack manifest into tenant-scoped rows.
 *
 * Idempotent: every row is upserted on its (tenant, natural-key) unique index,
 * so re-activating a pack (or bumping its version) refreshes the seeded data
 * without duplicating it. Natural keys are namespaced with the pack key so two
 * packs can both define, say, a "consult" note template for the same tenant.
 *
 * Accepts a Prisma transaction client (from PrismaService.forTenant) OR a
 * PrismaClient connected as the table OWNER (the seed script); PrismaClient is
 * structurally assignable to Prisma.TransactionClient.
 *
 * A bare PrismaClient on the RUNTIME role will not work: it never sets
 * `app.tenant_id`, and the tenant_isolation policies have no WITH CHECK, so
 * Postgres reuses their USING expression as the INSERT check and rejects every
 * upsert here. Only the owner (DIRECT_DATABASE_URL) may pass a raw client.
 */
export async function seedPackForTenant(
  tx: Prisma.TransactionClient,
  tenantId: string,
  manifest: PackManifest,
): Promise<SeedCounts> {
  for (const s of manifest.serviceCatalog) {
    const code = `${manifest.key}:${s.code}`;
    await tx.serviceCatalogItem.upsert({
      where: { tenantId_code: { tenantId, code } },
      update: {
        name: s.name,
        category: s.category,
        pricePkr: s.pricePkr,
        durationMin: s.durationMin ?? null,
        lateralizable: s.lateralizable ?? false,
        bilateralPricePkr: s.bilateralPricePkr ?? null,
      },
      create: {
        tenantId,
        packKey: manifest.key,
        code,
        name: s.name,
        category: s.category,
        pricePkr: s.pricePkr,
        durationMin: s.durationMin ?? null,
        lateralizable: s.lateralizable ?? false,
        bilateralPricePkr: s.bilateralPricePkr ?? null,
      },
    });
  }

  for (const t of manifest.noteTemplates) {
    const key = `${manifest.key}:${t.key}`;
    await tx.noteTemplate.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: {
        name: t.name,
        specialty: manifest.specialty,
        schema: t.sections as unknown as Prisma.InputJsonValue,
      },
      create: {
        tenantId,
        packKey: manifest.key,
        key,
        name: t.name,
        specialty: manifest.specialty,
        schema: t.sections as unknown as Prisma.InputJsonValue,
      },
    });
  }

  for (const g of manifest.intakeGroups) {
    const key = `${manifest.key}:${g.key}`;
    await tx.intakeFieldGroup.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: { name: g.name, fields: g.fields as unknown as Prisma.InputJsonValue },
      create: {
        tenantId,
        packKey: manifest.key,
        key,
        name: g.name,
        fields: g.fields as unknown as Prisma.InputJsonValue,
      },
    });
  }

  for (const o of manifest.orderSets) {
    const key = `${manifest.key}:${o.key}`;
    await tx.orderSet.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: { name: o.name, items: o.items as unknown as Prisma.InputJsonValue },
      create: {
        tenantId,
        packKey: manifest.key,
        key,
        name: o.name,
        items: o.items as unknown as Prisma.InputJsonValue,
      },
    });
  }

  const AGG: Record<string, 'RAW' | 'DAILY_MEAN' | 'LAST_PER_VISIT'> = {
    raw: 'RAW',
    dailyMean: 'DAILY_MEAN',
    lastPerVisit: 'LAST_PER_VISIT',
  };
  for (const c of manifest.trendCharts ?? []) {
    // Reject an incoherent chart definition at seed time (bands inverted or off
    // the axis, target out of range) rather than letting it render wrong later.
    assertDefinitionSane({ unit: c.unit, yMin: c.yMin, yMax: c.yMax, referenceBands: c.referenceBands, targetLines: c.targetLines });
    const key = `${manifest.key}:${c.key}`;
    // Tenant-overridable, exactly like NoteTemplate/OrderSet: a tenant edit to a
    // non-key field survives until the pack is re-activated (which re-upserts).
    const data = {
      title: c.title,
      observationCodes: c.observationCodes,
      unit: c.unit,
      splitByLaterality: c.splitByLaterality ?? false,
      yMin: c.yMin ?? null,
      yMax: c.yMax ?? null,
      referenceBands: (c.referenceBands ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      targetLines: (c.targetLines ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      aggregation: AGG[c.aggregation ?? 'raw'],
    };
    await tx.trendChartDefinition.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: data,
      create: { tenantId, packKey: manifest.key, key, ...data },
    });
  }

  return {
    services: manifest.serviceCatalog.length,
    notes: manifest.noteTemplates.length,
    intake: manifest.intakeGroups.length,
    orderSets: manifest.orderSets.length,
    trendCharts: (manifest.trendCharts ?? []).length,
  };
}
