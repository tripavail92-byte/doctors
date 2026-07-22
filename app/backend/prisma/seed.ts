// Prisma seed for Health OS — WAVE 0 starter.
// Creates a Specialty-edition tenant "Glow Derma" with an OWNER user,
// Plans + Features + PlanFeatures for the Specialty edition, a Subscription,
// TenantEntitlement rows enabling the specialty modules, and realistic
// Pakistani mock clinical data (patients, appointments, an invoice).
//
// Run with:  npx prisma db seed   (after migrate + rls.sql)
//
// The seed connects as the table OWNER (DIRECT_DATABASE_URL), not the runtime
// role. It writes tenant rows without ever setting `app.tenant_id`, and the
// tenant_isolation policies specify USING with no WITH CHECK — so Postgres
// reuses the USING expression as the INSERT check and REJECTS every write
// ("new row violates row-level security policy"). Bootstrapping the first
// tenant is inherently a pre-tenant operation, so it runs as the owner rather
// than contorting the seed into per-tenant transactions.

import { PrismaClient, Edition, UserRole, TenantStatus, SubscriptionStatus, AppointmentStatus, InvoiceStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { BUILTIN_MANIFESTS } from '../src/packs/manifests';
import { BUILTIN_INSTRUMENTS } from '../src/instruments/builtin-instruments';
import { seedPackForTenant } from '../src/packs/pack-seeding';
import { BUILTIN_DOSE_RULES } from '../src/dosing/dose-rule.seed';

// Owner connection — see the note above on why the runtime role cannot seed.
const seedUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url: seedUrl } } });

/** The development literal. Published in a public repo, so it is a demo aid only. */
const DEV_SEED_PASSWORD = 'Password123!';

/**
 * The password given to the seeded accounts.
 *
 * This seed creates `owner@glowderma.pk` AND `admin@summitsystems.pk`, and the
 * second is a PLATFORM_ADMIN — cross-tenant, authors and publishes packs. Both
 * used to get the literal above, which lives in a public GitHub repository. Any
 * deployment that ran the seed therefore accepted a published password for its
 * most privileged account, and nothing in the deploy said so.
 *
 * So: outside development the password must be supplied, and there is no
 * fallback. Failing the seed is recoverable in a way that a silently
 * world-known platform admin is not.
 */
function seedPassword(): string {
  const supplied = process.env.SEED_PASSWORD;
  const isProd = process.env.NODE_ENV === 'production';

  if (supplied && supplied.length >= 12) return supplied;

  if (supplied && supplied.length < 12) {
    throw new Error(
      `SEED_PASSWORD is ${supplied.length} characters. It protects a PLATFORM_ADMIN ` +
        'account; use at least 12.',
    );
  }

  if (isProd) {
    throw new Error(
      'SEED_PASSWORD is required when NODE_ENV=production. This seed creates ' +
        'admin@summitsystems.pk as a PLATFORM_ADMIN, and the development default is ' +
        'published in a public repository — seeding with it would hand that account ' +
        'to anyone who can read the source. Set SEED_PASSWORD and run again; nothing ' +
        'has been written.',
    );
  }

  console.warn(
    '[seed] SEED_PASSWORD not set — using the development default. ' +
      'This is published in a public repo. Never use it on a reachable host.',
  );
  return DEV_SEED_PASSWORD;
}

// The canonical feature + editions catalog (editions = entitlement bundles).
import { FEATURES, EDITION_FEATURES, ALL_FEATURE_KEYS } from '../src/entitlements/editions';

