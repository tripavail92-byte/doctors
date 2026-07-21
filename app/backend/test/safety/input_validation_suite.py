"""Bad input reads as bad input, not as a server fault.

Four cases an adversarial review raised where a DTO-legal payload produced an
HTTP 500 or stranded a record. Three reproduced; the fourth did not, and is kept
here as a guard rather than deleted.

Why a 500 matters beyond tidiness: it tells the caller nothing actionable, it
reads to whoever is on support like a crash, and here two of them also DESTROYED
work — the ward creation rolled back entirely, and the imaging order stranded in
a state with no route out.

  D1  a repeated bed code in createWard collided with
      Bed @@unique([tenantId, wardId, code]); the uncaught P2002 rolled back the
      whole transaction, so the ward vanished too. Reproduced as a 500.
  D2  a repeated studyCode created two order items while reports are capped at
      one per study, so `reportCount >= items.length` was unsatisfiable and the
      order stayed ACQUIRED forever — unreportable and uncancellable. Reproduced.
  D3  `status as BedStatus` is a compile-time assertion with no runtime effect,
      so ?status=BOGUS reached Postgres as an invalid enum literal. Reproduced
      as a 500 on two routes.
  D5  quantity: true was claimed to coerce to 1 under the global pipe's
      enableImplicitConversion and dispense a real drug. It did NOT reproduce —
      @IsInt() rejects it. Kept as a regression guard because the coercion
      hazard is real elsewhere in this codebase (see the dermatology grade
      handling), so if this ever starts passing, something changed.

Run: python test/safety/input_validation_suite.py
"""
import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _ids import mrn, RUN  # noqa: E402

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
s, p = api('POST', '/patients', tok, {'mrn': mrn('IV'), 'name': 'Validation', 'phone': '+92 300 1414141'})
PID = p['id']


print('\n== A duplicate bed code is refused, and the ward is not destroyed ==')
WARD = 'Ward %s' % RUN
s, r = api('POST', '/ipd/wards', tok, {'name': WARD, 'floor': '3', 'bedCodes': ['B1', 'B1']})
ck('a repeated bed code is a clean 4xx, not a 500', 400 <= s < 500, 'HTTP %s' % s)
s, wards = api('GET', '/ipd/wards', tok)
ck('and no half-built ward was left behind',
   not any(w.get('name') == WARD for w in (wards or [])), WARD)

# The control: distinct codes must still work, or the fix has broken ward setup.
s, ok = api('POST', '/ipd/wards', tok, {'name': 'Ward OK %s' % RUN, 'floor': '3', 'bedCodes': ['B1', 'B2']})
ck('distinct bed codes still create a ward', s in (200, 201) and len(ok.get('beds') or []) == 2,
   'HTTP %s beds=%d' % (s, len(ok.get('beds') or [])))


print('\n== A duplicate study code is refused, not stranded ==')
s, r = api('POST', '/imaging/orders', tok, {'patientId': PID, 'studyCodes': ['CXR', 'CXR']})
ck('a repeated study code is refused', 400 <= s < 500, 'HTTP %s' % s)

# Control: the real multi-study flow must still reach REPORTED.
s, studies = api('GET', '/imaging/studies', tok)
codes = [x['code'] for x in studies[:2]] if isinstance(studies, list) and len(studies) > 1 else ['CXR']
s, o = api('POST', '/imaging/orders', tok, {'patientId': PID, 'studyCodes': codes})
ck('distinct study codes still create an order', s in (200, 201), 'HTTP %s' % s)
api('PATCH', '/imaging/orders/%s/acquire' % o['id'], tok, {})
for c in codes:
    api('POST', '/imaging/orders/%s/reports' % o['id'], tok, {'studyCode': c, 'findings': 'f', 'impression': 'i'})
s, fin = api('GET', '/imaging/orders/%s' % o['id'], tok)
ck('and it can still reach REPORTED (not stranded)', fin.get('status') == 'REPORTED', fin.get('status'))


print('\n== An unknown enum in a list filter is a 400, not a 500 ==')
for path, label in [('/ipd/beds?status=NOT_A_STATUS', 'bed status'),
                    ('/ipd/admissions?status=BOGUS', 'admission status')]:
    s, r = api('GET', path, tok)
    ck('%s -> clean 4xx' % path, 400 <= s < 500, 'HTTP %s %s' % (s, str(r.get('message'))[:60]))

# Control: valid values must still filter rather than 400.
s, beds = api('GET', '/ipd/beds?status=AVAILABLE', tok)
ck('a valid bed status still filters', s == 200, 'HTTP %s' % s)
s, adms = api('GET', '/ipd/admissions?status=ADMITTED', tok)
ck('a valid admission status still filters', s == 200, 'HTTP %s' % s)
s, allbeds = api('GET', '/ipd/beds', tok)
ck('and no filter still lists everything', s == 200, 'HTTP %s' % s)


