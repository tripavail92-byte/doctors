import { IsEnum } from 'class-validator';
import { TreatmentPlanStatus } from '@prisma/client';

export class UpdatePlanStatusDto {
  @IsEnum(TreatmentPlanStatus)
  status!: TreatmentPlanStatus;
}
