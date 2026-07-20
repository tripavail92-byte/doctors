"""Phototherapy dose engine — fifth adversarial pass regressions.

Two bugs that delivered a wrong mJ onto skin, found by the fifth adversarial
pass, each reproduced live before the fix and pinned here:

1. A blank/boolean erythema grade was coerced (by the global ValidationPipe's
   implicit conversion) into a fabricated 0/1 that sailed past the "grade
   required after a delivered session" guard — escalating onto blistered skin
   and never arming the burn interlock. A UI leaving the grade control blank
   emits exactly this.

2. The burn hold bound patient-wide but resolved patient-wide on ANY one course,
   while escalation anchored per-course. So a single tolerance delivery on the
   burnt course freed a SECOND, higher course to spring back to its stale
   pre-burn anchor and deliver ~3x the dose that blistered the patient.

Fresh patient per scenario (a burn hold is the patient's, and must not leak).

Run: python test/safety/derma_dose_fifth_pass_suite.py
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
U = int(time.time() * 1000) % 1000000
N = [0]


def patient(tag, fitz):
    N[0] += 1
    s, p = api('POST', '/patients', tok, {'mrn': 'PH5-%s-%d-%d' % (tag, U, N[0]), 'name': 'Photo5 %s %d' % (tag, U),
                                          'phone': '+92 300 6060606', 'dob': '1990-01-01'})
    s, c = api('POST', '/dermatology/phototherapy/courses', tok,
               {'patientId': p['id'], 'fitzpatrickType': fitz, 'indication': 'plaque psoriasis'})
    return p['id'], c['id']


def sessions(cid):
    s, c = api('GET', '/dermatology/phototherapy/courses/%s' % cid, tok)
    return c.get('sessions') or [], c.get('burnHoldDoseMj')


print('\n== A blank / boolean grade cannot fabricate an escalation onto blistered skin ==')
pid, cid = patient('blank', 4)
s, s1 = api('POST', '/dermatology/phototherapy/courses/%s/sessions' % cid, tok, {})
start = (s1.get('session') or {}).get('doseMj')
ck('first session delivered a start dose', bool(start), start)
# A blistered patient whose grade field arrived blank. Each of these must be
# refused exactly like a missing grade — never coerced to 0 and escalated.
for bad in ['', ' ', True, False]:
    s, r = api('POST', '/dermatology/phototherapy/courses/%s/sessions' % cid, tok, {'lastErythemaGrade': bad})
    ck('grade=%r is refused (400), not coerced' % bad, s == 400, '%s %s' % (s, (r.get('message') or [''])[0] if isinstance(r.get('message'), list) else (r.get('message') or '')[:40]))
# Nothing above should have delivered a second (escalated) session.
sess, hold = sessions(cid)
delivered = [x for x in sess if not x['skipped'] and x.get('deliveredAt')]
ck('no escalated session was created by the blank grades', len(delivered) == 1, len(delivered))
# Preview refuses a blank grade too (parity with record).
s, prev = api('GET', '/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=' % cid, tok)
ck('preview also refuses a blank grade (gradeRequired)', prev.get('gradeRequired') is True, prev.get('gradeRequired'))
# Positive control: an HONEST grade-3 still arms the interlock.
s, burn = api('POST', '/dermatology/phototherapy/courses/%s/sessions' % cid, tok, {'lastErythemaGrade': 3})
ck('an honest grade-3 skips and arms the hold at the burning dose',
   burn.get('held') is True and (burn.get('session') or {}).get('skipped') is True, burn.get('held'))
sess, hold = sessions(cid)
ck('the hold is armed at the dose that burned', hold == start, 'hold=%s start=%s' % (hold, start))


print('\n== A second course cannot spring back above a dose that blistered the patient ==')
# Course HIGH walks up (no burn) to a last-delivered dose distinctly ABOVE the
# burn dose, so a per-course vs patient-wide anchor cannot tie.
pidH, hi = patient('high', 3)
api('POST', '/dermatology/phototherapy/courses/%s/sessions' % hi, tok, {})            # 500
api('POST', '/dermatology/phototherapy/courses/%s/sessions' % hi, tok, {'lastErythemaGrade': 0})  # 575
api('POST', '/dermatology/phototherapy/courses/%s/sessions' % hi, tok, {'lastErythemaGrade': 0})  # 661
sessH, _ = sessions(hi)
hiLast = [x for x in sessH if not x['skipped'] and x.get('deliveredAt')][0]['doseMj']
ck('course HIGH is walked up, never burned', hiLast >= 660, hiLast)

# A SECOND course for the SAME patient burns at a lower dose.
s, lo = api('POST', '/dermatology/phototherapy/courses', tok,
            {'patientId': pidH, 'fitzpatrickType': 3, 'indication': 'plaque psoriasis'})
lo = lo['id']
api('POST', '/dermatology/phototherapy/courses/%s/sessions' % lo, tok, {})            # 500
api('POST', '/dermatology/phototherapy/courses/%s/sessions' % lo, tok, {'lastErythemaGrade': 0})  # 575
s, b = api('POST', '/dermatology/phototherapy/courses/%s/sessions' % lo, tok, {'lastErythemaGrade': 3})  # burn @575
_, loHold = sessions(lo)
ck('course LOW burns and arms a hold', loHold == 575, loHold)

# While armed, HIGH is correctly bound DOWN to half the anchor (positive control).
s, pv = api('GET', '/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=0' % hi, tok)
ck('HIGH is bound to half the burn anchor while armed (288, POST_BURN_REDUCE)',
   pv.get('suggestedMj') == 288 and pv.get('action') == 'POST_BURN_REDUCE',
   'mj=%s action=%s' % (pv.get('suggestedMj'), pv.get('action')))

# Resolve the hold by delivering half-anchor on LOW only.
api('POST', '/dermatology/phototherapy/courses/%s/sessions' % lo, tok, {'lastErythemaGrade': 0})  # delivers 288, clears LOW
_, loHold2 = sessions(lo)
ck("LOW clears its OWN hold after delivering half-anchor", loHold2 is None, loHold2)

# THE NEGATIVE: HIGH must NOT have sprung back to its stale ~661 anchor.
s, pv2 = api('GET', '/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=0' % hi, tok)
ck('HIGH is STILL bound (did not spring back to ~760 ESCALATE)',
   pv2.get('action') == 'POST_BURN_REDUCE' and pv2.get('suggestedMj') <= 288,
   'mj=%s action=%s' % (pv2.get('suggestedMj'), pv2.get('action')))
_, hiHold = sessions(hi)
ck('HIGH still physically carries the burn anchor', hiHold == 575, hiHold)
# And a real delivery on HIGH is bounded, not the stale escalation.
s, hd = api('POST', '/dermatology/phototherapy/courses/%s/sessions' % hi, tok, {'lastErythemaGrade': 0})
ck('a delivered HIGH session is <= 288, never ~760', (hd.get('session') or {}).get('doseMj') <= 288,
   (hd.get('session') or {}).get('doseMj'))
# Now HIGH has itself delivered half-anchor -> it clears -> may resume from there.
_, hiHold2 = sessions(hi)
ck('HIGH clears only after IT re-establishes tolerance', hiHold2 is None, hiHold2)

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
