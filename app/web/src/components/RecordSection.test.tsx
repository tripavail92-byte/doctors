// The four states of a section of a patient's record, driven directly.
//
// This component exists because a chart is the one screen where the reader
// draws conclusions from ABSENCE: "no medicines dispensed" is something a
// prescriber acts on. So loading, gated, failed and empty must stay four
// distinct things. Collapsing any of them into "empty" produces a confident
// statement about a patient that nobody checked.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import RecordSection from './RecordSection';

const EMPTY = 'No medicines dispensed to this patient from this pharmacy.';

function show(props: Partial<React.ComponentProps<typeof RecordSection>>) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <RecordSection
        title="Medicines dispensed"
        loading={false}
        error={null}
        count={0}
        emptyText={EMPTY}
        {...props}
      >
        <div>ROWS</div>
      </RecordSection>
    </ThemeProvider>,
  );
}

describe('RecordSection keeps four states apart', () => {
  it('loading says it is not yet known to be empty', () => {
    show({ loading: true });
    expect(screen.getByText(/not yet known to be empty/i)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).toBeNull();
    expect(screen.queryByText('ROWS')).toBeNull();
  });

  it('a failure says so, and never says the patient has none', () => {
    show({ error: 'Internal server error', status: 500 });
    expect(screen.getByText(/this is not the same as the patient having none/i)).toBeInTheDocument();
    // The sentence a prescriber would act on must be absent.
    expect(screen.queryByText(EMPTY)).toBeNull();
  });

  it('a 403 reads as a plan boundary, not a fault and not an absence', () => {
    show({ error: 'Feature not enabled: pharmacy.core', status: 403 });
    expect(screen.getByText(/Not included in this clinic's plan/i)).toBeInTheDocument();
    expect(screen.queryByText(/could not be loaded/i)).toBeNull();
    expect(screen.queryByText(EMPTY)).toBeNull();
  });

  it('only a successful empty answer is allowed to say "none"', () => {
    show({});
    expect(screen.getByText(EMPTY)).toBeInTheDocument();
    expect(screen.queryByText(/could not be loaded/i)).toBeNull();
  });

  it('renders the rows when there are rows, and no empty text', () => {
    show({ count: 3 });
    expect(screen.getByText('ROWS')).toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).toBeNull();
    expect(screen.getByText('3 records')).toBeInTheDocument();
  });

  it('a failure with rows already counted still refuses to show them', () => {
    // A stale count from a previous patient must not resurrect content under a
    // request that failed. Same root cause as the stale-data bug in useApi.
    show({ count: 3, error: 'Internal server error', status: 500 });
    expect(screen.queryByText('ROWS')).toBeNull();
    expect(screen.getByText(/this is not the same as the patient having none/i)).toBeInTheDocument();
  });

  it('does not show a record count while loading', () => {
    show({ count: 3, loading: true });
    expect(screen.queryByText('3 records')).toBeNull();
  });
});
