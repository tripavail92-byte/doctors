import {
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
  LiquorAssessment,
  PlacentaSite,
  Presentation,
  ScanType,
} from '@prisma/client';

export class AddUltrasoundDto {
  @IsOptional()
  @IsDateString()
  scanDate?: string;

  @IsEnum(ScanType)
  scanType!: ScanType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  fetusNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  studyId?: string;

  // Biometry (mm). EFW computed server-side (Hadlock).
  @IsOptional() @IsNumber() @Min(1) @Max(120) crlMm?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(60) gsMm?: number;
  @IsOptional() @IsNumber() @Min(10) @Max(120) bpdMm?: number;
  @IsOptional() @IsNumber() @Min(30) @Max(400) hcMm?: number;
  @IsOptional() @IsNumber() @Min(30) @Max(450) acMm?: number;
  @IsOptional() @IsNumber() @Min(5) @Max(100) flMm?: number;

  @IsOptional() @IsInt() @Min(4) @Max(44) gaByUsgWeeks?: number;
  @IsOptional() @IsInt() @Min(0) @Max(6) gaByUsgDays?: number;

  @IsOptional()
  @IsBoolean()
  fetalHeartActivity?: boolean;

  @IsOptional() @IsInt() @Min(60) @Max(220) fhrBpm?: number;

  @IsOptional()
  @IsEnum(Presentation)
  presentation?: Presentation;

  @IsOptional()
  @IsEnum(PlacentaSite)
  placentaSite?: PlacentaSite;

  @IsOptional() @IsNumber() @Min(0) @Max(50) liquorAfiCm?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(20) liquorDvpCm?: number;

  @IsOptional()
  @IsEnum(LiquorAssessment)
  liquorAssessment?: LiquorAssessment;

  @IsOptional() @IsNumber() @Min(0) @Max(80) cervicalLengthMm?: number;

  @IsString()
  @MaxLength(2000)
  impression!: string;
}
