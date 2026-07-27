"""Privilege-escalation safety suite.

THE HOLE THIS EXISTS TO KEEP CLOSED
-----------------------------------
A clinic OWNER or ADMIN could become a platform super-admin in two HTTP calls
and then read and modify every other clinic on the platform:

  1. POST /org/hierarchy/memberships {userId: <self>, role: "PLATFORM_ADMIN"}
     The controller is @Roles(OWNER, ADMIN) so the caller is allowed in;
     CreateMembershipDto validated with a bare @IsEnum(UserRole) and
     PLATFORM_ADMIN is a member of that enum; the service wrote it verbatim.
  2. POST /auth/switch-context
     Minted a token carrying {role: PLATFORM_ADMIN, isPlatformAdmin: false}.
  3. GET /platform/tenants
     RolesGuard decided on the role STRING alone, so the token was admitted.

Three gates now close it, and each alone leaves a variant open:
  GATE 1  RolesGuard refuses role=PLATFORM_ADMIN without isPlatformAdmin=true.
  GATE 2  The membership DTO and the service refuse PLATFORM_ADMIN and OWNER.
  GATE 3  switchContext re-reads the User row and will not sign a role that row
          does not permit.

Gates 1 and 2 are pure code and are also checked without a database by
scripts/check-role-escalation.ts. This suite proves the whole chain over HTTP,
including gate 3, which needs real rows.

WHY IT PLANTS A ROW WITH RAW SQL
--------------------------------
Gate 2 makes the endpoint refuse to write a PLATFORM_ADMIN membership, so gate 3
can no longer be reached through the API at all. That is the point — but it also
means that testing only through the API would leave gate 3 unexercised, and a
gate nobody exercises is a gate nobody notices breaking. So the suite writes the
forbidden membership directly with psql, exactly as a migration, a backfill, a
support script or a future bug might, and then proves the remaining gates hold.

Run: python test/safety/privilege_escalation_suite.py
"""
import base64
import hashlib
import hmac
import json
import os
import re
import time
import urllib.error
import urllib.request

from _db import psql

BASE = os.environ.get('HEALTHOS_BASE', 'http://localhost:3000')

OWNER_EMAIL = 'owner@glowderma.pk'
OWNER_PASSWORD = os.environ.get('SEED_PASSWORD', 'Password123!')
ADMIN_EMAIL = 'admin@summitsystems.pk'


def api(method, path, tok=None, body=None):
    r = urllib.request.Request(BASE + path, method=method)
    r.add_header('Content-Type', 'application/json')
    if tok:
        r.add_header('Authorization', 'Bearer ' + tok)
    d = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(r, d) as x:
            return x.status, json.loads(x.read() or b'{}')
    except urllib.error.HTTPError as e:
        raw = e.read() or b'{}'
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {'raw': raw.decode(errors='replace')}


results = []


def ck(label, condition, detail=''):
    results.append(bool(condition))
    print(('  PASS  ' if condition else '  FAIL  ') + label
          + (('  -> ' + str(detail)[:140]) if detail != '' else ''))


def jwt_secret():
    """The signing key, resolved exactly as the application resolves it."""
    s = os.environ.get('JWT_SECRET')
    if s:
        return s
    here = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(here, '..', '..', '.env')
    if os.path.exists(env_path):
        with open(env_path, encoding='utf-8') as fh:
            m = re.search(r'^JWT_SECRET\s*=\s*"?([^"\r\n]+)"?', fh.read(), re.M)
            if m:
                return m.group(1)
    raise SystemExit(
        'JWT_SECRET is not available. This suite must FORGE a token to prove the\n'
        'guard rejects it; without the key it cannot test gate 1 and would report\n'
        'a pass it never earned. Set JWT_SECRET and run again.'
    )


def b64(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b'=')


def forge(payload, secret):
    """Mint a VALID, correctly-signed token. The signature is not the defect."""
    head = b64(json.dumps({'alg': 'HS256', 'typ': 'JWT'}, separators=(',', ':')).encode())
    body = b64(json.dumps(payload, separators=(',', ':')).encode())
    signing_input = head + b'.' + body
    sig = b64(hmac.new(secret.encode(), signing_input, hashlib.sha256).digest())
    return (signing_input + b'.' + sig).decode()


