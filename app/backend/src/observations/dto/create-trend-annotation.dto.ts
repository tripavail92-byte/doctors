import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateTrendAnnotationDto {
  @IsUUID()
  patientId!: string;

  @IsString()
  @MaxLength(120)
  chartKey!: string;

  @IsISO8601()
  atDateTime!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @IsOptional()
  @IsIn(['LEFT', 'RIGHT', 'BILATERAL', 'L', 'R', 'OD', 'OS', 'left', 'right', 'bilateral'])
  side?: string;

  @IsOptional()
  @IsUUID()
  linkedResourceId?: string;
}
