// LabPage — the order-to-report bench.
//
// A lab order is a one-way street: ORDERED → COLLECTED → RESULTED → REPORTED,
// with CANCELLED as an exit before the report is out. The page shows exactly
// which step an order is on and offers only the action that step allows, because
// the server enforces the same and offering a dead button teaches nothing.
//
// Results carry the engine's flag — low / normal / high — against the test's
// reference range. An abnormal result is coloured so it is not missed in a column
// of numbers; that colouring is the whole reason a range-flag exists.
import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { apiClient } from '../api/client';
import { useApi } from '../api/useApi';

interface Patient {
  id: string;
  name: string;
  mrn: string;
}
interface LabTest {
  code: string;
  name: string;
  department: string;
  unit: string;
  refLow?: number;
  refHigh?: number;
  pricePkr: number;
  valueType: 'numeric' | 'text';
}
type OrderStatus = 'ORDERED' | 'COLLECTED' | 'RESULTED' | 'REPORTED' | 'CANCELLED';
interface OrderItem {
  id: string;
  testCode: string;
  testName: string;
  pricePkr: number;
}
interface Result {
  id: string;
  testCode: string;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  flag: string;
}
interface Order {
  id: string;
  orderNumber: string;
  accessionNumber: string | null;
  status: OrderStatus;
  orderedAt: string;
  items: OrderItem[];
  results: Result[];
}

const pkr = (n: number) => 'Rs ' + n.toLocaleString('en-PK');
const STATUS: Record<OrderStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  ORDERED: 'default',
  COLLECTED: 'info',
  RESULTED: 'warning',
  REPORTED: 'success',
  CANCELLED: 'error',
};
const FLAG: Record<string, { label: string; color: 'default' | 'success' | 'error' | 'warning' | 'info' }> = {
  low: { label: 'LOW', color: 'warning' },
  high: { label: 'HIGH', color: 'error' },
  normal: { label: 'normal', color: 'success' },
  reported: { label: 'reported', color: 'info' },
  unknown: { label: '—', color: 'default' },
};

