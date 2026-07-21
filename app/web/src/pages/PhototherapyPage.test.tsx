// The NB-UVB ledger, driven the way a nurse drives it.
//
// Everything here is about what reaches the wire. The dose engine is server-side
// and has been hardened four times; the remaining way to hurt someone from this
// screen is to send it something it will misread. Two of those are already on
// the record: `Number('3OO')` went out as NaN and the service, seeing null,
// delivered the FULL protocol dose under a green "Delivered" message; and the
// override REASON travelled anyway, so the permanent record said a reduction was
// requested and that no override occurred, at the same time.
//
// So the assertions are mostly on `apiCalls` — not on the alert text. An alert
// that says "refused" while the POST went out is the exact failure this file
// exists to catch.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import PhototherapyPage from './PhototherapyPage';
import { apiCalls, mockApi, nestError, renderPage } from '../test/api-harness';

const COURSE_ID = 'course-1';
const COURSE_URL = `/dermatology/phototherapy/courses/${COURSE_ID}`;

// Skin type IV: start 500, ceiling 3000, +15%/session. These are the seeded
// NBUVB_STANDARD numbers from the engine, not invented ones.
const SESSIONS = [
  {
    id: 's1', sessionNo: 1, deliveredAt: '2026-06-01T09:00:00.000Z', doseMj: 500,
    cumulativeMj: 500, gapDays: null, erythemaGrade: 0, burnFlag: false, skipped: false, notes: null,
  },
  {
    id: 's2', sessionNo: 2, deliveredAt: '2026-06-04T09:00:00.000Z', doseMj: 575,
    cumulativeMj: 1075, gapDays: 3, erythemaGrade: 2, burnFlag: false, skipped: false, notes: null,
  },
  {
    id: 's3', sessionNo: 3, deliveredAt: null, doseMj: 0,
    cumulativeMj: 1075, gapDays: null, erythemaGrade: 0, burnFlag: true, skipped: true,
    notes: 'grade 3 reported at review',
  },
];

const COURSE = {
  id: COURSE_ID,
  patientId: 'pt-1',
  modality: 'NB_UVB',
  indication: 'Vitiligo',
  fitzpatrickType: 4,
  startDoseMj: 500,
  maxDoseMj: 3000,
  incrementPct: 15,
  burnHoldDoseMj: null as number | null,
  status: 'ACTIVE',
  sessions: SESSIONS,
  cumulativeMj: 1075,
  lifetimeMj: 84250,
  sessionsDelivered: 2,
  cumulativeWarning: null as string | null,
};

// Decisions shaped exactly as the engine emits them, so the page is tested
// against the server's own wording rather than a paraphrase.
const ESCALATE = {
  suggestedMj: 575,
  action: 'ESCALATE',
  ruleFired: 'no_erythema_step',
  rationale: 'Suggested 575 mJ/cm2: no erythema permits +15% from 500 mJ/cm2.',
  skip: false, burnFlag: false, capped: false,
};
const HOLD = {
  suggestedMj: 500,
  action: 'HOLD',
  ruleFired: 'erythema_grade2_hold',
  rationale: 'Suggested 500 mJ/cm2: erythema persisting 24-48h (grade 2) holds at 500 mJ/cm2.',
  skip: false, burnFlag: false, capped: false,
};
const SKIP_BURN = {
  suggestedMj: 250,
  action: 'SKIP_BURN',
  ruleFired: 'erythema_grade3_skip_burn',
  rationale:
    'Do not treat: Suggested 250 mJ/cm2: persistent erythema/blistering (grade 3) after ' +
    '500 mJ/cm2 requires -50% before treatment resumes. Notify the prescriber.',
  skip: true, burnFlag: true, capped: false,
};

function stubs(extra: Record<string, unknown> = {}, course: Partial<typeof COURSE> = {}) {
  return {
    [`GET ${COURSE_URL}`]: { body: { ...COURSE, ...course } },
    [`GET ${COURSE_URL}/next-dose?lastErythemaGrade=0`]: { body: ESCALATE },
    [`GET ${COURSE_URL}/next-dose?lastErythemaGrade=2`]: { body: HOLD },
    [`GET ${COURSE_URL}/next-dose?lastErythemaGrade=3`]: { body: SKIP_BURN },
    ...extra,
  } as never;
}

/**
 * Open a ledger. Pasted rather than typed: the course id field refetches on
 * every keystroke, and a typed id would fire a GET per prefix and drown the
 * call log this file asserts on.
 */
async function openCourse(user: UserEvent) {
  await user.click(screen.getByRole('textbox', { name: /Course ID/ }));
  await user.paste(COURSE_ID);
  await screen.findByText('Ledger');
}

