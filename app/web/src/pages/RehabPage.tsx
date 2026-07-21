// RehabPage — an episode of physiotherapy care.
//
// Two things carry clinical weight and both are on this page. Range-of-motion is
// recorded against a normal reference and deficit-banded (none/amber/red), so a
// loss is seen, not buried in degrees. And a treatment modality is checked
// against the patient's safety intake before it is applied: electrotherapy on a
// pacemaker, heat over a malignancy — those are hard stops the server refuses,
// overridable only by a senior with a recorded reason. The page surfaces that
// block and the override path rather than hiding a dead button.
import { useMemo, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { apiClient } from '../api/client';
import { useApi, numericInput } from '../api/useApi';

interface Patient {
  id: string;
  name: string;
  mrn: string;
}
interface Rom {
  id: string;
  joint: string;
  movement: string;
  laterality: string | null;
  activeDegrees: number | null;
  normalDegrees: number;
  deficitPct: number | null;
  deficitBand: string | null;
}
interface Assessment {
  id: string;
  rom: Rom[];
}
interface Session {
  id: string;
  sessionNumber: number;
  modalities: string[];
  painPre: number | null;
  painPost: number | null;
  safetyNotes: { override?: boolean; overrideReason?: string | null } | null;
}
interface Episode {
  id: string;
  diagnosis: string;
  bodyRegion: string;
  status: 'ACTIVE' | 'DISCHARGED' | 'ON_HOLD';
  safetyIntake: Record<string, boolean> | null;
  assessments: Assessment[];
  sessions: Session[];
}
interface RomRef {
  joint: string;
  movement: string;
  normalDegrees: number;
  maxDegrees: number;
}

const INTAKE = ['pacemaker', 'pregnant', 'metalImplant', 'impairedSensation', 'malignancy', 'dvtHistory'];
const MODALITIES = ['TENS', 'IFT', 'NMES', 'US', 'HOT_PACK', 'LASER', 'EXERCISE', 'MANUAL_THERAPY', 'MASSAGE', 'TRACTION'];
const BAND_COLOR: Record<string, 'success' | 'warning' | 'error'> = { none: 'success', amber: 'warning', red: 'error' };
const cap = (s: string) => s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();

export default function RehabPage() {
  const { data: patients } = useApi<Patient[]>(() => apiClient.get<Patient[]>('/patients').then((r) => r.data));
  const { data: romRefs } = useApi<RomRef[]>(() => apiClient.get<RomRef[]>('/rehab/rom-reference').then((r) => r.data));
  const [patientId, setPatientId] = useState('');
  const active = patientId || patients?.[0]?.id || '';
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [nonce, setNonce] = useState(0);

  const episodes = useApi<Episode[]>(
    () => (active ? apiClient.get<Episode[]>(`/rehab/patients/${active}/episodes`).then((r) => r.data) : Promise.resolve([])),
    [active, nonce],
  );
  const open = useApi<Episode | null>(
    () => (openId ? apiClient.get<Episode>(`/rehab/episodes/${openId}`).then((r) => r.data) : Promise.resolve(null)),
    [openId, nonce],
  );

  // New episode.
  const [diagnosis, setDiagnosis] = useState('');
  const [region, setRegion] = useState('');
  const [intake, setIntake] = useState<Record<string, boolean>>({});
  // ROM entry.
  const [romKey, setRomKey] = useState('');
  const [romDeg, setRomDeg] = useState('');
  // Session entry.
  const [mods, setMods] = useState<string[]>([]);
  const [painPre, setPainPre] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [blockMsg, setBlockMsg] = useState('');

  const call = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      setNonce((n) => n + 1);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const inv = open.data;
  const discharged = inv?.status !== 'ACTIVE';
  const romOptions = useMemo(() => (romRefs ?? []).map((r) => ({ key: `${r.joint}|${r.movement}`, label: `${cap(r.joint)} ${cap(r.movement)} (nl ${r.normalDegrees}°)` })), [romRefs]);
  const allRom = useMemo(() => (inv?.assessments ?? []).flatMap((a) => a.rom), [inv]);

  // Record a session; on a BLOCK the server 400s and we surface an override box.
  const recordSession = async (override: boolean) => {
    setBusy(true);
    setErr('');
    setBlockMsg('');
    try {
      const body: any = { modalities: mods, painPre: painPre ? Number(painPre) : undefined };
      if (override) {
        body.overrideBlock = true;
        body.overrideReason = overrideReason;
      }
      await apiClient.post(`/rehab/episodes/${inv!.id}/sessions`, body);
      setMods([]);
      setPainPre('');
      setOverrideReason('');
      setNonce((n) => n + 1);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Request failed';
      // A contraindication comes back as a 400 naming it — keep it visible and
      // switch the form into override mode rather than just flashing an error.
      if (/contraindicat|override/i.test(msg)) setBlockMsg(msg);
      else setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Physiotherapy
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Episodes of care — ROM deficit banding and safety-gated modalities.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel id="rehab-patient-label">Patient</InputLabel>
          <Select labelId="rehab-patient-label" id="rehab-patient" label="Patient" value={active} onChange={(e: SelectChangeEvent) => { setPatientId(e.target.value); setOpenId(null); }}>
            {(patients ?? []).map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name} · {p.mrn}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>
      )}

      <Grid container spacing={3}>
        {/* --- Episodes + new --- */}
        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ pb: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Episodes</Typography>
            </CardContent>
            <Divider sx={{ mt: 2 }} />
            <Table size="small">
              <TableBody>
                {(episodes.data ?? []).map((e) => (
                  <TableRow key={e.id} hover selected={e.id === openId} sx={{ cursor: 'pointer' }} onClick={() => setOpenId(e.id)}>
                    <TableCell>
                      {e.diagnosis}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{cap(e.bodyRegion)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={e.status.toLowerCase()} color={e.status === 'ACTIVE' ? 'info' : 'default'} variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
                {!episodes.data?.length && (
                  <TableRow><TableCell><Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>No episodes yet.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>New episode</Typography>
              <Stack spacing={2}>
                <TextField size="small" label="Diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} fullWidth />
                <TextField size="small" label="Body region (e.g. knee, lumbar)" value={region} onChange={(e) => setRegion(e.target.value)} fullWidth />
                <Box>
                  <Typography variant="caption" color="text.secondary">Safety intake</Typography>
                  <FormGroup>
                    {INTAKE.map((k) => (
                      <FormControlLabel
                        key={k}
                        control={<Checkbox size="small" checked={!!intake[k]} onChange={(e) => setIntake((i) => ({ ...i, [k]: e.target.checked }))} />}
                        label={<Typography variant="body2">{cap(k)}</Typography>}
                      />
                    ))}
                  </FormGroup>
                </Box>
                <Button
                  variant="contained"
                  disabled={!diagnosis || !region || !active || busy}
                  onClick={() =>
                    call(async () => {
                      const r = await apiClient.post<Episode>('/rehab/episodes', {
                        patientId: active, diagnosis, bodyRegion: region,
                        safetyIntake: Object.fromEntries(Object.entries(intake).filter(([, v]) => v)),
                      });
                      setDiagnosis(''); setRegion(''); setIntake({}); setOpenId(r.data.id);
                    })
                  }
                >
                  Start episode
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* --- Open episode --- */}
        <Grid item xs={12} md={8}>
          {inv && (
            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{inv.diagnosis}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }} alignItems="center">
                      <Chip size="small" label={inv.status.toLowerCase()} color={inv.status === 'ACTIVE' ? 'info' : 'default'} />
                      {Object.entries(inv.safetyIntake ?? {}).filter(([, v]) => v).map(([k]) => (
                        <Chip key={k} size="small" color="warning" variant="outlined" label={cap(k)} />
                      ))}
                    </Stack>
                  </Box>
                  {!discharged && (
                    <Button size="small" disabled={busy} onClick={() => call(() => apiClient.patch(`/rehab/episodes/${inv.id}/discharge`, { status: 'DISCHARGED' }))}>
                      Discharge
                    </Button>
                  )}
                </Stack>

                {/* ROM table */}
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Range of motion</Typography>
                {allRom.length > 0 && (
                  <Table size="small" sx={{ mb: 1 }}>
                    <TableBody>
                      {allRom.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell sx={{ border: 0, py: 0.25 }}>{cap(r.joint)} {cap(r.movement)}{r.laterality ? ` (${r.laterality.toLowerCase()})` : ''}</TableCell>
                          <TableCell align="right" sx={{ border: 0, py: 0.25 }}>{r.activeDegrees}° / {r.normalDegrees}°</TableCell>
                          <TableCell sx={{ border: 0, py: 0.25 }}>
                            {r.deficitBand && <Chip size="small" label={`${r.deficitPct}% ${r.deficitBand}`} color={BAND_COLOR[r.deficitBand] ?? 'default'} variant={r.deficitBand === 'none' ? 'outlined' : 'filled'} />}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {!discharged && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FormControl size="small" sx={{ minWidth: 220 }}>
                      <InputLabel id="rehab-joint-movement-label">Joint / movement</InputLabel>
                      <Select labelId="rehab-joint-movement-label" id="rehab-joint-movement" label="Joint / movement" value={romKey} onChange={(e) => setRomKey(e.target.value)}>
                        {romOptions.map((o) => (<MenuItem key={o.key} value={o.key}>{o.label}</MenuItem>))}
                      </Select>
                    </FormControl>
                    <TextField size="small" label="Active °" value={romDeg} onChange={(e) => setRomDeg(numericInput(e.target.value))} sx={{ width: 90 }} />
                    <Button
                      size="small"
                      disabled={busy || !romKey || !romDeg}
                      onClick={() =>
                        call(async () => {
                          const [joint, movement] = romKey.split('|');
                          let aid = inv.assessments[0]?.id;
                          if (!aid) aid = (await apiClient.post<Assessment>(`/rehab/episodes/${inv.id}/assessments`, {})).data.id;
                          await apiClient.post(`/rehab/assessments/${aid}/rom`, { joint, movement, activeDegrees: Number(romDeg) });
                          setRomKey(''); setRomDeg('');
                        })
                      }
                    >
                      Add ROM
                    </Button>
                  </Stack>
                )}

                {/* Sessions + safety-gated modality entry */}
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Treatment sessions</Typography>
                {(inv.sessions ?? []).map((s) => (
                  <Stack key={s.id} direction="row" justifyContent="space-between" sx={{ py: 0.25 }}>
                    <Typography variant="body2">
                      #{s.sessionNumber} · {s.modalities.join(', ')}
                      {s.safetyNotes?.override && <Chip size="small" color="warning" variant="outlined" label="override" sx={{ ml: 1 }} />}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.painPre != null ? `pain ${s.painPre}${s.painPost != null ? `→${s.painPost}` : ''}` : ''}
                    </Typography>
                  </Stack>
                ))}

                {!discharged && (
                  <Box sx={{ mt: 1.5 }}>
                    <FormControl size="small" fullWidth sx={{ mb: 1 }}>
                      <InputLabel id="rehab-modalities-label">Modalities</InputLabel>
                      <Select
                        multiple
                        labelId="rehab-modalities-label"
                        id="rehab-modalities"
                        label="Modalities"
                        value={mods}
                        onChange={(e) => setMods(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                        renderValue={(v) => (v as string[]).join(', ')}
                      >
                        {MODALITIES.map((m) => (<MenuItem key={m} value={m}>{m}</MenuItem>))}
                      </Select>
                    </FormControl>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField size="small" label="Pain (0-10)" value={painPre} onChange={(e) => setPainPre(numericInput(e.target.value))} sx={{ width: 110 }} />
                      <Button variant="contained" size="small" disabled={busy || !mods.length} onClick={() => recordSession(false)}>
                        Record session
                      </Button>
                    </Stack>

                    {/* The interlock, made visible: a contraindication and the
                        senior-override path with a mandatory reason. */}
                    {blockMsg && (
                      <Alert severity="error" sx={{ mt: 2 }}>
                        <AlertTitle>Contraindicated</AlertTitle>
                        {blockMsg}
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
                          <TextField size="small" label="Senior override reason" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} sx={{ flex: 1 }} />
                          <Button size="small" color="error" variant="contained" disabled={busy || !overrideReason.trim()} onClick={() => recordSession(true)}>
                            Override
                          </Button>
                        </Stack>
                      </Alert>
                    )}
                  </Box>
                )}

                {discharged && (
                  <Alert severity="info" sx={{ mt: 2 }}>This episode is {inv.status.toLowerCase()} — no further records can be added.</Alert>
                )}
              </CardContent>
            </Card>
          )}
          {!inv && (
            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Start or select an episode to assess ROM and record sessions.</Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
