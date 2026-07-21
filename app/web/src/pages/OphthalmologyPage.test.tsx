// The eye exam, driven per eye.
//
// Two things on this page decide what happens to a patient: which EYE a number
// belongs to, and whether an acuity was actually understood by the server.
//
// The second one is the quiet failure. logMAR is the only numeric form of visual
// acuity — it is what the VA trend is plotted from — so an entry the server could
// not convert has a null logMAR and takes no part in any later comparison. The
// page used to render that as "(logMAR )", an empty parenthesis that reads like a
// formatting slip. A clinician seeing it believes the acuity is on record and on
// the trend. It is on neither.
//
// Every logMAR and IOP band below is the server's own: 6/6 = 0.00 and 6/12 = 0.30
// come from va.engine, the 10–21 "normal" and >40 "urgent" bands from iop.engine.
// Nothing here invents a clinical number.
import { describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTheme, hexToRgb } from '@mui/material';
import OphthalmologyPage from './OphthalmologyPage';
import { apiCalls, mockApi, nestError, renderPage } from '../test/api-harness';

const PATIENTS = [
  { id: 'p-1', mrn: 'P-00001', name: 'Ayesha Khan' },
  { id: 'p-2', mrn: 'P-00002', name: 'Bilal Ahmed' },
];

const va = (id: string, laterality: string, displayValue: string, logmarValue: number | null) => ({
  id, laterality, condition: 'UNAIDED', displayValue, logmarValue,
});
const iop = (id: string, laterality: string, valueMmHg: number, alertSeverity: string) => ({
  id, laterality, valueMmHg, method: 'GAT', alertSeverity,
});

function exam(over: Record<string, unknown> = {}) {
  return {
    id: 'e-1',
    status: 'IN_PROGRESS',
    chiefComplaint: 'blurred vision',
    createdAt: '2026-07-20T09:00:00.000Z',
    signedAt: null,
    visualAcuities: [],
    iopMeasurements: [],
    ...over,
  };
}

function stubs(detail: unknown, extra: Record<string, unknown> = {}) {
  return {
    'GET /patients': { body: PATIENTS },
    'GET /ophthalmology/patients/p-1/exams': { body: [detail] },
    'GET /ophthalmology/exams/e-1': { body: detail },
    ...extra,
  } as never;
}

/** The colour a person in the room actually sees on a chip. */
function toneOf(label: HTMLElement): string {
  const root = label.closest('.MuiChip-root');
  if (!root) throw new Error(`no chip around "${label.textContent}"`);
  const cls = [...root.classList].find((c) => c.startsWith('MuiChip-color'));
  return (cls ?? 'MuiChip-colorNONE').replace('MuiChip-color', '').toLowerCase();
}

const WARNING = hexToRgb(createTheme().palette.warning.main);

/** Open the one exam in the list and return its detail card. */
async function openExam() {
  const user = userEvent.setup();
  await user.click(await screen.findByText('blurred vision'));
  const heading = await screen.findByText(/^Exam ·/);
  return heading.closest('.MuiCard-root') as HTMLElement;
}

/** The per-eye summary card. Every number below is scoped to one of these. */
function eyeCard(label: 'Right (OD)' | 'Left (OS)'): HTMLElement {
  return screen.getByText(label).closest('.MuiCard-root') as HTMLElement;
}

describe('an acuity the server could not convert', () => {
  it('says it was not converted and is out of the trend, instead of an empty "(logMAR )"', async () => {
    // "CSM" (central, steady, maintained) is a real paediatric acuity notation
    // that va.engine's parser does not understand, so it stores logMAR null.
    mockApi(stubs(exam({ visualAcuities: [va('va-1', 'RIGHT', 'CSM', null)] })));
    renderPage(<OphthalmologyPage />);
    await openExam();
    const right = eyeCard('Right (OD)');

    const note = within(right).getByText(/not converted/i);
    expect(note).toHaveTextContent(/excluded from trends/i);
    // The old rendering. "(logMAR )" beside a value is read as a display glitch,
    // and the acuity is taken as recorded and trended. It is neither.
    expect(within(right).queryByText(/logMAR/)).toBeNull();
    // Amber, not the grey the converted values use: this is a gap in the record,
    // and the person who entered it is the only one who can still fix it.
    expect(getComputedStyle(note).color).toBe(WARNING);
    // The clinician's own words survive so they can be re-entered correctly.
    expect(within(right).getByText(/CSM/)).toBeInTheDocument();
  });

  it('treats logMAR 0 as a reading, not as a missing one', async () => {
    // 6/6 is logMAR 0.00 — the commonest normal result in the clinic. A falsy
    // check here would report perfect vision as unconvertible and drop the one
    // value every later comparison is measured against.
    mockApi(stubs(exam({ visualAcuities: [va('va-1', 'RIGHT', '6/6', 0)] })));
    renderPage(<OphthalmologyPage />);
    await openExam();
    const right = eyeCard('Right (OD)');

    expect(within(right).getByText('(logMAR 0)')).toBeInTheDocument();
    expect(within(right).queryByText(/not converted/i)).toBeNull();
  });

  it('marks only the unconverted entry when both kinds sit on the same eye', async () => {
    mockApi(stubs(exam({
      visualAcuities: [va('va-1', 'RIGHT', '6/12', 0.3), va('va-2', 'RIGHT', 'sees fingers', null)],
    })));
    renderPage(<OphthalmologyPage />);
    await openExam();
    const right = eyeCard('Right (OD)');

    // One warning, not two and not none. Blanket-warning every line would make
    // the marker meaningless the first time an eye has two acuities.
    expect(within(right).getByText('(logMAR 0.3)')).toBeInTheDocument();
    expect(within(right).getAllByText(/not converted/i)).toHaveLength(1);
  });
});

describe('a number stays on the eye it was measured on', () => {
  it('files each acuity and pressure under its own eye', async () => {
    mockApi(stubs(exam({
      visualAcuities: [va('va-1', 'RIGHT', '6/6', 0), va('va-2', 'LEFT', '6/12', 0.3)],
      iopMeasurements: [iop('i-1', 'RIGHT', 44, 'urgent'), iop('i-2', 'LEFT', 15, 'normal')],
    })));
    renderPage(<OphthalmologyPage />);
    await openExam();

    const right = eyeCard('Right (OD)');
    const left = eyeCard('Left (OS)');
    expect(within(right).getByText('6/6')).toBeInTheDocument();
    expect(within(right).getByText('44 mmHg')).toBeInTheDocument();
    expect(within(left).getByText('6/12')).toBeInTheDocument();
    expect(within(left).getByText('15 mmHg')).toBeInTheDocument();
    // The consequence of getting this backwards is drops, laser or surgery on
    // the eye that did not need them.
    expect(within(right).queryByText('15 mmHg')).toBeNull();
    expect(within(left).queryByText('44 mmHg')).toBeNull();
  });

  it('colours the pressure from the server’s band, red for the urgent eye', async () => {
    // Every colour below is the band iop.engine sent, never a threshold this
    // page applied to the number beside it. The two are only distinguishable
    // where they DISAGREE, so each pair includes a pressure no client guess
    // reaches: the server's normal band ends at 21.9 and its red band starts at
    // 30, which makes 24 mmHg `soft` — and amber is a colour no ">21 is red /
    // else green" rule can produce at all.
    const show = async (right: ReturnType<typeof iop>, left: ReturnType<typeof iop>) => {
      mockApi(stubs(exam({ iopMeasurements: [right, left] })));
      renderPage(<OphthalmologyPage />);
      await openExam();
    };

    await show(iop('i-1', 'RIGHT', 44, 'urgent'), iop('i-2', 'LEFT', 24, 'soft'));
    // 44 mmHg is acute angle closure until proven otherwise — sight is lost in
    // hours. It must not share a colour with the eye beside it.
    expect(toneOf(within(eyeCard('Right (OD)')).getByText('urgent'))).toBe('error');
    // 24 mmHg is above statistical normal and belongs in a glaucoma clinic. A
    // page guessing ">21 is red" paints it the same as the 44 and the urgent eye
    // stops standing out; one guessing "under 25 is fine" paints it green and
    // the patient goes home. The chip must carry the server's own word, in the
    // server's own amber — the one answer neither guess can give.
    const os = eyeCard('Left (OS)');
    expect(toneOf(within(os).getByText('soft'))).toBe('warning');
    // And it is never relabelled into a band the server did not send.
    expect(within(os).queryByText(/normal|urgent/)).toBeNull();

    cleanup();

    await show(iop('i-3', 'RIGHT', 34, 'red'), iop('i-4', 'LEFT', 15, 'normal'));
    // The remaining two bands, so the whole mapping is the server's rather than
    // a client rule that only happens to agree at the extremes.
    expect(toneOf(within(eyeCard('Right (OD)')).getByText('red'))).toBe('error');
    expect(toneOf(within(eyeCard('Left (OS)')).getByText('normal'))).toBe('success');
  });
});

