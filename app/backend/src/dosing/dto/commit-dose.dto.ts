import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/**
 * Commit a computed dose into the medico-legal DoseCalculationLog. The weight
 * must be re-confirmed by the clinician (stale weight is dangerous in fast-
 * growing infants); the server recomputes from the catalog rule and refuses to
 * commit a dose that is blocked (e.g. below the rule's minimum age).
 */
export class CommitDoseDto {
  @IsUUID()
  patientId!: string;

  @IsString()
  drug!: string;

  /** Clinician-confirmed weight (kg). */
  @IsNumber()
  @Min(0.1)
  weightKg!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ageMonths?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  concentrationMgPerMl?: number;

  @IsOptional()
  @IsUUID()
  encounterId?: string;
}
