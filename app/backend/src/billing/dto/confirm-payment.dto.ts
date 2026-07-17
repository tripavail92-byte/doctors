import { IsString, MaxLength } from 'class-validator';

export class ConfirmPaymentDto {
  @IsString()
  @MaxLength(120)
  reference!: string;
}