export default function LabPage() {
  const { data: patients } = useApi<Patient[]>(() =>
    apiClient.get<Patient[]>('/patients').then((r) => r.data),
  );
  const { data: tests } = useApi<LabTest[]>(() => apiClient.get<LabTest[]>('/lab/tests').then((r) => r.data));

  const [patientId, setPatientId] = useState('');
  const active = patientId || patients?.[0]?.id || '';
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [nonce, setNonce] = useState(0);

  const orders = useApi<Order[]>(
    () =>
      active
        ? apiClient.get<Order[]>(`/lab/patients/${active}/orders`).then((r) => r.data)
        : Promise.resolve([]),
    [active, nonce],
  );
  const open = useApi<Order | null>(
    () => (openId ? apiClient.get<Order>(`/lab/orders/${openId}`).then((r) => r.data) : Promise.resolve(null)),
    [openId, nonce],
  );

  const testByCode = useMemo(() => {
    const m = new Map<string, LabTest>();
    tests?.forEach((t) => m.set(t.code, t));
    return m;
  }, [tests]);

  // New-order test picker (a Set — the server dedupes, and so should the UI).
  const [picked, setPicked] = useState<string[]>([]);
  const [pickCode, setPickCode] = useState('');
  // Result entry.
  const [resultVals, setResultVals] = useState<Record<string, string>>({});

  const call = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      setNonce((n) => n + 1);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const inv = open.data;
  const resultByCode = useMemo(() => {
    const m = new Map<string, Result>();
    inv?.results.forEach((r) => m.set(r.testCode, r));
    return m;
  }, [inv]);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Laboratory
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Order → collect → result → report. Results flagged against reference ranges.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel>Patient</InputLabel>
          <Select label="Patient" value={active} onChange={(e: SelectChangeEvent) => { setPatientId(e.target.value); setOpenId(null); }}>
            {(patients ?? []).map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name} · {p.mrn}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>
          {err}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* --- Orders list + new order --- */}
        <Grid item xs={12} md={5}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ pb: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Orders
              </Typography>
            </CardContent>
            <Divider sx={{ mt: 2 }} />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order</TableCell>
                  <TableCell>Tests</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(orders.data ?? []).map((o) => (
                  <TableRow key={o.id} hover selected={o.id === openId} sx={{ cursor: 'pointer' }} onClick={() => setOpenId(o.id)}>
                    <TableCell sx={{ fontWeight: 600 }}>{o.orderNumber}</TableCell>
                    <TableCell>{o.items.length}</TableCell>
                    <TableCell>
                      <Chip size="small" label={o.status.toLowerCase()} color={STATUS[o.status]} variant={o.status === 'REPORTED' ? 'filled' : 'outlined'} />
                    </TableCell>
                  </TableRow>
                ))}
                {!orders.data?.length && (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No lab orders for this patient yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                New order
              </Typography>
              <Stack direction="row" spacing={1}>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Test</InputLabel>
                  <Select label="Test" value={pickCode} onChange={(e: SelectChangeEvent) => setPickCode(e.target.value)}>
                    {(tests ?? []).map((t) => (
                      <MenuItem key={t.code} value={t.code}>
                        {t.name} · {pkr(t.pricePkr)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  size="small"
                  disabled={!pickCode}
                  onClick={() => {
                    setPicked((p) => (p.includes(pickCode) ? p : [...p, pickCode]));
                    setPickCode('');
                  }}
                >
                  Add
                </Button>
              </Stack>
              {!!picked.length && (
                <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
                  {picked.map((c) => (
                    <Chip key={c} size="small" variant="outlined" label={testByCode.get(c)?.name ?? c} onDelete={() => setPicked((p) => p.filter((x) => x !== c))} />
                  ))}
                </Stack>
              )}
              <Button
                variant="contained"
                size="small"
                sx={{ mt: 2 }}
                disabled={!picked.length || !active || busy}
                onClick={() =>
                  call(async () => {
                    const r = await apiClient.post<Order>('/lab/orders', { patientId: active, testCodes: picked });
                    setPicked([]);
                    setOpenId(r.data.id);
                  })
                }
              >
                Order {picked.length} test{picked.length === 1 ? '' : 's'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* --- Selected order --- */}
        <Grid item xs={12} md={7}>
          {!openId && (
            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Select an order to collect the specimen, enter results, and report.
                </Typography>
              </CardContent>
            </Card>
          )}
          {inv && (
            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {inv.orderNumber}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                      <Chip size="small" label={inv.status.toLowerCase()} color={STATUS[inv.status]} />
                      {inv.accessionNumber && (
                        <Typography variant="caption" color="text.secondary">
                          accession {inv.accessionNumber}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                  {/* Only the action this step allows. */}
                  <Stack direction="row" spacing={1}>
                    {inv.status === 'ORDERED' && (
                      <Button size="small" variant="contained" disabled={busy} onClick={() => call(() => apiClient.patch(`/lab/orders/${inv.id}/collect`))}>
                        Collect specimen
                      </Button>
                    )}
                    {inv.status === 'RESULTED' && (
                      <Button size="small" variant="contained" disabled={busy} onClick={() => call(() => apiClient.patch(`/lab/orders/${inv.id}/report`))}>
                        Report
                      </Button>
                    )}
                    {(inv.status === 'ORDERED' || inv.status === 'COLLECTED' || inv.status === 'RESULTED') && (
                      <Button size="small" color="error" disabled={busy} onClick={() => call(() => apiClient.patch(`/lab/orders/${inv.id}/cancel`))}>
                        Cancel
                      </Button>
                    )}
                  </Stack>
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Test</TableCell>
                      <TableCell align="right">Result</TableCell>
                      <TableCell>Ref</TableCell>
                      <TableCell>Flag</TableCell>
                      {(inv.status === 'COLLECTED' || inv.status === 'RESULTED') && <TableCell />}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {inv.items.map((it) => {
                      const test = testByCode.get(it.testCode);
                      const r = resultByCode.get(it.testCode);
                      const editable = inv.status === 'COLLECTED' || inv.status === 'RESULTED';
                      const isText = test?.valueType === 'text';
                      return (
                        <TableRow key={it.id}>
                          <TableCell>{it.testName}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: r ? 600 : 400 }}>
                            {r ? (r.value !== null ? `${r.value} ${r.unit ?? ''}` : r.valueText) : '—'}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {test?.refLow !== undefined || test?.refHigh !== undefined
                                ? `${test?.refLow ?? ''}–${test?.refHigh ?? ''} ${test?.unit ?? ''}`
                                : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {r ? <Chip size="small" label={FLAG[r.flag]?.label ?? r.flag} color={FLAG[r.flag]?.color ?? 'default'} variant={r.flag === 'normal' || r.flag === 'reported' ? 'outlined' : 'filled'} /> : ''}
                          </TableCell>
                          {editable && (
                            <TableCell>
                              <Stack direction="row" spacing={0.5}>
                                <TextField
                                  size="small"
                                  variant="standard"
                                  placeholder={isText ? 'text' : 'value'}
                                  value={resultVals[it.testCode] ?? ''}
                                  onChange={(e) => setResultVals((v) => ({ ...v, [it.testCode]: e.target.value }))}
                                  sx={{ width: 90 }}
                                />
                                <Button
                                  size="small"
                                  disabled={busy || !(resultVals[it.testCode] ?? '').trim()}
                                  onClick={() =>
                                    call(async () => {
                                      const raw = (resultVals[it.testCode] ?? '').trim();
                                      // A NUMERIC test must never fall back to text.
                                      //
                                      // The old condition downgraded on any unparseable
                                      // character — "7,5" (decimal comma), "9.5 g/dL", "<2".
                                      // Stored as text, value is null, so flagResult() short-
                                      // circuits and the reference range is NEVER APPLIED: a
                                      // haemoglobin of 7,5 rendered a calm neutral chip beside
                                      // the 12-16 range it breaches, and the order could still
                                      // be finalized. Reproduced in the browser.
                                      //
                                      // Refuse instead of reclassifying. A rejected entry the
                                      // user retypes is recoverable; an un-flagged critical
                                      // result is not.
                                      let body: Record<string, unknown>;
                                      if (isText) {
                                        body = { testCode: it.testCode, valueText: raw };
                                      } else {
                                        const n = Number(raw);
                                        if (!Number.isFinite(n)) {
                                          throw new Error(
                                            `${it.testName ?? it.testCode}: enter the number only — no units, and use a decimal point (7.5, not 7,5). Nothing was saved.`,
                                          );
                                        }
                                        body = { testCode: it.testCode, value: n };
                                      }
                                      await apiClient.post(`/lab/orders/${inv.id}/results`, body);
                                      setResultVals((v) => ({ ...v, [it.testCode]: '' }));
                                    })
                                  }
                                >
                                  {r ? 'Amend' : 'Save'}
                                </Button>
                              </Stack>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {inv.status === 'COLLECTED' && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                    Enter every test's result to move the order to RESULTED, then report it.
                  </Typography>
                )}
                {inv.status === 'REPORTED' && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    Report finalized — results are released and the order is locked.
                  </Alert>
                )}
                {inv.status === 'CANCELLED' && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    This order was cancelled.
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
