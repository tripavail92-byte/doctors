import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * Shape of the signed JWT body (see AuthService.signToken).
 * `sub` is the user id; `tenantId` is null for platform admins.
 */
export interface JwtPayload {
  sub: string;
  tenantId: string | null;
  role: string;
  isPlatformAdmin: boolean;
}

/**
 * The validated principal attached to `req.user` after JwtAuthGuard runs.
 * Guards (RolesGuard, EntitlementGuard) and the TenantMiddleware read this.
 */
export interface AuthUser {
  userId: string;
  tenantId: string | null;
  role: string;
  isPlatformAdmin: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Same secret used to sign in AuthService / JwtModule.
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Passport calls this with the decoded payload after signature/expiry checks.
   * Returned value becomes `req.user`.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      isPlatformAdmin: payload.isPlatformAdmin,
    };
  }
}