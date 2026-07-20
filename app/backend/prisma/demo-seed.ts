/**
 * Demo data for Glow Derma — the dataset a client actually sees.
 *
 * WHY THIS IS SEPARATE FROM seed.ts
 * ---------------------------------
 * seed.ts establishes the PLATFORM: tenant, facility, users, packs, entitlements,
 * service catalog, dose rules. That must run everywhere, including CI, and the
 * safety suites depend on parts of it.
 *
 * This file is the SHOWROOM: patients with names, a half-finished phototherapy
 * course, invoices in three different states, staff on a payroll. None of it is
 * needed by any test — every safety suite creates its own fixtures — so it must
 * never run in CI, where 2,000 rows of demo noise would only slow things down.
 *
 * WHY IT EXISTS AT ALL
 * --------------------
 * The dev database had drifted to 2,026 patients, of which ~2,022 were probes
 * from safety runs: "Lab Probe 95854", "VoidAudit spoof 41883", BIL-*, PROBE-*.
 * The four real demo patients were buried, and seed.ts could not fix it because
 * its demo block is guarded by `patient.count() === 0` — once the first probe
 * existed, the demo data never regenerated. Anyone opening the app saw a test
 * harness.
 *
 * IDEMPOTENT: keyed on MRN within the tenant, so re-running updates rather than
 * duplicating. The old path was not, which is how GD-BABY1 came to exist five
 * times over.
 *
 * NOT CLINICAL DATA. Every value here is illustrative. The phototherapy doses
 * mirror what the engine itself computes for a Fitzpatrick III psoriasis course
 * (500 → 575 → 661, +15% per session) so the screen is self-consistent — they
 * are not a treatment recommendation, and nothing here is cleared for patient
 * use. See docs/clinical-sign-off-register.md.
 *
 * Run: npm run demo:seed          (after npm run db:seed)
 *      npm run demo:reset         (rebuild the whole database and land here)
 */
import { PrismaClient, AppointmentStatus, InvoiceStatus, LeadStatus, PaymentMethod } from '@prisma/client';
// The start dose and the ceiling are clinical values. Take them from the engine
// that will actually be asked for them, rather than typing numbers into a demo
// file — a hardcoded ceiling here would be a made-up clinical threshold sitting
// in the database, and the first thing anyone would do is trust it.
import { NBUVB_STANDARD, startDoseFor, ceilingFor } from '../src/dermatology/engines/phototherapy.engine';

// Connect as the table OWNER, exactly as seed.ts does. The runtime role is
// NOBYPASSRLS and this script sets no app.tenant_id, so under DATABASE_URL every
// read returns zero rows — and a seed that reads nothing does not fail, it
// happily creates a second copy of everything. That is precisely how GD-BABY1
// ended up in the database five times.
const seedUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url: seedUrl } } });

// Fixed "today" anchors so the demo always looks current without the data
// shifting under a screenshot mid-session.
const NOW = new Date();
const at = (dayOffset: number, hour: number, minute = 0) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const monthsAgo = (n: number) => {
  const d = new Date(NOW);
  d.setMonth(d.getMonth() - n);
  d.setHours(9, 30, 0, 0);
  return d;
};

