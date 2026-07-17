import {
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApplianceType, OrthoEventType } from '@prisma/client';
import { IsBoundedJson } from '../../common/validation/is-bounded-json';

export class CreateOrthoCaseDto {
  @IsUUID()
  patientId!: string;

  @IsEnum(ApplianceType)
  appliance!: ApplianceType;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  angleClass?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  plannedMonths?: number;

  /** Per-tooth appliance map, e.g. {"16":"band","11":"bracket"}. */
  @IsObject()
  @IsBoundedJson({ maxDepth: 2, maxNodes: 200 })
  applianceMap!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  photoTimelineTag?: string;
}

export class AddOrthoEventDto {
  @IsEnum(OrthoEventType)
  eventType!: OrthoEventType;

  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsOptional() @IsString() @MaxLength(40) wireUpper?: string;
  @IsOptional() @IsString() @MaxLength(40) wireLower?: string;
  @IsOptional() @IsString() @MaxLength(60) elastics?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
