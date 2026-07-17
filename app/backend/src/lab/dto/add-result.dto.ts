import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddResultDto {
  @IsString()
  @MaxLength(30)
  testCode!: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  valueText?: string;
}
