// PayrollPage — staff and the monthly run.
//
// The client asked for payroll by name, so this is the page they will judge the
// product by. Two things it must never do: pay the wrong number quietly, and
// let a mistake become permanent.
//
// A run is DRAFT until someone finalizes it. Draft is where you check the
// arithmetic; finalize is the assertion that these people were paid. The UI
// keeps that line bright — a draft can be thrown away and re-run, a finalized
// run cannot be touched at all.
import { useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { apiClient } from '../api/client';
import { useApi } from '../api/useApi';

interface Employee {
  id: string;
  name: string;
  designation: string;
  baseSalaryPkr: number;
  allowancesPkr: number;
  status: string;
}

interface Payslip {
  id: string;
  employeeId: string;
  baseSalaryPkr: number;
  allowancesPkr: number;
  deductionsPkr: number;
  netPkr: number;
  employee: { name: string; designation: string };
}

interface Run {
  id: string;
  period: string;
  status: 'DRAFT' | 'FINALIZED';
  totalNetPkr: number;
  createdAt: string;
  payslips?: Payslip[];
}

// PKR, grouped the way the client reads money. No decimals: the schema stores
// whole rupees, and showing ".00" would imply a precision that is not there.
const pkr = (n: number) => 'Rs ' + n.toLocaleString('en-PK');

export default function PayrollPage() {
  const [period, setPeriod] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [dedEmp, setDedEmp] = useState('');
  const [dedAmt, setDedAmt] = useState('');
  const [deductions, setDeductions] = useState<{ employeeId: string; amountPkr: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmFinalize, setConfirmFinalize] = useState<Run | null>(null);
  const [nonce, setNonce] = useState(0);

  const staff = useApi<Employee[]>(
    () => apiClient.get<Employee[]>('/hr/employees').then((r) => r.data),
    [nonce],
  );
  const runs = useApi<Run[]>(
    () => apiClient.get<Run[]>('/hr/payroll/runs').then((r) => r.data),
    [nonce],
  );
  const open = useApi<Run | null>(
    () => (openId ? apiClient.get<Run>(`/hr/payroll/runs/${openId}`).then((r) => r.data) : Promise.resolve(null)),
    [openId, nonce],
  );

  const active = (staff.data ?? []).filter((e) => e.status === 'ACTIVE');
  const projected = active.reduce(
    (s, e) =>
      s +
      e.baseSalaryPkr +
      e.allowancesPkr -
      deductions.filter((d) => d.employeeId === e.id).reduce((a, d) => a + d.amountPkr, 0),
    0,
  );

  const call = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      setNonce((n) => n + 1);
    } catch (e: any) {
      // Surface the server's sentence. These are the guards (period already run,
      // deductions exceed gross, run already finalized) and each one names a
      // real mistake — paraphrasing them into "Error" throws away the fix.
      setErr(e?.response?.data?.message ?? 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const runNow = () =>
    call(async () => {
      const r = await apiClient.post<Run>('/hr/payroll/runs', { period, deductions });
      setOpenId(r.data.id);
      setDeductions([]);
    });

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Payroll
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Staff, monthly runs, and payslips. Amounts in PKR.
      </Typography>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>
          {err}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {(
          [
            ['active staff', String(active.length), 'text.primary'],
            ['monthly gross', pkr(active.reduce((s, e) => s + e.baseSalaryPkr + e.allowancesPkr, 0)), 'text.primary'],
            ['runs recorded', String(runs.data?.length ?? 0), 'text.secondary'],
          ] as const
        ).map(([label, v, color]) => (
          <Grid item xs={12} sm={4} key={label}>
            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color }}>
                  {v}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* --- New run --- */}
      <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
            Run a month
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
            <TextField
              size="small"
              label="Period"
              placeholder="2026-07"
              value={period}
              onChange={(e) => setPeriod(e.target.value.trim())}
              helperText="YYYY-MM. One run per period."
              sx={{ minWidth: 170 }}
            />
            <TextField
              size="small"
              select
              label="Deduction — staff"
              value={dedEmp}
              onChange={(e) => setDedEmp(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              {active.map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {e.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Amount (PKR)"
              value={dedAmt}
              onChange={(e) => setDedAmt(e.target.value.replace(/[^0-9]/g, ''))}
              sx={{ width: 150 }}
            />
            <Button
              size="small"
              sx={{ mt: 0.5 }}
              disabled={!dedEmp || !dedAmt}
              onClick={() => {
                setDeductions((d) => [...d, { employeeId: dedEmp, amountPkr: Number(dedAmt) }]);
                setDedEmp('');
                setDedAmt('');
              }}
            >
              Add
            </Button>
          </Stack>

          {!!deductions.length && (
            <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
              {deductions.map((d, i) => (
                <Chip
                  key={i}
                  size="small"
                  variant="outlined"
                  label={`${staff.data?.find((e) => e.id === d.employeeId)?.name ?? '?'} −${pkr(d.amountPkr)}`}
                  onDelete={() => setDeductions((x) => x.filter((_, j) => j !== i))}
                />
              ))}
            </Stack>
          )}

          {/* The total is shown before the run, not after. Payroll is the one
              number the owner checks, and checking it afterwards is checking a
              record rather than a proposal. */}
          <Typography variant="body2" sx={{ mt: 2 }}>
            This run will pay <strong>{pkr(projected)}</strong> across {active.length} active staff.
          </Typography>

          <Button
            variant="contained"
            sx={{ mt: 2 }}
            disabled={!/^\d{4}-\d{2}$/.test(period) || busy || !active.length}
            onClick={runNow}
          >
            Compute draft run
          </Button>
        </CardContent>
      </Card>

      {/* --- Runs --- */}
      <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ pb: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Runs
          </Typography>
        </CardContent>
        <Divider sx={{ mt: 2 }} />
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Period</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Net total</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {(runs.data ?? []).map((r) => (
              <TableRow key={r.id} selected={r.id === openId}>
                <TableCell sx={{ fontWeight: 600 }}>{r.period}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={r.status === 'FINALIZED' ? 'finalized' : 'draft'}
                    color={r.status === 'FINALIZED' ? 'success' : 'warning'}
                    variant={r.status === 'FINALIZED' ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell align="right">{pkr(r.totalNetPkr)}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" onClick={() => setOpenId(r.id)}>
                      Payslips
                    </Button>
                    {/* Only a draft offers these. A finalized run has no
                        buttons at all — not disabled ones, none. */}
                    {r.status === 'DRAFT' && (
                      <>
                        <Button size="small" disabled={busy} onClick={() => setConfirmFinalize(r)}>
                          Finalize
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          disabled={busy}
                          onClick={() =>
                            call(async () => {
                              await apiClient.delete(`/hr/payroll/runs/${r.id}`);
                              if (openId === r.id) setOpenId(null);
                            })
                          }
                        >
                          Discard
                        </Button>
                      </>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!runs.data?.length && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No payroll runs yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* --- Payslips --- */}
      {open.loading && openId && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {open.data && (
        <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ pb: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Payslips — {open.data.period}
              </Typography>
              <Chip
                size="small"
                label={open.data.status === 'FINALIZED' ? 'finalized' : 'draft'}
                color={open.data.status === 'FINALIZED' ? 'success' : 'warning'}
                variant={open.data.status === 'FINALIZED' ? 'filled' : 'outlined'}
              />
            </Stack>
            {open.data.status === 'DRAFT' && (
              <Typography variant="caption" color="text.secondary">
                Draft — check the figures before finalizing. Nothing has been paid.
              </Typography>
            )}
          </CardContent>
          <Divider sx={{ mt: 2 }} />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Staff</TableCell>
                <TableCell>Designation</TableCell>
                <TableCell align="right">Base</TableCell>
                <TableCell align="right">Allowances</TableCell>
                <TableCell align="right">Deductions</TableCell>
                <TableCell align="right">Net</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(open.data.payslips ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.employee.name}</TableCell>
                  <TableCell>{p.employee.designation}</TableCell>
                  <TableCell align="right">{pkr(p.baseSalaryPkr)}</TableCell>
                  <TableCell align="right">{pkr(p.allowancesPkr)}</TableCell>
                  <TableCell align="right" sx={p.deductionsPkr ? { color: 'error.main' } : undefined}>
                    {p.deductionsPkr ? '−' + pkr(p.deductionsPkr) : '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {pkr(p.netPkr)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={5} align="right" sx={{ fontWeight: 700 }}>
                  Total
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {pkr(open.data.totalNetPkr)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Finalize is the assertion that these people were paid. It is one click
          away from irreversible, so it gets a sentence and a total, not a
          yes/no. */}
      <Dialog open={!!confirmFinalize} onClose={() => setConfirmFinalize(null)}>
        <DialogTitle>Finalize {confirmFinalize?.period}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This records that {pkr(confirmFinalize?.totalNetPkr ?? 0)} was paid to staff for{' '}
            {confirmFinalize?.period}. A finalized run cannot be edited, discarded, or re-run.
          </DialogContentText>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <AlertTitle>Check the payslips first</AlertTitle>
            If a figure is wrong, discard this draft and run the month again.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmFinalize(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => {
              const r = confirmFinalize!;
              setConfirmFinalize(null);
              call(() => apiClient.patch(`/hr/payroll/runs/${r.id}/finalize`, {}));
            }}
          >
            Finalize
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