print('\n== A boolean quantity does not become a dispense ==')
# GUARANTEE stock first. This check originally passed against the UNFIXED code
# because the 400 it saw was "insufficient in-date stock", not a validation
# refusal — the moment stock existed, `true` coerced to 1 and a real drug was
# dispensed. A check that passes for a reason unrelated to what it tests is the
# exact failure this suite exists to catch, so the precondition is now explicit.
api('POST', '/pharmacy/stock', tok,
    {'formularyCode': 'PARA500', 'batchNo': 'IV-%s' % RUN, 'quantity': 500,
     'expiry': '2029-01-01', 'unitCostPkr': 10})
s, ok = api('POST', '/pharmacy/dispense', tok,
            {'items': [{'code': 'PARA500', 'quantity': 1}], 'paymentMethod': 'CASH'})
ck('a normal 1-unit dispense succeeds (so stock is not the reason for any 400)',
   s in (200, 201), 'HTTP %s' % s)

s, r = api('POST', '/pharmacy/dispense', tok,
           {'items': [{'code': 'PARA500', 'quantity': True}], 'paymentMethod': 'CASH'})
ck('quantity: true is refused, not coerced to 1', 400 <= s < 500,
   'HTTP %s %s' % (s, str(r.get('message'))[:60]))
ck('and the refusal is about the quantity, not about stock',
   'quantity' in str(r.get('message', '')).lower(), str(r.get('message'))[:70])

s, r = api('POST', '/pharmacy/dispense', tok,
           {'items': [{'code': 'PARA500', 'quantity': ''}], 'paymentMethod': 'CASH'})
ck('a blank quantity is refused too', 400 <= s < 500, 'HTTP %s' % s)


print('\n== A bed can be taken out of service, and stays out ==')
# BedStatus.MAINTENANCE existed in the enum and was counted by the occupancy
# report, but NO route could set it: the only writers were admit (OCCUPIED) and
# discharge (AVAILABLE). A contaminated or broken bed could not be taken off the
# ward at all.
s, w = api('POST', '/ipd/wards', tok, {'name': 'Maint %s' % RUN, 'floor': '2', 'bedCodes': ['M1', 'M2']})
beds = w.get('beds') or []
ck('a ward with two beds is created', len(beds) == 2, len(beds))
b1, b2 = beds[0]['id'], beds[1]['id']

s, r = api('PATCH', '/ipd/beds/%s/status' % b1, tok, {'status': 'MAINTENANCE'})
ck('a bed can be taken out of service', s == 200 and r.get('status') == 'MAINTENANCE', 'HTTP %s' % s)

s, a = api('POST', '/ipd/admissions', tok, {'patientId': PID, 'bedId': b1})
ck('a bed out of service cannot be admitted to', 400 <= s < 500, 'HTTP %s %s' % (s, str(a.get('message'))[:50]))

# The intersection that matters: discharging the patient in the NEXT bed used to
# be irrelevant, but discharge set its bed AVAILABLE unconditionally — so if the
# maintenance bed were ever the discharged one, a contaminated bed silently
# returned to service. Assert the maintenance bed is untouched by other traffic.
s, adm = api('POST', '/ipd/admissions', tok, {'patientId': PID, 'bedId': b2})
if s in (200, 201):
    api('PATCH', '/ipd/admissions/%s/discharge' % adm['id'], tok, {})
s, blist = api('GET', '/ipd/beds', tok)
st = {x['id']: x['status'] for x in (blist or [])}
ck('the out-of-service bed is STILL out of service after a discharge nearby',
   st.get(b1) == 'MAINTENANCE', st.get(b1))
ck('and the discharged bed is free again', st.get(b2) == 'AVAILABLE', st.get(b2))

s, r = api('PATCH', '/ipd/beds/%s/status' % b1, tok, {'status': 'OCCUPIED'})
ck('OCCUPIED cannot be set directly (admission owns that)', 400 <= s < 500, 'HTTP %s' % s)
s, r = api('PATCH', '/ipd/beds/%s/status' % b1, tok, {'status': 'BROKEN'})
ck('an invalid bed status is refused', 400 <= s < 500, 'HTTP %s' % s)
s, r = api('PATCH', '/ipd/beds/%s/status' % b1, tok, {'status': 'AVAILABLE'})
ck('and it can be returned to service', s == 200 and r.get('status') == 'AVAILABLE', 'HTTP %s' % s)


print('\n===== %d/%d passed =====' % (sum(res), len(res)))
if not res:
    print('  NO CHECKS RAN - the suite asserted nothing')
    raise SystemExit(1)
_failed = len(res) - sum(res)
if _failed:
    print('  %d CHECK(S) FAILED' % _failed)
raise SystemExit(1 if _failed else 0)
