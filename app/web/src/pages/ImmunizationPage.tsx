// ImmunizationPage — the EPI card and the fridge.
//
// Two screens' worth of truth in one place, because they are the same job: a
// child's card is only meaningful if the vials behind it were alive.
//
// The card shows the engine's real statuses, not a green tick. `given_invalid`
// is rendered as loudly as `overdue`, because a dose given too soon does not
// immunise and a card that says "given" for it is worse than a blank one — it
// stops anyone looking.
import { useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { apiClient } from '../api/client';
import { useApi } from '../api/useApi';

type Status =
  | 'given'
  | 'given_invalid'
  | 'due'
  | 'overdue'
  | 'upcoming'
  | 'blocked'
  | 'aged_out';

interface Row {
  vaccineCode: string;
  vaccineName: string;
  dose: string;
  ageLabel: string;
  dueDate: string;
  status: Status;
  givenAt?: string;
  lotNumber?: string | null;
  reason?: string;
  intervalDays?: number;
}

interface Summary {
  total: number;
  given: number;
  givenInvalid: number;
  due: number;
  overdue: number;
  upcoming: number;
  blocked: number;
  agedOut: number;
  mustRepeat: { vaccineCode: string; dose: string; reason?: string }[];
}

interface Batch {
  id: string;
  vaccineCode: string;
  lotNumber: string;
  expiry: string;
  vvmStage: string;
  dosesRemaining: number;
  discardedAt: string | null;
  usability: { usable: boolean; code: string; reason?: string; usePriority?: string };
}

// Colour carries the clinical weight: an invalid dose is an error, not a tick.
const STATUS: Record<Status, { label: string; color: 'default' | 'success' | 'error' | 'warning' | 'info' }> = {
  given: { label: 'given', color: 'success' },
  given_invalid: { label: 'INVALID — repeat', color: 'error' },
  due: { label: 'due', color: 'warning' },
  overdue: { label: 'overdue', color: 'error' },
  upcoming: { label: 'upcoming', color: 'default' },
  blocked: { label: 'blocked', color: 'info' },
  aged_out: { label: 'aged out', color: 'default' },
};

export default function ImmunizationPage() {
  const [patientId, setPatientId] = useState('');

  const card = useApi<{ rows: Row[]; summary: Summary } | null>(
    () =>
      patientId
        ? apiClient
            .get(`/patients/${patientId}/immunization-schedule`)
            .then((r) => {
              const d: any = r.data;
              return { rows: d.rows ?? d.schedule ?? d, summary: d.summary };
            })
        : Promise.resolve(null),
    [patientId],
  );

  const fridge = useApi<Batch[]>(
    () => apiClient.get<Batch[]>('/vaccine-batches').then((r) => r.data),
    [],
  );

  const alerts = useApi<{ pull: { lotNumber: string; vaccineCode: string; reason?: string }[] }>(
    () => apiClient.get('/vaccine-batches/alerts').then((r) => r.data),
    [],
  );

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Immunization
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        EPI card with catch-up rules, and the cold chain behind it.
      </Typography>

      {/* The fridge worklist leads: a bad vial invalidates the card. */}
      {!!alerts.data?.pull?.length && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>{alerts.data.pull.length} lot(s) must come out of the fridge</AlertTitle>
          <Stack spacing={0.5}>
            {alerts.data.pull.map((p) => (
              <Typography key={p.lotNumber} variant="body2">
                <strong>{p.vaccineCode} {p.lotNumber}</strong> — {p.reason}
              </Typography>
            ))}
          </Stack>
        </Alert>
      )}

      <TextField
        size="small"
        label="Patient ID"
        value={patientId}
        onChange={(e) => setPatientId(e.target.value.trim())}
        sx={{ mb: 3, minWidth: 380 }}
        helperText="Paste a patient id to open their EPI card."
      />

      {card.loading && patientId && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}
      {card.error && <Alert severity="error">{card.error}</Alert>}

      {card.data?.summary && (
        <>
          {/* A dose that did not count is the headline, not a footnote. */}
          {!!card.data.summary.mustRepeat.length && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <AlertTitle>
                {card.data.summary.mustRepeat.length} dose(s) do not count and must be repeated
              </AlertTitle>
              {card.data.summary.mustRepeat.map((m) => (
                <Typography key={`${m.vaccineCode}${m.dose}`} variant="body2">
                  <strong>{m.vaccineCode} dose {m.dose}</strong> — {m.reason}
                </Typography>
              ))}
            </Alert>
          )}

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {(
              [
                ['given', card.data.summary.given, 'success.main'],
                ['invalid', card.data.summary.givenInvalid, 'error.main'],
                ['overdue', card.data.summary.overdue, 'error.main'],
                ['due', card.data.summary.due, 'warning.main'],
                ['blocked', card.data.summary.blocked, 'info.main'],
                ['upcoming', card.data.summary.upcoming, 'text.secondary'],
              ] as const
            ).map(([label, n, color]) => (
              <Grid item xs={6} sm={4} md={2} key={label}>
                <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, color }}>
                      {n}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {label}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ pb: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                EPI card
              </Typography>
            </CardContent>
            <Divider sx={{ mt: 2 }} />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Vaccine</TableCell>
                  <TableCell>Dose</TableCell>
                  <TableCell>Age</TableCell>
                  <TableCell>Due</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Given</TableCell>
                  <TableCell>Note</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {card.data.rows.map((r) => (
                  <TableRow
                    key={`${r.vaccineCode}-${r.dose}`}
                    sx={r.status === 'given_invalid' ? { bgcolor: 'error.light' } : undefined}
                  >
                    <TableCell>{r.vaccineName}</TableCell>
                    <TableCell>{r.dose}</TableCell>
                    <TableCell>{r.ageLabel}</TableCell>
                    <TableCell>{r.dueDate}</TableCell>
                    <TableCell>
                      <Chip size="small" color={STATUS[r.status].color} label={STATUS[r.status].label} />
                    </TableCell>
                    <TableCell>
                      {r.givenAt ?? '—'}
                      {r.lotNumber ? ` · ${r.lotNumber}` : ''}
                    </TableCell>
                    {/* The reason is the whole value of the new engine: it says
                        why this dose is blocked/invalid, in words a nurse can act on. */}
                    <TableCell sx={{ maxWidth: 340 }}>
                      <Typography variant="caption" color="text.secondary">
                        {r.reason ?? ''}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
        <CardContent sx={{ pb: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Cold chain
          </Typography>
          <Typography variant="caption" color="text.secondary">
            A heat-damaged vial looks identical to a good one — the VVM square is the only evidence.
          </Typography>
        </CardContent>
        <Divider sx={{ mt: 2 }} />
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Vaccine</TableCell>
              <TableCell>Lot</TableCell>
              <TableCell>Expiry</TableCell>
              <TableCell>VVM</TableCell>
              <TableCell align="right">Doses</TableCell>
              <TableCell>State</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(fridge.data ?? []).slice(0, 25).map((b) => (
              <TableRow key={b.id} sx={!b.usability.usable ? { opacity: 0.55 } : undefined}>
                <TableCell>{b.vaccineCode}</TableCell>
                <TableCell>{b.lotNumber}</TableCell>
                <TableCell>{b.expiry.slice(0, 10)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={b.vvmStage.replace('STAGE_', '')}
                    color={
                      b.vvmStage === 'STAGE_1' ? 'success' : b.vvmStage === 'STAGE_2' ? 'warning' : 'error'
                    }
                  />
                </TableCell>
                <TableCell align="right">{b.dosesRemaining}</TableCell>
                <TableCell sx={{ maxWidth: 320 }}>
                  {b.usability.usable ? (
                    <Typography variant="caption" color="text.secondary">
                      {/* Stage 2 is usable but must go first, or it becomes waste. */}
                      {b.usability.usePriority ?? 'usable'}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="error.main">
                      {b.usability.reason}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!fridge.data?.length && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No vaccine stock loaded. Doses can still be recorded as history; once stock
                    exists, it is checked and consumed.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </Box>
  );
}
