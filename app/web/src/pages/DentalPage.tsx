// DentalPage — the odontogram widget (the pack's one required specialty widget).
// Interactive FDI tooth chart coloured by condition, DMFT summary, condition
// legend, and a read-only latest-perio summary. All data is live from the API.
import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { apiClient } from '../api/client';
import { useApi } from '../api/useApi';
import type {
  DentalReference,
  Odontogram,
  OdontogramTooth,
  Patient,
  PerioExam,
  PerioSummary,
  ToothConditionRef,
} from '../api/types';

// Anatomical FDI layout: upper = Q1(reversed)+Q2, lower = Q4(reversed)+Q3.
const Q = (quadrant: number) => Array.from({ length: 8 }, (_, i) => `${quadrant}${i + 1}`);
const UPPER = [...Q(1).reverse(), ...Q(2)];
const LOWER = [...Q(4).reverse(), ...Q(3)];

/** Choose black/white text for a hex background by luminance. */
function textOn(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#16262B' : '#ffffff';
}

export default function DentalPage() {
  const { data: patients } = useApi<Patient[]>(() => apiClient.get<Patient[]>('/patients').then((r) => r.data));
  const { data: reference } = useApi<DentalReference>(() =>
    apiClient.get<DentalReference>('/teeth').then((r) => r.data),
  );
  const [patientId, setPatientId] = useState<string>('');
  const activePatient = patientId || patients?.[0]?.id || '';

  const { data: chart, loading, error, reload } = useApi<Odontogram | null>(
    () => (activePatient ? apiClient.get<Odontogram>(`/patients/${activePatient}/odontogram`).then((r) => r.data) : Promise.resolve(null)),
    [activePatient],
  );

  // Condition code -> color/label lookup.
  const condByCode = useMemo(() => {
    const m = new Map<string, ToothConditionRef>();
    reference?.conditions.forEach((c) => m.set(c.code, c));
    return m;
  }, [reference]);
  const byFdi = useMemo(() => {
    const m = new Map<string, OdontogramTooth>();
    chart?.teeth.forEach((t) => m.set(t.fdi, t));
    return m;
  }, [chart]);

  // Tooth-condition picker menu.
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [menuTooth, setMenuTooth] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openMenu = (e: React.MouseEvent<HTMLElement>, fdi: string) => {
    setAnchor(e.currentTarget);
    setMenuTooth(fdi);
  };
  const pickCondition = async (code: string) => {
    if (!menuTooth || !activePatient) return;
    setBusy(true);
    try {
      await apiClient.post('/odontogram/teeth', { patientId: activePatient, toothFdi: menuTooth, condition: code });
      reload();
    } finally {
      setBusy(false);
      setAnchor(null);
      setMenuTooth(null);
    }
  };

  const colorFor = (fdi: string): string => {
    const cond = byFdi.get(fdi)?.condition ?? 'healthy';
    return condByCode.get(cond)?.color ?? '#e7eaeb';
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Dental chart
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Odontogram (FDI) — click a tooth to set its condition.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel>Patient</InputLabel>
          <Select label="Patient" value={activePatient} onChange={(e: SelectChangeEvent) => setPatientId(e.target.value)}>
            {(patients ?? []).map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name} · {p.mrn}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 3 }}>
        <CardContent>
          {loading || !chart ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box sx={{ overflowX: 'auto' }}>
                <Stack spacing={1.5} sx={{ minWidth: 560, opacity: busy ? 0.6 : 1 }}>
                  <ToothRow fdis={UPPER} colorFor={colorFor} byFdi={byFdi} onPick={openMenu} />
                  <Box sx={{ borderTop: 1, borderColor: 'divider' }} />
                  <ToothRow fdis={LOWER} colorFor={colorFor} byFdi={byFdi} onPick={openMenu} />
                </Stack>
              </Box>

              {/* DMFT summary */}
              <Stack direction="row" spacing={1} sx={{ mt: 3 }} flexWrap="wrap" useFlexGap>
                <Chip color="error" variant="outlined" label={`Decayed ${chart.dmft.decayed}`} />
                <Chip variant="outlined" label={`Missing ${chart.dmft.missing}`} />
                <Chip color="info" variant="outlined" label={`Filled ${chart.dmft.filled}`} />
                <Chip color="primary" label={`DMFT ${chart.dmft.dmft}`} />
                <Chip variant="outlined" label={`Sound ${chart.dmft.soundTeeth}`} />
              </Stack>
            </>
          )}
        </CardContent>
      </Card>

      {/* Condition legend */}
      {reference && (
        <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              Legend
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              {reference.conditions.map((c) => (
                <Stack key={c.code} direction="row" spacing={0.75} alignItems="center">
                  <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: c.color, border: 1, borderColor: 'divider' }} />
                  <Typography variant="caption">{c.label}</Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {activePatient && <PerioCard patientId={activePatient} />}

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {(reference?.conditions ?? []).map((c) => (
          <MenuItem key={c.code} onClick={() => pickCondition(c.code)}>
            <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: c.color, mr: 1.25, border: 1, borderColor: 'divider' }} />
            <ListItemText primary={c.label} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

function ToothRow({
  fdis,
  colorFor,
  byFdi,
  onPick,
}: {
  fdis: string[];
  colorFor: (fdi: string) => string;
  byFdi: Map<string, OdontogramTooth>;
  onPick: (e: React.MouseEvent<HTMLElement>, fdi: string) => void;
}) {
  return (
    <Stack direction="row" spacing={0.5} justifyContent="center">
      {fdis.map((fdi, i) => {
        const bg = colorFor(fdi);
        const cond = byFdi.get(fdi)?.condition ?? 'healthy';
        return (
          <Box
            key={fdi}
            onClick={(e) => onPick(e, fdi)}
            title={`${fdi} · ${cond}`}
            sx={{
              width: 32,
              height: 44,
              borderRadius: 1,
              bgcolor: bg,
              color: textOn(bg),
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              border: 1,
              borderColor: 'divider',
              // Gap between the two central quadrants (after the 8th tooth).
              ml: i === 8 ? 2 : 0.5,
              transition: 'transform 0.08s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 },
            }}
          >
            {fdi}
          </Box>
        );
      })}
    </Stack>
  );
}

function PerioCard({ patientId }: { patientId: string }) {
  const { data } = useApi<PerioExam[]>(
    () => apiClient.get<PerioExam[]>(`/patients/${patientId}/perio-exams`).then((r) => r.data),
    [patientId],
  );
  const latestId = data?.[0]?.id;
  const { data: detail } = useApi<{ summary: PerioSummary } | null>(
    () => (latestId ? apiClient.get(`/perio-exams/${latestId}`).then((r) => r.data) : Promise.resolve(null)),
    [latestId],
  );
  if (!data?.length || !detail) return null;
  const s = detail.summary;
  return (
    <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Latest periodontal exam
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip color={s.stage === 'Health/Gingivitis' ? 'success' : 'warning'} label={s.stage} />
          <Chip variant="outlined" label={`BOP ${s.bopPercent}%`} />
          <Chip variant="outlined" label={`Max pocket ${s.maxPocketMm} mm`} />
          <Chip variant="outlined" label={`Max CAL ${s.maxCalMm} mm`} />
          <Chip variant="outlined" label={`Furcation ${s.worstFurcation}`} />
        </Stack>
      </CardContent>
    </Card>
  );
}
