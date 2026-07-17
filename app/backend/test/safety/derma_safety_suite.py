"""Dermatology phototherapy SAFETY regression suite.

Every case here maps to a defect CONFIRMED by adversarial review of this engine
(three rounds: 14, then 15, then 15 defects). It lives in the repo, next to the
code it guards — an earlier version of this suite sat in a scratch directory,
which meant the engine's own header cited a regression suite that did not exist
in the tree.

WHAT THIS SUITE IS FOR, AND WHY IT LOOKS LIKE THIS:

The functional suite passed 60/60 while the engine would escalate UV onto a
patient it had just blistered. It tested every rule in ISOLATION. Every real
defect lived at an INTERSECTION — burn x next-visit, erythema x missed-session,
override x unresolved-burn, floor x burn-hold. So this suite sweeps grids, not
points, and asserts invariants rather than values:

  1. dose is non-increasing as erythema grade rises, AT EVERY GAP
  2. dose is non-increasing as the gap grows, AT EVERY GRADE
  3. no path exceeds the ceiling
  4. no path exceeds an unresolved burn anchor

A test whose setup makes two branches tie cannot fail. An earlier version of D3
passed against the broken engine for exactly that reason (a one-session course
ties HOLD and RESTART at 500). Escalate the state until the branches diverge.

Requires: a running API on :3000 and the healthos-db container.
Run:  python test/safety/derma_safety_suite.py
"""
import json, subprocess, urllib.request, urllib.error
BASE='http://localhost:3000'

def call(method, path, body=None, tok=None):
    req=urllib.request.Request(BASE+path, method=method)
    req.add_header('Content-Type','application/json')
    if tok: req.add_header('Authorization','Bearer '+tok)
    data=json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        raw=e.read()
        try: return e.code, json.loads(raw or b'{}')
        except: return e.code, {'raw': raw.decode()[:200]}

res=[]
def ck(label, cond, detail=''):
    res.append(bool(cond))
    print(('  PASS  ' if cond else '  FAIL  ')+label+(('  -> '+str(detail)[:150]) if detail!='' else ''))

def psql(sql):
    return subprocess.run(['docker','exec','-i','healthos-db','psql','-U','healthos','-d','healthos','-q','-t','-c',sql],
                          capture_output=True, text=True).stdout.strip()

s,r = call('POST','/auth/login',{'email':'owner@glowderma.pk','password':'Password123!'})
tok=r['accessToken']; print('LOGIN', s)
s,pl = call('GET','/patients?take=1',tok=tok); pid=pl[0]['id']

# A FRESH patient per scenario.
#
# Every scenario used to share one patient id. That made the suite blind to the
# whole class of cross-course/cross-patient contamination — the burn interlock
# was course-scoped and escapable by opening a second course, and a shared
# patient meant a hold armed in one scenario could silently satisfy or defeat
# another. A green suite that depends on scenario order proves nothing.
_seq = [0]
def fresh_patient(label='Probe'):
    _seq[0] += 1
    s, p = call('POST','/patients',{'mrn':'PROBE-%05d'%_seq[0], 'name':'%s %d'%(label,_seq[0]),
        'phone':'+92 300 %07d'%_seq[0], 'dob':'1990-01-01'}, tok)
    if s not in (200,201):
        raise SystemExit('could not create a probe patient: %s %s' % (s, p))
    return p['id']

def new_course(ftype=3, patient=None, **kw):
    body={'patientId': patient or fresh_patient(),'fitzpatrickType':ftype,'indication':'psoriasis'}
    body.update(kw)
    s,c = call('POST','/dermatology/phototherapy/courses',body,tok)
    return c.get('id'), c

def age_sessions(cid, days):
    psql("UPDATE \"PhototherapySession\" SET \"deliveredAt\" = now() - interval '%d days' WHERE \"courseId\"='%s' AND \"deliveredAt\" IS NOT NULL;" % (days, cid))

