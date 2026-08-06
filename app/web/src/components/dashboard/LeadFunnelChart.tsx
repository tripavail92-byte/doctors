/**
 * LeadFunnelChart — horizontal bars, one per funnel row, with a footer.
 *
 * View-agnostic on purpose. The ops dashboard offers two funnels over the
 * same widget via a toggle:
 *   - "By status" — /crm/funnel, grouped by pipeline status (NEW→CONVERTED)
 *   - "By source" — /crm/lead-sources, grouped by acquisition channel
 * The page maps whichever dataset is active into `bars` + `footerLabel`.
 * See docs/contracts/crm-funnel.md and crm-lead-sources.md.
 */
import { Box, Chip, Skeleton, Stack, Typography } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

export interface FunnelBar {
  key: string;
  label: string;
  count: number;
  /** Signed percentage vs the prior period; null/undefined = no chip. */
  deltaPct?: number | null;
}

export interface LeadFunnelChartProps {
  bars?: FunnelBar[];
  total?: number;
  /** e.g. "18.5% conversion". Rendered in a chip in the footer. */
  footerLabel?: string;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
}

// A stable palette keyed by the well-known status/source keys; anything not
// listed rotates through a neutral sequence so every bar still gets a colour.
const KEY_COLOURS: Record<string, string> = {
  // status
  NEW: '#3b82f6', CONTACTED: '#8b5cf6', QUALIFIED: '#f59e0b', CONVERTED: '#10b981', LOST: '#ef4444',
  // source
  FACEBOOK: '#1877f2', WHATSAPP: '#25d366', WEBSITE: '#6366f1', INSTAGRAM: '#e1306c',
  REFERRAL: '#f59e0b', WALK_IN: '#14b8a6', CONSULTATION_BOOKED: '#10b981', OTHER: '#94a3b8',
};
const ROTATION = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];

export function LeadFunnelChart({
  bars,
  total,
  footerLabel,
  loading,
  error,
  emptyMessage = 'No leads yet. Capture the first from WhatsApp or the website intake form.',
}: LeadFunnelChartProps) {
  if (loading) {
    return (
      <Stack spacing={1.5}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={40} />
        ))}
      </Stack>
    );
  }
  if (error) return <Typography color="error">{error}</Typography>;
  if (!bars || bars.length === 0 || (total ?? 0) === 0) {
    return <Typography color="text.secondary">{emptyMessage}</Typography>;
  }

  const max = Math.max(...bars.map((b) => b.count), 1);

  return (
    <Box>
      <Stack spacing={1.25}>
        {bars.map((b, i) => {
          const widthPct = (b.count / max) * 100;
          const colour = KEY_COLOURS[b.key] ?? ROTATION[i % ROTATION.length];
          const up = (b.deltaPct ?? 0) >= 0;
          return (
            <Stack key={b.key} direction="row" alignItems="center" spacing={1.5}>
              <Typography variant="caption" sx={{ width: 130, fontWeight: 600 }} noWrap title={b.label}>
                {b.label}
              </Typography>
              <Box sx={{ flex: 1, position: 'relative', height: 24, borderRadius: 1, bgcolor: 'action.hover' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    width: `${widthPct}%`,
                    bgcolor: colour,
                    borderRadius: 1,
                    transition: 'width 300ms ease',
                  }}
                />
              </Box>
              <Typography variant="body2" sx={{ width: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {b.count.toLocaleString()}
              </Typography>
              {b.deltaPct != null ? (
                <Stack direction="row" alignItems="center" spacing={0.25} sx={{ width: 64, justifyContent: 'flex-end' }}>
                  {up ? (
                    <ArrowUpwardIcon sx={{ fontSize: 14, color: 'success.main' }} />
                  ) : (
                    <ArrowDownwardIcon sx={{ fontSize: 14, color: 'error.main' }} />
                  )}
                  <Typography variant="caption" sx={{ color: up ? 'success.main' : 'error.main', fontWeight: 600 }}>
                    {Math.abs(b.deltaPct).toFixed(1)}%
                  </Typography>
                </Stack>
              ) : (
                <Box sx={{ width: 64 }} />
              )}
            </Stack>
          );
        })}
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mt={2}>
        <Typography variant="caption" color="text.secondary">
          {(total ?? 0).toLocaleString()} total leads
        </Typography>
        {footerLabel && (
          <Chip label={footerLabel} size="small" color="success" variant="outlined" />
        )}
      </Stack>
    </Box>
  );
}
