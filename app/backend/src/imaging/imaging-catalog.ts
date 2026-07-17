// Imaging study catalog (reference data). Illustrative PKR prices.

export interface ImagingStudy {
  code: string;
  name: string;
  modality: string; // X-ray / Ultrasound / CT / MRI / Mammography
  bodyPart: string;
  pricePkr: number;
}

export const IMAGING_STUDIES: ImagingStudy[] = [
  { code: 'CXR', name: 'Chest X-ray (PA)', modality: 'X-ray', bodyPart: 'Chest', pricePkr: 1200 },
  { code: 'XR_KNEE', name: 'Knee X-ray (AP/Lat)', modality: 'X-ray', bodyPart: 'Knee', pricePkr: 1500 },
  { code: 'US_ABD', name: 'Ultrasound abdomen', modality: 'Ultrasound', bodyPart: 'Abdomen', pricePkr: 3000 },
  { code: 'US_PELVIS', name: 'Ultrasound pelvis', modality: 'Ultrasound', bodyPart: 'Pelvis', pricePkr: 3000 },
  { code: 'CT_HEAD', name: 'CT head (plain)', modality: 'CT', bodyPart: 'Head', pricePkr: 12000 },
  { code: 'CT_CHEST', name: 'CT chest (contrast)', modality: 'CT', bodyPart: 'Chest', pricePkr: 15000 },
  { code: 'MRI_BRAIN', name: 'MRI brain', modality: 'MRI', bodyPart: 'Brain', pricePkr: 25000 },
  { code: 'MRI_LSPINE', name: 'MRI lumbar spine', modality: 'MRI', bodyPart: 'L-spine', pricePkr: 22000 },
  { code: 'MAMMO', name: 'Mammography (bilateral)', modality: 'Mammography', bodyPart: 'Breast', pricePkr: 5000 },
];

const BY_CODE = new Map(IMAGING_STUDIES.map((s) => [s.code, s]));
export const getStudy = (code: string): ImagingStudy | undefined => BY_CODE.get(code);
