/**
 * LeadFunnelChart — horizontal stacked bars, one per lead status.
 * Feeds off /crm/funnel. The endpoint groups by STATUS, not by source;
 * see docs/contracts/crm-funnel.md for the reasoning.
 */
import { Box, Chip, Skeleton, Stack, Typography, useTheme } from '@mui/material';
import type { CrmFunnel } from '../../api/contracts/clinic-ops';

export interface LeadFunnelChartProps {
  data?: CrmFunnel;
  loading?: boolean;
  error?: string | null;
}

// A stable palette per status; anything not listed falls back to grey.
const STATUS_COLOURS: Record<string, string> = {
  NEW: '#3b82f6',
  CONTACTED: '#8b5cf6',
  QUALIFIED: '#f59e0b',
  CONVERTED: '#10b981',
  LOST: '#ef4444',
};

const STATUS_ORDER = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];

export function LeadFunnelChart({ data, loading, error }: LeadFunnelChartProps) {
  const theme = useTheme();

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
  if (!data || data.total === 0) {
    return (
      <Typography color="text.secondary">
        No leads yet. Capture the first from WhatsApp or the website intake form.
      </Typography>
    );
  }

  const statuses = STATUS_ORDER.filter((s) => data.byStatus[s] != null);
  const max = Math.max(...statuses.map((s) => data.byStatus[s] ?? 0));

  return (
    <Box>
      <Stack spacing={1.25}>
        {statuses.map((status) => {
          const count = data.byStatus[status] ?? 0;
          const widthPct = max ? (count / max) * 100 : 0;
          const colour = STATUS_COLOURS[status] ?? theme.palette.grey[400];
          return (
            <Stack key={status} direction="row" alignItems="center" spacing={2}>
              <Typography variant="caption" sx={{ width: 90, fontWeight: 600 }}>
                {status}
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
              <Typography variant="body2" sx={{ width: 56, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {count.toLocaleString()}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mt={2}>
        <Typography variant="caption" color="text.secondary">
          {data.total.toLocaleString()} total leads
        </Typography>
        <Chip label={`${data.conversionRatePct}% conversion`} size="small" color="success" variant="outlined" />
      </Stack>
    </Box>
  );
}
