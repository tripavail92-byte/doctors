import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/jwt.strategy';
import { ROLES_KEY } from './roles.decorator';

/**
 * Compares req.user.role against the roles required by @Roles(...).
 * Platform admins bypass the check entirely.
 * Must run after JwtAuthGuard so req.user is populated.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles => route is open to any authenticated user.
    if (!required || required.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Missing authenticated user');
    }

    // Platform admins have unrestricted access.
    if (user.isPlatformAdmin) {
      return true;
    }

    if (!required.includes(user.role as UserRole)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}