import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

/**
 * Payload for booking an Appointment. `tenantId` is derived from tenant
 * context, never accepted from the client.
 */
export class CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  // Provider is a User id (the treating doctor / clinician).
  @IsString()
  @IsNotEmpty()
  providerId!: string;

  // ISO datetime strings.
  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;

  @IsString()
  @IsNotEmpty()
  service!: string;

  // Defaults to BOOKED in the service when omitted.
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}