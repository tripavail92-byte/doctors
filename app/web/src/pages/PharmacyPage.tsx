// PharmacyPage — the dispensing counter and the stock behind it.
//
// Two jobs in one screen because they are the same job: you cannot dispense
// safely without seeing what is actually on the shelf. The page leads with the
// expired-pull worklist for the same reason the immunization page leads with the
// fridge worklist — a batch that should be off the shelf is not stock, and a
// counter that counts it is lying to the person about to hand it over.
//
// The server refuses to dispense expired stock; this page never offers it. On
// hand means in-date and dispensable. Expired units are shown apart, as a list
// of things to remove, never as inventory.
import { useMemo, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
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
import { describeError } from '../api/fetchErrors';
import type { Patient } from '../api/types';

interface Drug {
  code: string;
  name: string;
  form: string;
  strength: string;
  unit: string;
  pricePkr: number;
  controlled: boolean;
}
interface Batch {
  id: string;
  batchNo: string;
  expiry: string;
  quantityOnHand: number;
  expired: boolean;
}
interface StockGroup {
  formularyCode: string;
  name: string;
  onHand: number;
  expired: number;
  batches: Batch[];
}
interface DispenseItem {
  id: string;
  formularyCode: string;
  name: string;
  quantity: number;
  unitPricePkr: number;
  lineTotalPkr: number;
  /** The FIRST batch consumed only — NOT the provenance record. */
  batchNo: string | null;
  /** Every batch this line actually drew, with how much. This is what a recall
   *  is answered from; batchNo alone under-reports and the people missing from
   *  it are exactly the ones at risk. */
  batches?: { batchNo: string; quantity: number; expiry: string }[];
}
interface Receipt {
  id: string;
  receiptNumber: string;
  totalPkr: number;
  paymentMethod: string;
  items: DispenseItem[];
}

const pkr = (n: number) => 'Rs ' + n.toLocaleString('en-PK');
const METHODS = ['CASH', 'CARD', 'POS'] as const;

export default function PharmacyPage() {
  const { data: formulary } = useApi<Drug[]>(() =>
    apiClient.get<Drug[]>('/pharmacy/formulary').then((r) => r.data),
  );
  const { data: patients } = useApi<Patient[]>(() =>
    apiClient.get<Patient[]>('/patients').then((r) => r.data),
  );
  const [nonce, setNonce] = useState(0);
  const stock = useApi<StockGroup[]>(
    () => apiClient.get<StockGroup[]>('/pharmacy/stock').then((r) => r.data),
    [nonce],
  );

  const [cart, setCart] = useState<{ code: string; quantity: number }[]>([]);
  const [pickCode, setPickCode] = useState('');
  const [pickQty, setPickQty] = useState('1');
  const [patientId, setPatientId] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('CASH');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Receiving stock had no route in the SPA, so a clean tenant showed "No stock
  // received yet" for ever and nothing could be dispensed at all.
  const [recvOpen, setRecvOpen] = useState(false);
  const [recvBusy, setRecvBusy] = useState(false);
  const [recvErr, setRecvErr] = useState('');
  const [recv, setRecv] = useState({ formularyCode: '', batchNo: '', expiry: '', quantity: '', unitCostPkr: '' });
  const setRecvField = (k: keyof typeof recv) => (e: { target: { value: string } }) =>
    setRecv((p) => ({ ...p, [k]: e.target.value }));

  const receiveStock = async () => {
    setRecvBusy(true);
    setRecvErr('');
    try {
      await apiClient.post('/pharmacy/stock', {
        formularyCode: recv.formularyCode,
        batchNo: recv.batchNo.trim(),
        expiry: recv.expiry,
        quantity: Number(recv.quantity),
        unitCostPkr: Number(recv.unitCostPkr),
      });
      setRecvOpen(false);
      setRecv({ formularyCode: '', batchNo: '', expiry: '', quantity: '', unitCostPkr: '' });
      setNonce((n) => n + 1);
    } catch (e) {
      setRecvErr(describeError(e).message);
    } finally {
      setRecvBusy(false);
    }
  };
  // Expiry is required, not optional-with-a-default: a batch received without
  // one would be indistinguishable from stock that never expires, and FEFO
  // would order it first.
  const canReceive =
    recv.formularyCode !== '' &&
    recv.batchNo.trim() !== '' &&
    recv.expiry !== '' &&
    Number(recv.quantity) > 0 &&
    Number.isFinite(Number(recv.unitCostPkr)) &&
    recv.unitCostPkr !== '';

  const drugByCode = useMemo(() => {
    const m = new Map<string, Drug>();
    formulary?.forEach((d) => m.set(d.code, d));
    return m;
  }, [formulary]);
  const onHandByCode = useMemo(() => {
    const m = new Map<string, number>();
    stock.data?.forEach((g) => m.set(g.formularyCode, g.onHand));
    return m;
  }, [stock.data]);

  // Only drugs with in-date stock can be added — the counter should not present
  // a choice the shelf can't honour.
  const dispensable = (formulary ?? []).filter((d) => (onHandByCode.get(d.code) ?? 0) > 0);
  const pullList = (stock.data ?? []).filter((g) => g.expired > 0);

  const cartTotal = cart.reduce((s, c) => s + (drugByCode.get(c.code)?.pricePkr ?? 0) * c.quantity, 0);

  const addToCart = () => {
    if (!pickCode || !Number(pickQty)) return;
    setCart((c) => {
      const existing = c.find((x) => x.code === pickCode);
      if (existing) return c.map((x) => (x.code === pickCode ? { ...x, quantity: x.quantity + Number(pickQty) } : x));
      return [...c, { code: pickCode, quantity: Number(pickQty) }];
    });
    setPickCode('');
    setPickQty('1');
  };

  const dispense = async () => {
    setBusy(true);
    setErr('');
    setReceipt(null);
    try {
      const r = await apiClient.post<Receipt>('/pharmacy/dispense', {
        items: cart.map((c) => ({ code: c.code, quantity: c.quantity })),
        paymentMethod: method,
        // The batch provenance recorded against this sale is what a recall is
        // answered from. Without a patientId it records WHICH lots went out but
        // not to WHOM — the field existed and was indexed, and this page never
        // sent it, so every sale in the system was anonymous.
        ...(patientId ? { patientId } : {}),
      });
      setReceipt(r.data);
      setCart([]);
      setPatientId('');
      setNonce((n) => n + 1);
    } catch (e: any) {
      // The server's words: "Insufficient in-date stock ... (N more on hand but
      // EXPIRED — pull from shelf, do not dispense)". That sentence tells the
      // dispenser exactly what happened and what to do.
      setErr(e?.response?.data?.message ?? 'Could not complete the dispense');
    } finally {
      setBusy(false);
    }
  };

  // Does any cart line exceed what's dispensable? The server is the real guard;
  // this is a courtesy so the dispenser sees it before clicking.
  const overCart = cart.find((c) => c.quantity > (onHandByCode.get(c.code) ?? 0));

  // A controlled drug in the cart with no patient selected. The server refuses
  // this outright; showing it here means the dispenser finds out before the
  // click rather than after. Both exist on purpose — the server refusal is the
  // control, this is only the warning.
  const controlledUnnamed = patientId ? [] : cart.filter((c) => drugByCode.get(c.code)?.controlled);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Pharmacy
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Dispensing and stock. On hand means in-date and dispensable.
      </Typography>

      {/* Pull worklist leads: expired stock must come off the shelf. */}
      {!!pullList.length && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>{pullList.length} drug(s) have expired stock to pull from the shelf</AlertTitle>
          <Stack spacing={0.5}>
            {pullList.map((g) => (
              <Typography key={g.formularyCode} variant="body2">
                <strong>{g.name}</strong> — {g.expired} expired unit(s):{' '}
                {g.batches.filter((b) => b.expired).map((b) => `${b.batchNo} (exp ${b.expiry.slice(0, 10)})`).join(', ')}
              </Typography>
            ))}
          </Stack>
        </Alert>
      )}

      {err && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>
          {err}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* --- Dispense (POS) --- */}
        <Grid item xs={12} md={5}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                Dispense
              </Typography>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                {/* labelId/id are not decoration: without them MUI never links
                    the InputLabel to the combobox, so this control has NO
                    accessible name — a screen reader at the counter announces
                    "combobox" and nothing about what it selects. Every Select
                    in this app was built this way. */}
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel id="rx-drug-label">Drug</InputLabel>
                  <Select labelId="rx-drug-label" id="rx-drug" label="Drug" value={pickCode} onChange={(e: SelectChangeEvent) => setPickCode(e.target.value)}>
                    {dispensable.map((d) => (
                      <MenuItem key={d.code} value={d.code}>
                        {d.name} · {pkr(d.pricePkr)} · {onHandByCode.get(d.code)} in stock
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  label="Qty"
                  value={pickQty}
                  onChange={(e) => setPickQty(numericInput(e.target.value))}
                  sx={{ width: 72 }}
                />
                <Button size="small" sx={{ mt: 0.5 }} disabled={!pickCode || !Number(pickQty)} onClick={addToCart}>
                  Add
                </Button>
              </Stack>

              {!dispensable.length && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  No in-date stock to dispense. Receive stock or pull expired batches.
                </Typography>
              )}

              {!!cart.length && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Table size="small">
                    <TableBody>
                      {cart.map((c) => {
                        const drug = drugByCode.get(c.code);
                        const over = c.quantity > (onHandByCode.get(c.code) ?? 0);
                        return (
                          <TableRow key={c.code}>
                            <TableCell sx={{ border: 0, py: 0.5 }}>
                              {drug?.name} × {c.quantity}
                              {over && (
                                <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                                  only {onHandByCode.get(c.code) ?? 0} in date
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right" sx={{ border: 0, py: 0.5 }}>
                              {pkr((drug?.pricePkr ?? 0) * c.quantity)}
                              <Button size="small" color="error" sx={{ minWidth: 0, ml: 1 }} onClick={() => setCart((x) => x.filter((y) => y.code !== c.code))}>
                                ×
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {pkr(cartTotal)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  {/* Who is receiving this. Optional for an over-the-counter
                      sale, mandatory for a controlled drug (the server refuses
                      that outright). Naming the patient is also what makes the
                      batch record reachable: a recall of lot B2 finds people
                      through this field and nothing else. */}
                  <FormControl size="small" fullWidth sx={{ mt: 2 }}>
                    <InputLabel id="rx-patient-label">Patient</InputLabel>
                    <Select
                      labelId="rx-patient-label"
                      id="rx-patient"
                      label="Patient"
                      value={patientId}
                      onChange={(e: SelectChangeEvent) => setPatientId(e.target.value)}
                    >
                      <MenuItem value="">
                        <em>Over the counter — no patient</em>
                      </MenuItem>
                      {(patients ?? []).map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.name} · {p.mrn}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Stack direction="row" spacing={1} sx={{ mt: 2 }} alignItems="center">
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel id="rx-payment-label">Payment</InputLabel>
                      <Select labelId="rx-payment-label" id="rx-payment" label="Payment" value={method} onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}>
                        {METHODS.map((m) => (
                          <MenuItem key={m} value={m}>
                            {m.toLowerCase()}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button variant="contained" disabled={busy || !!overCart || !!controlledUnnamed.length} onClick={dispense}>
                      Dispense {pkr(cartTotal)}
                    </Button>
                  </Stack>
                  {overCart && (
                    <Typography variant="caption" color="error.main" sx={{ mt: 1, display: 'block' }}>
                      A line exceeds in-date stock. Reduce it before dispensing.
                    </Typography>
                  )}
                  {!!controlledUnnamed.length && (
                    <Typography variant="caption" color="error.main" sx={{ mt: 1, display: 'block' }}>
                      {controlledUnnamed.map((c) => drugByCode.get(c.code)?.name).join(', ')} is controlled —
                      select the patient receiving it. The server will refuse an unnamed sale.
                    </Typography>
                  )}
                  {!patientId && !controlledUnnamed.length && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      No patient selected. The batches will be recorded, but a recall could not trace
                      this sale to a person.
                    </Typography>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {receipt && (
            <Card elevation={0} sx={{ border: 1, borderColor: 'success.light', borderRadius: 3, mt: 3 }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {receipt.receiptNumber}
                  </Typography>
                  <Chip size="small" color="success" label={`${receipt.paymentMethod.toLowerCase()} · ${pkr(receipt.totalPkr)}`} />
                </Stack>
                <Table size="small" sx={{ mt: 1 }}>
                  <TableBody>
                    {receipt.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell sx={{ border: 0, py: 0.25 }}>
                          {it.name} × {it.quantity}
                          {/* Show EVERY batch drawn, not just the first. FEFO can
                              satisfy one line from several lots: a receipt reading
                              "80 × B1" for 50 from B1 and 30 from a recalled B2 is
                              wrong in the direction that hides the risk. */}
                          {it.batches?.length
                            ? ` · ${it.batches.map((b) => `${b.batchNo} ×${b.quantity}`).join(', ')}`
                            : it.batchNo
                              ? ` · ${it.batchNo}`
                              : ''}
                        </TableCell>
                        <TableCell align="right" sx={{ border: 0, py: 0.25 }}>
                          {pkr(it.lineTotalPkr)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* --- Stock --- */}
        <Grid item xs={12} md={7}>
          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ pb: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Stock
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    On hand is in-date. Expired units are shown apart — to pull, not to sell.
                  </Typography>
                </Box>
                <Button size="small" variant="outlined" onClick={() => setRecvOpen(true)}>
                  Receive stock
                </Button>
              </Stack>
            </CardContent>
            <Divider sx={{ mt: 2 }} />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Drug</TableCell>
                  <TableCell align="right">On hand</TableCell>
                  <TableCell align="right">Expired</TableCell>
                  <TableCell align="right">Price</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(stock.data ?? []).map((g) => (
                  <TableRow key={g.formularyCode}>
                    <TableCell>{g.name}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {g.onHand}
                    </TableCell>
                    <TableCell align="right">
                      {g.expired ? <Chip size="small" color="error" variant="outlined" label={g.expired} /> : '—'}
                    </TableCell>
                    <TableCell align="right">{pkr(drugByCode.get(g.formularyCode)?.pricePkr ?? 0)}</TableCell>
                  </TableRow>
                ))}
                {!stock.data?.length && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No stock received yet. Use <strong>Receive stock</strong> to book in a batch.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={recvOpen} onClose={() => !recvBusy && setRecvOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Receive stock</DialogTitle>
        <DialogContent>
          {recvErr && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {recvErr}
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth size="small" select required label="Drug"
                value={recv.formularyCode} onChange={setRecvField('formularyCode')}
              >
                {(formulary ?? []).map((d) => (
                  <MenuItem key={d.code} value={d.code}>
                    {d.name}
                    {d.controlled ? ' · controlled' : ''}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              {/* The batch number is how a recall names what to pull, and how a
                  dispense records what went out. A batch booked in without one
                  is stock nobody can trace. */}
              <TextField
                fullWidth size="small" required label="Batch no."
                value={recv.batchNo} onChange={setRecvField('batchNo')}
                helperText="As printed on the pack"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" required type="date" label="Expiry"
                value={recv.expiry} onChange={setRecvField('expiry')}
                InputLabelProps={{ shrink: true }}
                helperText="Drives FEFO and the pull worklist"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" required label="Quantity"
                value={recv.quantity}
                onChange={(e) => setRecv((p) => ({ ...p, quantity: numericInput(e.target.value) }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" required label="Unit cost (PKR)"
                value={recv.unitCostPkr}
                onChange={(e) => setRecv((p) => ({ ...p, unitCostPkr: numericInput(e.target.value) }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRecvOpen(false)} disabled={recvBusy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={receiveStock} disabled={recvBusy || !canReceive}>
            {recvBusy ? 'Receiving…' : 'Receive'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