/** Grade select: by ROLE with a regex — the accessible name is label + value. */
async function pickGrade(user: UserEvent, option: RegExp) {
  await user.click(screen.getByRole('combobox', { name: /Erythema/ }));
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByText(option));
}

const doseField = () => screen.getByRole('textbox', { name: /Dose/ });
const reasonField = () => screen.getByRole('textbox', { name: /Override reason/ });
const recordButton = () => screen.getByRole('button', { name: /Record (session|hold)/ });

/**
 * Type over a field's whole contents.
 *
 * `clear()` is useless on the dose box: it is controlled, and an empty
 * `overrideDose` falls back to displaying the server's suggestion, so the value
 * springs straight back. A triple click selects the line and the next keystroke
 * replaces it — which is what a clinician actually does to a pre-filled number.
 */
async function retype(user: UserEvent, el: HTMLElement, text: string) {
  await user.tripleClick(el);
  await user.keyboard(text);
}

/** Pasted, not typed: this page re-renders a whole ledger on every keystroke. */
async function pasteInto(user: UserEvent, el: HTMLElement, text: string) {
  await user.click(el);
  await user.paste(text);
}

const posts = () => apiCalls.filter((c) => c.method === 'POST');

// This suite drives a page that rebuilds a table on every render, and CI runs it
// alongside other suites. The waits are about machine load, not about behaviour:
// nothing here is asserting how FAST the page is.
const SLOW = { timeout: 8000 };
const TEST_TIMEOUT = 30_000;
const untilDose = (v: string) => waitFor(() => expect(doseField()).toHaveValue(v), SLOW);

describe('the dose is not offered before the reaction is recorded', () => {
  it('leaves the dose blank and the form locked until a grade is chosen', async () => {
    const user = userEvent.setup();
    mockApi(stubs());
    renderPage(<PhototherapyPage />);
    await openCourse(user);

    // The engine refuses to suggest a dose without the reaction to the last
    // session; a form that shows a number first teaches the clinician that the
    // grade is paperwork. It is the input that decides whether this dose may
    // escalate onto skin that reacted.
    expect(doseField()).toBeDisabled();
    expect(doseField()).toHaveValue('');
    expect(screen.getByText('record the grade first')).toBeInTheDocument();
    expect(recordButton()).toBeDisabled();
    expect(apiCalls.filter((c) => c.url.includes('next-dose'))).toHaveLength(0);
  }, TEST_TIMEOUT);

  it('asks the engine with the grade and shows the number with its reasoning', async () => {
    const user = userEvent.setup();
    mockApi(stubs());
    renderPage(<PhototherapyPage />);
    await openCourse(user);
    await pickGrade(user, /persisting/); // grade 2

    await untilDose('500');
    expect(apiCalls.map((c) => c.url)).toContain(
      `${COURSE_URL}/next-dose?lastErythemaGrade=2`,
    );
    // The action alone is a number with no reason attached, and a number with no
    // reason is what trains someone to click past it. A grade-2 HOLD looks
    // identical to a normal visit unless the screen says why it held.
    expect(screen.getByText('HOLD')).toBeInTheDocument();
    expect(
      screen.getByText(/erythema persisting 24-48h \(grade 2\) holds at 500 mJ\/cm2/),
    ).toBeInTheDocument();
    expect(screen.getByText('server-suggested')).toBeInTheDocument();
  }, TEST_TIMEOUT);

  it('treats "no erythema" as the answer 0, not as a blank', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      [`POST ${COURSE_URL}/sessions`]: { status: 201, body: { held: false, session: { doseMj: 575 } } },
    }));
    renderPage(<PhototherapyPage />);
    await openCourse(user);
    await pickGrade(user, /none/); // grade 0
    await untilDose('575');

    await user.click(recordButton());

    // 0 is falsy, and every truthiness shortcut on this value drops it. The
    // stored sentinel for "nobody assessed the reaction" is also 0, so a
    // dropped grade is not a blank field — it is an assessment the server
    // cannot distinguish from one that never happened.
    await waitFor(() => expect(posts()).toHaveLength(1), SLOW);
    expect(posts()[0].body).toEqual({ lastErythemaGrade: 0 });
  }, TEST_TIMEOUT);
});

