import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AcquireDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  accessionNumber?: string;
}
