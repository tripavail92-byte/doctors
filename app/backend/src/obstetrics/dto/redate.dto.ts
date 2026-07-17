import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class RedateDto {
  /** New working EDD from USG dating. */
  @IsDateString()
  eddByUsg!: string;

  /** GA (completed weeks) at the dating scan — picks the ACOG threshold. */
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(44)
  gaWeeksAtScan?: number;

  /** Required reason — writes to the audit trail (EDD changes are governed). */
  @IsString()
  @MaxLength(500)
  reason!: string;
}