describe('recording a measurement', () => {
  it('sends the eye that was selected, not the one the form opened on', async () => {
    const user = userEvent.setup();
    mockApi(stubs(exam(), {
      'POST /ophthalmology/exams/e-1/va': { status: 201, body: { id: 'va-9' } },
      'POST /ophthalmology/exams/e-1/iop': { status: 201, body: { id: 'i-9' } },
    }));
    renderPage(<OphthalmologyPage />);
    const card = await openExam();

    // The VA row and the IOP row each have an "Eye" select; scoping to the row
    // that owns the Add button is what keeps this from driving the wrong one.
    // Both rows are exercised, and they are deliberately set to DIFFERENT eyes:
    // a row that ignored its own picker — nailed to the OD it opened on, or
    // quietly reading the other row's eye — would be invisible if only one row
    // were driven, or if the two rows always agreed.
    const rowFor = (add: 'Add VA' | 'Add IOP') =>
      within(card).getByRole('button', { name: add }).closest('.MuiStack-root') as HTMLElement;
    const pickEye = async (add: 'Add VA' | 'Add IOP', eye: 'OD' | 'OS') => {
      await user.click(within(rowFor(add)).getByRole('combobox'));
      await user.click(within(await screen.findByRole('listbox')).getByText(eye));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    };
    const lastPost = (path: 'va' | 'iop') => {
      const posts = apiCalls.filter(
        (c) => c.method === 'POST' && c.url === `/ophthalmology/exams/e-1/${path}`,
      );
      return posts[posts.length - 1]?.body;
    };

    // Round one — acuity on the LEFT eye while the pressure row still reads the
    // OD it opened on.
    await pickEye('Add VA', 'OS');
    await user.type(within(rowFor('Add VA')).getByRole('textbox', { name: /VA/ }), '6/12');
    await user.click(within(rowFor('Add VA')).getByRole('button', { name: 'Add VA' }));
    // The form defaults to OD. An eye field that ignores the picker writes
    // every left-eye acuity onto the right eye and nobody sees it happen.
    await waitFor(() =>
      expect(lastPost('va')).toMatchObject({ eye: 'OS', displayValue: '6/12', condition: 'UNAIDED' }),
    );

    await user.type(within(rowFor('Add IOP')).getByRole('textbox', { name: /IOP mmHg/ }), '15');
    await user.click(within(rowFor('Add IOP')).getByRole('button', { name: 'Add IOP' }));
    // The pressure row was left on OD while the acuity row says OS. A pressure
    // that borrowed the acuity row's eye would file this 15 on the left.
    await waitFor(() => expect(lastPost('iop')).toMatchObject({ eye: 'OD', valueMmHg: 15, method: 'GAT' }));

    // Round two — the two rows swap. Neither eye can now be a constant, and
    // neither row can be reading the other's picker.
    await pickEye('Add IOP', 'OS');
    await pickEye('Add VA', 'OD');
    await user.type(within(rowFor('Add VA')).getByRole('textbox', { name: /VA/ }), '6/6');
    await user.click(within(rowFor('Add VA')).getByRole('button', { name: 'Add VA' }));
    await waitFor(() => expect(lastPost('va')).toMatchObject({ eye: 'OD', displayValue: '6/6' }));

    await user.type(within(rowFor('Add IOP')).getByRole('textbox', { name: /IOP mmHg/ }), '44');
    await user.click(within(rowFor('Add IOP')).getByRole('button', { name: 'Add IOP' }));
    // 44 mmHg recorded against the eye it was not taken on is the same harm the
    // panel test names: drops, laser or surgery on the eye that did not need them.
    await waitFor(() => expect(lastPost('iop')).toMatchObject({ eye: 'OS', valueMmHg: 44, method: 'GAT' }));
  });

  it('re-reads the exam so the panel shows what was just added', async () => {
    const user = userEvent.setup();
    // The stored measurement is built FROM the request the page actually made,
    // so the number the panel reads back can only be the number that was sent.
    // A stub that returns a fixed 15 mmHg the moment a POST arrives proves only
    // that a re-read happened: a page that posts a different pressure — or a
    // constant — still shows a confident green "15 mmHg" on the right eye, and
    // the response gets read as evidence that the request was right.
    let stored: ReturnType<typeof iop> | null = null;
    mockApi(stubs(exam(), {
      'GET /ophthalmology/exams/e-1': () => ({
        body: exam(stored ? { iopMeasurements: [stored] } : {}),
      }),
      'POST /ophthalmology/exams/e-1/iop': (body: any) => {
        stored = iop('i-1', body.eye === 'OS' ? 'LEFT' : 'RIGHT', body.valueMmHg, body.valueMmHg > 21 ? 'urgent' : 'normal');
        return { status: 201, body: { id: 'i-1' } };
      },
    }));
    renderPage(<OphthalmologyPage />);
    const card = await openExam();

    const iopRow = within(card).getByRole('button', { name: 'Add IOP' }).closest('.MuiStack-root') as HTMLElement;
    await user.type(within(iopRow).getByRole('textbox', { name: /IOP mmHg/ }), '15');
    await user.click(within(iopRow).getByRole('button', { name: 'Add IOP' }));

    // The pressure that leaves the page is the pressure that was measured. A
    // tonometer reading that arrives at the server as some other number is a
    // glaucoma decision made on a value nobody took.
    await waitFor(() => {
      const post = apiCalls.find((c) => c.method === 'POST' && c.url === '/ophthalmology/exams/e-1/iop');
      expect(post!.body).toMatchObject({ valueMmHg: 15, method: 'GAT' });
    });
    // A panel that still says "—" after a successful save invites the same
    // pressure being taken and saved a second time.
    expect(await within(eyeCard('Right (OD)')).findByText('15 mmHg')).toBeInTheDocument();
    // And nothing else: what is on the eye is the stored measurement, not a
    // number the screen kept from the form.
    expect(within(eyeCard('Right (OD)')).queryByText(/^(?!15 mmHg$).* mmHg$/)).toBeNull();
    // And the field empties, so the next eye does not inherit this eye's number.
    await waitFor(() => expect(within(iopRow).getByRole('textbox', { name: /IOP mmHg/ })).toHaveValue(''));
  });

  it('shows the server’s refusal in the server’s words', async () => {
    const user = userEvent.setup();
    const refusal = 'IOP 85 mmHg is outside the plausible range (1..80)';
    mockApi(stubs(exam(), {
      'POST /ophthalmology/exams/e-1/iop': { status: 400, body: nestError(400, refusal) },
    }));
    renderPage(<OphthalmologyPage />);
    const card = await openExam();

    const iopRow = within(card).getByRole('button', { name: 'Add IOP' }).closest('.MuiStack-root') as HTMLElement;
    await user.type(within(iopRow).getByRole('textbox', { name: /IOP mmHg/ }), '85');
    await user.click(within(iopRow).getByRole('button', { name: 'Add IOP' }));

    // "Request failed" leads to a retry of the same impossible number. Naming
    // the range tells the person the tonometer or the typing is wrong.
    expect(await screen.findByText(/outside the plausible range/i)).toBeInTheDocument();
    expect(screen.queryByText('Request failed')).toBeNull();
  });
});

