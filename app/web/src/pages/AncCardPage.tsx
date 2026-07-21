// AncCardPage — the antenatal card: pregnancy header (G/P/A · GA · EDD · risk),
// a visit grid (columns = visits, rows = parameters) whose cells turn amber/red
// from the server-computed alertFlags, and an add-visit form. Surfaces the
// OB/GYN pack. Data is live from /obgyn.
import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { apiClient } from '../api/client';
import { useApi } from '../api/useApi';
import { describeError } from '../api/fetchErrors';
import type { AncVisit, EpisodeSummary, Patient, PregnancyEpisode } from '../api/types';

const SEVERE = new Set(['SEVERE_HTN', 'SEVERE_ANEMIA', 'PRE_ECLAMPSIA_SUSPECT']);
const RED_RISK = new Set(['RH_NEGATIVE', 'PLACENTA_PREVIA', 'MULTIPLE_PREGNANCY', 'PRE_ECLAMPSIA_SUSPECT', 'SEVERE_HTN', 'SEVERE_ANEMIA']);

interface RowSpec {
  key: string;
  label: string;
  val: (v: AncVisit) => string | number | null;
  red: string[];
  amber: string[];
}
const ROWS: RowSpec[] = [
  { key: 'weight', label: 'Weight (kg)', val: (v) => v.weightKg, red: [], amber: [] },
  { key: 'bp', label: 'BP (mmHg)', val: (v) => (v.bpSystolic != null ? `${v.bpSystolic}/${v.bpDiastolic ?? '–'}` : null), red: ['SEVERE_HTN'], amber: ['HTN'] },
  { key: 'sfh', label: 'SFH (cm)', val: (v) => v.fundalHeightCm, red: [], amber: ['SFH_LAG'] },
  { key: 'fhr', label: 'FHR (bpm)', val: (v) => v.fhrBpm, red: ['FHR_ABNORMAL'], amber: [] },
  { key: 'pres', label: 'Presentation', val: (v) => v.presentation, red: [], amber: ['MALPRESENTATION_LATE'] },
  { key: 'urine', label: 'Urine albumin', val: (v) => v.urineAlbumin, red: ['PRE_ECLAMPSIA_SUSPECT'], amber: ['PROTEINURIA'] },
  { key: 'hb', label: 'Hb (g/dL)', val: (v) => v.hbGdl, red: ['SEVERE_ANEMIA'], amber: ['ANEMIA'] },
  { key: 'danger', label: 'Danger signs', val: (v) => (v.dangerSigns?.length ? v.dangerSigns.join(', ') : null), red: [], amber: [] },
];

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const cellBg = (row: RowSpec, flags: string[]) => {
  if (row.red.some((f) => flags.includes(f))) return 'rgba(217,45,32,0.14)';
  if (row.amber.some((f) => flags.includes(f))) return 'rgba(232,89,12,0.14)';
  return undefined;
};

