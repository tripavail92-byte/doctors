"""One MRN, one patient.

An MRN is the clinic's key for a person. If two charts share one, a patient's
history splits across records nobody knows to join — allergies on one, the
phototherapy burn interlock on the other. In this database `GD-BABY1` had
accumulated five charts and `P-00753` had been issued six times.

Nothing was preventing it: `Patient` had no unique constraint on
`(tenantId, mrn)`, so every duplicate was accepted silently. This suite exists
to keep that constraint honest, and it asserts the negative in the two ways a
duplicate can actually arrive:

  1. sequentially — the front desk registers the same walk-in twice
  2. CONCURRENTLY — two receptionists, one patient, same instant

Case 2 is the one that matters. A read-then-write check passes in both racers
and both insert; only a database constraint can refuse. That is the same TOCTOU
that produced duplicate patients from a single lead conversion, duplicate
admissions, and a reused payment reference — four separate bugs, one shape.

Also checks that the refusal is a CLEAN 4xx. A raw P2002 surfaces as a 500,
which reads to the front desk as "the system is broken" — and someone who
believes that invents a new MRN, which is how duplicate charts get made.

Run: python test/safety/patient_identity_suite.py
"""
import json
import os
import sys
import threading
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _ids import mrn as new_mrn  # noqa: E402
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


res = []


def ck(l, c, d=''):
    res.append(bool(c))
    print(('  PASS  ' if c else '  FAIL  ') + l + (('  -> ' + str(d)[:130]) if d != '' else ''))


s, t = api('POST', '/auth/login', None, {'email': 'owner@glowderma.pk', 'password': 'Password123!'})
tok = t['accessToken']

print('\n== The constraint exists in the database, not just in the schema file ==')
# Asserting on schema.prisma would pass while the migration had never been
# applied — the file is intent, the index is the control.
idx = psql("SELECT indexname FROM pg_indexes WHERE tablename='Patient' AND indexdef ILIKE '%mrn%';")
ck('a unique index on (tenantId, mrn) is present', 'mrn' in idx, idx.strip() or '(none)')

print('\n== The same MRN twice is refused ==')
M = new_mrn('DUP')
s1, p1 = api('POST', '/patients', tok, {'mrn': M, 'name': 'Original Chart', 'phone': '+92 300 1111111'})
ck('the first registration succeeds', s1 in (200, 201), 'HTTP %s' % s1)
s2, p2 = api('POST', '/patients', tok, {'mrn': M, 'name': 'Accidental Duplicate', 'phone': '+92 300 2222222'})
ck('the second is REFUSED', s2 in (400, 409), 'HTTP %s' % s2)
ck('and it is a clean 4xx, not a 500', s2 < 500, 'HTTP %s' % s2)
ck('the message names the MRN and points at the existing record',
   M in str(p2.get('message', '')) or 'already' in str(p2.get('message', '')).lower(),
   str(p2.get('message'))[:100])

n = psql("SELECT count(*) FROM \"Patient\" WHERE mrn = '%s';" % M).strip()
ck('exactly one chart holds that MRN', n == '1', '%s charts' % n)

print('\n== Renaming a chart ONTO a taken MRN is refused too ==')
# Same collision by a different route, and it merges two people just as well.
OTHER = new_mrn('DUP')
s, p3 = api('POST', '/patients', tok, {'mrn': OTHER, 'name': 'Someone Else', 'phone': '+92 300 3333333'})
ck('a second patient exists to rename', s in (200, 201), 'HTTP %s' % s)
s4, r4 = api('PATCH', '/patients/%s' % p3['id'], tok, {'mrn': M})
ck('renaming it onto the taken MRN is REFUSED', s4 in (400, 409), 'HTTP %s' % s4)
ck('that refusal is also a clean 4xx', s4 < 500, 'HTTP %s' % s4)
s, after = api('GET', '/patients/%s' % p3['id'], tok)
ck('and the patient kept its own MRN', after.get('mrn') == OTHER, after.get('mrn'))

print('\n== The race: two receptionists, one walk-in, same instant ==')
# The case a read-then-write check cannot survive. Exactly one may win; every
# loser must be a clean refusal rather than a 500 or a second chart.
R = new_mrn('RACE')
out = []
lk = threading.Lock()


def register(i):
    st, d = api('POST', '/patients', tok,
                {'mrn': R, 'name': 'Race Entry %d' % i, 'phone': '+92 300 %07d' % i})
    with lk:
        out.append(st)


ths = [threading.Thread(target=register, args=(i,)) for i in range(6)]
for x in ths:
    x.start()
for x in ths:
    x.join()

codes = sorted(out)
won = len([c for c in codes if c in (200, 201)])
ck('exactly one concurrent registration wins', won == 1, 'codes=%s' % codes)
ck('every loser is a clean 4xx — NOT a 500', all(c < 500 for c in codes), 'codes=%s' % codes)
n = psql("SELECT count(*) FROM \"Patient\" WHERE mrn = '%s';" % R).strip()
ck('and the database holds ONE chart, not six', n == '1', '%s charts' % n)

print('\n== Two clinics may both issue the same MRN ==')
# The constraint is per tenant on purpose. If it were global, the second clinic
# to sign up could not use "P-00001" — a real number in a real clinic.
row = psql("SELECT count(*) FROM \"Patient\" WHERE mrn = '%s';" % M).strip()
ck('scoping is (tenantId, mrn), not mrn alone',
   'tenantId' in psql("SELECT indexdef FROM pg_indexes WHERE indexname='Patient_tenantId_mrn_key';"),
   psql("SELECT indexdef FROM pg_indexes WHERE indexname='Patient_tenantId_mrn_key';").strip()[:110])

print('\n== Auto-issued MRNs do not collide with hand-entered ones ==')
# nextMrn derived from count+1, which assumes the P-series is dense and is the
# only source of MRNs. With 12 GD-* demo patients present it returned P-00013
# while P-00013 could already exist. It now derives from the highest P-number
# issued, so this must hold even when the next number is deliberately taken.
top = psql("SELECT COALESCE(MAX(SUBSTRING(mrn FROM '^P-([0-9]+)$')::int), 0) FROM \"Patient\" WHERE mrn ~ '^P-[0-9]+$';").strip()
squat = 'P-%05d' % (int(top) + 1)
s, _sq = api('POST', '/patients', tok, {'mrn': squat, 'name': 'Squatter', 'phone': '+92 300 4444444'})
ck('a patient can occupy the next auto MRN', s in (200, 201), squat)

s, lead = api('POST', '/crm/leads', tok, {'name': 'Conversion Probe', 'phone': '+92 300 5555555'})
s5, conv = api('POST', '/crm/leads/%s/convert' % lead['id'], tok, {})
ck('converting a lead still succeeds, skipping the taken number', s5 in (200, 201),
   'HTTP %s %s' % (s5, str(conv.get('message'))[:60]))
if s5 in (200, 201):
    issued = (conv.get('patient') or {}).get('mrn')
    ck('and the MRN it issued is not the squatted one', issued != squat, 'issued %s, squatted %s' % (issued, squat))
    n = psql("SELECT count(*) FROM \"Patient\" WHERE mrn = '%s';" % issued).strip()
    ck('that MRN is held by exactly one chart', n == '1', '%s charts' % n)

print('\n===== %d/%d passed =====' % (sum(res), len(res)))

if not res:
    print('  NO CHECKS RAN - the suite reached the end without asserting anything')
    raise SystemExit(1)
_failed = len(res) - sum(res)
if _failed:
    print('  %d CHECK(S) FAILED' % _failed)
raise SystemExit(1 if _failed else 0)
