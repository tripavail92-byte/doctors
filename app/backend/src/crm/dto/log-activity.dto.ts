import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class LogActivityDto {
  @IsString()
  @MaxLength(30)
  type!: string; // call / whatsapp / note / followup

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  // For scheduled follow-ups.
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