describe('a dose the machine cannot read stops the session', () => {
  it.each(['3OO', '1.2.3'])('refuses "%s" and sends nothing at all', async (typed) => {
    const user = userEvent.setup();
    mockApi(stubs({
      [`POST ${COURSE_URL}/sessions`]: { status: 201, body: { held: false, session: { doseMj: 575 } } },
    }));
    renderPage(<PhototherapyPage />);
    await openCourse(user);
    await pickGrade(user, /none/);
    await untilDose('575');

    await retype(user, doseField(), typed);
    await user.click(recordButton());

    expect(await screen.findByText(/Nothing was recorded/)).toBeInTheDocument();
    // The whole point. `Number('3OO')` is NaN, JSON.stringify writes NaN as
    // null, @IsOptional() accepts null, and the service then delivered the full
    // protocol 575 where 300 was intended — under a green "Delivered".
    expect(posts()).toHaveLength(0);
    expect(screen.queryByText(/Delivered/)).toBeNull();
  }, TEST_TIMEOUT);

  it('does not unlock the reason box for an unreadable dose', async () => {
    const user = userEvent.setup();
    mockApi(stubs());
    renderPage(<PhototherapyPage />);
    await openCourse(user);
    await pickGrade(user, /none/);
    await untilDose('575');

    expect(reasonField()).toBeDisabled(); // suggestion untouched — nothing to justify
    await retype(user, doseField(), '3OO');

    // NaN !== 575 is true, so a naive comparison un-disabled this field and the
    // form looked like it had accepted a downward override. The clinician types
    // a justification, clicks record, and believes 300 was given.
    await waitFor(() => expect(reasonField()).toBeDisabled(), SLOW);
  }, TEST_TIMEOUT);
});

describe('the record never claims an override that did not happen', () => {
  it('sends a real override as a number, with its reason', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      [`POST ${COURSE_URL}/sessions`]: { status: 201, body: { held: false, session: { doseMj: 300 } } },
    }));
    renderPage(<PhototherapyPage />);
    await openCourse(user);
    await pickGrade(user, /none/);
    await untilDose('575');

    await retype(user, doseField(), '300');
    await waitFor(() => expect(reasonField()).toBeEnabled(), SLOW);
    await pasteInto(user, reasonField(), 'Reduce for reported tenderness');
    await user.click(recordButton());

    await waitFor(() => expect(posts()).toHaveLength(1), SLOW);
    const body = posts()[0].body as Record<string, unknown>;
    expect(body).toEqual({
      lastErythemaGrade: 0,
      overrideDoseMj: 300,
      overrideReason: 'Reduce for reported tenderness',
    });
    // A string here is not harmless: the backend's validation pipe coerces
    // before it validates, so the type of what leaves this page is the last
    // place the difference is visible.
    expect(typeof body.overrideDoseMj).toBe('number');
  }, TEST_TIMEOUT);

  it('drops the reason when the override it justified is withdrawn', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      [`POST ${COURSE_URL}/sessions`]: { status: 201, body: { held: false, session: { doseMj: 575 } } },
    }));
    renderPage(<PhototherapyPage />);
    await openCourse(user);
    await pickGrade(user, /none/);
    await untilDose('575');

    await retype(user, doseField(), '300');
    await waitFor(() => expect(reasonField()).toBeEnabled(), SLOW);
    await pasteInto(user, reasonField(), 'Reduce for reported tenderness');

    // Second thoughts: the reduction is taken back and the server's suggestion
    // stands. The reason text stays in the box, disabled.
    await user.clear(doseField());
    await untilDose('575');
    expect(reasonField()).toHaveValue('Reduce for reported tenderness');

    await user.click(recordButton());

    await waitFor(() => expect(posts()).toHaveLength(1), SLOW);
    // The full protocol dose was given. A ledger line reading "reduced for
    // reported tenderness" against it is a record a prescriber would later be
    // asked to stand behind, describing a reduction nobody made. The server
    // refuses this too — the page must not even ask.
    expect(posts()[0].body).toEqual({ lastErythemaGrade: 0 });
  }, TEST_TIMEOUT);
});

describe('a refused session leaves no trace and no confusion', () => {
  it('shows the server’s sentence, keeps the typed dose, and does not reload the ledger', async () => {
    const user = userEvent.setup();
    const refusal =
      'Dose 4000 exceeds the ceiling of 3000 mJ/cm2 for this course. ' +
      'The ceiling cannot be overridden.';
    mockApi(stubs({
      [`POST ${COURSE_URL}/sessions`]: { status: 400, body: nestError(400, refusal) },
    }));
    renderPage(<PhototherapyPage />);
    await openCourse(user);
    await pickGrade(user, /none/);
    await untilDose('575');

    await retype(user, doseField(), '4000');
    await waitFor(() => expect(reasonField()).toBeEnabled(), SLOW);
    await pasteInto(user, reasonField(), 'Prescriber asked for a bigger step');
    await user.click(recordButton());

    expect(await screen.findByText(/exceeds the ceiling of 3000/)).toBeInTheDocument();
    expect(screen.queryByText(/Delivered/)).toBeNull();
    // Nothing was recorded, so nothing may be cleared: a form that resets after
    // a refusal reads as success, and the clinician retypes and re-submits.
    expect(doseField()).toHaveValue('4000');
    expect(reasonField()).toHaveValue('Prescriber asked for a bigger step');
    // One GET — the initial open. A reload here would mean the page believes a
    // row was written.
    expect(apiCalls.filter((c) => c.url === COURSE_URL)).toHaveLength(1);
  }, TEST_TIMEOUT);
});

