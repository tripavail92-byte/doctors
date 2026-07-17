// ReportsPage: revenue breakdown driven by the live /reports/revenue endpoint.
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { apiClient } from '../api/client';
import { pkr, useApi } from '../api/useApi';
import type { RevenueReport } from '../api/types';

export default function ReportsPage() {
  const { data, loading, error } = useApi<RevenueReport>(() =>
    apiClient.get<RevenueReport>('/reports/revenue').then((r) => r.data),
  );

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Revenue
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Clinic + pharmacy revenue by payment method — net of refunds.
      </Typography>

      {loading && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      {data && (
        <>
          <Card
            elevation={0}
            sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 3, bgcolor: 'primary.main', color: '#fff' }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Net revenue
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {pkr(data.netRevenuePkr)}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                clinic {pkr(data.clinic.totalPkr)} + pharmacy {pkr(data.pharmacy.totalPkr)} − refunds {pkr(data.refundsPkr)}
              </Typography>
            </CardContent>
          </Card>

          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <MethodPanel title="Clinic" total={data.clinic.totalPkr} byMethod={data.clinic.byMethod} />
            </Grid>
            <Grid item xs={12} md={6}>
              <MethodPanel title="Pharmacy" total={data.pharmacy.totalPkr} byMethod={data.pharmacy.byMethod} />
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}

function MethodPanel({
  title,
  total,
  byMethod,
}: {
  title: string;
  total: number;
  byMethod: Record<string, number>;
}) {
  const entries = Object.entries(byMethod);
  return (
    <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, height: '100%' }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
          {title}
        </Typography>
        {entries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No payments recorded.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={1}>
            {entries.map(([method, amount]) => (
              <Stack key={method} direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  {method}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {pkr(amount)}
                </Typography>
              </Stack>
            ))}
            <Stack direction="row" justifyContent="space-between" sx={{ pt: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Total
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {pkr(total)}
              </Typography>
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
