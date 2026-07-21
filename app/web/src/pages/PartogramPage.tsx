// PartogramPage — the WHO Labour Care Guide chart. A time-columned grid of
// labour observations with append-only entries; cells turn red against the LCG
// thresholds (server-computed alertFlags). Surfaces the OB/GYN pack's partogram.
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
import type { EpisodeSummary, Partogram, PartogramEntry, Patient, PregnancyEpisode } from '../api/types';

interface RowSpec {
  key: string;
  label: string;
  val: (e: PartogramEntry) => string | number | null;
  red: string[];
  amber: string[];
}
const ROWS: RowSpec[] = [
  { key: 'dil', label: 'Cervical dilation (cm)', val: (e) => e.cervicalDilationCm, red: ['PROLONGED_LABOUR', 'PROLONGED_SECOND_STAGE'], amber: [] },
  { key: 'desc', label: 'Descent (fifths)', val: (e) => e.descentFifths, red: [], amber: [] },
  { key: 'fhr', label: 'FHR (bpm)', val: (e) => e.fhrBpm, red: ['FHR_ABNORMAL'], amber: [] },
  { key: 'cpm', label: 'Contractions / 10 min', val: (e) => e.contractionsPer10Min, red: [], amber: ['CONTRACTION_FREQUENCY'] },
  { key: 'dur', label: 'Duration (s)', val: (e) => e.contractionDurationSec, red: [], amber: ['CONTRACTION_DURATION'] },
  { key: 'liq', label: 'Amniotic fluid', val: (e) => e.amnioticFluid, red: ['LIQUOR_ABNORMAL'], amber: [] },
  { key: 'pulse', label: 'Maternal pulse', val: (e) => e.maternalPulse, red: [], amber: ['MATERNAL_TACHYCARDIA'] },
  { key: 'bp', label: 'BP (mmHg)', val: (e) => (e.bpSystolic != null ? `${e.bpSystolic}/${e.bpDiastolic ?? '–'}` : null), red: ['SEVERE_HTN'], amber: [] },
  { key: 'temp', label: 'Temp (°C)', val: (e) => e.temperatureC, red: ['FEVER'], amber: [] },
];

const time = (s: string) => new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const cellBg = (row: RowSpec, flags: string[]) => {
  if (row.red.some((f) => flags.includes(f))) return 'rgba(217,45,32,0.14)';
  if (row.amber.some((f) => flags.includes(f))) return 'rgba(232,89,12,0.14)';
  return undefined;
};

