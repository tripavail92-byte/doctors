// The till. Every assertion here is about money that either moved or did not.
//
// The defect this file exists for: a blank Amount box was sent as `Number('')`,
// which is 0. A zero-rupee payment was written against the invoice, the ledger
// gained a row, the screen said "Payment recorded." and the balance did not
// move. The front desk read the confirmation, took the cash, and the invoice
// stayed open. The page now treats a blank box as "the whole outstanding
// balance" — the amount the placeholder has been showing all along — and
// refuses anything that is not greater than zero.
//
// The rest is the terminal moves: a void that cannot be reversed and therefore
// gets a sentence rather than a bare confirm, a refund that kills any open pay
// link, and a failed load that must not be read as "this patient owes nothing".
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BillingPage from './BillingPage';
import FetchErrorBanner from '../components/FetchErrorBanner';
import { apiCalls, mockApi, nestError, renderPage } from '../test/api-harness';

// Billing renders two tables, three selects and a dialog, and each test drives
// several round trips through them. Under load a run lands within a second of
// the 5s default, which fails as a timeout and reads as a page defect. File
// scope only — nothing shared is changed.
vi.setConfig({ testTimeout: 20000 });

// `delay: null` because every keystroke re-renders this whole page; the default
// per-key yield pushed the longer tests past the limit on its own.
const setup = () => userEvent.setup({ delay: null });

const PATIENTS = [
  { id: 'p-1', name: 'Ayesha Khan', mrn: 'P-00001' },
  { id: 'p-2', name: 'Bilal Ahmed', mrn: 'P-00002' },
];

const UNPAID = {
  id: 'i-1',
  number: 'INV-2026-0001',
  total: 25000,
  paid: 0,
  status: 'UNPAID',
  createdAt: '2026-07-01T09:00:00.000Z',
  fbrInvoiceNumber: null,
  fbrStatus: null,
  lines: [
    { id: 'l-1', code: 'CONSULT', name: 'Consultation', unitPricePkr: 5000, quantity: 1, lineTotalPkr: 5000, side: null },
    { id: 'l-2', code: 'LASER', name: 'Laser session', unitPricePkr: 20000, quantity: 1, lineTotalPkr: 20000, side: 'LEFT' },
  ],
  payments: [],
  refunds: [],
};

const SETTLED = {
  id: 'i-2',
  number: 'INV-2026-0002',
  total: 12000,
  paid: 12000,
  status: 'PAID',
  createdAt: '2026-06-01T09:00:00.000Z',
  fbrInvoiceNumber: 'IRN-77',
  fbrStatus: 'FILED',
  lines: [{ id: 'l-3', code: 'PEEL', name: 'Chemical peel', unitPricePkr: 12000, quantity: 1, lineTotalPkr: 12000, side: null }],
  payments: [{ id: 'pm-1', amount: 12000, method: 'CASH', reference: null, createdAt: '2026-06-01T10:00:00.000Z' }],
  refunds: [],
};

const VOIDED = {
  id: 'i-3',
  number: 'INV-2026-0003',
  total: 8000,
  paid: 0,
  status: 'VOID',
  createdAt: '2026-05-01T09:00:00.000Z',
  fbrInvoiceNumber: null,
  fbrStatus: null,
  lines: [{ id: 'l-4', code: 'CONSULT', name: 'Consultation', unitPricePkr: 8000, quantity: 1, lineTotalPkr: 8000, side: null }],
  payments: [],
  refunds: [],
};

const LIST = [UNPAID, SETTLED, VOIDED];

function stubs(extra: Record<string, unknown> = {}) {
  return {
    'GET /patients': { body: PATIENTS },
    'GET /patients/p-1/invoices': { body: LIST },
    'GET /invoices/i-1': { body: UNPAID },
    'GET /invoices/i-2': { body: SETTLED },
    'GET /invoices/i-3': { body: VOIDED },
    ...extra,
  } as never;
}

/**
 * Open an invoice from the list by clicking its row.
 *
 * The number is queried before the detail card exists — once it is open the
 * same string is on screen twice (list cell and detail heading).
 */
async function openInvoice(number: string) {
  const user = setup();
  await user.click(await screen.findByText(number));
  // The detail heading only appears once GET /invoices/:id has answered.
  await screen.findByRole('heading', { name: number });
}

function paymentPosts() {
  return apiCalls.filter((c) => c.method === 'POST' && c.url.endsWith('/payments'));
}

