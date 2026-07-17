import json, urllib.request, urllib.error
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
    print(('  PASS  ' if cond else '  FAIL  ')+label+(('  -> '+str(detail)[:160]) if detail!='' else ''))

s,r = call('POST','/auth/login',{'email':'owner@glowderma.pk','password':'Password123!'})
tok=r['accessToken']; print('LOGIN', s)
# A FRESH patient, always.
#
# This used to grab patients?take=1 — a shared row that the safety suite burns.
# Since the phototherapy burn interlock is PATIENT-scoped, a burn recorded by an
# earlier suite correctly suppressed every dose here, and this suite's result
# depended on what had run before it. A suite whose outcome depends on execution
# order is not a check.
import time as _tt
s,_pp = call('POST','/patients',{'mrn':'DERMAFN-%d'%(int(_tt.time()*1000)%100000000),
    'name':'Derma Functional Probe','phone':'+92 300 8888888','dob':'1990-01-01'},tok)
if 'id' not in _pp:
    raise SystemExit('need a fresh patient: %s %s' % (s, _pp))
pid=_pp['id']

print('\n== 1. Pack activation (spec AC-1) ==')
s,_ = call('POST','/packs/dermatology/activate',{},tok)
ck('activate dermatology pack', s in (200,201), s)
s,cat = call('GET','/service-catalog',tok=tok)
items = cat if isinstance(cat,list) else (cat.get('items') or [])
derm = [c for c in items if str(c.get('code','')).startswith('dermatology:')]
ck('15 derma catalog items seeded', len(derm)>=15, len(derm))
s,ords = call('GET','/order-sets',tok=tok)
ol = ords if isinstance(ords,list) else (ords.get('items') or [])
keys = [o.get('key') for o in ol if str(o.get('key','')).startswith('dermatology:')]
ck('biopsy + isotretinoin + pre-phototherapy order sets', all(
    any(k.endswith(x) for k in keys) for x in ['biopsy-pathology','isotretinoin-workup','pre-phototherapy-panel']), keys)

print('\n== 2. GAGS acne grading (spec AC-2) ==')
# forehead 2x2=4, cheeks 2x3=6 each, nose 1x1=1, chin 1x2=2, chest/back 3x3=9  -> 28
s,g = call('POST','/dermatology/grades',{'patientId':pid,'instrument':'gags','answers':{
    'forehead':2,'cheek_r':3,'cheek_l':3,'nose':1,'chin':2,'chest_back':3}},tok)
ck('GAGS scored', s in (200,201), s if s>=400 else '')
ck('GAGS total = 28 (spec example)', g.get('score')==28, g.get('score'))
ck('GAGS band = moderate (19-30)', g.get('band')=='moderate', g.get('band'))
ck('per-region subscores returned', (g.get('subscores') or {}).get('chest_back')==9, g.get('subscores'))
s,bad = call('POST','/dermatology/grades',{'patientId':pid,'instrument':'gags','answers':{
    'forehead':9,'cheek_r':0,'cheek_l':0,'nose':0,'chin':0,'chest_back':0}},tok)
ck('out-of-range lesion grade rejected', s==400, (bad.get('message') or '')[:70])
s,part = call('POST','/dermatology/grades',{'patientId':pid,'instrument':'gags','answers':{'forehead':2}},tok)
ck('partial region entry rejected (no misleading total)', s==400, (part.get('message') or '')[:70])

print('\n== 3. GAGS trend over two visits (spec AC-3) ==')
s,g2 = call('POST','/dermatology/grades',{'patientId':pid,'instrument':'gags','answers':{
    'forehead':1,'cheek_r':1,'cheek_l':1,'nose':1,'chin':1,'chest_back':2}},tok)
ck('follow-up GAGS = 14 (improved)', g2.get('score')==14, g2.get('score'))
ck('follow-up band = mild', g2.get('band')=='mild', g2.get('band'))
s,tr = call('GET','/patients/%s/trends/gags_score'%pid,tok=tok)
ck('GAGS auto-trends on shared Observation substrate', len(tr.get('series') or [])>=2, '%d points, direction=%s'%(len(tr.get('series') or []), tr.get('direction')))

