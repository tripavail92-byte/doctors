import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class InvoiceLineInput {
  @IsOptional()
  @IsUUID()
  serviceCatalogItemId?: string;

  @IsString()
  @MaxLength(60)
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  // Capped well under int4 so a single line (or the summed total) can't overflow.
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  unitPricePkr!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity?: number;

  // --- Laterality -----------------------------------------------------------
  // A bilateral procedure is two procedures. Without a bundled both-sides price
  // it bills as two lines, so the invoice (and the FBR submission) says what was
  // actually done rather than hiding half the work in one line.
  @IsOptional()
  @IsIn(['LEFT', 'RIGHT', 'BILATERAL', 'L', 'R', 'left', 'right', 'bilateral'])
  side?: string;

  /** From the catalog item: is this procedure performed per-side at all? */
  @IsOptional()
  @IsBoolean()
  lateralizable?: boolean;

  /** Bundled both-sides price. Omit to bill two lines at the unit price. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  bilateralPricePkr?: number;

  /** Drives the label: eye -> OD/OS, ear -> AD/AS, otherwise L/R. */
  @IsOptional()
  @IsIn(['eye', 'ear'])
  sideContext?: 'eye' | 'ear';
}

/** Raise an invoice from a treatment plan (`planId`) OR explicitly (`patientId` + `items`). */
export class CreateInvoiceDto {
  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineInput)
  items?: InvoiceLineInput[];
}
