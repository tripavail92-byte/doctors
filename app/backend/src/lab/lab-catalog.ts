// Lab test catalog (reference data). Reference ranges are adult defaults; a real
// LIS layers age/sex-specific ranges and analyzer-specific units.

export interface LabTest {
  code: string;
  name: string;
  department: string;
  specimen: string;
  unit: string;
  refLow?: number;
  refHigh?: number;
  pricePkr: number;
  valueType: 'numeric' | 'text';
}

export const LAB_TESTS: LabTest[] = [
  { code: 'HB', name: 'Hemoglobin', department: 'Hematology', specimen: 'EDTA blood', unit: 'g/dL', refLow: 12, refHigh: 16, pricePkr: 400, valueType: 'numeric' },
  { code: 'WBC', name: 'White cell count', department: 'Hematology', specimen: 'EDTA blood', unit: '10^9/L', refLow: 4, refHigh: 11, pricePkr: 400, valueType: 'numeric' },
  { code: 'PLT', name: 'Platelet count', department: 'Hematology', specimen: 'EDTA blood', unit: '10^9/L', refLow: 150, refHigh: 400, pricePkr: 400, valueType: 'numeric' },
  { code: 'GLU_F', name: 'Fasting glucose', department: 'Chemistry', specimen: 'Fluoride plasma', unit: 'mg/dL', refLow: 70, refHigh: 100, pricePkr: 300, valueType: 'numeric' },
  { code: 'HBA1C', name: 'HbA1c', department: 'Chemistry', specimen: 'EDTA blood', unit: '%', refLow: 4, refHigh: 5.7, pricePkr: 1200, valueType: 'numeric' },
  { code: 'CREAT', name: 'Creatinine', department: 'Chemistry', specimen: 'Serum', unit: 'mg/dL', refLow: 0.6, refHigh: 1.3, pricePkr: 400, valueType: 'numeric' },
  { code: 'UREA', name: 'Urea', department: 'Chemistry', specimen: 'Serum', unit: 'mg/dL', refLow: 15, refHigh: 40, pricePkr: 400, valueType: 'numeric' },
  { code: 'ALT', name: 'ALT (SGPT)', department: 'Chemistry', specimen: 'Serum', unit: 'U/L', refLow: 7, refHigh: 56, pricePkr: 500, valueType: 'numeric' },
  { code: 'TCHOL', name: 'Total cholesterol', department: 'Chemistry', specimen: 'Serum', unit: 'mg/dL', refHigh: 200, pricePkr: 500, valueType: 'numeric' },
  { code: 'LDL', name: 'LDL cholesterol', department: 'Chemistry', specimen: 'Serum', unit: 'mg/dL', refHigh: 100, pricePkr: 600, valueType: 'numeric' },
  { code: 'TSH', name: 'TSH', department: 'Endocrinology', specimen: 'Serum', unit: 'mIU/L', refLow: 0.4, refHigh: 4.0, pricePkr: 1000, valueType: 'numeric' },
  { code: 'CRP', name: 'C-reactive protein', department: 'Immunology', specimen: 'Serum', unit: 'mg/L', refLow: 0, refHigh: 5, pricePkr: 800, valueType: 'numeric' },
  { code: 'URINE_CS', name: 'Urine culture & sensitivity', department: 'Microbiology', specimen: 'Urine', unit: '', pricePkr: 900, valueType: 'text' },
];

const BY_CODE = new Map(LAB_TESTS.map((t) => [t.code, t]));
export const getTest = (code: string): LabTest | undefined => BY_CODE.get(code);
