/**
 * StatCard — the four-tile row at the top of every dashboard.
 *
 * Renders a labelled number plus a period-over-period delta chip. Handles
 * the four states the underlying endpoint reports:
 *
 *   loading   — grey skeleton, no number, no delta
 *   populated — number + coloured delta chip
 *   empty     — number is 0, delta chip reads "—" (not an error)
 *   error     — a subtitle explains, no number, no delta
 *
 * Colours: green for positive delta, red for negative. Direction only;
 * no per-metric "up is good" logic ("outstanding balance up" is neutral
 * — the caller decides).
 */
import type { ReactNode } from 'react';
import type { SvgIconComponent } from '@mui/icons-material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RemoveIcon from '@mui/icons-material/Remove';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Box, Card, CardContent, Skeleton, Stack, Typography, useTheme } from '@mui/material';

export interface StatCardProps {
  label: string;
  /** The formatted primary value (e.g. "356", "Rs 24,854,000"). Not read for delta computation. */
  value: string | null;
  /** Signed percentage, one decimal. null = comparison unavailable ("—"). */
  deltaPct?: number | null;
  /** One-line context under the delta chip. Typically "vs Apr 1 – Apr 30, 2026". */
  compareLabel?: string;
  icon: SvgIconComponent;
  /** Background tint for the icon square; defaults to primary. */
  accent?: 'primary' | 'success' | 'info' | 'warning';
  loading?: boolean;
  /** If set, replaces the value+delta with a one-line error message. */
  error?: string | null;
  /** Plan boundary: the clinic's edition doesn't include this metric. Shown as
   *  a calm "not in plan" note, not an error. Takes precedence over `error`. */
  notInPlan?: boolean;
}

const ACCENT_BG: Record<NonNullable<StatCardProps['accent']>, string> = {
  primary: 'primary.main',
  success: 'success.main',
  info:    'info.main',
  warning: 'warning.main',
};

export default function StatCard({
  label,
  value,
  deltaPct,
  compareLabel,
  icon: Icon,
  accent = 'primary',
  loading = false,
  error = null,
  notInPlan = false,
}: StatCardProps) {
  return (
    <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: ACCENT_BG[accent],
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <Icon fontSize="small" />
          </Box>
        </Stack>

        <Box sx={{ mt: 1.5, minHeight: 60 }}>
          {loading ? (
            <>
              <Skeleton variant="text" width="60%" height={40} />
              <Skeleton variant="text" width="80%" height={20} sx={{ mt: 0.5 }} />
            </>
          ) : notInPlan ? (
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary' }}>
              <LockOutlinedIcon fontSize="small" />
              <Typography variant="body2">Not in your plan</Typography>
            </Stack>
          ) : error ? (
            <Typography variant="body2" color="error.main">
              {error}
            </Typography>
          ) : (
            <>
              <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                {value ?? '0'}
              </Typography>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75 }}>
                <DeltaChip deltaPct={deltaPct} />
                {compareLabel && (
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {compareLabel}
                  </Typography>
                )}
              </Stack>
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function DeltaChip({ deltaPct }: { deltaPct?: number | null }): ReactNode {
  const theme = useTheme();

  // null / undefined => the comparison period had no data, so no delta is
  // meaningful. Renders as an em dash so the cell keeps a stable width.
  if (deltaPct == null) {
    return (
      <Stack direction="row" spacing={0.25} alignItems="center" sx={{ color: theme.palette.text.disabled }}>
        <RemoveIcon sx={{ fontSize: 14 }} />
        <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1 }}>—</Typography>
      </Stack>
    );
  }

  const up = deltaPct > 0;
  const down = deltaPct < 0;
  const color = up ? theme.palette.success.main : down ? theme.palette.error.main : theme.palette.text.secondary;
  const Icon = up ? ArrowUpwardIcon : down ? ArrowDownwardIcon : RemoveIcon;
  const abs = Math.abs(deltaPct).toFixed(1);

  return (
    <Stack direction="row" spacing={0.25} alignItems="center" sx={{ color }}>
      <Icon sx={{ fontSize: 14 }} />
      <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1 }}>
        {abs}%
      </Typography>
    </Stack>
  );
}