async function main() {
  // Resolve the password BEFORE the first write.
  //
  // This was originally read where the owner user is created, ten upserts in.
  // Under NODE_ENV=production with no SEED_PASSWORD it therefore created the
  // tenant and the facility and only then threw, leaving a half-seeded database
  // that the next run would have to reconcile. A guard that refuses after doing
  // part of the work has not refused.
  const passwordHash = await bcrypt.hash(seedPassword(), 10);

  // --- Tenant -------------------------------------------------------------
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'glow-derma' },
    update: {},
    create: {
      name: 'Glow Derma',
      slug: 'glow-derma',
      edition: Edition.SPECIALTY,
      status: TenantStatus.ACTIVE,
    },
  });

  // --- Facility (idempotent) ---------------------------------------------
  const facility =
    (await prisma.facility.findFirst({ where: { tenantId: tenant.id } })) ??
    (await prisma.facility.create({
      data: {
        tenantId: tenant.id,
        name: 'Glow Derma — Gulberg',
        city: 'Lahore',
      },
    }));

  // --- Owner user ---------------------------------------------------------
  // passwordHash is resolved at the top of main(), before any write.
  const owner = await prisma.user.upsert({
    where: { email: 'owner@glowderma.pk' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'owner@glowderma.pk',
      passwordHash,
      name: 'Dr. Ayesha Khan',
      role: UserRole.OWNER,
    },
  });

  // --- Platform administrator (cross-tenant; authors & publishes packs) ---
  await prisma.user.upsert({
    where: { email: 'admin@summitsystems.pk' },
    update: { role: UserRole.PLATFORM_ADMIN, isPlatformAdmin: true },
    create: {
      tenantId: null,
      email: 'admin@summitsystems.pk',
      passwordHash,
      name: 'Platform Admin',
      role: UserRole.PLATFORM_ADMIN,
      isPlatformAdmin: true,
    },
  });

  // --- Feature catalog (full) --------------------------------------------
  const featureByKey = new Map<string, { id: string }>();
  for (const f of FEATURES) {
    const feature = await prisma.feature.upsert({
      where: { key: f.key },
      update: { name: f.name, category: f.category },
      create: { key: f.key, name: f.name, category: f.category },
    });
    featureByKey.set(f.key, feature);
  }

  // --- A Plan per edition + its PlanFeatures (editions = bundles) ---------
  const editionPrice: Record<string, { pkr: number; usd: number }> = {
    SOLO: { pkr: 9000, usd: 32 },
    CLINIC: { pkr: 20000, usd: 70 },
    SPECIALTY: { pkr: 45000, usd: 160 },
    LAB: { pkr: 35000, usd: 125 },
    PHARMACY: { pkr: 30000, usd: 105 },
    HOSPITAL: { pkr: 120000, usd: 425 },
    ENTERPRISE: { pkr: 250000, usd: 900 },
  };
  let specialtyPlanId = '';
  for (const [edition, keys] of Object.entries(EDITION_FEATURES)) {
    const price = editionPrice[edition] ?? { pkr: 0, usd: 0 };
    const plan = await prisma.plan.upsert({
      where: { key: `${edition.toLowerCase()}-monthly` },
      update: { pricePkr: price.pkr, priceUsd: price.usd },
      create: {
        key: `${edition.toLowerCase()}-monthly`,
        name: `${edition.charAt(0) + edition.slice(1).toLowerCase()} (Monthly)`,
        edition: edition as Edition,
        pricePkr: price.pkr,
        priceUsd: price.usd,
      },
    });
    if (edition === 'SPECIALTY') specialtyPlanId = plan.id;
    for (const key of keys) {
      const feature = featureByKey.get(key);
      if (!feature) continue;
      await prisma.planFeature.upsert({
        where: { planId_featureId: { planId: plan.id, featureId: feature.id } },
        update: {},
        create: { planId: plan.id, featureId: feature.id },
      });
    }
  }

  // --- Subscription (Glow Derma is on Specialty) -------------------------
  if ((await prisma.subscription.count({ where: { tenantId: tenant.id } })) === 0) {
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: specialtyPlanId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
      },
    });
  }

  // --- TenantEntitlement rows -------------------------------------------
  // The demo tenant gets EVERY feature enabled so all module demos work; a
  // real tenant would receive only its edition's bundle (EDITION_FEATURES).
  for (const key of ALL_FEATURE_KEYS) {
    await prisma.tenantEntitlement.upsert({
      where: { tenantId_featureKey: { tenantId: tenant.id, featureKey: key } },
      update: { enabled: true },
      create: { tenantId: tenant.id, featureKey: key, enabled: true },
    });
  }

  // --- Dose rules ---------------------------------------------------------
  // Starter regimens only — see dose-rule.seed.ts. Upserted so a tenant's own
  // edits to a builtin rule are refreshed on reseed but never duplicated.
  for (const r of BUILTIN_DOSE_RULES) {
    await prisma.doseRule.upsert({
      where: { tenantId_drugKey_route: { tenantId: tenant.id, drugKey: r.drugKey, route: r.route } },
      update: { ...r, concentrations: r.concentrations as unknown as Prisma.InputJsonValue },
      create: {
        tenantId: tenant.id,
        ...r,
        concentrations: r.concentrations as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // --- Specialty packs ----------------------------------------------------
  // Register the shared scored-instrument library (global reference data).
  for (const def of BUILTIN_INSTRUMENTS) {
    await prisma.instrumentDefinition.upsert({
      where: { key: def.key },
      update: { name: def.name, specialty: def.specialty ?? null, version: def.version, definition: def as unknown as Prisma.InputJsonValue },
      create: { key: def.key, name: def.name, specialty: def.specialty ?? null, version: def.version, definition: def as unknown as Prisma.InputJsonValue },
    });
  }

  // Register every built-in pack into the catalog, then activate the two the
  // demo clinic runs on (aesthetic flagship + dermatology) — expanding each
  // manifest into tenant-scoped catalog / templates / intake / order sets.
  const ACTIVATE = new Set(['aesthetic', 'dermatology']);
  for (const m of BUILTIN_MANIFESTS) {
    const pack = await prisma.pack.upsert({
      where: { key: m.key },
      update: { name: m.name, specialty: m.specialty, tier: m.tier, description: m.description, latestVersion: m.version },
      create: { key: m.key, name: m.name, specialty: m.specialty, tier: m.tier, description: m.description, latestVersion: m.version },
    });
    const version = await prisma.packVersion.upsert({
      where: { packId_version: { packId: pack.id, version: m.version } },
      update: { manifest: m as unknown as Prisma.InputJsonValue },
      create: { packId: pack.id, version: m.version, manifest: m as unknown as Prisma.InputJsonValue },
    });
    if (ACTIVATE.has(m.key)) {
      await prisma.packActivation.upsert({
        where: { tenantId_packId: { tenantId: tenant.id, packId: pack.id } },
        update: { status: 'ACTIVE', packVersionId: version.id },
        create: { tenantId: tenant.id, packId: pack.id, packVersionId: version.id, status: 'ACTIVE' },
      });
      await seedPackForTenant(prisma, tenant.id, m);
    }
  }

  // --- Patients / appointments / invoice (idempotent demo data) ----------
  if ((await prisma.patient.count({ where: { tenantId: tenant.id } })) === 0) {
  const patientsData = [
    { mrn: 'GD-0001', name: 'Fatima Malik', phone: '+92 300 1234567', gender: 'female', dob: new Date('1990-04-12') },
    { mrn: 'GD-0002', name: 'Bilal Ahmed', phone: '+92 321 7654321', gender: 'male', dob: new Date('1985-11-03') },
    { mrn: 'GD-0003', name: 'Sana Riaz', phone: '+92 333 5551234', gender: 'female', dob: new Date('1996-07-25') },
    { mrn: 'GD-0004', name: 'Usman Tariq', phone: '+92 345 9876543', gender: 'male', dob: new Date('1978-01-19') },
  ];
  const patients = [];
  for (const p of patientsData) {
    const patient = await prisma.patient.create({ data: { tenantId: tenant.id, ...p } });
    patients.push(patient);
  }

  // --- Appointments -------------------------------------------------------
  const day = new Date();
  day.setHours(10, 0, 0, 0);
  const apptEnd1 = new Date(day.getTime() + 30 * 60 * 1000);
  await prisma.appointment.create({
    data: {
      tenantId: tenant.id,
      patientId: patients[0].id,
      providerId: owner.id,
      start: day,
      end: apptEnd1,
      status: AppointmentStatus.CONFIRMED,
      service: 'Hydrafacial',
    },
  });

  const day2 = new Date(day.getTime() + 60 * 60 * 1000);
  const apptEnd2 = new Date(day2.getTime() + 45 * 60 * 1000);
  await prisma.appointment.create({
    data: {
      tenantId: tenant.id,
      patientId: patients[1].id,
      providerId: owner.id,
      start: day2,
      end: apptEnd2,
      status: AppointmentStatus.BOOKED,
      service: 'Laser Hair Removal',
    },
  });

  // --- Invoice ------------------------------------------------------------
  await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      patientId: patients[0].id,
      number: 'INV-2026-0001',
      total: 15000,
      paid: 0,
      status: InvoiceStatus.UNPAID,
    },
  });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded tenant ${tenant.slug} (${tenant.id}) with facility ${facility.name}.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });