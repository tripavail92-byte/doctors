import { BedStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

/**
 * Change a bed's service status.
 *
 * @IsEnum, not a bare string: the list filters on this module used
 * `status as BedStatus`, a compile-time assertion with no runtime effect, and an
 * unknown value reached Postgres as an invalid enum literal and came back as a
 * 500. A write path deserves at least the validation a read path has.
 */
export class SetBedStatusDto {
  @IsEnum(BedStatus)
  status!: BedStatus;
}
