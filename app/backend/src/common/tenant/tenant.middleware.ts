// TenantMiddleware
//
// Reads the Bearer token from the Authorization header (if present), verifies
// it with @nestjs/jwt, builds a TenantCtx from the payload and runs the rest of
// the request pipeline inside runWithTenant(). Public routes (login, health
// checks) arrive without a token — that's tolerated: we bind an anonymous
// context so downstream guards, not the middleware, decide access.
//
// The JWT payload shape matches what JwtStrategy returns on login:
//   { sub | userId, tenantId, role, isPlatformAdmin }

import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { runWithTenant, TenantCtx } from './tenant-context';

// Expected claims on a verified access token.
interface JwtPayload {
  sub?: string;
  userId?: string;
  tenantId?: string | null;
  role?: UserRole;
  isPlatformAdmin?: boolean;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly jwt: JwtService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const ctx = this.buildContext(req);
    // Bind the context for the entire downstream async chain.
    runWithTenant(ctx, () => next());
  }

  /** Derive a TenantCtx from the request, defaulting to anonymous. */
  private buildContext(req: Request): TenantCtx {
    const anonymous: TenantCtx = {
      tenantId: null,
      userId: null,
      role: null,
      isPlatformAdmin: false,
    };

    const token = this.extractBearerToken(req);
    if (!token) {
      // No token — public route or pre-auth. Let guards enforce protection.
      return anonymous;
    }

    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      return {
        tenantId: payload.tenantId ?? null,
        userId: payload.userId ?? payload.sub ?? null,
        role: payload.role ?? null,
        isPlatformAdmin: payload.isPlatformAdmin ?? false,
      };
    } catch {
      // Invalid/expired token: stay anonymous. JwtAuthGuard will reject any
      // protected route with a 401; we don't throw here so public routes work.
      return anonymous;
    }
  }

  /** Pull the raw token out of an `Authorization: Bearer <token>` header. */
  private extractBearerToken(req: Request): string | undefined {
    const header = req.headers['authorization'];
    if (!header) {
      return undefined;
    }
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) {
      return undefined;
    }
    return value;
  }
}