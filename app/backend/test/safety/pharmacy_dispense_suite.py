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
import datetime as _dt
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
# Two batches, different expiries so FEFO order between them is deterministic.
#
# The expiries are the NEAREST in-date dates available (tomorrow, and the day
# after), NOT fixed years. FEFO consumes earliest-expiry first, so any stock this
# suite did not create sorts AFTER these — which is the only way to know the two
# batches consumed are the two this section is about.
#
# Fixed '2027-01-01'/'2028-01-01' failed exactly that way: a batch left behind by
# another test expired sooner, FEFO took it first, and the assertions measured
# someone else's stock. A check whose result depends on what else is in the
# database is not a check.
_today = _dt.date.today()
E1 = (_today + _dt.timedelta(days=1)).isoformat()
E2 = (_today + _dt.timedelta(days=2)).isoformat()
B1 = 'RCL-%s-A' % RUN
B2 = 'RCL-%s-B' % RUN
s, _ = receive('PARA500', B1, 30, E1)
ck('first batch received', s in (200, 201), 'HTTP %s' % s)
s, _ = receive('PARA500', B2, 50, E2)
ck('second batch received', s in (200, 201), 'HTTP %s' % s)

s, d = api('POST', '/pharmacy/dispense', tok,
           {'items': [{'code': 'PARA500', 'quantity': 80}], 'paymentMethod': 'CASH'})
ck('a dispense spanning both batches succeeds', s in (200, 201), 'HTTP %s' % s)
item = (d.get('items') or [{}])[0]
# Sum per batchNo rather than dict-assign: two stock rows can legitimately share
# a batchNo, and a plain comprehension silently keeps only the last of them.
batches: dict = {}
for _b in (item.get('batches') or []):
    batches[_b['batchNo']] = batches.get(_b['batchNo'], 0) + _b['quantity']

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


print('\n== A controlled drug cannot leave the counter unnamed ==')
# `controlled: true` sat on the tramadol row of the formulary and was read by
# nothing at all. Tramadol dispensed exactly like paracetamol: anonymously, with
# no record of who received it, so the register could not answer "who did this go
# to". A declared flag that no code path consults is not a control.
#
# Verified as an INVENTORY user, not the owner — the least-privileged principal
# who works this counter. A rule the owner obeys and the counter staff bypass is
# not a rule, and the owner is the one principal least likely to expose that.
OWNER_TENANT = psql("SELECT \"tenantId\" FROM \"User\" WHERE email='owner@glowderma.pk';").strip()
PW_HASH = psql("SELECT \"passwordHash\" FROM \"User\" WHERE email='owner@glowderma.pk';").strip()
INV_EMAIL = 'inventory.probe@glowderma.pk'
psql("INSERT INTO \"User\" (id,\"tenantId\",email,\"passwordHash\",name,role) "
     "VALUES (gen_random_uuid(),'%s','%s','%s','Inventory Probe','INVENTORY') "
     "ON CONFLICT (email) DO NOTHING;" % (OWNER_TENANT, INV_EMAIL, PW_HASH))
s, itok = api('POST', '/auth/login', None, {'email': INV_EMAIL, 'password': 'Password123!'})
ck('an INVENTORY user exists and can log in', s == 200 and itok.get('accessToken'), 'HTTP %s' % s)
it = itok.get('accessToken')

# Stock FIRST, and plenty of it. The previous version of a probe like this read a
# 400 from "insufficient stock" as proof the validation fired, and reported a
# real defect as refuted. With stock on the shelf a 400 can only come from the
# rule under test.
TB = 'CTRL-%s' % RUN
s, _ = receive('TRAMADOL50', TB, 200, (_today + _dt.timedelta(days=400)).isoformat())
ck('controlled stock is on the shelf (so a refusal cannot be "no stock")', s in (200, 201), 'HTTP %s' % s)

# Measure TOTAL tramadol on hand, not this batch's. FEFO picks the earliest
# expiry across every lot, so a refusal that "left THIS batch alone" while
# draining an older one would read as a pass. The first draft asserted on TB
# alone and was satisfied by a sale that never touched TB.
def tramadol_on_hand():
    return psql("SELECT COALESCE(SUM(\"quantityOnHand\"),0) FROM \"StockItem\" "
                "WHERE \"formularyCode\" = 'TRAMADOL50';").strip()


before = tramadol_on_hand()

s_no, denied = api('POST', '/pharmacy/dispense', it,
                   {'items': [{'code': 'TRAMADOL50', 'quantity': 5}], 'paymentMethod': 'CASH'})
ck('an unnamed controlled dispense is REFUSED', s_no == 400,
   'HTTP %s %s' % (s_no, str(denied.get('message'))[:90]))
ck('and the refusal names the drug rather than saying "invalid request"',
   'Tramadol' in str(denied.get('message', '')), str(denied.get('message'))[:90])

# The refusal must refuse. A 400 that still moved stock is the failure mode this
# codebase keeps producing: a control that reports failure while doing the thing.
after = tramadol_on_hand()
ck('and no tramadol anywhere came off the shelf', after == before, '%s -> %s' % (before, after))

# The positive, so the rule is not simply "controlled drugs never dispense".
s, pt = api('POST', '/patients', it, {'mrn': mrn('CTRL'), 'name': 'Controlled Probe %s' % RUN,
                                      'phone': '+92 300 4444444'})
if s not in (200, 201):
    s, pt = api('POST', '/patients', tok, {'mrn': mrn('CTRL2'), 'name': 'Controlled Probe %s' % RUN,
                                           'phone': '+92 300 4444444'})
pid = pt.get('id')
ck('a patient exists to dispense to', bool(pid), 'HTTP %s' % s)
s_ok, sale = api('POST', '/pharmacy/dispense', it,
                 {'patientId': pid, 'items': [{'code': 'TRAMADOL50', 'quantity': 5}],
                  'paymentMethod': 'CASH'})
ck('the SAME sale succeeds once the patient is named', s_ok in (200, 201),
   'HTTP %s %s' % (s_ok, str(sale.get('message'))[:80]))

# And the point of naming them: the recall path now reaches a person.
#
# Ask it of the lot the sale ACTUALLY drew from, read back off the receipt —
# not of TB. FEFO chooses the earliest expiry across every tramadol lot in the
# tenant, including ones earlier runs left behind, so a hard-coded batch number
# asserts against a lot this sale may never have touched. That is precisely how
# the first draft of this check failed: 0 rows, on a sale that had succeeded.
drew = [b['batchNo'] for i in (sale.get('items') or []) for b in (i.get('batches') or [])]
ck('the receipt names the lot(s) the sale drew from', bool(drew), drew)
named = psql("SELECT count(*) FROM \"DispenseItemBatch\" b "
             "JOIN \"DispenseItem\" i ON i.id = b.\"dispenseItemId\" "
             "JOIN \"Dispense\" d ON d.id = i.\"dispenseId\" "
             "WHERE b.\"batchNo\" IN (%s) AND d.\"patientId\" = '%s';"
             % (','.join("'%s'" % b for b in drew or ['-']), pid)).strip()
ck('a recall of that lot resolves to the patient who received it', named not in ('', '0'),
   '%s row(s) for %s on %s' % (named, pid, drew))


print('\n===== %d/%d passed =====' % (sum(res), len(res)))
if not res:
    print('  NO CHECKS RAN - the suite asserted nothing')
    raise SystemExit(1)
_failed = len(res) - sum(res)
if _failed:
    print('  %d CHECK(S) FAILED' % _failed)
raise SystemExit(1 if _failed else 0)
