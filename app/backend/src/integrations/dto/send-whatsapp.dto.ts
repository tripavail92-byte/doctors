import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * Send either a free-text message (`body`) or a pre-approved `template`.
 * Exactly one of the two must be supplied.
 */
export class SendWhatsAppDto {
  /** Recipient in E.164 without '+', e.g. 923498529345. */
  @Matches(/^\d{7,15}$/, { message: 'to must be digits only, E.164 without +' })
  to!: string;

  @ValidateIf((o) => !o.template)
  @IsString()
  @MaxLength(1000)
  body?: string;

  @ValidateIf((o) => !o.body)
  @IsString()
  @MaxLength(120)
  template?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  params?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(10)
  languageCode?: string;
}
