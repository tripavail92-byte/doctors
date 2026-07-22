"""Onboarding a clinic — and the wall between two of them.

Until this module existed there was no way to create a tenant at all. The
isolation underneath is the most heavily verified thing in this codebase, and
the only tenant that could ever exist was the one the seed wrote.

Two questions this suite exists to answer, neither of which any other check
asks:

1. CAN A CLINIC OWNER REACH THE PLATFORM SURFACE? These routes cross the tenant
   boundary by design — listing every clinic on the platform, and minting one.
   An OWNER reaching them would see the names, editions and patient counts of
   every competitor. Asserted as a real OWNER, not by reading the decorator: a
   commented-out @Roles has satisfied a source-text check on this project before.

2. IS A NEWLY ONBOARDED CLINIC ACTUALLY ISOLATED? A tenant created through this
   API is written by the runtime role under RLS, not by the owner role the seed
   uses. If the policies did not apply to it, the failure would be invisible
   until a second customer existed — which is precisely when it is unrecoverable.

Run: python test/safety/tenant_onboarding_suite.py
"""
import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _ids import mrn, RUN  # noqa: E402
from _db import psql  # noqa: E402

BASE = 'http://localhost:3000'


def api(m, p, tok=None, b=None):
    r = urllib.request.Request(BASE + p, method=m)
    r.add_header('Content-Type', 'application/json')
    if tok:
        r.add_header('Authorization', 'Bearer ' + tok)
    d = json.dumps(b).encode() if b is not None else None
    try:
        with urllib.request.urlopen(r, d) as x:
            return x.status, json.loads(x.read() or b'{}')
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b'{}')
        except Exception:
            return e.code, {}


def msg(body):
    """The server's message, whatever shape the body came back in.

    A refused request returns an object with `message`; a SUCCESSFUL one here
    returns a LIST of clinics. Calling .get() on that raised AttributeError and
    aborted the whole suite mid-run, so a single regression hid every check
    after it. A probe must report a failure, not become one.
    """
    if isinstance(body, dict):
        return str(body.get('message'))
    return '(no message — body was a %s, i.e. the request SUCCEEDED)' % type(body).__name__


res = []


def ck(l, c, d=''):
    res.append(bool(c))
    print(('  PASS  ' if c else '  FAIL  ') + l + (('  -> ' + str(d)[:130]) if d != '' else ''))


s, t = api('POST', '/auth/login', None, {'email': 'owner@glowderma.pk', 'password': 'Password123!'})
owner_tok = t.get('accessToken')
ck('the existing clinic owner can log in', s == 200 and owner_tok, 'HTTP %s' % s)

# The platform admin. Same password as the owner in a seeded dev database.
s, t2 = api('POST', '/auth/login', None,
            {'email': 'admin@summitsystems.pk', 'password': 'Password123!'})
admin_tok = t2.get('accessToken')
ck('the platform admin can log in', s == 200 and admin_tok, 'HTTP %s' % s)


print('\n== A clinic owner cannot see or create clinics ==')
# The least-privileged principal that could plausibly try. An OWNER is the most
# privileged role INSIDE a clinic, which is exactly why it is the interesting
# one: if the boundary holds for them it holds for reception.
s_list, body = api('GET', '/platform/tenants', owner_tok)
ck('OWNER is REFUSED the clinic list', s_list in (401, 403),
   'HTTP %s %s' % (s_list, msg(body)[:70]))

s_create, body = api('POST', '/platform/tenants', owner_tok, {
    'name': 'Should Not Exist %s' % RUN, 'slug': 'nope-%s' % RUN.lower()[:12],
    'edition': 'CLINIC', 'ownerEmail': 'nope-%s@x.pk' % RUN,
    'ownerName': 'Nope', 'ownerPassword': 'a-long-enough-password',
})
ck('OWNER is REFUSED clinic creation', s_create in (401, 403),
   'HTTP %s %s' % (s_create, msg(body)[:70]))

# And the refusal must be a refusal, not an error page over a completed write.
n = psql("SELECT count(*) FROM \"Tenant\" WHERE slug LIKE 'nope-%';").strip()
ck('and no clinic was created by the refused request', n == '0', '%s row(s)' % n)


print('\n== The platform admin can onboard a clinic ==')
SLUG = 'derma-%s' % RUN.lower()[:10]
EMAIL = 'owner-%s@dermacare.pk' % RUN.lower()[:10]
PW = 'derma-clinic-password-%s' % RUN[:6]
s, created = api('POST', '/platform/tenants', admin_tok, {
    'name': 'Derma Care — DHA', 'slug': SLUG, 'edition': 'SPECIALTY',
    'ownerEmail': EMAIL, 'ownerName': 'Dr. Imran Shah',
    'ownerPassword': PW, 'city': 'Lahore',
})
ck('a clinic is created', s in (200, 201), 'HTTP %s %s' % (s, msg(created)[:90]))
new_tenant_id = created.get('id')
ck('it comes back with an id, an owner and a facility',
   bool(new_tenant_id and created.get('owner') and created.get('facility')), str(created)[:100])
ck('its edition entitlements were granted', (created.get('entitlements') or 0) > 0,
   '%s entitlements' % created.get('entitlements'))
ck('the specialty packs were activated', len(created.get('packs') or []) > 0,
   str(created.get('packs')))

