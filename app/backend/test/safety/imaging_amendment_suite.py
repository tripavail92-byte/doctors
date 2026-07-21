"""A finalized imaging report can be corrected — without ever being altered.

THE DEFECT THIS REPLACES. `addReport` admitted an already-REPORTED order and
upserted, so the update branch rewrote findings and impression ON THE SAME ROW,
keeping the original timestamp. Reproduced live: "acute intracranial haemorrhage"
became "No acute abnormality" with nothing recording that it had ever changed,
and any clinical role could do it.

Making the report immutable closed that, but left corrections with no route at
all — which is worse than it sounds, because the correction then happens on paper
or over the phone, outside the record entirely.

THE MODEL, and why it is shaped this way. Four standards families converge on it
independently:
  - the original is never mutated (AHIMA, DICOM keeps the predecessor);
  - an amendment is a NEW ROW carrying COMPLETE text, never a delta — IHE: "the
    entire content of the changed imaging result shall be sent. Differential
    content alone... shall not be sent";
  - status uses HL7 FHIR's vocabulary verbatim (appended / corrected / amended /
    entered-in-error) so it interoperates without translation;
  - communication to the referrer is recorded with date, method and the NAME of
    the person told (ACR), and an electronic route counts only where receipt is
    acknowledged.

Exactly one live version per study is guaranteed by the partial unique index
`imaging_report_one_current_per_study`, not by the order of statements in the
service. A read is not a constraint.

Run: python test/safety/imaging_amendment_suite.py
"""
import json
import os
import sys
import threading
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _ids import mrn  # noqa: E402
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
    print(('  PASS  ' if c else '  FAIL  ') + l + (('  -> ' + str(d)[:110]) if d != '' else ''))


s, t = api('POST', '/auth/login', None, {'email': 'owner@glowderma.pk', 'password': 'Password123!'})
tok = t['accessToken']
s, P = api('POST', '/patients', tok, {'mrn': mrn('AMEND'), 'name': 'Amend Probe', 'phone': '+92 300 2121212'})


def reported_order(findings, impression):
    s, o = api('POST', '/imaging/orders', tok, {'patientId': P['id'], 'studyCodes': ['CXR']})
    api('PATCH', '/imaging/orders/%s/acquire' % o['id'], tok, {})
    s, r = api('POST', '/imaging/orders/%s/reports' % o['id'], tok,
               {'studyCode': 'CXR', 'findings': findings, 'impression': impression})
    return o['id'], (r.get('reports') or [])[0]


def versions(order_id):
    s, o = api('GET', '/imaging/orders/%s' % order_id, tok)
    return sorted(o.get('reports') or [], key=lambda x: -x.get('version', 0))


print('\n== The original is never altered ==')
oid, v1 = reported_order('acute intracranial haemorrhage', 'URGENT')
ck('a first report is version 1 and current', v1.get('version') == 1 and v1.get('isCurrent') is True,
   'v%s current=%s' % (v1.get('version'), v1.get('isCurrent')))

s, am = api('POST', '/imaging/reports/%s/amend' % v1['id'], tok,
            {'findings': 'No acute abnormality on review', 'impression': 'normal',
             'reason': 'over-read by consultant', 'status': 'CORRECTED'})
ck('a finalized report can be amended', s in (200, 201), 'HTTP %s' % s)

vs = versions(oid)
orig = [x for x in vs if x['id'] == v1['id']][0]
cur = [x for x in vs if x['isCurrent']][0]

# THE central assertion. Compare against the values captured BEFORE the amendment.
ck('the original findings text is byte-identical', orig['findings'] == v1['findings'], orig['findings'][:50])
ck('the original impression is byte-identical', orig['impression'] == v1['impression'], orig['impression'][:40])
ck('the original reportedAt is unchanged', orig['reportedAt'] == v1['reportedAt'], orig['reportedAt'])
ck('the original is marked superseded', orig['isCurrent'] is False, orig['isCurrent'])

ck('the amendment is a NEW row', cur['id'] != v1['id'], '%s vs %s' % (cur['id'][:8], v1['id'][:8]))
ck('it is version 2', cur.get('version') == 2, cur.get('version'))
ck('it points back at what it replaced', cur.get('supersedesReportId') == v1['id'], cur.get('supersedesReportId'))
ck('it carries the FHIR status given', cur.get('status') == 'CORRECTED', cur.get('status'))
ck('it records why', 'consultant' in (cur.get('amendmentReason') or ''), cur.get('amendmentReason'))

# Complete text, not a delta — IHE requires the whole content.
ck('it carries COMPLETE findings, not a delta',
   cur['findings'] == 'No acute abnormality on review', cur['findings'][:50])

print('\n== History is visible, not hidden ==')
ck('both versions are returned to a reader', len(vs) == 2, '%d versions' % len(vs))
ck('the superseded text is still readable',
   any('haemorrhage' in x['findings'] for x in vs), [x['version'] for x in vs])


print('\n== Exactly one version is live ==')
n = psql("SELECT count(*) FROM \"ImagingReport\" WHERE \"orderId\" = '%s' AND \"isCurrent\" = true;" % oid).strip()
ck('the database holds exactly one current row', n == '1', '%s current' % n)

s, again = api('POST', '/imaging/reports/%s/amend' % v1['id'], tok,
               {'findings': 'x', 'impression': 'y', 'reason': 'stale', 'status': 'AMENDED'})
