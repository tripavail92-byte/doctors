/**
 * PlanNotIncluded — the quiet inline state a dashboard widget shows when the
 * clinic's edition does not include that feature (a plan-boundary 403).
 *
 * Deliberately calm: this is not an error. The dashboard is the landing page,
 * so a widget the clinic hasn't bought must read as "available on a higher
 * plan", not as something broken. The page-level error banner is suppressed for
 * these (see useApi's silencePlanErrors) precisely so this can speak instead.
 */
import { Box, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

export function PlanNotIncluded({ feature }: { feature?: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        alignItems: 'center',
        color: 'text.secondary',
        py: 2,
      }}
    >
      <LockOutlinedIcon fontSize="small" />
      <Typography variant="body2">
        {feature
          ? `${feature} isn't included in this clinic's plan.`
          : "Not included in this clinic's plan."}
      </Typography>
    </Box>
  );
}
