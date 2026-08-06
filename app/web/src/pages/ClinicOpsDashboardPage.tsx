/**
 * ClinicOpsDashboardPage — /ops.
 *
 * The clinic operational dashboard from reference #4 — nine widgets, nine
 * endpoints, nine contracts under docs/contracts/. Each widget reads one
 * endpoint via useApi, renders loading/populated/empty/error cleanly, and
 * is stubbable with VITE_STUB_API=1 for design-time work.
 *
 * Not to be confused with:
 *  - the platform admin dashboard at /admin/dashboard, which is for the
 *    Platform Super Admin (no tenant context).
 *  - the shortcut+financials DashboardPage at /, which is the current
 *    tenant landing page. That page still ships until Phase 2 backend
 *    (CommissionEarning, Room/TreatmentSession, AppointmentStatusEvent)
 *    lands and everything below has real data instead of stubs.
 */
import { useMemo, useState } from 'react';
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import EventIcon from '@mui/icons-material/Event';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CircleIcon from '@mui/icons-material/Circle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { apiClient } from '../api/client';
import { useApi } from '../api/useApi';
import StatCard from '../components/dashboard/StatCard';
import DonutChart from '../components/dashboard/DonutChart';
import WidgetBoundary from '../components/dashboard/WidgetBoundary';
import { RoomSessionBoard } from '../components/dashboard/RoomSessionBoard';
import { LeadFunnelChart, type FunnelBar } from '../components/dashboard/LeadFunnelChart';
import { PersonAvatar } from '../components/dashboard/PersonAvatar';
import type {
  AppointmentsTodayResponse,
  CrmFunnel,
  DashboardToday,
  DoctorEarningsResponse,
  LeadSourcesResponse,
  QueueResponse,
  RecentEncountersResponse,
  RevenuePeriod,
  RevenueSplit,
  SessionsInProgressResponse,
  StockAlertsResponse,
} from '../api/contracts/clinic-ops';

type FunnelView = 'source' | 'status';

// Human labels for the status funnel keys (the source funnel ships its own).
const STATUS_LABELS: Record<string, string> = {
  NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified',
  CONVERTED: 'Converted', LOST: 'Lost',
};
const STATUS_ORDER = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];

const todayLabel = () =>
  new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

const PKR = (n: number) => 'Rs ' + n.toLocaleString('en-PK');
const NUM = (n: number) => n.toLocaleString('en-PK');
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });

export default function ClinicOpsDashboardPage() {
  const [revPeriod, setRevPeriod] = useState<RevenuePeriod>('this-month');
  const [funnelView, setFunnelView] = useState<FunnelView>('source');

  const today = useApi<DashboardToday>(
    () => apiClient.get<DashboardToday>('/dashboard/today').then((r) => r.data),
  );
  const appts = useApi<AppointmentsTodayResponse>(
    () => apiClient.get<AppointmentsTodayResponse>('/dashboard/appointments-today').then((r) => r.data),
  );
  const sessions = useApi<SessionsInProgressResponse>(
    () => apiClient.get<SessionsInProgressResponse>('/dashboard/sessions-in-progress').then((r) => r.data),
  );
  const recent = useApi<RecentEncountersResponse>(
    () => apiClient.get<RecentEncountersResponse>('/dashboard/recent-encounters', { params: { limit: 5 } }).then((r) => r.data),
  );
  const revenue = useApi<RevenueSplit>(
    () => apiClient.get<RevenueSplit>('/dashboard/revenue-split', { params: { period: revPeriod } }).then((r) => r.data),
    [revPeriod],
  );
  const stock = useApi<StockAlertsResponse>(
    () => apiClient.get<StockAlertsResponse>('/dashboard/stock-alerts').then((r) => r.data),
  );
  const earnings = useApi<DoctorEarningsResponse>(
    () => apiClient.get<DoctorEarningsResponse>('/dashboard/doctor-earnings', { params: { period: 'today' } }).then((r) => r.data),
  );
  const queue = useApi<QueueResponse>(
    () => apiClient.get<QueueResponse>('/dashboard/patient-queue').then((r) => r.data),
  );
  // "By status" funnel uses the pre-existing /crm/funnel endpoint; "by source"
  // uses the new dashboard endpoint.
  const funnel = useApi<CrmFunnel>(
    () => apiClient.get<CrmFunnel>('/crm/funnel').then((r) => r.data),
  );
  const leadSources = useApi<LeadSourcesResponse>(
    () => apiClient.get<LeadSourcesResponse>('/dashboard/lead-sources', { params: { period: 'this-month' } }).then((r) => r.data),
  );

  const revBuckets = useMemo(() => {
    if (!revenue.data) return [];
    return [
      { key: 'clinic', label: "Clinic's Share",  count: revenue.data.clinicPkr, color: '#3b82f6' },
      { key: 'doctor', label: "Doctor's Share",  count: revenue.data.doctorPkr, color: '#10b981' },
    ];
  }, [revenue.data]);

  // Normalize whichever funnel is active into the widget's bar shape.
  const funnelBars = useMemo<FunnelBar[]>(() => {
    if (funnelView === 'source') {
      return (leadSources.data?.rows ?? []).map((r) => ({
        key: r.key, label: r.label, count: r.count, deltaPct: r.deltaPct,
      }));
    }
    const byStatus = funnel.data?.byStatus ?? {};
    return STATUS_ORDER
      .filter((s) => byStatus[s] != null)
      .map((s) => ({ key: s, label: STATUS_LABELS[s] ?? s, count: byStatus[s] }));
  }, [funnelView, leadSources.data, funnel.data]);

  const funnelActive = funnelView === 'source' ? leadSources : funnel;
  const funnelTotal = funnelView === 'source' ? leadSources.data?.total : funnel.data?.total;
  const funnelFooter =
    funnelView === 'source'
      ? leadSources.data != null ? `${leadSources.data.conversionRatePct}% conversion` : undefined
      : funnel.data != null ? `${funnel.data.conversionRatePct}% conversion` : undefined;

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
            Clinic Overview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Today at a glance — appointments, rooms, and the money side.
          </Typography>
        </Box>

        {/* Date context. The dashboard is a live "today" view — the endpoints
            are scoped to the current day server-side and take no date param,
            so this shows the date rather than pretending to filter by it.
            When per-day history lands it becomes a real picker. */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ border: 1, borderColor: 'divider', borderRadius: 2, px: 1.5, py: 0.75 }}
        >
          <CalendarMonthIcon fontSize="small" color="action" />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {todayLabel()}
          </Typography>
          <Chip label="Today" size="small" color="primary" variant="outlined" />
        </Stack>
      </Stack>

      {/* --- Row 1: four stat cards -------------------------------------- */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <WidgetBoundary label="Appointments Today">
            <StatCard
              label="Appointments Today"
              icon={EventIcon}
              accent="primary"
              loading={today.loading}
              error={today.error}
              value={today.data ? NUM(today.data.appointmentsToday.count) : null}
              deltaPct={today.data?.appointmentsToday.deltaPct}
              compareLabel="vs yesterday"
            />
          </WidgetBoundary>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <WidgetBoundary label="Active Patients">
            <StatCard
              label="Active Patients"
              icon={PeopleIcon}
              accent="success"
              loading={today.loading}
              error={today.error}
              value={today.data ? NUM(today.data.activePatients.count) : null}
              deltaPct={today.data?.activePatients.deltaPct}
              compareLabel="last 90 days"
            />
          </WidgetBoundary>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <WidgetBoundary label="Revenue (This Month)">
            <StatCard
              label="Revenue (This Month)"
              icon={AttachMoneyIcon}
              accent="warning"
              loading={today.loading}
              error={today.error}
              value={today.data ? PKR(today.data.revenueThisMonth.pkr) : null}
              deltaPct={today.data?.revenueThisMonth.deltaPct}
              compareLabel="vs last month"
            />
          </WidgetBoundary>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <WidgetBoundary label="Outstanding Balance">
            <StatCard
              label="Outstanding Balance"
              icon={AccountBalanceWalletIcon}
              accent="info"
              loading={today.loading}
              error={today.error}
              value={today.data ? PKR(today.data.outstandingBalance.pkr) : null}
              deltaPct={today.data?.outstandingBalance.deltaPct}
              compareLabel="vs last month"
            />
          </WidgetBoundary>
        </Grid>
      </Grid>

      {/* --- Row 2: today's schedule + sessions in progress -------------- */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={7}>
          <WidgetBoundary label="Today's Schedule">
            <SectionCard title="Today's Schedule" action={<Button size="small">View calendar</Button>}>
              <AppointmentsTable data={appts.data} loading={appts.loading} error={appts.error} />
            </SectionCard>
          </WidgetBoundary>
        </Grid>
        <Grid item xs={12} lg={5}>
          <WidgetBoundary label="Sessions in Progress">
            <SectionCard title="Sessions in Progress" action={
              <Chip size="small" label={`${sessions.data?.rooms.filter(r => r.session).length ?? 0} active`} color="primary" variant="outlined" />
            }>
              <RoomSessionBoard rooms={sessions.data?.rooms} loading={sessions.loading} error={sessions.error} />
            </SectionCard>
          </WidgetBoundary>
        </Grid>
      </Grid>

      {/* --- Row 3: recent encounters + revenue split -------------------- */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={7}>
          <WidgetBoundary label="Recent Consultations">
            <SectionCard title="Recent Consultations">
              <EncountersList rows={recent.data?.rows} loading={recent.loading} error={recent.error} />
            </SectionCard>
          </WidgetBoundary>
        </Grid>
        <Grid item xs={12} lg={5}>
          <WidgetBoundary label="Revenue Split">
            <SectionCard title="Revenue Split" action={<RevenuePeriodSelector value={revPeriod} onChange={setRevPeriod} />}>
              {revenue.loading ? (
                <Skeleton variant="circular" width={220} height={220} sx={{ mx: 'auto' }} />
              ) : revenue.error ? (
                <Alert severity="error">{revenue.error}</Alert>
              ) : revenue.data ? (
                <>
                  <DonutChart
                    data={revBuckets}
                    total={revenue.data.totalPkr}
                    centerLabel="Total Revenue"
                    formatCenter={(n) => PKR(n)}
                  />
                  <Stack direction="row" justifyContent="space-around" mt={2}>
                    <Box textAlign="center">
                      <Typography variant="caption" color="text.secondary">Clinic</Typography>
                      <Typography variant="body2" fontWeight={700}>{revenue.data.clinicPct.toFixed(1)}%</Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="caption" color="text.secondary">Doctors</Typography>
                      <Typography variant="body2" fontWeight={700}>{revenue.data.doctorPct.toFixed(1)}%</Typography>
                    </Box>
                  </Stack>
                </>
              ) : null}
            </SectionCard>
          </WidgetBoundary>
        </Grid>
      </Grid>

      {/* --- Row 4: stock alerts + doctor earnings + lead funnel --------- */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6} lg={4}>
          <WidgetBoundary label="Stock Alerts">
            <SectionCard title="Stock Alerts" action={
              <Chip icon={<WarningAmberIcon />} size="small" label={`${stock.data?.rows.length ?? 0}`} color="warning" variant="outlined" />
            }>
              <StockAlertList rows={stock.data?.rows} loading={stock.loading} error={stock.error} />
            </SectionCard>
          </WidgetBoundary>
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <WidgetBoundary label="Doctor Earnings Today">
            <SectionCard title="Doctor Earnings Today">
              <DoctorEarningsList rows={earnings.data?.rows} loading={earnings.loading} error={earnings.error} />
            </SectionCard>
          </WidgetBoundary>
        </Grid>
        <Grid item xs={12} lg={4}>
          <WidgetBoundary label="Lead Funnel">
            <SectionCard
              title="Lead Funnel"
              action={
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={funnelView}
                  onChange={(_e, v: FunnelView | null) => v && setFunnelView(v)}
                >
                  <ToggleButton value="source" sx={{ textTransform: 'none', px: 1.25 }}>By source</ToggleButton>
                  <ToggleButton value="status" sx={{ textTransform: 'none', px: 1.25 }}>By status</ToggleButton>
                </ToggleButtonGroup>
              }
            >
              <LeadFunnelChart
                bars={funnelBars}
                total={funnelTotal}
                footerLabel={funnelFooter}
                loading={funnelActive.loading}
                error={funnelActive.error}
                emptyMessage={
                  funnelView === 'source'
                    ? 'No lead sources yet. Source tracking activates once WhatsApp and web intake are wired.'
                    : 'No leads yet. Capture the first from WhatsApp or the website intake form.'
                }
              />
            </SectionCard>
          </WidgetBoundary>
        </Grid>
      </Grid>

      {/* --- Row 5: patient queue --------------------------------------- */}
      <Grid container spacing={2.5}>
        <Grid item xs={12}>
          <WidgetBoundary label="Patient Queue">
            <SectionCard title="Patient Queue" action={
              <Typography variant="caption" color="text.secondary">
                As of {queue.data ? time(queue.data.asOf) : '—'}
              </Typography>
            }>
              <PatientQueueGrid rows={queue.data?.rows} loading={queue.loading} error={queue.error} />
            </SectionCard>
          </WidgetBoundary>
        </Grid>
      </Grid>
    </Box>
  );
}

// --- SectionCard shell ------------------------------------------------------

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {action ?? <IconButton size="small"><MoreVertIcon fontSize="small" /></IconButton>}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

// --- Appointments table -----------------------------------------------------

function AppointmentsTable({
  data,
  loading,
  error,
}: {
  data: AppointmentsTodayResponse | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <Stack spacing={1}>
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={44} />)}
      </Stack>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data || data.rows.length === 0) {
    return <Typography color="text.secondary">No appointments booked for today.</Typography>;
  }
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Time</TableCell>
            <TableCell>Patient</TableCell>
            <TableCell>Service</TableCell>
            <TableCell>Doctor</TableCell>
            <TableCell>Room</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.rows.map((r) => (
            <TableRow key={r.id} hover>
              <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {time(r.start)}
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <PersonAvatar name={r.patient.name} size={30} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>{r.patient.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{r.patient.mrn}</Typography>
                  </Box>
                </Stack>
              </TableCell>
              <TableCell>{r.service.label}</TableCell>
              <TableCell>{r.provider.name}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {r.roomLabel ? (
                  <Chip label={r.roomLabel} size="small" variant="outlined" />
                ) : (
                  <Typography variant="caption" color="text.disabled">—</Typography>
                )}
              </TableCell>
              <TableCell>
                <ApptStatusPill status={r.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ApptStatusPill({ status }: { status: string }) {
  const color = status === 'IN_PROGRESS' ? 'warning.main'
    : status === 'CONFIRMED' ? 'success.main'
    : status === 'COMPLETED' ? 'text.disabled'
    : status === 'CANCELLED' || status === 'NO_SHOW' ? 'error.main'
    : 'primary.main';
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <CircleIcon sx={{ fontSize: 8, color }} />
      <Typography variant="caption" sx={{ color, fontWeight: 600 }}>
        {status.replace(/_/g, ' ').toLowerCase()}
      </Typography>
    </Stack>
  );
}

// --- Recent encounters list -------------------------------------------------

function EncountersList({
  rows,
  loading,
  error,
}: {
  rows: RecentEncountersResponse['rows'] | undefined;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return <Stack spacing={1}>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={56} />)}</Stack>;
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!rows || rows.length === 0) {
    return <Typography color="text.secondary">No consultations today yet.</Typography>;
  }
  return (
    <Stack spacing={1.25}>
      {rows.map((r) => (
        <Stack key={r.id} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
          <PersonAvatar name={r.patient.name} size={34} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>{r.patient.name}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {r.provider.name}{r.concern ? ` · ${r.concern}` : ''}
            </Typography>
          </Box>
          <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {time(r.occurredAt)}
            </Typography>
            {r.recommendation && (
              <Chip size="small" label={r.recommendation} variant="outlined" />
            )}
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}

// --- Revenue period selector ------------------------------------------------

function RevenuePeriodSelector({
  value,
  onChange,
}: {
  value: RevenuePeriod;
  onChange: (p: RevenuePeriod) => void;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <CalendarMonthIcon fontSize="small" color="action" />
      <Select
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value as RevenuePeriod)}
        sx={{ minWidth: 140 }}
      >
        <MenuItem value="today">Today</MenuItem>
        <MenuItem value="this-week">This week</MenuItem>
        <MenuItem value="this-month">This month</MenuItem>
        <MenuItem value="last-30d">Last 30 days</MenuItem>
      </Select>
    </Stack>
  );
}

// --- Stock alerts list ------------------------------------------------------

function StockAlertList({
  rows,
  loading,
  error,
}: {
  rows: StockAlertsResponse['rows'] | undefined;
  loading: boolean;
  error: string | null;
}) {
  const theme = useTheme();
  if (loading) {
    return <Stack spacing={1}>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={48} />)}</Stack>;
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!rows || rows.length === 0) {
    return <Typography color="text.secondary">Stock levels look healthy.</Typography>;
  }
  return (
    <Stack spacing={1.25}>
      {rows.map((r) => {
        const c = r.severity === 'critical' ? theme.palette.error.main : theme.palette.warning.main;
        return (
          <Stack key={r.id} direction="row" alignItems="center" spacing={1.5}
                 sx={{ py: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
            <Box sx={{ width: 8, height: 32, borderRadius: 1, bgcolor: c }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>{r.name}</Typography>
              <Typography variant="caption" color="text.secondary">{r.note ?? `${r.onHand} ${r.unit}${r.onHand === 1 ? '' : 's'} left`}</Typography>
            </Box>
            <Chip size="small" label={r.severity} sx={{ bgcolor: alpha(c, 0.14), color: c, fontWeight: 700 }} />
          </Stack>
        );
      })}
    </Stack>
  );
}

// --- Doctor earnings list ---------------------------------------------------

function DoctorEarningsList({
  rows,
  loading,
  error,
}: {
  rows: DoctorEarningsResponse['rows'] | undefined;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return <Stack spacing={1}>{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={48} />)}</Stack>;
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!rows || rows.length === 0) {
    return (
      <Typography color="text.secondary">
        No doctor earnings yet. Commission is booked when a payment lands.
      </Typography>
    );
  }
  return (
    <Stack spacing={1.25}>
      {rows.map((r) => (
        <Stack key={r.userId} direction="row" alignItems="center" justifyContent="space-between"
               sx={{ py: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
            <PersonAvatar name={r.name} size={30} />
            <Typography variant="body2" fontWeight={600} noWrap>{r.name}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
            <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {PKR(r.pkr)}
            </Typography>
            {r.deltaPct != null && (
              <Chip
                size="small"
                label={`${r.deltaPct > 0 ? '+' : ''}${r.deltaPct.toFixed(1)}%`}
                color={r.deltaPct >= 0 ? 'success' : 'error'}
                variant="outlined"
              />
            )}
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}

// --- Patient queue grid -----------------------------------------------------

function PatientQueueGrid({
  rows,
  loading,
  error,
}: {
  rows: QueueResponse['rows'] | undefined;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <Grid container spacing={1.5}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={i}><Skeleton height={90} variant="rounded" /></Grid>
        ))}
      </Grid>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!rows || rows.length === 0) {
    return <Typography color="text.secondary">Nobody in the queue right now.</Typography>;
  }
  return (
    <Grid container spacing={1.5}>
      {rows.map((r) => (
        <Grid item xs={12} sm={6} md={4} lg={2} key={r.patient.id}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PersonAvatar name={r.patient.name} size={30} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" fontWeight={700} noWrap>{r.patient.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{r.patient.mrn}</Typography>
                </Box>
              </Stack>
              <Stack direction="row" justifyContent="space-between" mt={1} alignItems="center">
                <Chip size="small" label={r.status.replace(/_/g, ' ').toLowerCase()} variant="outlined" />
                <Typography variant="caption" color={r.waitedMin > 20 ? 'error.main' : 'text.secondary'}>
                  {r.waitedMin} min
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