# Written by the RUNTIME role under RLS, so confirm the rows really landed.
n = psql("SELECT count(*) FROM \"User\" WHERE email = '%s';" % EMAIL).strip()
ck('the owner account exists in the database', n == '1', '%s row(s)' % n)


print('\n== The new clinic is isolated from the old one ==')
s, t3 = api('POST', '/auth/login', None, {'email': EMAIL, 'password': PW})
new_tok = t3.get('accessToken')
ck('the new clinic owner can log in', s == 200 and new_tok, 'HTTP %s' % s)

# Glow Derma has patients. The new clinic must see NONE of them — this is the
# whole product promise, and the first time it has been exercised between two
# tenants that were not both hand-made by the seed.
s, glow_patients = api('GET', '/patients', owner_tok)
ck('the original clinic sees its own patients', s == 200 and len(glow_patients) > 0,
   '%s patients' % (len(glow_patients) if isinstance(glow_patients, list) else '?'))

s, new_patients = api('GET', '/patients', new_tok)
ck('the new clinic starts with an empty patient list', s == 200 and new_patients == [],
   'HTTP %s %s' % (s, str(new_patients)[:60]))

# Assert the NEGATIVE explicitly: not merely "a different count", but that no
# identifier from clinic A appears in clinic B's response.
glow_ids = {p['id'] for p in glow_patients} if isinstance(glow_patients, list) else set()
new_ids = {p['id'] for p in new_patients} if isinstance(new_patients, list) else set()
ck('no patient of the original clinic is visible to the new one',
   not (glow_ids & new_ids), '%d shared id(s)' % len(glow_ids & new_ids))

# And by direct reference, which is the attack a list query does not cover.
if glow_ids:
    victim = sorted(glow_ids)[0]
    s_direct, body = api('GET', '/patients/%s' % victim, new_tok)
    ck('fetching another clinic\'s patient BY ID is refused',
       s_direct in (403, 404), 'HTTP %s' % s_direct)


print('\n== Duplicates are refused with a sentence, not a 500 ==')
s_dup, body = api('POST', '/platform/tenants', admin_tok, {
    'name': 'Another', 'slug': SLUG, 'edition': 'CLINIC',
    'ownerEmail': 'different-%s@x.pk' % RUN, 'ownerName': 'Valid Name',
    'ownerPassword': 'a-long-enough-password',
})
ck('the duplicate-slug request was otherwise valid (a 400 here would mean the '
   'request never reached the duplicate check)', s_dup != 400,
   'HTTP %s %s' % (s_dup, msg(body)[:80]))
ck('a duplicate slug is refused', s_dup == 409, 'HTTP %s' % s_dup)
ck('and the refusal names the slug', SLUG in msg(body), msg(body)[:90])

s_dup2, body = api('POST', '/platform/tenants', admin_tok, {
    'name': 'Another', 'slug': 'other-%s' % RUN.lower()[:10], 'edition': 'CLINIC',
    'ownerEmail': EMAIL, 'ownerName': 'Valid Name', 'ownerPassword': 'a-long-enough-password',
})
ck('a duplicate owner email is refused', s_dup2 == 409, 'HTTP %s' % s_dup2)

# The Tenant row is written OUTSIDE the provisioning transaction — it has to be,
# because its id is what the RLS context is set to. So a failure inside used to
# strand an ownerless clinic in the platform list: reproduced, and one is still
# sitting in this dev database from before the fix. Assert the row is gone, not
# merely that the request returned 409.
OTHER = 'other-%s' % RUN.lower()[:10]
n = psql("SELECT count(*) FROM \"Tenant\" WHERE slug = '%s';" % OTHER).strip()
ck('and the half-created clinic was removed, not left ownerless', n == '0',
   '%s row(s) for %s' % (n, OTHER))

# Nothing anywhere should be a clinic with no way in.
orphans = psql('SELECT count(*) FROM "Tenant" t '
               'LEFT JOIN "User" u ON u."tenantId" = t.id WHERE u.id IS NULL;').strip()
ck('no clinic on the platform is left without a single user', orphans == '0',
   '%s ownerless clinic(s) — nobody can sign in to fix those' % orphans)


print('\n== A weak owner password is refused ==')
# This account reads every patient record in the clinic from the moment it
# exists. The floor is enforced server-side, not by whoever fills the form.
s_weak, body = api('POST', '/platform/tenants', admin_tok, {
    'name': 'Weak', 'slug': 'weak-%s' % RUN.lower()[:10], 'edition': 'CLINIC',
    'ownerEmail': 'weak-%s@x.pk' % RUN, 'ownerName': 'Valid Name', 'ownerPassword': 'short',
})
ck('a short owner password is refused', s_weak == 400, 'HTTP %s' % s_weak)
n = psql("SELECT count(*) FROM \"Tenant\" WHERE slug LIKE 'weak-%';").strip()
ck('and no clinic was created by the refused request', n == '0', '%s row(s)' % n)


print('\n===== %d/%d passed =====' % (sum(res), len(res)))
if not res:
    print('  NO CHECKS RAN - the suite asserted nothing')
    raise SystemExit(1)
_failed = len(res) - sum(res)
if _failed:
    print('  %d CHECK(S) FAILED' % _failed)
raise SystemExit(1 if _failed else 0)
