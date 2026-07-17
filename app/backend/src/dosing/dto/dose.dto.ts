import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * Body for POST /dose. Supply either a `drug` key (uses the catalog regimen)
 * or explicit `mgPerKgPerDay` + `dosesPerDay`. `weightKg` is always required.
 */
export class DoseDto {
  @IsNumber()
  @Min(0.1)
  weightKg!: number;

  @IsOptional()
  @IsString()
  drug?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mgPerKgPerDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  dosesPerDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSingleMg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDailyMg?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ageMonths?: number;

  /** Chosen liquid concentration (mg/mL) to convert the dose to a volume. */
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  concentrationMgPerMl?: number;
}