export default function AncCardPage() {
  const { data: patients } = useApi<Patient[]>(() => apiClient.get<Patient[]>('/patients').then((r) => r.data));
  const [patientId, setPatientId] = useState('');
  const activeId = patientId || patients?.[0]?.id || '';

  const { data: episodes } = useApi<EpisodeSummary[]>(
    () => (activeId ? apiClient.get<EpisodeSummary[]>(`/obgyn/patients/${activeId}/episodes`).then((r) => r.data) : Promise.resolve([])),
    [activeId],
  );
  // Prefer an active episode, else the latest.
  const episodeId = useMemo(() => {
    const list = episodes ?? [];
    return (list.find((e) => e.status === 'ACTIVE') ?? list[0])?.id;
  }, [episodes]);

  const { data: ep, loading, error, reload } = useApi<PregnancyEpisode | null>(
    () => (episodeId ? apiClient.get<PregnancyEpisode>(`/obgyn/episodes/${episodeId}`).then((r) => r.data) : Promise.resolve(null)),
    [episodeId],
  );

  const visits = ep?.ancVisits ?? [];
  const latest = visits[visits.length - 1];
  const latestSevere = latest?.alertFlags.filter((f) => SEVERE.has(f)) ?? [];
  const tt = ep?.tdSchedule ?? [];
  const ttGiven = tt.filter((r) => r.status === 'GIVEN').map((r) => r.dose);
  const ttNext = tt.find((r) => r.status === 'DUE') ?? tt.find((r) => r.status === 'UPCOMING' && r.dueDate);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            ANC card
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Antenatal visit grid with server-computed alert flags.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel>Patient</InputLabel>
          <Select label="Patient" value={activeId} onChange={(e: SelectChangeEvent) => setPatientId(e.target.value)}>
            {(patients ?? []).map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name} · {p.mrn}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      {loading && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}
      {!loading && !ep && !error && <Alert severity="info">No pregnancy episode for this patient.</Alert>}

      {ep && (
        <>
          {/* Header strip */}
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  G{ep.gravida} P{ep.para} A{ep.abortus}
                </Typography>
                <Chip label={`GA ${ep.gaNow?.label ?? '—'} wk`} color="primary" />
                <Chip variant="outlined" label={`EDD ${fmtDate(ep.eddFinal)} (${ep.eddMethod})`} />
                {ep.fetusCount > 1 && <Chip color="secondary" label={`${ep.fetusCount} fetuses`} />}
                <Chip variant="outlined" label={ep.status} />
                <Box sx={{ flexGrow: 1 }} />
                {ttGiven.length > 0 && (
                  <Chip
                    size="small"
                    color="success"
                    label={`TT${Math.max(...ttGiven)} given${ttNext ? ` · TT${ttNext.dose} ${ttNext.status.toLowerCase()}` : ''}`}
                  />
                )}
              </Stack>
              {ep.riskFlags.length > 0 && (
                <Stack direction="row" spacing={0.75} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                  {ep.riskFlags.map((f) => (
                    <Chip key={f} size="small" color={RED_RISK.has(f) ? 'error' : 'warning'} variant={RED_RISK.has(f) ? 'filled' : 'outlined'} label={f.replace(/_/g, ' ')} />
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          {latestSevere.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Latest visit ({fmtDate(latest.visitDate)}): {latestSevere.map((f) => f.replace(/_/g, ' ')).join(', ')}
              {latest.bpSystolic ? ` — BP ${latest.bpSystolic}/${latest.bpDiastolic}` : ''}. Consider the PIH order set.
            </Alert>
          )}

          {/* Visit grid */}
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 2 }}>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 480 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>Parameter</TableCell>
                      {visits.map((v, i) => (
                        <TableCell key={v.id} align="center" sx={{ fontWeight: 700, bgcolor: i === visits.length - 1 ? 'rgba(14,124,116,0.06)' : undefined }}>
                          {fmtDate(v.visitDate)}
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            GA {v.gaWeeks ?? '—'}+{v.gaDays ?? 0}{v.contactNumber ? ` · c${v.contactNumber}` : ''}
                          </Typography>
                        </TableCell>
                      ))}
                      {visits.length === 0 && <TableCell colSpan={1} sx={{ color: 'text.secondary' }}>No visits yet</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ROWS.map((row) => (
                      <TableRow key={row.key} hover>
                        <TableCell sx={{ fontWeight: 500, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>{row.label}</TableCell>
                        {visits.map((v) => {
                          const val = row.val(v);
                          return (
                            <TableCell key={v.id} align="center" sx={{ bgcolor: cellBg(row, v.alertFlags) }}>
                              {val ?? '—'}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          </Card>

          {ep.status === 'ACTIVE' && <AddVisit episodeId={ep.id} onSaved={reload} />}
        </>
      )}
    </Box>
  );
}

function AddVisit({ episodeId, onSaved }: { episodeId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ alertFlags: string[]; severe: boolean } | null>(null);
  const [writeErr, setWriteErr] = useState('');
  const set = (k: string) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  const num = (k: string) => (f[k] !== undefined && f[k] !== '' ? Number(f[k]) : undefined);
  const submit = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        weightKg: num('weightKg'),
        bpSystolic: num('bpSystolic'),
        bpDiastolic: num('bpDiastolic'),
        fundalHeightCm: num('fundalHeightCm'),
        fhrBpm: num('fhrBpm'),
        hbGdl: num('hbGdl'),
        urineAlbumin: f.urineAlbumin || undefined,
        presentation: f.presentation || undefined,
      };
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
      const { data } = await apiClient.post<{ alertFlags: string[]; severe: boolean }>(`/obgyn/episodes/${episodeId}/anc-visits`, body);
      setResult(data);
      setF({});
      onSaved();
    } catch (e) {
      // This had NO catch. A refused antenatal visit cleared nothing, said
      // nothing, and left the typed values on screen — so a visit carrying a
      // severe-hypertension BP could look recorded when the server had rejected
      // it. The form deliberately KEEPS the entered values here so the midwife
      // can correct and resubmit rather than retype from memory.
      setWriteErr(describeError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            New visit
          </Typography>
          <Button size="small" onClick={() => setOpen((o) => !o)}>
            {open ? 'Cancel' : '＋ Record visit'}
          </Button>
        </Stack>
        <Collapse in={open}>
          <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
            <Field label="Weight (kg)" onChange={set('weightKg')} value={f.weightKg} />
            <Field label="BP sys" onChange={set('bpSystolic')} value={f.bpSystolic} />
            <Field label="BP dia" onChange={set('bpDiastolic')} value={f.bpDiastolic} />
            <Field label="SFH (cm)" onChange={set('fundalHeightCm')} value={f.fundalHeightCm} />
            <Field label="FHR (bpm)" onChange={set('fhrBpm')} value={f.fhrBpm} />
            <Field label="Hb (g/dL)" onChange={set('hbGdl')} value={f.hbGdl} />
            <Grid item xs={6} sm={3}>
              <FormControl size="small" fullWidth>
                <InputLabel>Urine albumin</InputLabel>
                <Select label="Urine albumin" value={f.urineAlbumin ?? ''} onChange={set('urineAlbumin') as (e: SelectChangeEvent) => void}>
                  {['', 'NIL', 'TRACE', 'PLUS_1', 'PLUS_2', 'PLUS_3', 'PLUS_4'].map((o) => (
                    <MenuItem key={o} value={o}>{o || '—'}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl size="small" fullWidth>
                <InputLabel>Presentation</InputLabel>
                <Select label="Presentation" value={f.presentation ?? ''} onChange={set('presentation') as (e: SelectChangeEvent) => void}>
                  {['', 'CEPHALIC', 'BREECH', 'TRANSVERSE', 'OBLIQUE', 'UNSTABLE'].map((o) => (
                    <MenuItem key={o} value={o}>{o || '—'}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              {writeErr && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setWriteErr('')}>
                  {writeErr} — the visit was NOT saved. Your entries are still below.
                </Alert>
              )}
              <Button variant="contained" onClick={submit} disabled={busy}>
                {busy ? 'Saving…' : 'Save visit'}
              </Button>
              {result && (
                <Chip
                  sx={{ ml: 2 }}
                  color={result.severe ? 'error' : result.alertFlags.length ? 'warning' : 'success'}
                  label={result.alertFlags.length ? `Flags: ${result.alertFlags.join(', ')}` : 'No alerts'}
                />
              )}
            </Grid>
          </Grid>
        </Collapse>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value?: string; onChange: (e: { target: { value: string } }) => void }) {
  return (
    <Grid item xs={6} sm={3}>
      <TextField size="small" fullWidth label={label} type="number" value={value ?? ''} onChange={onChange} />
    </Grid>
  );
}
