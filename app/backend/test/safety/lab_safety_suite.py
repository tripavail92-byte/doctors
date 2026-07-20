"""Lab / LIS safety suite.

A lab result drives a clinical decision, so the failures that matter are: a
result that never reaches the clinician, and a result flagged wrongly against its
reference range. This suite proves the order lifecycle cannot trap a finished
result, and that numeric results are flagged low/normal/high correctly.

Each scenario uses a fresh patient so order state never leaks between cases.

Run: python test/safety/lab_safety_suite.py
"""
import json, time, urllib.request, urllib.error
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _ids import mrn  # run-unique fixtures; see _ids.py

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
N = [0]


def patient():
    N[0] += 1
    s, p = api('POST', '/patients', tok, {'mrn': mrn('LAB'), 'name': 'Lab Probe %d' % U,
                                          'phone': '+92 300 5555555'})
    return p['id']


def flag_of(order, code):
    return next((r['flag'] for r in order.get('results') or [] if r['testCode'] == code), None)


print('\n== A test ordered twice does not trap the order ==')
# results are keyed by (order, testCode) and upserted, so ordering the same code
# twice used to create two items one result could never satisfy — report() then
# refused forever even though the test WAS resulted. Dedupe is the fix.
pid = patient()
s, o = api('POST', '/lab/orders', tok, {'patientId': pid, 'testCodes': ['HB', 'HB', 'GLU_F']})
ck('a duplicate test code collapses to one item', len(o.get('items') or []) == 2,
   [i['testCode'] for i in o.get('items') or []])
oid = o['id']
api('PATCH', '/lab/orders/%s/collect' % oid, tok, {})
api('POST', '/lab/orders/%s/results' % oid, tok, {'testCode': 'HB', 'value': 13})
s, r = api('POST', '/lab/orders/%s/results' % oid, tok, {'testCode': 'GLU_F', 'value': 90})
ck('resulting all (deduped) tests moves the order to RESULTED', r.get('status') == 'RESULTED', r.get('status'))
s, rep = api('PATCH', '/lab/orders/%s/report' % oid, tok, {})
ck('and the order CAN be reported (was permanently stuck before)', rep.get('status') == 'REPORTED', rep.get('status'))

print('\n== Results are flagged against the reference range ==')
pid = patient()
s, o = api('POST', '/lab/orders', tok, {'patientId': pid, 'testCodes': ['HB', 'GLU_F', 'URINE_CS']})
oid = o['id']
api('PATCH', '/lab/orders/%s/collect' % oid, tok, {})
api('POST', '/lab/orders/%s/results' % oid, tok, {'testCode': 'HB', 'value': 9})       # refLow 12 -> low
api('POST', '/lab/orders/%s/results' % oid, tok, {'testCode': 'GLU_F', 'value': 250})  # refHigh 100 -> high
s, o = api('GET', '/lab/orders/%s' % oid, tok)
ck('HB 9 (ref 12-16) flags LOW', flag_of(o, 'HB') == 'low', flag_of(o, 'HB'))
ck('glucose 250 (ref 70-100) flags HIGH', flag_of(o, 'GLU_F') == 'high', flag_of(o, 'GLU_F'))
# Boundary: exactly refHigh is still normal (ranges are inclusive).
api('POST', '/lab/orders/%s/results' % oid, tok, {'testCode': 'HB', 'value': 16})
s, o = api('GET', '/lab/orders/%s' % oid, tok)
ck('HB exactly at refHigh (16) is NORMAL, not high', flag_of(o, 'HB') == 'normal', flag_of(o, 'HB'))
# A text/culture test is reported, never range-flagged.
api('POST', '/lab/orders/%s/results' % oid, tok, {'testCode': 'URINE_CS', 'valueText': 'No growth at 48h'})
s, o = api('GET', '/lab/orders/%s' % oid, tok)
ck('a culture result is "reported", not flagged normal/high', flag_of(o, 'URINE_CS') == 'reported', flag_of(o, 'URINE_CS'))

print('\n== The lifecycle is a one-way street ==')
pid = patient()
s, o = api('POST', '/lab/orders', tok, {'patientId': pid, 'testCodes': ['HB']})
oid = o['id']
s, early = api('POST', '/lab/orders/%s/results' % oid, tok, {'testCode': 'HB', 'value': 13})
ck('a result before collection is refused', s == 400, (early.get('message') or '')[:60])
s, rep0 = api('PATCH', '/lab/orders/%s/report' % oid, tok, {})
ck('reporting before any result is refused', s == 400, (rep0.get('message') or '')[:60])
api('PATCH', '/lab/orders/%s/collect' % oid, tok, {})
s, dup = api('PATCH', '/lab/orders/%s/collect' % oid, tok, {})
ck('collecting a second time is refused', s == 400, (dup.get('message') or '')[:60])
api('POST', '/lab/orders/%s/results' % oid, tok, {'testCode': 'HB', 'value': 13})
api('PATCH', '/lab/orders/%s/report' % oid, tok, {})
s, again = api('PATCH', '/lab/orders/%s/report' % oid, tok, {})
ck('reporting a second time is refused', s == 400, (again.get('message') or '')[:60])
s, canc = api('PATCH', '/lab/orders/%s/cancel' % oid, tok, {})
ck('a reported order cannot be cancelled', s == 400, (canc.get('message') or '')[:60])

print('\n== An unordered test cannot be resulted ==')
pid = patient()
s, o = api('POST', '/lab/orders', tok, {'patientId': pid, 'testCodes': ['HB']})
oid = o['id']
api('PATCH', '/lab/orders/%s/collect' % oid, tok, {})
s, wrong = api('POST', '/lab/orders/%s/results' % oid, tok, {'testCode': 'TSH', 'value': 2})
ck('a result for a test that was not ordered is refused', s == 400, (wrong.get('message') or '')[:60])

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
