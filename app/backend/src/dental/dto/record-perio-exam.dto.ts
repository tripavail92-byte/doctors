import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { FurcationGrade } from '@prisma/client';

export class PerioToothInputDto {
  @IsString()
  @MaxLength(3)
  toothFdi!: string;

  @IsArray() @ArrayMinSize(6) @ArrayMaxSize(6) @IsInt({ each: true }) @Min(0, { each: true }) @Max(20, { each: true })
  pocketMm!: number[];

  @IsArray() @ArrayMinSize(6) @ArrayMaxSize(6) @IsInt({ each: true }) @Min(0, { each: true }) @Max(20, { each: true })
  recessionMm!: number[];

  @IsArray() @ArrayMinSize(6) @ArrayMaxSize(6) @IsBoolean({ each: true })
  bleeding!: boolean[];

  @IsOptional() @IsArray() @ArrayMinSize(6) @ArrayMaxSize(6) @IsBoolean({ each: true })
  suppuration?: boolean[];

  @IsOptional() @IsArray() @ArrayMinSize(6) @ArrayMaxSize(6) @IsBoolean({ each: true })
  plaque?: boolean[];

  @IsOptional()
  @IsEnum(FurcationGrade)
  furcation?: FurcationGrade;

  @IsOptional() @IsInt() @Min(0) @Max(3)
  mobility?: number;
}

export class RecordPerioExamDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  examType?: string; // FULL | BPE_SCREEN

  /** BPE screen: 6 sextant codes 0-4. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(4, { each: true })
  bpeSextants?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => PerioToothInputDto)
  teeth?: PerioToothInputDto[];
}
