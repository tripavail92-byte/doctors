// One patient's record, in one place.
//
// Until now there was nowhere in the SPA to look at a patient. You could list
// them, and you could act on them from eight different module screens, but
// there was no answer to "what has happened to this person" — which is the
// first question anyone asks before doing anything clinical.
//
// The design rule for this page is the one in RecordSection: a section that
// FAILED to load must never be mistaken for a patient who has nothing. On a
// chart, absence is evidence — "no medicines dispensed" is something a
// prescriber acts on. So every section says which of the four it is: still
// loading, not in the plan, failed, or genuinely empty.
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Grid,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { apiClient } from '../api/client';
import { useApi } from '../api/useApi';
import RecordSection from '../components/RecordSection';
import type { Patient } from '../api/types';

interface Encounter {
  id: string;
  status: string;
  startedAt: string;
  reason?: string | null;
}
interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  totalPkr: number;
  outstandingPkr?: number;
  issuedAt?: string;
}
interface DispenseItem {
  id: string;
  name: string;
  quantity: number;
  batchNo: string | null;
  batches?: { batchNo: string; quantity: number }[];
}
interface Dispense {
  id: string;
  receiptNumber: string;
  createdAt: string;
  totalPkr: number;
  items: DispenseItem[];
}
interface LabOrder {
  id: string;
  orderNumber?: string;
  status: string;
  createdAt: string;
  items?: { id: string; testName?: string; name?: string }[];
}
interface Immunization {
  id: string;
  vaccineCode?: string;
  vaccine?: string;
  administeredAt?: string;
  doseNumber?: number;
}

const dt = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-PK') : '—');
const pkr = (n: number) => 'Rs ' + (n ?? 0).toLocaleString('en-PK');

function ageFromDob(dob: string | null): string {
  if (!dob) return 'age unknown';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 'age unknown';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return `${age} yr`;
}