describe('a signed exam is a finalized record', () => {
  it('offers no way to add to it, and says it is locked', async () => {
    mockApi(stubs(exam({
      status: 'SIGNED',
      signedAt: '2026-07-20T10:30:00.000Z',
      iopMeasurements: [iop('i-1', 'RIGHT', 15, 'normal')],
    })));
    renderPage(<OphthalmologyPage />);
    await openExam();

    // The server refuses these anyway. Offering the controls means a clinician
    // types a finding, is told no, and has nowhere to put it — the finding ends
    // up nowhere rather than in an amendment.
    expect(screen.queryByRole('button', { name: 'Add VA' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add IOP' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign' })).toBeNull();
    expect(screen.getByText(/this exam is locked/i)).toBeInTheDocument();
    // What is already recorded stays readable.
    expect(within(eyeCard('Right (OD)')).getByText('15 mmHg')).toBeInTheDocument();
  });
});

describe('switching patient', () => {
  it('closes the open exam rather than leaving it under a new name', async () => {
    const user = userEvent.setup();
    mockApi(stubs(exam({ iopMeasurements: [iop('i-1', 'RIGHT', 44, 'urgent')] }), {
      'GET /ophthalmology/patients/p-2/exams': { body: [] },
    }));
    renderPage(<OphthalmologyPage />);
    await openExam();
    expect(screen.getByText('44 mmHg')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: /Patient/ }));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText(/Bilal Ahmed/));

    // The switch has to have HAPPENED before anything below means anything.
    // Both of the assertions that follow — no 44 mmHg, and the empty-state card
    // — are satisfied by closing the open exam alone, so a picker that closed
    // the exam but never changed patient passes them while leaving the page on
    // Ayesha. The screen looks right for the wrong reason, and the only test
    // guarding "switching patient" never notices that switching patient is dead.
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /Patient/ })).toHaveTextContent(/Bilal Ahmed/),
    );
    // And the page went and asked the server for HIS exams, so what is on
    // screen is his record rather than an emptied rendering of hers.
    await waitFor(() =>
      expect(
        apiCalls.filter((c) => c.method === 'GET' && c.url === '/ophthalmology/patients/p-2/exams'),
      ).not.toHaveLength(0),
    );

    // Ayesha's 44 mmHg still on screen with Bilal selected is how a pressure
    // gets treated on the wrong person.
    await waitFor(() => expect(screen.queryByText('44 mmHg')).toBeNull());
    expect(screen.getByText(/Start or select an exam/i)).toBeInTheDocument();
    // Her exam leaves the list as well, not just the open panel. A row still
    // carrying her complaint under his name is one click from re-opening her
    // record as his.
    expect(screen.queryByText('blurred vision')).toBeNull();
    expect(screen.getByText(/No eye exams yet/i)).toBeInTheDocument();
  });
});
