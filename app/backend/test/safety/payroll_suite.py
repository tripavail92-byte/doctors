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
P1 = '20%02d-01' % (U % 90)
P2 = '20%02d-02' % (U % 90)

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
