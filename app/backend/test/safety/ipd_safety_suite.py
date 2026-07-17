"""IPD / bed-management safety suite.

A bed holds one patient, and a patient is in one bed. The dangerous failure is a
double-booking: two admissions racing onto the same bed, or one patient admitted
to two beds at once. The bed row-lock stops the first; a partial unique index
"one ADMITTED per patient" stops the second — a lockless read-check could not,
and a concurrent test proves it now holds.

Run-unique ward/bed codes so stock of beds never leaks between runs.

Run: python test/safety/ipd_safety_suite.py
"""
import json, time, urllib.request, urllib.error, threading

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


def patient(tag):
    s, p = api('POST', '/patients', tok, {'mrn': 'IPD-%s-%d' % (tag, U), 'name': 'IPD %s %d' % (tag, U),
                                          'phone': '+92 300 1111111'})
    return p['id']


s, ward = api('POST', '/ipd/wards', tok, {'name': 'Ward %d' % U,
                                          'bedCodes': ['B1-%d' % U, 'B2-%d' % U, 'B3-%d' % U]})
beds = [b['id'] for b in ward['beds']]
ck('a ward with 3 beds is created', len(beds) == 3, len(beds))

print('\n== One patient cannot be admitted to two beds at once (race) ==')
racer = patient('racer')
out = []
lk = threading.Lock()


def admit(bed):
    st, d = api('POST', '/ipd/admissions', tok, {'patientId': racer, 'bedId': bed})
    with lk:
        out.append(st)


ths = [threading.Thread(target=admit, args=(beds[0],)), threading.Thread(target=admit, args=(beds[1],))]
for x in ths:
    x.start()
for x in ths:
    x.join()
ok = len([c for c in out if c in (200, 201)])
ck('exactly one of two concurrent admits succeeds', ok == 1, 'codes=%s' % sorted(out))
s, adm = api('GET', '/ipd/admissions?status=ADMITTED', tok)
mine = [a for a in adm if a['patientId'] == racer]
ck('the patient has exactly one active admission', len(mine) == 1, len(mine))

print('\n== A bed holds one patient ==')
# Occupy bed 3, then a second patient cannot take the same bed.
pA = patient('A')
s, aA = api('POST', '/ipd/admissions', tok, {'patientId': pA, 'bedId': beds[2]})
ck('patient A admitted to bed 3', s in (200, 201), s if s >= 400 else '')
pB = patient('B')
s, aB = api('POST', '/ipd/admissions', tok, {'patientId': pB, 'bedId': beds[2]})
ck('patient B cannot take the occupied bed 3', s == 400, (aB.get('message') or '')[:60])

print('\n== Discharge frees the bed ==')
s, disc = api('PATCH', '/ipd/admissions/%s/discharge' % aA['id'], tok, {})
ck('patient A is discharged', disc.get('status') == 'DISCHARGED', disc.get('status'))
s, again = api('PATCH', '/ipd/admissions/%s/discharge' % aA['id'], tok, {})
ck('discharging twice is refused', s == 400, (again.get('message') or '')[:50])
# Bed 3 is free again — patient B can now take it.
s, aB2 = api('POST', '/ipd/admissions', tok, {'patientId': pB, 'bedId': beds[2]})
ck('the freed bed can be re-admitted', s in (200, 201), s if s >= 400 else '')

print('\n== A discharged patient can be re-admitted (the index only blocks ACTIVE) ==')
# racer was admitted above; discharge and re-admit to prove the partial index
# keys on ADMITTED, not on the patient forever.
s, adm = api('GET', '/ipd/admissions?status=ADMITTED', tok)
racer_adm = [a for a in adm if a['patientId'] == racer][0]
api('PATCH', '/ipd/admissions/%s/discharge' % racer_adm['id'], tok, {})
s, re = api('POST', '/ipd/admissions', tok, {'patientId': racer, 'bedId': beds[0]})
ck('a discharged patient can be admitted again', s in (200, 201), s if s >= 400 else '')

print('\n== Occupancy is counted, not guessed ==')
s, occ = api('GET', '/ipd/occupancy', tok)
ck('occupancy exposes total/occupied/available', 'totalBeds' in occ and 'occupied' in occ, occ)
ck('the rate is a percentage 0-100', 0 <= occ.get('occupancyRatePct', -1) <= 100, occ.get('occupancyRatePct'))

print('\n===== %d/%d passed =====' % (sum(res), len(res)))
