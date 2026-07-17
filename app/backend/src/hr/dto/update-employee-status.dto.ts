import { IsEnum } from 'class-validator';
import { EmployeeStatus } from '@prisma/client';

export class UpdateEmployeeStatusDto {
  @IsEnum(EmployeeStatus)
  status!: EmployeeStatus;
}
