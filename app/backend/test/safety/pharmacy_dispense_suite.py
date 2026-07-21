"""Pharmacy — the counter stays up, and a recall can find the patient.

Two defects an adversarial review REPRODUCED against this API. Neither corrupted
stock arithmetic; both are the kind that only show up on a busy day or on the
day something goes wrong.

1. CONCURRENT MULTI-DRUG SALES DEADLOCKED. The stock row lock was taken per drug
   inside the loop, in the order the CLIENT listed them, with no ORDER BY. Two
   carts naming the same two drugs in opposite order each held one lock and
   waited on the other; nothing caught 40P01. Reproduced: 20 concurrent two-drug
   sales -> 1 success, 19 HTTP 500. A pharmacy counter that fails almost every
   multi-item sale. Fixed by locking in a deterministic order (sorted by
   formularyCode, ORDER BY id within a drug), so the cycle cannot form.

2. A DISPENSE SPANNING BATCHES RECORDED ONLY THE FIRST. FEFO can satisfy one line
   from several batches, but a single scalar batchNo held only the earliest, and
   a second line of the same drug inherited it. Reproduced: 80 capsules
   attributed to a batch that held 30 — the other 50 appeared on no receipt.
   When a manufacturer recalls a lot, "which patients received it?" was answered
   wrongly in the direction that matters: the people at risk were the ones
   missing. Fixed with a DispenseItemBatch child row per batch touched.

Run: python test/safety/pharmacy_dispense_suite.py
"""
import json
import os
import sys
import threading
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _ids import mrn, RUN  # noqa: E402
from _db import psql  # noqa: E402

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
        try:
            return e.code, json.loads(e.read() or b'{}')
        except Exception:
            return e.code, {}


res = []


def ck(l, c, d=''):
    res.append(bool(c))
    print(('  PASS  ' if c else '  FAIL  ') + l + (('  -> ' + str(d)[:120]) if d != '' else ''))


s, t = api('POST', '/auth/login', None, {'email': 'owner@glowderma.pk', 'password': 'Password123!'})
tok = t['accessToken']


def receive(code, batch, qty, expiry='2029-06-01'):
    s, r = api('POST', '/pharmacy/stock', tok,
               {'formularyCode': code, 'batchNo': batch, 'quantity': qty, 'expiry': expiry, 'unitCostPkr': 10})
    return s, r


print('\n== A dispense drawn from two batches records BOTH ==')
# Two batches, deliberately different expiries so FEFO order is deterministic.
B1 = 'RCL-%s-A' % RUN
B2 = 'RCL-%s-B' % RUN
s, _ = receive('PARA500', B1, 30, '2027-01-01')
ck('first batch received', s in (200, 201), 'HTTP %s' % s)
s, _ = receive('PARA500', B2, 50, '2028-01-01')
ck('second batch received', s in (200, 201), 'HTTP %s' % s)

s, d = api('POST', '/pharmacy/dispense', tok,
           {'items': [{'code': 'PARA500', 'quantity': 80}], 'paymentMethod': 'CASH'})
ck('a dispense spanning both batches succeeds', s in (200, 201), 'HTTP %s' % s)
item = (d.get('items') or [{}])[0]
batches = {b['batchNo']: b['quantity'] for b in (item.get('batches') or [])}

# The whole point: both lots present, quantities correct, summing to the line.
ck('the earlier-expiry batch is recorded with its quantity', batches.get(B1) == 30, batches)
ck('the later-expiry batch is recorded with its quantity', batches.get(B2) == 50, batches)
ck('recorded quantities sum to the dispensed quantity', sum(batches.values()) == 80, sum(batches.values()))

# A recall is answered from the database, so assert it there too.
n = psql("SELECT COALESCE(SUM(quantity),0) FROM \"DispenseItemBatch\" WHERE \"batchNo\" = '%s';" % B2).strip()
ck('a recall of the second lot finds its 50 units', n == '50', '%s units' % n)

print('\n== Two lines of the same drug do not share a batch record ==')
B3 = 'RCL-%s-C' % RUN
receive('AMOX250', B3, 100, '2027-05-01')
s, d2 = api('POST', '/pharmacy/dispense', tok,
            {'items': [{'code': 'AMOX250', 'quantity': 10}, {'code': 'AMOX250', 'quantity': 5}],
             'paymentMethod': 'CASH'})
ck('a two-line same-drug sale succeeds', s in (200, 201), 'HTTP %s' % s)
items2 = d2.get('items') or []
tot = sum(sum(b['quantity'] for b in (i.get('batches') or [])) for i in items2)
ck('each line records its own draw (total 15, not 10 or 20)', tot == 15, tot)


print('\n== Concurrent multi-drug sales do not deadlock ==')
# The attack: identical carts listed in OPPOSITE order. Before the fix this
# formed a lock cycle and 19 of 20 returned 500.
receive('PARA500', 'CONC-%s-P' % RUN, 5000, '2029-01-01')
receive('AMOX250', 'CONC-%s-A' % RUN, 5000, '2029-01-01')
out = []
lk = threading.Lock()


def sale(reverse):
    items = [{'code': 'PARA500', 'quantity': 1}, {'code': 'AMOX250', 'quantity': 1}]
    if reverse:
        items.reverse()
    st, _ = api('POST', '/pharmacy/dispense', tok, {'items': items, 'paymentMethod': 'CASH'})
    with lk:
        out.append(st)


ths = [threading.Thread(target=sale, args=(i % 2 == 0,)) for i in range(20)]
for x in ths:
    x.start()
for x in ths:
    x.join()

ok = len([c for c in out if c in (200, 201)])
fivex = [c for c in out if c >= 500]
ck('every concurrent two-drug sale succeeds', ok == 20, '%d/20 ok, codes=%s' % (ok, sorted(set(out))))
ck('none returns a 5xx', not fivex, '5xx count=%d' % len(fivex))


print('\n===== %d/%d passed =====' % (sum(res), len(res)))
if not res:
    print('  NO CHECKS RAN - the suite asserted nothing')
    raise SystemExit(1)
_failed = len(res) - sum(res)
if _failed:
    print('  %d CHECK(S) FAILED' % _failed)
raise SystemExit(1 if _failed else 0)