export default function PartogramPage() {
  const { data: patients } = useApi<Patient[]>(() => apiClient.get<Patient[]>('/patients').then((r) => r.data));
  const [patientId, setPatientId] = useState('');
  const activeId = patientId || patients?.[0]?.id || '';

  const { data: episodes } = useApi<EpisodeSummary[]>(
    () => (activeId ? apiClient.get<EpisodeSummary[]>(`/obgyn/patients/${activeId}/episodes`).then((r) => r.data) : Promise.resolve([])),
    [activeId],
  );
  const episodeId = useMemo(() => {
    const list = episodes ?? [];
    return (list.find((e) => e.status === 'ACTIVE') ?? list[0])?.id;
  }, [episodes]);

  const { data: ep, reload: reloadEp } = useApi<PregnancyEpisode | null>(
    () => (episodeId ? apiClient.get<PregnancyEpisode>(`/obgyn/episodes/${episodeId}`).then((r) => r.data) : Promise.resolve(null)),
    [episodeId],
  );
  const partogramId = useMemo(() => {
    const list = ep?.partograms ?? [];
    return (list.find((p) => p.status === 'ACTIVE') ?? list[0])?.id;
  }, [ep]);

  const { data: pg, loading, error, reload } = useApi<Partogram | null>(
    () => (partogramId ? apiClient.get<Partogram>(`/obgyn/partograms/${partogramId}`).then((r) => r.data) : Promise.resolve(null)),
    [partogramId],
  );

  const entries = pg?.entries ?? [];
  const allFlags = useMemo(() => [...new Set(entries.flatMap((e) => e.alertFlags))], [entries]);
  const canStart = ep?.status === 'ACTIVE' && !(ep.partograms ?? []).some((p) => p.status === 'ACTIVE');

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Partogram
          </Typography>
          <Typography variant="body2" color="text.secondary">
            WHO Labour Care Guide — append-only entries, alert cells vs LCG thresholds.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel id="partogram-patient-label">Patient</InputLabel>
          <Select labelId="partogram-patient-label" id="partogram-patient" label="Patient" value={activeId} onChange={(e: SelectChangeEvent) => setPatientId(e.target.value)}>
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

      {!pg && !loading && (
        canStart ? (
          <StartLabour episodeId={ep!.id} defaultParity={ep!.para} onStarted={() => reloadEp()} />
        ) : (
          <Alert severity="info">No active partogram. A partogram starts on the active pregnancy episode's labour record.</Alert>
        )
      )}

      {pg && (
        <>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Labour record
                </Typography>
                <Chip color="primary" label={`Para ${pg.parity}`} />
                <Chip variant="outlined" label={`Started ${time(pg.startedAt)}`} />
                <Chip variant="outlined" label={`Membranes: ${pg.membraneStatus}`} />
                <Chip variant={pg.status === 'ACTIVE' ? 'filled' : 'outlined'} color={pg.status === 'ACTIVE' ? 'success' : 'default'} label={pg.status} />
              </Stack>
              {allFlags.length > 0 && (
                <Stack direction="row" spacing={0.75} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                  {allFlags.map((f) => (
                    <Chip key={f} size="small" color="error" label={f.replace(/_/g, ' ')} />
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 2 }}>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 480 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>Parameter</TableCell>
                      {entries.map((e, i) => (
                        <TableCell key={e.id} align="center" sx={{ fontWeight: 700, bgcolor: i === entries.length - 1 ? 'rgba(14,124,116,0.06)' : undefined }}>
                          {time(e.recordedAt)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ROWS.map((row) => (
                      <TableRow key={row.key} hover>
                        <TableCell sx={{ fontWeight: 500, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>{row.label}</TableCell>
                        {entries.map((e) => (
                          <TableCell key={e.id} align="center" sx={{ bgcolor: cellBg(row, e.alertFlags) }}>
                            {row.val(e) ?? '—'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          </Card>

          {pg.status === 'ACTIVE' && <AddEntry partogramId={pg.id} onSaved={reload} />}
        </>
      )}
    </Box>
  );
}

function StartLabour({ episodeId, defaultParity, onStarted }: { episodeId: string; defaultParity: number; onStarted: () => void }) {
  const [dil, setDil] = useState('5');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiClient.post(`/obgyn/episodes/${episodeId}/partograms`, { parity: defaultParity, startDilationCm: Number(dil), membraneStatus: 'INTACT' });
      onStarted();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setErr(ax.response?.data?.message ?? 'Failed to start');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Start labour record
        </Typography>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField size="small" label="Dilation at start (cm)" type="number" value={dil} onChange={(e) => setDil(e.target.value)} helperText="LCG active phase starts at ≥5 cm" />
          <Button variant="contained" onClick={start} disabled={busy}>
            {busy ? 'Starting…' : 'Start'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function AddEntry({ partogramId, onSaved }: { partogramId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flags, setFlags] = useState<string[] | null>(null);
  const set = (k: string) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const num = (k: string) => (f[k] !== undefined && f[k] !== '' ? Number(f[k]) : undefined);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        cervicalDilationCm: num('cervicalDilationCm'),
        descentFifths: num('descentFifths'),
        fhrBpm: num('fhrBpm'),
        contractionsPer10Min: num('contractionsPer10Min'),
        contractionDurationSec: num('contractionDurationSec'),
        maternalPulse: num('maternalPulse'),
        bpSystolic: num('bpSystolic'),
        bpDiastolic: num('bpDiastolic'),
        temperatureC: num('temperatureC'),
        amnioticFluid: f.amnioticFluid || undefined,
      };
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
      const { data } = await apiClient.post<{ alertFlags: string[] }>(`/obgyn/partograms/${partogramId}/entries`, body);
      setFlags(data.alertFlags);
      setF({});
      onSaved();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setErr(ax.response?.data?.message ?? 'Failed to add entry');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            New entry (append-only)
          </Typography>
          <Button size="small" onClick={() => setOpen((o) => !o)}>
            {open ? 'Cancel' : '＋ Add entry'}
          </Button>
        </Stack>
        <Collapse in={open}>
          {err && <Alert severity="error" sx={{ mt: 1.5 }}>{err}</Alert>}
          <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
            <Fld label="Dilation (cm)" v={f.cervicalDilationCm} on={set('cervicalDilationCm')} />
            <Fld label="Descent (fifths)" v={f.descentFifths} on={set('descentFifths')} />
            <Fld label="FHR (bpm)" v={f.fhrBpm} on={set('fhrBpm')} />
            <Fld label="Contractions/10" v={f.contractionsPer10Min} on={set('contractionsPer10Min')} />
            <Fld label="Duration (s)" v={f.contractionDurationSec} on={set('contractionDurationSec')} />
            <Fld label="Maternal pulse" v={f.maternalPulse} on={set('maternalPulse')} />
            <Fld label="BP sys" v={f.bpSystolic} on={set('bpSystolic')} />
            <Fld label="BP dia" v={f.bpDiastolic} on={set('bpDiastolic')} />
            <Grid item xs={6} sm={3}>
              <FormControl size="small" fullWidth>
                <InputLabel id="partogram-amniotic-fluid-label">Amniotic fluid</InputLabel>
                <Select labelId="partogram-amniotic-fluid-label" id="partogram-amniotic-fluid" label="Amniotic fluid" value={f.amnioticFluid ?? ''} onChange={set('amnioticFluid') as (e: SelectChangeEvent) => void}>
                  {['', 'INTACT', 'CLEAR', 'MECONIUM', 'BLOOD_STAINED', 'ABSENT'].map((o) => (
                    <MenuItem key={o} value={o}>{o || '—'}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Button variant="contained" onClick={submit} disabled={busy}>
                {busy ? 'Saving…' : 'Save entry'}
              </Button>
              {flags && (
                <Chip sx={{ ml: 2 }} color={flags.length ? 'error' : 'success'} label={flags.length ? `Flags: ${flags.join(', ')}` : 'No alerts'} />
              )}
            </Grid>
          </Grid>
        </Collapse>
      </CardContent>
    </Card>
  );
}

function Fld({ label, v, on }: { label: string; v?: string; on: (e: { target: { value: string } }) => void }) {
  return (
    <Grid item xs={6} sm={3}>
      <TextField size="small" fullWidth label={label} type="number" value={v ?? ''} onChange={on} />
    </Grid>
  );
}
