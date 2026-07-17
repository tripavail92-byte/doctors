// OphthalmologyPage — the eye exam.
//
// The two measures that carry clinical weight are per-eye: visual acuity (how
// well the eye sees, shown as its logMAR) and intraocular pressure (glaucoma
// risk, banded normal → urgent). The page records both per eye and shows the
// server's computed logMAR and IOP alert — never a client guess, because those
// bands are what a clinician acts on.
//
// Signing an exam locks it. After that the server refuses every addition, and
// the page stops offering them — a signed exam is a finalized record.
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
import { useApi } from '../api/useApi';

interface Patient {
  id: string;
  name: string;
  mrn: string;
}
type ExamStatus = 'IN_PROGRESS' | 'SIGNED';
interface Va {
  id: string;
  laterality: string;
  condition: string;
  displayValue: string;
  logmarValue: number | null;
}
interface Iop {
  id: string;
  laterality: string;
  valueMmHg: number;
  method: string;
  alertSeverity: string;
}
interface Exam {
  id: string;
  status: ExamStatus;
  chiefComplaint: string | null;
  createdAt: string;
  signedAt: string | null;
  visualAcuities: Va[];
  iopMeasurements: Iop[];
}

const EYES = [
  { v: 'OD', label: 'Right (OD)' },
  { v: 'OS', label: 'Left (OS)' },
];
const IOP_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  normal: 'success',
  soft: 'warning',
  red: 'error',
  urgent: 'error',
};

