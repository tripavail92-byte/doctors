/**
 * PlatformDashboardPage — /admin/dashboard.
 *
 * The landing screen for a Platform Super Admin. Six widgets, six endpoints,
 * six contracts under docs/contracts/. Each widget reads one endpoint via
 * useApi, renders four states cleanly, and is stubbable with VITE_STUB_API=1
 * for design-time work.
 *
 * Not to be confused with the CLINIC ops dashboard (/) which is what a
 * clinic OWNER lands on. The platform admin has no tenant and is redirected
 * to /admin/dashboard from DashboardPage.tsx.
 */
import { useMemo, useState } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import BusinessIcon from '@mui/icons-material/Business';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CircleIcon from '@mui/icons-material/Circle';
import { apiClient } from '../../api/client';
import { useApi } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import StatCard from '../../components/dashboard/StatCard';
import DonutChart from '../../components/dashboard/DonutChart';
import ModuleTile from '../../components/dashboard/ModuleTile';
import WidgetBoundary from '../../components/dashboard/WidgetBoundary';
import { iconForModule } from '../../components/dashboard/moduleIcons';
import type {
  ClinicDistribution,
  OnboardingActivityResponse,
  PlatformSummary,
  PopularModulesResponse,
  SummaryPeriod,
  TenantListResponse,
  TenantRow,
} from '../../api/contracts/platform';

const PKR = (n: number) => 'Rs ' + n.toLocaleString('en-PK');
const NUM = (n: number) => n.toLocaleString('en-PK');
const dtDate = (iso: string) => new Date(iso).toLocaleDateString('en-PK');
const dtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });

const PAGE_SIZE = 5;

/**
 * Adapter for a legacy /platform/tenants response.
 *
 * The endpoint exists and returns Tenant[] (used by TenantsPage). The new
 * dashboard contract expects { total, limit, offset, rows } with per-row
 * `branches` and `modules`. Until the backend catches up, tolerate the
 * legacy shape so the dashboard renders instead of throwing on
 * `undefined.rows.length` and taking the whole page down (real production
 * incident — see WidgetBoundary).
 *
 * When the backend serves the new shape, this becomes a no-op and can be
 * removed. Callers should NOT rely on the legacy branch existing.
 */
function adaptTenantList(raw: TenantListResponse | TenantRow[] | undefined | null): TenantListResponse {
  if (Array.isArray(raw)) {
    return {
      total: raw.length,
      limit: raw.length,
      offset: 0,
      rows: raw.map((r) => ({
        ...r,
        // Legacy shape has no branches/modules — fill safely so the row renders.
        branches: (r as unknown as { branches?: number }).branches ?? 0,
        modules: (r as unknown as { modules?: TenantRow['modules'] }).modules ?? [],
      })),
    };
  }
  return raw ?? { total: 0, limit: 0, offset: 0, rows: [] };
}

const HUE_ROTATION: Array<'blue' | 'green' | 'violet' | 'amber' | 'teal' | 'pink'> = [
  'blue', 'green', 'violet', 'amber', 'teal', 'pink', 'blue', 'green',
];

