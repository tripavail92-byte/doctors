"""Platform dashboard endpoints — safety suite.

Six endpoints, one platform-admin-only surface. The invariants that matter here
are ones the audit has already been burned by:

 1. Counts are REAL, not structurally-always-zero. The "0 patients / 0 users"
    bug returned every tenant as zero for weeks because groupBy ran outside
    forTenant(). This suite reads a seeded tenant with known patients and
    asserts the count is non-zero — a regression to the naked-groupBy pattern
    fails HERE loudly.

 2. Platform routes are refused to non-platform principals. Belt over the
    RolesGuard and the escalation-fix; this is the safety trail for it.

 3. Response SHAPES match the docs/contracts/*.md files. A drift there is what
    made the first PlatformDashboardPage render crash the whole page. Every
    check names the key the UI reads.

 4. Percentages, MRR, and delta sums are numeric — never NaN, never Infinity.
    The `previous === 0` branch of pctDelta returns null explicitly for that
    reason.

Run: HEALTHOS_BASE=http://localhost:3100 python test/safety/platform_dashboard_suite.py
"""
import json
import os
import urllib.error
import urllib.request

from _db import psql

BASE = os.environ.get('HEALTHOS_BASE', 'http://localhost:3000')

ADMIN_EMAIL = 'admin@summitsystems.pk'
OWNER_EMAIL = 'owner@glowderma.pk'
PASSWORD = os.environ.get('SEED_PASSWORD', 'Password123!')


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


def ck(label, cond, detail=''):
    results.append(bool(cond))
    print(('  PASS  ' if cond else '  FAIL  ') + label + (('  -> ' + str(detail)[:160]) if detail != '' else ''))


# --- Setup ------------------------------------------------------------------

s, body = api('POST', '/auth/login', None, {'email': ADMIN_EMAIL, 'password': PASSWORD})
if s != 200:
    raise SystemExit(
        f'Could not log in as {ADMIN_EMAIL} ({s}). Seed the database first; this suite proves nothing without a real principal.'
    )
admin_token = body['accessToken']

s, body = api('POST', '/auth/login', None, {'email': OWNER_EMAIL, 'password': PASSWORD})
if s != 200:
    raise SystemExit(f'Could not log in as {OWNER_EMAIL} ({s}). Seed the database first.')
owner_token = body['accessToken']


# --- Gate: non-platform-admin cannot reach any platform endpoint ------------

print('\n== Every dashboard endpoint is PLATFORM_ADMIN only ==')

for path in [
    '/platform/summary',
    '/platform/clinic-distribution',
    '/platform/tenants/paged',
    '/platform/onboarding-activity',
    '/platform/popular-modules',
    '/platform/health',
]:
    s, _ = api('GET', path, owner_token)
    ck(f'GET {path} refused to a clinic OWNER', s == 403, f'HTTP {s}')


# --- /platform/summary ------------------------------------------------------

print('\n== GET /platform/summary ==')

s, body = api('GET', '/platform/summary', admin_token)
ck('platform admin gets 200', s == 200, f'HTTP {s}')

for k in ('period', 'comparedTo', 'organizations', 'clinics', 'activeSubs', 'mrr'):
    ck(f'response has "{k}"', k in body, f'keys={list(body.keys())[:8] if isinstance(body, dict) else "?"}')

if isinstance(body, dict):
    o = body.get('organizations') or {}
    ck('organizations.count is a number', isinstance(o.get('count'), int), f'value={o.get("count")}')
    ck('organizations.deltaPct is number-or-null', o.get('deltaPct') is None or isinstance(o.get('deltaPct'), (int, float)),
       f'value={o.get("deltaPct")}')

    # THE INVARIANT.
    # Any seeded platform (glow-derma auto-bootstraps an Organization) has
    # >= 1 Organization row. Zero is the exact "structurally-always-zero"
    # RLS trap that this endpoint used to hit — Organization is scoped
    # through the OrganizationClinic bespoke policy, so a naked count on
    # the base client returned nothing. Must be positive on any seeded DB.
    ck('organizations.count > 0 on a seeded platform',
       isinstance(o.get('count'), int) and o['count'] > 0,
       f'value={o.get("count")}')

    c = body.get('clinics') or {}
    ck('clinics.count > 0 on a seeded platform',
       isinstance(c.get('count'), int) and c['count'] > 0,
       f'value={c.get("count")}')

    # The seed creates one Subscription for Glow Derma. If activeSubs.count
    # reads 0 we are back in the "structurally-always-zero" trap.
    s_active = body.get('activeSubs') or {}
    ck('activeSubs.count > 0 on a seeded platform (seed creates one for glow-derma)',
       isinstance(s_active.get('count'), int) and s_active['count'] > 0,
       f'value={s_active.get("count")}')

    mrr = body.get('mrr') or {}
    ck('mrr.pkr is a whole integer of rupees', isinstance(mrr.get('pkr'), int) and mrr['pkr'] >= 0,
       f'value={mrr.get("pkr")}')

    # And its MRR must therefore be non-zero. Same trap otherwise.
    ck('mrr.pkr > 0 when at least one active subscription exists',
       isinstance(mrr.get('pkr'), int) and mrr['pkr'] > 0,
       f'value={mrr.get("pkr")}')

    for key in ('organizations', 'clinics', 'activeSubs'):
        v = body.get(key, {}).get('deltaPct')
        ck(f'{key}.deltaPct is not NaN/Infinity', v is None or (isinstance(v, (int, float)) and v == v and v not in (float("inf"), float("-inf"))),
           f'value={v}')


