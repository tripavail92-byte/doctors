import { IsOptional, IsString, MaxLength, MinLength, IsUUID } from 'class-validator';

export class CreateDepartmentDto {
  @IsUUID()
  branchId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  specialtyKey?: string;
}