print('\n== D1. BURN AMNESIA: interlock must survive across visits ==')
# Type III: 500 -> 575 -> 661. Then grade 3 at 661. Next visit must NOT escalate.
cid,_ = new_course(3)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid,{},tok)                      # s1 @500
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid,{'lastErythemaGrade':0},tok) # s2 @575
s,burn = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid,{'lastErythemaGrade':3},tok)
ck('grade 3 is RECORDED as a held ledger row, not thrown away', s in (200,201) and burn.get('held') is True, 'HTTP %s held=%s'%(s, burn.get('held')))
ck('held row carries burnFlag for audit', (burn.get('session') or {}).get('burnFlag') is True, (burn.get('session') or {}).get('burnFlag'))
ck('held row delivers no dose', (burn.get('session') or {}).get('doseMj')==0, (burn.get('session') or {}).get('doseMj'))
hold = psql("SELECT \"burnHoldDoseMj\" FROM \"PhototherapyCourse\" WHERE id='%s';"%cid)
ck('burn dose 575 persisted on the course', hold=='575', hold)
# Next visit, the clinician omits the grade. The preview must REFUSE rather than
# default it to 0 — the stored sentinel for "not yet assessed" IS 0, so a
# defaulted preview cannot tell "no erythema" from "nobody looked", and it used
# to render the second as the first and pre-fill an escalation.
s,nxt = call('GET','/dermatology/phototherapy/courses/%s/next-dose'%cid,tok=tok)
ck('preview refuses to guess when the grade is omitted', nxt.get('gradeRequired') is True, 'gradeRequired=%s'%nxt.get('gradeRequired'))
ck('and suggests no dose at all', nxt.get('suggestedMj') is None, nxt.get('suggestedMj'))
# THE defect: with the grade supplied, it must not escalate past the burning dose.
s,nxt = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=3'%cid,tok=tok)
ck('next visit does NOT escalate above the burning dose', nxt.get('suggestedMj') <= 575, '%s mJ (%s)'%(nxt.get('suggestedMj'), nxt.get('action')))
ck('next visit applies the -50% post-burn restart (288)', nxt.get('suggestedMj')==288, '%s %s'%(nxt.get('action'), nxt.get('suggestedMj')))
_rat = (nxt.get('rationale') or '').lower()
ck('rationale names the burn', 'blistering' in _rat or 'burn' in _rat, (nxt.get('rationale') or '')[:110])

print('\n== D2. MONOTONICITY: dose must never increase with erythema grade ==')
# Same ledger state, vary only the grade. Non-increasing 0 -> 1 -> 2 -> 3.
cid2,_ = new_course(3)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid2,{},tok)  # s1 @500
doses=[]
for g in (0,1,2,3):
    s,d = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=%d'%(cid2,g),tok=tok)
    doses.append(d.get('suggestedMj'))
    print('      grade %d -> %-4s mJ  %s' % (g, d.get('suggestedMj'), d.get('action')))
ck('non-increasing across grades 0->3', all(doses[i] >= doses[i+1] for i in range(3)), doses)

print('\n== D3. GRADE-2 x GAP: the most conservative rule must win ==')
# Escalate a real ladder first: 500 -> 575 -> 661. Only then do HOLD (661) and
# RESTART (500) differ, making the inversion detectable. A one-session course
# ties both at 500 and hides the bug entirely — which is exactly how the
# original suite passed while this was broken.
cid3,_ = new_course(3)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid3,{},tok)                      # s1 @500
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid3,{'lastErythemaGrade':0},tok) # s2 @575
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid3,{'lastErythemaGrade':0},tok) # s3 @661
for gap, grade, why in [(42,2,'grade2 x 6wk gap'), (21,2,'grade2 x 3wk gap'), (42,0,'no erythema x 6wk gap'), (1,2,'grade2, on schedule')]:
    age_sessions(cid3, gap)
    s,d = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=%d'%(cid3,grade),tok=tok)
    print('      %-22s -> %-4s mJ  %s' % (why, d.get('suggestedMj'), d.get('action')))
    if grade==2 and gap==42:
        # RESTART = the naive start dose (500), which is what a brand-new type
        # III patient safely receives — after 6 weeks off, tolerance IS naive.
        # It must beat the grade-2 HOLD at 661.
        ck('grade2 + 6wk gap restarts at the naive 500, does NOT hold at 661', d.get('suggestedMj')==500, '%s %s'%(d.get('action'), d.get('suggestedMj')))
        ck('rationale names BOTH hazards', 'erythema' in (d.get('rationale') or '').lower() and 'days since' in (d.get('rationale') or '').lower(), (d.get('rationale') or '')[:150])
    if grade==2 and gap==21:
        ck('grade2 + 3wk gap takes -25% of 661 (496), not the hold (661)', d.get('suggestedMj')==496, '%s %s'%(d.get('action'), d.get('suggestedMj')))
    if grade==2 and gap==1:
        ck('grade2 alone still holds at 661 (no gap hazard in play)', d.get('suggestedMj')==661 and d.get('action')=='HOLD', '%s %s'%(d.get('action'), d.get('suggestedMj')))

