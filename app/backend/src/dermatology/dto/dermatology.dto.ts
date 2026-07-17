import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  PhototherapyBodySite,
  PhototherapyModality,
  PhototherapyStatus,
} from '@prisma/client';
import { IsBoundedJson } from '../../common/validation/is-bounded-json';

// Normalise a safety-critical grade BEFORE class-transformer's implicit
// conversion can coerce "" / " " / false / true into 0 / 1 and impersonate an
// asserted erythema reaction. A blistered patient's grade must never be
// manufactured from an empty field: anything that is not genuinely a number or a
// clean integer string becomes NaN, which fails @IsInt and returns a 400 — the
// same refusal the caller gets for a missing grade. Undefined/null pass through
// so @IsOptional still allows an omitted field.
function normalizeGrade({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && /^-?\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return NaN;
}
import { GRADING_INSTRUMENTS } from '../engines/grading.engine';

const SIDE = ['LEFT', 'RIGHT', 'BILATERAL', 'L', 'R'];

export class GradeDto {
  @IsUUID() patientId!: string;

  @IsIn(GRADING_INSTRUMENTS)
  instrument!: string;

  /** Region/sign entries; shape is per-instrument and validated by the engine. */
  @IsObject()
  @IsBoundedJson({ maxDepth: 3, maxNodes: 200 })
  answers!: Record<string, unknown>;

  // NOTE: there is deliberately no `child` field. EASI's region weights are
  // derived server-side from the patient's DOB — accepting them from the client
  // would be the same hole as accepting a computed severity band.
}

export class CreateCourseDto {
  @IsUUID() patientId!: string;

  @IsOptional() @IsEnum(PhototherapyModality) modality?: PhototherapyModality;
  @IsOptional() @IsEnum(PhototherapyBodySite) bodySite?: PhototherapyBodySite;
  @IsOptional() @IsIn(SIDE) laterality?: string;

  /** Fitzpatrick I-VI. Unknown skin type blocks the course (safety). */
  @IsInt() @Min(1) @Max(6) fitzpatrickType!: number;

  @IsString() @MaxLength(80) indication!: string;

  // Only one protocol table exists. Free text here was stored and never
  // resolved, so "NBUVB_AGGRESSIVE" would be accepted, recorded, and silently
  // dosed off the standard table — the same hole the modality guard closes.
  @IsOptional() @IsIn(['NBUVB_STANDARD']) protocolKey?: string;
  @IsOptional() @IsInt() @Min(1) @Max(50) incrementPct?: number;
  /**
   * Measured MED; when present it overrides the skin-type start dose.
   *
   * Capped at 3000: real NB-UVB MEDs sit in the hundreds of mJ/cm2, and the old
   * 10000 bound was wide enough for a J/cm2-for-mJ/cm2 unit slip to pass DTO
   * validation. createCourse additionally rejects any MED giving a start dose
   * more than double the protocol start for that skin type.
   */
  @IsOptional() @IsInt() @Min(1) @Max(3000) medMj?: number;
}

export class RecordSessionDto {
  /**
   * Erythema reaction to the PREVIOUS delivered session (0-3). This gates
   * escalation, so it is captured before the engine suggests a dose.
   */
  @IsOptional()
  @Transform(normalizeGrade, { toClassOnly: true })
  @IsInt()
  @Min(0)
  @Max(3)
  lastErythemaGrade?: number;

  /** Clinician override of the suggested dose. Requires a typed reason. */
  @IsOptional() @IsInt() @Min(1) @Max(10000) overrideDoseMj?: number;
  @IsOptional() @IsString() @MaxLength(300) overrideReason?: string;

  /** Deliver despite a burn-interlock hold. Requires a typed reason. */
  @IsOptional() @IsBoolean() overrideBurnHold?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(20000) lampHours?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class UpdateCourseStatusDto {
  @IsEnum(PhototherapyStatus) status!: PhototherapyStatus;
}

export class CreateLesionDto {
  @IsUUID() patientId!: string;
  @IsOptional() @IsUUID() encounterId?: string;

  @IsString() @MaxLength(40) bodyRegion!: string;
  /** Required for procedures to prevent wrong-site labelling. */
  @IsOptional() @IsIn(SIDE) laterality?: string;

  @IsIn(['macule', 'papule', 'plaque', 'nodule', 'pustule', 'patch'])
  morphology!: string;

  @IsOptional() @IsString() @MaxLength(12) diagnosisCode?: string;

  @IsOptional()
  @IsObject()
  @IsBoundedJson({ maxDepth: 2, maxNodes: 20 })
  abcde?: Record<string, unknown>;
}
