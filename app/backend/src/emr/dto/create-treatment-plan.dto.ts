import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  Max,
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

  // Same bounds as InvoiceLineInput, and for the same reason: capped well under
  // int4 so a single line (or the summed total) cannot overflow.
  //
  // These were missing here while the invoice DTO carried them, and both DTOs
  // feed the SAME BillingService.buildLines() via createFromPlan. So the plan
  // path minted lines the /invoices path refuses — quantity 20,000 sailed through
  // — and an unbounded unitPricePkr * quantity overflowed int4 into an HTTP 500
  // instead of a 400. Validation parity is not tidiness: a guard that only covers
  // one of two doors is not a guard.
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  unitPricePkr!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
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
