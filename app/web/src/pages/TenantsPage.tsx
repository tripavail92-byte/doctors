import { useState } from 'react';
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
import { apiClient } from '../api/client';
import { useApi } from '../api/useApi';
import { describeError } from '../api/fetchErrors';

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  edition: string;
  status: string;
  patients: number;
  users: number;
  createdAt: string;
}

const EDITIONS: { value: string; label: string; desc: string }[] = [
  { value: 'SOLO', label: 'Solo Practice', desc: 'Single doctor — core EMR + billing' },
  { value: 'CLINIC', label: 'General Clinic', desc: 'Multi-staff — reporting, CRM, media' },
  { value: 'DERMATOLOGY', label: 'Dermatology Clinic', desc: 'Skin grading, phototherapy, aesthetics' },
  { value: 'DENTAL', label: 'Dental Clinic', desc: 'Odontogram, DMFT, orthodontics' },
  { value: 'OBGYN', label: 'OB/GYN Clinic', desc: 'ANC card, partogram, immunization, dosing' },
  { value: 'PEDIATRICS', label: 'Paediatrics Clinic', desc: 'Growth charts, dosing, immunization (EPI)' },
  { value: 'OPHTHALMOLOGY', label: 'Eye Clinic', desc: 'Visual acuity, refraction, IOP, segments' },
  { value: 'PHYSIOTHERAPY', label: 'Physiotherapy Clinic', desc: 'ROM tracking, rehab episodes, exercises' },
  { value: 'LAB', label: 'Laboratory', desc: 'Clinic features + LIS and imaging' },
  { value: 'PHARMACY', label: 'Pharmacy', desc: 'Clinic features + pharmacy POS and stock' },
  { value: 'SPECIALTY', label: 'Multi-Specialty', desc: 'All specialty packs combined' },
  { value: 'HOSPITAL', label: 'Hospital', desc: 'All specialties + lab, pharmacy, IPD, HR' },
  { value: 'ENTERPRISE', label: 'Enterprise', desc: 'Full platform — every feature unlocked' },
];

const EMPTY = {
  name: '',
  slug: '',
  edition: 'CLINIC',
  ownerEmail: '',
  ownerName: '',
  ownerPassword: '',
  facilityName: '',
  city: '',
};

export default function TenantsPage() {
  const { data, loading, error, reload } = useApi<TenantRow[]>(() =>
    apiClient.get<TenantRow[]>('/platform/tenants').then((r) => r.data),
  );

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [f, setF] = useState(EMPTY);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const create = async () => {
    setBusy(true);
    setFormErr('');
    try {
      await apiClient.post('/platform/tenants', {
        name: f.name.trim(),
        slug: f.slug.trim(),
        edition: f.edition,
        ownerEmail: f.ownerEmail.trim(),
        ownerName: f.ownerName.trim(),
        ownerPassword: f.ownerPassword,
        ...(f.facilityName.trim() ? { facilityName: f.facilityName.trim() } : {}),
        ...(f.city.trim() ? { city: f.city.trim() } : {}),
      });
      setOpen(false);
      setF(EMPTY);
      reload();
    } catch (e) {
      setFormErr(describeError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const canCreate =
    f.name.trim().length >= 2 &&
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug.trim()) &&
    f.ownerEmail.includes('@') &&
    f.ownerName.trim().length >= 2 &&
    f.ownerPassword.length >= 12;

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
            Clinics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data ? `${data.length} clinic${data.length === 1 ? '' : 's'} on the platform` : 'Loading…'}
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Onboard a clinic
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Onboard a new clinic</DialogTitle>
        <DialogContent>
          {formErr && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formErr}
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" required label="Clinic name"
                value={f.name} onChange={set('name')}
                helperText="Display name, e.g. Derma Care"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" required label="Slug"
                value={f.slug} onChange={set('slug')}
                helperText="Lowercase, hyphens only"
                error={f.slug.length > 0 && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" select required label="Edition"
                value={f.edition} onChange={set('edition')}
              >
                {EDITIONS.map((e) => (
                  <MenuItem key={e.value} value={e.value}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{e.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{e.desc}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="City"
                value={f.city} onChange={set('city')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth size="small" label="Facility name"
                value={f.facilityName} onChange={set('facilityName')}
                helperText="Defaults to the clinic name"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>
                Owner account
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" required label="Owner email" type="email"
                value={f.ownerEmail} onChange={set('ownerEmail')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" required label="Owner name"
                value={f.ownerName} onChange={set('ownerName')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth size="small" required label="Owner password" type="password"
                value={f.ownerPassword} onChange={set('ownerPassword')}
                helperText={
                  f.ownerPassword.length > 0 && f.ownerPassword.length < 12
                    ? `${f.ownerPassword.length}/12 characters minimum`
                    : 'At least 12 characters'
                }
                error={f.ownerPassword.length > 0 && f.ownerPassword.length < 12}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={create} disabled={busy || !canCreate}>
            {busy ? 'Creating…' : 'Create clinic'}
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
                    <TableCell>Clinic</TableCell>
                    <TableCell>Slug</TableCell>
                    <TableCell>Edition</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Patients</TableCell>
                    <TableCell align="right">Users</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data ?? []).map((t) => (
                    <TableRow key={t.id} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{t.name}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{t.slug}</TableCell>
                      <TableCell>
                        <Chip size="small" label={EDITIONS.find((e) => e.value === t.edition)?.label ?? t.edition} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={t.status}
                          color={t.status === 'ACTIVE' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">{t.patients}</TableCell>
                      <TableCell align="right">{t.users}</TableCell>
                    </TableRow>
                  ))}
                  {(data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No clinics on the platform yet.
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
