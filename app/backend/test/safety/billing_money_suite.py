"""Billing money-safety suite.

Every scenario here is a defect that was REPRODUCED against this API by an
adversarial review and survived three skeptics trying to refute it. The suite is
the proof they are closed, and the tripwire if anyone reopens them.

The structural bug worth remembering: PaymentIntent had no terminal state but
CONSUMED. An intent snapshots `total - paid` at mint time; refund, void and
payment all move that balance and none of them touched the intent. Four separate
symptoms -- void resurrection, refund reversal, a permanent 500, a permanent 400
-- were one missing lifecycle.

And the intersection that made the worst one reachable: voidInvoice requires
paid == 0, which guarantees outstanding == total > 0, which is exactly what
applyPayment tests to accept money. The precondition for voiding a bill WAS the
precondition for collecting on it.

Run: python test/safety/billing_money_suite.py
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
U = int(time.time() * 1000) % 1000000
N = [0]


def patient(tag):
    N[0] += 1
    s, p = api('POST', '/patients', tok, {'mrn': 'BIL-%d-%d' % (U, N[0]), 'name': 'Billing %s %d' % (tag, U),
                                          'phone': '+92 300 1234567'})
    return p['id']


def invoice(amount, tag):
    """A fresh patient AND a fresh invoice per scenario.

    Sharing either makes the result depend on execution order, and a suite whose
    result depends on what ran before it is not a check.
    """
    pid = patient(tag)
    s, inv = api('POST', '/invoices', tok, {'patientId': pid, 'items': [
        {'code': 'SVC-%d' % U, 'name': 'Consult', 'unitPricePkr': amount, 'quantity': 1}]})
    return inv


print('\n== A void invoice cannot be resurrected by a stale pay link ==')
# The original: raise 9,000 -> mint pay link -> patient doesn't pay -> clinic
# voids -> confirm the pre-void reference -> 201, PAID, 9,000. A cancelled bill
# became revenue, and was then eligible to be filed as a tax document.
inv = invoice(9000, 'void')
s, link = api('POST', '/invoices/%s/pay-link' % inv['id'], tok, {'provider': 'safepay'})
ck('pay link minted', s in (200, 201) and link.get('reference'), link.get('reference'))
s, voided = api('PATCH', '/invoices/%s/void' % inv['id'], tok, {})
ck('the unpaid invoice voids', voided.get('status') == 'VOID', voided.get('status'))
s, conf = api('POST', '/invoices/%s/confirm' % inv['id'], tok, {'reference': link['reference']})
ck('confirming the PRE-VOID reference is REFUSED', s == 400, (conf.get('message') or '')[:80])
s, after = api('GET', '/invoices/%s' % inv['id'], tok)
ck('and the invoice is still VOID with paid 0',
   after.get('status') == 'VOID' and after.get('paid') == 0,
   '%s paid=%s' % (after.get('status'), after.get('paid')))
ck('with zero payment rows', len(after.get('payments') or []) == 0, len(after.get('payments') or []))
s, fbr = api('POST', '/integrations/fbr/invoices/%s/submit' % inv['id'], tok, {})
ck('a void invoice cannot be filed with FBR', s == 400, (fbr.get('message') or '')[:70])

print('\n== A refund kills the pay link that predates it ==')
# The original: pay 10,000 cash -> refund 10,000 -> the pre-refund link still
# confirms -> PAID 10,000 again. 20,000 taken, 10,000 refunded, invoice reads
# PAID. sum(payments) - sum(refunds) == paid held throughout, so no
# reconciliation job would ever have flagged it.
inv = invoice(10000, 'refund')
s, link = api('POST', '/invoices/%s/pay-link' % inv['id'], tok, {'provider': 'safepay'})
ref = link['reference']
s, pay = api('POST', '/invoices/%s/payments' % inv['id'], tok, {'amountPkr': 10000, 'method': 'CASH'})
ck('cash payment lands', (pay.get('invoice') or pay).get('status') == 'PAID',
   (pay.get('invoice') or pay).get('status'))
s, ref_r = api('POST', '/invoices/%s/refunds' % inv['id'], tok,
               {'amountPkr': 10000, 'method': 'CASH', 'reason': 'patient cancelled'})
ck('full refund recorded', (ref_r.get('invoice') or {}).get('paid') == 0,
   (ref_r.get('invoice') or {}).get('paid'))
s, conf = api('POST', '/invoices/%s/confirm' % inv['id'], tok, {'reference': ref})
ck('the stale PRE-REFUND link is REFUSED', s == 400, (conf.get('message') or '')[:80])
ck('and the refusal names staleness, not balance arithmetic',
   'no longer valid' in (conf.get('message') or ''), (conf.get('message') or '')[:60])
s, after = api('GET', '/invoices/%s' % inv['id'], tok)
ck('exactly one payment and one refund survive',
   len(after.get('payments') or []) == 1 and len(after.get('refunds') or []) == 1,
   'pays=%d refunds=%d' % (len(after.get('payments') or []), len(after.get('refunds') or [])))
ck('and paid is 0 — the refund was not reversed', after.get('paid') == 0, after.get('paid'))

print('\n== The intersection: refund, then void, then confirm ==')
# This is the case every skeptic's run failed on.
inv = invoice(4000, 'both')
s, link = api('POST', '/invoices/%s/pay-link' % inv['id'], tok, {'provider': 'payfast'})
ref = link['reference']
api('POST', '/invoices/%s/payments' % inv['id'], tok, {'amountPkr': 4000, 'method': 'CASH'})
api('POST', '/invoices/%s/refunds' % inv['id'], tok, {'amountPkr': 4000, 'method': 'CASH'})
s, v = api('PATCH', '/invoices/%s/void' % inv['id'], tok, {})
ck('a fully refunded invoice can be voided', v.get('status') == 'VOID', v.get('status'))
s, conf = api('POST', '/invoices/%s/confirm' % inv['id'], tok, {'reference': ref})
ck('and the original link is still dead afterwards', s == 400, (conf.get('message') or '')[:70])

print('\n== A gateway reference already spent does not 500 forever ==')
# recordPayment guarded its insert on (tenantId, reference); confirmGateway
# checked only the intent's status. Different keys. A Payment already carrying
# the reference made applyPayment's create hit the unique index and 500 -- on
# every webhook retry, forever. The reference is public: it is in the pay-link
# body and in the checkout URL.
inv = invoice(6000, 'burn')
s, link = api('POST', '/invoices/%s/pay-link' % inv['id'], tok, {'provider': 'safepay'})
ref = link['reference']
s, burn = api('POST', '/invoices/%s/payments' % inv['id'], tok,
              {'amountPkr': 6000, 'method': 'CASH', 'reference': ref})
ck('the reference can be burned by a manual payment', s in (200, 201), s)
s, conf = api('POST', '/invoices/%s/confirm' % inv['id'], tok, {'reference': ref})
ck('confirming it is NOT a 5xx', s < 500, s)
ck('it is a clean duplicate, not a crash', s in (200, 201) and conf.get('duplicate') is True,
   'status=%s duplicate=%s' % (s, conf.get('duplicate')))
s, after = api('GET', '/invoices/%s' % inv['id'], tok)
ck('and the money was counted exactly once', after.get('paid') == 6000,
   'paid=%s pays=%d' % (after.get('paid'), len(after.get('payments') or [])))

print('\n== A reused receipt number cannot swallow a different payment ==')
# Dedupe matched on reference alone and never compared the amount. Post 5,000 as
# RCPT-x, then 3,000 as RCPT-x -> 201 duplicate:true echoing the 5,000 row. The
# front desk took 3,000 in cash, got a success, and the patient still owes it.
inv = invoice(20000, 'dup')
R = 'RCPT-%d' % U
s, p1 = api('POST', '/invoices/%s/payments' % inv['id'], tok,
            {'amountPkr': 5000, 'method': 'CASH', 'reference': R})
ck('first payment of 5,000 lands', (p1.get('invoice') or p1).get('paid') == 5000,
   (p1.get('invoice') or p1).get('paid'))
s, p2 = api('POST', '/invoices/%s/payments' % inv['id'], tok,
            {'amountPkr': 3000, 'method': 'CASH', 'reference': R})
ck('the SAME reference with a DIFFERENT amount is refused (409)', s == 409, s)
ck('and the refusal names the original amount', '5000' in (p2.get('message') or ''),
   (p2.get('message') or '')[:80])
# Positive control: a true replay must still be idempotent, or we have broken
# retries. This distinction is the entire point of the check.
s, p3 = api('POST', '/invoices/%s/payments' % inv['id'], tok,
            {'amountPkr': 5000, 'method': 'CASH', 'reference': R})
ck('the same reference with the SAME amount is still an idempotent replay',
   s in (200, 201) and p3.get('duplicate') is True, 'status=%s dup=%s' % (s, p3.get('duplicate')))
s, after = api('GET', '/invoices/%s' % inv['id'], tok)
ck('exactly one payment row, paid unchanged at 5,000',
   len(after.get('payments') or []) == 1 and after.get('paid') == 5000,
   'pays=%d paid=%s' % (len(after.get('payments') or []), after.get('paid')))
# And the 3,000 was a perfectly valid payment -- only the reused number killed it.
s, p4 = api('POST', '/invoices/%s/payments' % inv['id'], tok,
            {'amountPkr': 3000, 'method': 'CASH', 'reference': R + '-B'})
ck('the same 3,000 lands fine under a distinct reference',
   (p4.get('invoice') or p4).get('paid') == 8000, (p4.get('invoice') or p4).get('paid'))

print('\n== Money cannot be billed to the wrong patient ==')
# A DOCTOR -- 403 on every billing route, including READING the invoice --
# completed a plan item for one patient onto another patient's invoice via the
# dental path. appendLine locked whatever id it was handed and raised the total.
# The role bypass was the visible half; the IDOR is the half that survives a
# role-only fix, because a FINANCE user with a mistyped id does the same damage.
alice = patient('alice')
s, a_inv = api('POST', '/invoices', tok, {'patientId': alice, 'items': [
    {'code': 'C-%d' % U, 'name': 'Consult', 'unitPricePkr': 5000, 'quantity': 1}]})
before_total = a_inv['total']
bob = patient('bob')
s, item = api('POST', '/dental/plan-items', tok, {
    'patientId': bob, 'toothFdi': '11', 'catalogCode': 'IMPL-%d' % U,
    'name': 'Implant', 'pricePkr': 150000})
if s in (200, 201) and item.get('id'):
    bad_status, bad = api('PATCH', '/dental/plan-items/%s/complete' % item['id'], tok,
                          {'invoiceId': a_inv['id']})
    ck("billing Bob's implant onto Alice's invoice is REFUSED", bad_status >= 400,
       (bad.get('message') or bad_status))
    s, a_after = api('GET', '/invoices/%s' % a_inv['id'], tok)
    ck("and Alice's invoice is untouched (total, lines)",
       a_after['total'] == before_total and len(a_after['lines']) == len(a_inv['lines']),
       'total %s -> %s' % (before_total, a_after['total']))
    # An OWNER must be refused too, proving this is an ownership check and not
    # the role check wearing a disguise.
    # This ran as OWNER -- the most privileged principal there is. If the fix were
    # only the role check, OWNER would have sailed through and billed Bob's
    # implant to Alice. It is refused on OWNERSHIP, which is what closes the IDOR
    # for every caller, including a FINANCE user with a mistyped id.
    ck('the refusal is ownership, not role — even OWNER cannot do it',
       bad_status >= 400 and 'different patient' in (bad.get('message') or '').lower(),
       (bad.get('message') or '')[:70])
else:
    ck('dental plan item created for the cross-patient probe', False, 'setup failed: %s %s' % (s, item))

print('\n== FBR files a sale exactly once ==')
inv = invoice(3000, 'fbr')
api('POST', '/invoices/%s/payments' % inv['id'], tok, {'amountPkr': 3000, 'method': 'CASH'})
import threading
codes = []
lock = threading.Lock()


def submit():
    st, _ = api('POST', '/integrations/fbr/invoices/%s/submit' % inv['id'], tok, {})
    with lock:
        codes.append(st)


ths = [threading.Thread(target=submit) for _ in range(6)]
for t_ in ths:
    t_.start()
for t_ in ths:
    t_.join()
ok = len([c for c in codes if c in (200, 201)])
ck('exactly one of 6 concurrent submits files it', ok == 1, 'codes=%s' % sorted(codes))
s, after = api('GET', '/invoices/%s' % inv['id'], tok)
ck('and the invoice carries exactly one IRN', bool(after.get('fbrInvoiceNumber')),
   after.get('fbrInvoiceNumber'))
s, again = api('POST', '/integrations/fbr/invoices/%s/submit' % inv['id'], tok, {})
ck('a later sequential submit is still refused', s == 400, (again.get('message') or '')[:60])

print('\n== Plan arithmetic is bounded ==')
pid = patient('overflow')
s, ovf = api('POST', '/treatment-plans', tok, {'patientId': pid, 'items': [
    {'code': 'X-%d' % U, 'name': 'Huge', 'unitPricePkr': 1073741824, 'quantity': 2}]})
ck('a plan line overflowing int4 is a 400, not a 500', s == 400, s)
s, qty = api('POST', '/treatment-plans', tok, {'patientId': pid, 'items': [
    {'code': 'Y-%d' % U, 'name': 'Many', 'unitPricePkr': 1000, 'quantity': 20000}]})
ck('the plan path enforces the same quantity cap as /invoices', s == 400, s)
s, sane = api('POST', '/treatment-plans', tok, {'patientId': pid, 'items': [
    {'code': 'Z-%d' % U, 'name': 'Normal', 'unitPricePkr': 5000, 'quantity': 2}]})
ck('an ordinary plan still works', s in (200, 201) and sane.get('totalPkr') == 10000,
   sane.get('totalPkr'))

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
