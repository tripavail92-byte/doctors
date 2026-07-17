import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DipstickResult,
  FhrMethod,
  FmStatus,
  OedemaGrade,
  Presentation,
} from '@prisma/client';

export class AddAncVisitDto {
  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  contactNumber?: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(200)
  weightKg?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(260)
  bpSystolic?: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(160)
  bpDiastolic?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(50)
  fundalHeightCm?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(220)
  fhrBpm?: number;

  @IsOptional()
  @IsEnum(FhrMethod)
  fhrMethod?: FhrMethod;

  @IsOptional()
  @IsEnum(Presentation)
  presentation?: Presentation;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  engagementFifths?: number;

  @IsOptional()
  @IsEnum(DipstickResult)
  urineAlbumin?: DipstickResult;

  @IsOptional()
  @IsEnum(DipstickResult)
  urineSugar?: DipstickResult;

  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(20)
  hbGdl?: number;

  @IsOptional()
  @IsEnum(OedemaGrade)
  oedema?: OedemaGrade;

  @IsOptional()
  @IsEnum(FmStatus)
  fetalMovements?: FmStatus;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Type(() => String)
  dangerSigns?: string[];

  @IsOptional()
  @IsBoolean()
  ironFolateGiven?: boolean;

  @IsOptional()
  @IsBoolean()
  calciumGiven?: boolean;

  /** When set, records a Td dose (1..5) as an Immunization and links it. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  tdDoseNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tdLotNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  planNotes?: string;

  @IsOptional()
  @IsDateString()
  nextVisitDate?: string;
}
