import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';
import {
  GrowthIndicator,
  growthResult,
  indicatorXUnit,
  measurementAtZ,
} from './growth-engine';
import { lookupLMS, Sex, tableFor } from './who-lms';
import { ZscoreDto } from './dto/zscore.dto';

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.4375;
// Weight/height paired within this many days count as the same visit.
const PAIR_WINDOW_DAYS = 30;

function ageMonthsBetween(dob: Date, at: Date): number {
  return (at.getTime() - dob.getTime()) / MS_PER_MONTH;
}

const WEIGHT_METRIC = 'weight_kg';
const HEIGHT_METRIC = 'height_cm';
const HC_METRIC = 'head_circumference_cm';

// The z-lines drawn on a growth chart.
const CURVE_ZS = [-3, -2, 0, 2, 3];

/**
 * WHO growth service. Pairs the pure engine (growth-engine.ts) with the LMS
 * reference tables and the Observation substrate. Supports all five WHO
 * indicators; weight-for-length and BMI-for-age pair a weight with a nearby
 * length/height measurement.
 */
@Injectable()
export class GrowthService {
  constructor(private readonly prisma: PrismaService) {}

  // Direct calculation for an explicit sex/indicator/value at an age or length.
  zscore(dto: ZscoreDto) {
    const x = this.xFor(dto.indicator, { ageMonths: dto.ageMonths, lengthCm: dto.lengthCm });
    const p = lookupLMS(dto.sex, dto.indicator, x);
    if (!p) throw new BadRequestException(`No LMS reference for ${dto.indicator}/${dto.sex}`);
    return {
      sex: dto.sex,
      indicator: dto.indicator,
      x,
      xUnit: indicatorXUnit(dto.indicator),
      value: dto.value,
      lms: { L: round(p.L, 4), M: round(p.M, 4), S: round(p.S, 5) },
      ...growthResult(dto.indicator, p.L, p.M, p.S, dto.value),
    };
  }

  private xFor(
    indicator: GrowthIndicator,
    opts: { ageMonths?: number; lengthCm?: number },
  ): number {
    if (indicator === 'wfh') {
      if (opts.lengthCm == null) throw new BadRequestException('weight-for-length requires lengthCm');
      return opts.lengthCm;
    }
    if (opts.ageMonths == null) throw new BadRequestException(`${indicator} requires ageMonths`);
    return opts.ageMonths;
  }

  // Reference z-line curves for plotting a growth chart.
  curves(sex: Sex, indicator: GrowthIndicator) {
    const pts = tableFor(sex, indicator);
    if (pts.length === 0) throw new BadRequestException(`No LMS reference for ${indicator}/${sex}`);
    const lines: Record<string, { x: number; value: number }[]> = {};
    for (const z of CURVE_ZS) {
      lines[`z${z > 0 ? '+' : ''}${z}`] = pts.map((p) => ({
        x: p.x,
        value: round(measurementAtZ(p.L, p.M, p.S, z), 3),
      }));
    }
    return { sex, indicator, xUnit: indicatorXUnit(indicator), zLines: CURVE_ZS, curves: lines };
  }

  // Convert a patient's measurement series into a growth (z-score) series.
  async growthSeries(patientId: string, indicator: GrowthIndicator) {
    const { tenantId } = getTenant();
    const patient = await this.prisma.forTenant(tenantId, (tx) =>
      tx.patient.findUnique({ where: { id: patientId } }),
    );
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
    if (!patient.dob) {
      throw new BadRequestException('Patient has no date of birth — cannot compute age');
    }
    const dob = patient.dob;
    const sex: Sex = patient.gender === 'female' ? 'female' : 'male';

    const obs = await this.prisma.forTenant(tenantId, (tx) =>
      tx.observation.findMany({
        where: { patientId, metric: { in: [WEIGHT_METRIC, HEIGHT_METRIC, HC_METRIC] } },
        orderBy: { recordedAt: 'asc' },
      }),
    );
    const byMetric = (m: string) => obs.filter((o) => o.metric === m);

    let raw: { recordedAt: Date; ageMonths: number; value: number; x: number }[] = [];
    if (indicator === 'wfa' || indicator === 'lhfa' || indicator === 'hcfa') {
      const metric = indicator === 'wfa' ? WEIGHT_METRIC : indicator === 'lhfa' ? HEIGHT_METRIC : HC_METRIC;
      raw = byMetric(metric).map((o) => {
        const ageMonths = ageMonthsBetween(dob, o.recordedAt);
        return { recordedAt: o.recordedAt, ageMonths, value: o.value, x: ageMonths };
      });
    } else {
      // bmifa / wfh: pair each weight with the nearest height within the window.
      const heights = byMetric(HEIGHT_METRIC);
      for (const w of byMetric(WEIGHT_METRIC)) {
        const h = nearestByTime(heights, w.recordedAt);
        if (!h) continue;
        const ageMonths = ageMonthsBetween(dob, w.recordedAt);
        if (indicator === 'bmifa') {
          const bmi = w.value / Math.pow(h.value / 100, 2);
          raw.push({ recordedAt: w.recordedAt, ageMonths, value: round(bmi, 2), x: ageMonths });
        } else {
          // wfh: x = length/height, value = weight
          raw.push({ recordedAt: w.recordedAt, ageMonths, value: w.value, x: h.value });
        }
      }
    }

    const points = raw.map((r) => {
      const p = lookupLMS(sex, indicator, r.x);
      const result = p ? growthResult(indicator, p.L, p.M, p.S, r.value) : null;
      return {
        recordedAt: r.recordedAt,
        ageMonths: round(r.ageMonths, 1),
        x: round(r.x, 1),
        value: r.value,
        z: result ? result.z : null,
        percentile: result ? result.percentile : null,
        classification: result ? result.classification : 'no-reference-data',
      };
    });

    return {
      patientId,
      sex,
      indicator,
      xUnit: indicatorXUnit(indicator),
      count: points.length,
      points,
    };
  }
}

/** Nearest observation to a target time within PAIR_WINDOW_DAYS, else null. */
function nearestByTime<T extends { recordedAt: Date; value: number }>(
  list: T[],
  target: Date,
): T | null {
  let best: T | null = null;
  let bestDelta = Infinity;
  for (const o of list) {
    const delta = Math.abs(o.recordedAt.getTime() - target.getTime());
    if (delta < bestDelta) {
      bestDelta = delta;
      best = o;
    }
  }
  if (best && bestDelta <= PAIR_WINDOW_DAYS * 86_400_000) return best;
  return null;
}

function round(x: number, d = 2): number {
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
}
