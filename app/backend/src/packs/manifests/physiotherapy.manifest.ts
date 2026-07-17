import { PackManifest } from '../manifest.types';

// Physiotherapy & Rehab — HEAVY pack. Config over the shared core + the rehab
// engines (ROM deficit banding, modality contraindications) in src/rehab.
// Outcome measures reuse the shared scored-instrument engine (Oswestry).
export const physiotherapyManifest: PackManifest = {
  key: 'physiotherapy',
  name: 'Physiotherapy & Rehab',
  specialty: 'Physiotherapy',
  tier: 'HEAVY',
  version: '1.0.0',
  description:
    'Episode of care with MSK assessment, per-joint ROM (deficit-banded), ' +
    'safety-gated electrotherapy sessions, and a home exercise programme. ' +
    'Outcomes via the Oswestry Disability Index.',
  requiresEntitlements: ['pack.physiotherapy', 'patients.core'],

  intakeGroups: [
    {
      key: 'physio-intake',
      name: 'Physiotherapy intake',
      fields: [
        { key: 'complaint', label: 'Presenting complaint', type: 'text', required: true },
        { key: 'onset', label: 'Onset', type: 'select', options: ['Acute (<6 wk)', 'Subacute', 'Chronic (>3 mo)'] },
        { key: 'mechanism', label: 'Mechanism of injury', type: 'textarea' },
        { key: 'pain_nprs', label: 'Pain now (NPRS 0-10)', type: 'number' },
        // Safety flags read by the modality-contraindication engine.
        { key: 'pacemaker', label: 'Pacemaker / implanted device', type: 'boolean' },
        { key: 'pregnant', label: 'Pregnant', type: 'boolean' },
        { key: 'metalImplant', label: 'Metal implant in region', type: 'boolean' },
        { key: 'impairedSensation', label: 'Impaired sensation', type: 'boolean' },
        { key: 'malignancy', label: 'Active malignancy', type: 'boolean' },
        { key: 'dvtHistory', label: 'DVT history', type: 'boolean' },
      ],
    },
  ],

  noteTemplates: [
    {
      key: 'physio-assessment',
      name: 'Physiotherapy Assessment',
      sections: [
        {
          key: 'subjective',
          title: 'Subjective',
          fields: [
            { key: 'history', label: 'History', type: 'textarea' },
            { key: 'aggravating', label: 'Aggravating / easing factors', type: 'textarea' },
          ],
        },
        {
          key: 'objective',
          title: 'Objective',
          fields: [
            { key: 'posture', label: 'Posture', type: 'text' },
            { key: 'gait', label: 'Gait', type: 'text' },
            { key: 'rom_summary', label: 'ROM summary', type: 'textarea' },
            { key: 'special_tests', label: 'Special tests', type: 'textarea' },
          ],
        },
        {
          key: 'plan',
          title: 'Assessment & plan',
          fields: [
            { key: 'diagnosis', label: 'Physiotherapy diagnosis', type: 'text', required: true },
            { key: 'goals', label: 'Goals', type: 'textarea' },
            { key: 'plan', label: 'Treatment plan', type: 'textarea' },
          ],
        },
      ],
    },
    {
      key: 'physio-session',
      name: 'Treatment Session',
      sections: [
        {
          key: 'session',
          title: 'Session',
          fields: [
            { key: 'modalities', label: 'Modalities applied', type: 'multiselect', options: ['TENS', 'IFT', 'US', 'HOT_PACK', 'CRYO', 'TRACTION', 'MANUAL_THERAPY', 'EXERCISE'] },
            { key: 'pain_pre', label: 'Pain pre (0-10)', type: 'number' },
            { key: 'pain_post', label: 'Pain post (0-10)', type: 'number' },
            { key: 'response', label: 'Response to treatment', type: 'textarea' },
          ],
        },
      ],
    },
  ],

  serviceCatalog: [
    { code: 'PHY-001', name: 'Physiotherapy initial assessment', category: 'Assessment', pricePkr: 3000, durationMin: 45 },
    { code: 'PHY-002', name: 'Physiotherapy follow-up session', category: 'Treatment', pricePkr: 2000, durationMin: 30 },
    { code: 'PHY-003', name: 'Manual therapy / mobilization', category: 'Treatment', pricePkr: 2500, durationMin: 30 },
    { code: 'PHY-004', name: 'Electrotherapy (TENS/IFT)', category: 'Treatment', pricePkr: 1200, durationMin: 20 },
    { code: 'PHY-005', name: 'Therapeutic ultrasound', category: 'Treatment', pricePkr: 1200, durationMin: 15 },
    { code: 'PHY-006', name: 'Exercise therapy session', category: 'Treatment', pricePkr: 1800, durationMin: 30 },
    { code: 'PHY-007', name: 'Rehab package — 10 sessions', category: 'Package', pricePkr: 16000 },
    { code: 'PHY-008', name: 'Home exercise programme + review', category: 'Treatment', pricePkr: 1500, durationMin: 20 },
  ],

  orderSets: [
    {
      key: 'low-back-pain-protocol',
      name: 'Low Back Pain Protocol',
      items: [
        { type: 'procedure', name: 'Oswestry Disability Index (baseline)' },
        { type: 'procedure', name: 'Lumbar ROM assessment' },
        { type: 'procedure', name: 'IFT — lumbar, 20 min' },
        { type: 'advice', name: 'Core stabilisation home programme' },
        { type: 'advice', name: 'Re-assess ODI at 4 weeks (MCID 10 points)' },
      ],
    },
    {
      key: 'post-op-knee-protocol',
      name: 'Post-op Knee Rehab',
      items: [
        { type: 'procedure', name: 'Knee ROM (active + passive)' },
        { type: 'procedure', name: 'Cryotherapy 15 min' },
        { type: 'procedure', name: 'Quadriceps strengthening progression' },
        { type: 'advice', name: 'Weight-bearing status per surgeon' },
      ],
    },
  ],

  // Reuses the shared scored-instrument library.
  instruments: [{ key: 'oswestry', showInConsultation: true }],

  // Pain (NPRS 0-10) over an episode. Not lateralized, and a patient may report
  // it several times a day — so pool both sides into one line and average per
  // day, which smooths intra-day noise into the trend that actually matters.
  trendCharts: [
    {
      key: 'pain_trend',
      title: 'Pain (NPRS)',
      observationCodes: ['nprs'],
      unit: 'score',
      splitByLaterality: false,
      yMin: 0,
      yMax: 10,
      referenceBands: [
        { label: 'Mild', low: 0, high: 3, color: 'green' },
        { label: 'Moderate', low: 4, high: 6, color: 'amber' },
        { label: 'Severe', low: 7, high: 10, color: 'red' },
      ],
      aggregation: 'dailyMean',
    },
  ],

  widgets: [
    { key: 'msk-assessment', route: 'msk', name: 'MSK Assessment' },
    { key: 'trend-chart', route: 'trends', name: 'Trends' },
  ],
};