const PATIENTS = [
  { mrn: 'GD-0001', name: 'Fatima Malik', phone: '+92 300 1234567', gender: 'female', dob: '1990-04-12' },
  { mrn: 'GD-0002', name: 'Bilal Ahmed', phone: '+92 321 7654321', gender: 'male', dob: '1985-11-03' },
  { mrn: 'GD-0003', name: 'Sana Riaz', phone: '+92 333 5551234', gender: 'female', dob: '1996-07-25' },
  { mrn: 'GD-0004', name: 'Usman Tariq', phone: '+92 345 9876543', gender: 'male', dob: '1978-01-19' },
  { mrn: 'GD-0005', name: 'Ayesha Siddiqui', phone: '+92 300 4567890', gender: 'female', dob: '1993-09-08' },
  { mrn: 'GD-0006', name: 'Hamza Sheikh', phone: '+92 322 3344556', gender: 'male', dob: '1988-02-14' },
  { mrn: 'GD-0007', name: 'Zainab Qureshi', phone: '+92 301 2233445', gender: 'female', dob: '1999-12-01' },
  { mrn: 'GD-0008', name: 'Imran Yousaf', phone: '+92 336 7788990', gender: 'male', dob: '1970-06-30' },
  { mrn: 'GD-0009', name: 'Nadia Aslam', phone: '+92 314 1122334', gender: 'female', dob: '1982-03-22' },
  { mrn: 'GD-0010', name: 'Ali Raza', phone: '+92 305 5566778', gender: 'male', dob: '1995-08-17' },
  { mrn: 'GD-0011', name: 'Mehwish Iqbal', phone: '+92 331 9900112', gender: 'female', dob: '1991-05-05' },
  { mrn: 'GD-0012', name: 'Farhan Khan', phone: '+92 342 4455667', gender: 'male', dob: '2001-10-11' },
];