# The inversion itself: burned must never be dosed higher than unburned.
age_sessions(cid3, 42)
s,burned = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=2'%cid3,tok=tok)
s,clean  = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=0'%cid3,tok=tok)
ck('a burned patient is never dosed above an unburned one', burned.get('suggestedMj') <= clean.get('suggestedMj'),
   'burned=%s unburned=%s'%(burned.get('suggestedMj'), clean.get('suggestedMj')))

print('\n== D4. MED slips rejected; no path exceeds the ceiling ==')
s,slip = call('POST','/dermatology/phototherapy/courses',{'patientId':pid,'fitzpatrickType':2,
    'indication':'psoriasis','medMj':10000},tok)
ck('gross MED unit slip (J vs mJ) rejected at the DTO bound', s==400, str(slip.get('message'))[:80])
s,slip2 = call('POST','/dermatology/phototherapy/courses',{'patientId':pid,'fitzpatrickType':2,
    'indication':'psoriasis','medMj':2900},tok)
ck('MED implausible for the skin type rejected (2900 vs a 300 protocol start)', s==400, (slip2.get('message') or '')[:100])
# A plausible MED is accepted and the row stays coherent.
cid4,c4 = new_course(2, medMj=500)
ck('plausible MED 500 -> start 350, start <= max', c4.get('startDoseMj')==350 and c4.get('startDoseMj')<=c4.get('maxDoseMj'),
   'start=%s max=%s'%(c4.get('startDoseMj'), c4.get('maxDoseMj')))
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid4,{},tok)
age_sessions(cid4, 40)
s,rs = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=0'%cid4,tok=tok)
ck('RESTART after >4wk never exceeds the type II ceiling (2000)', rs.get('suggestedMj') <= 2000,
   '%s %s capped=%s'%(rs.get('action'), rs.get('suggestedMj'), rs.get('capped')))

print('\n== D5. erythemaGrade lands on the row it describes (off-by-one) ==')
cid5,_ = new_course(3)
s,s1 = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid5,{},tok)
s1id = (s1.get('session') or {}).get('id')
ck('a new row records grade 0 = "not yet assessed"', (s1.get('session') or {}).get('erythemaGrade')==0, (s1.get('session') or {}).get('erythemaGrade'))
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid5,{'lastErythemaGrade':2},tok)
g1 = psql("SELECT \"erythemaGrade\" FROM \"PhototherapySession\" WHERE id='%s';"%s1id)
ck('grade 2 back-written onto session 1, the session it describes', g1=='2', 'session1.erythemaGrade=%s'%g1)

print('\n== D6. erythemaGrade may not silently default once UV was delivered ==')
cid6,_ = new_course(3)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid6,{},tok)  # s1 delivered
s,omit = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid6,{},tok)
ck('omitting the grade after a delivered session is rejected', s==400, (omit.get('message') or '')[:100])
s,ok = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid6,{'lastErythemaGrade':0},tok)
ck('explicit 0 is accepted', s in (200,201), s if s>=400 else '')

print('\n== D7. VASI regions partition the body (was 107 vs declared 100) ==')
s,cat = call('GET','/dermatology/instruments',tok=tok)
vasi = cat.get('vasi') or {}
total = sum(r['maxHandUnits'] for r in vasi.get('regions', []))
ck('region hand-units sum to exactly 100', total==100, total)
ck('declared max matches the region sum', vasi.get('max')==total, '%s vs %s'%(vasi.get('max'), total))
ck('hands and feet scored separately from limbs', any(r['key']=='hands' for r in vasi.get('regions',[])) and any(r['key']=='feet' for r in vasi.get('regions',[])), [r['key'] for r in vasi.get('regions',[])])
# Whole body, fully depigmented -> exactly 100, not 107.
full = {r['key']: {'handUnits': r['maxHandUnits'], 'depigmentationPct': 100} for r in vasi.get('regions',[])}
s,v = call('POST','/dermatology/grades',{'patientId':pid,'instrument':'vasi','answers':full},tok)
ck('whole-body T-VASI = 100, never above its own max', v.get('score')==100, v.get('score'))