describe('taking a payment', () => {
  it('treats a blank amount as the whole outstanding balance, never as zero', async () => {
    const user = setup();
    mockApi(stubs({ 'POST /invoices/i-1/payments': { status: 201, body: { id: 'pm-9' } } }));
    renderPage(<BillingPage />);
    await openInvoice('INV-2026-0001');

    // The placeholder is the promise the box makes: leave me alone and I mean
    // all of it. It used to mean zero.
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveAttribute('placeholder', '25000');

    await user.click(screen.getByRole('button', { name: 'Record' }));

    await waitFor(() => expect(paymentPosts()).toHaveLength(1));
    const body = paymentPosts()[0].body as { amountPkr: number; method: string };
    // Rs 25,000 was handed over. Posting 0 wrote a payment row, said "Payment
    // recorded." and left the invoice UNPAID for the full amount — the cash was
    // in the drawer and the system said it was still owed.
    expect(body.amountPkr).toBe(25000);
    expect(body.amountPkr).not.toBe(0);
    expect(body.method).toBe('CASH');

    // The balance is re-read from the server rather than assumed, so what the
    // owner sees next is the invoice's actual state.
    await waitFor(() =>
      expect(apiCalls.filter((c) => c.url === '/patients/p-1/invoices')).toHaveLength(2),
    );
    expect(await screen.findByText('Payment recorded.')).toBeInTheDocument();
  });

  it('refuses a typed zero and sends nothing at all', async () => {
    const user = setup();
    mockApi(stubs({ 'POST /invoices/i-1/payments': { status: 201, body: { id: 'pm-9' } } }));
    renderPage(<BillingPage />);
    await openInvoice('INV-2026-0001');

    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '0');
    await user.click(screen.getByRole('button', { name: 'Record' }));

    // The refusal must SAY what to do. It used to arrive as "Request failed",
    // which reads as a server fault: the cashier clicks Record again, every
    // retry is refused identically, and nothing ever points at the Amount box.
    // `call` now goes through describeError, which keeps the sentence from a
    // guard the page threw itself.
    expect(await screen.findByText(/Enter a payment amount greater than zero/i)).toBeInTheDocument();
    expect(screen.queryByText(/Request failed/i)).toBeNull();
    expect(paymentPosts()).toHaveLength(0);
    expect(screen.queryByText('Payment recorded.')).toBeNull();
    // The typed amount survives, so the person can correct it rather than
    // starting again and mistyping something worse.
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveValue('0');
  });

  it('offers no payment box once the invoice is settled', async () => {
    mockApi(stubs());
    renderPage(<BillingPage />);
    await openInvoice('INV-2026-0002');

    // Nothing is owed, so there is nothing to collect. If the box were present,
    // a blank amount would now mean "pay the outstanding zero" — the original
    // bug wearing the new rule's clothes — and a typed amount would be an
    // overpayment the server has to reject.
    expect(screen.queryByText('Take a payment')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Record' })).toBeNull();
    // Money was taken, so refunding it is still on the table.
    expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
  });

  it('relays the server’s refusal instead of a generic one when the amount is too big', async () => {
    const user = setup();
    mockApi(stubs({
      'POST /invoices/i-1/payments': {
        status: 400,
        body: nestError(400, 'Amount 30000 exceeds the outstanding balance 25000'),
      },
    }));
    renderPage(<BillingPage />);
    await openInvoice('INV-2026-0001');

    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '30000');
    await user.click(screen.getByRole('button', { name: 'Record' }));

    // The numbers are the whole message. "Request failed" leaves the cashier
    // guessing whether the payment went through, and the usual guess is to
    // click again.
    expect(await screen.findByText(/exceeds the outstanding balance 25000/i)).toBeInTheDocument();
    expect(screen.queryByText('Payment recorded.')).toBeNull();
  });
});

describe('a voided invoice is terminal', () => {
  it('offers no way to take money against it, and shows no balance', async () => {
    mockApi(stubs());
    renderPage(<BillingPage />);
    await openInvoice('INV-2026-0003');

    // Not disabled buttons — absent ones. A disabled "Record" invites someone
    // to look for the reason it is disabled; an absent one ends the question.
    expect(screen.queryByRole('button', { name: 'Record' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Refund' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Void invoice' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'File with FBR' })).toBeNull();
    expect(screen.getByText(/carries no balance and cannot be paid, refunded, or filed/i)).toBeInTheDocument();

    // The headline figure reads "voided · —", not "outstanding · Rs 8,000".
    // The invoice still totals Rs 8,000, but nobody owes it; printing that
    // number under "outstanding" is how a cancelled bill gets chased.
    const summary = screen.getByText('voided').parentElement!;
    expect(within(summary).getByRole('heading', { level: 5 })).toHaveTextContent('—');
    expect(within(summary).queryByText('Rs 8,000')).toBeNull();
  });
});

