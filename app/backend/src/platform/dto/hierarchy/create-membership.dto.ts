import { UserRole } from '@prisma/client';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

/**
 * The roles a clinic administrator may hand out.
 *
 * Deliberately an ALLOW-LIST, not the UserRole enum. This field was validated
 * with a bare `@IsEnum(UserRole)`, and PLATFORM_ADMIN is a member of that enum —
 * so a clinic OWNER or ADMIN could POST a membership for themselves with role
 * PLATFORM_ADMIN, switch context, and reach every clinic on the platform.
 *
 * Two roles are withheld and each for its own reason:
 *   PLATFORM_ADMIN  belongs to the operator of the platform, never to a tenant.
 *                   It is granted on the User row, not through a membership.
 *   OWNER           is the tenant's own top tier, minted once at onboarding. An
 *                   ADMIN promoting themselves to OWNER is the same escalation
 *                   one storey down.
 *
 * Extending this list is a deliberate act. Adding a role to UserRole must not
 * silently make it assignable, which is exactly what the enum-based check did.
 *
 * The service re-checks against this same constant — a DTO is a parser, not a
 * policy, and it is bypassed by any caller that does not go through the pipe.
 */
export const ASSIGNABLE_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.RECEPTION,
  UserRole.DOCTOR,
  UserRole.SALES,
  UserRole.TREATMENT,
  UserRole.INVENTORY,
  UserRole.FINANCE,
] as const;

export class CreateMembershipDto {
  @IsUUID()
  userId!: string;

  @IsIn(ASSIGNABLE_ROLES as UserRole[], {
    message: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}. OWNER and PLATFORM_ADMIN cannot be assigned through a membership.`,
  })
  role!: UserRole;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsBoolean()
  isDefaultContext?: boolean;
}
