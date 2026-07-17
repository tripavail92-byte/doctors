import { PackManifest } from '../manifest.types';

// Obstetrics & Gynaecology — HEAVY pack. Configuration over the shared core +
// the OB/GYN clinical engines (EDD/GA, Hadlock EFW, ANC alerts, WHO LCG
// partogram, TT/Td schedule) in src/obstetrics. Ships two widgets: the ANC
// card and the partogram. Service catalog / templates / order sets below are
// pure config (PKR mid-tier private clinic).
export const obgynManifest: PackManifest = {
  key: 'obgyn',
  name: 'Obstetrics & Gynaecology',
  specialty: 'Obstetrics & Gynaecology',
  tier: 'HEAVY',
  version: '1.0.0',
  description:
    'Complete pregnancy episode — ANC card (WHO 8-contact), obstetric ' +
    'ultrasound with Hadlock EFW, TT/Td tracking, WHO Labour Care Guide ' +
    'partogram — plus a gynae mode (cycle, PCOS, infertility).',
  requiresEntitlements: ['pack.obgyn', 'patients.core'],

  intakeGroups: [
    {
      key: 'obgyn-booking',
      name: 'OB/GYN booking',
      fields: [
        { key: 'marital_status', label: 'Marital status', type: 'select', options: ['Married', 'Single', 'Widowed', 'Divorced'] },
        { key: 'next_of_kin_name', label: 'Husband / next-of-kin name', type: 'text' },
        { key: 'next_of_kin_phone', label: 'Next-of-kin phone (WhatsApp)', type: 'text' },
        { key: 'number_owner', label: 'Who owns this WhatsApp number', type: 'select', options: ['Patient', 'Husband', 'Family (shared)'] },
        { key: 'consanguinity', label: 'Consanguineous marriage', type: 'boolean' },
        { key: 'prev_cs_count', label: 'Previous C-sections', type: 'number' },
        { key: 'medical_history', label: 'Medical history', type: 'multiselect', options: ['HTN', 'Diabetes', 'Thyroid', 'TB', 'Hepatitis B', 'Hepatitis C', 'Cardiac'] },
        { key: 'folic_acid', label: 'Taking folic acid', type: 'boolean' },
        { key: 'smoking_naswar', label: 'Smoking / naswar exposure', type: 'boolean' },
      ],
    },
    {
      key: 'gynae-history',
      name: 'Gynae history',
      fields: [
        { key: 'menarche_age', label: 'Age at menarche', type: 'number', unit: 'yr' },
        { key: 'cycle_pattern', label: 'Cycle pattern', type: 'select', options: ['Regular', 'Irregular', 'Amenorrhea', 'Oligomenorrhea'] },
        { key: 'contraception', label: 'Contraception', type: 'select', options: ['None', 'OCP', 'IUCD', 'Injectable', 'Implant', 'Condom', 'TL'] },
        { key: 'pap_smear_date', label: 'Last pap smear', type: 'date' },
      ],
    },
  ],

  noteTemplates: [
    {
      key: 'anc-booking',
      name: 'ANC Booking Visit',
      sections: [
        {
          key: 'history',
          title: 'History & obstetric history',
          fields: [
            { key: 'complaint', label: 'Presenting complaint', type: 'textarea' },
            { key: 'gpa', label: 'G / P / A', type: 'text', required: true },
            { key: 'lmp', label: 'LMP', type: 'date' },
          ],
        },
        {
          key: 'exam',
          title: 'Examination & dating',
          fields: [
            { key: 'general_exam', label: 'General examination', type: 'textarea' },
            { key: 'dating_method', label: 'Dating method', type: 'select', options: ['LMP', 'USG', 'Clinical'] },
          ],
        },
        {
          key: 'plan',
          title: 'Risk assessment & plan',
          fields: [
            { key: 'risk', label: 'Risk assessment', type: 'textarea' },
            { key: 'plan', label: 'Plan & schedule', type: 'textarea' },
          ],
        },
      ],
    },
    {
      key: 'anc-followup',
      name: 'ANC Follow-up',
      sections: [
        {
          key: 'interval',
          title: 'Interval history',
          fields: [
            { key: 'danger_signs', label: 'Danger-sign review', type: 'multiselect', options: ['Bleeding', 'Severe headache', 'Blurred vision', 'Reduced fetal movements', 'Fever', 'Leaking'] },
            { key: 'complaints', label: 'Interval complaints', type: 'textarea' },
          ],
        },
        { key: 'plan', title: 'Plan', fields: [{ key: 'plan', label: 'Plan', type: 'textarea' }] },
      ],
    },
    {
      key: 'obstetric-usg',
      name: 'Obstetric Ultrasound Report',
      sections: [
        {
          key: 'report',
          title: 'Report',
          fields: [
            { key: 'indication', label: 'Indication', type: 'text' },
            { key: 'impression', label: 'Impression', type: 'textarea', required: true },
            { key: 'recommendation', label: 'Recommendation', type: 'textarea' },
          ],
        },
      ],
    },
    {
      key: 'gynae-consult',
      name: 'Gynae Consultation',
      sections: [
        {
          key: 'history',
          title: 'Menstrual history & complaint',
          fields: [
            { key: 'menstrual', label: 'Menstrual history', type: 'textarea' },
            { key: 'complaint', label: 'Complaint', type: 'textarea', required: true },
          ],
        },
        {
          key: 'exam_plan',
          title: 'Examination & plan',
          fields: [
            { key: 'exam', label: 'Examination (speculum / bimanual)', type: 'textarea' },
            { key: 'plan', label: 'Assessment & plan', type: 'textarea' },
          ],
        },
      ],
    },
    {
      key: 'delivery-note',
      name: 'Delivery Note',
      sections: [
        {
          key: 'summary',
          title: 'Labour & delivery',
          fields: [
            { key: 'mode', label: 'Mode of delivery', type: 'select', options: ['SVD', 'Vacuum', 'Forceps', 'Elective CS', 'Emergency CS'] },
            { key: 'baby', label: 'Baby details (sex / weight / Apgar)', type: 'text' },
            { key: 'blood_loss', label: 'Estimated blood loss', type: 'text' },
            { key: 'perineum', label: 'Perineum', type: 'text' },
          ],
        },
      ],
    },
    {
      key: 'postnatal-check',
      name: 'Postnatal Check',
      sections: [
        {
          key: 'mother',
          title: 'Mother',
          fields: [
            { key: 'lochia', label: 'Bleeding / lochia', type: 'text' },
            { key: 'breastfeeding', label: 'Breastfeeding', type: 'select', options: ['Established', 'Difficulty', 'Not breastfeeding'] },
            { key: 'family_planning', label: 'Family-planning counselling', type: 'textarea' },
          ],
        },
      ],
    },
  ],

  serviceCatalog: [
    { code: 'OBG-001', name: 'Gynae/Obs consultation', category: 'Consultation', pricePkr: 2500, durationMin: 20 },
    { code: 'OBG-002', name: 'ANC follow-up visit', category: 'Antenatal', pricePkr: 2000, durationMin: 15 },
    { code: 'OBG-003', name: 'ANC package — 8 contacts', category: 'Antenatal', pricePkr: 16000 },
    { code: 'OBG-004', name: 'Dating ultrasound (TVS/TAS)', category: 'Imaging', pricePkr: 2500, durationMin: 20 },
    { code: 'OBG-005', name: 'Anomaly scan (18–22 wk)', category: 'Imaging', pricePkr: 5000, durationMin: 30 },
    { code: 'OBG-006', name: 'Growth scan + AFI', category: 'Imaging', pricePkr: 3500, durationMin: 20 },
    { code: 'OBG-007', name: 'Biophysical profile / Doppler', category: 'Imaging', pricePkr: 4500, durationMin: 30 },
    { code: 'OBG-008', name: 'CTG', category: 'Diagnostics', pricePkr: 1500, durationMin: 30 },
    { code: 'OBG-009', name: 'Td (tetanus) injection incl. vaccine', category: 'Immunization', pricePkr: 500 },
    { code: 'OBG-010', name: 'Normal delivery package', category: 'Delivery', pricePkr: 85000 },
    { code: 'OBG-011', name: 'C-section package', category: 'Delivery', pricePkr: 185000 },
    { code: 'OBG-012', name: 'Postnatal check (mother + newborn)', category: 'Postnatal', pricePkr: 2500, durationMin: 20 },
    { code: 'OBG-013', name: 'IUCD insertion (device incl.)', category: 'Family planning', pricePkr: 6000, durationMin: 20 },
    { code: 'OBG-014', name: 'Pap smear collection', category: 'Screening', pricePkr: 3000, durationMin: 15 },
    { code: 'OBG-015', name: 'Infertility baseline workup (couple)', category: 'Infertility', pricePkr: 8000 },
  ],

  orderSets: [
    {
      key: 'anc-booking-labs',
      name: 'ANC Booking Labs',
      items: [
        { type: 'lab', name: 'CBC / Hb' },
        { type: 'lab', name: 'Blood group & Rh' },
        { type: 'lab', name: 'Random blood sugar' },
        { type: 'lab', name: 'HBsAg' },
        { type: 'lab', name: 'Anti-HCV' },
        { type: 'lab', name: 'Urine complete examination' },
      ],
    },
    {
      key: 'pih-workup',
      name: 'PIH / Pre-eclampsia Workup',
      items: [
        { type: 'lab', name: 'Urine protein:creatinine ratio' },
        { type: 'lab', name: 'CBC + platelets' },
        { type: 'lab', name: 'LFT' },
        { type: 'lab', name: 'RFT / uric acid' },
        { type: 'imaging', name: 'Growth scan + Doppler' },
      ],
    },
    {
      key: 'anemia-protocol',
      name: 'Anemia Protocol',
      items: [
        { type: 'lab', name: 'Ferritin' },
        { type: 'medication', name: 'Oral iron + folic acid', detail: 'Ferrous sulfate 200 mg OD + folic acid 5 mg OD' },
        { type: 'lab', name: 'Hb recheck at +4 weeks' },
      ],
    },
    {
      key: 'gdm-screen',
      name: 'GDM Screen (24–28 wk)',
      items: [{ type: 'lab', name: '75 g OGTT' }],
    },
    {
      key: 'pcos-workup',
      name: 'PCOS Workup',
      items: [
        { type: 'lab', name: 'LH / FSH' },
        { type: 'lab', name: 'TSH' },
        { type: 'lab', name: 'Prolactin' },
        { type: 'lab', name: 'Free testosterone' },
        { type: 'lab', name: 'Fasting insulin / glucose' },
        { type: 'imaging', name: 'Pelvic ultrasound' },
      ],
    },
  ],

  instruments: [],

  widgets: [
    { key: 'anc-card', route: 'anc-card', name: 'Pregnancy / ANC Card' },
    { key: 'partogram', route: 'partogram', name: 'Partogram (WHO LCG)' },
  ],
};
