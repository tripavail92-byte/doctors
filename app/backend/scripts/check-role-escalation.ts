/**
 * Privilege-escalation guard check (no database required).
 *
 * WHY THIS EXISTS
 * ---------------
 * A clinic OWNER or ADMIN could make themselves a platform super-admin in two
 * HTTP calls and then read and modify every other clinic on the platform:
 *
 *   1. POST /org/hierarchy/memberships { userId: <self>, role: "PLATFORM_ADMIN" }
 *      - the controller is @Roles(OWNER, ADMIN), so the caller is allowed in
 *      - CreateMembershipDto validated the role with a bare @IsEnum(UserRole),
 *        and PLATFORM_ADMIN is a member of that enum
 *      - the service wrote dto.role verbatim, checking only that the target
 *        user is in the caller's own tenant, which the caller satisfies by
 *        naming themselves
 *   2. POST /auth/switch-context
 *      - mints a token carrying { role: PLATFORM_ADMIN, isPlatformAdmin: false }
 *   3. GET /platform/tenants
 *      - RolesGuard decided on the role STRING alone, so the token was admitted
 *
 * Three gates close it, and each alone leaves a variant open:
 *   GATE 1  RolesGuard must never admit PLATFORM_ADMIN on the role claim alone.
 *   GATE 2  The membership DTO must refuse to assign PLATFORM_ADMIN or OWNER.
 *   GATE 3  switchContext must not mint a token whose role exceeds the User row.
 *
 * Gates 1 and 2 are pure code and are checked here, so this runs in CI with no
 * Postgres and no running API. Gate 3 needs real rows and is proven by
 * test/safety/privilege_escalation_suite.py, which performs the whole exploit
 * over HTTP.
 *
 * This check asserts the NEGATIVE — that the escalated principal is REFUSED.
 * It was written against the vulnerable code first and confirmed to fail, so it
 * is known to be capable of failing. A guard that has never been red is not a
 * guard.
 *
 * Run: npx ts-node scripts/check-role-escalation.ts
 */
import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RolesGuard } from '../src/rbac/roles.guard';
import { CreateMembershipDto } from '../src/platform/dto/hierarchy/create-membership.dto';

let failures = 0;

function ck(label: string, condition: boolean, detail = ''): void {
  if (!condition) failures++;
  const mark = condition ? '  PASS  ' : '  FAIL  ';
  // eslint-disable-next-line no-console
  console.log(mark + label + (detail ? '  -> ' + detail : ''));
}

// --- Gate 1: RolesGuard -----------------------------------------------------

/** A minimal ExecutionContext carrying just the principal the guard reads. */
function ctx(user: unknown): never {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
}

function guardRequiring(roles: string[]): RolesGuard {
  return new RolesGuard({ getAllAndOverride: () => roles } as never);
}

/** True when the guard lets the principal through. */
function admits(guard: RolesGuard, user: unknown): boolean {
  try {
    return guard.canActivate(ctx(user)) === true;
  } catch (e) {
    if (e instanceof ForbiddenException) return false;
    throw e;
  }
}

// eslint-disable-next-line no-console
console.log('\n== Gate 1: RolesGuard must not admit PLATFORM_ADMIN on the role claim alone ==');

// The exact decorator on PlatformTenantsController.
const platform = guardRequiring(['PLATFORM_ADMIN']);

ck(
  'a genuine platform admin still reaches platform routes',
  admits(platform, { userId: 'u1', tenantId: null, role: 'PLATFORM_ADMIN', isPlatformAdmin: true }),
  'this must keep working — the fix must not lock out the real admin',
);

ck(
  'an ordinary clinic ADMIN is refused',
  !admits(platform, { userId: 'u2', tenantId: 't2', role: 'ADMIN', isPlatformAdmin: false }),
);

ck(
  'THE EXPLOIT: role=PLATFORM_ADMIN with isPlatformAdmin=false is REFUSED',
  !admits(platform, { userId: 'u3', tenantId: 't3', role: 'PLATFORM_ADMIN', isPlatformAdmin: false }),
  'this is the token POST /auth/switch-context mints from a forged membership',
);

// The combination is never legitimate on ANY route, not only platform ones —
// a forged PLATFORM_ADMIN role must not satisfy a clinic-level @Roles either,
// or the same membership becomes a way to impersonate an OWNER.
ck(
  'the forged role does not satisfy an unrelated clinic-level @Roles(OWNER)',
  !admits(guardRequiring(['OWNER']), {
    userId: 'u4', tenantId: 't4', role: 'PLATFORM_ADMIN', isPlatformAdmin: false,
  }),
);

ck(
  'a route with no @Roles is still open to any authenticated user',
  admits(guardRequiring([]), { userId: 'u5', tenantId: 't5', role: 'RECEPTION', isPlatformAdmin: false }),
  'regression guard: the fix must not accidentally close open routes',
);

// --- Gate 2: CreateMembershipDto -------------------------------------------

// eslint-disable-next-line no-console
console.log('\n== Gate 2: the membership DTO must refuse privileged roles ==');

/** True when class-validator accepts the payload. */
function dtoAccepts(role: string): boolean {
  const dto = plainToInstance(CreateMembershipDto, {
    userId: '00000000-0000-4000-8000-000000000000',
    role,
  });
  return validateSync(dto as object).length === 0;
}

ck('an ordinary role (DOCTOR) is still assignable', dtoAccepts('DOCTOR'));
ck('an ordinary role (RECEPTION) is still assignable', dtoAccepts('RECEPTION'));

ck(
  'THE EXPLOIT: role=PLATFORM_ADMIN is REJECTED by the DTO',
  !dtoAccepts('PLATFORM_ADMIN'),
  'a clinic admin must never be able to mint a platform admin',
);

ck(
  'role=OWNER is REJECTED by the DTO',
  !dtoAccepts('OWNER'),
  'an ADMIN escalating to OWNER is the same bug one tier down',
);

ck('a value outside the enum is rejected', !dtoAccepts('NOT_A_ROLE'));

// --- Result -----------------------------------------------------------------

// eslint-disable-next-line no-console
console.log('');
if (failures > 0) {
  // eslint-disable-next-line no-console
  console.error(
    `FAIL — ${failures} escalation gate(s) open.\n` +
      'A clinic OWNER or ADMIN can reach platform-admin routes. Do not deploy.\n' +
      'Gate 3 (switchContext re-reading the User row) is proven separately by\n' +
      'test/safety/privilege_escalation_suite.py against a running API.',
  );
  process.exit(1);
}
// eslint-disable-next-line no-console
console.log(
  'PASS — the escalated principal is refused at the guard and at the DTO.\n' +
    '       Gate 3 (token minting) is proven by test/safety/privilege_escalation_suite.py.',
);
