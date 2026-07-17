import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateToothPlanItemDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsString()
  @MaxLength(60)
  catalogCode!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  toothFdi?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @Type(() => String)
  surfaces?: string[];

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  pricePkr!: number;

  /** ToothRecord condition to write when this item is completed (e.g. FILLED). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  conditionOnComplete?: string;
}

export class CompleteToothPlanItemDto {
  /** Append the procedure line to this invoice; if omitted, a new invoice is raised. */
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;
}
