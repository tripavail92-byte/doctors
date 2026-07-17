"""EPI cold chain + AEFI safety suite.

Vaccines are not ordinary stock: a heat-damaged vial looks identical to a good
one, and a dud dose produces a child who is immunised on paper and susceptible
in fact. Nobody finds out until an outbreak. So the checks that matter run at
ADMINISTRATION, not on a report someone reads later.

Run: python test/safety/epi_cold_chain_suite.py
"""
import json, time, urllib.request, urllib.error

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
    print(('  PASS  ' if c else '  FAIL  ') + l + (('  -> ' + str(d)[:130]) if d != '' else ''))


s, t = api('POST', '/auth/login', None, {'email': 'owner@glowderma.pk', 'password': 'Password123!'})
tok = t['accessToken']
U = int(time.time() * 1000) % 1000000

# Run-unique vaccine codes.
#
# Stock accumulates across runs, and pickBatch is deterministic (VVM stage, then
# expiry, then lot number as a tie-break). With a shared code like 'PENTA', a
# previous run's lot wins the tie and THIS run's vial never decrements — the
# suite then fails against correct code. Isolating the stock is the only way the
# assertions mean anything on the second run. Same lesson as the dermatology
# suites: a check whose result depends on what ran before it is not a check.
VAX = 'TVX%d' % U       # stands in for PENTA
VAX2 = 'TVY%d' % U      # stands in for PCV
VAX3 = 'TVZ%d' % U      # stands in for MR
VAX4 = 'TVW%d' % U      # stands in for BCG
s, p = api('POST', '/patients', tok, {'mrn': 'EPI-%d' % U, 'name': 'EPI Probe',
                                      'phone': '+92 300 7777777', 'dob': '2026-04-01'})
pid = p['id']

print('\n== Receiving stock ==')
s, b1 = api('POST', '/vaccine-batches', tok, {'vaccineCode': VAX, 'lotNumber': 'LOT-GOOD-%d' % U,
                                              'expiry': '2027-12-31', 'dosesReceived': 10,
                                              'storageLocation': 'Fridge A'})
ck('good lot received', s in (200, 201) and b1.get('dosesRemaining') == 10, b1.get('dosesRemaining'))
s, exp = api('POST', '/vaccine-batches', tok, {'vaccineCode': VAX, 'lotNumber': 'LOT-EXP-%d' % U,
                                               'expiry': '2020-01-01', 'dosesReceived': 10})
ck('an already-expired lot is refused at goods-in', s == 400, (exp.get('message') or '')[:80])

print('\n== A VVM cannot travel backwards ==')
s, b2 = api('POST', '/vaccine-batches', tok, {'vaccineCode': VAX2, 'lotNumber': 'LOT-VVM-%d' % U,
                                              'expiry': '2027-12-31', 'dosesReceived': 10,
                                              'vvmStage': 'STAGE_2'})
s, back = api('PATCH', '/vaccine-batches/%s/vvm' % b2['id'], tok, {'vvmStage': 'STAGE_1'})
ck('stage 2 -> stage 1 refused (the square darkens irreversibly)', s == 400, (back.get('message') or '')[:100])
s, fwd = api('PATCH', '/vaccine-batches/%s/vvm' % b2['id'], tok,
             {'vvmStage': 'STAGE_3', 'note': 'fridge failure overnight'})
ck('stage 2 -> stage 3 accepted', s in (200, 201), fwd.get('vvmStage'))
ck('a stage-3 vial is auto-discarded, not left in stock', fwd.get('discardedAt') is not None,
   fwd.get('discardReason'))

print('\n== A dose from a dead vial is REFUSED ==')
s, bad = api('POST', '/immunizations', tok, {'patientId': pid, 'vaccineCode': VAX2, 'dose': '1',
                                             'lotNumber': 'LOT-VVM-%d' % U})
ck('administering from the VVM-discarded lot is blocked', s == 400, (bad.get('message') or '')[:110])
s, ghost = api('POST', '/immunizations', tok, {'patientId': pid, 'vaccineCode': VAX, 'dose': '1',
                                               'lotNumber': 'NO-SUCH-LOT'})
ck('a lot that is not in stock is refused', s == 404, (ghost.get('message') or '')[:60])

print('\n== A good dose consumes a real vial ==')
s, ok = api('POST', '/immunizations', tok, {'patientId': pid, 'vaccineCode': VAX, 'dose': '1'})
ck('dose recorded', s in (200, 201), s if s >= 400 else '')
ck('it is tied to the physical vial (traceability)', ok.get('batchId') is not None, ok.get('lotNumber'))
s, batches = api('GET', '/vaccine-batches?vaccine=%s' % VAX, tok)
good = [b for b in batches if b['lotNumber'] == 'LOT-GOOD-%d' % U][0]
ck('the vial was decremented 10 -> 9', good['dosesRemaining'] == 9, good['dosesRemaining'])

