import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RecordConsentDto {
  @IsUUID()
  patientId!: string;

  @IsIn(['CLINICAL_PHOTOGRAPHY', 'TREATMENT', 'DATA_SHARING', 'TELEHEALTH'])
  scope!: string;

  @IsOptional()
  @IsBoolean()
  granted?: boolean;

  @IsOptional()
  @IsIn(['WRITTEN', 'VERBAL', 'DIGITAL'])
  method?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
