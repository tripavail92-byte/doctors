import { PackManifest } from '../manifest.types';

// Dental & Orthodontics — HEAVY pack (ships the odontogram widget).
export const dentalManifest: PackManifest = {
  key: 'dental',
  name: 'Dental & Orthodontics',
  specialty: 'Dentistry',
  tier: 'HEAVY',
  version: '1.0.0',
  description:
    'Odontogram charting, periodontal assessment and tooth-level treatment ' +
    'plans that flow straight into billing.',
  requiresEntitlements: ['pack.dental', 'patients.core'],

  intakeGroups: [
    {
      key: 'dental-history',
      name: 'Dental history',
      fields: [
        { key: 'last_cleaning', label: 'Last scaling / cleaning', type: 'date' },
        { key: 'brushing', label: 'Brushing frequency', type: 'select', options: ['Once daily', 'Twice daily', 'Irregular'] },
        { key: 'sensitivity', label: 'Tooth sensitivity', type: 'boolean' },
        { key: 'bleeding_gums', label: 'Bleeding gums', type: 'boolean' },
        { key: 'smoker', label: 'Smoker / tobacco use', type: 'boolean' },
      ],
    },
  ],

  noteTemplates: [
    {
      key: 'dental-consult',
      name: 'Dental consultation',
      sections: [
        {
          key: 'exam',
          title: 'Examination',
          fields: [
            { key: 'complaint', label: 'Chief complaint', type: 'text', required: true },
            { key: 'teeth_involved', label: 'Teeth involved (FDI)', type: 'text' },
            { key: 'perio_status', label: 'Periodontal status', type: 'select', options: ['Healthy', 'Gingivitis', 'Mild periodontitis', 'Moderate periodontitis', 'Severe periodontitis'] },
          ],
        },
        {
          key: 'plan',
          title: 'Diagnosis & treatment plan',
          fields: [
            { key: 'diagnosis', label: 'Diagnosis', type: 'text', required: true },
            { key: 'treatment', label: 'Treatment plan', type: 'textarea' },
            { key: 'visits', label: 'Estimated visits', type: 'number' },
          ],
        },
      ],
    },
  ],

  serviceCatalog: [
    { code: 'SCALING', name: 'Scaling & polishing', category: 'Preventive', pricePkr: 6000, durationMin: 40 },
    { code: 'FILLING', name: 'Composite filling', category: 'Restorative', pricePkr: 5000, durationMin: 45 },
    { code: 'RCT-CANAL', name: 'Root canal — per canal', category: 'Endodontics', pricePkr: 12000, durationMin: 60 },
    { code: 'EXTRACTION', name: 'Extraction (simple)', category: 'Surgery', pricePkr: 4000, durationMin: 30 },
    { code: 'CROWN-PFM', name: 'Crown — PFM', category: 'Prosthetics', pricePkr: 18000, durationMin: 60 },
    { code: 'ORTHO-CONSULT', name: 'Orthodontic consultation', category: 'Orthodontics', pricePkr: 3000, durationMin: 30 },
    { code: 'XRAY-IOPA', name: 'X-ray — IOPA', category: 'Diagnostics', pricePkr: 1500, durationMin: 10 },
  ],

  orderSets: [
    {
      key: 'rct-protocol',
      name: 'Root canal protocol',
      items: [
        { type: 'imaging', name: 'Pre-op IOPA radiograph' },
        { type: 'procedure', name: 'Access & biomechanical preparation' },
        { type: 'medication', name: 'Analgesia', detail: 'Ibuprofen 400 mg TDS PRN' },
        { type: 'imaging', name: 'Post-obturation radiograph' },
      ],
    },
    {
      key: 'perio-maintenance',
      name: 'Periodontal maintenance',
      items: [
        { type: 'procedure', name: 'Full-mouth scaling & root planing' },
        { type: 'advice', name: 'Oral hygiene instruction — modified Bass technique' },
        { type: 'advice', name: 'Recall at 3 months' },
      ],
    },
  ],

  instruments: [],

  widgets: [{ key: 'dental-chart', route: 'dental-chart', name: 'Odontogram & perio chart' }],
};
