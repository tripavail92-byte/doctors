// PhototherapyPage — the NB-UVB ledger.
//
// The screen is shaped by one rule from the dose engine: it REFUSES to suggest
// a dose until the reaction to the last session is recorded. So the form asks
// for the erythema grade FIRST and only then reveals the dose. That ordering is
// not decoration — a defaulted "no erythema" is how the engine came to escalate
// UV onto a patient it had just blistered, and the UI must not re-open the hole
// the server closed.
//
// The dose field is never free text. It is pre-filled by the server, and the
// rationale under it is the server's own words, so a clinician sees WHY this
// number and can disagree on the record rather than silently type over it.
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
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { apiClient } from '../api/client';
import { useApi } from '../api/useApi';

interface Session {
  id: string;
  sessionNo: number;
  deliveredAt: string | null;
  doseMj: number;
  cumulativeMj: number;
  gapDays: number | null;
  erythemaGrade: number;
  burnFlag: boolean;
  skipped: boolean;
  notes: string | null;
}

interface Course {
  id: string;
  patientId: string;
  modality: string;
  indication: string;
  fitzpatrickType: number;
  startDoseMj: number;
  maxDoseMj: number;
  incrementPct: number;
  burnHoldDoseMj: number | null;
  status: string;
  sessions: Session[];
  cumulativeMj: number;
  lifetimeMj: number;
  sessionsDelivered: number;
  cumulativeWarning: string | null;
}

interface Decision {
  suggestedMj?: number;
  action?: string;
  rationale?: string;
  skip?: boolean;
  capped?: boolean;
  lapsed?: boolean;
  gradeRequired?: boolean;
  lastDeliveredMj?: number;
}

const GRADES = [
  { v: 0, label: '0 — none' },
  { v: 1, label: '1 — pink, faded <24h' },
  { v: 2, label: '2 — persisting 24–48h' },
  { v: 3, label: '3 — >48h or blistering' },
];

// Skin type drives the start dose and the ceiling, so a wrong numeral here is a
// safety label, not a typo. A repeat()/slice() trick rendered type IV as "III".
const FITZPATRICK = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