# --- /platform/clinic-distribution ------------------------------------------

print('\n== GET /platform/clinic-distribution ==')

s, body = api('GET', '/platform/clinic-distribution', admin_token)
ck('platform admin gets 200', s == 200, f'HTTP {s}')

if isinstance(body, dict):
    ck('total is a non-negative int', isinstance(body.get('total'), int) and body['total'] >= 0, f'value={body.get("total")}')
    ck('buckets is a list', isinstance(body.get('buckets'), list), f'type={type(body.get("buckets")).__name__}')
    buckets = body.get('buckets') or []
    if buckets:
        first = buckets[0]
        for k in ('key', 'label', 'count', 'pct'):
            ck(f'each bucket has "{k}" — checked on the first', k in first, f'keys={list(first.keys())}')
        counts_desc = all(buckets[i]['count'] >= buckets[i + 1]['count'] for i in range(len(buckets) - 1))
        ck('buckets are sorted by count DESC', counts_desc)
        # Percentages should not sum to more than 100.1 (rounding tolerance).
        pct_sum = sum(b.get('pct', 0) for b in buckets)
        ck('bucket percentages sum to ~100 (± rounding)', 99.0 <= pct_sum <= 100.5, f'sum={pct_sum}')
        # Every non-zero bucket is included; the spec omits count==0.
        ck('no bucket has count == 0', all(b.get('count', 0) > 0 for b in buckets))


# --- /platform/tenants/paged — the "counts real, not always-zero" invariant

print('\n== GET /platform/tenants/paged — real counts inside forTenant() ==')

s, body = api('GET', '/platform/tenants/paged?limit=50&offset=0', admin_token)
ck('platform admin gets 200', s == 200, f'HTTP {s}')

if isinstance(body, dict):
    for k in ('total', 'limit', 'offset', 'rows'):
        ck(f'response has "{k}"', k in body, f'keys={list(body.keys())}')

    rows = body.get('rows') or []
    ck('paginated list returned some rows', len(rows) > 0, f'rows={len(rows)}')

    # Find the seeded tenant that DEFINITELY has patients — glow-derma from the
    # seed carries four. If this row reads zero patients we are back in the
    # "structurally-always-zero" regime, which was the fix that motivated this
    # whole endpoint. This is the single most load-bearing check in the suite.
    glow = next((r for r in rows if r.get('slug') == 'glow-derma'), None)
    ck('the seeded Glow Derma tenant is present', bool(glow), f'slugs={[r.get("slug") for r in rows][:5]}')

    if glow:
        # Ground-truth SQL check is preferred but requires a reachable local
        # DB (psql). When that's not available (running the suite against a
        # remote environment from a workstation with no local psql), fall
        # back to a WEAKER but still meaningful invariant: the seeded
        # glow-derma tenant is populated per the seed script, so its
        # counts must be strictly positive. Zero would be the exact
        # "structurally-always-zero" regression this row exists to catch.
        try:
            real_patients = int(psql("SELECT count(*) FROM \"Patient\" WHERE \"tenantId\" = '{}';".format(glow['id'])).strip())
            real_users = int(psql("SELECT count(*) FROM \"User\" WHERE \"tenantId\" = '{}';".format(glow['id'])).strip())

            ck(f'glow-derma.patients matches ground truth ({real_patients})',
               glow.get('patients') == real_patients,
               f'endpoint={glow.get("patients")} sql={real_patients}')
            ck(f'glow-derma.users matches ground truth ({real_users})',
               glow.get('users') == real_users,
               f'endpoint={glow.get("users")} sql={real_users}')
        except SystemExit:
            # _db.py exits on SQL setup failure. That is correct default
            # behaviour for the strong check. Here we choose the weaker
            # invariant deliberately, and say so out loud in the output.
            print('  (SQL ground truth unavailable — falling back to "count > 0" invariant)')
            ck('glow-derma.patients > 0 (weaker check; SQL ground truth unavailable)',
               isinstance(glow.get('patients'), int) and glow['patients'] > 0,
               f'value={glow.get("patients")}')
            ck('glow-derma.users > 0 (weaker check; SQL ground truth unavailable)',
               isinstance(glow.get('users'), int) and glow['users'] > 0,
               f'value={glow.get("users")}')

        ck('glow-derma has a branch count (>=0)', isinstance(glow.get('branches'), int) and glow['branches'] >= 0,
           f'value={glow.get("branches")}')

        modules = glow.get('modules') or []
        ck('glow-derma modules list is present (may be empty)', isinstance(modules, list))
        ck('modules list is capped at 6', len(modules) <= 6, f'len={len(modules)}')
        if modules:
            ck('each module row has key + label — checked on the first',
               all(k in modules[0] for k in ('key', 'label')), f'first={modules[0]}')

    # Pagination invariants.
    ck('paged returns limit as requested', body.get('limit') == 50)
    ck('paged returns offset as requested', body.get('offset') == 0)