print('\n== D8. MASI and mMASI do not share a trend series ==')
s,m1 = call('POST','/dermatology/grades',{'patientId':pid,'instrument':'masi','answers':{
    'forehead':{'area':3,'darkness':2,'homogeneity':2},'malar_r':{'area':4,'darkness':3,'homogeneity':2},
    'malar_l':{'area':4,'darkness':3,'homogeneity':2},'chin':{'area':1,'darkness':1,'homogeneity':1}}},tok)
s,m2 = call('POST','/dermatology/grades',{'patientId':pid,'instrument':'mmasi','answers':{
    'forehead':{'area':3,'darkness':2},'malar_r':{'area':4,'darkness':3},
    'malar_l':{'area':4,'darkness':3},'chin':{'area':1,'darkness':1}}},tok)
s,tm = call('GET','/patients/%s/trends/masi_score'%pid,tok=tok)
s,tmm = call('GET','/patients/%s/trends/mmasi_score'%pid,tok=tok)
ck('mMASI has its own metric series', len(tmm.get('series') or [])>=1, '%d mmasi points'%len(tmm.get('series') or []))
ck('MASI series is not contaminated by mMASI values',
   all(p['value']!=m2.get('score') for p in (tm.get('series') or [])) or m1.get('score')==m2.get('score'),
   'masi=%s mmasi=%s'%(m1.get('score'), m2.get('score')))

print('\n== D9. EASI child weights come from DOB, not from the client ==')
s,pl2 = call('GET','/patients',tok=tok)
kid = next((p for p in pl2 if p.get('dob') and p['dob'][:4] >= '2020'), None)
adult = next((p for p in pl2 if p.get('dob') and p['dob'][:4] <= '2000'), None)
easi_ans = {r:{'area':3,'erythema':2,'induration':2,'excoriation':1,'lichenification':1}
            for r in ['head','upper_limbs','trunk','lower_limbs']}
if kid and adult:
    # The client cannot even ASK for a weighting: `child` is gone from the DTO,
    # so the global forbidNonWhitelisted pipe rejects it outright.
    s,spoof = call('POST','/dermatology/grades',{'patientId':adult['id'],'instrument':'easi','answers':easi_ans,'child':True},tok)
    ck('a client-supplied child flag is REJECTED, not merely ignored', s==400, str(spoof.get('message'))[:70])
    s,ke = call('POST','/dermatology/grades',{'patientId':kid['id'],'instrument':'easi','answers':easi_ans},tok)
    s,ae = call('POST','/dermatology/grades',{'patientId':adult['id'],'instrument':'easi','answers':easi_ans},tok)
    kh = (ke.get('subscores') or {}).get('head'); ah = (ae.get('subscores') or {}).get('head')
    ck('child gets child head weight, derived from DOB', kh==3.6, 'child head=%s (dob %s)'%(kh, kid['dob'][:10]))
    ck('adult gets adult head weight, derived from DOB', ah==1.8, 'adult head=%s (dob %s)'%(ah, adult['dob'][:10]))
else:
    ck('found a child and an adult patient to test EASI weighting', False, 'kid=%s adult=%s'%(bool(kid), bool(adult)))

print('\n== D10. RECEPTION cannot override the burn interlock ==')
recep = psql("SELECT count(*) FROM \"User\" WHERE role='RECEPTION';")
ck('recordSession is prescriber-gated (RECEPTION excluded)',
   'PRESCRIBER_ROLES' in open('D:/asthetic2/app/backend/src/dermatology/dermatology.controller.ts',encoding='utf-8').read().split("sessions')")[1][:80],
   'route guarded by PRESCRIBER_ROLES')