export default function PhototherapyPage() {
  const [courseId, setCourseId] = useState('');
  const [grade, setGrade] = useState<number | ''>('');
  const [overrideDose, setOverrideDose] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ sev: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [tick, setTick] = useState(0);

  const { data: course, loading, error } = useApi<Course | null>(
    () =>
      courseId
        ? apiClient.get<Course>(`/dermatology/phototherapy/courses/${courseId}`).then((r) => r.data)
        : Promise.resolve(null),
    [courseId, tick],
  );

  // Ask the engine what it would give. Sending the grade is what unlocks a
  // number — without it the server returns {gradeRequired: true} and no dose.
  const preview = async (g: number | '') => {
    if (!courseId) return;
    const q = g === '' ? '' : `?lastErythemaGrade=${g}`;
    try {
      const r = await apiClient.get<Decision>(
        `/dermatology/phototherapy/courses/${courseId}/next-dose${q}`,
      );
      setDecision(r.data);
    } catch (e: any) {
      setDecision(null);
      setMsg({ sev: 'error', text: e?.response?.data?.message ?? 'Could not compute a dose' });
    }
  };

  const record = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {};
      if (grade !== '') body.lastErythemaGrade = grade;
      if (overrideDose) body.overrideDoseMj = Number(overrideDose);
      if (reason) body.overrideReason = reason;
      const r = await apiClient.post(`/dermatology/phototherapy/courses/${courseId}/sessions`, body);
      setMsg(
        r.data?.held
          ? { sev: 'warning', text: 'Session HELD and recorded. Notify the prescriber.' }
          : { sev: 'success', text: `Delivered ${r.data?.session?.doseMj} mJ/cm².` },
      );
      setOverrideDose('');
      setReason('');
      setGrade('');
      setDecision(null);
      setTick((t) => t + 1);
    } catch (e: any) {
      setMsg({ sev: 'error', text: e?.response?.data?.message ?? 'Could not record the session' });
    } finally {
      setBusy(false);
    }
  };

  const burnHold = course?.burnHoldDoseMj ?? null;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Phototherapy
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        NB-UVB ledger. The dose is decided server-side from the protocol, the skin type and the
        ledger — the clinic never types a cumulative total.
      </Typography>

      <TextField
        size="small"
        label="Course ID"
        value={courseId}
        onChange={(e) => {
          setCourseId(e.target.value.trim());
          setDecision(null);
        }}
        sx={{ mb: 3, minWidth: 380 }}
        helperText="Paste a phototherapy course id to open its ledger."
      />

      {loading && courseId && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      {course && (
        <>
          {/* The burn interlock is the loudest thing on the screen, because it
              is the one state where continuing as normal harms someone. */}
          {burnHold != null && (
            <Alert severity="error" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
              <AlertTitle>Unresolved grade-3 burn at {burnHold} mJ/cm²</AlertTitle>
              This patient has an unresolved burn — on <strong>any</strong> of their courses. The
              dose may only be overridden downward until a session is delivered at or below{' '}
              {Math.round(burnHold * 0.5)} mJ/cm².
            </Alert>
          )}
          {course.cumulativeWarning && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {course.cumulativeWarning}
            </Alert>
          )}

          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} md={5}>
              <Card
                elevation={0}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 3, bgcolor: 'primary.main', color: '#fff' }}
              >
                <CardContent>
                  <Typography variant="body2" sx={{ opacity: 0.85 }}>
                    Cumulative this course
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {course.cumulativeMj.toLocaleString()} mJ/cm²
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.85 }}>
                    lifetime {course.lifetimeMj.toLocaleString()} across all courses ·{' '}
                    {course.sessionsDelivered} sessions delivered
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={7}>
              <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
                <CardContent>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label={course.modality.replace('_', '-')} />
                    <Chip size="small" label={course.indication} />
                    <Chip size="small" label={`Fitzpatrick ${FITZPATRICK[course.fitzpatrickType] ?? course.fitzpatrickType}`} />
                    <Chip size="small" label={`start ${course.startDoseMj}`} />
                    <Chip size="small" label={`ceiling ${course.maxDoseMj}`} color="warning" />
                    <Chip size="small" label={`+${course.incrementPct}%/session`} />
                    <Chip
                      size="small"
                      label={course.status}
                      color={course.status === 'ACTIVE' ? 'success' : 'default'}
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {course.status === 'ACTIVE' && (
            <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                  Record a session
                </Typography>

                {/* Grade first, dose second. The server will not suggest a dose
                    without the reaction, and the form mirrors that order so the
                    clinician cannot skip past it. */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
                  <TextField
                    select
                    size="small"
                    label="Erythema after the LAST session"
                    value={grade}
                    onChange={(e) => {
                      const g = e.target.value === '' ? '' : Number(e.target.value);
                      setGrade(g);
                      void preview(g);
                    }}
                    sx={{ minWidth: 260 }}
                    required
                  >
                    {GRADES.map((g) => (
                      <MenuItem key={g.v} value={g.v}>
                        {g.label}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    size="small"
                    label="Dose (mJ/cm²)"
                    value={overrideDose || decision?.suggestedMj || ''}
                    onChange={(e) => setOverrideDose(e.target.value)}
                    disabled={!decision || decision.gradeRequired}
                    sx={{ width: 170 }}
                    helperText={decision?.suggestedMj ? 'server-suggested' : 'record the grade first'}
                  />

                  <TextField
                    size="small"
                    label="Override reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={!overrideDose || Number(overrideDose) === decision?.suggestedMj}
                    sx={{ flex: 1, minWidth: 220 }}
                    helperText="required to depart from the suggestion"
                  />
                </Stack>

                {decision?.gradeRequired && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    {decision.rationale}
                  </Alert>
                )}

                {decision && !decision.gradeRequired && (
                  <Alert
                    severity={decision.skip ? 'error' : decision.lapsed ? 'warning' : 'info'}
                    sx={{ mt: 2 }}
                  >
                    <AlertTitle sx={{ mb: 0 }}>
                      {decision.action}
                      {decision.capped && ' · capped at the ceiling'}
                      {decision.lapsed && ' · course lapsed'}
                    </AlertTitle>
                    {/* The engine's own words. A number without its reason is
                        how a clinician learns to click through the warning. */}
                    {decision.rationale}
                  </Alert>
                )}

                <Button
                  variant="contained"
                  onClick={record}
                  disabled={busy || grade === '' || !!decision?.gradeRequired}
                  sx={{ mt: 2 }}
                >
                  {decision?.skip ? 'Record hold' : 'Record session'}
                </Button>

                {msg && (
                  <Alert severity={msg.sev} sx={{ mt: 2 }}>
                    {msg.text}
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ pb: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Ledger
              </Typography>
            </CardContent>
            <Divider sx={{ mt: 2 }} />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Dose</TableCell>
                  <TableCell align="right">Cumulative</TableCell>
                  <TableCell align="right">Gap</TableCell>
                  <TableCell>Erythema</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {course.sessions.map((s) => (
                  <TableRow key={s.id} sx={s.burnFlag ? { bgcolor: 'error.light' } : undefined}>
                    <TableCell>{s.sessionNo}</TableCell>
                    <TableCell>
                      {s.deliveredAt ? s.deliveredAt.slice(0, 10) : <Chip size="small" label="held" color="error" />}
                    </TableCell>
                    <TableCell align="right">{s.doseMj || '—'}</TableCell>
                    <TableCell align="right">{s.cumulativeMj.toLocaleString()}</TableCell>
                    <TableCell align="right">{s.gapDays ?? '—'}</TableCell>
                    <TableCell>
                      {/* burnFlag means two different things depending on the
                          row, and conflating them is how "grade 0" ended up
                          rendered in red on a held session:
                            - on a HELD row it means "held because of a burn" —
                              the row has no reaction of its own;
                            - on a DELIVERED row it means this dose caused one.
                          0 is also the "not yet assessed" sentinel, never "no
                          erythema", so it renders as a dash rather than a zero. */}
                      {s.skipped ? (
                        <Chip size="small" color="error" variant="outlined" label="burn hold" />
                      ) : s.erythemaGrade >= 3 ? (
                        <Chip size="small" color="error" label={`grade ${s.erythemaGrade}`} />
                      ) : s.erythemaGrade > 0 ? (
                        <Chip size="small" color="warning" label={`grade ${s.erythemaGrade}`} />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{s.notes ?? ''}</TableCell>
                  </TableRow>
                ))}
                {!course.sessions.length && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No sessions yet. The first dose is seeded from the skin type
                        ({course.startDoseMj} mJ/cm²).
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </Box>
  );
}