describe('voiding an invoice', () => {
  it('asks first, naming the invoice and the amount, and cancelling writes nothing', async () => {
    const user = setup();
    mockApi(stubs({ 'PATCH /invoices/i-1/void': { body: { ...UNPAID, status: 'VOID' } } }));
    renderPage(<BillingPage />);
    await openInvoice('INV-2026-0001');

    await user.click(screen.getByRole('button', { name: 'Void invoice' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Void INV-2026-0001\?/)).toBeInTheDocument();
    // The sentence has to carry the consequences, because there is no undo:
    // the amount being cancelled, and that an outstanding pay link dies with it.
    expect(within(dialog).getByText(/cancels this invoice for Rs 25,000/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/any open payment link for it stops working/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(apiCalls.filter((c) => c.method === 'PATCH')).toHaveLength(0);
  });

  it('voids on confirmation and re-reads the invoice rather than assuming', async () => {
    const user = setup();
    mockApi(stubs({ 'PATCH /invoices/i-1/void': { body: { ...UNPAID, status: 'VOID' } } }));
    renderPage(<BillingPage />);
    await openInvoice('INV-2026-0001');

    await user.click(screen.getByRole('button', { name: 'Void invoice' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Void' }));

    await waitFor(() => {
      const patch = apiCalls.find((c) => c.method === 'PATCH');
      expect(patch!.url).toBe('/invoices/i-1/void');
    });
    expect(await screen.findByText('Invoice voided.')).toBeInTheDocument();
    await waitFor(() =>
      expect(apiCalls.filter((c) => c.url === '/patients/p-1/invoices')).toHaveLength(2),
    );
  });

  it('will not offer a void on an invoice that has money against it', async () => {
    mockApi(stubs());
    renderPage(<BillingPage />);
    await openInvoice('INV-2026-0002');

    // Rs 12,000 was collected. Voiding would cancel the bill and leave the cash
    // attached to nothing — the server refuses it, and the page must not walk
    // anyone up to a refusal it can see coming.
    expect(screen.queryByRole('button', { name: 'Void invoice' })).toBeNull();
    expect(screen.getByText(/refund the Rs 12,000 already paid first/i)).toBeInTheDocument();
  });
});

describe('refunding', () => {
  it('needs an explicit amount — a blank box refunds nothing', async () => {
    mockApi(stubs());
    renderPage(<BillingPage />);
    await openInvoice('INV-2026-0002');

    // The placeholder shows the full Rs 12,000 paid, but unlike the payment box
    // a blank refund must not mean "all of it". Money leaving the clinic is
    // named out loud or it does not leave.
    const amount = screen.getByRole('textbox', { name: 'Amount' });
    expect(amount).toHaveAttribute('placeholder', '12000');
    expect(screen.getByRole('button', { name: 'Refund' })).toBeDisabled();
  });

  it('refunds exactly what was typed, with the reason, and says the pay link is dead', async () => {
    const user = setup();
    mockApi(stubs({ 'POST /invoices/i-2/refunds': { status: 201, body: { id: 'rf-1' } } }));
    renderPage(<BillingPage />);
    await openInvoice('INV-2026-0002');

    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '5000');
    await user.type(screen.getByRole('textbox', { name: 'Reason' }), 'no-show');
    await user.click(screen.getByRole('button', { name: 'Refund' }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/invoices/i-2/refunds');
      // A partial refund is a partial refund. Handing back the whole Rs 12,000
      // when Rs 5,000 was agreed is money out of the door with a receipt.
      expect(post!.body).toMatchObject({ amountPkr: 5000, method: 'CASH', reason: 'no-show' });
    });

    // The patient may still be holding the old checkout link. If nobody says it
    // is dead, they pay it, and the clinic has refunded and re-collected.
    expect(await screen.findByText(/Any open pay link for this invoice is now void/i)).toBeInTheDocument();
  });

  it('refuses a typed zero, which the disabled check alone let through', async () => {
    // `disabled={busy || !refundAmt}` treats the STRING '0' as truthy, so
    // Refund was enabled and posted amountPkr: 0. The server refuses it
    // (@IsInt, @Min(1)) so no wrong money moved — but the cashier got a
    // class-validator sentence rather than a plain refusal, and the lesson
    // learned on the payment box had not been applied to money going the
    // other way.
    const user = setup();
    mockApi(stubs({ 'POST /invoices/i-2/refunds': { status: 201, body: { id: 'rf-x' } } }));
    renderPage(<BillingPage />);
    await openInvoice('INV-2026-0002');

    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '0');
    await user.click(screen.getByRole('button', { name: 'Refund' }));

    expect(await screen.findByText(/whole number of rupees greater than zero/i)).toBeInTheDocument();
    expect(apiCalls.filter((c) => c.method === 'POST' && c.url === '/invoices/i-2/refunds')).toHaveLength(0);
  });

  it('refuses a fractional amount rather than posting 5000.5', async () => {
    // numericInput deliberately preserves the decimal point so a mistyped
    // number stays wrong-looking, which means '5000.50' reaches this handler
    // intact. Rupees are whole here, and the server takes an integer.
    const user = setup();
    mockApi(stubs({ 'POST /invoices/i-2/refunds': { status: 201, body: { id: 'rf-y' } } }));
    renderPage(<BillingPage />);
    await openInvoice('INV-2026-0002');

    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '5000.50');
    await user.click(screen.getByRole('button', { name: 'Refund' }));

    expect(await screen.findByText(/whole number of rupees/i)).toBeInTheDocument();
    expect(apiCalls.filter((c) => c.method === 'POST' && c.url === '/invoices/i-2/refunds')).toHaveLength(0);
    // And it says so: a refusal that does not mention the refund leaves the
    // cashier unsure whether money left.
    expect(screen.getByText(/Nothing has been refunded/i)).toBeInTheDocument();
  });
});

describe('a failed load is not a financial fact', () => {
  // AppShell renders FetchErrorBanner directly above the routed page, so the
  // banner is part of what the reader sees. Rendering it here reproduces that.
  const withShell = () => (
    <>
      <FetchErrorBanner />
      <BillingPage />
    </>
  );

  it('says the invoices could not be loaded instead of leaving "Rs 0 · 0 invoices" standing', async () => {
    mockApi(stubs({ 'GET /patients/p-1/invoices': { status: 500, body: nestError(500, 'Internal server error') } }));
    renderPage(withShell());

    // Reproduced against the real API: a patient holding a paid PKR 15,000
    // invoice showed "Rs 0 outstanding · 0 invoices · No invoices for this
    // patient yet". Nothing on the screen distinguished a broken read from a
    // patient who owes nothing.
    expect(await screen.findByText(/Some data on this page could not be loaded/i)).toBeInTheDocument();
    expect(screen.getByText(/do not treat an empty list as/i)).toBeInTheDocument();
  });

  it('calls a gated feature a plan boundary, not a fault', async () => {
    mockApi(stubs({
      'GET /patients/p-1/invoices': { status: 403, body: nestError(403, 'Feature not enabled: billing.core') },
    }));
    renderPage(withShell());

    // Different instruction: stop and talk to whoever owns the subscription.
    // Retrying a 403 forever is the alternative.
    expect(await screen.findByText(/Not included in your plan/i)).toBeInTheDocument();
    expect(screen.getByText(/not part of your current plan/i)).toBeInTheDocument();
  });
});

describe('switching patient', () => {
  it('drops the invoice that was open, so no payment lands on the wrong bill', async () => {
    const user = setup();
    mockApi(stubs({
      'GET /patients/p-2/invoices': {
        body: [{ ...UNPAID, id: 'i-9', number: 'INV-2026-0009', total: 3000, lines: [], payments: [], refunds: [] }],
      },
    }));
    renderPage(<BillingPage />);
    await openInvoice('INV-2026-0001');

    await user.click(screen.getByRole('combobox', { name: /Patient/ }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText(/Bilal Ahmed/));

    await waitFor(() =>
      expect(apiCalls.some((c) => c.url === '/patients/p-2/invoices')).toBe(true),
    );
    // Ayesha's invoice must not stay on screen under Bilal's name with a live
    // "Record" button beside it.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'INV-2026-0001' })).toBeNull());
    expect(screen.queryByRole('button', { name: 'Record' })).toBeNull();
    expect(screen.getByText(/Select an invoice to take a payment/i)).toBeInTheDocument();
  });
});
