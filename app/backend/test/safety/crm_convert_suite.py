"""CRM lead-conversion safety suite.

Converting a lead mints a Patient — a permanent medical record with an MRN. Two
ways that went wrong, both reproduced and both fixed here: converting one lead
twice created duplicate patients (a lockless read-then-write), and concurrent
conversions minted the SAME MRN (a count with no lock). This suite fires real
concurrent requests and proves one lead makes one patient with a unique number.

Run: python test/safety/crm_convert_suite.py
"""
import json, time, urllib.request, urllib.error, threading
from collections import Counter

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
        return e.code, json.loads(e.read() or b'{}')


res = []


def ck(l, c, d=''):
    res.append(bool(c))
    print(('  PASS  ' if c else '  FAIL  ') + l + (('  -> ' + str(d)[:120]) if d != '' else ''))


s, t = api('POST', '/auth/login', None, {'email': 'owner@glowderma.pk', 'password': 'Password123!'})
tok = t['accessToken']
U = int(time.time() * 1000) % 1000000


def lead(tag):
    s, l = api('POST', '/crm/leads', tok, {'name': 'Lead %s %d' % (tag, U), 'phone': '+92 300 3333333', 'source': 'instagram'})
    return l['id']


print('\n== One lead converts to exactly one patient, even under a race ==')
lid = lead('race')
out = []
lk = threading.Lock()


def conv():
    st, d = api('POST', '/crm/leads/%s/convert' % lid, tok, {})
    with lk:
        out.append((st, (d.get('patient') or {}).get('id')))


ths = [threading.Thread(target=conv) for _ in range(6)]
for x in ths:
    x.start()
for x in ths:
    x.join()
ok = [o for o in out if o[0] in (200, 201)]
ck('exactly one of six concurrent converts succeeds', len(ok) == 1, 'codes=%s' % sorted(c for c, _ in out))
patient_ids = {pid for _, pid in ok if pid}
ck('exactly one patient record was created', len(patient_ids) == 1, len(patient_ids))
s, ld = api('GET', '/crm/leads/%s' % lid, tok)
ck('the lead is CONVERTED and linked to that one patient',
   ld.get('status') == 'CONVERTED' and ld.get('convertedPatientId') in patient_ids,
   ld.get('convertedPatientId'))

print('\n== A second (sequential) convert is refused ==')
s, again = api('POST', '/crm/leads/%s/convert' % lid, tok, {})
ck('re-converting a converted lead is refused', s == 400, (again.get('message') or '')[:50])

print('\n== Concurrent conversions mint UNIQUE MRNs ==')
leads = [lead('mrn%d' % i) for i in range(8)]
mrns = []
lk2 = threading.Lock()


def conv2(lid):
    st, d = api('POST', '/crm/leads/%s/convert' % lid, tok, {})
    m = (d.get('patient') or {}).get('mrn')
    with lk2:
        if m:
            mrns.append(m)


ths = [threading.Thread(target=conv2, args=(l,)) for l in leads]
for x in ths:
    x.start()
for x in ths:
    x.join()
dups = {k: v for k, v in Counter(mrns).items() if v > 1}
ck('8 concurrent conversions produced 8 MRNs', len(mrns) == 8, len(mrns))
ck('every generated MRN is unique (no collision)', not dups, dups if dups else 'all unique')

print('\n== The funnel counts the pipeline ==')
s, f = api('GET', '/crm/funnel', tok)
ck('funnel exposes total + conversion rate', 'total' in f and 'conversionRatePct' in f, f.get('conversionRatePct'))
ck('conversion rate is a percentage 0-100', 0 <= f.get('conversionRatePct', -1) <= 100, f.get('conversionRatePct'))

print('\n== A missing lead cannot be converted ==')
s, no = api('POST', '/crm/leads/00000000-0000-0000-0000-000000000000/convert', tok, {})
ck('converting an unknown lead is a clean 404', s == 404, s)

print('\n===== %d/%d passed =====' % (sum(res), len(res)))

# A suite that prints FAIL must FAIL THE BUILD. Without this, python exits 0
# whatever `res` contains: every check could fail and `npm run check:clinical`
# would still chain on to the next suite and finish green. The exit code — not
# the printed lines — is the only thing CI reads.
#
# `all([])` is True, so an empty run must be caught separately: a suite that
# reached the end having asserted nothing has not passed, it has not run.
if not res:
    print('  NO CHECKS RAN - the suite reached the end without asserting anything')
    raise SystemExit(1)
_failed = len(res) - sum(res)
if _failed:
    print('  %d CHECK(S) FAILED' % _failed)
raise SystemExit(1 if _failed else 0)
