// DoseCalculatorPage — weight-based paediatric dosing (SCCL Component 4).
// Drug rule -> weight (with mandatory confirm) -> live per-dose mg + volume mL,
// with cap / rounding / age-block indicators, then commit to the medico-legal log.
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { apiClient } from '../api/client';
import { useApi } from '../api/useApi';
import { describeError } from '../api/fetchErrors';
import type { DoseResult, DoseRule, Patient } from '../api/types';

export default function DoseCalculatorPage() {
  const { data: rules } = useApi<DoseRule[]>(() => apiClient.get<DoseRule[]>('/dose/rules').then((r) => r.data));
  const { data: patients } = useApi<Patient[]>(() => apiClient.get<Patient[]>('/patients').then((r) => r.data));

  const [drugKey, setDrugKey] = useState('');
  const [weight, setWeight] = useState('');
  const [ageMonths, setAgeMonths] = useState('');
  const [concIdx, setConcIdx] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [patientId, setPatientId] = useState('');

  const rule = useMemo(() => rules?.find((r) => r.key === drugKey), [rules, drugKey]);
  useEffect(() => {
    // Default to the first drug + its first concentration once loaded.
    if (rules?.length && !drugKey) setDrugKey(rules[0].key);
  }, [rules, drugKey]);
  useEffect(() => {
    setConcIdx(0);
  }, [drugKey]);

  const weightNum = parseFloat(weight);
  const ageNum = ageMonths === '' ? undefined : parseInt(ageMonths, 10);
  const conc = rule?.concentrations?.[concIdx];

  const [result, setResult] = useState<DoseResult | null>(null);
  const [calcErr, setCalcErr] = useState<string | null>(null);
  useEffect(() => {
    if (!drugKey || !(weightNum > 0)) {
      setResult(null);
      return;
    }
    let active = true;
    setCalcErr(null);
    apiClient
      .post<DoseResult>('/dose/calculate', {
        drug: drugKey,
        weightKg: weightNum,
        ...(ageNum != null ? { ageMonths: ageNum } : {}),
        ...(conc ? { concentrationMgPerMl: conc.mgPerMl } : {}),
      })
      .then((r) => active && setResult(r.data))
      .catch((e) => active && setCalcErr(e?.response?.data?.message ?? 'Calculation failed'));
    return () => {
      active = false;
    };
  }, [drugKey, weightNum, ageNum, conc?.mgPerMl]);

  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState<{ id: string; volumeMl: number | null } | null>(null);
  const [commitErr, setCommitErr] = useState('');
  const commit = async () => {
    if (!result || !patientId) return;
    setCommitting(true);
    setCommitErr('');
    try {
      const { data } = await apiClient.post<{ log: { id: string; volumeMl: number | null } }>('/dose/commit', {
        patientId,
        drug: drugKey,
        weightKg: weightNum,
        ...(ageNum != null ? { ageMonths: ageNum } : {}),
        ...(conc ? { concentrationMgPerMl: conc.mgPerMl } : {}),
      });
      setCommitted({ id: data.log.id, volumeMl: data.log.volumeMl });
    } catch (e) {
      // This had NO catch. A refused commit left the screen exactly as it was —
      // the calculated dose still displayed, no confirmation, no error — so the
      // only way to tell a paediatric dose had NOT been recorded was to go and
      // look somewhere else.
      setCommitErr(describeError(e).message);
    } finally {
      setCommitting(false);
    }
  };

  const canCommit = Boolean(result && !result.blocked && confirmed && patientId);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Dose calculator
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Weight-based paediatric dosing — a recommendation the clinician confirms.
      </Typography>

      <Grid container spacing={2.5}>
        {/* Inputs */}
        <Grid item xs={12} md={5}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Drug</InputLabel>
                  <Select label="Drug" value={drugKey} onChange={(e: SelectChangeEvent) => setDrugKey(e.target.value)}>
                    {(rules ?? []).map((r) => (
                      <MenuItem key={r.key} value={r.key}>
                        {r.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {rule && (
                  <Alert severity="info" icon={false} sx={{ py: 0.5 }}>
                    <Typography variant="caption">
                      {rule.mgPerKgPerDay} mg/kg/day ÷ {rule.dosesPerDay}
                      {rule.maxSingleMg ? ` · max ${rule.maxSingleMg} mg/dose` : ''}
                      {rule.maxDailyMg ? ` · max ${rule.maxDailyMg} mg/day` : ''}
                      {rule.minAgeMonths ? ` · ≥ ${rule.minAgeMonths} mo` : ''}
                    </Typography>
                  </Alert>
                )}

                <TextField
                  size="small"
                  label="Weight (kg)"
                  type="number"
                  value={weight}
                  onChange={(e) => {
                    setWeight(e.target.value);
                    setConfirmed(false);
                    setCommitted(null);
                  }}
                  inputProps={{ min: 0, step: 0.1 }}
                />
                <TextField
                  size="small"
                  label="Age (months, optional)"
                  type="number"
                  value={ageMonths}
                  onChange={(e) => setAgeMonths(e.target.value)}
                  inputProps={{ min: 0, step: 1 }}
                />

                {rule?.concentrations?.length ? (
                  <FormControl size="small" fullWidth>
                    <InputLabel>Concentration</InputLabel>
                    <Select label="Concentration" value={String(concIdx)} onChange={(e) => setConcIdx(Number(e.target.value))}>
                      {rule.concentrations.map((c, i) => (
                        <MenuItem key={c.label} value={String(i)}>
                          {c.label} ({c.mgPerMl} mg/mL)
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : null}

                <FormControlLabel
                  control={<Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />}
                  label={<Typography variant="body2">I confirm the measured weight</Typography>}
                />

                <Divider />
                <FormControl size="small" fullWidth>
                  <InputLabel>Patient (for the record)</InputLabel>
                  <Select label="Patient (for the record)" value={patientId} onChange={(e: SelectChangeEvent) => setPatientId(e.target.value)}>
                    {(patients ?? []).map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name} · {p.mrn}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Result */}
        <Grid item xs={12} md={7}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, height: '100%' }}>
            <CardContent>
              {calcErr && <Alert severity="error">{calcErr}</Alert>}
              {!result && !calcErr && (
                <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Select a drug and enter a weight.
                  </Typography>
                </Box>
              )}
              {result && (
                <>
                  {result.blocked ? (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {result.blockReason}
                    </Alert>
                  ) : (
                    <Stack direction="row" spacing={3} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                      <Metric label="Per dose" value={`${result.perDoseMg} mg`} accent />
                      {result.volumePerDoseMl != null && <Metric label="Volume / dose" value={`${result.volumePerDoseMl} mL`} accent />}
                      <Metric label="Per day" value={`${result.perDayMg} mg`} />
                      <Metric label="Doses / day" value={String(result.dosesPerDay)} />
                    </Stack>
                  )}

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                    {result.cappedSingle && <Chip size="small" color="warning" label="Capped at max single dose" />}
                    {result.cappedDaily && <Chip size="small" color="warning" label="Capped at max daily dose" />}
                    {result.rounded && <Chip size="small" variant="outlined" label="Rounded to dosing step" />}
                    {result.highRisk && <Chip size="small" color="error" label="High-risk — double-check" />}
                  </Stack>

                  {result.notes.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      {result.notes.map((n, i) => (
                        <Typography key={i} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          • {n}
                        </Typography>
                      ))}
                    </Box>
                  )}

                  <Divider sx={{ mb: 2 }} />
                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Button variant="contained" disabled={!canCommit || committing} onClick={commit}>
                      {committing ? 'Recording…' : 'Add to prescription'}
                    </Button>
                    {!confirmed && !result.blocked && (
                      <Typography variant="caption" color="text.secondary">
                        Confirm the weight to enable.
                      </Typography>
                    )}
                    {committed && (
                      <Chip
                        color="success"
                        label={`Recorded${committed.volumeMl != null ? ` · ${committed.volumeMl} mL` : ''} · log ${committed.id.slice(0, 8)}`}
                      />
                    )}
                    {commitErr && (
                      <Chip color="error" label={`NOT recorded — ${commitErr}`} onDelete={() => setCommitErr('')} />
                    )}
                  </Stack>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, color: accent ? 'primary.main' : 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  );
}
