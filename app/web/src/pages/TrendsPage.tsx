// TrendsPage — the payoff of the declarative trend charts.
//
// A pack ships a chart definition (which observations, what bands, what target,
// how to aggregate); this page renders it for a patient. The reference bands and
// target line come from the server already resolved — the chart never re-derives
// a clinical threshold, it only draws what it is told. Each eye/side is its own
// line; annotations are pinned where a clinician noted a change.
//
// The SVG is hand-drawn (no charting dependency) so it stays theme-aware and
// self-contained: bands are translucent horizontal bins, the target a dashed
// line, points coloured by the band they fall in.
import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { apiClient } from '../api/client';
import { useApi } from '../api/useApi';

interface Patient { id: string; name: string; mrn: string }
interface Definition {
  key: string;
  title: string;
  unit: string;
  yMin: number | null;
  yMax: number | null;
  splitByLaterality: boolean;
}
interface Band { label: string; low?: number; high?: number; color: string }
interface TargetLine { label: string; value: number }
interface Point { t: string; value: number }
interface Series { side: string | null; points: Point[] }
interface Annotation { id: string; atDateTime: string; label: string; side: string | null }
interface ChartData {
  definition: Definition;
  series: Series[];
  referenceBands: Band[];
  targetLines: TargetLine[];
  annotations: Annotation[];
}
interface Summary {
  side: string | null;
  latest: number | null;
  min: number | null;
  max: number | null;
  delta: number | null;
  direction: string;
  latestFlag: string;
}

// Map a band's declared colour name to a real hue. Kept deliberately small and
// explicit — the definition speaks in clinical colour words, not hex.
const BAND_HUE: Record<string, string> = {
  green: '#2e9e6b',
  amber: '#e0a01e',
  red: '#d8503a',
};
const SIDE_HUE = ['#2f6fed', '#c2410c', '#7c3aed']; // per-series line colours

