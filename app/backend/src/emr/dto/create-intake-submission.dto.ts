import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsBoundedJson } from '../../common/validation/is-bounded-json';

export class CreateIntakeSubmissionDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsString()
  @MaxLength(60)
  packKey!: string;

  // { groupKey: { fieldKey: value } }
  @IsObject()
  @IsBoundedJson()
  answers!: Record<string, unknown>;
}