print('\n== D11. Grade-3 must not outrank the gap rules (v2 regression) ==')
# v2 kept an early return for grade 3, so it skipped every other candidate:
#   {last:2000, gap:42} -> grade 0/1/2 = 500 RESTART, grade 3 = 1000 SKIP_BURN.
# The worst reaction bought TWICE the dose. Monotonicity must hold at every gap.
cid11,_ = new_course(3)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid11,{},tok)                       # 500
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid11,{'lastErythemaGrade':0},tok)  # 575
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid11,{'lastErythemaGrade':0},tok)  # 661
for gap in (0, 10, 21, 26, 42):
    age_sessions(cid11, gap)
    row=[]
    for g in (0,1,2,3):
        s,d = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=%d'%(cid11,g),tok=tok)
        row.append(d.get('suggestedMj'))
    print('      gap %-2sd  grades 0..3 -> %s' % (gap, row))
    ck('gap %-2sd: dose non-increasing as erythema worsens'%gap, all(row[i] >= row[i+1] for i in range(3)), row)

print('\n== D12. The gap must never buy a dose above the tolerance it implies ==')
# The invariant here is NOT plain monotonicity in gapDays — that framing cost two
# wrong fixes. v2 restarted at the naive start dose, which reads as an inversion
# (28d -> 175 but 29d -> 402). v3 "fixed" it by capping RESTART at last*0.5,
# which removed the inversion and introduced a RATCHET: repeated lapses walked
# 500 -> 250 -> 125 -> 63 and killed the course.
#
# The real safety property: the dose never exceeds what the gap implies the
# patient can tolerate — and after >4 weeks off, tolerance is NAIVE, i.e. exactly
# the dose a brand-new patient of this skin type receives. The 3-4 week rule
# being MORE conservative than the restart that follows it is the protocol's own
# shape, not a defect.
cid12,_ = new_course(3)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid12,{},tok)  # 500
psql("UPDATE \"PhototherapySession\" SET \"doseMj\"=350 WHERE \"courseId\"='%s';"%cid12)
NAIVE_START_T3 = 500
last = 350
tolerance = {1: last*1.15, 8: last, 16: last*0.75, 22: last*0.5, 28: last*0.5,
             29: NAIVE_START_T3, 45: NAIVE_START_T3}
series=[]
for gap in (1, 8, 16, 22, 28, 29, 45):
    age_sessions(cid12, gap)
    s,d = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=0'%cid12,tok=tok)
    series.append((gap, d.get('suggestedMj'), d.get('action')))
    print('      gap %-2sd -> %-4s mJ  %-9s (tolerance %s)' % (gap, d.get('suggestedMj'), d.get('action'), round(tolerance[gap])))
    ck('gap %-2sd: dose within the tolerance the gap implies'%gap, d.get('suggestedMj') <= tolerance[gap] + 1,
       '%s <= %s'%(d.get('suggestedMj'), round(tolerance[gap])))
# Monotonic WITHIN the factor band (<=28d), where all rules are factors of `last`.
band = [x[1] for x in series if x[0] <= 28]
ck('monotonic within the factor band (1-28d)', all(band[i] >= band[i+1] for i in range(len(band)-1)), band)
# And no ratchet: a >4wk lapse never drops below what a 3-4wk gap would give.
ck('a >4wk lapse does not ratchet below the 3-4wk reduction', series[5][1] >= series[4][1],
   '28d=%s 29d=%s (v3 ratcheted to 175 and kept halving)'%(series[4][1], series[5][1]))

print('\n== D13. Override cannot out-dose or erase an unresolved burn ==')
cid13,_ = new_course(3)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid13,{},tok)                       # 500
s,s2 = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid13,{'lastErythemaGrade':0},tok)  # 575
s2id = (s2.get('session') or {}).get('id')
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid13,{'lastErythemaGrade':3},tok)  # burn hold @575
s,up = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid13,{'lastErythemaGrade':0,
    'overrideDoseMj':1500,'overrideReason':'pt requests progress'},tok)
ck('override ABOVE the suggestion is refused while a burn is unresolved', s==400, (up.get('message') or '')[:110])
hold = psql("SELECT \"burnHoldDoseMj\" FROM \"PhototherapyCourse\" WHERE id='%s';"%cid13)
ck('burn hold survives the refused override', hold=='575', hold)
g2 = psql("SELECT \"erythemaGrade\" FROM \"PhototherapySession\" WHERE id='%s';"%s2id)
ck('a later grade 0 cannot erase the recorded grade 3', g2=='3', 'session2.erythemaGrade=%s'%g2)
# A downward override is still allowed.
s,dn = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid13,{'lastErythemaGrade':0,
    'overrideDoseMj':200,'overrideReason':'cautious resume after burn'},tok)