print('\n== 4. PASI (spec AC-4) ==')
# head: (2+1+2)=5 x area3 x 0.1 = 1.5 ; upper: (3+2+2)=7 x 4 x 0.2 = 5.6
# trunk: (2+2+1)=5 x 2 x 0.3 = 3.0 ; lower: (3+3+2)=8 x 5 x 0.4 = 16.0  -> 26.1
s,p = call('POST','/dermatology/grades',{'patientId':pid,'instrument':'pasi','answers':{
    'head':{'area':3,'erythema':2,'induration':1,'desquamation':2},
    'upper_limbs':{'area':4,'erythema':3,'induration':2,'desquamation':2},
    'trunk':{'area':2,'erythema':2,'induration':2,'desquamation':1},
    'lower_limbs':{'area':5,'erythema':3,'induration':3,'desquamation':2}}},tok)
ck('PASI scored', s in (200,201), s if s>=400 else '')
ck('PASI = 26.1 (area x signs x region weight)', p.get('score')==26.1, p.get('score'))
ck('PASI band = severe (>10)', p.get('band')=='severe', p.get('band'))
ck('lower limb weight 0.4 dominates subscore', (p.get('subscores') or {}).get('lower_limbs')==16.0, p.get('subscores'))

print('\n== 5. EASI adult vs child weighting ==')
easi_answers = {r:{'area':3,'erythema':2,'induration':2,'excoriation':1,'lichenification':1}
                for r in ['head','upper_limbs','trunk','lower_limbs']}
s,ea = call('POST','/dermatology/grades',{'patientId':pid,'instrument':'easi','answers':easi_answers},tok)
s,ec = call('POST','/dermatology/grades',{'patientId':pid,'instrument':'easi','answers':easi_answers},tok)
ck('EASI adult scored', s in (200,201), ea.get('score'))
ck('EASI adult = 18.0 (6x3x1.0)', ea.get('score')==18.0, ea.get('score'))
# The client's `child` flag is deliberately IGNORED — weights come from the
# patient's DOB (see derma_safety_demo.py D9). Same patient => same weights,
# whatever the client claims.
# Weights come from the patient's DOB; the client cannot ask for a weighting.
ck('same patient always gets the same DOB-derived weights',
   (ec.get('subscores') or {}).get('head')==(ea.get('subscores') or {}).get('head'),
   'head=%s'%((ea.get('subscores') or {}).get('head'),))
s,e4 = call('POST','/dermatology/grades',{'patientId':pid,'instrument':'easi','answers':{
    **easi_answers,'head':{'area':3,'erythema':4,'induration':2,'excoriation':1,'lichenification':1}}},tok)
ck('EASI sign >3 rejected (EASI is 0-3, unlike PASI)', s==400, (e4.get('message') or '')[:60])

print('\n== 6. SCORAD composite A/5 + 7B/2 + C ==')
# A=45 -> 9 ; B=(2+2+1+1+2+2)=10 -> 35 ; C=7+4=11  => 55.0
s,sc = call('POST','/dermatology/grades',{'patientId':pid,'instrument':'scorad','answers':{
    'extentPct':45,'signs':{'erythema':2,'oedema_papulation':2,'oozing_crust':1,
    'excoriation':1,'lichenification':2,'dryness':2},'pruritusVas':7,'sleeplessVas':4}},tok)
ck('SCORAD = 55.0', sc.get('score')==55.0, sc.get('score'))
ck('SCORAD band = severe (>50)', sc.get('band')=='severe', sc.get('band'))
ck('SCORAD A/B/C components exposed', (sc.get('subscores') or {}).get('B_intensity')==35.0, sc.get('subscores'))