def one(sql):
    return psql(sql).strip()


# --- Setup ------------------------------------------------------------------

status, tok_body = api('POST', '/auth/login', None,
                       {'email': OWNER_EMAIL, 'password': OWNER_PASSWORD})
if status != 200:
    raise SystemExit(
        f'Could not log in as the seeded clinic owner ({status}). '
        'Run the seed first; this suite proves nothing without a real principal.'
    )
owner_token = tok_body['accessToken']

owner_id = one(f"SELECT id FROM \"User\" WHERE email = '{OWNER_EMAIL}';")
owner_tenant = one(f"SELECT \"tenantId\" FROM \"User\" WHERE email = '{OWNER_EMAIL}';")
owner_role = one(f"SELECT role FROM \"User\" WHERE email = '{OWNER_EMAIL}';")

if not owner_id or not owner_tenant:
    raise SystemExit('Seeded owner not found in the database. Run the seed first.')

print(f'\nSeeded owner {OWNER_EMAIL}: id={owner_id} tenant={owner_tenant} role={owner_role}')

planted_membership_id = None


# --- Gate 2: the endpoint refuses to assign a privileged role ---------------

print('\n== Gate 2: a clinic owner cannot assign themselves a privileged role ==')

status, body = api('POST', '/org/hierarchy/memberships', owner_token,
                   {'userId': owner_id, 'role': 'PLATFORM_ADMIN'})
ck('POST membership role=PLATFORM_ADMIN is refused',
   status in (400, 403), f'HTTP {status}')
ck('and the refusal explains what is assignable',
   'assign' in json.dumps(body).lower() or 'role' in json.dumps(body).lower(),
   json.dumps(body)[:120])

status, _ = api('POST', '/org/hierarchy/memberships', owner_token,
                {'userId': owner_id, 'role': 'OWNER'})
ck('POST membership role=OWNER is refused (same bug one tier down)',
   status in (400, 403), f'HTTP {status}')

status, _ = api('POST', '/org/hierarchy/memberships', owner_token,
                {'userId': owner_id, 'role': 'DOCTOR'})
ck('an ordinary role is still assignable (the gate is not a blanket block)',
   status in (200, 201), f'HTTP {status}')

n = one('SELECT count(*) FROM "UserMembership" '
        f"WHERE \"userId\" = '{owner_id}' AND role = 'PLATFORM_ADMIN';")
ck('no PLATFORM_ADMIN membership row was written', n == '0', f'rows={n}')


# --- Gate 3: even a planted membership cannot mint a privileged token --------

print('\n== Gate 3: a forbidden membership planted behind the API cannot be switched into ==')

org_id = one(f"SELECT \"organizationId\" FROM \"OrganizationClinic\" WHERE \"tenantId\" = '{owner_tenant}' LIMIT 1;")
clinic_id = one(f"SELECT id FROM \"OrganizationClinic\" WHERE \"tenantId\" = '{owner_tenant}' LIMIT 1;")

if not org_id or not clinic_id:
    ck('Phase A hierarchy exists for the seeded tenant', False,
       'no OrganizationClinic row — run the Phase A backfill/seed')
else:
    planted_membership_id = one(
        'INSERT INTO "UserMembership" '
        '(id, "userId", "organizationId", "tenantId", "clinicId", role, "isDefaultContext", "isActive", "createdAt") '
        f"VALUES (gen_random_uuid(), '{owner_id}', '{org_id}', '{owner_tenant}', '{clinic_id}', "
        "'PLATFORM_ADMIN', false, true, now()) RETURNING id;"
    )
    ck('a PLATFORM_ADMIN membership was planted directly in the database',
       bool(planted_membership_id), planted_membership_id)

    status, body = api('GET', '/auth/contexts', owner_token)
    ck('the planted context is visible to the enumeration endpoint',
       status == 200, f'HTTP {status}')

    status, body = api('POST', '/auth/switch-context', owner_token,
                       {'membershipId': planted_membership_id})
    minted_role = None
    if status == 200 and 'accessToken' in body:
        parts = body['accessToken'].split('.')
        pad = '=' * (-len(parts[1]) % 4)
        minted_role = json.loads(base64.urlsafe_b64decode(parts[1] + pad)).get('role')

    ck('switching into it is REFUSED, or yields a token that is not PLATFORM_ADMIN',
       status in (400, 403) or minted_role != 'PLATFORM_ADMIN',
       f'HTTP {status} mintedRole={minted_role}')


