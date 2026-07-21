// One section of a patient's record — and the reason it is a component rather
// than a bit of JSX repeated eight times.
//
// A chart has a property no other screen in this app has: the reader draws
// conclusions from ABSENCE. "No allergies recorded", "no medicines dispensed",
// "no results" are all things a clinician acts on. So the one thing this must
// never do is render an empty state when the load did not succeed.
//
// That failure already happened once on Billing: a 403 rendered as
// "Rs 0 outstanding · 0 invoices · No invoices for this patient yet" for a
// patient holding a paid PKR 15,000 invoice. On a chart the equivalent is a
// clinician reading "no medicines dispensed" for a patient on warfarin.
//
// Four states, never collapsed into three:
//   loading   — we do not know yet. Say so; do not say "none".
//   gated     — this module is not in the clinic's plan. There may be data;
//               this installation simply cannot see it.
//   failed    — the request failed. There may be data. Say that explicitly.
//   empty     — the server answered, and the answer was nothing. Only this one
//               is allowed to say "none recorded".
import type { ReactNode } from 'react';
import { Alert, Box, Card, CardContent, CircularProgress, Divider, Stack, Typography } from '@mui/material';

export interface RecordSectionProps {
  title: string;
  /** What this section covers, in the words a reader needs to interpret silence. */
  subtitle?: string;
  loading: boolean;
  error: string | null;
  /** HTTP status behind `error`, where there was one. 403 is not a fault. */
  status?: number;
  count: number;
  /** Shown only when the server answered and the answer was genuinely nothing. */
  emptyText: string;
  children: ReactNode;
}

export default function RecordSection({
  title,
  subtitle,
  loading,
  error,
  status,
  count,
  emptyText,
  children,
}: RecordSectionProps) {
  return (
    <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 2.5 }}>
      <CardContent sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {!loading && !error && count > 0 && (
            <Typography variant="caption" color="text.secondary">
              {count} record{count === 1 ? '' : 's'}
            </Typography>
          )}
        </Stack>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
      <Divider />

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 2.5 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Loading — this section is not yet known to be empty.
          </Typography>
        </Box>
      )}

      {!loading && error && (
        <Box sx={{ p: 2 }}>
          <Alert severity={status === 403 ? 'info' : 'error'}>
            {status === 403 ? (
              <>
                Not included in this clinic&apos;s plan. There may be {title.toLowerCase()} for this
                patient that this installation cannot show.
              </>
            ) : (
              <>
                <strong>{title} could not be loaded.</strong> {error} — this is not the same as the
                patient having none. Do not rely on this section until it loads.
              </>
            )}
          </Alert>
        </Box>
      )}

      {!loading && !error && count === 0 && (
        <Box sx={{ px: 2, py: 2.5 }}>
          <Typography variant="body2" color="text.secondary">
            {emptyText}
          </Typography>
        </Box>
      )}

      {!loading && !error && count > 0 && <Box>{children}</Box>}
    </Card>
  );
}
