import { PackManifest } from '../manifest.types';

// Ophthalmology & Optometry — HEAVY pack. Config over the shared core + the
// eye-exam engines (VA/logMAR, refraction validation, IOP banding) in
// src/ophthalmology. Per-eye IOP/VA reuse the core laterality + trends.
export const ophthalmologyManifest: PackManifest = {
  key: 'ophthalmology',
  name: 'Ophthalmology & Optometry',
  specialty: 'Ophthalmology',
  tier: 'HEAVY',
  version: '1.0.0',
  description:
    'Per-eye eye-exam panel — visual acuity (logMAR), refraction, IOP with ' +
    'glaucoma banding, anterior/posterior segment findings — and optical ' +
    'prescriptions.',
  requiresEntitlements: ['pack.ophthalmology', 'patients.core'],

  intakeGroups: [
    {
      key: 'ophthalmology-history',
      name: 'Ocular history',
      fields: [
        { key: 'complaint', label: 'Presenting complaint', type: 'select', options: ['Blurred vision', 'Redness', 'Pain', 'Discharge', 'Floaters', 'Routine check'] },
        { key: 'spectacles', label: 'Wears spectacles', type: 'boolean' },
        { key: 'contact_lenses', label: 'Wears contact lenses', type: 'boolean' },
        { key: 'diabetes', label: 'Diabetes', type: 'boolean' },
        { key: 'glaucoma_family', label: 'Family history of glaucoma', type: 'boolean' },
        { key: 'prev_eye_surgery', label: 'Previous eye surgery', type: 'text' },
      ],
    },
  ],

  noteTemplates: [
    {
      key: 'eye-exam',
      name: 'Eye Examination',
      sections: [
        {
          key: 'vision',
          title: 'Vision & refraction',
          fields: [
            { key: 'va_od', label: 'VA OD', type: 'text' },
            { key: 'va_os', label: 'VA OS', type: 'text' },
            { key: 'refraction', label: 'Refraction summary', type: 'textarea' },
          ],
        },
        {
          key: 'exam',
          title: 'Examination',
          fields: [
            { key: 'iop', label: 'IOP OD / OS (mmHg)', type: 'text' },
            { key: 'anterior', label: 'Anterior segment', type: 'textarea' },
            { key: 'posterior', label: 'Posterior segment / fundus', type: 'textarea' },
          ],
        },
        {
          key: 'plan',
          title: 'Diagnosis & plan',
          fields: [
            { key: 'diagnosis', label: 'Diagnosis', type: 'text', required: true },
            { key: 'plan', label: 'Plan', type: 'textarea' },
          ],
        },
      ],
    },
  ],

  serviceCatalog: [
    { code: 'EYE-001', name: 'Ophthalmology consultation', category: 'Consultation', pricePkr: 2500, durationMin: 20 },
    { code: 'EYE-002', name: 'Comprehensive eye exam', category: 'Examination', pricePkr: 3500, durationMin: 30 },
    { code: 'EYE-003', name: 'Refraction / spectacle prescription', category: 'Optometry', pricePkr: 1500, durationMin: 20 },
    // Per-eye. Bundle price for both eyes is less than 2x — the tech sets the
    // machine up once — so a bilateral request bills 1500, not 2000.
    { code: 'EYE-004', name: 'Tonometry (IOP)', category: 'Diagnostics', pricePkr: 1000, durationMin: 10, lateralizable: true, bilateralPricePkr: 1500 },
    { code: 'EYE-005', name: 'Dilated fundus examination', category: 'Diagnostics', pricePkr: 2000, durationMin: 20 },
    // Per eye, no bundle: each eye is a separate scan, so bilateral bills 2x.
    { code: 'EYE-006', name: 'OCT', category: 'Imaging', pricePkr: 4000, durationMin: 15, lateralizable: true },
    { code: 'EYE-007', name: 'Visual field (perimetry)', category: 'Diagnostics', pricePkr: 3000, durationMin: 30 },
    { code: 'EYE-008', name: 'Contact lens fitting', category: 'Optometry', pricePkr: 3000, durationMin: 30 },
  ],

  orderSets: [
    {
      key: 'glaucoma-workup',
      name: 'Glaucoma Workup',
      items: [
        { type: 'procedure', name: 'IOP (both eyes, GAT)' },
        { type: 'imaging', name: 'OCT — RNFL both eyes' },
        { type: 'procedure', name: 'Visual field (perimetry)' },
        { type: 'procedure', name: 'Gonioscopy' },
        { type: 'procedure', name: 'Central corneal thickness (pachymetry)' },
      ],
    },
    {
      key: 'diabetic-eye-screen',
      name: 'Diabetic Eye Screen',
      items: [
        { type: 'procedure', name: 'Dilated fundus examination' },
        { type: 'imaging', name: 'Fundus photography' },
        { type: 'imaging', name: 'OCT — macula (if maculopathy suspected)' },
      ],
    },
  ],

  instruments: [],

  widgets: [{ key: 'eye-exam-panel', route: 'eye-exam', name: 'Eye Exam Panel' }],
};
