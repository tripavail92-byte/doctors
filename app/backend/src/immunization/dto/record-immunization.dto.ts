import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RecordImmunizationDto {
  @IsUUID()
  patientId!: string;

  @IsString()
  @MaxLength(20)
  vaccineCode!: string;

  @IsString()
  @MaxLength(10)
  dose!: string;

  @IsOptional()
  @IsDateString()
  givenAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  lotNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  site?: string;
}
