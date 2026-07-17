import { IsString, MaxLength } from 'class-validator';

export class AddImagingReportDto {
  @IsString()
  @MaxLength(30)
  studyCode!: string;

  @IsString()
  @MaxLength(4000)
  findings!: string;

  @IsString()
  @MaxLength(1000)
  impression!: string;
}
