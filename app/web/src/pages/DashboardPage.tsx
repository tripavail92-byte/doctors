// DashboardPage: clinic overview driven by the live /reports/summary endpoint.
import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import PeopleIcon from '@mui/icons-material/People';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ScienceIcon from '@mui/icons-material/Science';
import { apiClient } from '../api/client';
import { pkr, useApi } from '../api/useApi';
import type { ReportSummary } from '../api/types';

export default function DashboardPage() {
  const { data, loading, error } = useApi<ReportSummary>(() =>
    apiClient.get<ReportSummary>('/reports/summary').then((r) => r.data),
  );

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Clinic overview — live from the API.
      </Typography>

      {loading && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      {data && (
        <>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <StatCard label="Patients" value={String(data.patients)} icon={PeopleIcon} />
            <StatCard label="Collected" value={pkr(data.billing.collectedPkr)} icon={TrendingUpIcon} />
            <StatCard label="Outstanding" value={pkr(data.billing.outstandingPkr)} icon={AccountBalanceWalletIcon} />
            <StatCard label="Lab orders" value={String(data.lab.orders)} icon={ScienceIcon} />
          </Grid>

          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <Panel title="Billing">
                <KeyRow label="Invoices" value={String(data.billing.invoices)} />
                <KeyRow label="Billed" value={pkr(data.billing.billedPkr)} />
                <KeyRow label="Collected" value={pkr(data.billing.collectedPkr)} />
                <KeyRow label="Payments" value={pkr(data.billing.paymentsPkr)} />
                <KeyRow label="Refunds" value={pkr(data.billing.refundsPkr)} />
                <Box sx={{ mt: 1.5 }}>
                  <StatusChips byStatus={data.billing.byStatus} />
                </Box>
              </Panel>
            </Grid>

            <Grid item xs={12} md={6}>
              <Panel title="Clinical activity">
                <KeyRow label="Active packs" value={String(data.activePacks)} />
                <KeyRow label="Encounters" value={String(data.encounters.total)} />
                <KeyRow label="Immunizations" value={String(data.clinical.immunizations)} />
                <KeyRow label="Instrument scores" value={String(data.clinical.instrumentResponses)} />
                <KeyRow label="Observations" value={String(data.clinical.observations)} />
                <KeyRow label="Pharmacy dispenses" value={String(data.pharmacy.dispenses)} />
              </Panel>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: SvgIconComponent }) {
  return (
    <Grid item xs={12} sm={6} md={3}>
      <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
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
                bgcolor: 'primary.main',
                color: '#fff',
              }}
            >
              <Icon fontSize="small" />
            </Box>
          </Stack>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 1.5 }}>
            {value}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, height: '100%' }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function KeyRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </Stack>
  );
}

function StatusChips({ byStatus }: { byStatus: Record<string, number> }) {
  const entries = Object.entries(byStatus);
  if (entries.length === 0) return null;
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {entries.map(([status, count]) => (
        <Chip key={status} size="small" variant="outlined" label={`${status} · ${count}`} />
      ))}
    </Stack>
  );
}
