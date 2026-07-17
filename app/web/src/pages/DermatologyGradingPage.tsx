// DermatologyGradingPage — scored severity for the skin.
//
// PASI, EASI, MASI, mMASI, GAGS: the standard indices a derma clinic tracks a
// patient's disease by. The form renders from the server's instrument catalog,
// so the regions and the signs are the engine's, not a copy that can drift.
//
// The one rule that shapes the whole page: the SCORE and the BAND come back from
// the server and are only ever displayed, never computed here. The engine
// refuses a client-supplied band, and (for EASI) derives the child region
// weights from the patient's DOB rather than trusting the form. Recomputing
// either on the client would quietly reintroduce exactly the tampering the
// backend rejects. So the UI collects raw signs and shows what the server made
// of them.
import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { apiClient } from '../api/client';
import { useApi } from '../api/useApi';

interface Patient {
  id: string;
  name: string;
  mrn: string;
}
interface Region {
  key: string;
  label: string;
  weight?: number;
  factor?: number;
}
interface Catalog {
  instruments: string[];
  gags: { regions: Region[]; max: number };
  pasi: { regions: Region[]; signs: string[]; signRange: [number, number]; max: number };
  easi: { regionsAdult: Region[]; regionsChild: Region[]; signs: string[]; signRange: [number, number]; max: number };
  masi: { regions: Region[]; signs: string[]; modifiedSigns: string[]; signRange: [number, number]; max: number; modifiedMax: number };
}
interface GradeResult {
  key: string;
  score: number;
  band: string | null;
  max: number;
  subscores: Record<string, number>;
  notes?: string[];
  response?: { answers?: { child?: boolean } };
}
interface GradeRow {
  id: string;
  instrumentKey: string;
  score: number;
  band: string | null;
  recordedAt: string;
}

// The instruments this page renders. SCORAD and VASI have bespoke inputs
// (subjective symptoms; hand-unit depigmentation) and are deliberately left for
// their own screens rather than forced into this region×sign grid.
const SUPPORTED: Record<string, { label: string; kind: 'regionSign' | 'gags' }> = {
  pasi: { label: 'PASI — Psoriasis', kind: 'regionSign' },
  easi: { label: 'EASI — Eczema', kind: 'regionSign' },
  masi: { label: 'MASI — Melasma', kind: 'regionSign' },
  mmasi: { label: 'mMASI — Melasma (modified)', kind: 'regionSign' },
  gags: { label: 'GAGS — Acne', kind: 'gags' },
};

const BAND_COLOR: Record<string, 'default' | 'success' | 'info' | 'warning' | 'error'> = {
  clear: 'success',
  mild: 'info',
  moderate: 'warning',
  severe: 'error',
};

const AREA_MAX = 6;
const GAGS_GRADE_MAX = 4;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

