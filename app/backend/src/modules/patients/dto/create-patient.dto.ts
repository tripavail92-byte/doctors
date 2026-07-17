import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsDateString,
  IsIn,
} from 'class-validator';

/**
 * Payload for creating a Patient. `tenantId` is never accepted from the
 * client — it is derived from the request's tenant context (JWT / RLS).
 */
export class CreatePatientDto {
  // Medical Record Number (tenant-local identifier).
  @IsString()
  @IsNotEmpty()
  mrn!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  // ISO date string, e.g. "1990-04-21". Optional.
  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsIn(['male', 'female', 'other'])
  gender?: string;
}