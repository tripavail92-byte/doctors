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
    print(('  PASS  ' if cond else '  FAIL  ')+label+(('  -> '+str(detail)[:150]) if detail!='' else ''))

s,r = call('POST','/auth/login',{'email':'owner@glowderma.pk','password':'Password123!'})
tok = r['accessToken']; print('LOGIN', s)

print('\n== 1. Pack activation + config ==')
s,_ = call('POST','/packs/physiotherapy/activate',{},tok)
ck('activate physiotherapy pack', s in (200,201), s)
s,ver = call('GET','/packs/physiotherapy/versions/1.0.0',tok=tok)
man = ver.get('manifest') or ver
ck('manifest: 8 catalog items', len(man.get('serviceCatalog') or [])==8, len(man.get('serviceCatalog') or []))
ck('manifest: oswestry instrument wired', any(i.get('key')=='oswestry' for i in (man.get('instruments') or [])), man.get('instruments'))
s,cat = call('GET','/service-catalog',tok=tok)
items = cat if isinstance(cat,list) else (cat.get('items') or cat.get('data') or [])
phy = [c for c in items if str(c.get('code','')).startswith('physiotherapy:PHY-')]
ck('activation SEEDED 8 PHY- catalog rows (pack-namespaced)', len(phy)==8, len(phy))
osets = [c for c in items if False]
s,ords = call('GET','/order-sets',tok=tok)
ol = ords if isinstance(ords,list) else (ords.get('items') or [])
ck('activation seeded 2 physio order sets', len([o for o in ol if str(o.get('key','')).startswith('physiotherapy:') and 'protocol' in o.get('key','')])==2,
   [o.get('key') for o in ol if str(o.get('key','')).startswith('physiotherapy:')])

print('\n== 2. ROM reference library ==')
s,refs = call('GET','/rehab/rom-reference',tok=tok)
knee=[x for x in refs if x['joint']=='KNEE' and x['movement']=='FLEXION']
ck('rom-reference loaded', len(refs)>=25, len(refs))
ck('knee flexion normal=135 max=150', knee and knee[0]['normalDegrees']==135 and knee[0]['maxDegrees']==150, knee[:1])

print('\n== 3. Episode with pacemaker safety intake ==')
# A FRESH patient, not patients?take=1. Section 6 asserts a specific pain-trend
# shape (down, delta -1), which is only deterministic if this patient's nprs
# history contains only this run's sessions. Sharing a patient across runs
# couples the trend to whatever ran before — the exact contamination that makes
# a suite flaky in CI.
import time as _t
_u = int(_t.time()*1000) % 1000000
s,_pt = call('POST','/patients',{'mrn':'REHAB-%d'%_u,'name':'Rehab Probe %d'%_u,'phone':'+92 300 2222222'},tok)
pid = _pt['id']
s,ep = call('POST','/rehab/episodes',{'patientId':pid,'diagnosis':'Post-ACL reconstruction, right knee',
    'bodyRegion':'KNEE','sessionsPlanned':10,'goals':'Restore knee flexion to 130 deg',
    'safetyIntake':{'pacemaker':True,'malignancy':False}},tok)
ck('create episode', s in (200,201), s if s>=400 else '')
eid=ep.get('id')

print('\n== 4. Assessment + ROM deficit banding ==')
s,asm = call('POST','/rehab/episodes/%s/assessments'%eid,{'posture':'Antalgic stance','gait':'Reduced stance phase R'},tok)
ck('create MSK assessment', s in (200,201), s if s>=400 else '')
aid=asm.get('id')
s,rom = call('POST','/rehab/assessments/%s/rom'%aid,{'joint':'KNEE','side':'RIGHT','movement':'FLEXION','activeDegrees':90},tok)
ck('ROM knee flex 90 accepted', s in (200,201), s if s>=400 else '')
dfc = rom.get('deficit') or {}
ck('deficit = 33% (90 of 135)', dfc.get('deficitPct')==33, dfc.get('deficitPct'))
ck('band = red (>25%)', dfc.get('band')=='red', dfc.get('band'))
ck('normalDegrees snapshotted = 135', (rom.get('rom') or {}).get('normalDegrees')==135, (rom.get('rom') or {}).get('normalDegrees'))
s,bad = call('POST','/rehab/assessments/%s/rom'%aid,{'joint':'KNEE','side':'RIGHT','movement':'FLEXION','activeDegrees':160},tok)
ck('engine ceiling rejects 160 deg (max 150)', s==400, json.dumps(bad.get('message'))[:90])
s,g = call('POST','/rehab/assessments/%s/rom'%aid,{'joint':'KNEE','side':'LEFT','movement':'FLEXION','activeDegrees':130,'passiveDegrees':100},tok)
ck('active>passive flagged', s in (200,201) and 'warn' in json.dumps(g).lower(), json.dumps(g)[:110])

