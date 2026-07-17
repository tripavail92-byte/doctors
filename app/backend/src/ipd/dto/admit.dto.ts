import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AdmitDto {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  bedId!: string;

  @IsOptional()
  @IsUUID()
  admittingDoctorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  diagnosis?: string;
}