ck('downward override still permitted', s in (200,201), s if s>=400 else '')
hold2 = psql("SELECT COALESCE(\"burnHoldDoseMj\"::text,'cleared') FROM \"PhototherapyCourse\" WHERE id='%s';"%cid13)
ck('burn hold clears once a session is delivered at/below the reduced dose', hold2=='cleared', hold2)

print('\n== D14. MED unit-slip guard works for the DARKEST skin types too ==')
# v2 anchored the guard to the CEILING, so for type VI it needed medMj > 10714
# while the DTO capped at 10000 -> dead code, 5000 mJ delivered vs an 800 start.
s,t6 = call('POST','/dermatology/phototherapy/courses',{'patientId':pid,'fitzpatrickType':6,
    'indication':'psoriasis','medMj':3000},tok)
ck('type VI MED unit slip rejected (guard anchored to protocol start)', s==400, (t6.get('message') or '')[:110])
s,t3 = call('POST','/dermatology/phototherapy/courses',{'patientId':pid,'fitzpatrickType':3,
    'indication':'psoriasis','medMj':2000},tok)
ck('type III mid-range slip rejected too', s==400, (t3.get('message') or '')[:90])
s,ok = call('POST','/dermatology/phototherapy/courses',{'patientId':pid,'fitzpatrickType':3,
    'indication':'psoriasis','medMj':600},tok)
ck('a plausible MED (600 -> start 420) is accepted', s in (200,201) and ok.get('startDoseMj')==420, ok.get('startDoseMj'))

print('\n== D15. Unsupported modality refused rather than dosed off the wrong table ==')
s,bb = call('POST','/dermatology/phototherapy/courses',{'patientId':pid,'fitzpatrickType':3,
    'indication':'psoriasis','modality':'BB_UVB'},tok)
ck('BB_UVB refused (no protocol table; NB-UVB doses would be ~10x too high)', s==400, (bb.get('message') or '')[:100])

print('\n== D16. Preview rejects grades the record path rejects ==')
cid16,_ = new_course(3)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid16,{},tok)
for bad in ('2.5','-1','4','abc'):
    s,_r = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=%s'%(cid16,bad),tok=tok)
    ck('preview rejects lastErythemaGrade=%s'%bad, s==400, s)

print('\n== D17. Repeated gaps cannot collapse the dose to nonsense ==')
cid17,_ = new_course(3)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid17,{},tok)
psql("UPDATE \"PhototherapySession\" SET \"doseMj\"=20 WHERE \"courseId\"='%s';"%cid17)
age_sessions(cid17, 25)
s,col = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=0'%cid17,tok=tok)
# The dose is NOT raised to a floor — raising it is how an earlier version came
# to suggest the exact dose that had burned the patient. The collapse is FLAGGED
# and a prescriber restarts the course.
ck('a collapsed course is flagged as lapsed', col.get('lapsed') is True, 'lapsed=%s at %s mJ'%(col.get('lapsed'), col.get('suggestedMj')))
ck('the lapse is explained in the rationale', 'LAPSED' in (col.get('rationale') or ''), (col.get('rationale') or '')[-90:])
ck('and the dose is NOT silently raised', col.get('suggestedMj') <= 25, '%s mJ'%col.get('suggestedMj'))

print('\n== D18. Override guard must fire on the visit the burn is FIRST reported ==')
# ROUND-3 CRITICAL: the guard read course.burnHoldDoseMj, which is still null on
# the reporting visit -> {grade 3, overrideBurnHold, overrideDoseMj: 3000}
# delivered 4.5x the burning dose AND left the hold unarmed.
cid18,_ = new_course(3)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid18,{},tok)                      # 500
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid18,{'lastErythemaGrade':0},tok) # 575
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid18,{'lastErythemaGrade':0},tok) # 661
s,atk = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid18,{'lastErythemaGrade':3,
    'overrideBurnHold':True,'overrideReason':'pt travelling','overrideDoseMj':3000},tok)
