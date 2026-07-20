"""Pharmacy dispensing safety suite.

A pharmacy hands physical medicine to a patient. The dangerous failure is not a
wrong total on a receipt — it is dispensing a drug that should never have left
the shelf. FEFO (first-expiry-first-out) ordered batches earliest-first but never
checked the earliest was still in date, so it handed out the MOST expired batch
first. This suite proves expired stock cannot be dispensed, and is the tripwire
if that guard is ever removed.

Pharmacy stock is keyed by a FIXED formulary code (not run-unique), so batches
accumulate across runs and FEFO is global per drug. Every assertion here is
therefore written to hold regardless of what other in-date stock exists: we test
that our EXPIRED batch is never touched and that an over-request names the
expired shortfall — never that a specific batch was chosen.

Run: python test/safety/pharmacy_safety_suite.py
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

s, form = api('GET', '/pharmacy/formulary', tok)
code = form[0]['code']
name = form[0]['name']


def drug_stock():
    s, st = api('GET', '/pharmacy/stock?formularyCode=%s' % code, tok)
    g = [x for x in st if x['formularyCode'] == code]
    return g[0] if g else {'onHand': 0, 'expired': 0, 'batches': []}


print('\n== A dispense never touches an expired batch ==')
EXP = 'EXP-%d' % U
GOOD = 'GD-%d' % U
# The expired batch is the EARLIEST expiry, so a naive FEFO would take it first.
api('POST', '/pharmacy/stock', tok, {'formularyCode': code, 'batchNo': EXP, 'expiry': '2020-01-01', 'quantity': 50, 'unitCostPkr': 10})
api('POST', '/pharmacy/stock', tok, {'formularyCode': code, 'batchNo': GOOD, 'expiry': '2030-12-31', 'quantity': 50, 'unitCostPkr': 10})
before = drug_stock()
in_date_before = before['onHand']
s, d = api('POST', '/pharmacy/dispense', tok, {'items': [{'code': code, 'quantity': 1}], 'paymentMethod': 'CASH'})
ck('a dispense with in-date stock succeeds', s in (200, 201) and (d.get('items') or []), s if s >= 400 else '')
after = drug_stock()
exp_batch = [b for b in after['batches'] if b['batchNo'] == EXP]
ck('the EXPIRED batch is untouched (still 50 on hand)',
   bool(exp_batch) and exp_batch[0]['quantityOnHand'] == 50, exp_batch[0]['quantityOnHand'] if exp_batch else 'gone')
ck('an in-date batch was decremented instead', after['onHand'] == in_date_before - 1,
   'onHand %d -> %d' % (in_date_before, after['onHand']))
disp_batch = (d.get('items') or [{}])[0].get('batchNo')
ck('the receipt does not name the expired batch', disp_batch != EXP, disp_batch)

print('\n== Expired stock is not counted as on hand ==')
st = drug_stock()
ck('onHand excludes the expired 50', st['onHand'] == in_date_before - 1, st['onHand'])
ck('but the expired units are surfaced separately (a pull worklist)', st['expired'] >= 50, st['expired'])
ck('and the expired batch is flagged', any(b['batchNo'] == EXP and b['expired'] for b in st['batches']))

print('\n== When only expired stock could cover it, the dispense is REFUSED ==')
# Ask for one more than ALL in-date stock. The expired batch (huge) must not be
# allowed to make up the difference, and the refusal must name the expired stock
# so nobody goes looking for phantom inventory.
usable = drug_stock()['onHand']
api('POST', '/pharmacy/stock', tok, {'formularyCode': code, 'batchNo': 'EXP2-%d' % U, 'expiry': '2019-06-01', 'quantity': 1000, 'unitCostPkr': 10})
s, over = api('POST', '/pharmacy/dispense', tok, {'items': [{'code': code, 'quantity': usable + 1}], 'paymentMethod': 'CASH'})
ck('requesting more than in-date stock is refused', s == 400, (over.get('message') or '')[:90])
ck('and the refusal says the extra stock is EXPIRED, not available',
   'EXPIRED' in (over.get('message') or '').upper(), (over.get('message') or '')[:110])
ck('the over-request did not partially decrement anything', drug_stock()['onHand'] == usable,
   'onHand still %d' % usable)

print('\n== A normal dispense is a real POS sale ==')
api('POST', '/pharmacy/stock', tok, {'formularyCode': code, 'batchNo': 'SALE-%d' % U, 'expiry': '2031-01-01', 'quantity': 5, 'unitCostPkr': 10})
s, sale = api('POST', '/pharmacy/dispense', tok, {'items': [{'code': code, 'quantity': 2}], 'paymentMethod': 'CASH'})
it = (sale.get('items') or [{}])[0]
ck('a receipt number is issued', bool(sale.get('receiptNumber')), sale.get('receiptNumber'))
ck('the line price is snapshotted, not left to drift', it.get('unitPricePkr', 0) > 0, it.get('unitPricePkr'))
ck('the line total is price x quantity', it.get('lineTotalPkr') == it.get('unitPricePkr', 0) * it.get('quantity', 0),
   '%s == %s x %s' % (it.get('lineTotalPkr'), it.get('unitPricePkr'), it.get('quantity')))
ck('the sale total equals the sum of its lines',
   sale.get('totalPkr') == sum(x['lineTotalPkr'] for x in sale.get('items') or []), sale.get('totalPkr'))

print('\n== An unknown drug is refused ==')
s, bad = api('POST', '/pharmacy/dispense', tok, {'items': [{'code': 'NOSUCHDRUG', 'quantity': 1}], 'paymentMethod': 'CASH'})
ck('dispensing a drug not in the formulary is refused', s == 400, (bad.get('message') or '')[:60])

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