const STAFF = [
  { name: 'Dr. Ayesha Khan', designation: 'Consultant Dermatologist', baseSalaryPkr: 350000, allowancesPkr: 40000, cnic: '35202-1000001-1' },
  { name: 'Dr. Hassan Javed', designation: 'Aesthetic Physician', baseSalaryPkr: 280000, allowancesPkr: 30000, cnic: '35202-1000002-3' },
  { name: 'Rabia Nawaz', designation: 'Senior Laser Therapist', baseSalaryPkr: 95000, allowancesPkr: 12000, cnic: '35202-1000003-5' },
  { name: 'Saima Butt', designation: 'Nurse', baseSalaryPkr: 80000, allowancesPkr: 12000, cnic: '35202-1000004-7' },
  { name: 'Kashif Mehmood', designation: 'Receptionist', baseSalaryPkr: 55000, allowancesPkr: 8000, cnic: '35202-1000005-9' },
  { name: 'Nida Farooq', designation: 'Pharmacy Technician', baseSalaryPkr: 62000, allowancesPkr: 8000, cnic: '35202-1000006-1' },
];

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'glow-derma' } });
  if (!tenant) throw new Error('tenant glow-derma not found — run `npm run db:seed` first.');
  const owner = await prisma.user.findFirst({ where: { tenantId: tenant.id, email: 'owner@glowderma.pk' } });
  if (!owner) throw new Error('owner user not found — run `npm run db:seed` first.');

  const t = tenant.id;

  // --- Patients ------------------------------------------------------------
  // Patient has no unique on (tenantId, mrn) — see the note in the README. Until
  // it does, idempotency has to be done by hand rather than by upsert.
  const byMrn = new Map<string, string>();
  for (const p of PATIENTS) {
    const existing = await prisma.patient.findFirst({ where: { tenantId: t, mrn: p.mrn } });
    const data = { name: p.name, phone: p.phone, gender: p.gender, dob: new Date(p.dob) };
    const row = existing
      ? await prisma.patient.update({ where: { id: existing.id }, data })
      : await prisma.patient.create({ data: { tenantId: t, mrn: p.mrn, ...data } });
    byMrn.set(p.mrn, row.id);
  }

  // --- Staff ---------------------------------------------------------------
  for (const s of STAFF) {
    const existing = await prisma.employee.findFirst({ where: { tenantId: t, cnic: s.cnic } });
    if (existing) await prisma.employee.update({ where: { id: existing.id }, data: s });
    else await prisma.employee.create({ data: { tenantId: t, ...s } });
  }

  // --- Today's column ------------------------------------------------------
  await prisma.appointment.deleteMany({ where: { tenantId: t, start: { gte: at(-1, 0) } } });
  const schedule: [string, number, number, string, AppointmentStatus][] = [
    ['GD-0001', 0, 10, 'Hydrafacial', AppointmentStatus.CONFIRMED],
    ['GD-0003', 0, 11, 'Laser Hair Removal — full face', AppointmentStatus.CONFIRMED],
    ['GD-0007', 0, 12, 'Acne consultation', AppointmentStatus.BOOKED],
    ['GD-0002', 0, 15, 'NB-UVB phototherapy', AppointmentStatus.CONFIRMED],
    ['GD-0005', 1, 10, 'Chemical peel', AppointmentStatus.BOOKED],
    ['GD-0009', 1, 11, 'Melasma review', AppointmentStatus.BOOKED],
    ['GD-0011', 1, 16, 'Botox — follow-up', AppointmentStatus.BOOKED],
  ];
  for (const [mrn, day, hour, service, status] of schedule) {
    await prisma.appointment.create({
      data: {
        tenantId: t,
        patientId: byMrn.get(mrn)!,
        providerId: owner.id,
        start: at(day, hour),
        end: at(day, hour, 45),
        service,
        status,
      },
    });
  }

  // --- Invoices: one paid, one part-paid, one outstanding ------------------
  const bills: [string, string, [string, string, number, number][], number][] = [
    ['GD-0001', 'INV-2026-0001', [['SVC-HYDRA', 'Hydrafacial', 15000, 1]], 15000],
    ['GD-0003', 'INV-2026-0002', [['SVC-LHR', 'Laser hair removal — full face', 12000, 3]], 20000],
    ['GD-0002', 'INV-2026-0003', [['SVC-NBUVB', 'NB-UVB session', 3500, 8], ['SVC-CONS', 'Consultation', 3000, 1]], 0],
  ];
  for (const [mrn, number, lines, paid] of bills) {
    const total = lines.reduce((n, [, , price, qty]) => n + price * qty, 0);
    // Children first. deleteMany does not cascade, so deleting the invoice while
    // its line items still point at it violates the FK — which made the second
    // run of this script die here, having already rewritten the patients above.
    const old = await prisma.invoice.findMany({ where: { tenantId: t, number }, select: { id: true } });
    const oldIds = old.map((i) => i.id);
    if (oldIds.length) {
      await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: { in: oldIds } } });
      await prisma.payment.deleteMany({ where: { invoiceId: { in: oldIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: oldIds } } });
    }
    await prisma.invoice.create({
      data: {
        tenantId: t,
        patientId: byMrn.get(mrn)!,
        number,
        total,
        paid,
        status: paid >= total ? InvoiceStatus.PAID : paid > 0 ? InvoiceStatus.PARTIAL : InvoiceStatus.UNPAID,
        lines: {
          create: lines.map(([code, name, unitPricePkr, quantity]) => ({
            tenantId: t,
            code,
            name,
            unitPricePkr,
            quantity,
            lineTotalPkr: unitPricePkr * quantity,
          })),
        },
        // Money that was collected needs a receipt behind it. Setting `paid`
        // alone made the dashboard read "Collected PKR 35,000 / Payments PKR 0"
        // — which is not just untidy, it is the shape of a reconciliation bug,
        // and it is the first thing an accountant looking at this would query.
        ...(paid > 0
          ? {
              payments: {
                create: [{ tenantId: t, amount: paid, method: PaymentMethod.CASH, reference: `RCPT-${number}` }],
              },
            }
          : {}),
      },
    });
  }

  // --- A phototherapy course mid-treatment ---------------------------------
  // Bilal Ahmed, plaque psoriasis, Fitzpatrick III. Three sessions delivered,
  // no adverse reaction, so the engine's next suggestion is a further +15%.
  // These are the engine's own numbers for this protocol, not clinical advice.
  const bilal = byMrn.get('GD-0002')!;
  // Sessions reference the course; same FK ordering as the invoices above.
  const oldCourses = await prisma.phototherapyCourse.findMany({ where: { tenantId: t, patientId: bilal }, select: { id: true } });
  if (oldCourses.length) {
    const ids = oldCourses.map((c) => c.id);
    await prisma.phototherapySession.deleteMany({ where: { courseId: { in: ids } } });
    await prisma.phototherapyCourse.deleteMany({ where: { id: { in: ids } } });
  }
  const doseCtx = { protocol: NBUVB_STANDARD, fitzpatrickType: 3, medMj: null, incrementPct: null } as Parameters<typeof startDoseFor>[0];
  const startDoseMj = startDoseFor(doseCtx);
  const maxDoseMj = ceilingFor(doseCtx);
  const course = await prisma.phototherapyCourse.create({
    data: {
      tenantId: t,
      patientId: bilal,
      fitzpatrickType: 3,
      indication: 'Chronic plaque psoriasis',
      startDoseMj,
      maxDoseMj,
    },
  });
  // Three sessions with no adverse reaction, so each is the protocol increment
  // on the last — computed, not typed in.
  const inc = 1 + NBUVB_STANDARD.incrementPct / 100;
  const doses = [startDoseMj, Math.round(startDoseMj * inc), Math.round(startDoseMj * inc * inc)];
  let cumulative = 0;
  for (let i = 0; i < doses.length; i++) {
    cumulative += doses[i];
    await prisma.phototherapySession.create({
      data: {
        tenantId: t,
        courseId: course.id,
        sessionNo: i + 1,
        deliveredAt: at(-((doses.length - i) * 3), 15),
        doseMj: doses[i],
        cumulativeMj: cumulative,
        erythemaGrade: 0,
        gapDays: i === 0 ? null : 3,
      },
    });
  }

  // --- Observations, so the trend charts have a line to draw ---------------
  await prisma.observation.deleteMany({ where: { tenantId: t, patientId: { in: [byMrn.get('GD-0008')!, byMrn.get('GD-0009')!] } } });
  const series: [string, string, string, number[]][] = [
    ['GD-0008', 'body.weight', 'kg', [92.4, 91.1, 90.2, 89.0, 88.3, 87.6]],
    ['GD-0008', 'vitals.bp.systolic', 'mmHg', [148, 145, 141, 138, 134, 131]],
    ['GD-0009', 'body.weight', 'kg', [64.2, 64.0, 63.6, 63.9, 63.4, 63.1]],
  ];
  for (const [mrn, metric, unit, values] of series) {
    for (let i = 0; i < values.length; i++) {
      await prisma.observation.create({
        data: {
          tenantId: t,
          patientId: byMrn.get(mrn)!,
          metric,
          value: values[i],
          unit,
          recordedAt: monthsAgo(values.length - 1 - i),
          recordedById: owner.id,
        },
      });
    }
  }

  // --- A few live leads ----------------------------------------------------
  const leads: [string, string, string, string, LeadStatus][] = [
    ['Hira Nasir', '+92 333 1112223', 'Instagram', 'Laser hair removal', LeadStatus.NEW],
    ['Bushra Amin', '+92 300 4445556', 'Walk-in', 'Acne scars — microneedling', LeadStatus.CONTACTED],
    ['Tariq Mahmood', '+92 321 7778889', 'Referral', 'Hair transplant consult', LeadStatus.NEW],
  ];
  for (const [name, phone, source, interest, status] of leads) {
    const existing = await prisma.lead.findFirst({ where: { tenantId: t, phone } });
    if (existing) await prisma.lead.update({ where: { id: existing.id }, data: { name, source, interest, status } });
    else await prisma.lead.create({ data: { tenantId: t, name, phone, source, interest, status } });
  }

  const n = await prisma.patient.count({ where: { tenantId: t } });
  // eslint-disable-next-line no-console
  console.log(
    `Demo data ready for ${tenant.slug}: ${PATIENTS.length} patients, ${STAFF.length} staff, ` +
      `${schedule.length} appointments, ${bills.length} invoices, 1 phototherapy course.\n` +
      `Patients in tenant: ${n}${n > PATIENTS.length ? '  <-- test artifacts still present; run `npm run demo:reset` for a clean showroom' : ''}`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
