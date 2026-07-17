import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PayrollDeductionInput {
  @IsUUID()
  employeeId!: string;

  @IsInt()
  @Min(1)
  amountPkr!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;
}

export class RunPayrollDto {
  // Period as YYYY-MM (e.g. "2026-07").
  @Matches(/^\d{4}-\d{2}$/)
  period!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PayrollDeductionInput)
  deductions?: PayrollDeductionInput[];
}
