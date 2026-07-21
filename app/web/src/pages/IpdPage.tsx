// IpdPage — wards, beds, and who is in them.
//
// The invariants this screen makes visible: a bed holds one patient, a patient
// is in one bed, and discharge frees the bed. The admit form only offers
// AVAILABLE beds, and the server holds the line under a race (a partial unique
// index — one active admission per patient — reproduced turning two concurrent
// admits into one success and one clean refusal).
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
  TableHead,
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
type BedStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
interface Bed {
  id: string;
  code: string;
  status: BedStatus;
  ward: { name: string };
}
interface Occupancy {
  totalBeds: number;
  available: number;
  occupied: number;
  maintenance: number;
  occupancyRatePct: number;
}
interface Admission {
  id: string;
  status: 'ADMITTED' | 'DISCHARGED';
  diagnosis: string | null;
  admittedAt: string;
  dischargedAt: string | null;
  patient: { name: string; mrn: string };
  bed: { code: string; ward: { name: string; floor: string | null } };
}

const BED_COLOR: Record<BedStatus, 'success' | 'error' | 'warning'> = {
  AVAILABLE: 'success',
  OCCUPIED: 'error',
  MAINTENANCE: 'warning',
};

export default function IpdPage() {
  const { data: patients } = useApi<Patient[]>(() =>
    apiClient.get<Patient[]>('/patients').then((r) => r.data),
  );
  const [nonce, setNonce] = useState(0);
  const occupancy = useApi<Occupancy>(() => apiClient.get<Occupancy>('/ipd/occupancy').then((r) => r.data), [nonce]);
  const beds = useApi<Bed[]>(() => apiClient.get<Bed[]>('/ipd/beds').then((r) => r.data), [nonce]);
  const admissions = useApi<Admission[]>(
    () => apiClient.get<Admission[]>('/ipd/admissions?status=ADMITTED').then((r) => r.data),
    [nonce],
  );

  const [patientId, setPatientId] = useState('');
  const [bedId, setBedId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const availableBeds = useMemo(() => (beds.data ?? []).filter((b) => b.status === 'AVAILABLE'), [beds.data]);

  const call = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      setNonce((n) => n + 1);
    } catch (e: any) {
      // "Patient is already admitted" / "Bed is occupied — not available":
      // the server's words, each naming the invariant that stopped the action.
      setErr(e?.response?.data?.message ?? 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Inpatient
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Wards, beds and admissions. A bed holds one patient; discharge frees it.
      </Typography>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>
          {err}
        </Alert>
      )}

      {/* Occupancy at a glance. */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {(
          [
            ['occupied', occupancy.data?.occupied ?? 0, 'error.main'],
            ['available', occupancy.data?.available ?? 0, 'success.main'],
            ['total beds', occupancy.data?.totalBeds ?? 0, 'text.primary'],
            ['occupancy', `${occupancy.data?.occupancyRatePct ?? 0}%`, 'text.secondary'],
          ] as const
        ).map(([label, v, color]) => (
          <Grid item xs={6} sm={3} key={label}>
            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color }}>
                  {v}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* --- Admit --- */}
        <Grid item xs={12} md={5}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                Admit a patient
              </Typography>
              <Stack spacing={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="ipd-patient-label">Patient</InputLabel>
                  <Select labelId="ipd-patient-label" id="ipd-patient" label="Patient" value={patientId} onChange={(e: SelectChangeEvent) => setPatientId(e.target.value)}>
                    {(patients ?? []).map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name} · {p.mrn}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel id="ipd-bed-label">Bed (available only)</InputLabel>
                  <Select labelId="ipd-bed-label" id="ipd-bed" label="Bed (available only)" value={bedId} onChange={(e: SelectChangeEvent) => setBedId(e.target.value)}>
                    {availableBeds.map((b) => (
                      <MenuItem key={b.id} value={b.id}>
                        {b.ward.name} · {b.code}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField size="small" label="Diagnosis (optional)" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} fullWidth />
                <Button
                  variant="contained"
                  disabled={!patientId || !bedId || busy}
                  onClick={() =>
                    call(async () => {
                      await apiClient.post('/ipd/admissions', { patientId, bedId, diagnosis: diagnosis || undefined });
                      setPatientId('');
                      setBedId('');
                      setDiagnosis('');
                    })
                  }
                >
                  Admit
                </Button>
                {!availableBeds.length && (
                  <Typography variant="caption" color="text.secondary">
                    No beds available — discharge a patient or add a ward.
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Bed board. */}
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ pb: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Bed board
              </Typography>
            </CardContent>
            <Divider sx={{ mt: 2 }} />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ward</TableCell>
                  <TableCell>Bed</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(beds.data ?? []).slice(0, 40).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.ward.name}</TableCell>
                    <TableCell>{b.code}</TableCell>
                    <TableCell>
                      <Chip size="small" label={b.status.toLowerCase()} color={BED_COLOR[b.status]} variant={b.status === 'AVAILABLE' ? 'outlined' : 'filled'} />
                    </TableCell>
                  </TableRow>
                ))}
                {!beds.data?.length && (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No beds yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </Grid>

        {/* --- Current inpatients --- */}
        <Grid item xs={12} md={7}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ pb: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Current inpatients
              </Typography>
            </CardContent>
            <Divider sx={{ mt: 2 }} />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Patient</TableCell>
                  <TableCell>Bed</TableCell>
                  <TableCell>Diagnosis</TableCell>
                  <TableCell>Since</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {(admissions.data ?? []).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {a.patient.name}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {a.patient.mrn}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {a.bed.ward.name} · {a.bed.code}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {a.diagnosis ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {a.admittedAt.slice(0, 10)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" disabled={busy} onClick={() => call(() => apiClient.patch(`/ipd/admissions/${a.id}/discharge`))}>
                        Discharge
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!admissions.data?.length && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No current inpatients.
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
