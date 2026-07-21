import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Record that a report — usually an amended one — was communicated to the
 * referring clinician.
 *
 * The ACR asks for the date and time, the method, and the NAME of the person it
 * was delivered to. Structured fields rather than a free-text note, because a
 * note cannot answer "which amendments were never passed on".
 */
export class RecordCommunicationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  recipientName!: string;

  @IsIn(['phone', 'in person', 'electronic'])
  method!: string;

  @IsOptional()
  @IsDateString()
  communicatedAt?: string;

  /** Required by the service when method is "electronic". */
  @IsOptional()
  @IsDateString()
  acknowledgedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
