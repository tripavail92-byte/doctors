// Shows every load failure currently on screen, above the page content.
//
// This exists because an empty table and a failed request looked identical.
// Reproduced: with the billing entitlement disabled, the Billing page rendered
// "Rs 0 outstanding · 0 invoices · No invoices for this patient yet" for a
// patient holding a paid PKR 15,000 invoice — a 403 presented as a financial
// fact. 19 of 21 pages ignored the error `useApi` already gave them.
//
// The banner is deliberately not dismissible while the failure persists: it
// disappears when the underlying call succeeds, and not before. A dismissible
// warning about data you are currently looking at is one click from being the
// original bug again.
import { useSyncExternalStore } from 'react';
import { Alert, AlertTitle, Box } from '@mui/material';
import { getFetchErrors, subscribeFetchErrors } from '../api/fetchErrors';

export default function FetchErrorBanner() {
  const errors = useSyncExternalStore(subscribeFetchErrors, getFetchErrors, getFetchErrors);
  if (!errors.length) return null;

  // Three groups, three different instructions to the reader. Merging any two
  // is how "you do not have permission to see reports" got reported as "your
  // clinic has not paid for reports" for every doctor who visited the page.
  //
  //   'plan'  — the clinic's edition does not include this. Talk to whoever
  //             owns the subscription. Do not retry.
  //   'role'  — the clinic HAS this, but you do not. Talk to a clinic admin.
  //             Do not retry.
  //   other   — a real failure. Retry is legitimate; empty list is not truth.
  const plan = errors.filter((e) => e.status === 403 && e.kind === 'plan');
  const role = errors.filter((e) => e.status === 403 && e.kind === 'role');
  const failed = errors.filter((e) => e.status !== 403);

  return (
    <Box sx={{ mb: 2 }}>
      {plan.length > 0 && (
        <Alert severity="info" sx={{ mb: role.length || failed.length ? 1 : 0 }}>
          <AlertTitle>Not included in this clinic's plan</AlertTitle>
          {plan.map((e) => (
            <div key={e.key}>{e.message}</div>
          ))}
        </Alert>
      )}
      {role.length > 0 && (
        <Alert severity="warning" sx={{ mb: failed.length ? 1 : 0 }}>
          <AlertTitle>You don't have permission to use this</AlertTitle>
          {role.map((e) => (
            <div key={e.key}>{e.message}</div>
          ))}
          <Box sx={{ mt: 1 }}>Ask a clinic admin if you should have access.</Box>
        </Alert>
      )}
      {failed.length > 0 && (
        <Alert severity="error">
          <AlertTitle>Some data on this page could not be loaded</AlertTitle>
          {failed.map((e) => (
            <div key={e.key}>{e.message}</div>
          ))}
          <Box sx={{ mt: 1, fontWeight: 600 }}>
            What is shown below may be incomplete — do not treat an empty list as “nothing to show”.
          </Box>
        </Alert>
      )}
    </Box>
  );
}