# --- Gate 1: a correctly-signed but inconsistent token is refused -----------

print('\n== Gate 1: a validly-signed token claiming PLATFORM_ADMIN without the flag ==')

secret = jwt_secret()
now = int(time.time())
forged = forge({
    'sub': owner_id,
    'tenantId': owner_tenant,
    'role': 'PLATFORM_ADMIN',
    'isPlatformAdmin': False,
    'iat': now,
    'exp': now + 3600,
}, secret)

status, body = api('GET', '/auth/contexts', forged)
ck('the forged token is genuinely valid (it authenticates, so 401 is not what stops it)',
   status != 401, f'HTTP {status}')

status, body = api('GET', '/platform/tenants', forged)
ck('THE EXPLOIT: GET /platform/tenants with the forged token is REFUSED',
   status == 403, f'HTTP {status}')
ck('and it did not leak the clinic list',
   not isinstance(body, list) or len(body) == 0,
   json.dumps(body)[:120])

status, _ = api('POST', '/platform/tenants', forged, {
    'name': 'Escalated Clinic', 'slug': 'escalated-probe', 'edition': 'CLINIC',
    'ownerEmail': 'probe@example.com', 'ownerName': 'Probe',
    'ownerPassword': 'a-very-long-password',
})
ck('and it cannot mint a new clinic', status == 403, f'HTTP {status}')

n = one("SELECT count(*) FROM \"Tenant\" WHERE slug = 'escalated-probe';")
ck('no tenant was created by the forged principal', n == '0', f'rows={n}')


# --- Regression: the legitimate principals still work -----------------------

print('\n== Regression: the fix must not lock out anyone legitimate ==')

status, body = api('POST', '/auth/login', None,
                   {'email': ADMIN_EMAIL, 'password': OWNER_PASSWORD})
if status == 200:
    admin_token = body['accessToken']
    status, body = api('GET', '/platform/tenants', admin_token)
    ck('the genuine platform admin still reaches /platform/tenants',
       status == 200, f'HTTP {status}')
else:
    ck('the genuine platform admin can log in', False, f'HTTP {status}')

status, body = api('GET', '/auth/contexts', owner_token)
ck('the clinic owner can still enumerate their own contexts',
   status == 200, f'HTTP {status}')

status, body = api('POST', '/auth/switch-context', owner_token, {})
ck('the clinic owner can still switch into their own default context',
   status == 200 and 'accessToken' in body, f'HTTP {status}')

status, body = api('GET', '/patients', owner_token)
ck('and ordinary clinic work is unaffected', status == 200, f'HTTP {status}')


# --- Cleanup ----------------------------------------------------------------
# The planted row is a live escalation attempt sitting in the database. Leaving
# it behind would arm the next person who fixes a bug in switchContext.

if planted_membership_id:
    psql(f"DELETE FROM \"UserMembership\" WHERE id = '{planted_membership_id}';")
    n = one(f"SELECT count(*) FROM \"UserMembership\" WHERE id = '{planted_membership_id}';")
    ck('the planted membership was removed', n == '0', f'rows={n}')

psql('DELETE FROM "UserMembership" '
     f"WHERE \"userId\" = '{owner_id}' AND role = 'DOCTOR' AND \"branchId\" IS NULL "
     "AND \"departmentId\" IS NULL;")


# --- Result -----------------------------------------------------------------

passed = sum(1 for r in results if r)
total = len(results)
print(f'\n{passed}/{total} checks passed')
if passed != total:
    raise SystemExit('PRIVILEGE ESCALATION SUITE FAILED — do not deploy.')
print('PASS — a clinic owner cannot reach the platform tier by any of the three routes.')
