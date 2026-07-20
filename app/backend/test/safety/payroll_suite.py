"""Payroll safety suite.

Payroll is the one module where a bug is a wrong number in someone's hand. The
asymmetry that matters: a DRAFT is a proposal and must be disposable, a
FINALIZED run is the record that staff were paid and must be untouchable. Every
check below asserts the negative — that the thing which must not happen is
actually refused, not merely absent from the UI.

Run: python test/safety/payroll_suite.py
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

# Run-unique periods. A period is unique per tenant and runs accumulate; sharing
# '2026-07' across runs of this suite would collide with the previous run's rows
# and the assertions would be measuring history, not this code.
# Allocate periods that are VERIFIED unused, rather than hashing the clock and
# hoping. The previous form ('20%02d-01' % (U % 90)) had only 90 distinct values,
# so after ~90 runs a period collided with one this suite had already FINALIZED —
# and a finalized run cannot be discarded, so the collision was unrecoverable and
# the suite failed against correct code. A period is unique per tenant; the test
# must therefore claim one nobody holds.
s, _existing = api('GET', '/hr/payroll/runs', tok)
_used = {r['period'] for r in (_existing or []) if isinstance(r, dict) and r.get('period')}


def fresh_period():
    for _yr in range(2000, 2900):
        for _mo in range(1, 13):
            p = '%04d-%02d' % (_yr, _mo)
            if p not in _used:
                _used.add(p)
                return p
    raise RuntimeError('no free payroll period left — clean up test runs')


P1 = fresh_period()
P2 = fresh_period()

print('\n== Staff ==')
s, e1 = api('POST', '/hr/employees', tok, {'name': 'Ayesha Khan %d' % U, 'designation': 'Nurse',
                                           'baseSalaryPkr': 80000, 'allowancesPkr': 12000})
ck('employee added', s in (200, 201) and e1.get('id'), e1.get('name'))

print('\n== One person, one salary ==')
# Payroll pays a salary per employee ROW. A person entered twice is paid twice,
# and nothing in the run looks wrong: both payslips are individually correct.
# The CNIC is the only real key -- two staff genuinely share a name.
CN = '35202-%07d-1' % (U % 9999999)
s, c1 = api('POST', '/hr/employees', tok, {'name': 'Sana Malik %d' % U, 'designation': 'Nurse',
                                           'baseSalaryPkr': 60000, 'cnic': CN})
ck('employee with a CNIC added', s in (200, 201), c1.get('cnic'))
s, c2 = api('POST', '/hr/employees', tok, {'name': 'S. Malik (dup) %d' % U, 'designation': 'Nurse',
                                           'baseSalaryPkr': 60000, 'cnic': CN})
ck('the same CNIC under a different name is refused', s == 400, (c2.get('message') or '')[:90])
s, roster = api('GET', '/hr/employees', tok)
ck('so the roster holds exactly one row for that CNIC',
   len([e for e in roster if e.get('cnic') == CN]) == 1,
   len([e for e in roster if e.get('cnic') == CN]))

# Two staff CAN share a name -- refusing on name would block real hiring.
s, ns = api('POST', '/hr/employees', tok, {'name': 'Sana Malik %d' % U, 'designation': 'Receptionist',
                                           'baseSalaryPkr': 40000})
ck('but two different people may share a name', s in (200, 201), ns.get('designation'))

print('\n== A draft is a proposal ==')
s, r1 = api('POST', '/hr/payroll/runs', tok, {'period': P1, 'deductions': []})
ck('draft run computed', s in (200, 201) and r1.get('status') == 'DRAFT', r1.get('status'))
ck('the net is base + allowances', any(p['netPkr'] == 92000 for p in r1.get('payslips') or []),
   [p['netPkr'] for p in (r1.get('payslips') or [])][:3])

s, dup = api('POST', '/hr/payroll/runs', tok, {'period': P1, 'deductions': []})
ck('the same period cannot be run twice', s == 400, (dup.get('message') or '')[:70])

# The trap this suite exists for: if a draft cannot be discarded, the period is
# permanently stuck with whatever the first (possibly wrong) run computed.
s, disc = api('DELETE', '/hr/payroll/runs/%s' % r1['id'], tok)
ck('a draft CAN be discarded', s in (200, 201) and disc.get('discarded') is True, disc)
s, again = api('POST', '/hr/payroll/runs', tok, {'period': P1, 'deductions': []})
ck('and the month can then be run again correctly', s in (200, 201), again.get('status'))
r1 = again

print('\n== A finalized run is the record that people were paid ==')
s, fin = api('PATCH', '/hr/payroll/runs/%s/finalize' % r1['id'], tok, {})
ck('finalize marks it FINALIZED', fin.get('status') == 'FINALIZED', fin.get('status'))

s, kill = api('DELETE', '/hr/payroll/runs/%s' % r1['id'], tok)
ck('a FINALIZED run cannot be discarded', kill == {} or s == 400, (kill.get('message') or '')[:80])
s, still = api('GET', '/hr/payroll/runs/%s' % r1['id'], tok)
ck('and it is still there afterwards (the delete did not half-happen)',
   s == 200 and still.get('status') == 'FINALIZED', still.get('status'))
ck('its payslips survived too', len(still.get('payslips') or []) > 0, len(still.get('payslips') or []))

s, refin = api('PATCH', '/hr/payroll/runs/%s/finalize' % r1['id'], tok, {})
ck('it cannot be finalized twice', s == 400, (refin.get('message') or '')[:60])

print('\n== Staff who leave stop being paid ==')
# runPayroll pays everyone whose status is ACTIVE. Until setEmployeeStatus existed,
# NOTHING could write that field -- the enum had three values, the filter read it,
# and no route reached it. A nurse who resigned was paid in full, every month,
# forever, and could not be deleted because her payslips referenced her.
#
# The guard looked correct in review and would pass any test that seeded the row
# directly. Only asking "can the API reach that state?" finds it. So this asserts
# reachability THROUGH THE API, not through Prisma.
s, leaver = api('POST', '/hr/employees', tok, {'name': 'Rida Aslam %d' % U, 'designation': 'Nurse',
                                               'baseSalaryPkr': 55000})
s, term = api('PATCH', '/hr/employees/%s/status' % leaver['id'], tok, {'status': 'TERMINATED'})
ck('an employee can actually be terminated through the API', s in (200, 201)
   and term.get('status') == 'TERMINATED', term.get('status'))
s, bogus = api('PATCH', '/hr/employees/%s/status' % leaver['id'], tok, {'status': 'RESIGNED'})
ck('an invalid status is refused', s == 400, s)

P3 = fresh_period()
s, r3 = api('POST', '/hr/payroll/runs', tok, {'period': P3, 'deductions': []})
paid = [p['employee']['name'] for p in (r3.get('payslips') or [])]
ck('a terminated employee is NOT in the next run', ('Rida Aslam %d' % U) not in paid,
   'run pays %d people' % len(paid))
s, ded = api('POST', '/hr/payroll/runs', tok, {
    'period': fresh_period(),
    'deductions': [{'employeeId': leaver['id'], 'amountPkr': 100}]})
ck('and a deduction against them is refused as inactive', s == 400, (ded.get('message') or '')[:70])

# The intersection: this draft was computed BEFORE the termination, so it still
# carries their payslip. It must SAY so rather than silently pay them -- and must
# not refuse, because a leaver may genuinely be owed their final month.
s, back = api('PATCH', '/hr/employees/%s/status' % leaver['id'], tok, {'status': 'ACTIVE'})
P5 = fresh_period()
s, r5 = api('POST', '/hr/payroll/runs', tok, {'period': P5, 'deductions': []})
in5 = ('Rida Aslam %d' % U) in [p['employee']['name'] for p in (r5.get('payslips') or [])]
ck('a rehired employee is paid again', in5, in5)
api('PATCH', '/hr/employees/%s/status' % leaver['id'], tok, {'status': 'TERMINATED'})
s, r5b = api('GET', '/hr/payroll/runs/%s' % r5['id'], tok)
stale = r5b.get('staleSlips') or []
ck('a draft that predates a termination flags the stale payslip',
   any(x['name'] == ('Rida Aslam %d' % U) for x in stale), stale[:2])
ck('and it is still finalizable — a leaver may be owed their final month',
   api('PATCH', '/hr/payroll/runs/%s/finalize' % r5['id'], tok, {})[1].get('status') == 'FINALIZED')

print('\n== Deductions cannot invent a debt ==')
s, over = api('POST', '/hr/payroll/runs', tok, {
    'period': P2,
    'deductions': [{'employeeId': e1['id'], 'amountPkr': 500000}]})
ck('a deduction exceeding gross pay is refused', s == 400, (over.get('message') or '')[:80])
s, ghost = api('POST', '/hr/payroll/runs', tok, {
    'period': P2,
    'deductions': [{'employeeId': '00000000-0000-0000-0000-000000000000', 'amountPkr': 100}]})
ck('a deduction against an unknown employee is refused', s == 400, (ghost.get('message') or '')[:80])

# Split deductions that are individually fine but together exceed gross. Summing
# per employee is the only way to catch this; validating each in isolation is
# the bug this asserts against.
s, split = api('POST', '/hr/payroll/runs', tok, {
    'period': P2,
    'deductions': [{'employeeId': e1['id'], 'amountPkr': 60000},
                   {'employeeId': e1['id'], 'amountPkr': 60000}]})
ck('two deductions that only exceed gross when summed are refused', s == 400,
   (split.get('message') or '')[:80])
s, listed = api('GET', '/hr/payroll/runs', tok)
ck('and no run was left behind by the refusal', not any(r['period'] == P2 for r in listed),
   [r['period'] for r in listed][:4])

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
