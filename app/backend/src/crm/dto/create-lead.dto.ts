import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(30)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string; // walk-in / referral / facebook / instagram / whatsapp

  @IsOptional()
  @IsString()
  @MaxLength(120)
  interest?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
