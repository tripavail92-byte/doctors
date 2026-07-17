// Built-in dose rules seeded per tenant.
//
// STARTER DATA — NOT A FORMULARY. These four regimens are illustrative. Before
// any clinical use they must be validated against a maintained PMDC/DRAP
// formulary, with age/indication-specific regimens, renal adjustment and
// contraindications. They exist so the calculator has something to compute
// against on day one, and because a tenant can now edit them without a deploy.
export const BUILTIN_DOSE_RULES = [
  {
    drugKey: 'paracetamol',
    displayName: 'Paracetamol',
    route: 'oral',
    form: 'syrup 120 mg/5 mL',
    mgPerKgPerDay: 60,
    dosesPerDay: 4,
    maxSingleDoseMg: 1000,
    maxDailyDoseMg: 4000,
    minAgeMonths: 3,
    roundingStepMl: 0.5,
    concentrations: [
      { label: '120 mg/5 mL', mgPerMl: 24 },
      { label: '250 mg/5 mL', mgPerMl: 50 },
    ],
    cautions: ['Hepatic impairment: reduce dose'],
  },
  {
    drugKey: 'amoxicillin',
    displayName: 'Amoxicillin',
    route: 'oral',
    form: 'syrup 125 mg/5 mL',
    mgPerKgPerDay: 40,
    dosesPerDay: 3,
    maxDailyDoseMg: 1500,
    roundingStepMl: 0.5,
    concentrations: [
      { label: '125 mg/5 mL', mgPerMl: 25 },
      { label: '250 mg/5 mL', mgPerMl: 50 },
    ],
    cautions: ['Penicillin allergy: contraindicated'],
  },
  {
    drugKey: 'ibuprofen',
    displayName: 'Ibuprofen',
    route: 'oral',
    form: 'syrup 100 mg/5 mL',
    mgPerKgPerDay: 30,
    dosesPerDay: 3,
    maxSingleDoseMg: 400,
    maxDailyDoseMg: 1200,
    minAgeMonths: 3,
    roundingStepMl: 0.5,
    concentrations: [{ label: '100 mg/5 mL', mgPerMl: 20 }],
    cautions: ['Avoid in dehydration / renal impairment'],
  },
  {
    drugKey: 'azithromycin',
    displayName: 'Azithromycin',
    route: 'oral',
    form: 'syrup 200 mg/5 mL',
    mgPerKgPerDay: 10,
    dosesPerDay: 1,
    maxDailyDoseMg: 500,
    roundingStepMl: 0.5,
    concentrations: [{ label: '200 mg/5 mL', mgPerMl: 40 }],
    cautions: [],
  },
];
