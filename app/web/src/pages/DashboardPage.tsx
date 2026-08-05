// DashboardPage: clinic overview.
//
// The financial cards were the entire dashboard. That call — GET
// /reports/summary — is guarded by @Roles(OWNER, ADMIN, FINANCE) AND
// @RequiresEntitlement('reporting.core') (which is CLINIC_ADDONS), so SOLO
// tenants and every non-financial role in every other tenant landed on / and
// were greeted with a red 403 banner. A landing page is what a person sees
// FIRST, and the first thing they saw was an error rendered as if the product
// had broken. Reported on Awais' demo tenant twice.
//
// So the page is now split. The top block is ungated — what any authenticated
// user in any edition can see, and it needs zero calls the entitlement/role
// system can deny. The financial block still hits /reports/summary, but ONLY
// when the user is authorised: for anyone else it is deliberately absent, not
// an error.
//
// "Deliberately absent" matters. The alternative — render the request and let
// the fetch-error banner explain — was the shipped behaviour and is misleading
// twice over: it uses a request nobody expected to work, and it uses an ERROR
// alert for something that was never an error.
import type { ReactNode } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
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
import { useAuth } from '../auth/AuthContext';

// Kept in one place so a change here does not silently disagree with the
// backend guard on /reports/summary (reports.controller.ts @Roles + entitlement).
const FINANCIAL_ROLES = new Set(['OWNER', 'ADMIN', 'FINANCE']);
const FINANCIAL_ENTITLEMENT = 'reporting.core';

export default function DashboardPage() {
  const { user } = useAuth();
  if (user?.isPlatformAdmin) return <Navigate to="/admin/tenants" replace />;

  const canSeeFinancials =
    !!user &&
    FINANCIAL_ROLES.has(user.role) &&
    user.entitlements.has(FINANCIAL_ENTITLEMENT);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Welcome{user?.email ? `, ${user.email}` : ''}.
      </Typography>

      {/* Ungated shortcut tiles — no roles, no entitlements. Every authenticated
          user in every edition renders these without a network call, so the
          landing page can never be an error page. */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <ShortcutCard
          label="Patients"
          hint="Register, search, and open a chart."
          to="/patients"
          icon={PeopleIcon}
        />
        <ShortcutCard
          label="Trends"
          hint="Longitudinal readings by chart definition."
          to="/trends"
          icon={TrendingUpIcon}
        />
        <ShortcutCard
          label="Billing"
          hint="Invoices, payments, and refunds."
          to="/billing"
          icon={AccountBalanceWalletIcon}
        />
        <ShortcutCard
          label="Laboratory"
          hint="Orders, results, and reports."
          to="/lab"
          icon={ScienceIcon}
        />
      </Grid>

      {canSeeFinancials ? (
        <FinancialSummary />
      ) : (
        <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Financial summary is not shown here
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {user && FINANCIAL_ROLES.has(user.role)
                ? "This clinic's plan does not include reporting. Ask a platform admin about the reporting.core add-on."
                : 'Your role does not include financial reporting. An OWNER, ADMIN, or FINANCE user has these numbers on their dashboard.'}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

// The old dashboard: unchanged content, extracted so the /reports/summary
// call is issued ONLY when the caller is authorised to make it.
function FinancialSummary() {
  const { data, loading, error } = useApi<ReportSummary>(() =>
    apiClient.get<ReportSummary>('/reports/summary').then((r) => r.data),
  );

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  return (
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
  );
}

function ShortcutCard({
  label,
  hint,
  to,
  icon: Icon,
}: {
  label: string;
  hint: string;
  to: string;
  icon: SvgIconComponent;
}) {
  return (
    <Grid item xs={12} sm={6} md={3}>
      <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, height: '100%' }}>
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
          <Typography variant="body2" sx={{ mt: 1.5, mb: 2, minHeight: 40 }}>
            {hint}
          </Typography>
          <Button component={RouterLink} to={to} size="small" variant="outlined">
            Open
          </Button>
        </CardContent>
      </Card>
    </Grid>
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
