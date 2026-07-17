import { PackManifest } from '../manifest.types';

// Dermatology — HEAVY pack (ships the GAGS grading + phototherapy widget).
export const dermatologyManifest: PackManifest = {
  key: 'dermatology',
  name: 'Dermatology',
  specialty: 'Dermatology',
  tier: 'HEAVY',
  version: '1.0.0',
  description:
    'Medical dermatology: acne/eczema grading, phototherapy tracking, ' +
    'cryotherapy and skin diagnosis with structured lesion documentation.',
  requiresEntitlements: ['pack.dermatology', 'patients.core'],

  intakeGroups: [
    {
      key: 'derm-history',
      name: 'Dermatology history',
      fields: [
        { key: 'fitzpatrick', label: 'Fitzpatrick skin type', type: 'select', options: ['I', 'II', 'III', 'IV', 'V', 'VI'] },
        { key: 'complaint', label: 'Chief complaint', type: 'text', required: true },
        { key: 'duration', label: 'Duration', type: 'text' },
        { key: 'atopy_family', label: 'Family history of atopy', type: 'boolean' },
        { key: 'prior_topicals', label: 'Prior topical treatments tried', type: 'textarea' },
      ],
    },
  ],

  noteTemplates: [
    {
      key: 'derm-consult',
      name: 'Dermatology consultation',
      sections: [
        {
          key: 'exam',
          title: 'Examination',
          fields: [
            { key: 'lesion_type', label: 'Primary lesion', type: 'select', options: ['Macule', 'Papule', 'Plaque', 'Vesicle', 'Pustule', 'Nodule', 'Wheal'] },
            { key: 'distribution', label: 'Distribution', type: 'text' },
            { key: 'body_regions', label: 'Body regions involved', type: 'multiselect', options: ['Face', 'Scalp', 'Trunk', 'Upper limbs', 'Lower limbs', 'Hands', 'Feet', 'Flexures'] },
          ],
        },
        {
          key: 'assessment',
          title: 'Diagnosis & plan',
          fields: [
            { key: 'diagnosis', label: 'Working diagnosis', type: 'text', required: true },
            { key: 'plan', label: 'Management plan', type: 'textarea' },
            { key: 'review_weeks', label: 'Review in (weeks)', type: 'number' },
          ],
        },
      ],
    },
  ],

  serviceCatalog: [
    { code: 'CONSULT', name: 'Dermatology consultation (new)', category: 'Consultation', pricePkr: 3500, durationMin: 20 },
    { code: 'FOLLOWUP', name: 'Dermatology follow-up', category: 'Consultation', pricePkr: 2000, durationMin: 15 },
    { code: 'TELEDERM', name: 'Teledermatology consult', category: 'Consultation', pricePkr: 2500, durationMin: 15 },
    { code: 'NBUVB', name: 'NB-UVB phototherapy — single session', category: 'Phototherapy', pricePkr: 2500, durationMin: 15 },
    { code: 'NBUVB-12', name: 'NB-UVB course — 12 sessions (package)', category: 'Phototherapy', pricePkr: 26000 },
    { code: 'EXCIMER', name: 'Excimer/targeted phototherapy — session', category: 'Phototherapy', pricePkr: 4000, durationMin: 15 },
    { code: 'BIOPSY', name: 'Punch/shave skin biopsy (incl. local)', category: 'Procedure', pricePkr: 6500, durationMin: 30 },
    { code: 'HISTOPATH', name: 'Histopathology processing + report', category: 'Diagnostics', pricePkr: 8000 },
    { code: 'CRYO', name: 'Cryotherapy — per lesion', category: 'Procedure', pricePkr: 2500, durationMin: 15 },
    { code: 'CAUTERY', name: 'Electrocautery/RF wart removal (up to 5)', category: 'Procedure', pricePkr: 5000, durationMin: 20 },
    { code: 'ILS', name: 'Intralesional steroid injection (keloid/AA)', category: 'Procedure', pricePkr: 3000, durationMin: 15 },
    { code: 'DERMOSCOPY', name: 'Dermoscopy / mole mapping', category: 'Diagnostics', pricePkr: 4500, durationMin: 30 },
    { code: 'PATCH-TEST', name: 'Patch testing (allergy series)', category: 'Diagnostics', pricePkr: 15000, durationMin: 30 },
    { code: 'PEEL', name: 'Chemical peel — glycolic/salicylic', category: 'Procedure', pricePkr: 8000, durationMin: 30 },
    { code: 'WOODS', name: "Wood's lamp examination", category: 'Diagnostics', pricePkr: 1500, durationMin: 10 },
  ],

  orderSets: [
    {
      key: 'acne-workup',
      name: 'Acne management (moderate)',
      items: [
        { type: 'medication', name: 'Topical retinoid nightly', detail: 'Adapalene 0.1%' },
        { type: 'medication', name: 'Benzoyl peroxide 2.5% AM' },
        { type: 'medication', name: 'Doxycycline 100 mg OD', detail: 'If inflammatory, review at 8 weeks' },
        { type: 'advice', name: 'Non-comedogenic moisturiser + SPF' },
      ],
    },
    {
      key: 'eczema-care',
      name: 'Atopic eczema care',
      items: [
        { type: 'medication', name: 'Emollient liberally BD–QID' },
        { type: 'medication', name: 'Topical steroid to flares', detail: 'Potency by site' },
        { type: 'advice', name: 'Avoid soap; lukewarm baths; identify triggers' },
      ],
    },
    {
      key: 'biopsy-pathology',
      name: 'Biopsy / Pathology',
      items: [
        // Site + laterality are inherited from the SkinLesion record onto the
        // requisition — the guard against wrong-site labelling.
        { type: 'procedure', name: 'Punch/shave biopsy', detail: 'Site + laterality auto-filled from the lesion record' },
        { type: 'lab', name: 'Histopathology request' },
        { type: 'lab', name: 'DIF / special stains', detail: 'If immunobullous or vasculitis suspected' },
        { type: 'advice', name: 'Fixative + biopsy kit picked from inventory (batch/expiry)' },
        { type: 'advice', name: 'WhatsApp "results ready" journey on report sign-off' },
      ],
    },
    {
      key: 'isotretinoin-workup',
      name: 'Acne systemic work-up (isotretinoin)',
      items: [
        { type: 'lab', name: 'LFTs (baseline)' },
        { type: 'lab', name: 'Fasting lipid profile (baseline)' },
        // Teratogenicity: pregnancy must be excluded before, and counselling
        // documented, not assumed.
        { type: 'lab', name: 'Beta-hCG', detail: 'MANDATORY for females of child-bearing potential before starting' },
        { type: 'advice', name: 'Pregnancy prevention counselling — document explicitly' },
        { type: 'advice', name: 'Monthly review recall while on treatment' },
      ],
    },
    {
      key: 'pre-phototherapy-panel',
      name: 'Psoriasis pre-biologic / phototherapy panel',
      items: [
        { type: 'lab', name: 'CBC' },
        { type: 'lab', name: 'LFT / RFT' },
        { type: 'lab', name: 'HBsAg + anti-HCV' },
        { type: 'lab', name: 'TB screen', detail: 'Per PMDC/PHC guidance before biologics' },
        { type: 'advice', name: 'Confirm Fitzpatrick skin type — required before a phototherapy course can start' },
        { type: 'advice', name: 'Review photosensitising medicines and pregnancy status' },
      ],
    },
  ],

  // Region-weighted graders run on the dermatology engines (src/dermatology);
  // results still persist to the shared ScoredInstrumentResponse table, so they
  // trend and report like any other instrument.
  instruments: [
    { key: 'gags', showInConsultation: true },
    { key: 'pasi', showInConsultation: true },
    { key: 'easi', showInConsultation: true },
    { key: 'scorad', showInConsultation: true },
    { key: 'masi', showInConsultation: false },
    { key: 'vasi', showInConsultation: false },
  ],

  widgets: [
    { key: 'derma-grading', route: 'derma-grading', name: 'Grading (GAGS/PASI/EASI/SCORAD)' },
    { key: 'phototherapy-ledger', route: 'phototherapy', name: 'Phototherapy ledger' },
  ],
};
