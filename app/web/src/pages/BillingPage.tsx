// BillingPage — invoices, payments, and the money lifecycle.
//
// This is the screen an owner opens every day, so it is built around the one
// number they actually check: what is still owed. Everything else — the ledger,
// the status chips, the actions — hangs off making that number correct and
// legible.
//
// The page mirrors the invariants the billing service enforces, rather than
// re-deciding them. A VOID invoice offers no payment actions at all (not
// disabled ones — none), the way a finalized payroll run does, because a void is
// terminal. A refund warns that it kills any outstanding pay link, because it
// does. The UI's job is to make the state machine visible, never to invent a
// path the server would refuse.
import { useState } from 'react';
import {
  Alert,
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
import { useApi, numericInput } from '../api/useApi';

interface Patient {
  id: string;
  name: string;
  mrn: string;
}

type InvoiceStatus = 'DRAFT' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'VOID';
type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'SAFEPAY' | 'PAYFAST' | 'PAYPRO' | 'POS';

interface Line {
  id: string;
  code: string;
  name: string;
  unitPricePkr: number;
  quantity: number;
  lineTotalPkr: number;
  side: string | null;
}
interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  createdAt: string;
}
interface Refund {
  id: string;
  amountPkr: number;
  method: PaymentMethod;
  reason: string | null;
  createdAt: string;
}
interface Invoice {
  id: string;
  number: string;
  total: number;
  paid: number;
  status: InvoiceStatus;
  createdAt: string;
  fbrInvoiceNumber: string | null;
  fbrStatus: string | null;
  lines: Line[];
  payments: Payment[];
  refunds: Refund[];
}

const pkr = (n: number) => 'Rs ' + n.toLocaleString('en-PK');

const STATUS: Record<InvoiceStatus, 'default' | 'success' | 'error' | 'warning' | 'info'> = {
  DRAFT: 'default',
  UNPAID: 'warning',
  PARTIAL: 'info',
  PAID: 'success',
  VOID: 'error',
};

const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'POS'];
const PROVIDERS = ['safepay', 'payfast', 'paypro'] as const;