print('\n== VVM stage 2 is used BEFORE stage 1, not plain FEFO ==')
api('POST', '/vaccine-batches', tok, {'vaccineCode': VAX3, 'lotNumber': 'MR-S1-EARLY-%d' % U,
                                      'expiry': '2027-01-01', 'dosesReceived': 5, 'vvmStage': 'STAGE_1'})
api('POST', '/vaccine-batches', tok, {'vaccineCode': VAX3, 'lotNumber': 'MR-S2-LATE-%d' % U,
                                      'expiry': '2027-12-31', 'dosesReceived': 5, 'vvmStage': 'STAGE_2'})
s, mr = api('POST', '/immunizations', tok, {'patientId': pid, 'vaccineCode': VAX3, 'dose': '1'})
ck('the stage-2 vial is chosen despite a LATER expiry', mr.get('lotNumber') == 'MR-S2-LATE-%d' % U,
   '%s (plain FEFO would take the stage-1 lot expiring sooner)' % mr.get('lotNumber'))

print('\n== AEFI: severity is a definition, not an opinion ==')
s, minor = api('POST', '/aefi', tok, {'patientId': pid, 'onsetAt': '2026-07-17T10:00:00Z',
                                      'symptoms': ['low_grade_fever', 'injection_site_soreness']})
cl = minor.get('classification') or {}
ck('expected reactions classify MINOR', cl.get('severity') == 'MINOR', (cl.get('reason') or '')[:58])
ck('and are not reportable', cl.get('reportable') is False)

# The clinician types MINOR but ticks hospitalisation. The criterion is objective.
s, ser = api('POST', '/aefi', tok, {'patientId': pid, 'onsetAt': '2026-07-17T10:00:00Z',
                                    'symptoms': ['seizure'], 'criteriaMet': ['hospitalisation'],
                                    'severity': 'MINOR'})
cl = ser.get('classification') or {}
ck('a stated MINOR cannot override a met serious criterion', cl.get('severity') == 'SERIOUS', cl.get('severity'))
ck('it is flagged reportable to the national centre', cl.get('reportable') is True, (cl.get('reason') or '')[:70])
ck('the STORED severity is the one the engine computed', (ser.get('aefi') or {}).get('severity') == 'SERIOUS',
   (ser.get('aefi') or {}).get('severity'))

s, died = api('POST', '/aefi', tok, {'patientId': pid, 'onsetAt': '2026-07-17T10:00:00Z',
                                     'symptoms': ['collapse'], 'outcome': 'DIED', 'severity': 'SEVERE'})
cl = died.get('classification') or {}
ck('outcome DIED forces SERIOUS even with no criterion ticked', cl.get('severity') == 'SERIOUS',
   cl.get('criteriaMet'))

print('\n== A bad lot is only visible as a cluster ==')
s, b3 = api('POST', '/vaccine-batches', tok, {'vaccineCode': VAX4, 'lotNumber': 'BCG-SUSPECT-%d' % U,
                                              'expiry': '2027-12-31', 'dosesReceived': 50})
for _ in range(3):
    api('POST', '/aefi', tok, {'patientId': pid, 'onsetAt': '2026-07-17T10:00:00Z', 'batchId': b3['id'],
                               'symptoms': ['abscess'], 'criteriaMet': ['hospitalisation']})
s, clusters = api('GET', '/aefi/by-batch', tok)
sus = [c for c in clusters if c['lotNumber'] == 'BCG-SUSPECT-%d' % U]
ck('AEFI group by lot, surfacing the cluster', bool(sus) and sus[0]['serious'] == 3, sus[0] if sus else None)
ck('and the worst lot sorts first', bool(clusters) and clusters[0]['serious'] >= 3,
   clusters[0]['lotNumber'] if clusters else None)

print('\n== Reporting is recorded, never inferred ==')
aid = (ser.get('aefi') or {}).get('id')
s, before = api('GET', '/aefi?patientId=%s' % pid, tok)
rec = [a for a in before if a['id'] == aid][0]
ck('a serious AEFI starts un-reported', rec.get('reportedToAuthorityAt') is None)
s, mark = api('PATCH', '/aefi/%s/reported' % aid, tok, {})
ck('and is marked only when someone actually reports it', mark.get('reportedToAuthorityAt') is not None,
   mark.get('reportedToAuthorityAt'))

print('\n===== %d/%d passed =====' % (sum(res), len(res)))
