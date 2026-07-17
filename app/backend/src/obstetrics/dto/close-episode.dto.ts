import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DeliveryMode, PregnancyStatus } from '@prisma/client';

export class BabyRecordDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  sex?: string;

  @IsOptional()
  weightGrams?: number;

  @IsOptional()
  apgar1?: number;

  @IsOptional()
  apgar5?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  outcome?: string;
}

export class CloseEpisodeDto {
  /** Terminal status. ACTIVE is rejected by the service. */
  @IsEnum(PregnancyStatus)
  status!: PregnancyStatus;

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @IsEnum(DeliveryMode)
  deliveryMode?: DeliveryMode;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => BabyRecordDto)
  babyRecords?: BabyRecordDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Type(() => String)
  complications?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  closureNote?: string;
}
