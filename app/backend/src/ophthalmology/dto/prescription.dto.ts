import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { RxType } from '@prisma/client';
import { IsBoundedJson } from '../../common/validation/is-bounded-json';

export class CreatePrescriptionDto {
  @IsUUID() patientId!: string;
  @IsOptional() @IsUUID() eyeExamId?: string;
  @IsEnum(RxType) type!: RxType;

  @IsOptional() @IsNumber() @Min(-30) @Max(30) odSphere?: number;
  @IsOptional() @IsNumber() @Min(-10) @Max(10) odCylinder?: number;
  @IsOptional() @IsInt() @Min(1) @Max(180) odAxis?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(4) odAdd?: number;

  @IsOptional() @IsNumber() @Min(-30) @Max(30) osSphere?: number;
  @IsOptional() @IsNumber() @Min(-10) @Max(10) osCylinder?: number;
  @IsOptional() @IsInt() @Min(1) @Max(180) osAxis?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(4) osAdd?: number;

  @IsOptional() @IsNumber() @Min(40) @Max(85) pdBinocularMm?: number;

  @IsOptional()
  @IsObject()
  @IsBoundedJson({ maxDepth: 3 })
  lensRecommendation?: Record<string, unknown>;

  @IsDateString() validUntil!: string;
}
