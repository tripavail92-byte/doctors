import { Edition } from '@prisma/client';

// ---------------------------------------------------------------------------
// Editions = entitlement bundles.
//
// The plan's core commercial thesis: one modular platform sold in editions,
// where an edition is a named BUNDLE of feature keys. A tenant's enabled
// features (TenantEntitlement rows) are what actually gate module access via
// @RequiresEntitlement + EntitlementGuard. This file is the single source of
// truth for the catalog; the seed materializes it into Plan/Feature/
// PlanFeature/TenantEntitlement rows.
// ---------------------------------------------------------------------------

export interface FeatureDef {
  key: string;
  name: string;
  category: 'core' | 'clinical' | 'pack' | 'edition-module' | 'platform';
}

// The full feature catalog. `key` is the string used in @RequiresEntitlement.
export const FEATURES: FeatureDef[] = [
  // Core (every edition)
  { key: 'patients.core', name: 'Patient records', category: 'core' },
  { key: 'appointments.core', name: 'Appointments', category: 'core' },
  { key: 'emr.core', name: 'Encounters & notes (EMR)', category: 'core' },
  { key: 'billing.core', name: 'Billing & invoicing', category: 'core' },
  { key: 'catalog.core', name: 'Service catalog', category: 'core' },
  { key: 'observations.core', name: 'Observations & trends', category: 'core' },
  { key: 'instruments.core', name: 'Scored instruments', category: 'core' },
  // Clinic add-ons
  { key: 'reporting.core', name: 'Reporting & analytics', category: 'platform' },
  { key: 'crm.core', name: 'CRM / marketing', category: 'platform' },
  { key: 'media.core', name: 'Clinical photos & consent', category: 'clinical' },
  { key: 'growth.core', name: 'Growth charts (WHO-LMS)', category: 'clinical' },
  { key: 'dosing.core', name: 'Weight-based dosing', category: 'clinical' },
  { key: 'immunization.core', name: 'Immunization / EPI', category: 'clinical' },
  { key: 'packs.core', name: 'Specialty pack activation', category: 'clinical' },
  { key: 'integrations.core', name: 'Integrations (WhatsApp/FBR/Telehealth)', category: 'platform' },
  // Specialty packs
  { key: 'pack.aesthetic', name: 'Aesthetic pack', category: 'pack' },
  { key: 'pack.dermatology', name: 'Dermatology pack', category: 'pack' },
  { key: 'pack.dental', name: 'Dental & orthodontics pack', category: 'pack' },
  { key: 'pack.obgyn', name: 'Obstetrics & gynaecology pack', category: 'pack' },
  { key: 'pack.pediatrics', name: 'Pediatrics pack', category: 'pack' },
  { key: 'pack.ophthalmology', name: 'Ophthalmology pack', category: 'pack' },
  { key: 'pack.physiotherapy', name: 'Physiotherapy pack', category: 'pack' },
  // Non-specialty editions / modules
  { key: 'lab.core', name: 'Laboratory (LIS)', category: 'edition-module' },
  { key: 'imaging.core', name: 'Imaging / RIS', category: 'edition-module' },
  { key: 'pharmacy.core', name: 'Pharmacy / POS', category: 'edition-module' },
  { key: 'ipd.core', name: 'Hospital / IPD', category: 'edition-module' },
  { key: 'hr.core', name: 'HR / Payroll', category: 'platform' },
  // Multi-branch: entitlement to run more than one branch under one clinic.
  // The org-hierarchy endpoint (POST /org/hierarchy/branches) was ungated,
  // which shipped multi-branch to every edition free of charge. It now gates
  // on this key, which is included in CLINIC_ADDONS below so every real
  // operational edition carries it, and can be revoked per-tenant.
  { key: 'multibranch.core', name: 'Multi-branch', category: 'platform' },
];

const CORE = [
  'patients.core',
  'appointments.core',
  'emr.core',
  'billing.core',
  'catalog.core',
  'observations.core',
  'instruments.core',
];

// CLINIC and every specialty edition are multi-staff by definition — the whole
// point of the tier is that "clinic" means more than one person. So hr.core
// (staff, salaries, payroll) belongs in the shared bundle rather than only in
// HOSPITAL / ENTERPRISE, which is where it lived when the current derma-clinic
// customer discovered payroll was invisible to them despite paying for it.
// SOLO is deliberately excluded — one doctor is not a payroll.
const CLINIC_ADDONS = ['reporting.core', 'crm.core', 'media.core', 'packs.core', 'hr.core', 'multibranch.core'];

