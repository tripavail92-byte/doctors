"""Ophthalmology safety suite.

An eye exam drives clinical decisions off two computed things: the IOP band
(glaucoma risk) and the VA logMAR (how well the eye sees). Both are clinical
constants — getting them wrong is a real error, not a matter of taste — so this
suite pins the conversions, proves an implausible pressure is refused cleanly
(not a 500), and proves a signed exam is immutable.

Fresh exam per scenario; VA/IOP are per-eye.

Run: python test/safety/ophthalmology_suite.py
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
    print(('  PASS  ' if c else '  FAIL  ') + l + (('  -> ' + str(d)[:120]) if d != '' else ''))


s, t = api('POST', '/auth/login', None, {'email': 'owner@glowderma.pk', 'password': 'Password123!'})
tok = t['accessToken']
s, ps = api('GET', '/patients', tok)
pid = ps[0]['id']


def new_exam():
    s, ex = api('POST', '/ophthalmology/exams', tok, {'patientId': pid, 'chiefComplaint': 'review'})
    return ex['id']


print('\n== Visual acuity converts to logMAR correctly ==')
eid = new_exam()
for dv, exp in [('6/6', 0.0), ('6/12', 0.3), ('6/60', 1.0), ('CF', 2.0)]:
    s, va = api('POST', '/ophthalmology/exams/%s/va' % eid, tok,
                {'eye': 'OD', 'condition': 'UNAIDED', 'notation': 'SNELLEN_6', 'displayValue': dv})
    ck('VA %s -> logMAR %s' % (dv, exp), va.get('logmar') == exp, va.get('logmar'))

print('\n== IOP is banded for glaucoma risk ==')
eid = new_exam()
for v, sev, blk in [(18, 'normal', False), (25, 'soft', False), (35, 'red', False), (45, 'urgent', True)]:
    s, iop = api('POST', '/ophthalmology/exams/%s/iop' % eid, tok, {'eye': 'OD', 'valueMmHg': v, 'method': 'GAT'})
    a = iop.get('alert') or {}
    ck('IOP %d -> %s (blocking=%s)' % (v, sev, blk), a.get('severity') == sev and a.get('blocking') == blk,
       '%s blk=%s' % (a.get('severity'), a.get('blocking')))
# The boundary: 21 is the top of normal, 22 is the first "soft".
s, i21 = api('POST', '/ophthalmology/exams/%s/iop' % eid, tok, {'eye': 'OS', 'valueMmHg': 21, 'method': 'GAT'})
ck('IOP 21 is the top of normal', (i21.get('alert') or {}).get('severity') == 'normal', (i21.get('alert') or {}).get('severity'))
s, i22 = api('POST', '/ophthalmology/exams/%s/iop' % eid, tok, {'eye': 'OS', 'valueMmHg': 22, 'method': 'GAT'})
ck('IOP 22 crosses into raised', (i22.get('alert') or {}).get('severity') == 'soft', (i22.get('alert') or {}).get('severity'))

print('\n== An implausible pressure is a clean 400, not a 500 ==')
# The DTO allows up to 90; the engine's plausible ceiling is 80. A value in that
# gap threw a raw error -> HTTP 500. Bad input is a 400.
eid = new_exam()
s, hi = api('POST', '/ophthalmology/exams/%s/iop' % eid, tok, {'eye': 'OD', 'valueMmHg': 85, 'method': 'GAT'})
ck('IOP 85 is refused with 400, not a 500', s == 400, '%s %s' % (s, (hi.get('message') or '')[:50]))
s, lo = api('POST', '/ophthalmology/exams/%s/iop' % eid, tok, {'eye': 'OD', 'valueMmHg': 0, 'method': 'GAT'})
ck('IOP 0 is refused with 400, not a 500', s == 400, '%s %s' % (s, (lo.get('message') or '')[:50]))

print('\n== A bad eye token is rejected ==')
eid = new_exam()
s, badeye = api('POST', '/ophthalmology/exams/%s/iop' % eid, tok, {'eye': 'XX', 'valueMmHg': 16, 'method': 'GAT'})
ck('an unrecognized eye token is refused', s == 400, s)

print('\n== A signed exam is immutable ==')
eid = new_exam()
api('POST', '/ophthalmology/exams/%s/iop' % eid, tok, {'eye': 'OD', 'valueMmHg': 16, 'method': 'GAT'})
s, sg = api('PATCH', '/ophthalmology/exams/%s/sign' % eid, tok, {})
ck('the exam signs', sg.get('status') == 'SIGNED', sg.get('status'))
s, add = api('POST', '/ophthalmology/exams/%s/iop' % eid, tok, {'eye': 'OS', 'valueMmHg': 15, 'method': 'GAT'})
ck('adding a finding to a signed exam is refused', s == 400, (add.get('message') or '')[:60])
s, va2 = api('POST', '/ophthalmology/exams/%s/va' % eid, tok,
             {'eye': 'OS', 'condition': 'UNAIDED', 'notation': 'SNELLEN_6', 'displayValue': '6/6'})
ck('adding VA to a signed exam is also refused', s == 400, (va2.get('message') or '')[:60])
s, resign = api('PATCH', '/ophthalmology/exams/%s/sign' % eid, tok, {})
ck('signing twice is refused', s == 400, (resign.get('message') or '')[:40])

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