describe('a burn hold is reported as a hold', () => {
  it('says HELD rather than "Delivered 0", and reloads the ledger', async () => {
    const user = userEvent.setup();
    mockApi(stubs({
      [`POST ${COURSE_URL}/sessions`]: {
        status: 201,
        body: { held: true, session: { sessionNo: 4, doseMj: 0, skipped: true } },
      },
    }));
    renderPage(<PhototherapyPage />);
    await openCourse(user);
    await pickGrade(user, /blistering/); // grade 3

    // The button itself must stop saying "Record session": what is about to be
    // written is a refusal to treat, not a treatment.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Record hold' })).toBeEnabled(), SLOW);
    await user.click(screen.getByRole('button', { name: 'Record hold' }));

    expect(await screen.findByText(/Session HELD and recorded. Notify the prescriber./))
      .toBeInTheDocument();
    // `session.doseMj` is 0 on a held row, so the success wording would render
    // "Delivered 0 mJ/cm²" — a burn reported as a normal visit that happened to
    // give nothing.
    expect(screen.queryByText(/^Delivered/)).toBeNull();
    // The held row has to appear in the ledger, or the next visit cannot see it.
    await waitFor(() => expect(apiCalls.filter((c) => c.url === COURSE_URL)).toHaveLength(2), SLOW);
  }, TEST_TIMEOUT);

  it('names the dose that will clear an unresolved burn', async () => {
    const user = userEvent.setup();
    mockApi(stubs({}, { burnHoldDoseMj: 600 }));
    renderPage(<PhototherapyPage />);
    await openCourse(user);

    expect(screen.getByText(/Unresolved grade-3 burn at 600 mJ\/cm²/)).toBeInTheDocument();
    // The banner is useless without the number that lifts it — otherwise the
    // interlock reads as a permanent block and someone overrides it to get on
    // with the list.
    expect(
      screen.getByText(/session is delivered at or below 300 mJ\/cm²/),
    ).toBeInTheDocument();
  }, TEST_TIMEOUT);
});

describe('the ledger', () => {
  it('never renders the "not assessed" sentinel as a reaction of none', async () => {
    const user = userEvent.setup();
    mockApi(stubs());
    renderPage(<PhototherapyPage />);
    await openCourse(user);

    // 0 is the stored sentinel for "nobody looked", not "no erythema". Printing
    // it as "grade 0" tells the next clinician the last dose was tolerated, and
    // that is the input the engine escalates on.
    expect(screen.queryByText(/grade 0/)).toBeNull();

    const rows = screen.getAllByRole('row');
    expect(within(rows[2]).getByText('grade 2')).toBeInTheDocument();

    // The held row: no reaction of its own, no dose, and it must read as a burn
    // hold rather than as a session that delivered nothing.
    const cells = within(rows[3]).getAllByRole('cell');
    expect(within(cells[1]).getByText('held')).toBeInTheDocument(); // date column
    expect(cells[2]).toHaveTextContent('—'); // dose column: no UV was given
    expect(within(cells[5]).getByText('burn hold')).toBeInTheDocument(); // erythema column
  }, TEST_TIMEOUT);

  it('states the skin type and keeps this course’s total apart from the lifetime', async () => {
    const user = userEvent.setup();
    mockApi(stubs());
    renderPage(<PhototherapyPage />);
    await openCourse(user);

    // Skin type drives the start dose and the ceiling. A repeat()/slice() trick
    // once rendered type IV as "III" — a wrong safety label the clinician has
    // no other way to notice.
    expect(screen.getByText('Fitzpatrick IV')).toBeInTheDocument();
    expect(screen.getByText('ceiling 3000')).toBeInTheDocument();
    expect(screen.getByText('start 500')).toBeInTheDocument();

    // Cumulative-this-course and lifetime-across-all-courses are different
    // numbers and the counselling threshold is on the lifetime one. Swapping
    // them understates total UV load by two orders of magnitude here.
    expect(screen.getByText(/^1[,.\s]?075 mJ\/cm²$/)).toBeInTheDocument();
    expect(screen.getByText(/lifetime 84[,.\s]?250 across all courses/)).toBeInTheDocument();
  }, TEST_TIMEOUT);
});
