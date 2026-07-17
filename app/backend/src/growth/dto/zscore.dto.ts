import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { GrowthIndicator } from '../growth-engine';

const INDICATORS: GrowthIndicator[] = ['wfa', 'lhfa', 'wfh', 'bmifa', 'hcfa'];

/** Direct z-score calculation input for POST /growth/zscore. */
export class ZscoreDto {
  @IsIn(['male', 'female'])
  sex!: 'male' | 'female';

  @IsIn(INDICATORS)
  indicator!: GrowthIndicator;

  @IsNumber()
  @Min(0)
  value!: number;

  /** Age in months — required for all indicators except weight-for-length. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  ageMonths?: number;

  /** Length/height in cm — required for weight-for-length (wfh). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthCm?: number;
}
