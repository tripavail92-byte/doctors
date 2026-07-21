// PatientsPage: searchable list of patients, live from GET /patients.
import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { apiClient } from '../api/client';
import { useApi } from '../api/useApi';
import { describeError } from '../api/fetchErrors';
import type { Patient } from '../api/types';

function ageFromDob(dob: string | null): string {
  if (!dob) return '—';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return String(age);
}

export default function PatientsPage() {
  const { data, loading, error, reload } = useApi<Patient[]>(() =>
    apiClient.get<Patient[]>('/patients').then((r) => r.data),
  );
  const [query, setQuery] = useState('');

  // Registering a patient had NO route in the SPA at all — the first thing
  // anyone tries in a demo, and the entry point to every other workflow.
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [f, setF] = useState({ mrn: '', name: '', phone: '', gender: '', dob: '' });
  const setField = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const register = async () => {
    setBusy(true);
    setFormErr('');
    try {
      await apiClient.post('/patients', {
        mrn: f.mrn.trim(),
        name: f.name.trim(),
        phone: f.phone.trim(),
        ...(f.gender ? { gender: f.gender } : {}),
        ...(f.dob ? { dob: f.dob } : {}),
      });
      setOpen(false);
      setF({ mrn: '', name: '', phone: '', gender: '', dob: '' });
      reload();
    } catch (e) {
      // A duplicate MRN comes back 409 with a message naming the MRN and telling
      // the user to open the existing record. Show the server's words: inventing
      // a new MRN to get past a refusal is how one person ends up with two charts.
      setFormErr(describeError(e).message);
    } finally {
      setBusy(false);
    }
  };
  const canRegister = f.mrn.trim() !== '' && f.name.trim() !== '' && f.phone.trim() !== '';

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Patients
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data ? `${filtered.length} of ${data.length} patients` : 'Loading…'}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
        <Button variant="contained" onClick={() => setOpen(true)}>
          Register patient
        </Button>
        <TextField
          size="small"
          placeholder="Search patients…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 260 }}
        />
        </Stack>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Register a patient</DialogTitle>
        <DialogContent>
          {formErr && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formErr}
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={6}>
              {/* MRN is the clinic's key for a person and is unique per clinic:
                  a duplicate is refused with a 409 rather than quietly opening a
                  second chart for the same patient. */}
              <TextField
                fullWidth size="small" required label="MRN"
                value={f.mrn} onChange={setField('mrn')}
                helperText="Unique within this clinic"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" required label="Full name" value={f.name} onChange={setField('name')} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" required label="Phone" value={f.phone} onChange={setField('phone')} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" select label="Gender"
                value={f.gender} onChange={setField('gender')}
              >
                <MenuItem value="">—</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              {/* Date of birth drives age-dependent clinical rules — paediatric
                  dosing, growth z-scores, the EASI child weighting — so it is
                  offered at registration rather than left to be back-filled. */}
              <TextField
                fullWidth size="small" type="date" label="Date of birth"
                value={f.dob} onChange={setField('dob')}
                InputLabelProps={{ shrink: true }}
                helperText="Drives age-based dosing and growth charts"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={register} disabled={busy || !canRegister}>
            {busy ? 'Registering…' : 'Register'}
          </Button>
        </DialogActions>
      </Dialog>

      <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          {loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>MRN</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Gender</TableCell>
                    <TableCell align="right">Age</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id} hover>
                      <TableCell sx={{ color: 'text.secondary' }}>{p.mrn}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{p.name}</TableCell>
                      <TableCell>{p.phone}</TableCell>
                      <TableCell>
                        {p.gender ? (
                          <Chip size="small" variant="outlined" label={p.gender} sx={{ textTransform: 'capitalize' }} />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell align="right">{ageFromDob(p.dob)}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        {query ? `No patients match "${query}".` : 'No patients yet.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
