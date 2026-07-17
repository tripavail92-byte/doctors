import { IsIn } from 'class-validator';
import { GatewayProvider } from '../payment-gateway.service';

export class PayLinkDto {
  @IsIn(['safepay', 'payfast', 'paypro'])
  provider!: GatewayProvider;
}