print('\n== 5. Modality safety gate (pacemaker + TENS) ==')
s,blk = call('POST','/rehab/episodes/%s/sessions'%eid,{'modalities':['TENS'],'painPre':7,'painPost':4},tok)
ck('TENS BLOCKED for pacemaker patient', s==400, s)
ck('block message names pacemaker', 'pacemaker' in json.dumps(blk).lower(), json.dumps(blk.get('message'))[:120])
s,ok = call('POST','/rehab/episodes/%s/sessions'%eid,{'modalities':['TENS'],'painPre':7,'painPost':4,
    'overrideBlock':True,'overrideReason':'Cardiology cleared: not pacing-dependent (Dr. Awais)'},tok)
ck('senior override accepted', s in (200,201), s if s>=400 else '')
sn = (ok.get('session') or {}).get('safetyNotes')
ck('override audit persisted in safetyNotes', bool(sn) and sn.get('override') is True and bool(sn.get('overrideReason')), json.dumps(sn)[:130])
ck('sessionNumber auto = 1', (ok.get('session') or {}).get('sessionNumber')==1, (ok.get('session') or {}).get('sessionNumber'))
s,ok2 = call('POST','/rehab/episodes/%s/sessions'%eid,{'modalities':['EXERCISE','MANUAL_THERAPY'],'painPre':6,'painPost':3},tok)
ck('safe modality needs no override', s in (200,201), s if s>=400 else '')
ck('sessionNumber increments = 2', (ok2.get('session') or {}).get('sessionNumber')==2, (ok2.get('session') or {}).get('sessionNumber'))

print('\n== 6. painPost mirrors into shared trends engine ==')
s,tr = call('GET','/patients/%s/trends/nprs'%pid,tok=tok)
pts = tr.get('series') or []
ck('nprs trend picked up session pain', len(pts)>=2, '%d points'%len(pts))
ck('trend direction computed = down (4 -> 3)', tr.get('direction')=='down' and tr.get('delta')==-1, '%s delta=%s'%(tr.get('direction'), tr.get('delta')))
ck('reference range applied (0-3, higherIsWorse)', tr.get('refHigh')==3 and tr.get('latestFlag')=='normal', 'refHigh=%s flag=%s'%(tr.get('refHigh'), tr.get('latestFlag')))

print('\n== 7. Exercise Rx + discharge guard ==')
s,ex = call('POST','/rehab/episodes/%s/exercises'%eid,{'exerciseCode':'QUAD-SET','name':'Quadriceps set',
    'sets':3,'reps':10,'holdSeconds':5,'frequencyPerWeek':14},tok)
ck('exercise prescribed', s in (200,201), s if s>=400 else '')
s,d = call('PATCH','/rehab/episodes/%s/discharge'%eid,{'status':'DISCHARGED','dischargeNote':'Goals met; flexion 125 deg'},tok)
ck('discharge episode', s in (200,201), s if s>=400 else '')
s,after = call('POST','/rehab/episodes/%s/sessions'%eid,{'modalities':['EXERCISE']},tok)
ck('add-session-after-discharge blocked', s==400, s)

print('\n== 8. Recording a session never silently fails under load ==')
# addSession reads the last session number then inserts, and writes a shared pain
# Observation. Fired concurrently on one episode (two physios, or a double-click),
# that used to succeed once and return opaque HTTP 500s for the rest — a session a
# clinician believed they recorded, gone. The episode row-lock serialises them.
import threading
s,epc = call('POST','/rehab/episodes',{'patientId':pid,'diagnosis':'Concurrency probe','bodyRegion':'ANKLE'},tok)
eidc = epc['id']
_out=[]; _lk=threading.Lock()
def _go():
    st,d = call('POST','/rehab/episodes/%s/sessions'%eidc,{'modalities':['US'],'painPre':4},tok)
    with _lk: _out.append((st,(d.get('session') or {}).get('sessionNumber')))
_ths=[threading.Thread(target=_go) for _ in range(6)]
for x in _ths: x.start()
for x in _ths: x.join()
_codes=[c for c,_ in _out]; _nums=sorted(n for _,n in _out if n is not None)
ck('all 6 concurrent sessions succeed (no opaque 500s)', _codes.count(201)==6, 'codes=%s'%sorted(_codes))
ck('numbers are 1..6, unique — none lost or duplicated', _nums==[1,2,3,4,5,6], _nums)
s,_full = call('GET','/rehab/episodes/%s'%eidc,tok=tok)
ck('and all 6 are on the episode', len(_full.get('sessions') or [])==6, len(_full.get('sessions') or []))

print('\n===== %d/%d checks passed ====='%(sum(res), len(res)))
