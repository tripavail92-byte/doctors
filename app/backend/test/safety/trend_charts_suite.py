"""Declarative trend-chart suite (TrendChartDefinition + TrendAnnotation).

A trend chart is data, not code: a pack ships a definition (which observations to
plot, the reference bands, a target, how to aggregate), it seeds per-tenant, and a
clinician pins annotations onto a patient's series. This proves the definition
seeds, the aggregation collapses the point stream correctly, the bands/targets
come back server-side, and annotations attach.

Run: python test/safety/trend_charts_suite.py
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
CHART = 'ophthalmology:iop_trend'

print('\n== A pack ships the chart definition; activation seeds it ==')
api('POST', '/packs/ophthalmology/activate', tok, {})
s, defs = api('GET', '/trends/definitions', tok)
iop = next((d for d in defs if d['key'] == CHART), None)
ck('the IOP trend definition is seeded for the tenant', iop is not None, [d['key'] for d in defs][:6])
ck('it carries the reference bands as data', iop and len(iop.get('referenceBands') or []) == 2, iop and iop.get('referenceBands'))
ck('and a target line and lastPerVisit aggregation', iop and iop.get('targetLines') and iop.get('aggregation') == 'LAST_PER_VISIT',
   iop and iop.get('aggregation'))
ck('and it splits by laterality (one line per eye)', iop and iop.get('splitByLaterality') is True, iop and iop.get('splitByLaterality'))
s, byPack = api('GET', '/trends/definitions?packKey=ophthalmology', tok)
ck('filtering by packKey returns it', any(d['key'] == CHART for d in byPack), len(byPack))

print('\n== The chart aggregates a patient series per eye, last-per-visit ==')
s, p = api('POST', '/patients', tok, {'mrn': 'TREND-%d' % U, 'name': 'Trend Probe %d' % U, 'phone': '+92 300 8888888'})
pid = p['id']
# OD: two readings on day 1 (last wins), one on day 2. OS: one each day.
obs = [
    ('OD', 24, '2026-06-01T09:00:00Z'),
    ('OD', 22, '2026-06-01T15:00:00Z'),   # later same day -> this is day 1's value
    ('OD', 18, '2026-06-08T10:00:00Z'),
    ('OS', 20, '2026-06-01T09:00:00Z'),
    ('OS', 16, '2026-06-08T10:00:00Z'),
]
for eye, v, at in obs:
    api('POST', '/observations', tok, {'patientId': pid, 'metric': 'iop_mmhg', 'value': v, 'unit': 'mmHg', 'side': eye, 'recordedAt': at})
s, chart = api('GET', '/trends/%s/patient/%s' % (CHART, pid), tok)
series = {ser['side']: ser['points'] for ser in chart.get('series') or []}
ck('there is one series per eye', set(series.keys()) == {'RIGHT', 'LEFT'}, list(series.keys()))
od = series.get('RIGHT') or []
ck('OD collapses the two day-1 readings to the LAST (22), then day-2 (18)',
   [pt['value'] for pt in od] == [22, 18], [pt['value'] for pt in od])
os_ = series.get('LEFT') or []
ck('OS has one point per day (20, 16)', [pt['value'] for pt in os_] == [20, 16], [pt['value'] for pt in os_])
ck('the chart returns the bands to draw (server-side, not client-derived)', len(chart.get('referenceBands') or []) == 2)
ck('and the target line', (chart.get('targetLines') or [{}])[0].get('value') == 18, chart.get('targetLines'))

print('\n== A single-eye filter narrows the chart ==')
s, odOnly = api('GET', '/trends/%s/patient/%s?laterality=OD' % (CHART, pid), tok)
sides = {ser['side'] for ser in odOnly.get('series') or []}
ck('filtering laterality=OD returns only the right eye', sides == {'RIGHT'}, sides)

print('\n== The chart summary is PER-SIDE, never pooled across eyes ==')
# summary returns an array: one per series. A forced side gives that one series.
s, summ = api('GET', '/trends/%s/patient/%s/summary?laterality=OD' % (CHART, pid), tok)
od_s = summ[0] if isinstance(summ, list) else summ
# Over the AGGREGATED series the chart plots (day1 last=22, day2=18) — the raw
# 24 was collapsed away by lastPerVisit, so max is 22, matching the chart.
ck('OD summary matches the plotted points (latest 18, min 18, max 22)',
   od_s.get('latest') == 18 and od_s.get('min') == 18 and od_s.get('max') == 22,
   'latest=%s min=%s max=%s' % (od_s.get('latest'), od_s.get('min'), od_s.get('max')))
ck('and a downward direction (22 -> 18)', od_s.get('direction') == 'down', od_s.get('direction'))
# The bug the adversarial review found: default (no side) must NOT pool both
# eyes into one cross-eye delta. It returns one summary per eye.
s, both = api('GET', '/trends/%s/patient/%s/summary' % (CHART, pid), tok)
sides = {x['side'] for x in both} if isinstance(both, list) else set()
ck('default summary on a per-eye chart returns ONE per eye (not pooled)', sides == {'RIGHT', 'LEFT'}, sides)
od = next((x for x in both if x['side'] == 'RIGHT'), {})
ck('each eye delta is within that eye (OD plotted 22 -> 18 = -4), not across eyes',
   od.get('delta') == -4 and od.get('previous') == 22, 'delta=%s previous=%s' % (od.get('delta'), od.get('previous')))
ck('and no summary reports side=null while mixing eyes', None not in sides, sides)

print('\n== The summary flags a latest reading against the chart bands ==')
fp = api('POST', '/patients', tok, {'mrn': 'FLAG-%d' % U, 'name': 'Flag %d' % U, 'phone': '+92 300 2020202'})[1]['id']
api('POST', '/observations', tok, {'patientId': fp, 'metric': 'iop_mmhg', 'value': 28, 'unit': 'mmHg', 'side': 'OD', 'recordedAt': '2026-06-01T10:00:00Z'})
s, fs = api('GET', '/trends/%s/patient/%s/summary?laterality=OD' % (CHART, fp), tok)
ck('IOP 28 (> 21 normal ceiling) flags HIGH, not "unknown"', (fs[0] if isinstance(fs, list) else fs).get('latestFlag') == 'high',
   (fs[0] if isinstance(fs, list) else fs).get('latestFlag'))

print('\n== The date range is day-aligned and validated ==')
rp = api('POST', '/patients', tok, {'mrn': 'RANGE-%d' % U, 'name': 'Range %d' % U, 'phone': '+92 300 3030303'})[1]['id']
api('POST', '/observations', tok, {'patientId': rp, 'metric': 'iop_mmhg', 'value': 15, 'unit': 'mmHg', 'side': 'OD', 'recordedAt': '2026-07-15T09:00:00Z'})
api('POST', '/observations', tok, {'patientId': rp, 'metric': 'iop_mmhg', 'value': 25, 'unit': 'mmHg', 'side': 'OD', 'recordedAt': '2026-07-17T14:00:00Z'})
s, c = api('GET', '/trends/%s/patient/%s?to=2026-07-17' % (CHART, rp), tok)
vals = [pt['value'] for ser in (c.get('series') or []) for pt in ser['points']]
ck('a date-only "to" INCLUDES that whole day (the 14:00 reading is kept)', 25 in vals, vals)
s, c2 = api('GET', '/trends/%s/patient/%s?from=2026-07-17&to=2026-07-17' % (CHART, rp), tok)
vals2 = [pt['value'] for ser in (c2.get('series') or []) for pt in ser['points']]
ck('a single-day window returns that day (not empty)', vals2 == [25], vals2)
s, bad = api('GET', '/trends/%s/patient/%s?to=notadate' % (CHART, rp), tok)
ck('an unparseable date is a clean 400, not a 500', s == 400, '%s %s' % (s, (bad.get('message') or '')[:40]))

print('\n== A clinician pins an annotation onto the chart ==')
s, ann = api('POST', '/trends/annotations', tok,
             {'patientId': pid, 'chartKey': CHART, 'atDateTime': '2026-06-01T12:00:00Z',
              'label': 'started latanoprost OD', 'side': 'OD'})
ck('the annotation is created', s in (200, 201) and ann.get('id'), (ann.get('message') or ann.get('label')))
s, chart2 = api('GET', '/trends/%s/patient/%s' % (CHART, pid), tok)
anns = chart2.get('annotations') or []
ck('and it comes back on the chart', any(a['label'] == 'started latanoprost OD' for a in anns), len(anns))
s, empty = api('POST', '/trends/annotations', tok,
               {'patientId': pid, 'chartKey': CHART, 'atDateTime': '2026-06-01T12:00:00Z', 'label': ''})
ck('an empty-label annotation is refused', s == 400, s)

print('\n== A pooled, daily-mean chart (pain) collapses differently ==')
# The physiotherapy pain chart pools both sides (splitByLaterality=false) and
# averages per day (dailyMean) — a different aggregation than IOP, proving the
# definition drives the maths.
PAIN = 'physiotherapy:pain_trend'
api('POST', '/packs/physiotherapy/activate', tok, {})
s, defs2 = api('GET', '/trends/definitions?packKey=physiotherapy', tok)
pdef = next((d for d in defs2 if d['key'] == PAIN), None)
ck('the pain trend seeds with dailyMean + no laterality split',
   pdef and pdef.get('aggregation') == 'DAILY_MEAN' and pdef.get('splitByLaterality') is False, pdef and pdef.get('aggregation'))
s, pp = api('POST', '/patients', tok, {'mrn': 'PAIN-%d' % U, 'name': 'Pain Probe %d' % U, 'phone': '+92 300 7777777'})
ppid = pp['id']
for v, at in [(6, '2026-05-01T09:00:00Z'), (4, '2026-05-01T17:00:00Z'), (2, '2026-05-05T10:00:00Z')]:
    api('POST', '/observations', tok, {'patientId': ppid, 'metric': 'nprs', 'value': v, 'unit': 'score', 'recordedAt': at})
s, pchart = api('GET', '/trends/%s/patient/%s' % (PAIN, ppid), tok)
pser = pchart.get('series') or []
ck('a non-lateralized chart is one pooled series (side null)', len(pser) == 1 and pser[0]['side'] is None, [x['side'] for x in pser])
pts = [pt['value'] for pt in (pser[0]['points'] if pser else [])]
ck('day 1 is the MEAN of 6 and 4 (=5), day 2 is 2', pts == [5, 2], pts)

print('\n== A chart that does not exist is a clean 404 ==')
s, no = api('GET', '/trends/nope:nochart/patient/%s' % pid, tok)
ck('rendering an unknown chart is 404', s == 404, s)
s, noann = api('POST', '/trends/annotations', tok,
               {'patientId': pid, 'chartKey': 'nope:nochart', 'atDateTime': '2026-06-01T12:00:00Z', 'label': 'x'})
ck('annotating an unknown chart is 404', s == 404, s)

print('\n===== %d/%d passed =====' % (sum(res), len(res)))