# --- /platform/onboarding-activity ------------------------------------------

print('\n== GET /platform/onboarding-activity ==')

s, body = api('GET', '/platform/onboarding-activity?limit=5', admin_token)
ck('platform admin gets 200', s == 200, f'HTTP {s}')

if isinstance(body, dict):
    rows = body.get('rows') or []
    ck('rows is a list (may be empty on a bare install)', isinstance(rows, list))
    if len(rows) >= 2:
        # Sorted by createdAt DESC.
        ck('rows are sorted by createdAt DESC',
           all(rows[i]['createdAt'] >= rows[i + 1]['createdAt'] for i in range(len(rows) - 1)))
    if rows:
        first = rows[0]
        for k in ('tenantId', 'name', 'edition', 'branches', 'createdAt', 'kind'):
            ck(f'each row has "{k}" — checked on the first', k in first, f'keys={list(first.keys())}')


# --- /platform/popular-modules ---------------------------------------------

print('\n== GET /platform/popular-modules ==')

s, body = api('GET', '/platform/popular-modules', admin_token)
ck('platform admin gets 200', s == 200, f'HTTP {s}')

if isinstance(body, dict):
    modules = body.get('modules') or []
    ck('modules is a list', isinstance(modules, list))
    ck('at most 8 modules returned', len(modules) <= 8, f'len={len(modules)}')

    # THE INVARIANT THIS ENDPOINT EXISTS TO PROVE.
    # The seeded tenant carries many enabled entitlements; the endpoint must
    # return SOMETHING. Zero is the exact regression pattern that made the
    # naked-groupBy earlier bugs invisible for weeks. This check must run
    # unconditionally — a previous version guarded it behind "if modules:"
    # and empty passed silently.
    ck('at least one module was returned (the platform has enabled features)',
       len(modules) > 0,
       f'len={len(modules)}')

    if len(modules) >= 2:
        ck('modules sorted by activeClinics DESC',
           all(modules[i]['activeClinics'] >= modules[i + 1]['activeClinics'] for i in range(len(modules) - 1)))
    if modules:
        first = modules[0]
        for k in ('key', 'label', 'activeClinics'):
            ck(f'each module has "{k}" — checked on the first', k in first, f'keys={list(first.keys())}')

        # The top module must have a positive count — if this is zero the
        # popularity aggregation returned rows but their counts are zero,
        # which means whatever grouped-by mechanism ran did not see the
        # enabled entitlements it should have.
        ck('the top module has activeClinics > 0', first.get('activeClinics', 0) > 0,
           f'top={first}')


# --- /platform/health -------------------------------------------------------

print('\n== GET /platform/health ==')

s, body = api('GET', '/platform/health', admin_token)
ck('platform admin gets 200', s == 200, f'HTTP {s}')

if isinstance(body, dict):
    ck('status is a health level', body.get('status') in ('healthy', 'degraded', 'down'), f'status={body.get("status")}')
    checks = body.get('checks') or []
    ck('checks list carries at least the DB', any(c.get('key') == 'db' for c in checks), f'checks={[c.get("key") for c in checks]}')
    db_check = next((c for c in checks if c.get('key') == 'db'), {})
    ck('database check is healthy (we just used it)', db_check.get('status') == 'healthy',
       f'db={db_check}')


# --- Result -----------------------------------------------------------------

passed = sum(1 for r in results if r)
total = len(results)
print(f'\n{passed}/{total} checks passed')
if passed != total:
    raise SystemExit('PLATFORM DASHBOARD SUITE FAILED — do not deploy.')
print('PASS — the six platform-dashboard endpoints answer with real, contract-shaped data.')