print('\n== 7. MASI / VASI have no invented bands ==')
s,ma = call('POST','/dermatology/grades',{'patientId':pid,'instrument':'masi','answers':{
    'forehead':{'area':3,'darkness':2,'homogeneity':2},'malar_r':{'area':4,'darkness':3,'homogeneity':2},
    'malar_l':{'area':4,'darkness':3,'homogeneity':2},'chin':{'area':1,'darkness':1,'homogeneity':1}}},tok)
ck('MASI scored', s in (200,201), ma.get('score'))
ck('MASI band is null (no validated cut-offs)', ma.get('band') is None, ma.get('band'))
s,va = call('POST','/dermatology/grades',{'patientId':pid,'instrument':'vasi','answers':{
    'head_neck':{'handUnits':2,'depigmentationPct':50},'upper_limbs':{'handUnits':6,'depigmentationPct':75}}},tok)
ck('T-VASI = 5.5 (2x0.5 + 6x0.75)', va.get('score')==5.5, va.get('score'))
s,vb = call('POST','/dermatology/grades',{'patientId':pid,'instrument':'vasi','answers':{
    'head_neck':{'handUnits':2,'depigmentationPct':37}}},tok)
ck('VASI off-scale depigmentation rejected', s==400, (vb.get('message') or '')[:70])

print('\n== 8. Phototherapy course start (spec AC-4: type IV -> 500) ==')
s,bad = call('POST','/dermatology/phototherapy/courses',{'patientId':pid,'fitzpatrickType':9,
    'indication':'psoriasis'},tok)
ck('unknown/invalid skin type blocks course', s==400, s)
s,course = call('POST','/dermatology/phototherapy/courses',{'patientId':pid,'fitzpatrickType':4,
    'indication':'psoriasis'},tok)
ck('course created', s in (200,201), s if s>=400 else '')
ck('skin type IV start dose = 500 mJ/cm2', course.get('startDoseMj')==500, course.get('startDoseMj'))
ck('skin type IV ceiling = 3000', course.get('maxDoseMj')==3000, course.get('maxDoseMj'))
cid=course.get('id')

print('\n== 9. Ledger: escalation, hold, burn, gap, cap (spec AC-5, AC-6) ==')
s,d1 = call('GET','/dermatology/phototherapy/courses/%s/next-dose'%cid,tok=tok)
ck('session 1 suggests 500 (START)', d1.get('suggestedMj')==500 and d1.get('action')=='START', '%s %s'%(d1.get('suggestedMj'), d1.get('action')))
s,s1 = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid,{},tok)
ck('session 1 delivered at 500', (s1.get('session') or {}).get('doseMj')==500, (s1.get('session') or {}).get('doseMj'))
ck('cumulative = 500', s1.get('cumulativeMj')==500, s1.get('cumulativeMj'))

s,d2 = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=0'%cid,tok=tok)
ck('session 2 auto-suggests +15% = 575 (spec AC-5)', d2.get('suggestedMj')==575, '%s | %s'%(d2.get('suggestedMj'), d2.get('rationale')))
s,s2 = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid,{'lastErythemaGrade':0},tok)
ck('cumulative accrues to 1075', s2.get('cumulativeMj')==1075, s2.get('cumulativeMj'))

# grade 2 -> HOLD at previous dose (spec AC-5)
s,s3 = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid,{'lastErythemaGrade':2},tok)
dec3 = s3.get('decision') or {}
ck('erythema grade 2 HOLDS at 575 (no escalation)', dec3.get('action')=='HOLD' and dec3.get('suggestedMj')==575, '%s %s'%(dec3.get('action'), dec3.get('suggestedMj')))
ck('hold rationale is shown to the clinician', 'hold' in (dec3.get('rationale') or '').lower(), dec3.get('rationale'))

