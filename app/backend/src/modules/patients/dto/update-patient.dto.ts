import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsDateString,
  IsIn,
} from 'class-validator';

/**
 * All CreatePatientDto fields, made optional for partial updates.
 * Declared explicitly (rather than via @nestjs/mapped-types) to keep the
 * dependency surface small.
 */
export class UpdatePatientDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  mrn?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsIn(['male', 'female', 'other'])
  gender?: string;
}
