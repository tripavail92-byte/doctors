import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsBoundedJson } from '../../common/validation/is-bounded-json';

export class CreateNoteInstanceDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsString()
  @MaxLength(120)
  templateKey!: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  // { sectionKey: { fieldKey: value } }
  @IsObject()
  @IsBoundedJson()
  data!: Record<string, unknown>;
}