export default function PatientRecordPage() {
  const { id = '' } = useParams();

  const patient = useApi<Patient>(() => apiClient.get<Patient>(`/patients/${id}`).then((r) => r.data), [id]);
  const encounters = useApi<Encounter[]>(
    () => apiClient.get<Encounter[]>(`/patients/${id}/encounters`).then((r) => r.data), [id]);
  const invoices = useApi<Invoice[]>(
    () => apiClient.get<Invoice[]>(`/patients/${id}/invoices`).then((r) => r.data), [id]);
  const dispenses = useApi<Dispense[]>(
    () => apiClient.get<Dispense[]>(`/pharmacy/patients/${id}/dispenses`).then((r) => r.data), [id]);
  const labOrders = useApi<LabOrder[]>(
    () => apiClient.get<LabOrder[]>(`/lab/patients/${id}/orders`).then((r) => r.data), [id]);
  const immunizations = useApi<Immunization[]>(
    () => apiClient.get<Immunization[]>(`/patients/${id}/immunizations`).then((r) => r.data), [id]);

  const p = patient.data;

  return (
    <Box>
      <Button component={RouterLink} to="/patients" startIcon={<ArrowBackIcon />} size="small" sx={{ mb: 2 }}>
        All patients
      </Button>

      {patient.loading && <Typography variant="body2" color="text.secondary">Loading patient…</Typography>}

      {/* If the patient header itself failed, say so loudly and stop. Rendering
          the sections under an unknown name is how a note ends up on the wrong
          chart. */}
      {!patient.loading && patient.error && (
        <Typography color="error.main" sx={{ fontWeight: 600 }}>
          This patient could not be loaded — {patient.error}. Nothing below is shown, because it
          could not be confirmed which patient it would belong to.
        </Typography>
      )}

      {p && (
        <>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {p.name}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
              <Chip size="small" variant="outlined" label={p.mrn} />
              <Typography variant="body2" color="text.secondary">
                {ageFromDob(p.dob)}
                {p.gender ? ` · ${p.gender}` : ''} · {p.phone}
              </Typography>
              {/* Date of birth drives paediatric dosing and growth z-scores. A
                  missing one is not cosmetic — it silently changes what those
                  produce — so it is stated on the chart, not hidden. */}
              {!p.dob && (
                <Chip size="small" color="warning" variant="outlined" label="No date of birth on file" />
              )}
            </Stack>
          </Box>

          <Grid container spacing={0} columns={1}>
            <Grid item xs={1}>
              <RecordSection
                title="Visits"
                subtitle="Encounters recorded for this patient."
                loading={encounters.loading} error={encounters.error} status={encounters.status}
                count={encounters.data?.length ?? 0}
                emptyText="No visits recorded for this patient yet."
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell align="right">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(encounters.data ?? []).map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{dt(e.startedAt)}</TableCell>
                        <TableCell>{e.reason || '—'}</TableCell>
                        <TableCell align="right">
                          <Chip size="small" variant="outlined" label={e.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </RecordSection>

              <RecordSection
                title="Medicines dispensed"
                subtitle="Every batch handed over, which is what a recall is answered from."
                loading={dispenses.loading} error={dispenses.error} status={dispenses.status}
                count={dispenses.data?.length ?? 0}
                emptyText="No medicines dispensed to this patient from this pharmacy."
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Receipt</TableCell>
                      <TableCell>Items</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(dispenses.data ?? []).map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>{dt(d.createdAt)}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{d.receiptNumber}</TableCell>
                        <TableCell>
                          {/* Every lot, not just the first. FEFO can satisfy one
                              line from several batches, and the people missing
                              from an under-reported receipt are exactly the ones
                              a recall needs to reach. */}
                          {d.items.map((it) => (
                            <div key={it.id}>
                              {it.name} × {it.quantity}
                              {it.batches?.length
                                ? ` · ${it.batches.map((b) => `${b.batchNo} ×${b.quantity}`).join(', ')}`
                                : it.batchNo
                                  ? ` · ${it.batchNo}`
                                  : ''}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell align="right">{pkr(d.totalPkr)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </RecordSection>

              <RecordSection
                title="Lab orders"
                loading={labOrders.loading} error={labOrders.error} status={labOrders.status}
                count={labOrders.data?.length ?? 0}
                emptyText="No lab orders for this patient."
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Order</TableCell>
                      <TableCell>Tests</TableCell>
                      <TableCell align="right">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(labOrders.data ?? []).map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>{dt(o.createdAt)}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{o.orderNumber ?? '—'}</TableCell>
                        <TableCell>
                          {(o.items ?? []).map((i) => i.testName ?? i.name).filter(Boolean).join(', ') || '—'}
                        </TableCell>
                        <TableCell align="right">
                          <Chip size="small" variant="outlined" label={o.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </RecordSection>

              <RecordSection
                title="Immunizations"
                loading={immunizations.loading} error={immunizations.error} status={immunizations.status}
                count={immunizations.data?.length ?? 0}
                emptyText="No immunizations recorded here. This is not proof the patient is unvaccinated — doses given elsewhere will not appear."
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Vaccine</TableCell>
                      <TableCell align="right">Dose</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(immunizations.data ?? []).map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>{dt(v.administeredAt)}</TableCell>
                        <TableCell>{v.vaccine ?? v.vaccineCode ?? '—'}</TableCell>
                        <TableCell align="right">{v.doseNumber ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </RecordSection>

              <RecordSection
                title="Invoices"
                loading={invoices.loading} error={invoices.error} status={invoices.status}
                count={invoices.data?.length ?? 0}
                emptyText="No invoices for this patient."
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Invoice</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="right">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(invoices.data ?? []).map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>{dt(i.issuedAt)}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{i.invoiceNumber}</TableCell>
                        <TableCell align="right">{pkr(i.totalPkr)}</TableCell>
                        <TableCell align="right">
                          <Chip size="small" variant="outlined" label={i.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </RecordSection>

              <Typography variant="caption" color="text.secondary">
                Trends and growth charts for this patient are on the{' '}
                <Link component={RouterLink} to="/trends">Trends</Link> and{' '}
                <Link component={RouterLink} to="/growth">Growth</Link> screens.
              </Typography>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