export default function DermatologyGradingPage() {
  const { data: patients } = useApi<Patient[]>(() =>
    apiClient.get<Patient[]>('/patients').then((r) => r.data),
  );
  const { data: catalog } = useApi<Catalog>(() =>
    apiClient.get<Catalog>('/dermatology/instruments').then((r) => r.data),
  );

  const [patientId, setPatientId] = useState('');
  const active = patientId || patients?.[0]?.id || '';
  const [instrument, setInstrument] = useState('pasi');

  // answers[regionKey] holds {area, ...signs} for region×sign instruments, or a
  // single numeric grade for GAGS. Kept as strings while editing, coerced on submit.
  const [answers, setAnswers] = useState<Record<string, Record<string, number>>>({});
  const [gags, setGags] = useState<Record<string, number>>({});
  const [result, setResult] = useState<GradeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [nonce, setNonce] = useState(0);

  const history = useApi<GradeRow[]>(
    () =>
      active
        ? apiClient
            .get<GradeRow[]>(`/dermatology/patients/${active}/grades?instrument=${instrument === 'mmasi' ? 'mmasi' : instrument}`)
            .then((r) => r.data)
        : Promise.resolve([]),
    [active, instrument, nonce],
  );

  // Config for the chosen instrument, pulled from the server catalog.
  const cfg = useMemo(() => {
    if (!catalog) return null;
    if (instrument === 'pasi') return { regions: catalog.pasi.regions, signs: catalog.pasi.signs, signMax: catalog.pasi.signRange[1] };
    if (instrument === 'easi') return { regions: catalog.easi.regionsAdult, signs: catalog.easi.signs, signMax: catalog.easi.signRange[1] };
    if (instrument === 'masi') return { regions: catalog.masi.regions, signs: catalog.masi.signs, signMax: catalog.masi.signRange[1] };
    if (instrument === 'mmasi') return { regions: catalog.masi.regions, signs: catalog.masi.modifiedSigns, signMax: catalog.masi.signRange[1] };
    if (instrument === 'gags') return { regions: catalog.gags.regions, signs: [] as string[], signMax: GAGS_GRADE_MAX };
    return null;
  }, [catalog, instrument]);

  const kind = SUPPORTED[instrument]?.kind;

  const changeInstrument = (v: string) => {
    setInstrument(v);
    setAnswers({});
    setGags({});
    setResult(null);
    setErr('');
  };

  const setRegionSign = (regionKey: string, field: string, value: number) =>
    setAnswers((a) => ({ ...a, [regionKey]: { ...a[regionKey], [field]: value } }));

  // A partial region is not scoreable — the engine rejects it, so the button
  // stays disabled until every field of every region is entered. Better to gate
  // than to send a request we know will 400.
  const complete = useMemo(() => {
    if (!cfg) return false;
    if (kind === 'gags') return cfg.regions.every((r) => gags[r.key] !== undefined);
    return cfg.regions.every((r) => {
      const row = answers[r.key];
      if (!row) return false;
      if (row.area === undefined) return false;
      return cfg.signs.every((s) => row[s] !== undefined);
    });
  }, [cfg, kind, answers, gags]);

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      const payload = kind === 'gags' ? gags : answers;
      const r = await apiClient.post<GradeResult>('/dermatology/grades', {
        patientId: active,
        instrument,
        answers: payload,
      });
      setResult(r.data);
      setNonce((n) => n + 1);
    } catch (e: any) {
      // The engine's own words: "PASI region head is required", "EASI requires
      // the patient date of birth". Each names the exact gap.
      setErr(e?.response?.data?.message ?? 'Could not score this grade');
    } finally {
      setBusy(false);
    }
  };

  const opts = (n: number) => Array.from({ length: n + 1 }, (_, i) => i);

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Severity grading
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Scored indices — the score and band are computed by the server.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Instrument</InputLabel>
            <Select label="Instrument" value={instrument} onChange={(e: SelectChangeEvent) => changeInstrument(e.target.value)}>
              {Object.entries(SUPPORTED).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Patient</InputLabel>
            <Select
              label="Patient"
              value={active}
              onChange={(e: SelectChangeEvent) => {
                setPatientId(e.target.value);
                setResult(null);
              }}
            >
              {(patients ?? []).map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name} · {p.mrn}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>
          {err}
        </Alert>
      )}

      {instrument === 'easi' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          EASI region weights differ for children aged 7 and under. The server derives that from the
          patient's date of birth — record it on the patient if this scores as an error.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* --- Entry grid, rendered from config --- */}
        <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ pb: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {SUPPORTED[instrument]?.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {kind === 'gags'
                ? 'Grade the predominant lesion in each region (0 none → 4 nodulocystic).'
                : 'Area 0–6 by extent; each sign on its clinical scale.'}
            </Typography>
          </CardContent>
          <Divider sx={{ mt: 2 }} />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Region</TableCell>
                {kind === 'gags' ? (
                  <TableCell align="center">Grade</TableCell>
                ) : (
                  <>
                    <TableCell align="center">Area</TableCell>
                    {(cfg?.signs ?? []).map((s) => (
                      <TableCell key={s} align="center" sx={{ px: 0.5 }}>
                        {cap(s).slice(0, 5)}
                      </TableCell>
                    ))}
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {(cfg?.regions ?? []).map((r) => (
                <TableRow key={r.key}>
                  <TableCell sx={{ fontWeight: 500 }}>{r.label}</TableCell>
                  {kind === 'gags' ? (
                    <TableCell align="center">
                      <Select
                        size="small"
                        variant="standard"
                        value={gags[r.key] ?? ''}
                        onChange={(e) => setGags((g) => ({ ...g, [r.key]: Number(e.target.value) }))}
                        sx={{ minWidth: 48 }}
                      >
                        {opts(GAGS_GRADE_MAX).map((n) => (
                          <MenuItem key={n} value={n}>
                            {n}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                  ) : (
                    <>
                      <TableCell align="center">
                        <Select
                          size="small"
                          variant="standard"
                          value={answers[r.key]?.area ?? ''}
                          onChange={(e) => setRegionSign(r.key, 'area', Number(e.target.value))}
                          sx={{ minWidth: 48 }}
                        >
                          {opts(AREA_MAX).map((n) => (
                            <MenuItem key={n} value={n}>
                              {n}
                            </MenuItem>
                          ))}
                        </Select>
                      </TableCell>
                      {(cfg?.signs ?? []).map((s) => (
                        <TableCell key={s} align="center" sx={{ px: 0.5 }}>
                          <Select
                            size="small"
                            variant="standard"
                            value={answers[r.key]?.[s] ?? ''}
                            onChange={(e) => setRegionSign(r.key, s, Number(e.target.value))}
                            sx={{ minWidth: 44 }}
                          >
                            {opts(cfg?.signMax ?? 4).map((n) => (
                              <MenuItem key={n} value={n}>
                                {n}
                              </MenuItem>
                            ))}
                          </Select>
                        </TableCell>
                      ))}
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <CardContent>
            <Button variant="contained" disabled={!complete || busy || !active} onClick={submit}>
              Score {SUPPORTED[instrument]?.label.split(' ')[0]}
            </Button>
            {!complete && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                Every region must be filled — a partial grade cannot be scored.
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* --- Result + history --- */}
        <Box>
          {result && (
            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 3 }}>
              <CardContent>
                <Typography variant="caption" color="text.secondary">
                  {result.key.toUpperCase()} score
                </Typography>
                <Stack direction="row" spacing={2} alignItems="baseline">
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>
                    {result.score}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    / {result.max}
                  </Typography>
                  {result.band ? (
                    <Chip label={result.band} color={BAND_COLOR[result.band] ?? 'default'} />
                  ) : (
                    <Chip label="no validated band" variant="outlined" size="small" />
                  )}
                </Stack>
                {instrument === 'easi' && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Scored with {result.response?.answers?.child ? 'child' : 'adult'} region weights.
                  </Typography>
                )}
                {result.notes?.map((n) => (
                  <Alert key={n} severity="info" sx={{ mt: 1.5 }}>
                    {n}
                  </Alert>
                ))}
              </CardContent>
            </Card>
          )}

          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ pb: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                History
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {SUPPORTED[instrument]?.label.split(' ')[0]} over time — track the trend, not one number.
              </Typography>
            </CardContent>
            <Divider sx={{ mt: 2 }} />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Score</TableCell>
                  <TableCell>Band</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(history.data ?? []).map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>{g.recordedAt.slice(0, 10)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {g.score}
                    </TableCell>
                    <TableCell>
                      {g.band ? (
                        <Chip size="small" label={g.band} color={BAND_COLOR[g.band] ?? 'default'} variant="outlined" />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!history.data?.length && (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No {SUPPORTED[instrument]?.label.split(' ')[0]} grades recorded yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
