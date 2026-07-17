/**
 * Typed application configuration.
 *
 * Loaded once at bootstrap via `ConfigModule.forRoot({ load: [configuration] })`
 * and read elsewhere through `ConfigService.get(...)`. Keeping the shape in one
 * place gives us a single source of truth for env parsing and defaults.
 */

export interface AppConfig {
  port: number;
  jwt: {
    secret: string;
    /** Access-token lifetime, e.g. "1d", "12h". */
    expiresIn: string;
  };
  database: {
    url: string;
  };
  /**
   * Allowed CORS origins. Empty array ⇒ same-origin only (no cross-origin
   * browser calls). Set CORS_ORIGINS to a comma-separated allowlist in
   * production; defaults to the local Vite/API dev origins.
   */
  corsOrigins: string[];
  integrations: IntegrationsConfig;
}

/**
 * Third-party integrations. Each provider runs in one of two modes:
 *   - "live":  real HTTP calls, used only when the required secrets are present.
 *   - "stub":  deterministic in-process simulation, used otherwise.
 *
 * We never fabricate credentials. Absence of secrets ⇒ stub mode, so the whole
 * system boots and demos without any external accounts, and flips to live the
 * moment real keys are provided — no code change.
 */
export interface IntegrationsConfig {
  whatsapp: {
    /** Meta Graph API base, e.g. https://graph.facebook.com/v20.0 */
    apiBase: string;
    phoneNumberId: string;
    accessToken: string;
  };
  fbr: {
    /** FBR Digital Invoicing endpoint (IMS/PRAL). */
    apiBase: string;
    token: string;
    /** Seller NTN registered with FBR. */
    sellerNtn: string;
    posId: string;
  };
  telehealth: {
    /** LiveKit server URL, e.g. wss://your.livekit.cloud */
    url: string;
    apiKey: string;
    apiSecret: string;
  };
}

export default (): AppConfig => ({
  // PORT is a string in process.env; coerce and fall back to 3000.
  port: parseInt(process.env.PORT ?? '3000', 10),
  jwt: {
    // No fallback by design. A default here would silently sign tokens with a
    // publicly-known key, and a forged token defeats tenant isolation outright
    // (the tenant context that drives RLS is built from the JWT). bootstrap()
    // calls assertJwtSecret() before the app starts, so by the time this is
    // read the value is present and non-placeholder — hence the assertion.
    secret: process.env.JWT_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  integrations: {
    whatsapp: {
      apiBase: process.env.WHATSAPP_API_BASE ?? 'https://graph.facebook.com/v20.0',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    },
    fbr: {
      apiBase: process.env.FBR_API_BASE ?? 'https://gw.fbr.gov.pk/di_data/v1/di',
      token: process.env.FBR_TOKEN ?? '',
      sellerNtn: process.env.FBR_SELLER_NTN ?? '',
      posId: process.env.FBR_POS_ID ?? '',
    },
    telehealth: {
      url: process.env.LIVEKIT_URL ?? '',
      apiKey: process.env.LIVEKIT_API_KEY ?? '',
      apiSecret: process.env.LIVEKIT_API_SECRET ?? '',
    },
  },
});