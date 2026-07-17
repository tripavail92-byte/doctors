import { IsEnum } from 'class-validator';
import { EncounterStatus } from '@prisma/client';

export class UpdateEncounterStatusDto {
  @IsEnum(EncounterStatus)
  status!: EncounterStatus;
}
