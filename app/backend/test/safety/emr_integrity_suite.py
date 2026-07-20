"""EMR + billing integrity — cross-patient charting and bill-once.

Two defects an adversarial review REPRODUCED against this API, both independent
of any clinical sign-off:

1. A note/intake/plan could name an encounterId belonging to a DIFFERENT patient.
   The FK only proved the encounter existed in-tenant, not that it was this
   patient's, so patient B's "penicillin ANAPHYLAXIS" note filed under patient
   A's encounter and rendered in A's chart — while being absent from B's. This is
   the burn-hold-on-the-wrong-entity shape: an artifact keyed loosely enough to
   attach to the wrong person.

2. Billing invoices a plan only while it is PROPOSED and flips it to ACCEPTED
   under a row lock, so a plan bills once. But EMR's updatePlanStatus wrote
   any->any status with no transition rule, so ACCEPTED -> PROPOSED re-armed that
   guard and one 80,000 plan was invoiced three times (240,000 PKR). Fixed in
   three layers: a transition table (no walk back to PROPOSED), the read+write in
   one locked transaction, and a partial unique index invoice_one_per_plan as the
   real backstop.

Also guards the invoice-number generator: it derived numbers from count()+1,
which collides after any invoice is deleted or voided (a hole in the series makes
count() re-issue an existing number). MAX+1 is hole-proof.

Run: python test/safety/emr_integrity_suite.py
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


def patient(tag):
    s, p = api('POST', '/patients', tok, {'mrn': mrn(tag), 'name': 'EMR %s' % tag, 'phone': '+92 300 1212121'})
    return p['id']


print('\n== An artifact cannot be filed under another patient\'s encounter ==')
A = patient('A')
B = patient('B')
s, enc = api('POST', '/encounters', tok, {'patientId': A, 'reason': 'consult'})
ck('an encounter is created for patient A', s in (200, 201) and enc.get('patientId') == A, 'HTTP %s' % s)

# The note names patient B but A's encounter. It must be refused, not filed.
s, note = api('POST', '/note-instances', tok,
              {'patientId': B, 'encounterId': enc['id'], 'templateKey': 'soap',
               'data': {'note': 'penicillin ANAPHYLAXIS'}})
ck('a note for B naming A\'s encounter is REFUSED', s == 400, 'HTTP %s %s' % (s, str(note.get('message'))[:60]))

# And nothing was written — assert the negative in the database, not just the response.
n = psql("SELECT count(*) FROM \"NoteInstance\" WHERE \"encounterId\" = '%s';" % enc['id']).strip()
ck('and no note hangs off that encounter', n == '0', '%s notes' % n)

# The same rule for intake and plans, since all three shared the gap.
s, intake = api('POST', '/intake-submissions', tok,
                {'patientId': B, 'encounterId': enc['id'], 'packKey': 'derm', 'answers': {'q': 'a'}})
ck('an intake for B naming A\'s encounter is REFUSED', s == 400, 'HTTP %s' % s)
s, plan = api('POST', '/treatment-plans', tok,
              {'patientId': B, 'encounterId': enc['id'],
               'items': [{'code': 'X', 'name': 'x', 'unitPricePkr': 100, 'quantity': 1}]})
ck('a plan for B naming A\'s encounter is REFUSED', s == 400, 'HTTP %s' % s)

# The honest control: B's OWN encounter must still work — the rule blocks
# mismatches, not all encounter references.
s, encB = api('POST', '/encounters', tok, {'patientId': B, 'reason': 'consult'})
s, okNote = api('POST', '/note-instances', tok,
                {'patientId': B, 'encounterId': encB['id'], 'templateKey': 'soap', 'data': {'note': 'ok'}})
ck('B\'s note on B\'s own encounter is accepted', s in (200, 201) and okNote.get('encounterId') == encB['id'],
   'HTTP %s' % s)


print('\n== One treatment plan bills exactly once ==')
P = patient('bill')
s, plan = api('POST', '/treatment-plans', tok,
              {'patientId': P, 'items': [{'code': 'SVC', 'name': 'Consult', 'unitPricePkr': 80000, 'quantity': 1}]})
pid = plan['id']
ck('a plan is proposed', plan.get('status') == 'PROPOSED', plan.get('status'))

s, inv1 = api('POST', '/invoices', tok, {'planId': pid})
ck('the plan invoices once', s in (200, 201) and inv1.get('total') == 80000, 'HTTP %s total=%s' % (s, inv1.get('total')))

# The attack: reset the accepted plan to PROPOSED to re-arm billing's guard.
s, reset = api('PATCH', '/treatment-plans/%s/status' % pid, tok, {'status': 'PROPOSED'})
ck('resetting an ACCEPTED plan to PROPOSED is REFUSED', s == 400, 'HTTP %s %s' % (s, str(reset.get('message'))[:60]))

# Even if the reset had somehow happened, a second invoice must be refused.
s, inv2 = api('POST', '/invoices', tok, {'planId': pid})
ck('a second invoice for the same plan is REFUSED', s in (400, 409), 'HTTP %s' % s)

# The database is the proof: exactly one invoice references this plan.
n = psql("SELECT count(*) FROM \"Invoice\" WHERE \"planId\" = '%s';" % pid).strip()
ck('exactly one invoice references the plan', n == '1', '%s invoices' % n)

# Terminal states are terminal.
api('PATCH', '/treatment-plans/%s/status' % pid, tok, {'status': 'COMPLETED'})
s, back = api('PATCH', '/treatment-plans/%s/status' % pid, tok, {'status': 'PROPOSED'})
ck('a COMPLETED plan cannot walk back to PROPOSED', s == 400, 'HTTP %s' % s)


print('\n== Invoice numbers do not collide after a deletion ==')
# count()+1 numbering re-issues an existing number once the series has a hole.
# Create two invoices, delete the first, and a third must still get a fresh
# number rather than 500 on the (tenantId, number) unique index.
q = patient('num')
s, i1 = api('POST', '/invoices', tok, {'patientId': q, 'items': [{'code': 'A', 'name': 'a', 'unitPricePkr': 100, 'quantity': 1}]})
s, i2 = api('POST', '/invoices', tok, {'patientId': q, 'items': [{'code': 'B', 'name': 'b', 'unitPricePkr': 100, 'quantity': 1}]})
ck('two invoices are created with distinct numbers', i1.get('number') != i2.get('number'),
   '%s vs %s' % (i1.get('number'), i2.get('number')))
# Punch a hole by deleting the first directly (no delete route by design).
psql("DELETE FROM \"InvoiceLineItem\" WHERE \"invoiceId\" = '%s';" % i1['id'])
psql("DELETE FROM \"Invoice\" WHERE id = '%s';" % i1['id'])
s, i3 = api('POST', '/invoices', tok, {'patientId': q, 'items': [{'code': 'C', 'name': 'c', 'unitPricePkr': 100, 'quantity': 1}]})
ck('a third invoice after the deletion is NOT a 5xx', s in (200, 201), 'HTTP %s' % s)
ck('and its number collides with nothing', i3.get('number') not in (None, i2.get('number')), i3.get('number'))


print('\n===== %d/%d passed =====' % (sum(res), len(res)))
if not res:
    print('  NO CHECKS RAN - the suite asserted nothing')
    raise SystemExit(1)
_failed = len(res) - sum(res)
if _failed:
    print('  %d CHECK(S) FAILED' % _failed)
raise SystemExit(1 if _failed else 0)
