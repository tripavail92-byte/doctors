// The dispensing counter, driven the way a person drives it.
//
// This is the file that justifies the whole runner. The browser automation
// available on this machine cannot open a MUI Select — the menu is portalled and
// never receives the synthetic click — so the dispensing drug picker, the
// patient picker, and every other Select in the app were literally unreachable
// by the only end-to-end tooling there was. Under jsdom they open fine.
//
// What is asserted here is not "the page renders". It is the two things the page
// got wrong: it never sent `patientId`, so every sale in the system was
// anonymous and a recall could not trace one; and it offered no way to receive
// stock, so a clean tenant showed "No stock received yet" for ever.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PharmacyPage from './PharmacyPage';
import { apiCalls, mockApi, nestError, renderPage } from '../test/api-harness';

const FORMULARY = [
  { code: 'PARA500', name: 'Paracetamol 500mg tab', form: 'tablet', strength: '500mg', unit: 'tablet', pricePkr: 5, controlled: false },
  { code: 'TRAMADOL50', name: 'Tramadol 50mg cap', form: 'capsule', strength: '50mg', unit: 'capsule', pricePkr: 20, controlled: true },
];

const STOCK = [
  {
    formularyCode: 'PARA500', name: 'Paracetamol 500mg tab', onHand: 100, expired: 0,
    batches: [{ id: 'b1', batchNo: 'B1', expiry: '2030-01-01', quantityOnHand: 100, expired: false }],
  },
  {
    formularyCode: 'TRAMADOL50', name: 'Tramadol 50mg cap', onHand: 40, expired: 0,
    batches: [{ id: 'b2', batchNo: 'B2', expiry: '2030-01-01', quantityOnHand: 40, expired: false }],
  },
];

const PATIENTS = [
  { id: 'p-1', mrn: 'P-00001', name: 'Ayesha Khan', phone: '+92 300 1111111', gender: 'female', dob: '1990-01-01' },
];

function stubs(extra: Record<string, unknown> = {}) {
  return {
    'GET /pharmacy/formulary': { body: FORMULARY },
    'GET /pharmacy/stock': { body: STOCK },
    'GET /patients': { body: PATIENTS },
    ...extra,
  } as never;
}

/**
 * Pick an option from a MUI Select.
 *
 * By ROLE, not by label text: MUI ties the <InputLabel> to the hidden native
 * input, so getByLabelText walks past the combobox that actually opens the
 * menu. The listbox is portalled to document.body, which is why it has to be
 * looked up from `screen` even when the select itself is inside a dialog.
 *
 * `scope` matters once the receive dialog is open — there are then two
 * comboboxes named "Drug" on screen, and an unscoped query would pick whichever
 * came first in the DOM.
 */
async function pickFromSelect(name: RegExp, optionText: RegExp, scope?: HTMLElement) {
  const user = userEvent.setup();
  const q = scope ? within(scope) : screen;
  await user.click(q.getByRole('combobox', { name }));
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByText(optionText));
}

async function addToCart(drug: RegExp, qty: string) {
  const user = userEvent.setup();
  // Regex, not an exact string: a MUI Select's accessible name is the label
  // PLUS the rendered value, and an empty value renders a zero-width space —
  // so the name of an untouched "Drug" select is literally "Drug ​".
  await pickFromSelect(/Drug/, drug);
  const qtyBox = screen.getByRole('textbox', { name: /Qty/ });
  await user.clear(qtyBox);
  await user.type(qtyBox, qty);
  await user.click(screen.getByRole('button', { name: 'Add' }));
}

describe('a sale records who received it', () => {
  it('sends the selected patientId, so a recall can reach a person', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      'POST /pharmacy/dispense': { status: 201, body: { id: 'd1', receiptNumber: 'RX-2026-0001', totalPkr: 10, paymentMethod: 'CASH', items: [] } },
    }));
    renderPage(<PharmacyPage />);
    await screen.findByText('Paracetamol 500mg tab');

    await addToCart(/Paracetamol/, '2');
    await pickFromSelect(/Patient/, /Ayesha Khan/);
    await user.click(screen.getByRole('button', { name: /^Dispense/ }));

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/pharmacy/dispense');
      expect(post).toBeTruthy();
      // The whole point. The field existed on the DTO and was indexed, and this
      // page never sent it: every sale was anonymous.
      expect((post!.body as { patientId?: string }).patientId).toBe('p-1');
    });
  });

  it('says plainly that an over-the-counter sale cannot be traced', async () => {
    mockApi(stubs());
    renderPage(<PharmacyPage />);
    await screen.findByText('Paracetamol 500mg tab');
    await addToCart(/Paracetamol/, '1');

    // Not a nag — a statement of what the record will and will not contain.
    // An OTC sale is legitimate; pretending it is traceable is not.
    expect(await screen.findByText(/a recall could not trace this sale to a person/i)).toBeInTheDocument();
  });
});

