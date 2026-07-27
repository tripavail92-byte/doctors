import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/jwt.strategy';
import { ROLES_KEY } from './roles.decorator';

/**
 * Compares req.user.role against the roles required by @Roles(...).
 * Must run after JwtAuthGuard so req.user is populated.
 *
 * TWO CLAIMS, TWO SOURCES — AND THEY MUST AGREE
 * ---------------------------------------------
 * `isPlatformAdmin` originates on the User row and is set at login.
 * `role` can also come from a UserMembership, via POST /auth/switch-context.
 *
 * That difference was exploitable. A clinic OWNER or ADMIN could POST a
 * membership for THEMSELVES with role PLATFORM_ADMIN, switch context to mint a
 * token carrying { role: PLATFORM_ADMIN, isPlatformAdmin: false }, and reach
 * PlatformTenantsController — which is guarded by exactly this class and used
 * to decide on the role string alone. Every clinic on the platform became
 * visible to any one clinic's owner.
 *
 * So the flag is no longer only a bypass; for PLATFORM_ADMIN it is a
 * REQUIREMENT. A principal whose role says platform admin while its flag says
 * otherwise is refused on every route this guard protects, including routes
 * with no @Roles at all — the combination has no legitimate origin, so there is
 * nothing to preserve by tolerating it.
 *
 * Two other gates back this up, because each alone leaves a variant open:
 *   - CreateMembershipDto refuses to assign PLATFORM_ADMIN or OWNER at all.
 *   - AuthService.switchContext re-reads the User row and will not sign a token
 *     whose role exceeds what that row permits.
 * See scripts/check-role-escalation.ts and
 * test/safety/privilege_escalation_suite.py.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private static readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;

    // Checked before the open-route shortcut below: a forged principal must not
    // be able to use ANY route, not merely the ones carrying @Roles.
    if (user && user.role === 'PLATFORM_ADMIN' && user.isPlatformAdmin !== true) {
      RolesGuard.logger.error(
        `Refused a token claiming role=PLATFORM_ADMIN with isPlatformAdmin=false ` +
          `(userId=${user.userId}, tenantId=${user.tenantId}). This combination is ` +
          `never legitimate and indicates a forged or stale membership-derived token.`,
      );
      throw new ForbiddenException('Invalid principal');
    }

    // No @Roles => route is open to any authenticated user.
    if (!required || required.length === 0) {
      return true;
    }

    if (!user) {
      throw new ForbiddenException('Missing authenticated user');
    }

    // Platform admins have unrestricted access. Reached only when the flag is
    // genuinely true, per the consistency check above.
    if (user.isPlatformAdmin) {
      return true;
    }

    if (!required.includes(user.role as UserRole)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}