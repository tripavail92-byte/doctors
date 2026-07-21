// GrowthChartPage — plots a child's measurements over the WHO reference
// z-line curves (−3/−2/0/+2/+3), extending the SPA with an inline SVG chart.
// Data is live: /growth/curves for the reference lines, /patients/:id/growth
// for the plotted points.
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
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { apiClient } from '../api/client';
import { useApi } from '../api/useApi';
import type { GrowthCurves, GrowthIndicator, GrowthSeries, Patient } from '../api/types';

const INDICATORS: { key: GrowthIndicator; label: string; yUnit: string }[] = [
  { key: 'wfa', label: 'Weight-for-age', yUnit: 'kg' },
  { key: 'lhfa', label: 'Length/Height-for-age', yUnit: 'cm' },
  { key: 'wfh', label: 'Weight-for-length', yUnit: 'kg' },
  { key: 'bmifa', label: 'BMI-for-age', yUnit: 'kg/m²' },
  { key: 'hcfa', label: 'Head circ.-for-age', yUnit: 'cm' },
];

const Z_STYLE: Record<string, { color: string; width: number; dash?: string }> = {
  'z-3': { color: '#D92D20', width: 1 },
  'z-2': { color: '#E8590C', width: 1.25, dash: '4 3' },
  z0: { color: '#0E7C74', width: 2 },
  'z+2': { color: '#E8590C', width: 1.25, dash: '4 3' },
  'z+3': { color: '#D92D20', width: 1 },
};