# grade 3 -> burn interlock (spec AC-6)
s,burn = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid,{'lastErythemaGrade':3},tok)
# A grade-3 is HELD, and the hold is recorded rather than thrown: a 400 would
# roll back the very row that records the burn, leaving no trace of it and
# making the next visit unable to tell a burn from a no-show.
ck('erythema grade 3 HOLDS the session (burn interlock)', s in (200,201) and burn.get('held') is True, 'HTTP %s held=%s'%(s, burn.get('held')))
ck('held session delivers no dose', (burn.get('session') or {}).get('doseMj')==0, (burn.get('session') or {}).get('doseMj'))
ck('burn rationale says notify prescriber', 'prescriber' in json.dumps(burn).lower(), ((burn.get('decision') or {}).get('rationale') or '')[:110])
s,bo = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid,{'lastErythemaGrade':3,'overrideBurnHold':True},tok)
ck('burn override without reason rejected', s==400, (bo.get('message') or '')[:70])
s,bo2 = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid,{'lastErythemaGrade':3,
    'overrideBurnHold':True,'overrideReason':'Grade 3 resolved fully at 72h; consultant cleared restart'},tok)
ck('burn override with reason recorded + halves dose', s in (200,201) and (bo2.get('decision') or {}).get('suggestedMj')==288,
   (bo2.get('decision') or {}).get('suggestedMj'))
ck('burnFlag persisted for audit', (bo2.get('session') or {}).get('burnFlag') is True, (bo2.get('session') or {}).get('burnFlag'))
dd = (bo2.get('session') or {}).get('doseDecision') or {}
ck('override reason persisted in doseDecision', bool(dd.get('overrideReason')), json.dumps(dd)[:120])

print('\n== 10. Dose override guards ==')
s,ov = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid,{'lastErythemaGrade':0,'overrideDoseMj':900},tok)
ck('manual dose override without reason rejected', s==400, (ov.get('message') or '')[:70])
s,ov2 = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid,{'lastErythemaGrade':0,
    'overrideDoseMj':9000,'overrideReason':'trying to exceed ceiling'},tok)
ck('ceiling CANNOT be overridden (3000 max)', s==400, (ov2.get('message') or '')[:90])

print('\n== 11. Skin-type ceiling clamp ==')
# MED 2900 on skin type I is 7x the 300 protocol start -> a unit slip, refused.
s,slip = call('POST','/dermatology/phototherapy/courses',{'patientId':pid,'fitzpatrickType':1,
    'indication':'vitiligo','medMj':2900},tok)
ck('implausible MED for skin type I is refused', s==400, (slip.get('message') or '')[:90])
s,c2 = call('POST','/dermatology/phototherapy/courses',{'patientId':pid,'fitzpatrickType':1,
    'indication':'vitiligo','medMj':400},tok)
cid2=c2.get('id')
ck('type I ceiling = 2000', c2.get('maxDoseMj')==2000, c2.get('maxDoseMj'))
ck('MED 400 -> start 280 (70%), row coherent (start <= max)',
   c2.get('startDoseMj')==280 and c2.get('startDoseMj')<=c2.get('maxDoseMj'),
   'start=%s max=%s'%(c2.get('startDoseMj'), c2.get('maxDoseMj')))
s,ds = call('GET','/dermatology/phototherapy/courses/%s/next-dose'%cid2,tok=tok)
ck('MED-derived start used and never above the ceiling', ds.get('suggestedMj')==280 and ds.get('suggestedMj')<=2000, '%s capped=%s'%(ds.get('suggestedMj'), ds.get('capped')))

print('\n== 12. Lesion + ABCDE (spec AC-7) ==')
s,les = call('POST','/dermatology/lesions',{'patientId':pid,'bodyRegion':'cheek','laterality':'RIGHT',
    'morphology':'macule','diagnosisCode':'D22.3','abcde':{'asymmetry':True,'border':'irregular',
    'color':'variegated','diameterMm':8,'evolving':True}},tok)
ck('lesion recorded with laterality (wrong-site guard)', s in (200,201) and les.get('laterality')=='RIGHT', les.get('laterality'))
s,badles = call('POST','/dermatology/lesions',{'patientId':pid,'bodyRegion':'cheek','morphology':'blob'},tok)
ck('invalid morphology rejected', s==400, (badles.get('message') or [''])[0] if isinstance(badles.get('message'),list) else badles.get('message'))

