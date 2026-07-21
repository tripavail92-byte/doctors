import { ImagingReportStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Amend a finalized report.
 *
 * `findings` and `impression` are REQUIRED and carry the complete replacement
 * text, not a delta. IHE: "If an amended imaging result is sent with a status of
 * 'C', the entire content of the changed imaging result shall be sent.
 * Differential content alone... shall not be sent."
 */
export class AmendImagingReportDto {
  @IsString()
  @MinLength(1)
  findings!: string;

  @IsString()
  @MinLength(1)
  impression!: string;

  /**
   * Why it changed. Required, and deliberately so — the reader needs it more
   * than the system does, and an amendment with no stated reason is the thing
   * that makes a chart argument unresolvable a year later.
   */
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  /**
   * Which kind of change, from the FHIR vocabulary. PRELIMINARY and FINAL are
   * excluded: an amendment is by definition post-final, so offering them would
   * let a caller quietly relabel a correction as an original.
   */
  @IsEnum(ImagingReportStatus)
  @IsIn([
    ImagingReportStatus.APPENDED,
    ImagingReportStatus.CORRECTED,
    ImagingReportStatus.AMENDED,
    ImagingReportStatus.ENTERED_IN_ERROR,
  ])
  status!: ImagingReportStatus;
}
