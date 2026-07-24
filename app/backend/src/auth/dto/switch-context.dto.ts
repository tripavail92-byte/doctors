import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SwitchContextDto {
  @IsOptional()
  @IsUUID()
  membershipId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}