print('\n== 13. Course status guard ==')
s,_ = call('PATCH','/dermatology/phototherapy/courses/%s/status'%cid,{'status':'COMPLETED'},tok)
ck('course completed', s in (200,201), s if s>=400 else '')
s,after = call('POST','/dermatology/phototherapy/courses/%s/sessions'%cid,{'lastErythemaGrade':0},tok)
ck('cannot record a session on a COMPLETED course', s==400, (after.get('message') or '')[:70])


print('\n== 14. Missed-session gap rules (spec AC-6) ==')
import subprocess, time as _t
# A FRESH patient. Section 9 records a grade-3 burn, and the burn interlock is
# PATIENT-scoped (skin does not heal per course), so reusing that patient would
# correctly suppress every dose here — this section would be testing the burn
# hold rather than the gap rules.
s,_p = call('POST','/patients',{'mrn':'GAPDEMO-%d'%(int(_t.time()*1000)%100000000),
    'name':'Gap Demo','phone':'+92 300 9999999','dob':'1990-01-01'},tok)
if 'id' not in _p:
    raise SystemExit('gap section needs a fresh patient: %s %s' % (s, _p))
gap_pid = _p['id']
s,cg = call('POST','/dermatology/phototherapy/courses',{'patientId':gap_pid,'fitzpatrickType':4,
    'indication':'vitiligo'},tok)
gid=cg.get('id')
call('POST','/dermatology/phototherapy/courses/%s/sessions'%gid,{},tok)  # session 1 @ 500

def age_last_session(days):
    # Age the delivered session so the engine sees a real gap.
    sql = 'UPDATE "PhototherapySession" SET "deliveredAt" = now() - interval \'%d days\' WHERE "courseId"=\'%s\';' % (days, gid)
    subprocess.run(['docker','exec','-i','healthos-db','psql','-U','healthos','-d','healthos','-q','-c',sql],
                   capture_output=True)

for days, exp_action, exp_dose, why in [
    (3,  'ESCALATE', 575, 'on schedule -> +15%'),
    (10, 'HOLD',     500, '1-2wk -> hold'),
    (21, 'REDUCE',   375, '2-3wk -> -25%'),
    (26, 'REDUCE',   250, '3-4wk -> -50%'),
    # RESTART = the naive start dose. After >4 weeks off, tolerance IS naive,
    # so 500 is exactly what a brand-new type III patient safely receives.
    # Capping it at last*0.5 (an earlier attempt) made repeated lapses ratchet
    # the course to death: 500 -> 250 -> 125 -> 63.
    (40, 'RESTART',  500, '>4wk -> restart at the naive start dose'),
]:
    age_last_session(days)
    s,d = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=0'%gid,tok=tok)
    ck('gap %-2sd -> %-8s %s mJ (%s)'%(days, exp_action, exp_dose, why),
       d.get('action')==exp_action and d.get('suggestedMj')==exp_dose,
       '%s %s'%(d.get('action'), d.get('suggestedMj')))

# A burn outranks the gap rules: grade 3 must win even after a long gap.
age_last_session(21)
s,bg = call('GET','/dermatology/phototherapy/courses/%s/next-dose?lastErythemaGrade=3'%gid,tok=tok)
ck('burn interlock outranks gap rule', bg.get('action')=='SKIP_BURN', bg.get('action'))

# gapDays must be persisted on the ledger row (spec: ledger shows Gap days).
age_last_session(21)
s,gs = call('POST','/dermatology/phototherapy/courses/%s/sessions'%gid,{'lastErythemaGrade':0},tok)
ck('gapDays persisted on the ledger row', (gs.get('session') or {}).get('gapDays')==21, (gs.get('session') or {}).get('gapDays'))
print('\n===== %d/%d checks passed ====='%(sum(res), len(res)))
