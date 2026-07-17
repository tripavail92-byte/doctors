import { PackManifest } from '../manifest.types';

// -----------------------------------------------------------------------------
// Aesthetic & Cosmetic — the FLAGSHIP reference pack.
//
// This is the worked example from docs/specialty-packs-build-specs.md: every
// other pack follows this shape. HEAVY tier (ships the before/after photo
// widget). Prices are illustrative PKR list prices for a Pakistani clinic.
// -----------------------------------------------------------------------------
export const aestheticManifest: PackManifest = {
  key: 'aesthetic',
  name: 'Aesthetic & Cosmetic',
  specialty: 'Aesthetic Medicine',
  tier: 'HEAVY',
  version: '1.0.0',
  description:
    'Injectables, lasers, skin treatments and packages with before/after ' +
    'documentation, consent capture and membership-friendly billing.',
  requiresEntitlements: ['pack.aesthetic', 'patients.core'],

  intakeGroups: [
    {
      key: 'skin-profile',
      name: 'Skin profile',
      fields: [
        {
          key: 'fitzpatrick',
          label: 'Fitzpatrick skin type',
          type: 'select',
          required: true,
          options: ['I', 'II', 'III', 'IV', 'V', 'VI'],
          help: 'Drives laser fluence & photosensitivity risk.',
        },
        {
          key: 'concerns',
          label: 'Primary concerns',
          type: 'multiselect',
          options: [
            'Fine lines / wrinkles',
            'Volume loss',
            'Pigmentation / melasma',
            'Acne scarring',
            'Unwanted hair',
            'Skin laxity',
            'Dull skin',
          ],
        },
        { key: 'allergies', label: 'Known allergies', type: 'text' },
        {
          key: 'prior_treatments',
          label: 'Prior aesthetic treatments',
          type: 'multiselect',
          options: ['Botox', 'Fillers', 'Laser', 'Chemical peel', 'PRP', 'Microneedling', 'None'],
        },
      ],
    },
    {
      key: 'safety-flags',
      name: 'Safety flags',
      fields: [
        { key: 'pregnant_or_lactating', label: 'Pregnant or lactating', type: 'boolean' },
        { key: 'isotretinoin_6mo', label: 'Isotretinoin in last 6 months', type: 'boolean' },
        { key: 'keloid_tendency', label: 'Keloid / hypertrophic scarring tendency', type: 'boolean' },
        { key: 'active_infection', label: 'Active skin infection at site', type: 'boolean' },
        { key: 'anticoagulants', label: 'On anticoagulants / blood thinners', type: 'boolean' },
      ],
    },
  ],

  noteTemplates: [
    {
      key: 'aesthetic-consult',
      name: 'Aesthetic consultation',
      sections: [
        {
          key: 'assessment',
          title: 'Assessment',
          fields: [
            { key: 'concern_areas', label: 'Concern areas', type: 'multiselect', options: ['Forehead', 'Glabella', 'Periorbital', 'Cheeks', 'Nasolabial', 'Lips', 'Jawline', 'Neck'] },
            { key: 'fitzpatrick', label: 'Fitzpatrick type', type: 'select', options: ['I', 'II', 'III', 'IV', 'V', 'VI'] },
            { key: 'photos_taken', label: 'Baseline photos taken', type: 'boolean' },
          ],
        },
        {
          key: 'plan',
          title: 'Plan',
          fields: [
            { key: 'recommended', label: 'Recommended treatments', type: 'textarea' },
            { key: 'sessions', label: 'Planned sessions', type: 'number' },
            { key: 'consent_taken', label: 'Written consent taken', type: 'boolean', required: true },
          ],
        },
        {
          key: 'injectables',
          title: 'Injectables administered',
          fields: [
            { key: 'product', label: 'Product', type: 'select', options: ['Botox', 'Dysport', 'Juvederm', 'Restylane', 'PRP'] },
            { key: 'units', label: 'Units / volume (U or mL)', type: 'number', unit: 'U/mL' },
            { key: 'lot_number', label: 'Lot number', type: 'text' },
            { key: 'sites', label: 'Injection sites', type: 'multiselect', options: ['Forehead', 'Glabella', 'Crows feet', 'Lips', 'Cheeks', 'Jawline'] },
          ],
        },
      ],
    },
  ],

  serviceCatalog: [
    { code: 'BOTOX-AREA', name: 'Botox — per area', category: 'Injectables', pricePkr: 18000, durationMin: 30 },
    { code: 'FILLER-1ML', name: 'Dermal filler — 1 mL', category: 'Injectables', pricePkr: 55000, durationMin: 45 },
    { code: 'HYDRAFACIAL', name: 'HydraFacial', category: 'Facials', pricePkr: 15000, durationMin: 60 },
    { code: 'PEEL-MED', name: 'Medical chemical peel', category: 'Skin', pricePkr: 12000, durationMin: 45 },
    { code: 'LHR-SESSION', name: 'Laser hair removal — per session', category: 'Laser', pricePkr: 9000, durationMin: 40 },
    { code: 'PRP-FACE', name: 'PRP facial (vampire facial)', category: 'Regenerative', pricePkr: 22000, durationMin: 60 },
    { code: 'MICRONEEDLE', name: 'Microneedling (RF)', category: 'Skin', pricePkr: 20000, durationMin: 60 },
    { code: 'CONSULT', name: 'Aesthetic consultation', category: 'Consultation', pricePkr: 3000, durationMin: 20 },
  ],

  orderSets: [
    {
      key: 'injectable-prep',
      name: 'Pre-injectable preparation',
      items: [
        { type: 'advice', name: 'Stop blood thinners 3–5 days prior (if medically safe)' },
        { type: 'advice', name: 'Avoid alcohol 24h before to reduce bruising' },
        { type: 'medication', name: 'Arnica', detail: 'Optional, to reduce bruising' },
        { type: 'procedure', name: 'Baseline standardized photographs' },
      ],
    },
    {
      key: 'peel-aftercare',
      name: 'Chemical peel aftercare',
      items: [
        { type: 'advice', name: 'Strict photoprotection — SPF 50, avoid direct sun 2 weeks' },
        { type: 'medication', name: 'Broad-spectrum sunscreen SPF 50+' },
        { type: 'advice', name: 'No exfoliants / retinoids for 7 days' },
      ],
    },
  ],

  instruments: [{ key: 'gags', showInConsultation: true }],

  widgets: [{ key: 'aesthetic-photos', route: 'patient-photos', name: 'Before / after gallery' }],
};
