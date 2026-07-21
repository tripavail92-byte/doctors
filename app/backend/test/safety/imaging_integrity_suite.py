"""Imaging records integrity — a finalized report is final, an accession is unique.

Two never-events an adversarial review REPRODUCED against this API:

1. A finalized report could be overwritten in place. addReport admitted a
   REPORTED order and upserted, so a signed "acute intracranial haemorrhage"
   became "no acute abnormality" on the same row, same reportedAt, with nothing
   recording the change. Reproduced. Fixed: a REPORTED order is terminal for
   reporting, and a study that already has a report is refused. Corrections are a
   future amendment feature, not a silent overwrite.

2. Two orders could share one accession number — the key PACS/modality worklists
   file images against, so images land under the wrong patient. accessionNumber
   had no unique constraint and the generator used count()+1 (re-issues a number
   after any hole). Reproduced both client-supplied and system-generated. Fixed:
   @@unique([tenantId, accessionNumber]) (migration 1_imaging_accession_unique),
   a MAX+1 generator, and a P2002 -> 409.

Run: python test/safety/imaging_integrity_suite.py
"""
import json
import os
import sys
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
    print(('  PASS  ' if c else '  FAIL  ') + l + (('  -> ' + str(d)[:120]) if d != '' else ''))


s, t = api('POST', '/auth/login', None, {'email': 'owner@glowderma.pk', 'password': 'Password123!'})
tok = t['accessToken']
s, studies = api('GET', '/imaging/studies', tok)
STUDY = studies[0]['code'] if isinstance(studies, list) and studies else 'CXR'


def patient(tag):
    s, p = api('POST', '/patients', tok, {'mrn': mrn(tag), 'name': 'Img %s' % tag, 'phone': '+92 300 1313131'})
    return p['id']


print('\n== A finalized report cannot be overwritten ==')
P = patient('rep')
s, o = api('POST', '/imaging/orders', tok, {'patientId': P, 'studyCodes': [STUDY]})
oid = o['id']
api('PATCH', '/imaging/orders/%s/acquire' % oid, tok, {})
s, r1 = api('POST', '/imaging/orders/%s/reports' % oid, tok,
            {'studyCode': STUDY, 'findings': 'acute intracranial haemorrhage', 'impression': 'URGENT'})
ck('the first report is accepted', s in (200, 201), 'HTTP %s' % s)

s, r2 = api('POST', '/imaging/orders/%s/reports' % oid, tok,
            {'studyCode': STUDY, 'findings': 'No acute abnormality', 'impression': 'normal'})
ck('overwriting the finalized report is REFUSED', s in (400, 409), 'HTTP %s %s' % (s, str(r2.get('message'))[:50]))

# The database is the proof: the original finding survives verbatim.
found = psql("SELECT findings FROM \"ImagingReport\" WHERE \"orderId\" = '%s';" % oid).strip()
ck('and the original haemorrhage finding is intact', found == 'acute intracranial haemorrhage', found[:50])
n = psql("SELECT count(*) FROM \"ImagingReport\" WHERE \"orderId\" = '%s';" % oid).strip()
ck('exactly one report exists for the study', n == '1', '%s reports' % n)

print('\n== A multi-study order still reports each study once ==')
# The fix must not break the legitimate flow: two studies, each reported while
# ACQUIRED, then the order auto-finalizes.
s, o2 = api('POST', '/imaging/orders', tok, {'patientId': P, 'studyCodes': [STUDY, studies[1]['code'] if len(studies) > 1 else STUDY]})
codes = list({STUDY, studies[1]['code'] if len(studies) > 1 else STUDY})
api('PATCH', '/imaging/orders/%s/acquire' % o2['id'], tok, {})
oks = 0
for c in codes:
    s, _ = api('POST', '/imaging/orders/%s/reports' % o2['id'], tok, {'studyCode': c, 'findings': 'f', 'impression': 'i'})
    oks += s in (200, 201)
ck('each ordered study reports once', oks == len(codes), '%d/%d' % (oks, len(codes)))
s, fin = api('GET', '/imaging/orders/%s' % o2['id'], tok)
ck('and the order finalizes to REPORTED', fin.get('status') == 'REPORTED', fin.get('status'))


print('\n== One accession, one order ==')
pa = patient('accA')
s, oa = api('POST', '/imaging/orders', tok, {'patientId': pa, 'studyCodes': [STUDY]})
s, ob = api('POST', '/imaging/orders', tok, {'patientId': patient('accB'), 'studyCodes': [STUDY]})
ACC = mrn('ACC')
s1, _ = api('PATCH', '/imaging/orders/%s/acquire' % oa['id'], tok, {'accessionNumber': ACC})
ck('the first order takes the accession', s1 in (200, 201), 'HTTP %s' % s1)
s2, rb = api('PATCH', '/imaging/orders/%s/acquire' % ob['id'], tok, {'accessionNumber': ACC})
ck('a second order claiming the same accession is REFUSED', s2 in (400, 409), 'HTTP %s %s' % (s2, str(rb.get('message'))[:50]))
n = psql("SELECT count(*) FROM \"ImagingOrder\" WHERE \"accessionNumber\" = '%s';" % ACC).strip()
ck('exactly one order holds that accession', n == '1', '%s orders' % n)

print('\n== System accession numbers survive a hole in the series ==')
# count()+1 re-issued an existing number after a deletion. MAX+1 does not.
pc = patient('gen')
made = []
for i in range(2):
    s, oc = api('POST', '/imaging/orders', tok, {'patientId': pc, 'studyCodes': [STUDY]})
    s, r = api('PATCH', '/imaging/orders/%s/acquire' % oc['id'], tok, {})  # system-generated accession
    made.append((oc['id'], r.get('accessionNumber')))
ck('two system accessions are distinct', made[0][1] != made[1][1], '%s vs %s' % (made[0][1], made[1][1]))
# Delete the first order's accession to punch a hole, then acquire again.
psql("UPDATE \"ImagingOrder\" SET \"accessionNumber\" = NULL WHERE id = '%s';" % made[0][0])
s, od = api('POST', '/imaging/orders', tok, {'patientId': pc, 'studyCodes': [STUDY]})
s, r = api('PATCH', '/imaging/orders/%s/acquire' % od['id'], tok, {})
ck('acquiring after a freed accession is NOT a 5xx', s in (200, 201), 'HTTP %s' % s)
ck('and the new accession collides with nothing live', r.get('accessionNumber') != made[1][1], r.get('accessionNumber'))


print('\n===== %d/%d passed =====' % (sum(res), len(res)))
if not res:
    print('  NO CHECKS RAN - the suite asserted nothing')
    raise SystemExit(1)
_failed = len(res) - sum(res)
if _failed:
    print('  %d CHECK(S) FAILED' % _failed)
raise SystemExit(1 if _failed else 0)
