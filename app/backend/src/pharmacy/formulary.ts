// Pharmacy formulary (reference data). Retail prices are illustrative PKR.

export interface FormularyDrug {
  code: string;
  name: string;
  form: string;
  strength: string;
  unit: string;
  pricePkr: number;
  controlled: boolean;
}

export const FORMULARY: FormularyDrug[] = [
  { code: 'PARA500', name: 'Paracetamol 500mg tab', form: 'tablet', strength: '500mg', unit: 'tablet', pricePkr: 5, controlled: false },
  { code: 'AMOX250', name: 'Amoxicillin 250mg cap', form: 'capsule', strength: '250mg', unit: 'capsule', pricePkr: 12, controlled: false },
  { code: 'AMOXSYR', name: 'Amoxicillin syrup 125mg/5mL', form: 'syrup', strength: '125mg/5mL', unit: 'bottle', pricePkr: 180, controlled: false },
  { code: 'IBU400', name: 'Ibuprofen 400mg tab', form: 'tablet', strength: '400mg', unit: 'tablet', pricePkr: 8, controlled: false },
  { code: 'ORS', name: 'ORS sachet (WHO)', form: 'sachet', strength: '', unit: 'sachet', pricePkr: 15, controlled: false },
  { code: 'OMEP20', name: 'Omeprazole 20mg cap', form: 'capsule', strength: '20mg', unit: 'capsule', pricePkr: 10, controlled: false },
  { code: 'CETIRIZINE', name: 'Cetirizine 10mg tab', form: 'tablet', strength: '10mg', unit: 'tablet', pricePkr: 6, controlled: false },
  { code: 'TRAMADOL50', name: 'Tramadol 50mg cap', form: 'capsule', strength: '50mg', unit: 'capsule', pricePkr: 20, controlled: true },
];

const BY_CODE = new Map(FORMULARY.map((d) => [d.code, d]));
export const getDrug = (code: string): FormularyDrug | undefined => BY_CODE.get(code);
