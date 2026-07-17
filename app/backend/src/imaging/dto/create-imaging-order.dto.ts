import {
  ArrayMaxSize,
  ArrayMinSize,
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
  studyCodes!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
