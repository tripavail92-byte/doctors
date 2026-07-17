// CrmPage — the lead pipeline.
//
// An aesthetics clinic lives on its funnel: an Instagram enquiry becomes a
// consultation becomes a treatment. This board shows that pipeline and moves
// leads through it. The one action with weight is Convert — it mints a permanent
// Patient record — so it is a single button that the server makes idempotent (a
// lead converts exactly once, even if the button is double-clicked or two staff
// hit it at the same moment).
import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
interface Lead {
  id: string;
  name: string;
  phone: string;
  source: string | null;
  interest: string | null;
  status: LeadStatus;
  convertedPatientId: string | null;
  createdAt: string;
}
interface Funnel {
  total: number;
  byStatus: Partial<Record<LeadStatus, number>>;
  conversionRatePct: number;
}

const STAGES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];
const STATUS_COLOR: Record<LeadStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  NEW: 'default',
  CONTACTED: 'info',
  QUALIFIED: 'warning',
  CONVERTED: 'success',
  LOST: 'error',
};
// The forward moves a lead can make from each stage. CONVERTED/LOST are terminal.
const NEXT: Record<LeadStatus, LeadStatus[]> = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['LOST'],
  CONVERTED: [],
  LOST: [],
};

export default function CrmPage() {
  const [nonce, setNonce] = useState(0);
  const [filter, setFilter] = useState<'' | LeadStatus>('');
  const leads = useApi<Lead[]>(
    () => apiClient.get<Lead[]>(`/crm/leads${filter ? `?status=${filter}` : ''}`).then((r) => r.data),
    [filter, nonce],
  );
  const funnel = useApi<Funnel>(() => apiClient.get<Funnel>('/crm/funnel').then((r) => r.data), [nonce]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('');
  const [interest, setInterest] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  const call = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setErr('');
    setNote('');
    try {
      await fn();
      setNonce((n) => n + 1);
      if (ok) setNote(ok);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const funnelCells = useMemo(
    () => STAGES.map((st) => ({ st, n: funnel.data?.byStatus?.[st] ?? 0 })),
    [funnel.data],
  );

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Leads
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Marketing pipeline. Convert a qualified lead into a patient.
      </Typography>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>
          {err}
        </Alert>
      )}
      {note && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNote('')}>
          {note}
        </Alert>
      )}

      {/* Funnel: the pipeline in one row, with conversion rate. */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {funnelCells.map(({ st, n }) => (
          <Grid item xs={6} sm key={st}>
            <Card
              elevation={0}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 3, cursor: 'pointer', bgcolor: filter === st ? 'action.selected' : undefined }}
              onClick={() => setFilter(filter === st ? '' : st)}
            >
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {n}
                </Typography>
                <Chip size="small" label={st.toLowerCase()} color={STATUS_COLOR[st]} variant="outlined" />
              </CardContent>
            </Card>
          </Grid>
        ))}
        <Grid item xs={6} sm>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                {funnel.data?.conversionRatePct ?? 0}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                conversion
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* --- New lead --- */}
        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                New lead
              </Typography>
              <Stack spacing={2}>
                <TextField size="small" label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
                <TextField size="small" label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
                <TextField size="small" label="Source (e.g. Instagram)" value={source} onChange={(e) => setSource(e.target.value)} fullWidth />
                <TextField size="small" label="Interest (e.g. Botox)" value={interest} onChange={(e) => setInterest(e.target.value)} fullWidth />
                <Button
                  variant="contained"
                  disabled={!name || !phone || busy}
                  onClick={() =>
                    call(async () => {
                      await apiClient.post('/crm/leads', { name, phone, source: source || undefined, interest: interest || undefined });
                      setName('');
                      setPhone('');
                      setSource('');
                      setInterest('');
                    }, 'Lead added.')
                  }
                >
                  Add lead
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* --- Pipeline --- */}
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ pb: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Pipeline{filter ? ` — ${filter.toLowerCase()}` : ''}
                </Typography>
                {filter && (
                  <Button size="small" onClick={() => setFilter('')}>
                    Show all
                  </Button>
                )}
              </Stack>
            </CardContent>
            <Divider sx={{ mt: 2 }} />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Lead</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Move</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(leads.data ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      {l.name}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {l.phone}
                        {l.interest ? ` · ${l.interest}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {l.source ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={l.status.toLowerCase()} color={STATUS_COLOR[l.status]} variant={l.status === 'CONVERTED' ? 'filled' : 'outlined'} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        {NEXT[l.status].map((to) => (
                          <Button
                            key={to}
                            size="small"
                            color={to === 'LOST' ? 'error' : 'primary'}
                            disabled={busy}
                            onClick={() => call(() => apiClient.patch(`/crm/leads/${l.id}/status`, { status: to }))}
                          >
                            {to.toLowerCase()}
                          </Button>
                        ))}
                        {/* Convert is offered once qualified. Terminal states show
                            nothing — a converted lead is done, a lost one is closed. */}
                        {l.status === 'QUALIFIED' && (
                          <Button
                            size="small"
                            variant="contained"
                            disabled={busy}
                            onClick={() => call(() => apiClient.post(`/crm/leads/${l.id}/convert`, {}), 'Lead converted to a patient.')}
                          >
                            Convert
                          </Button>
                        )}
                        {l.status === 'CONVERTED' && (
                          <Typography variant="caption" color="success.main">
                            → patient
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!leads.data?.length && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No leads{filter ? ` in ${filter.toLowerCase()}` : ''} yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
