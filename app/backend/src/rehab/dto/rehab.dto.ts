import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RehabEpisodeStatus, RehabSessionStatus } from '@prisma/client';
import { IsBoundedJson } from '../../common/validation/is-bounded-json';

const SIDE = ['LEFT', 'RIGHT', 'BILATERAL', 'L', 'R'];

export class CreateEpisodeDto {
  @IsUUID() patientId!: string;
  @IsString() @MaxLength(160) diagnosis!: string;
  @IsString() @MaxLength(60) bodyRegion!: string;
  @IsOptional() @IsDateString() onsetDate?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) sessionsPlanned?: number;
  @IsOptional() @IsString() @MaxLength(500) goals?: string;

  /** Comorbidity flags for the modality-safety engine (pacemaker, pregnant, ...). */
  @IsOptional()
  @IsObject()
  @IsBoundedJson({ maxDepth: 2, maxNodes: 40 })
  safetyIntake?: Record<string, boolean>;
}

export class CreateAssessmentDto {
  @IsOptional() @IsUUID() encounterId?: string;
  @IsOptional() @IsString() @MaxLength(300) posture?: string;
  @IsOptional() @IsString() @MaxLength(300) gait?: string;
  @IsOptional() @IsString() @MaxLength(300) palpation?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;

  @IsOptional()
  @IsObject()
  @IsBoundedJson({ maxDepth: 3, maxNodes: 100 })
  specialTests?: Record<string, unknown>;
}

export class AddRomDto {
  @IsString() @MaxLength(30) joint!: string;
  @IsString() @MaxLength(30) movement!: string;
  @IsOptional() @IsIn(SIDE) side?: string;
  @IsOptional() @IsInt() @Min(0) @Max(200) activeDegrees?: number;
  @IsOptional() @IsInt() @Min(0) @Max(200) passiveDegrees?: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class AddSessionDto {
  @IsOptional() @IsUUID() encounterId?: string;
  @IsOptional() @IsEnum(RehabSessionStatus) status?: RehabSessionStatus;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Type(() => String)
  modalities!: string[];

  @IsOptional() @IsInt() @Min(0) @Max(10) painPre?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10) painPost?: number;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;

  /** Senior override for a BLOCK-level modality contraindication. */
  @IsOptional() @IsBoolean() overrideBlock?: boolean;
  @IsOptional() @IsString() @MaxLength(300) overrideReason?: string;
}

export class AddExerciseDto {
  @IsString() @MaxLength(40) exerciseCode!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsInt() @Min(1) @Max(20) sets?: number;
  @IsOptional() @IsInt() @Min(1) @Max(200) reps?: number;
  @IsOptional() @IsInt() @Min(1) @Max(300) holdSeconds?: number;
  @IsOptional() @IsInt() @Min(1) @Max(21) frequencyPerWeek?: number;
  @IsOptional() @IsString() @MaxLength(300) progression?: string;
  @IsOptional() @IsString() @MaxLength(500) instructions?: string;
}

export class DischargeDto {
  @IsEnum(RehabEpisodeStatus) status!: RehabEpisodeStatus;
  @IsOptional() @IsString() @MaxLength(1000) dischargeNote?: string;
}
