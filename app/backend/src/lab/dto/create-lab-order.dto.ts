import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateLabOrderDto {
  @IsUUID()
  patientId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  testCodes!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
