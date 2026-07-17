import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

/**
 * Application bootstrap.
 *
 * - Global ValidationPipe so all DTOs annotated with class-validator are
 *   validated and stripped of unknown properties.
 * - CORS enabled for the frontend (Vite dev server / deployed SPA).
 * - Port comes from typed configuration.
 */
// Known placeholders that must never sign a production token.
const FORBIDDEN_JWT_SECRETS = [
  'dev-secret-change-me',
  'change-me-in-production',
  'secret',
  'changeme',
];

/**
 * Refuse to boot on a weak or default JWT secret.
 *
 * The whole tenant-isolation chain hangs off this key: TenantMiddleware builds
 * the tenant context from the verified JWT, and that context drives the RLS
 * session variable. Anyone who knows the secret can forge
 * `{tenantId: <victim>, isPlatformAdmin: true}` — and RLS will then correctly,
 * obediently enforce the tenant the ATTACKER named. A publicly-known default
 * is therefore a full cross-tenant compromise, not a dev-convenience wart, and
 * "it booted fine" is exactly how it would reach production.
 */
function assertJwtSecret(): void {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. Refusing to start: an unset signing key means ' +
        'forgeable tokens and forged tokens defeat tenant isolation. ' +
        'Generate one with: openssl rand -base64 48',
    );
  }
  if (FORBIDDEN_JWT_SECRETS.includes(secret)) {
    throw new Error(
      `JWT_SECRET is the well-known placeholder "${secret}". Refusing to start: ` +
        'anyone can forge tokens for any tenant. Generate a real one with: ' +
        'openssl rand -base64 48',
    );
  }
  if (secret.length < 32) {
    throw new Error(
      `JWT_SECRET is only ${secret.length} characters. Refusing to start: ` +
        'use at least 32 (openssl rand -base64 48).',
    );
  }
}

async function bootstrap(): Promise<void> {
  assertJwtSecret();

  // Disable the default 100kb body parser so we can set an explicit, larger
  // JSON limit (base64 photo uploads need more than the default).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Serve the static demo widgets in public/ (same-origin with the API), e.g.
  // http://localhost:3000/instrument-runner.html
  app.useStaticAssets(join(process.cwd(), 'public'));

  // Validate and sanitize incoming request payloads globally.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not present in the DTO
      forbidNonWhitelisted: true, // throw if unknown properties are sent
      transform: true, // auto-transform payloads to DTO instances
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = app.get(ConfigService);

  // Allow the SPA to call the API only from configured origins (CORS_ORIGINS).
  // Same-origin/non-browser requests (no Origin header) are always allowed; a
  // '*' entry opens it to any origin (dev convenience, not for production).
  const corsOrigins = config.get<string[]>('corsOrigins') ?? [];
  const allowAny = corsOrigins.includes('*');
  app.enableCors({
    origin: (origin, callback) => {
      // Allow same-origin/non-browser (no Origin) and allowlisted origins.
      // Disallowed origins get no CORS headers (browser blocks the read) rather
      // than a 500 — the endpoint still serves non-browser clients normally.
      callback(null, !origin || allowAny || corsOrigins.includes(origin));
    },
    credentials: true,
  });

  const port = config.get<number>('port') ?? 3000;

  await app.listen(port);
  Logger.log(`Health OS backend listening on http://localhost:${port}`, 'Bootstrap');
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();