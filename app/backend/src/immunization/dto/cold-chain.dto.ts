import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AefiOutcome, AefiSeverity, VvmStage } from '@prisma/client';
import { SERIOUS_CRITERIA } from '../aefi.engine';

export class ReceiveBatchDto {
  @IsString() @MaxLength(20) vaccineCode!: string;
  @IsString() @MaxLength(40) lotNumber!: string;
  @IsOptional() @IsString() @MaxLength(80) manufacturer?: string;

  @IsDateString() expiry!: string;

  /**
   * VVM stage AT RECEIPT. Recorded on arrival, not assumed: a shipment can
   * arrive already heat-damaged, and that is the moment to catch it.
   */
  @IsOptional() @IsEnum(VvmStage) vvmStage?: VvmStage;

  @IsInt() @Min(1) @Max(100_000) dosesReceived!: number;
  @IsOptional() @IsString() @MaxLength(80) storageLocation?: string;
}

export class UpdateVvmDto {
  @IsEnum(VvmStage) vvmStage!: VvmStage;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class DiscardBatchDto {
  @IsString() @MaxLength(200) reason!: string;
}

export class ReportAefiDto {
  @IsUUID() patientId!: string;
  @IsOptional() @IsUUID() immunizationId?: string;
  @IsOptional() @IsUUID() batchId?: string;

  @IsDateString() onsetAt!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  symptoms!: string[];

  /**
   * WHO's serious criteria. Ticking any one makes the event SERIOUS and
   * reportable — the engine will not let a stated severity override it.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsIn(SERIOUS_CRITERIA.map((c) => c.key) as unknown as string[], { each: true })
  criteriaMet?: string[];

  /** The clinician's own view. May RAISE the computed severity, never lower it. */
  @IsOptional() @IsEnum(AefiSeverity) severity?: AefiSeverity;
  @IsOptional() @IsEnum(AefiOutcome) outcome?: AefiOutcome;
  @IsOptional() @IsString() @MaxLength(2000) narrative?: string;
}

export class MarkReportedDto {
  @IsOptional() @IsDateString() reportedAt?: string;
}
