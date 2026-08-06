/**
 * DonutChart — SVG-only donut, no chart library.
 *
 * The reference dashboard shows a ~350px donut with a slice per specialty
 * and a legend beside it. That is a five-line SVG per slice; a chart
 * library would add >100kb to the bundle for a control we render three
 * times in the whole app. When the third dashboard needs a REAL chart
 * (line chart with axes, tooltips, brush) we can reach for one — this
 * component intentionally does the minimum well.
 *
 * Colour by key: DERMATOLOGY / DENTAL / PEDIATRICS / GENERAL / PHYSIOTHERAPY.
 * Anything unknown falls back to grey, so the chart still renders when a
 * new specialty ships without a colour entry.
 */
import { Box, Stack, Typography, useTheme } from '@mui/material';

export interface DonutDatum {
  key: string;
  label: string;
  count: number;
  pct?: number;
  /** Optional explicit color. When set, overrides the COLOR_BY_KEY palette. */
  color?: string;
}

export interface DonutChartProps {
  data: DonutDatum[];
  total: number;
  centerLabel?: string;
  /** SVG viewport side; also the height. Legend stacks to the right at md+, below at xs. */
  size?: number;
  /** Custom formatter for the center number. Defaults to en-PK locale. */
  formatCenter?: (n: number) => string;
}

// The palette maps the Edition-like keys the backend sends. Keys not in the
// map render in a neutral grey; the legend still labels them.
const COLOR_BY_KEY: Record<string, string> = {
  DERMATOLOGY:   '#3B82F6', // blue
  DENTAL:        '#10B981', // green
  PEDIATRICS:    '#8B5CF6', // violet
  GENERAL:       '#F59E0B', // amber
  PHYSIOTHERAPY: '#EF4444', // red
  OBGYN:         '#EC4899', // pink
  OPHTHALMOLOGY: '#06B6D4', // cyan
  SPECIALTY:     '#6366F1', // indigo
  LAB:           '#14B8A6', // teal
  PHARMACY:      '#F97316', // orange
  HOSPITAL:      '#0EA5E9', // sky
  SOLO:          '#64748B', // slate
  CLINIC:        '#0F766E', // primary teal
  ENTERPRISE:    '#0369A1', // deep blue
};
const FALLBACK = '#94A3B8';

export default function DonutChart({ data, total, centerLabel, size = 220, formatCenter }: DonutChartProps) {
  const theme = useTheme();

  // A single 100% slice ("Dermatology" only) would render as a full circle
  // with a zero-length arc, which most SVG renderers show as nothing. The
  // "single-bucket = solid ring" branch below handles it explicitly.
  const nonZero = data.filter((d) => d.count > 0);
  const singleBucket = nonZero.length === 1;

  if (total === 0 || nonZero.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">No data to show.</Typography>
      </Box>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.28;

  // Each slice is a donut ring segment drawn as a path with two arcs and
  // two straight radii. When a slice has to sweep more than 180°, the SVG
  // `large-arc-flag` must flip — that is the `sweep > 0.5` check below.
  let cursor = 0;
  const slices = nonZero.map((d) => {
    const sweep = d.count / total;
    const startAngle = cursor * 2 * Math.PI - Math.PI / 2;
    const endAngle = (cursor + sweep) * 2 * Math.PI - Math.PI / 2;
    cursor += sweep;
    const largeArc = sweep > 0.5 ? 1 : 0;
    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);
    const xi2 = cx + innerR * Math.cos(endAngle);
    const yi2 = cy + innerR * Math.sin(endAngle);
    const xi1 = cx + innerR * Math.cos(startAngle);
    const yi1 = cy + innerR * Math.sin(startAngle);
    const path = [
      `M ${x1} ${y1}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${xi2} ${yi2}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${xi1} ${yi1}`,
      'Z',
    ].join(' ');
    return { d, path, color: d.color ?? COLOR_BY_KEY[d.key] ?? FALLBACK };
  });

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="center">
      <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Clinic type distribution">
          {singleBucket ? (
            <>
              <circle cx={cx} cy={cy} r={outerR} fill={slices[0].color} />
              <circle cx={cx} cy={cy} r={innerR} fill={theme.palette.background.paper} />
            </>
          ) : (
            slices.map((s) => <path key={s.d.key} d={s.path} fill={s.color} />)
          )}
        </svg>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>
              {formatCenter ? formatCenter(total) : total.toLocaleString('en-PK')}
            </Typography>
            {centerLabel && (
              <Typography variant="caption" color="text.secondary">
                {centerLabel}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      <Stack spacing={1} sx={{ minWidth: 0, flexGrow: 1 }}>
        {data.map((d) => (
          <Stack key={d.key} direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: d.color ?? COLOR_BY_KEY[d.key] ?? FALLBACK,
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {d.label}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {d.count.toLocaleString('en-PK')} ({((d.pct ?? (total ? (d.count / total) * 100 : 0))).toFixed(1)}%)
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
