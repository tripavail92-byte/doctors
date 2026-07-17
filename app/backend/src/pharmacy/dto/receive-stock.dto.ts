import {
  IsDateString,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ReceiveStockDto {
  @IsString()
  @MaxLength(30)
  formularyCode!: string;

  @IsString()
  @MaxLength(40)
  batchNo!: string;

  @IsDateString()
  expiry!: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity!: number;

  @IsInt()
  @Min(0)
  @Max(10_000_000)
  unitCostPkr!: number;
}
