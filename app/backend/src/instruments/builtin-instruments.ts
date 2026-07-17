import { InstrumentDefinitionSpec } from './instrument.types';

// Shared clinical-instrument library. Registered into InstrumentDefinition at
// boot and referenced by packs via InstrumentRef.key. Four instruments here
// exercise all three scoring methods: weighted (GAGS), sum (PHQ-9/GAD-7) and
// percent (Oswestry).

const FREQ_0_3 = [
  { label: 'Not at all', value: 0 },
  { label: 'Several days', value: 1 },
  { label: 'More than half the days', value: 2 },
  { label: 'Nearly every day', value: 3 },
];

const PHQ9_ITEMS = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling/staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself, or that you are a failure',
  'Trouble concentrating on things',
  'Moving/speaking slowly, or being fidgety/restless',
  'Thoughts that you would be better off dead or of hurting yourself',
];

const GAD7_ITEMS = [
  'Feeling nervous, anxious, or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it is hard to sit still',
  'Becoming easily annoyed or irritable',
  'Feeling afraid as if something awful might happen',
];

const GAGS_REGIONS = [
  { key: 'forehead', label: 'Forehead', weight: 2 },
  { key: 'right_cheek', label: 'Right cheek', weight: 2 },
  { key: 'left_cheek', label: 'Left cheek', weight: 2 },
  { key: 'nose', label: 'Nose', weight: 1 },
  { key: 'chin', label: 'Chin', weight: 1 },
  { key: 'chest_back', label: 'Chest and back', weight: 3 },
];

const GAGS_GRADE = [
  { label: 'None (0)', value: 0 },
  { label: 'Comedones (1)', value: 1 },
  { label: 'Papules (2)', value: 2 },
  { label: 'Pustules (3)', value: 3 },
  { label: 'Nodules / cysts (4)', value: 4 },
];

const ODI_SECTIONS = [
  'Pain intensity',
  'Personal care',
  'Lifting',
  'Walking',
  'Sitting',
  'Standing',
  'Sleeping',
  'Sex life',
  'Social life',
  'Travelling',
];

const ODI_OPTS = [0, 1, 2, 3, 4, 5].map((v) => ({ label: String(v), value: v }));

export const BUILTIN_INSTRUMENTS: InstrumentDefinitionSpec[] = [
  {
    key: 'gags',
    name: 'Global Acne Grading System (GAGS)',
    specialty: 'Dermatology',
    version: '1.0.0',
    scoring: 'weighted',
    observationMetric: 'gags_score',
    description: 'Regional acne severity — score = Σ(region factor × lesion grade 0–4).',
    items: GAGS_REGIONS.map((r) => ({
      key: r.key,
      label: r.label,
      weight: r.weight,
      options: GAGS_GRADE,
    })),
    bands: [
      { label: 'None', min: 0, max: 0, severity: 'none' },
      { label: 'Mild', min: 1, max: 18, severity: 'mild' },
      { label: 'Moderate', min: 19, max: 30, severity: 'moderate' },
      { label: 'Severe', min: 31, max: 38, severity: 'severe' },
      { label: 'Very severe', min: 39, max: 9999, severity: 'very_severe' },
    ],
  },
  {
    key: 'phq9',
    name: 'PHQ-9 Depression Scale',
    specialty: 'Psychiatry',
    version: '1.0.0',
    scoring: 'sum',
    observationMetric: 'phq9_score',
    description: 'Nine-item depression severity over the last two weeks (0–27).',
    items: PHQ9_ITEMS.map((label, i) => ({ key: `q${i + 1}`, label, options: FREQ_0_3 })),
    bands: [
      { label: 'Minimal', min: 0, max: 4, severity: 'minimal' },
      { label: 'Mild', min: 5, max: 9, severity: 'mild' },
      { label: 'Moderate', min: 10, max: 14, severity: 'moderate' },
      { label: 'Moderately severe', min: 15, max: 19, severity: 'severe' },
      { label: 'Severe', min: 20, max: 27, severity: 'very_severe' },
    ],
    // Safety-critical: item 9 (thoughts of being better off dead / self-harm)
    // must raise a risk flag on ANY positive response, regardless of total.
    flagRules: [
      {
        flag: 'SELF_HARM_RISK',
        item: 'q9',
        gte: 1,
        critical: true,
        message: 'Positive response to PHQ-9 item 9 (self-harm) — assess suicide risk now.',
      },
    ],
  },
  {
    key: 'gad7',
    name: 'GAD-7 Anxiety Scale',
    specialty: 'Psychiatry',
    version: '1.0.0',
    scoring: 'sum',
    observationMetric: 'gad7_score',
    description: 'Seven-item generalised anxiety severity over the last two weeks (0–21).',
    items: GAD7_ITEMS.map((label, i) => ({ key: `q${i + 1}`, label, options: FREQ_0_3 })),
    bands: [
      { label: 'Minimal', min: 0, max: 4, severity: 'minimal' },
      { label: 'Mild', min: 5, max: 9, severity: 'mild' },
      { label: 'Moderate', min: 10, max: 14, severity: 'moderate' },
      { label: 'Severe', min: 15, max: 21, severity: 'severe' },
    ],
  },
  {
    key: 'oswestry',
    name: 'Oswestry Disability Index (ODI)',
    specialty: 'Physiotherapy',
    version: '1.0.0',
    scoring: 'percent',
    observationMetric: 'odi_percent',
    description: 'Ten-section low-back disability index, reported as a percentage.',
    items: ODI_SECTIONS.map((label, i) => ({ key: `s${i + 1}`, label, options: ODI_OPTS })),
    bands: [
      { label: 'Minimal disability', min: 0, max: 20, severity: 'minimal' },
      { label: 'Moderate disability', min: 21, max: 40, severity: 'moderate' },
      { label: 'Severe disability', min: 41, max: 60, severity: 'severe' },
      { label: 'Crippled', min: 61, max: 80, severity: 'crippled' },
      { label: 'Bed-bound / symptom magnification', min: 81, max: 100, severity: 'very_severe' },
    ],
  },
];
