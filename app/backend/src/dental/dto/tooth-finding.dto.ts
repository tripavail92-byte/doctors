import {
  ArrayMaxSize,
  IsArray,
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
import { FindingStatus, ToothType } from '@prisma/client';
import { SURFACES } from '../tooth-reference';

export class RecordFindingDto {
  @IsUUID() patientId!: string;
  @IsOptional() @IsUUID() encounterId?: string;

  /** FDI: "11".."48" permanent, "51".."85" primary. Validated by the engine. */
  @IsString() @MaxLength(2) toothFdi!: string;

  /**
   * NOTE: there is deliberately no `archSide` field. The side is derived from
   * the quadrant digit — the tooth number already says which side it is on, so
   * accepting a side from the client would let 11 be charted as LEFT.
   */
  @IsOptional() @IsEnum(ToothType) toothType?: ToothType;
  @IsOptional() @IsString() @MaxLength(80) supernumeraryRef?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsIn(SURFACES as unknown as string[], { each: true })
  surfaces?: string[];

  @IsString() @MaxLength(20) condition!: string;
  @IsOptional() @IsEnum(FindingStatus) status?: FindingStatus;

  /** Miller 0-3. Only meaningful when the condition is MOBILE. */
  @IsOptional() @IsInt() @Min(0) @Max(3) mobilityGrade?: number;

  @IsOptional() @IsString() @MaxLength(300) note?: string;

  /**
   * The finding this one corrects. The prior row is superseded, never edited —
   * an amended chart must still show what was originally recorded.
   */
  @IsOptional() @IsUUID() supersedesId?: string;
}
