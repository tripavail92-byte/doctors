"""Billing — void attribution and reference-collision regressions.

Two deferred items from the billing adversarial review, both technical:

1. Voiding an invoice recorded no actor, time, or reason. A void erases a charge;
   without an actor it is an unattributable write to the money record — nobody
   could answer "who cancelled this bill, and on whose say-so?".

2. Concurrent reuse of a payment reference across two DIFFERENT invoices 500'd.
   The cross-invoice guard is a READ, so both racers passed it and both inserted;
   the loser hit the (tenantId, reference) unique index and surfaced as an
   Internal Server Error. Bad input should read as bad input either way.

Fresh patient + invoice per scenario, so nothing depends on execution order.

Run: python test/safety/billing_void_audit_suite.py
"""
import json, time, urllib.request, urllib.error, threading
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _ids import mrn  # run-unique fixtures; see _ids.py

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


def invoice(amount, tag):
    N[0] += 1
    s, p = api('POST', '/patients', tok, {'mrn': mrn('VA'), 'name': 'VoidAudit %s %d' % (tag, U),
                                          'phone': '+92 300 4545454'})
    s, inv = api('POST', '/invoices', tok, {'patientId': p['id'], 'items': [
        {'code': 'SVC-%d' % U, 'name': 'Consult', 'unitPricePkr': amount, 'quantity': 1}]})
    return inv


print('\n== A void records WHO cancelled the bill, when, and why ==')
inv = invoice(7000, 'reason')
s, v = api('PATCH', '/invoices/%s/void' % inv['id'], tok, {'reason': 'duplicate bill raised in error'})
ck('the invoice voids', v.get('status') == 'VOID', v.get('status'))
s, after = api('GET', '/invoices/%s' % inv['id'], tok)
ck('an actor is recorded (not null)', bool(after.get('voidedById')), after.get('voidedById'))
ck('a timestamp is recorded', bool(after.get('voidedAt')), after.get('voidedAt'))
ck('the reason is recorded verbatim', after.get('voidReason') == 'duplicate bill raised in error',
   after.get('voidReason'))

# The actor must be the AUTHENTICATED user, never something the caller supplies.
s, me = api('GET', '/auth/me', tok)
whoami = (me or {}).get('id') or (me or {}).get('userId')
if whoami:
    ck('the actor is the authenticated user, not caller-supplied', after.get('voidedById') == whoami,
       '%s vs %s' % (after.get('voidedById'), whoami))
else:
    ck('the actor is a real user id', bool(after.get('voidedById')), after.get('voidedById'))

print('\n== A void with no reason still records the actor ==')
inv2 = invoice(3000, 'noreason')
s, v2 = api('PATCH', '/invoices/%s/void' % inv2['id'], tok, {})
ck('voiding without a reason is allowed (policy: reason not mandatory)', v2.get('status') == 'VOID', v2.get('status'))
s, a2 = api('GET', '/invoices/%s' % inv2['id'], tok)
ck('the actor is STILL recorded', bool(a2.get('voidedById')), a2.get('voidedById'))
ck('and the reason is null, not fabricated', a2.get('voidReason') is None, a2.get('voidReason'))

# A caller must not be able to attribute a cancellation to someone else.
#
# Assert the REJECTION explicitly, not just "voidedById isn't the spoofed value".
# The weaker form passes trivially when the request is refused AND when a void
# succeeds with a null actor — two different outcomes that must not tie. The real
# defence is that the payload is rejected outright (the DTO whitelists fields),
# so the invoice must be untouched afterwards.
inv3 = invoice(2000, 'spoof')
s3, v3 = api('PATCH', '/invoices/%s/void' % inv3['id'], tok,
             {'reason': 'x', 'voidedById': '00000000-0000-0000-0000-000000000000'})
ck('a caller-supplied voidedById is REJECTED outright', s3 == 400,
   '%s %s' % (s3, json.dumps(v3.get('message'))[:70]))
s, a3 = api('GET', '/invoices/%s' % inv3['id'], tok)
ck('and the invoice is untouched — not voided by a spoofed request',
   a3.get('status') != 'VOID' and a3.get('voidedById') is None,
   '%s voidedById=%s' % (a3.get('status'), a3.get('voidedById')))

print('\n== A reused reference across invoices is a clean refusal, even in a race ==')
# Sequential control: the cross-invoice guard already returns a clean 400.
inv_a = invoice(5000, 'refA')
inv_b = invoice(5000, 'refB')
R = 'SHARED-%d' % U
s, p1 = api('POST', '/invoices/%s/payments' % inv_a['id'], tok,
            {'amountPkr': 1000, 'method': 'CASH', 'reference': R})
ck('the first payment takes the reference', s in (200, 201), s)
s, p2 = api('POST', '/invoices/%s/payments' % inv_b['id'], tok,
            {'amountPkr': 1000, 'method': 'CASH', 'reference': R})
ck('reusing it on ANOTHER invoice is refused (sequential)', s in (400, 409),
   '%s %s' % (s, (p2.get('message') or '')[:60]))

# The race: N concurrent payments on N DIFFERENT invoices sharing one reference.
# Exactly one may win; the losers must be clean refusals, never a 500.
invs = [invoice(5000, 'race%d' % i) for i in range(5)]
R2 = 'RACE-%d' % U
out = []
lk = threading.Lock()


def pay(iid):
    st, d = api('POST', '/invoices/%s/payments' % iid, tok,
                {'amountPkr': 1000, 'method': 'CASH', 'reference': R2})
    with lk:
        out.append((st, (d.get('message') or '')[:40]))


ths = [threading.Thread(target=pay, args=(i['id'],)) for i in invs]
for x in ths:
    x.start()
for x in ths:
    x.join()
codes = sorted(c for c, _ in out)
ok = len([c for c in codes if c in (200, 201)])
ck('exactly one concurrent payment wins the reference', ok == 1, 'codes=%s' % codes)
ck('every loser is a clean 4xx — NOT a 500', all(c < 500 for c in codes), 'codes=%s' % codes)
ck('and the losers name the collision', any(c in (400, 409) for c in codes), 'codes=%s' % codes)

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