export default function PlatformDashboardPage() {
  const { user } = useAuth();
  // Belt over the RolesGuard on the endpoints below — a clinic OWNER who
  // typed the URL should not see a half-rendered dashboard. Also matches
  // the AppShell nav filter, so the flow reads consistently.
  if (!user) return null;
  if (!user.isPlatformAdmin) return <Navigate to="/" replace />;

  const [period, setPeriod] = useState<SummaryPeriod>('this-month');
  const [offset, setOffset] = useState(0);

  const summary = useApi<PlatformSummary>(
    () => apiClient.get<PlatformSummary>('/platform/summary', { params: { period } }).then((r) => r.data),
    [period],
  );

  const distribution = useApi<ClinicDistribution>(
    () => apiClient.get<ClinicDistribution>('/platform/clinic-distribution').then((r) => r.data),
  );

  const tenants = useApi<TenantListResponse>(
    () =>
      apiClient
        // Deliberately the /paged variant, not /platform/tenants. The legacy
        // /platform/tenants endpoint returns Tenant[] and serves TenantsPage
        // — a live production page whose shape must not change under it. The
        // dashboard uses the new pagination contract at its own path. If the
        // /paged endpoint has not shipped yet (transitional), the adapter
        // downstream still tolerates a bare-array response so the page
        // renders instead of blank-crashing.
        .get<TenantListResponse | TenantRow[]>('/platform/tenants/paged', {
          params: { limit: PAGE_SIZE, offset },
        })
        .then((r) => adaptTenantList(r.data)),
    [offset],
  );

  const activity = useApi<OnboardingActivityResponse>(
    () =>
      apiClient
        .get<OnboardingActivityResponse>('/platform/onboarding-activity', { params: { limit: 5 } })
        .then((r) => r.data),
  );

  const modules = useApi<PopularModulesResponse>(
    () => apiClient.get<PopularModulesResponse>('/platform/popular-modules').then((r) => r.data),
  );

  const compareLabel = useMemo(() => {
    if (!summary.data) return '';
    const { from, to } = summary.data.comparedTo;
    return `vs ${dtDate(from)} – ${dtDate(to)}`;
  }, [summary.data]);

  return (
    <Box>
      {/* --- Header ------------------------------------------------------ */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Platform Super Admin
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Overview of your clinic management platform.
          </Typography>
        </Box>

        <PeriodSelector value={period} onChange={setPeriod} />
      </Stack>

      {/* --- Row 1: four stat cards --------------------------------------
          Wrapped individually so one card's render crash cannot take out
          the whole row, and definitely not the whole page. */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <WidgetBoundary label="Total Organizations">
          <StatCard
            label="Total Organizations"
            icon={BusinessIcon}
            accent="primary"
            loading={summary.loading}
            error={summary.error}
            value={summary.data ? NUM(summary.data.organizations.count) : null}
            deltaPct={summary.data?.organizations.deltaPct}
            compareLabel={compareLabel}
          />
          </WidgetBoundary>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <WidgetBoundary label="Total Clinics">
          <StatCard
            label="Total Clinics"
            icon={LocalHospitalIcon}
            accent="success"
            loading={summary.loading}
            error={summary.error}
            value={summary.data ? NUM(summary.data.clinics.count) : null}
            deltaPct={summary.data?.clinics.deltaPct}
            compareLabel={compareLabel}
          />
          </WidgetBoundary>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <WidgetBoundary label="Active Subscriptions">
          <StatCard
            label="Active Subscriptions"
            icon={CreditCardIcon}
            accent="info"
            loading={summary.loading}
            error={summary.error}
            value={summary.data ? NUM(summary.data.activeSubs.count) : null}
            deltaPct={summary.data?.activeSubs.deltaPct}
            compareLabel={compareLabel}
          />
          </WidgetBoundary>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <WidgetBoundary label="Monthly Recurring Revenue">
          <StatCard
            label="Monthly Recurring Revenue"
            icon={AttachMoneyIcon}
            accent="warning"
            loading={summary.loading}
            error={summary.error}
            value={summary.data ? PKR(summary.data.mrr.pkr) : null}
            deltaPct={summary.data?.mrr.deltaPct}
            compareLabel={compareLabel}
          />
          </WidgetBoundary>
        </Grid>
      </Grid>

      {/* --- Row 2: distribution donut + clinic clients table ------------- */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={5}>
          <WidgetBoundary label="Clinic Type Distribution">
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Clinic Type Distribution
                </Typography>
                <IconButton size="small" aria-label="More options">
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Stack>
              {distribution.loading ? (
                <Skeleton variant="circular" width={220} height={220} sx={{ mx: 'auto' }} />
              ) : distribution.error ? (
                <Alert severity="error">{distribution.error}</Alert>
              ) : distribution.data ? (
                <>
                  <DonutChart
                    data={distribution.data.buckets}
                    total={distribution.data.total}
                    centerLabel="Total Clinics"
                  />
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Button component={RouterLink} to="/admin/tenants" size="small">
                      View full report
                    </Button>
                  </Box>
                </>
              ) : null}
            </CardContent>
          </Card>
          </WidgetBoundary>
        </Grid>

        <Grid item xs={12} lg={7}>
          <WidgetBoundary label="Clinic Clients">
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, height: '100%' }}>
            <CardContent sx={{ pb: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Clinic Clients
                </Typography>
                <Button component={RouterLink} to="/admin/tenants" size="small">
                  View all
                </Button>
              </Stack>
            </CardContent>
            <ClinicClientsTable
              response={tenants.data}
              loading={tenants.loading}
              error={tenants.error}
              offset={offset}
              onPage={setOffset}
            />
          </Card>
          </WidgetBoundary>
        </Grid>
      </Grid>

      {/* --- Row 3: onboarding activity + popular modules ---------------- */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={5}>
          <WidgetBoundary label="Recent Onboarding Activity">
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Recent Onboarding Activity
                </Typography>
                <Button size="small">View all</Button>
              </Stack>
              <OnboardingFeed
                rows={activity.data?.rows}
                loading={activity.loading}
                error={activity.error}
              />
            </CardContent>
          </Card>
          </WidgetBoundary>
        </Grid>

        <Grid item xs={12} lg={7}>
          <WidgetBoundary label="Popular Modules">
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Popular Modules
                </Typography>
                <Button size="small">View all</Button>
              </Stack>
              {modules.loading ? (
                <Grid container spacing={2}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Grid item xs={6} md={3} key={i}>
                      <Skeleton variant="rounded" height={92} />
                    </Grid>
                  ))}
                </Grid>
              ) : modules.error ? (
                <Alert severity="error">{modules.error}</Alert>
              ) : (
                <Grid container spacing={2}>
                  {(modules.data?.modules ?? []).map((m, i) => (
                    <Grid item xs={6} md={3} key={m.key}>
                      <ModuleTile
                        moduleKey={m.key}
                        label={m.label}
                        activeClinics={m.activeClinics}
                        hue={HUE_ROTATION[i % HUE_ROTATION.length]}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
          </WidgetBoundary>
        </Grid>
      </Grid>
    </Box>
  );
}

// --- Period selector --------------------------------------------------------

function PeriodSelector({
  value,
  onChange,
}: {
  value: SummaryPeriod;
  onChange: (p: SummaryPeriod) => void;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <CalendarMonthIcon fontSize="small" color="action" />
      <Select
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value as SummaryPeriod)}
        sx={{ minWidth: 180 }}
      >
        <MenuItem value="this-month">This month</MenuItem>
        <MenuItem value="last-30d">Last 30 days</MenuItem>
        <MenuItem value="last-90d">Last 90 days</MenuItem>
        <MenuItem value="ytd">Year to date</MenuItem>
      </Select>
    </Stack>
  );
}

// --- Clinic Clients table ---------------------------------------------------

function ClinicClientsTable({
  response,
  loading,
  error,
  offset,
  onPage,
}: {
  response: TenantListResponse | null;
  loading: boolean;
  error: string | null;
  offset: number;
  onPage: (n: number) => void;
}) {
  if (loading && !response) {
    return (
      <Box sx={{ p: 2 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="text" height={44} />
        ))}
      </Box>
    );
  }
  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }
  if (!response || response.rows.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
        No clinics on the platform yet.
      </Box>
    );
  }

  const from = response.offset + 1;
  const to = Math.min(response.offset + response.rows.length, response.total);
  const canPrev = response.offset > 0;
  const canNext = response.offset + response.rows.length < response.total;

  return (
    <>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Organization</TableCell>
              <TableCell>Specialty</TableCell>
              <TableCell align="right">Branches</TableCell>
              <TableCell>Modules</TableCell>
              <TableCell>Status</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {response.rows.map((row) => (
              <ClinicRow key={row.id} row={row} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider' }}
      >
        <Typography variant="caption" color="text.secondary">
          {from}–{to} of {response.total.toLocaleString('en-PK')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" disabled={!canPrev} onClick={() => onPage(Math.max(0, offset - PAGE_SIZE))}>
            Prev
          </Button>
          <Button size="small" disabled={!canNext} onClick={() => onPage(offset + PAGE_SIZE)}>
            Next
          </Button>
        </Stack>
      </Stack>
    </>
  );
}

function ClinicRow({ row }: { row: TenantRow }) {
  const theme = useTheme();
  return (
    <TableRow hover>
      <TableCell sx={{ fontWeight: 500 }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.primary.main, 0.14),
              color: 'primary.main',
              display: 'grid',
              placeItems: 'center',
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {row.name.slice(0, 2).toUpperCase()}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {row.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {row.slug}
            </Typography>
          </Box>
        </Stack>
      </TableCell>
      <TableCell>
        <SpecialtyChip edition={row.edition} />
      </TableCell>
      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {row.branches}
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={0.5}>
          {row.modules.map((m) => {
            const Icon = iconForModule(m.key);
            return (
              <Box
                key={m.key}
                title={m.label}
                aria-label={m.label}
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: 0.75,
                  bgcolor: alpha(theme.palette.primary.main, 0.10),
                  color: 'primary.main',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon sx={{ fontSize: 14 }} />
              </Box>
            );
          })}
        </Stack>
      </TableCell>
      <TableCell>
        <StatusPill status={row.status} />
      </TableCell>
      <TableCell align="right" sx={{ width: 40 }}>
        <IconButton size="small" aria-label="Row actions">
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

function SpecialtyChip({ edition }: { edition: string }) {
  // Same colour palette as the donut, so the legend and the row read the
  // same colour for the same specialty.
  const COLOR: Record<string, string> = {
    DERMATOLOGY: '#3B82F6', DENTAL: '#10B981', PEDIATRICS: '#8B5CF6', GENERAL: '#F59E0B',
    PHYSIOTHERAPY: '#EF4444', OBGYN: '#EC4899', OPHTHALMOLOGY: '#06B6D4',
    SPECIALTY: '#6366F1', LAB: '#14B8A6', PHARMACY: '#F97316', HOSPITAL: '#0EA5E9',
    SOLO: '#64748B', CLINIC: '#0F766E', ENTERPRISE: '#0369A1',
  };
  const c = COLOR[edition] ?? '#64748B';
  const label = edition.charAt(0) + edition.slice(1).toLowerCase();
  return (
    <Chip
      size="small"
      label={label}
      sx={{
        bgcolor: alpha(c, 0.12),
        color: c,
        fontWeight: 600,
        border: 'none',
      }}
    />
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === 'ACTIVE' ? 'success.main'
    : status === 'SUSPENDED' ? 'warning.main'
    : 'text.disabled';
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <CircleIcon sx={{ fontSize: 8, color }} />
      <Typography variant="body2" sx={{ color, fontWeight: 500 }}>
        {label}
      </Typography>
    </Stack>
  );
}

// --- Onboarding activity feed ----------------------------------------------

function OnboardingFeed({
  rows,
  loading,
  error,
}: {
  rows: OnboardingActivityResponse['rows'] | undefined;
  loading: boolean;
  error: string | null;
}) {
  const theme = useTheme();
  if (loading) {
    return (
      <Stack spacing={1}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={44} />
        ))}
      </Stack>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!rows || rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        No onboarding activity in this period.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.25}>
      {rows.map((r) => (
        <Stack
          key={r.tenantId}
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{ py: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.primary.main, 0.14),
              color: 'primary.main',
              display: 'grid',
              placeItems: 'center',
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {r.name.slice(0, 2).toUpperCase()}
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {r.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {(r.edition.charAt(0) + r.edition.slice(1).toLowerCase())} · {r.branches} branch{r.branches === 1 ? '' : 'es'}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {dtDate(r.createdAt)} · {dtTime(r.createdAt)}
          </Typography>
          <Chip
            size="small"
            label="New Clinic"
            sx={{
              bgcolor: alpha(theme.palette.success.main, 0.14),
              color: 'success.main',
              fontWeight: 600,
              border: 'none',
            }}
          />
        </Stack>
      ))}
    </Stack>
  );
}
