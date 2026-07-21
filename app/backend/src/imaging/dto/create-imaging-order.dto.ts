import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateImagingOrderDto {
  @IsUUID()
  patientId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  // A repeated code created two order items while reports are capped at one per
  // study, so `reportCount >= items.length` could never be satisfied and the
  // order stranded in ACQUIRED forever, unreportable and uncancellable.
  @ArrayUnique()
  studyCodes!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