ck('full-ceiling override REFUSED on the burn-reporting visit', s==400, (atk.get('message') or '')[:110])
# A REJECTION MUST NOT DESTROY THE BURN IT DETECTED.
# The earlier version of this check asserted hold=='NULL' under the label "hold
# still arms" — the label asserted the opposite of its own assertion, and it
# blessed a real defect: the 400 rolled back the transaction that was recording
# the grade-3, so the burn vanished and the next honest grade-0 visit escalated
# onto skin that had blistered.
grade3_on_s3 = psql("SELECT \"erythemaGrade\" FROM \"PhototherapySession\" WHERE \"courseId\"='%s' AND \"doseMj\"=661;"%cid18)
ck('the refused override did NOT discard the reported grade-3', grade3_on_s3=='3', 'session@661 grade=%s'%grade3_on_s3)
hold18 = psql("SELECT COALESCE(\"burnHoldDoseMj\"::text,'NULL') FROM \"PhototherapyCourse\" WHERE id='%s';"%cid18)
ck('the hold armed despite the refused override', hold18=='661', hold18)
s,nxt18 = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=0'%cid18,tok=tok)
ck('next visit does not escalate onto the burned skin (<= 661)', nxt18.get('suggestedMj') <= 661,
   '%s mJ (%s) — burn was at 661'%(nxt18.get('suggestedMj'), nxt18.get('action')))
# A downward override on the reporting visit is still allowed.
cid18b,_ = new_course(3)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid18b,{},tok)
s,dn18 = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid18b,{'lastErythemaGrade':3,
    'overrideBurnHold':True,'overrideReason':'consultant cleared a cautious dose','overrideDoseMj':100},tok)
ck('downward override on the burn-reporting visit still permitted', s in (200,201), s if s>=400 else '')

print('\n== D19. A 0 mJ row cannot resolve a burn ==')
# ROUND-3: overrideDoseMj was @Min(0); a lamp-fault row (0 mJ delivered) cleared
# the hold, re-arming the full-dose override on the next visit.
cid19,_ = new_course(3)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid19,{},tok)                      # 500
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid19,{'lastErythemaGrade':0},tok) # 575
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid19,{'lastErythemaGrade':3},tok) # hold @575
s,zero = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid19,{'lastErythemaGrade':0,
    'overrideDoseMj':0,'overrideReason':'lamp fault'},tok)
ck('a 0 mJ dose is rejected outright (not a deliverable dose)', s==400, str(zero.get('message'))[:70])
hold19 = psql("SELECT \"burnHoldDoseMj\" FROM \"PhototherapyCourse\" WHERE id='%s';"%cid19)
ck('the burn hold survives a rejected 0 mJ row', hold19=='575', hold19)

print('\n== D20. The floor must never out-dose a candidate, nor deadlock the hold ==')
# ROUND-3: with a hold at 50, candidates were ESCALATE 57 / POST_BURN 25, winner
# 25, and the floor lifted it to 50 -- the exact burning dose, above BOTH
# candidates -- while the rationale said "applied the most conservative". The
# hold could then never clear (needs <=25).
cid20,_ = new_course(3)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid20,{},tok)
psql("UPDATE \"PhototherapySession\" SET \"doseMj\"=50 WHERE \"courseId\"='%s';"%cid20)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid20,{'lastErythemaGrade':3},tok)  # hold @50
s,f20 = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=0'%cid20,tok=tok)
ck('post-burn dose is NOT lifted to the burning dose by the floor', f20.get('suggestedMj') <= 25,
   '%s mJ (%s) — burn was at 50'%(f20.get('suggestedMj'), f20.get('action')))
s,res20 = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid20,{'lastErythemaGrade':0},tok)
hold20 = psql("SELECT COALESCE(\"burnHoldDoseMj\"::text,'cleared') FROM \"PhototherapyCourse\" WHERE id='%s';"%cid20)
ck('the hold can actually clear at a low anchor (no deadlock)', hold20=='cleared', hold20)

print('\n== D21. A measured MED bounds the CEILING, not just the start ==')
# ROUND-3: MED 200 on type VI started at 140 but was ceilinged at the type-VI
# table value of 5000 -- 25x the patient's own measured erythema threshold.
s,med = call('POST','/dermatology/phototherapy/courses',{'patientId':pid,'fitzpatrickType':6,
    'indication':'psoriasis','medMj':200,'incrementPct':50},tok)