export default function GrowthChartPage() {
  const { data: patients } = useApi<Patient[]>(() => apiClient.get<Patient[]>('/patients').then((r) => r.data));
  const [patientId, setPatientId] = useState('');
  const [indicator, setIndicator] = useState<GrowthIndicator>('wfa');
  const activeId = patientId || patients?.[0]?.id || '';
  const patient = patients?.find((p) => p.id === activeId);
  const sex = patient?.gender === 'female' ? 'female' : 'male';

  const { data: curves } = useApi<GrowthCurves>(
    () => apiClient.get<GrowthCurves>(`/growth/curves?indicator=${indicator}&sex=${sex}`).then((r) => r.data),
    [indicator, sex],
  );
  const { data: series, loading, error } = useApi<GrowthSeries | null>(
    () => (activeId ? apiClient.get<GrowthSeries>(`/patients/${activeId}/growth?indicator=${indicator}`).then((r) => r.data) : Promise.resolve(null)),
    [activeId, indicator],
  );

  const yUnit = INDICATORS.find((i) => i.key === indicator)?.yUnit ?? '';
  const latest = series?.points.filter((p) => p.z != null).slice(-1)[0];

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Growth chart
          </Typography>
          <Typography variant="body2" color="text.secondary">
            WHO reference z-lines with the child's plotted measurements.
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

      <ToggleButtonGroup
        size="small"
        exclusive
        value={indicator}
        onChange={(_, v) => v && setIndicator(v)}
        sx={{ mb: 2, flexWrap: 'wrap' }}
      >
        {INDICATORS.map((i) => (
          <ToggleButton key={i.key} value={i.key} sx={{ textTransform: 'none' }}>
            {i.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {error && <Alert severity="error">{error}</Alert>}

      <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {patient?.name} — {INDICATORS.find((i) => i.key === indicator)?.label}
            </Typography>
            {latest && (
              <>
                {/* The z-score is shown WITHOUT a colour, and the server's WHO
                    classification carries the alarm.

                    This chip used to be coloured by a client-side |z| <= 2 rule,
                    which matches none of the five indicators' real WHO cut-offs.
                    Reproduced: BMI-for-age z 1.48 rendered a solid GREEN chip
                    beside the server's "Risk of overweight", and height-for-age
                    z 2.93 rendered AMBER beside "Normal stature" — the coloured
                    chip was the salient element and it contradicted the verdict
                    in both directions. The server already computes the band
                    (growth-engine classify*); the client must not re-derive it. */}
                <Chip size="small" variant="outlined" label={`z ${latest.z} · ${latest.percentile}ᵗʰ pct`} />
                <Chip size="small" color={growthChipColor(latest.classification)} label={latest.classification} />
              </>
            )}
          </Stack>

          {loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : !curves || !series || series.points.length === 0 ? (
            !error && (
              <Alert severity="info">
                No measurements to plot. Record weight/length observations (with a date of birth on the patient) to start the chart.
              </Alert>
            )
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <GrowthSvg curves={curves} series={series} yUnit={yUnit} />
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

function GrowthSvg({ curves, series, yUnit }: { curves: GrowthCurves; series: GrowthSeries; yUnit: string }) {
  const W = 760;
  const H = 440;
  const M = { left: 46, right: 64, top: 16, bottom: 40 };
  const PW = W - M.left - M.right;
  const PH = H - M.top - M.bottom;

  const model = useMemo(() => {
    const pts = series.points;
    const xUnitMonths = curves.xUnit === 'months';
    const maxPointX = pts.length ? Math.max(...pts.map((p) => p.x)) : 0;
    const window = xUnitMonths ? 6 : 60;
    const curveMaxX = curves.curves['z0']?.slice(-1)[0]?.x ?? window;
    const xMax = Math.min(curveMaxX, Math.max(window, maxPointX * 1.4));
    const xMin = 0;

    const visible = (arr: { x: number; value: number }[]) => arr.filter((p) => p.x >= xMin && p.x <= xMax);
    const lowVals = visible(curves.curves['z-3'] ?? []).map((p) => p.value);
    const highVals = visible(curves.curves['z+3'] ?? []).map((p) => p.value);
    const ptVals = pts.map((p) => p.value);
    const yMinRaw = Math.min(...lowVals, ...ptVals);
    const yMaxRaw = Math.max(...highVals, ...ptVals);
    const pad = (yMaxRaw - yMinRaw) * 0.06 || 1;
    const yMin = yMinRaw - pad;
    const yMax = yMaxRaw + pad;

    const sx = (x: number) => M.left + ((x - xMin) / (xMax - xMin)) * PW;
    const sy = (v: number) => M.top + ((yMax - v) / (yMax - yMin)) * PH;
    return { xMin, xMax, yMin, yMax, sx, sy, visible };
  }, [curves, series]);

  const { xMin, xMax, yMin, yMax, sx, sy, visible } = model;

  const line = (arr: { x: number; value: number }[]) =>
    visible(arr).map((p) => `${sx(p.x).toFixed(1)},${sy(p.value).toFixed(1)}`).join(' ');

  // Normal band (z-2 .. z+2) as a filled polygon.
  const up = visible(curves.curves['z+2'] ?? []);
  const down = visible(curves.curves['z-2'] ?? []);
  const band = [
    ...up.map((p) => `${sx(p.x).toFixed(1)},${sy(p.value).toFixed(1)}`),
    ...down.slice().reverse().map((p) => `${sx(p.x).toFixed(1)},${sy(p.value).toFixed(1)}`),
  ].join(' ');

  const xTicks = niceTicks(xMin, xMax, 6);
  const yTicks = niceTicks(yMin, yMax, 5);
  const xLabel = curves.xUnit === 'months' ? 'Age (months)' : 'Length/height (cm)';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 640, maxWidth: 900 }} role="img" aria-label="growth chart">
      {/* grid + axes */}
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={M.left} y1={sy(t)} x2={W - M.right} y2={sy(t)} stroke="#E2E8EA" strokeWidth={1} />
          <text x={M.left - 6} y={sy(t) + 3} textAnchor="end" fontSize={10} fill="#5A6B70">
            {round(t)}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <g key={`x${t}`}>
          <line x1={sx(t)} y1={M.top} x2={sx(t)} y2={H - M.bottom} stroke="#EEF2F3" strokeWidth={1} />
          <text x={sx(t)} y={H - M.bottom + 14} textAnchor="middle" fontSize={10} fill="#5A6B70">
            {round(t)}
          </text>
        </g>
      ))}

      {/* normal band */}
      <polygon points={band} fill="#0E7C74" opacity={0.07} />

      {/* reference z-curves */}
      {Object.keys(Z_STYLE).map((k) => {
        const s = Z_STYLE[k];
        const arr = curves.curves[k];
        if (!arr) return null;
        const lastVis = visible(arr).slice(-1)[0];
        return (
          <g key={k}>
            <polyline points={line(arr)} fill="none" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} />
            {lastVis && (
              <text x={W - M.right + 4} y={sy(lastVis.value) + 3} fontSize={9} fill={s.color}>
                {k.replace('z', 'z ')}
              </text>
            )}
          </g>
        );
      })}

      {/* patient line + points */}
      <polyline
        points={series.points.map((p) => `${sx(p.x).toFixed(1)},${sy(p.value).toFixed(1)}`).join(' ')}
        fill="none"
        stroke="#16262B"
        strokeWidth={1.5}
      />
      {series.points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.value)} r={3.5} fill="#16262B" stroke="#fff" strokeWidth={1}>
          <title>{`age ${round(p.ageMonths)} mo · ${p.value} ${yUnit} · z ${p.z}`}</title>
        </circle>
      ))}

      {/* axis labels */}
      <text x={M.left + PW / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="#16262B">
        {xLabel}
      </text>
      <text x={12} y={M.top + PH / 2} textAnchor="middle" fontSize={11} fill="#16262B" transform={`rotate(-90 12 ${M.top + PH / 2})`}>
        {yUnit}
      </text>
    </svg>
  );
}

function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min;
  if (span <= 0) return [min];
  const step = niceStep(span / count);
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(v);
  return ticks;
}
function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const nice = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return nice * pow;
}
function round(x: number): number {
  return Math.round(x * 10) / 10;
}

/**
 * Colour a WHO growth classification, from the SERVER's own words.
 *
 * Anything that is not explicitly a normal band is treated as needing
 * attention — an unrecognised string colours as a warning rather than silently
 * green, because a band this function has not been taught about is exactly the
 * case where guessing "fine" is worst.
 */
function growthChipColor(classification: string | null | undefined): 'success' | 'warning' | 'error' | 'default' {
  const c = (classification ?? '').toLowerCase();
  if (!c) return 'default';
  if (c.includes('severe')) return 'error';
  if (c.startsWith('normal') || c === 'normal stature' || c.includes('normal')) return 'success';
  return 'warning';
}