describe('a controlled drug cannot leave the counter unnamed', () => {
  it('blocks the dispense button and names the drug', async () => {
    mockApi(stubs());
    renderPage(<PharmacyPage />);
    await screen.findByText('Tramadol 50mg cap');
    await addToCart(/Tramadol/, '5');

    expect(screen.getByRole('button', { name: /^Dispense/ })).toBeDisabled();
    expect(await screen.findByText(/Tramadol 50mg cap is controlled/i)).toBeInTheDocument();
  });

  it('unblocks once a patient is named', async () => {
    mockApi(stubs());
    renderPage(<PharmacyPage />);
    await screen.findByText('Tramadol 50mg cap');
    await addToCart(/Tramadol/, '5');
    await pickFromSelect(/Patient/, /Ayesha Khan/);

    await waitFor(() => expect(screen.getByRole('button', { name: /^Dispense/ })).toBeEnabled());
  });

  it('relays the server’s refusal rather than a generic one', async () => {
    const user = userEvent.setup();
    const refusal =
      'Tramadol 50mg cap is a controlled drug and cannot be dispensed without a patient. ' +
      'Select the patient receiving it, then dispense again — nothing has been taken off the shelf.';
    mockApi(stubs({ 'POST /pharmacy/dispense': { status: 400, body: nestError(400, refusal) } }));
    renderPage(<PharmacyPage />);
    await screen.findByText('Paracetamol 500mg tab');
    await addToCart(/Paracetamol/, '1');
    await user.click(screen.getByRole('button', { name: /^Dispense/ }));

    // "nothing has been taken off the shelf" is the part that stops the
    // dispenser handing over stock and clicking again.
    expect(await screen.findByText(/nothing has been taken off the shelf/i)).toBeInTheDocument();
  });
});

describe('stock can be received', () => {
  it('books in a batch with its expiry, and refuses to submit without one', async () => {
    const user = userEvent.setup();
    mockApi(stubs({ 'POST /pharmacy/stock': { status: 201, body: { id: 's1' } } }));
    renderPage(<PharmacyPage />);
    await screen.findByText('Paracetamol 500mg tab');

    await user.click(screen.getByRole('button', { name: 'Receive stock' }));
    const dialog = await screen.findByRole('dialog');
    const receive = within(dialog).getByRole('button', { name: 'Receive' });
    expect(receive).toBeDisabled();

    await pickFromSelect(/Drug/, /Paracetamol/, dialog);
    await user.type(within(dialog).getByRole('textbox', { name: /Batch no/ }), 'AB-1234');
    await user.type(within(dialog).getByRole('textbox', { name: /Quantity/ }), '50');
    await user.type(within(dialog).getByRole('textbox', { name: /Unit cost/ }), '4');

    // Everything but the expiry. A batch received without one is
    // indistinguishable from stock that never expires, and FEFO would hand it
    // out first, for ever.
    expect(receive).toBeDisabled();

    // A date input has no textbox role, so this one is found by label.
    await user.type(within(dialog).getByLabelText(/Expiry/), '2030-01-01');
    await waitFor(() => expect(receive).toBeEnabled());
    await user.click(receive);

    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/pharmacy/stock');
      expect(post!.body).toMatchObject({
        formularyCode: 'PARA500', batchNo: 'AB-1234', quantity: 50, unitCostPkr: 4,
      });
      expect((post!.body as { expiry: string }).expiry).toBe('2030-01-01');
    });
  });
});

describe('expired stock is never offered as stock', () => {
  it('leads with the pull worklist and keeps expired units out of on-hand', async () => {
    mockApi(stubs({
      'GET /pharmacy/stock': {
        body: [{
          formularyCode: 'PARA500', name: 'Paracetamol 500mg tab', onHand: 0, expired: 40,
          batches: [{ id: 'b9', batchNo: 'OLD-1', expiry: '2020-01-01', quantityOnHand: 40, expired: true }],
        }],
      },
    }));
    renderPage(<PharmacyPage />);

    expect(await screen.findByText(/expired stock to pull from the shelf/i)).toBeInTheDocument();
    // 40 units exist and none of them may be handed to anyone, so the picker
    // must offer nothing. A counter that counts expired stock is lying to the
    // person about to hand it over.
    expect(screen.getByText(/No in-date stock to dispense/i)).toBeInTheDocument();
  });
});
