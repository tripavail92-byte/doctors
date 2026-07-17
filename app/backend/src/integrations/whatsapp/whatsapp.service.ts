import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { postJson } from '../http';

export interface SendTextInput {
  /** E.164 without '+', e.g. 923498529345. */
  to: string;
  body: string;
}

export interface SendTemplateInput {
  to: string;
  template: string;
  /** Body {{1}}, {{2}}… substitution values. */
  params?: string[];
  languageCode?: string;
}

export interface WhatsAppSendResult {
  provider: 'meta-cloud';
  mode: 'live' | 'stub';
  messageId: string;
  to: string;
  accepted: boolean;
}

/**
 * WhatsApp Business messaging via the Meta Cloud API.
 *
 * Live mode calls `POST {apiBase}/{phoneNumberId}/messages` with a bearer
 * token. When the phone-number id or access token is not configured we fall
 * back to stub mode: the message is logged and a synthetic id is returned, so
 * the rest of the product (appointment reminders, receipts, campaigns) works
 * end-to-end without a Meta account.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly cfg: AppConfig['integrations']['whatsapp'];

  constructor(config: ConfigService<AppConfig, true>) {
    this.cfg = config.get('integrations', { infer: true }).whatsapp;
  }

  mode(): 'live' | 'stub' {
    return this.cfg.phoneNumberId && this.cfg.accessToken ? 'live' : 'stub';
  }

  sendText(input: SendTextInput): Promise<WhatsAppSendResult> {
    return this.dispatch(input.to, {
      messaging_product: 'whatsapp',
      to: input.to,
      type: 'text',
      text: { body: input.body },
    });
  }

  sendTemplate(input: SendTemplateInput): Promise<WhatsAppSendResult> {
    const components = input.params?.length
      ? [{ type: 'body', parameters: input.params.map((text) => ({ type: 'text', text })) }]
      : undefined;
    return this.dispatch(input.to, {
      messaging_product: 'whatsapp',
      to: input.to,
      type: 'template',
      template: {
        name: input.template,
        language: { code: input.languageCode ?? 'en' },
        ...(components ? { components } : {}),
      },
    });
  }

  private async dispatch(to: string, payload: Record<string, unknown>): Promise<WhatsAppSendResult> {
    if (this.mode() === 'stub') {
      const messageId = `wamid.STUB-${to}-${hash(JSON.stringify(payload))}`;
      this.logger.log(`[stub] WhatsApp -> ${to}: ${JSON.stringify(payload).slice(0, 160)}`);
      return { provider: 'meta-cloud', mode: 'stub', messageId, to, accepted: true };
    }
    const url = `${this.cfg.apiBase}/${this.cfg.phoneNumberId}/messages`;
    const { status, data } = await postJson<{ messages?: { id: string }[] }>(url, payload, {
      Authorization: `Bearer ${this.cfg.accessToken}`,
    });
    const messageId = data.messages?.[0]?.id ?? '';
    return { provider: 'meta-cloud', mode: 'live', messageId, to, accepted: status >= 200 && status < 300 };
  }
}

/** Stable non-crypto hash for deterministic stub ids. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
