import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

/** Metadata key under which required roles are stored. */
export const ROLES_KEY = 'roles';

/**
 * Restrict a route/controller to the given roles.
 * Usage: @Roles('OWNER', 'ADMIN')
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);