ck('MED-derived course created', s in (200,201), s if s>=400 else '')
ck('ceiling bounded by the MED (6 x 200 = 1200), not the type VI table (5000)',
   med.get('maxDoseMj')==1200, 'ceiling=%s start=%s'%(med.get('maxDoseMj'), med.get('startDoseMj')))
cidm=med.get('id')
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cidm,{},tok)
# Walk the ladder reporting grade 1 every visit; it must stall well under 5000.
last=None
for _ in range(12):
    s,r = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cidm,{'lastErythemaGrade':1},tok)
    if s>=400: break
    last=(r.get('session') or {}).get('doseMj')
ck('12 visits of grade-1 escalation cannot exceed the MED-derived ceiling', last is not None and last<=1200,
   'final dose=%s (MED 200, old behaviour reached 5000)'%last)

print('\n== D22. Grade 1 is a reaction, not a clean visit ==')
cid22,_ = new_course(3)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid22,{},tok)  # 500
s,g0 = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=0'%cid22,tok=tok)
s,g1 = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=1'%cid22,tok=tok)
ck('grade 1 escalates LESS than grade 0 (half step)', g1.get('suggestedMj') < g0.get('suggestedMj'),
   'grade0=%s grade1=%s'%(g0.get('suggestedMj'), g1.get('suggestedMj')))

print('\n== D23. protocolKey cannot name a protocol that does not exist ==')
s,pk = call('POST','/dermatology/phototherapy/courses',{'patientId':pid,'fitzpatrickType':3,
    'indication':'psoriasis','protocolKey':'NBUVB_AGGRESSIVE'},tok)
ck('unknown protocolKey rejected (was: stored and silently ignored)', s==400, str(pk.get('message'))[:70])

print('\n== D24. A burn cannot be escaped by opening a NEW course (round-4 critical) ==')
# The interlock was keyed on the COURSE. Skin belongs to the PATIENT: a patient
# who blistered at 575 on course A could have course B opened the same day and
# receive the naive 500 — or the full ceiling with an override, since the
# downward-only guard had no anchor to arm against. The old suite could not see
# this at all, because every scenario shared one patient.
p24 = fresh_patient('CrossCourse')
cidA,_ = new_course(3, patient=p24)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cidA,{},tok)                      # 500
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cidA,{'lastErythemaGrade':0},tok) # 575
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cidA,{'lastErythemaGrade':3},tok) # burn @575
holdA = psql("SELECT \"burnHoldDoseMj\" FROM \"PhototherapyCourse\" WHERE id='%s';"%cidA)
ck('course A holds at 575', holdA=='575', holdA)

# Same patient, brand-new course, same day.
cidB,cB = new_course(3, patient=p24)
ck('a second course can still be opened', bool(cidB), cidB)
s,dB = call('GET','/dermatology/phototherapy/courses/%s/next-dose'%cidB,tok=tok)
ck('the NEW course honours the burn (not the naive 500)', dB.get('suggestedMj') <= 288,
   '%s mJ (%s) — burn was at 575 on the other course'%(dB.get('suggestedMj'), dB.get('action')))
s,sB = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cidB,{},tok)
ck('first session of the new course delivers the reduced dose', (sB.get('session') or {}).get('doseMj') <= 288,
   (sB.get('session') or {}).get('doseMj'))

# And a full-ceiling override on the fresh course must still be refused.
cidC,_ = new_course(3, patient=fresh_patient('CrossCourse2'))
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cidC,{},tok)
call('POST','/dermatology/phototherapy/courses/%s/sessions'%cidC,{'lastErythemaGrade':3},tok)  # burn @500
p_c = psql("SELECT \"patientId\" FROM \"PhototherapyCourse\" WHERE id='%s';"%cidC)
s,cD = call('POST','/dermatology/phototherapy/courses',{'patientId':p_c,'fitzpatrickType':3,'indication':'vitiligo'},tok)
s,ovr = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cD['id'],{'overrideDoseMj':3000,'overrideReason':'new course, fresh start'},tok)
ck('full-ceiling override on a NEW course refused while the patient has a burn', s==400, (ovr.get('message') or '')[:100])
print('\n===== %d/%d safety checks passed ====='%(sum(res), len(res)))
