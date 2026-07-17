import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(80)
  designation!: string;

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  baseSalaryPkr!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  allowancesPkr?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cnic?: string;

  @IsOptional()
  @IsDateString()
  joinDate?: string;
}
