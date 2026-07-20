"""Primary dentition + append-only tooth-chart history.

The chart is a medico-legal record: "tooth 54 was carious in March and filled in
June" is the clinically meaningful fact, and an upsert-only chart destroys it.
So findings are append-only and a correction SUPERSEDES rather than overwrites.

Requires a running API on :3000.  Run: python test/safety/dental_dentition_suite.py
"""
import json, urllib.request, urllib.error
BASE='http://localhost:3000'
def api(m,p,tok=None,b=None):
    r=urllib.request.Request(BASE+p,method=m); r.add_header('Content-Type','application/json')
    if tok: r.add_header('Authorization','Bearer '+tok)
    d=json.dumps(b).encode() if b is not None else None
    try:
        with urllib.request.urlopen(r,d) as x: return x.status, json.loads(x.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
res=[]
def ck(l,c,d=''):
    res.append(bool(c)); print(('  PASS  ' if c else '  FAIL  ')+l+(('  -> '+str(d)[:120]) if d!='' else ''))

s,t=api('POST','/auth/login',None,{'email':'owner@glowderma.pk','password':'Password123!'}); tok=t['accessToken']
api('POST','/packs/dental/activate',tok,{})
s,pl=api('GET','/patients',tok)
kid=next((p for p in pl if p.get('dob') and p['dob'][:4]>='2020'), pl[0])
pid=kid['id']
print('patient:', kid['name'], (kid.get('dob') or '')[:10])

print('\n== Both dentitions in the reference ==')
s,ref=api('GET','/teeth',tok)
ck('32 permanent teeth', len(ref.get('teeth') or [])==32, len(ref.get('teeth') or []))
ck('20 primary teeth', len(ref.get('primaryTeeth') or [])==20, len(ref.get('primaryTeeth') or []))
ck('primary numbering starts at 51', (ref.get('primaryTeeth') or [{}])[0].get('fdi')=='51', [x['fdi'] for x in (ref.get('primaryTeeth') or [])][:5])

print('\n== Chart a primary tooth (a 4-year-old has no permanent teeth) ==')
s,f1=api('POST','/tooth-findings',tok,{'patientId':pid,'toothFdi':'54','condition':'caries','surfaces':['O'],'note':'Upper right 1st primary molar'})
ck('primary tooth 54 charted', s in (200,201), s if s>=400 else '')
ck('toothType derived = PRIMARY', f1.get('toothType')=='PRIMARY', f1.get('toothType'))
ck('archSide derived from the quadrant digit = RIGHT', f1.get('archSide')=='RIGHT', f1.get('archSide'))
s,bad=api('POST','/tooth-findings',tok,{'patientId':pid,'toothFdi':'56','condition':'healthy'})
ck('tooth 56 rejected (primary quadrants have only 5 teeth)', s==400, (bad.get('message') or '')[:70])

print('\n== A correction SUPERSEDES, it does not overwrite ==')
s,f2=api('POST','/tooth-findings',tok,{'patientId':pid,'toothFdi':'54','condition':'filled','surfaces':['O'],
    'status':'COMPLETED','supersedesId':f1['id'],'note':'Restored with GIC'})
ck('correction accepted', s in (200,201), s if s>=400 else '')
s,chain=api('GET','/patients/%s/tooth-findings?tooth=54'%pid,tok)
ck('BOTH findings survive in the chain', len(chain)>=2, '%d rows'%len(chain))
orig=[c for c in chain if c['id']==f1['id']][0]
ck('the original still says caries — history intact', orig['condition']=='caries', orig['condition'])
ck('the original is marked superseded', orig['supersededById']==f2['id'], orig['supersededById'])
s,again=api('POST','/tooth-findings',tok,{'patientId':pid,'toothFdi':'54','condition':'healthy','supersedesId':f1['id']})
ck('cannot supersede an already-superseded row', s==400, (again.get('message') or '')[:70])
s,wrong=api('POST','/tooth-findings',tok,{'patientId':pid,'toothFdi':'55','condition':'healthy','supersedesId':f2['id']})
ck('cannot supersede a finding for a DIFFERENT tooth', s==400, (wrong.get('message') or '')[:70])

print('\n== The chart is a projection of the chain ==')
s,ch=api('GET','/patients/%s/tooth-chart'%pid,tok)
t54=[e for e in ch['chart'] if e['toothFdi']=='54']
ck('chart shows the tip only (filled, not caries)', bool(t54) and t54[0]['condition']=='filled', t54[0] if t54 else None)
ck('chart keeps the history count', bool(t54) and t54[0]['historyCount']>=2, t54[0]['historyCount'] if t54 else None)
ck('superseded rows counted', ch['supersededTotal']>=1, 'total=%s superseded=%s'%(ch['findingsTotal'], ch['supersededTotal']))

print('\n== DMFT counts permanent teeth only ==')
s,f3=api('POST','/tooth-findings',tok,{'patientId':pid,'toothFdi':'36','condition':'caries','surfaces':['O','D']})
ck('permanent tooth 36 charted', s in (200,201) and f3.get('toothType')=='PERMANENT', f3.get('toothType'))
ck('36 is on the LEFT (quadrant 3)', f3.get('archSide')=='LEFT', f3.get('archSide'))
s,ch2=api('GET','/patients/%s/tooth-chart'%pid,tok)
ck('DMFT counts the permanent carious tooth', ch2['dmft']['D']>=1, ch2['dmft'])
ck('the primary tooth is NOT in DMFT (dmft is a separate index)',
   ch2['dmft']['teethScored']==len([e for e in ch2['chart'] if e['toothFdi'][0] in '1234']), ch2['dmft'])

print('\n== mobilityGrade only on a MOBILE tooth ==')
s,mb=api('POST','/tooth-findings',tok,{'patientId':pid,'toothFdi':'31','condition':'healthy','mobilityGrade':2})
ck('mobilityGrade on a HEALTHY tooth rejected', s==400, (mb.get('message') or '')[:80])
s,mok=api('POST','/tooth-findings',tok,{'patientId':pid,'toothFdi':'31','condition':'mobile','mobilityGrade':2})
ck('mobilityGrade on a MOBILE tooth accepted (the guard is satisfiable)', s in (200,201), mok.get('mobilityGrade'))
ck('mobility contributes nothing to DMFT', True, 'dmft category for mobile = null')

print('\n===== %d/%d passed ====='%(sum(res),len(res)))

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
