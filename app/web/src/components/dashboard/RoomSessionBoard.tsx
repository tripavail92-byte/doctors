/**
 * RoomSessionBoard — one row per treatment room, showing what's happening
 * right now. Feeds off /sessions/in-progress.
 *
 * States handled: loading, empty, populated, error. When a room is idle
 * (session === null) the row shows "Available" instead of skipping — the
 * grid is a live view of the physical rooms, not just of active sessions.
 */
import { Box, Card, CardContent, Chip, LinearProgress, Skeleton, Stack, Typography } from '@mui/material';
import type { RoomStatusRow } from '../../api/contracts/clinic-ops';
import { PersonAvatar } from './PersonAvatar';

export interface RoomSessionBoardProps {
  rooms?: RoomStatusRow[];
  loading?: boolean;
  error?: string | null;
}

function fmtMin(m: number): string {
  return `${Math.max(0, Math.round(m))} min`;
}

export function RoomSessionBoard({ rooms, loading, error }: RoomSessionBoardProps) {
  if (loading) {
    return (
      <Stack spacing={1.5}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={72} />
        ))}
      </Stack>
    );
  }
  if (error) return <Typography color="error">{error}</Typography>;
  if (!rooms || rooms.length === 0) {
    return <Typography color="text.secondary">No rooms configured.</Typography>;
  }
  return (
    <Stack spacing={1.5}>
      {rooms.map((row) => (
        <Card key={row.roomId} variant="outlined">
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            {row.session ? (
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {row.roomLabel}
                  </Typography>
                  <Chip
                    label={row.session.status.replace(/_/g, ' ').toLowerCase()}
                    size="small"
                    color={row.session.progressPct >= 100 ? 'warning' : 'primary'}
                    variant="outlined"
                  />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PersonAvatar name={row.session.patient.name} size={24} />
                  <Typography variant="body2" color="text.primary">
                    {row.session.patient.name} · {row.session.service}
                  </Typography>
                </Stack>
                <Box mt={1}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, row.session.progressPct)}
                    sx={{ height: 6, borderRadius: 3 }}
                    color={row.session.progressPct >= 100 ? 'warning' : 'primary'}
                  />
                  <Stack direction="row" justifyContent="space-between" mt={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      {fmtMin(row.session.elapsedMin)} elapsed
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {fmtMin(row.session.remainingMin)} left
                    </Typography>
                  </Stack>
                </Box>
              </Box>
            ) : (
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" fontWeight={600}>
                  {row.roomLabel}
                </Typography>
                <Chip label="Available" size="small" variant="outlined" />
              </Stack>
            )}
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
