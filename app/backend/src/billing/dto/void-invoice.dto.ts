import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VoidInvoiceDto {
  /** Why the bill was cancelled. Recorded on the invoice for audit. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
