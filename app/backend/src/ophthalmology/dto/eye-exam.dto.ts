import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  EyeFindingStatus,
  EyeSegment,
  EyeStructure,
  IopMethod,
  RefractionMethod,
  VaCondition,
  VaNotation,
} from '@prisma/client';

// Clinicians enter the eye as OD/OS; the service normalizes to BodySide.
const EYE = ['OD', 'OS', 'RIGHT', 'LEFT', 'BILATERAL', 'OU'];

export class CreateEyeExamDto {
  @IsUUID() patientId!: string;
  @IsOptional() @IsUUID() encounterId?: string;
  @IsOptional() @IsString() @MaxLength(300) chiefComplaint?: string;
}

export class AddVaDto {
  @IsIn(EYE) eye!: string;
  @IsEnum(VaCondition) condition!: VaCondition;
  @IsEnum(VaNotation) notation!: VaNotation;
  @IsString() @MaxLength(20) displayValue!: string;
  @IsOptional() @IsNumber() @Min(0.1) @Max(12) chartDistanceM?: number;
}

export class AddRefractionDto {
  @IsIn(EYE) eye!: string;
  @IsEnum(RefractionMethod) method!: RefractionMethod;
  @IsNumber() @Min(-30) @Max(30) sphere!: number;
  @IsOptional() @IsNumber() @Min(-10) @Max(10) cylinder?: number;
  @IsOptional() @IsInt() @Min(1) @Max(180) axis?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(4) add?: number;
  @IsOptional() @IsNumber() @Min(40) @Max(85) pdBinocularMm?: number;
  @IsOptional() @IsString() @MaxLength(20) vaAchieved?: string;
}

export class AddIopDto {
  @IsIn(EYE) eye!: string;
  @IsNumber() @Min(0) @Max(90) valueMmHg!: number;
  @IsEnum(IopMethod) method!: IopMethod;
  @IsOptional() @IsInt() @Min(300) @Max(700) cctMicrons?: number;
  @IsOptional() postDilation?: boolean;
}

export class AddSegmentFindingDto {
  @IsIn(EYE) eye!: string;
  @IsEnum(EyeSegment) segment!: EyeSegment;
  @IsEnum(EyeStructure) structure!: EyeStructure;
  @IsEnum(EyeFindingStatus) status!: EyeFindingStatus;
  @IsOptional() @IsString() @MaxLength(40) findingCode?: string;
  @IsOptional() @IsString() @MaxLength(20) gradeValue?: string;
  @IsOptional() @IsString() @MaxLength(500) freeText?: string;
}
