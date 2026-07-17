import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { randomUUID } from 'crypto';

export type GatewayProvider = 'safepay' | 'payfast' | 'paypro';

export interface PaymentIntent {
  provider: GatewayProvider;
  reference: string;
  checkoutUrl: string;
  amountPkr: number;
}

interface ProviderCfg {
  name: string;
  method: PaymentMethod;
  base: string;
}

// Pakistan online-payment providers (Stripe/Paddle don't operate in PK).
// A real integration calls each provider's API with secret keys to open a
// hosted-checkout session and later receives a signed webhook. This service
// models the same shape — an opaque reference + a redirect URL — with a sandbox
// URL, so the create-link → confirm flow runs end-to-end without live keys.
const PROVIDERS: Record<GatewayProvider, ProviderCfg> = {
  safepay: { name: 'Safepay', method: PaymentMethod.SAFEPAY, base: 'https://sandbox.getsafepay.com/checkout' },
  payfast: { name: 'PayFast', method: PaymentMethod.PAYFAST, base: 'https://sandbox.payfast.pk/checkout' },
  paypro: { name: 'PayPro', method: PaymentMethod.PAYPRO, base: 'https://demo.paypro.com.pk/checkout' },
};

@Injectable()
export class PaymentGatewayService {
  isProvider(p: string): p is GatewayProvider {
    return Object.prototype.hasOwnProperty.call(PROVIDERS, p);
  }

  methodFor(provider: GatewayProvider): PaymentMethod {
    return PROVIDERS[provider].method;
  }

  providerName(provider: GatewayProvider): string {
    return PROVIDERS[provider].name;
  }

  // Open a checkout intent for `amountPkr`. Reference is prefixed with the
  // provider so a returning webhook can be routed back.
  createIntent(provider: GatewayProvider, amountPkr: number): PaymentIntent {
    const cfg = PROVIDERS[provider];
    const reference = `${provider}_${randomUUID()}`;
    const checkoutUrl = `${cfg.base}?ref=${encodeURIComponent(reference)}&amount=${amountPkr}&ccy=PKR`;
    return { provider, reference, checkoutUrl, amountPkr };
  }

  providerFromReference(reference: string): GatewayProvider | null {
    const prefix = reference.split('_')[0];
    return this.isProvider(prefix) ? prefix : null;
  }
}
