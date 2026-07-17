import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class DispenseLineInput {
  @IsString()
  @MaxLength(30)
  code!: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity!: number;
}

export class DispenseDto {
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DispenseLineInput)
  items!: DispenseLineInput[];

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}
