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

  // A gated feature is not a fault — it is a plan boundary, and the user should
  // stop rather than retry. Distinguishing them changes what the reader does.
  const gated = errors.filter((e) => e.status === 403);
  const failed = errors.filter((e) => e.status !== 403);

  return (
    <Box sx={{ mb: 2 }}>
      {gated.length > 0 && (
        <Alert severity="info" sx={{ mb: failed.length ? 1 : 0 }}>
          <AlertTitle>Not included in your plan</AlertTitle>
          {gated.map((e) => (
            <div key={e.key}>{e.message}</div>
          ))}
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
