import { UserRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateMembershipDto {
  @IsUUID()
  userId!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsBoolean()
  isDefaultContext?: boolean;
}