export default function BillingPage() {
  const { data: patients } = useApi<Patient[]>(() =>
    apiClient.get<Patient[]>('/patients').then((r) => r.data),
  );
  const [patientId, setPatientId] = useState('');
  const active = patientId || patients?.[0]?.id || '';

  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [nonce, setNonce] = useState(0);

  const invoices = useApi<Invoice[]>(
    () =>
      active
        ? apiClient.get<Invoice[]>(`/patients/${active}/invoices`).then((r) => r.data)
        : Promise.resolve([]),
    [active, nonce],
  );
  const open = useApi<Invoice | null>(
    () =>
      openId
        ? apiClient.get<Invoice>(`/invoices/${openId}`).then((r) => r.data)
        : Promise.resolve(null),
    [openId, nonce],
  );

  // New-invoice line draft.
  const [liName, setLiName] = useState('');
  const [liPrice, setLiPrice] = useState('');
  const [liQty, setLiQty] = useState('1');
  const [lines, setLines] = useState<{ code: string; name: string; unitPricePkr: number; quantity: number }[]>([]);

  // Action inputs.
  const [payAmt, setPayAmt] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH');
  const [refundAmt, setRefundAmt] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>('safepay');
  const [confirmVoid, setConfirmVoid] = useState<Invoice | null>(null);

  const call = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setErr('');
    setNote('');
    try {
      await fn();
      setNonce((n) => n + 1);
      if (ok) setNote(ok);
    } catch (e: any) {
      // Surface the server's sentence verbatim. These messages are the hardened
      // guards speaking — "This payment link is no longer valid", "Cannot pay a
      // void invoice" — and each one names a real refusal worth reading.
      setErr(e?.response?.data?.message ?? 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const inv = open.data;
  const outstanding = inv ? inv.total - inv.paid : 0;

  const totalOutstanding = (invoices.data ?? [])
    .filter((i) => i.status !== 'VOID')
    .reduce((s, i) => s + (i.total - i.paid), 0);

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Billing
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Invoices, payments and refunds. Amounts in PKR.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 260 }}>
          <InputLabel>Patient</InputLabel>
          <Select
            label="Patient"
            value={active}
            onChange={(e: SelectChangeEvent) => {
              setPatientId(e.target.value);
              setOpenId(null);
            }}
          >
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
      {note && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNote('')}>
          {note}
        </Alert>
      )}

      {/* The one number an owner checks: what this patient still owes. */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {(
          [
            ['outstanding', pkr(totalOutstanding), totalOutstanding > 0 ? 'warning.main' : 'success.main'],
            ['invoices', String(invoices.data?.length ?? 0), 'text.secondary'],
          ] as const
        ).map(([label, v, color]) => (
          <Grid item xs={6} sm={3} key={label}>
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

      <Grid container spacing={3}>
        {/* --- Invoice list + creator --- */}
        <Grid item xs={12} md={5}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ pb: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Invoices
              </Typography>
            </CardContent>
            <Divider sx={{ mt: 2 }} />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Number</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Owed</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(invoices.data ?? []).map((i) => (
                  <TableRow
                    key={i.id}
                    hover
                    selected={i.id === openId}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setOpenId(i.id)}
                  >
                    <TableCell sx={{ fontWeight: 600, textDecoration: i.status === 'VOID' ? 'line-through' : undefined }}>
                      {i.number}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={i.status.toLowerCase()} color={STATUS[i.status]} variant={i.status === 'PAID' ? 'filled' : 'outlined'} />
                    </TableCell>
                    <TableCell align="right">{pkr(i.total)}</TableCell>
                    <TableCell align="right" sx={{ color: i.status !== 'VOID' && i.total - i.paid > 0 ? 'warning.main' : 'text.secondary' }}>
                      {i.status === 'VOID' ? '—' : pkr(i.total - i.paid)}
                    </TableCell>
                  </TableRow>
                ))}
                {!invoices.data?.length && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No invoices for this patient yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Quick invoice: the treatment-plan path composes richer bills; this
              is the front-desk "charge them for today's visit" path. */}
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                New invoice
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <TextField size="small" label="Item" value={liName} onChange={(e) => setLiName(e.target.value)} sx={{ flex: 1 }} />
                <TextField size="small" label="Price" value={liPrice} onChange={(e) => setLiPrice(numericInput(e.target.value))} sx={{ width: 110 }} />
                <TextField size="small" label="Qty" value={liQty} onChange={(e) => setLiQty(numericInput(e.target.value))} sx={{ width: 70 }} />
                <Button
                  size="small"
                  disabled={!liName || !liPrice || !Number(liQty)}
                  onClick={() => {
                    setLines((l) => [...l, { code: `SVC-${l.length + 1}`, name: liName, unitPricePkr: Number(liPrice), quantity: Number(liQty) }]);
                    setLiName('');
                    setLiPrice('');
                    setLiQty('1');
                  }}
                >
                  Add
                </Button>
              </Stack>
              {lines.map((l, i) => (
                <Stack key={i} direction="row" justifyContent="space-between" sx={{ py: 0.25 }}>
                  <Typography variant="body2">
                    {l.name} × {l.quantity}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {pkr(l.unitPricePkr * l.quantity)}
                    <Button size="small" color="error" sx={{ minWidth: 0, ml: 1 }} onClick={() => setLines((x) => x.filter((_, j) => j !== i))}>
                      ×
                    </Button>
                  </Typography>
                </Stack>
              ))}
              <Button
                variant="contained"
                size="small"
                sx={{ mt: 2 }}
                disabled={!lines.length || !active || busy}
                onClick={() =>
                  call(async () => {
                    const r = await apiClient.post<Invoice>('/invoices', { patientId: active, items: lines });
                    setLines([]);
                    setOpenId(r.data.id);
                  }, 'Invoice raised.')
                }
              >
                Raise {lines.length ? pkr(lines.reduce((s, l) => s + l.unitPricePkr * l.quantity, 0)) : ''} invoice
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* --- Selected invoice --- */}
        <Grid item xs={12} md={7}>
          {open.loading && openId && (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          )}
          {!openId && (
            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Select an invoice to take a payment, refund, or void it.
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
                      {inv.number}
                    </Typography>
                    <Chip size="small" label={inv.status.toLowerCase()} color={STATUS[inv.status]} sx={{ mt: 0.5 }} />
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary">
                      {inv.status === 'VOID' ? 'voided' : 'outstanding'}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: outstanding > 0 && inv.status !== 'VOID' ? 'warning.main' : 'text.primary' }}>
                      {inv.status === 'VOID' ? '—' : pkr(outstanding)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {pkr(inv.paid)} of {pkr(inv.total)} paid
                    </Typography>
                  </Box>
                </Stack>

                <Table size="small" sx={{ mt: 2 }}>
                  <TableBody>
                    {inv.lines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell sx={{ border: 0, py: 0.25 }}>
                          {l.name}
                          {l.side ? ` (${l.side.toLowerCase()})` : ''} × {l.quantity}
                        </TableCell>
                        <TableCell align="right" sx={{ border: 0, py: 0.25 }}>
                          {pkr(l.lineTotalPkr)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Ledger: payments in, refunds out. The refunds are shown as
                    negative because that is what they are to the till. */}
                {(inv.payments.length > 0 || inv.refunds.length > 0) && (
                  <>
                    <Divider sx={{ my: 1.5 }} />
                    <Table size="small">
                      <TableBody>
                        {inv.payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell sx={{ border: 0, py: 0.25 }}>
                              {p.method.toLowerCase().replace('_', ' ')}
                              {p.reference ? ` · ${p.reference}` : ''}
                            </TableCell>
                            <TableCell align="right" sx={{ border: 0, py: 0.25, color: 'success.main' }}>
                              {pkr(p.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {inv.refunds.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell sx={{ border: 0, py: 0.25, color: 'error.main' }}>
                              refund{r.reason ? ` · ${r.reason}` : ''}
                            </TableCell>
                            <TableCell align="right" sx={{ border: 0, py: 0.25, color: 'error.main' }}>
                              −{pkr(r.amountPkr)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}

                {/* FBR status: filed once, with the IRN visible. */}
                <Box sx={{ mt: 1.5 }}>
                  {inv.fbrInvoiceNumber ? (
                    <Chip size="small" color="success" variant="outlined" label={`FBR ${inv.fbrStatus} · ${inv.fbrInvoiceNumber}`} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      Not filed with FBR.
                    </Typography>
                  )}
                </Box>

                <Divider sx={{ my: 2 }} />

                {inv.status === 'VOID' ? (
                  <Alert severity="info">This invoice was voided. It carries no balance and cannot be paid, refunded, or filed.</Alert>
                ) : (
                  <Stack spacing={2}>
                    {/* Take a payment — only while something is owed. */}
                    {outstanding > 0 && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                          Take a payment
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TextField
                            size="small"
                            label="Amount"
                            placeholder={String(outstanding)}
                            value={payAmt}
                            onChange={(e) => setPayAmt(numericInput(e.target.value))}
                            sx={{ width: 130 }}
                          />
                          <FormControl size="small" sx={{ minWidth: 130 }}>
                            <InputLabel>Method</InputLabel>
                            <Select label="Method" value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}>
                              {METHODS.map((m) => (
                                <MenuItem key={m} value={m}>
                                  {m.toLowerCase().replace('_', ' ')}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Button
                            variant="contained"
                            disabled={busy}
                            onClick={() =>
                              call(async () => {
                                // `Number('0') || outstanding` is the bug: 0 is falsy, so
                                // typing 0 recorded the FULL outstanding balance as paid.
                                // Reproduced: a Rs 25,000 invoice went to PAID, entered
                                // revenue, and could then only be undone by refunding money
                                // never received. Never use `||` to default a numeric field.
                                const amt = payAmt.trim() === '' ? outstanding : Number(payAmt);
                                if (!Number.isFinite(amt) || amt <= 0) {
                                  throw new Error('Enter a payment amount greater than zero.');
                                }
                                await apiClient.post(`/invoices/${inv.id}/payments`, {
                                  amountPkr: amt,
                                  method: payMethod,
                                });
                                setPayAmt('');
                              }, 'Payment recorded.')
                            }
                          >
                            Record
                          </Button>
                        </Stack>

                        {/* Gateway link: mint, then confirm (the stubbed webhook).
                            This is the exact path the money-safety fixes hardened,
                            so exercising it here is also the proof it holds. */}
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
                          <FormControl size="small" sx={{ minWidth: 130 }}>
                            <InputLabel>Gateway</InputLabel>
                            <Select label="Gateway" value={provider} onChange={(e) => setProvider(e.target.value as (typeof PROVIDERS)[number])}>
                              {PROVIDERS.map((p) => (
                                <MenuItem key={p} value={p}>
                                  {p}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Button
                            variant="outlined"
                            disabled={busy}
                            onClick={() =>
                              call(async () => {
                                const r = await apiClient.post<{ reference: string }>(`/invoices/${inv.id}/pay-link`, { provider });
                                setNote(`Pay link created (${r.data.reference}). "Confirm" simulates the patient paying it.`);
                              })
                            }
                          >
                            Pay link
                          </Button>
                          {inv.status !== 'PAID' && (
                            <Button
                              variant="text"
                              disabled={busy}
                              onClick={() =>
                                call(async () => {
                                  // Confirm the latest pending intent. In the stub the
                                  // reference is echoed by pay-link; here we re-mint and
                                  // confirm to demonstrate the round trip end to end.
                                  const link = await apiClient.post<{ reference: string }>(`/invoices/${inv.id}/pay-link`, { provider });
                                  await apiClient.post(`/invoices/${inv.id}/confirm`, { reference: link.data.reference });
                                }, 'Gateway payment confirmed.')
                              }
                            >
                              Simulate gateway pay
                            </Button>
                          )}
                        </Stack>
                      </Box>
                    )}

                    {/* Refund — only when money has actually been taken. */}
                    {inv.paid > 0 && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                          Refund
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TextField
                            size="small"
                            label="Amount"
                            placeholder={String(inv.paid)}
                            value={refundAmt}
                            onChange={(e) => setRefundAmt(numericInput(e.target.value))}
                            sx={{ width: 130 }}
                          />
                          <TextField size="small" label="Reason" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} sx={{ flex: 1 }} />
                          <Button
                            variant="outlined"
                            color="error"
                            disabled={busy || !refundAmt}
                            onClick={() =>
                              call(async () => {
                                await apiClient.post(`/invoices/${inv.id}/refunds`, {
                                  amountPkr: Number(refundAmt),
                                  method: 'CASH',
                                  reason: refundReason || undefined,
                                });
                                setRefundAmt('');
                                setRefundReason('');
                              }, 'Refund recorded. Any open pay link for this invoice is now void.')
                            }
                          >
                            Refund
                          </Button>
                        </Stack>
                      </Box>
                    )}

                    {/* Void and FBR sit together: the two terminal moves. */}
                    <Stack direction="row" spacing={1}>
                      {inv.paid === 0 && (
                        <Button color="error" disabled={busy} onClick={() => setConfirmVoid(inv)}>
                          Void invoice
                        </Button>
                      )}
                      {inv.status !== 'DRAFT' && !inv.fbrInvoiceNumber && (
                        <Button
                          disabled={busy}
                          onClick={() =>
                            call(() => apiClient.post(`/integrations/fbr/invoices/${inv.id}/submit`, {}), 'Filed with FBR.')
                          }
                        >
                          File with FBR
                        </Button>
                      )}
                    </Stack>
                    {inv.paid > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        To void this invoice, refund the {pkr(inv.paid)} already paid first.
                      </Typography>
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Void is a terminal, near-irreversible move — it gets a sentence, not a
          bare confirm. */}
      <Dialog open={!!confirmVoid} onClose={() => setConfirmVoid(null)}>
        <DialogTitle>Void {confirmVoid?.number}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Voiding cancels this invoice for {pkr(confirmVoid?.total ?? 0)}. It can no longer be paid,
            refunded, or filed with FBR, and any open payment link for it stops working.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmVoid(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy}
            onClick={() => {
              const v = confirmVoid!;
              setConfirmVoid(null);
              call(() => apiClient.patch(`/invoices/${v.id}/void`), 'Invoice voided.');
            }}
          >
            Void
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
