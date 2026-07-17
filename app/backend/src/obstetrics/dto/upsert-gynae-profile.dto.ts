import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ContraceptionMethod,
  CycleRegularity,
  DysmenorrheaSeverity,
  FlowAmount,
  InfertilityType,
  TubalTest,
} from '@prisma/client';
import { IsBoundedJson } from '../../common/validation/is-bounded-json';

export class UpsertGynaeProfileDto {
  @IsOptional() @IsInt() @Min(6) @Max(20) menarcheAgeYears?: number;
  @IsOptional() @IsInt() @Min(15) @Max(120) cycleLengthDays?: number;

  @IsOptional()
  @IsEnum(CycleRegularity)
  cycleRegularity?: CycleRegularity;

  @IsOptional() @IsInt() @Min(1) @Max(30) flowDurationDays?: number;

  @IsOptional()
  @IsEnum(FlowAmount)
  flowAmount?: FlowAmount;

  @IsOptional()
  @IsEnum(DysmenorrheaSeverity)
  dysmenorrhea?: DysmenorrheaSeverity;

  @IsOptional()
  @IsDateString()
  lmpRecorded?: string;

  @IsOptional()
  @IsEnum(ContraceptionMethod)
  contraceptionMethod?: ContraceptionMethod;

  @IsOptional()
  @IsDateString()
  papSmearLastDate?: string;

  @IsOptional()
  @IsObject()
  @IsBoundedJson({ maxDepth: 3 })
  pcosRotterdam?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(InfertilityType)
  infertilityType?: InfertilityType;

  @IsOptional() @IsInt() @Min(0) @Max(600) infertilityDurationMonths?: number;

  @IsOptional()
  @IsBoolean()
  partnerSemenAnalysisDone?: boolean;

  @IsOptional()
  @IsEnum(TubalTest)
  tubalPatencyTest?: TubalTest;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  priorTreatments?: string;
}