const ALL_PACKS = [
  'pack.aesthetic',
  'pack.dermatology',
  'pack.dental',
  'pack.obgyn',
  'pack.pediatrics',
  'pack.ophthalmology',
  'pack.physiotherapy',
];

const SPECIALTY_SHARED = ['integrations.core', 'packs.core'];

const SPECIALTY_CLINICAL = [
  ...ALL_PACKS,
  'growth.core',
  'dosing.core',
  'immunization.core',
  'integrations.core',
];

// Each specialty clinic type gets CLINIC features + its own pack(s) + the
// clinical features that pack needs. A dermatology clinic does not receive
// the dental odontogram, and a dental clinic does not get phototherapy.
//
// Aesthetic / dermatology clinics run on injectables and consumables — Botox
// vials, filler syringes, numbing cream, PRP kits — so consumables/stock
// tracking (pharmacy.core, which the ops dashboard's Stock Alerts widget reads)
// is core to the workflow, not an add-on. It is bundled here for that reason.
const DERMATOLOGY_FEATURES = [
  ...CLINIC_ADDONS, ...SPECIALTY_SHARED,
  'pack.aesthetic', 'pack.dermatology',
  'pharmacy.core',
];

const DENTAL_FEATURES = [
  ...CLINIC_ADDONS, ...SPECIALTY_SHARED,
  'pack.dental',
];

const OBGYN_FEATURES = [
  ...CLINIC_ADDONS, ...SPECIALTY_SHARED,
  'pack.obgyn',
  'growth.core', 'dosing.core', 'immunization.core',
];

const PEDIATRICS_FEATURES = [
  ...CLINIC_ADDONS, ...SPECIALTY_SHARED,
  'pack.pediatrics',
  'growth.core', 'dosing.core', 'immunization.core',
];

const OPHTHALMOLOGY_FEATURES = [
  ...CLINIC_ADDONS, ...SPECIALTY_SHARED,
  'pack.ophthalmology',
];

const PHYSIOTHERAPY_FEATURES = [
  ...CLINIC_ADDONS, ...SPECIALTY_SHARED,
  'pack.physiotherapy',
];

// Edition -> the feature keys it bundles. ENTERPRISE = everything.
export const EDITION_FEATURES: Record<Edition, string[]> = {
  [Edition.SOLO]: [...CORE],
  [Edition.CLINIC]: [...CORE, ...CLINIC_ADDONS],
  // Multi-specialty carries consumables/stock too (same aesthetic rationale as
  // DERMATOLOGY — injectables and consumables are part of the workflow).
  [Edition.SPECIALTY]: [...CORE, ...CLINIC_ADDONS, ...SPECIALTY_CLINICAL, 'pharmacy.core'],
  [Edition.DERMATOLOGY]: [...CORE, ...DERMATOLOGY_FEATURES],
  [Edition.DENTAL]: [...CORE, ...DENTAL_FEATURES],
  [Edition.OBGYN]: [...CORE, ...OBGYN_FEATURES],
  [Edition.PEDIATRICS]: [...CORE, ...PEDIATRICS_FEATURES],
  [Edition.OPHTHALMOLOGY]: [...CORE, ...OPHTHALMOLOGY_FEATURES],
  [Edition.PHYSIOTHERAPY]: [...CORE, ...PHYSIOTHERAPY_FEATURES],
  [Edition.LAB]: [...CORE, ...CLINIC_ADDONS, 'lab.core', 'imaging.core'],
  [Edition.PHARMACY]: [...CORE, ...CLINIC_ADDONS, 'pharmacy.core'],
  [Edition.HOSPITAL]: [
    ...CORE,
    ...CLINIC_ADDONS,
    ...SPECIALTY_CLINICAL,
    'lab.core',
    'imaging.core',
    'pharmacy.core',
    'ipd.core',
    'hr.core',
  ],
  [Edition.ENTERPRISE]: FEATURES.map((f) => f.key),
};

export const ALL_FEATURE_KEYS = FEATURES.map((f) => f.key);

/** The feature keys granted by an edition (deduplicated). */
export function featuresForEdition(edition: Edition): string[] {
  return [...new Set(EDITION_FEATURES[edition] ?? [])];
}

/** Editions catalog for the API — edition, its features, and their names. */
export function editionsCatalog() {
  const byKey = new Map(FEATURES.map((f) => [f.key, f]));
  return (Object.keys(EDITION_FEATURES) as Edition[]).map((edition) => ({
    edition,
    features: featuresForEdition(edition).map((k) => ({ key: k, name: byKey.get(k)?.name ?? k })),
  }));
}