export default function OphthalmologyPage() {
  const { data: patients } = useApi<Patient[]>(() =>
    apiClient.get<Patient[]>('/patients').then((r) => r.data),
  );
  const [patientId, setPatientId] = useState('');
  const active = patientId || patients?.[0]?.id || '';
  const [openId, setOpenId] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const exams = useApi<Exam[]>(
    () => (active ? apiClient.get<Exam[]>(`/ophthalmology/patients/${active}/exams`).then((r) => r.data) : Promise.resolve([])),
    [active, nonce],
  );
  const open = useApi<Exam | null>(
    () => (openId ? apiClient.get<Exam>(`/ophthalmology/exams/${openId}`).then((r) => r.data) : Promise.resolve(null)),
    [openId, nonce],
  );

  // VA + IOP entry.
  const [vaEye, setVaEye] = useState('OD');
  const [vaVal, setVaVal] = useState('');
  const [iopEye, setIopEye] = useState('OD');
  const [iopVal, setIopVal] = useState('');

  const call = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      setNonce((n) => n + 1);
    } catch (e: any) {
      // "IOP 85 mmHg is outside the plausible range (1..80)", "Exam is signed":
      // the server's own words, each naming exactly what it refused.
      setErr(e?.response?.data?.message ?? 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const inv = open.data;
  const signed = inv?.status === 'SIGNED';

  const vaByEye = useMemo(() => {
    const m: Record<string, Va[]> = { OD: [], OS: [] };
    inv?.visualAcuities.forEach((v) => (m[v.laterality === 'RIGHT' ? 'OD' : v.laterality === 'LEFT' ? 'OS' : 'OU'] ??= []).push(v));
    return m;
  }, [inv]);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Eye exam
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Per-eye acuity and pressure. IOP is banded for glaucoma risk.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel>Patient</InputLabel>
          <Select label="Patient" value={active} onChange={(e: SelectChangeEvent) => { setPatientId(e.target.value); setOpenId(null); }}>
            {(patients ?? []).map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name} · {p.mrn}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>
          {err}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* --- Exam list + new --- */}
        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 3 }}>
            <CardContent>
              <Button
                variant="contained"
                size="small"
                disabled={!active || busy}
                onClick={() =>
                  call(async () => {
                    const r = await apiClient.post<Exam>('/ophthalmology/exams', { patientId: active });
                    setOpenId(r.data.id);
                  })
                }
              >
                New exam
              </Button>
            </CardContent>
            <Divider />
            <Table size="small">
              <TableBody>
                {(exams.data ?? []).map((e) => (
                  <TableRow key={e.id} hover selected={e.id === openId} sx={{ cursor: 'pointer' }} onClick={() => setOpenId(e.id)}>
                    <TableCell>
                      {e.createdAt.slice(0, 10)}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {e.chiefComplaint ?? 'exam'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={e.status === 'SIGNED' ? 'signed' : 'open'} color={e.status === 'SIGNED' ? 'success' : 'default'} variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
                {!exams.data?.length && (
                  <TableRow>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No eye exams yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </Grid>

        {/* --- Open exam --- */}
        <Grid item xs={12} md={8}>
          {inv && (
            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Exam · {inv.createdAt.slice(0, 10)}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={signed ? 'signed' : 'in progress'} color={signed ? 'success' : 'default'} />
                    {!signed && (
                      <Button size="small" variant="contained" disabled={busy} onClick={() => call(() => apiClient.patch(`/ophthalmology/exams/${inv.id}/sign`))}>
                        Sign
                      </Button>
                    )}
                  </Stack>
                </Stack>

                {/* Per-eye summary. */}
                <Grid container spacing={2} sx={{ mt: 0.5 }}>
                  {EYES.map((eye) => {
                    const va = vaByEye[eye.v] ?? [];
                    const iops = (inv.iopMeasurements ?? []).filter((i) => i.laterality === (eye.v === 'OD' ? 'RIGHT' : 'LEFT'));
                    const lastIop = iops[iops.length - 1];
                    return (
                      <Grid item xs={6} key={eye.v}>
                        <Card variant="outlined" sx={{ borderRadius: 2 }}>
                          <CardContent>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {eye.label}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Visual acuity
                            </Typography>
                            {va.length ? (
                              va.map((v) => (
                                <Typography key={v.id} variant="body2">
                                  {v.displayValue}{' '}
                                  <Typography component="span" variant="caption" color="text.secondary">
                                    (logMAR {v.logmarValue})
                                  </Typography>
                                </Typography>
                              ))
                            ) : (
                              <Typography variant="body2" color="text.secondary">—</Typography>
                            )}
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                              IOP
                            </Typography>
                            {lastIop ? (
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {lastIop.valueMmHg} mmHg
                                </Typography>
                                <Chip size="small" label={lastIop.alertSeverity} color={IOP_COLOR[lastIop.alertSeverity] ?? 'default'} variant={lastIop.alertSeverity === 'normal' ? 'outlined' : 'filled'} />
                              </Stack>
                            ) : (
                              <Typography variant="body2" color="text.secondary">—</Typography>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>

                {/* Entry — only while the exam is open. */}
                {!signed ? (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <InputLabel>Eye</InputLabel>
                          <Select label="Eye" value={vaEye} onChange={(e) => setVaEye(e.target.value)}>
                            {EYES.map((x) => (
                              <MenuItem key={x.v} value={x.v}>{x.v}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField size="small" label="VA (e.g. 6/9)" value={vaVal} onChange={(e) => setVaVal(e.target.value)} sx={{ width: 120 }} />
                        <Button
                          size="small"
                          disabled={busy || !vaVal.trim()}
                          onClick={() =>
                            call(async () => {
                              await apiClient.post(`/ophthalmology/exams/${inv.id}/va`, { eye: vaEye, condition: 'UNAIDED', notation: 'SNELLEN_6', displayValue: vaVal.trim() });
                              setVaVal('');
                            })
                          }
                        >
                          Add VA
                        </Button>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <InputLabel>Eye</InputLabel>
                          <Select label="Eye" value={iopEye} onChange={(e) => setIopEye(e.target.value)}>
                            {EYES.map((x) => (
                              <MenuItem key={x.v} value={x.v}>{x.v}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField size="small" label="IOP mmHg" value={iopVal} onChange={(e) => setIopVal(e.target.value.replace(/[^0-9]/g, ''))} sx={{ width: 100 }} />
                        <Button
                          size="small"
                          disabled={busy || !iopVal}
                          onClick={() =>
                            call(async () => {
                              await apiClient.post(`/ophthalmology/exams/${inv.id}/iop`, { eye: iopEye, valueMmHg: Number(iopVal), method: 'GAT' });
                              setIopVal('');
                            })
                          }
                        >
                          Add IOP
                        </Button>
                      </Stack>
                    </Stack>
                  </>
                ) : (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    Signed {inv.signedAt?.slice(0, 10)} — this exam is locked.
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
          {!inv && (
            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Start or select an exam to record acuity and pressure.
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
