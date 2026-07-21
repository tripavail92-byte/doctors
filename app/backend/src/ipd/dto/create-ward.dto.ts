import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateWardDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  floor?: string;

  // Optionally create beds in one call.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  // Duplicates collided with Bed @@unique([tenantId, wardId, code]) and the
  // uncaught P2002 rolled back the WHOLE transaction — the ward vanished too,
  // reported as a 500. Bad input should read as bad input.
  @ArrayUnique()
  bedCodes?: string[];
}