export default function TrendsPage() {
  const { data: patients } = useApi<Patient[]>(() => apiClient.get<Patient[]>('/patients').then((r) => r.data));
  const { data: defs } = useApi<Definition[]>(() => apiClient.get<Definition[]>('/trends/definitions').then((r) => r.data));

  const [patientId, setPatientId] = useState('');
  const active = patientId || patients?.[0]?.id || '';
  const [chartKey, setChartKey] = useState('');
  const activeChart = chartKey || defs?.[0]?.key || '';

  const chart = useApi<ChartData | null>(
    () => (active && activeChart ? apiClient.get<ChartData>(`/trends/${activeChart}/patient/${active}`).then((r) => r.data) : Promise.resolve(null)),
    [active, activeChart],
  );
  const summary = useApi<Summary[]>(
    () => (active && activeChart ? apiClient.get<Summary[]>(`/trends/${activeChart}/patient/${active}/summary`).then((r) => r.data) : Promise.resolve([])),
    [active, activeChart],
  );

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Trends</Typography>
          <Typography variant="body2" color="text.secondary">
            Pack-defined charts with reference bands and targets, per patient.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Chart</InputLabel>
            <Select label="Chart" value={activeChart} onChange={(e: SelectChangeEvent) => setChartKey(e.target.value)}>
              {(defs ?? []).map((d) => (<MenuItem key={d.key} value={d.key}>{d.title}</MenuItem>))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Patient</InputLabel>
            <Select label="Patient" value={active} onChange={(e: SelectChangeEvent) => setPatientId(e.target.value)}>
              {(patients ?? []).map((p) => (<MenuItem key={p.id} value={p.id}>{p.name} · {p.mrn}</MenuItem>))}
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      {chart.error && <Alert severity="error">{chart.error}</Alert>}

      {chart.data && (
        <>
          {/* One summary row per plotted series — never a pooled cross-side number. */}
          {(summary.data ?? []).map((sm) => (
            <Box key={sm.side ?? 'all'} sx={{ mb: 2 }}>
              {chart.data!.definition.splitByLaterality && (
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{sideLabel(sm.side)}</Typography>
              )}
              <Grid container spacing={2}>
                {(
                  [
                    ['latest', sm.latest, sm.latestFlag !== 'normal' && sm.latestFlag !== 'unknown' ? sm.latestFlag : chart.data!.definition.unit],
                    ['min', sm.min, chart.data!.definition.unit],
                    ['max', sm.max, chart.data!.definition.unit],
                    ['change', sm.delta, sm.direction],
                  ] as const
                ).map(([label, v, sub]) => (
                  <Grid item xs={6} sm={3} key={label}>
                    <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
                      <CardContent sx={{ py: 1.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: label === 'latest' && (sm.latestFlag === 'high' || sm.latestFlag === 'low') ? 'error.main' : 'text.primary' }}>{v ?? '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">{label} · {sub}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ))}

          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                {chart.data.definition.title} ({chart.data.definition.unit})
              </Typography>
              <TrendSvg data={chart.data} />
              {/* Legend: series (sides) + bands. */}
              <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                {chart.data.series.map((s, i) => (
                  <Stack key={s.side ?? 'all'} direction="row" spacing={0.5} alignItems="center">
                    <Box sx={{ width: 14, height: 3, bgcolor: SIDE_HUE[i % SIDE_HUE.length], borderRadius: 1 }} />
                    <Typography variant="caption" color="text.secondary">{sideLabel(s.side)}</Typography>
                  </Stack>
                ))}
                {chart.data.referenceBands.map((b) => (
                  <Stack key={b.label} direction="row" spacing={0.5} alignItems="center">
                    <Box sx={{ width: 10, height: 10, bgcolor: BAND_HUE[b.color] ?? '#999', opacity: 0.35, borderRadius: 0.5 }} />
                    <Typography variant="caption" color="text.secondary">{b.label}</Typography>
                  </Stack>
                ))}
              </Stack>
              {!!chart.data.annotations.length && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Annotations</Typography>
                  {chart.data.annotations.map((a) => (
                    <Typography key={a.id} variant="body2">
                      <Chip size="small" variant="outlined" label={a.atDateTime.slice(0, 10)} sx={{ mr: 1 }} />
                      {a.label}{a.side ? ` (${sideLabel(a.side)})` : ''}
                    </Typography>
                  ))}
                </Box>
              )}
              {!chart.data.series.some((s) => s.points.length) && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  No data recorded for this chart yet.
                </Typography>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}

function sideLabel(side: string | null): string {
  if (!side) return 'All';
  if (side === 'RIGHT') return 'Right (OD)';
  if (side === 'LEFT') return 'Left (OS)';
  return side.charAt(0) + side.slice(1).toLowerCase();
}

// --- The SVG chart ---------------------------------------------------------
function TrendSvg({ data }: { data: ChartData }) {
  const theme = useTheme();
  const W = 720;
  const H = 260;
  const pad = { l: 40, r: 16, t: 12, b: 28 };

  const geom = useMemo(() => {
    const allPts = data.series.flatMap((s) => s.points);
    if (!allPts.length) return null;
    const times = allPts.map((p) => new Date(p.t).getTime());
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    // Y range: prefer the definition's explicit axis, else fit the data (with the
    // target line included so it is always on-canvas).
    const vals = allPts.map((p) => p.value).concat(data.targetLines.map((t) => t.value));
    const yMin = data.definition.yMin ?? Math.min(...vals);
    const yMax = data.definition.yMax ?? Math.max(...vals);
    const spanT = tMax - tMin || 1;
    const spanY = yMax - yMin || 1;
    const x = (t: string) => pad.l + ((new Date(t).getTime() - tMin) / spanT) * (W - pad.l - pad.r);
    const y = (v: number) => pad.t + (1 - (v - yMin) / spanY) * (H - pad.t - pad.b);
    return { x, y, yMin, yMax };
  }, [data]);

  const axis = theme.palette.divider;
  const text = theme.palette.text.secondary;
  if (!geom) {
    return (
      <Box sx={{ height: 120, display: 'grid', placeItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">Nothing to plot.</Typography>
      </Box>
    );
  }
  const { x, y, yMin, yMax } = geom;

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: 'block' }}>
        {/* Reference bands as translucent horizontal bins. */}
        {data.referenceBands.map((b) => {
          const top = y(Math.min(b.high ?? yMax, yMax));
          const bot = y(Math.max(b.low ?? yMin, yMin));
          return (
            <rect key={b.label} x={pad.l} y={top} width={W - pad.l - pad.r} height={Math.max(0, bot - top)}
              fill={BAND_HUE[b.color] ?? '#999'} opacity={0.13} />
          );
        })}
        {/* Y axis + a few gridline labels. */}
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke={axis} />
        <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke={axis} />
        {[yMin, (yMin + yMax) / 2, yMax].map((v) => (
          <text key={v} x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill={text}>{Math.round(v)}</text>
        ))}
        {/* Target lines (dashed). */}
        {data.targetLines.map((tl) => (
          <g key={tl.label}>
            <line x1={pad.l} y1={y(tl.value)} x2={W - pad.r} y2={y(tl.value)} stroke={theme.palette.text.primary} strokeDasharray="4 4" opacity={0.5} />
            <text x={W - pad.r} y={y(tl.value) - 3} textAnchor="end" fontSize="10" fill={text}>{tl.label} {tl.value}</text>
          </g>
        ))}
        {/* Annotation markers (vertical). */}
        {data.annotations.map((a) => (
          <line key={a.id} x1={x(a.atDateTime)} y1={pad.t} x2={x(a.atDateTime)} y2={H - pad.b}
            stroke={theme.palette.warning.main} strokeDasharray="2 3" opacity={0.7} />
        ))}
        {/* One polyline + points per series. */}
        {data.series.map((s, i) => {
          if (!s.points.length) return null;
          const hue = SIDE_HUE[i % SIDE_HUE.length];
          const d = s.points.map((p, j) => `${j ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
          return (
            <g key={s.side ?? 'all'}>
              <path d={d} fill="none" stroke={hue} strokeWidth={2} />
              {s.points.map((p) => {
                const band = data.referenceBands.find((b) => (b.low === undefined || p.value >= b.low) && (b.high === undefined || p.value <= b.high));
                return <circle key={p.t} cx={x(p.t)} cy={y(p.value)} r={3.5} fill={band ? (BAND_HUE[band.color] ?? hue) : hue} stroke={hue} />;
              })}
            </g>
          );
        })}
      </svg>
    </Box>
  );
}
