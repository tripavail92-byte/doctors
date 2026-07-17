import { PackManifest, PackTierName } from './manifest.types';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  manifest?: PackManifest;
}

const KEY_RE = /^[a-z0-9-]+$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const TIERS: PackTierName[] = ['LIGHT', 'HEAVY'];

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Structural validation for an authored pack manifest.
 *
 * The manifest is written by (potentially non-engineer) pack authors and
 * arrives as untrusted JSON, so we validate shape before it is ever persisted
 * or expanded into a tenant. Returns a flat list of human-readable errors so an
 * authoring UI can surface them inline; on success returns the typed manifest.
 */
export function validateManifest(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: ['manifest must be a JSON object'] };
  }
  const m = input as Record<string, any>;

  if (!nonEmpty(m.key)) errors.push('key is required');
  else if (!KEY_RE.test(m.key)) errors.push('key must be kebab-case (a-z, 0-9, "-")');
  if (!nonEmpty(m.name)) errors.push('name is required');
  if (!nonEmpty(m.specialty)) errors.push('specialty is required');
  if (!nonEmpty(m.description)) errors.push('description is required');
  if (!TIERS.includes(m.tier)) errors.push(`tier must be one of: ${TIERS.join(', ')}`);
  if (!nonEmpty(m.version)) errors.push('version is required');
  else if (!SEMVER_RE.test(m.version)) errors.push('version must be semver "x.y.z"');

  for (const a of ['intakeGroups', 'noteTemplates', 'serviceCatalog', 'orderSets', 'instruments']) {
    if (!Array.isArray(m[a])) errors.push(`${a} must be an array`);
  }

  if (Array.isArray(m.serviceCatalog)) {
    const codes = new Set<string>();
    m.serviceCatalog.forEach((s: any, i: number) => {
      if (!nonEmpty(s?.code)) errors.push(`serviceCatalog[${i}].code is required`);
      else if (codes.has(s.code)) errors.push(`serviceCatalog code "${s.code}" is duplicated`);
      else codes.add(s.code);
      if (!nonEmpty(s?.name)) errors.push(`serviceCatalog[${i}].name is required`);
      if (!nonEmpty(s?.category)) errors.push(`serviceCatalog[${i}].category is required`);
      if (typeof s?.pricePkr !== 'number' || s.pricePkr < 0) {
        errors.push(`serviceCatalog[${i}].pricePkr must be a number >= 0`);
      }
    });
  }

  const uniqueKeyed = (arr: any[], field: string, requireName: boolean) => {
    const keys = new Set<string>();
    arr.forEach((x: any, i: number) => {
      if (!nonEmpty(x?.key)) errors.push(`${field}[${i}].key is required`);
      else if (keys.has(x.key)) errors.push(`${field} key "${x.key}" is duplicated`);
      else keys.add(x.key);
      if (requireName && !nonEmpty(x?.name)) errors.push(`${field}[${i}].name is required`);
    });
  };
  if (Array.isArray(m.noteTemplates)) uniqueKeyed(m.noteTemplates, 'noteTemplates', true);
  if (Array.isArray(m.intakeGroups)) uniqueKeyed(m.intakeGroups, 'intakeGroups', true);
  if (Array.isArray(m.orderSets)) uniqueKeyed(m.orderSets, 'orderSets', true);
  if (Array.isArray(m.instruments)) uniqueKeyed(m.instruments, 'instruments', false);

  return errors.length
    ? { ok: false, errors }
    : { ok: true, errors: [], manifest: m as PackManifest };
}
