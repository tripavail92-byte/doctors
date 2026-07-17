import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { SURFACES } from '../tooth-reference';

export class RecordToothDto {
  @IsUUID()
  patientId!: string;

  @IsString()
  @MaxLength(3)
  toothFdi!: string;

  @IsString()
  @MaxLength(30)
  condition!: string;

  @IsOptional()
  @IsArray()
  @IsIn([...SURFACES], { each: true })
  surfaces?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
