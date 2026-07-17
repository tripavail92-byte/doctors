import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AmnioticFluid, DipstickResult, FhrDecel } from '@prisma/client';

/**
 * Partogram entries are append-only. `recordedAt` is set server-side (client
 * clock ignored). Corrections reference the corrected entry via correctsEntryId.
 */
export class AddPartogramEntryDto {
  @IsOptional()
  @IsUUID()
  correctsEntryId?: string;

  @IsOptional() @IsInt() @Min(0) @Max(10) cervicalDilationCm?: number;
  @IsOptional() @IsInt() @Min(0) @Max(5) descentFifths?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10) contractionsPer10Min?: number;
  @IsOptional() @IsInt() @Min(0) @Max(180) contractionDurationSec?: number;
  @IsOptional() @IsInt() @Min(60) @Max(220) fhrBpm?: number;

  @IsOptional()
  @IsEnum(FhrDecel)
  fhrDeceleration?: FhrDecel;

  @IsOptional()
  @IsEnum(AmnioticFluid)
  amnioticFluid?: AmnioticFluid;

  @IsOptional() @IsInt() @Min(0) @Max(3) caput?: number;
  @IsOptional() @IsInt() @Min(0) @Max(3) moulding?: number;
  @IsOptional() @IsInt() @Min(30) @Max(220) maternalPulse?: number;
  @IsOptional() @IsInt() @Min(60) @Max(260) bpSystolic?: number;
  @IsOptional() @IsInt() @Min(30) @Max(160) bpDiastolic?: number;
  @IsOptional() @IsNumber() @Min(33) @Max(43) temperatureC?: number;

  @IsOptional() @IsString() @MaxLength(60) urineOutput?: string;

  @IsOptional()
  @IsEnum(DipstickResult)
  urineProtein?: DipstickResult;

  @IsOptional() @IsNumber() @Min(0) @Max(100) oxytocinUnitsPerL?: number;
  @IsOptional() @IsInt() @Min(0) @Max(120) oxytocinDropsPerMin?: number;
  @IsOptional() @IsString() @MaxLength(200) medicines?: string;
  @IsOptional() @IsString() @MaxLength(200) ivFluids?: string;
  @IsOptional() @IsString() @MaxLength(500) assessment?: string;
  @IsOptional() @IsString() @MaxLength(500) plan?: string;
}

export class ClosePartogramDto {
  @IsEnum({ DELIVERED: 'DELIVERED', REFERRED: 'REFERRED', CS_DECIDED: 'CS_DECIDED', CLOSED: 'CLOSED' })
  status!: 'DELIVERED' | 'REFERRED' | 'CS_DECIDED' | 'CLOSED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  closureNote?: string;
}
