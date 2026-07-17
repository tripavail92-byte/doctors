import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Payload for recording a single observation (vital, lab, anthropometry, ...).
 * `metric` is a stable key (see reference-ranges.ts); `unit` defaults from the
 * metric catalog when omitted.
 */
export class RecordObservationDto {
  @IsUUID()
  patientId!: string;

  @IsString()
  metric!: string;

  @IsNumber()
  value!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  // Optional backdate (ISO) — defaults to now(). Lets historical readings be imported.
  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  // Body side for paired organs — accepts OD/OS, AD/AS, L/R, both/bilateral.
  // Normalized to LEFT/RIGHT/BILATERAL server-side.
  @IsOptional()
  @IsString()
  side?: string;
}
