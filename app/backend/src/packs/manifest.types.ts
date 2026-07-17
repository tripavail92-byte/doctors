// PackManifest — the authoring & versioning format for a specialty pack.
//
// A manifest is stored (as JSON) on a PackVersion. When a tenant activates a
// pack, `seedPackForTenant` expands the manifest into ordinary tenant-scoped
// rows (ServiceCatalogItem, NoteTemplate, IntakeFieldGroup, OrderSet) so the
// rest of the app reads normal relational data. The manifest is therefore the
// *write/versioning* format, never the runtime read path.

export type PackTierName = 'LIGHT' | 'HEAVY';

export type IntakeFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'date';

export interface IntakeField {
  key: string;
  label: string;
  type: IntakeFieldType;
  required?: boolean;
  options?: string[];
  unit?: string;
  help?: string;
}

export interface IntakeGroupSpec {
  key: string;
  name: string;
  fields: IntakeField[];
}

export interface NoteSection {
  key: string;
  title: string;
  fields: IntakeField[];
}

export interface NoteTemplateSpec {
  key: string;
  name: string;
  sections: NoteSection[];
}

export interface ServiceItemSpec {
  code: string;
  name: string;
  category: string;
  pricePkr: number;
  durationMin?: number;
  /** Performed per-side (tonometry, cataract, limb work)? Default false. */
  lateralizable?: boolean;
  /** Bundled both-sides price. Omit to bill two lines at pricePkr. */
  bilateralPricePkr?: number;
}

export type OrderItemType =
  | 'lab'
  | 'medication'
  | 'procedure'
  | 'imaging'
  | 'advice';

export interface OrderSetItem {
  type: OrderItemType;
  name: string;
  detail?: string;
}

export interface OrderSetSpec {
  key: string;
  name: string;
  items: OrderSetItem[];
}

// A shared-library instrument this pack surfaces (referenced by key — the
// definition itself lives in the global InstrumentDefinition table).
export interface InstrumentRef {
  key: string;
  showInConsultation?: boolean;
}

// A custom clinical widget shipped by a HEAVY pack (maps to a UI route/screen).
export interface PackWidget {
  key: string;
  route: string;
  name: string;
}

export interface PackManifest {
  key: string;
  name: string;
  specialty: string;
  tier: PackTierName;
  version: string; // semver
  description: string;
  // Entitlement keys the tenant is expected to hold for this pack's features.
  requiresEntitlements?: string[];
  intakeGroups: IntakeGroupSpec[];
  noteTemplates: NoteTemplateSpec[];
  serviceCatalog: ServiceItemSpec[];
  orderSets: OrderSetSpec[];
  instruments: InstrumentRef[];
  widgets?: PackWidget[];
}
