import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePhotoSessionDto {
  @IsUUID()
  patientId!: string;

  @IsIn(['BEFORE', 'AFTER', 'PROGRESS', 'CLINICAL'])
  kind!: string;

  // Optional explicit consent; if omitted the patient's latest valid
  // CLINICAL_PHOTOGRAPHY consent is used (and required).
  @IsOptional()
  @IsUUID()
  consentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
