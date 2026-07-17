import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class TreatmentPlanItemInput {
  @IsOptional()
  @IsUUID()
  serviceCatalogItemId?: string;

  @IsString()
  @MaxLength(60)
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsInt()
  @Min(0)
  unitPricePkr!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class CreateTreatmentPlanDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TreatmentPlanItemInput)
  items!: TreatmentPlanItemInput[];
}
