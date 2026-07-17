import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EddMethod, RhFactor } from '@prisma/client';

export class StartEpisodeDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsDateString()
  lmp?: string;

  @IsOptional()
  @IsBoolean()
  lmpReliable?: boolean;

  @IsOptional()
  @IsEnum(EddMethod)
  eddMethod?: EddMethod;

  /** Provided when dating is established by USG at booking. */
  @IsOptional()
  @IsDateString()
  eddByUsg?: string;

  @IsInt()
  @Min(1)
  @Max(30)
  gravida!: number;

  @IsInt()
  @Min(0)
  @Max(30)
  para!: number;

  @IsInt()
  @Min(0)
  @Max(30)
  abortus!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  livingChildren?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  bloodGroup?: string;

  @IsOptional()
  @IsEnum(RhFactor)
  rhFactor?: RhFactor;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(220)
  heightCm?: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(200)
  prePregnancyWeightKg?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  prevCsCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  fetusCount?: number;

  /** Clinician-selected risk flags (auto flags are merged in server-side). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Type(() => String)
  riskFlags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  riskNotes?: string;

  /** Optional ANC package (TreatmentPlan) linkage id. */
  @IsOptional()
  @IsUUID()
  treatmentPlanId?: string;
}