ck('amending a SUPERSEDED version is refused', s in (400, 409), 'HTTP %s' % s)

# Chain further, to prove versioning is not a one-shot.
s, am3 = api('POST', '/imaging/reports/%s/amend' % cur['id'], tok,
             {'findings': 'Addendum: small nodule', 'impression': 'follow up',
              'reason': 'addendum after review', 'status': 'APPENDED'})
vs3 = versions(oid)
ck('the chain extends to version 3', [x['version'] for x in vs3] == [3, 2, 1], [x['version'] for x in vs3])
ck('still exactly one current row', len([x for x in vs3 if x['isCurrent']]) == 1,
   len([x for x in vs3 if x['isCurrent']]))


print('\n== The race: two amendments of one report ==')
# The partial unique index is the guarantee, not the statement order. Exactly one
# may win; the loser must be a clean 4xx and must not fork the chain.
oid2, base = reported_order('baseline finding', 'baseline')
out = []
lk = threading.Lock()


def amend(i):
    st, _ = api('POST', '/imaging/reports/%s/amend' % base['id'], tok,
                {'findings': 'concurrent %d' % i, 'impression': 'c', 'reason': 'race %d' % i,
                 'status': 'AMENDED'})
    with lk:
        out.append(st)


ths = [threading.Thread(target=amend, args=(i,)) for i in range(5)]
for x in ths:
    x.start()
for x in ths:
    x.join()

won = len([c for c in out if c in (200, 201)])
ck('exactly one concurrent amendment wins', won == 1, 'codes=%s' % sorted(out))
ck('every loser is a clean 4xx, not a 500', all(c < 500 for c in out), 'codes=%s' % sorted(out))
n = psql("SELECT count(*) FROM \"ImagingReport\" WHERE \"orderId\" = '%s' AND \"isCurrent\" = true;" % oid2).strip()
ck('and the study still has ONE current report', n == '1', '%s current' % n)


print('\n== Communication to the referrer is recorded, and electronic proves receipt ==')
live = [x for x in versions(oid) if x['isCurrent']][0]
s, c = api('POST', '/imaging/reports/%s/communications' % live['id'], tok,
           {'recipientName': 'Dr Imran (referrer)', 'method': 'phone', 'note': 'informed of corrected read'})
ck('a phone call is recorded', s in (200, 201), 'HTTP %s' % s)

s, c2 = api('POST', '/imaging/reports/%s/communications' % live['id'], tok,
            {'recipientName': 'Dr Imran', 'method': 'electronic'})
ck('an electronic route with NO acknowledgement is refused', s == 400,
   'HTTP %s %s' % (s, str(c2.get('message'))[:60]))

s, c3 = api('POST', '/imaging/reports/%s/communications' % live['id'], tok,
            {'recipientName': 'Dr Imran', 'method': 'electronic',
             'acknowledgedAt': '2026-07-21T10:00:00Z'})
ck('an acknowledged electronic route is accepted', s in (200, 201), 'HTTP %s' % s)

vsc = versions(oid)
livec = [x for x in vsc if x['isCurrent']][0]
ck('the report carries its communication records', len(livec.get('communications') or []) == 2,
   len(livec.get('communications') or []))
ck('and the recipient NAME is stored, not just a flag',
   any(x.get('recipientName', '').startswith('Dr Imran') for x in (livec.get('communications') or [])),
   [x.get('recipientName') for x in (livec.get('communications') or [])])


print('\n== A withdrawn report is terminal ==')
oid3, v = reported_order('filed against the wrong patient', 'void')
s, w = api('POST', '/imaging/reports/%s/amend' % v['id'], tok,
           {'findings': 'withdrawn', 'impression': 'withdrawn',
            'reason': 'filed against the wrong patient', 'status': 'ENTERED_IN_ERROR'})
ck('a report can be withdrawn as entered-in-error', s in (200, 201), 'HTTP %s' % s)
wcur = [x for x in versions(oid3) if x['isCurrent']][0]
s, x = api('POST', '/imaging/reports/%s/amend' % wcur['id'], tok,
           {'findings': 'f', 'impression': 'i', 'reason': 'r', 'status': 'AMENDED'})
ck('a withdrawn report cannot then be amended', s == 400, 'HTTP %s' % s)


print('\n== The status vocabulary is constrained ==')
s, bad = api('POST', '/imaging/reports/%s/amend' % livec['id'], tok,
             {'findings': 'f', 'impression': 'i', 'reason': 'relabel', 'status': 'FINAL'})
ck('an amendment cannot be relabelled as an original (FINAL)', s == 400, 'HTTP %s' % s)
s, bad2 = api('POST', '/imaging/reports/%s/amend' % livec['id'], tok,
              {'findings': 'f', 'impression': 'i', 'reason': 'x', 'status': 'NOT_A_STATUS'})
ck('an unknown status is refused', s == 400, 'HTTP %s' % s)
s, bad3 = api('POST', '/imaging/reports/%s/amend' % livec['id'], tok,
              {'findings': 'f', 'impression': 'i', 'status': 'AMENDED'})
ck('an amendment with no stated reason is refused', s == 400, 'HTTP %s' % s)


print('\n===== %d/%d passed =====' % (sum(res), len(res)))
if not res:
    print('  NO CHECKS RAN - the suite asserted nothing')
    raise SystemExit(1)
_failed = len(res) - sum(res)
if _failed:
    print('  %d CHECK(S) FAILED' % _failed)
raise SystemExit(1 if _failed else 0)
