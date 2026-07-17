import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant, getTenantId } from '../common/tenant/tenant-context';
import { BUILTIN_INSTRUMENTS } from './builtin-instruments';
import { scoreInstrument } from './instrument.engine';
import { InstrumentDefinitionSpec } from './instrument.types';

/**
 * Scored-Instrument engine service.
 *
 * Definitions live in the global InstrumentDefinition table (reference data);
 * recorded results are tenant-scoped (ScoredInstrumentResponse, RLS). Scoring
 * always happens server-side through the pure engine.
 */
@Injectable()
export class InstrumentsService implements OnModuleInit {
  private readonly logger = new Logger(InstrumentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Self-register the built-in library at boot (idempotent upserts).
  async onModuleInit(): Promise<void> {
    try {
      const n = await this.registerBuiltins();
      this.logger.log(`Registered ${n} built-in instruments.`);
    } catch (e) {
      this.logger.warn(
        `Instrument library not registered (DB not ready?): ${String(e)}`,
      );
    }
  }

  async registerBuiltins(): Promise<number> {
    for (const def of BUILTIN_INSTRUMENTS) {
      await this.prisma.instrumentDefinition.upsert({
        where: { key: def.key },
        update: {
          name: def.name,
          specialty: def.specialty ?? null,
          version: def.version,
          definition: def as unknown as Prisma.InputJsonValue,
        },
        create: {
          key: def.key,
          name: def.name,
          specialty: def.specialty ?? null,
          version: def.version,
          definition: def as unknown as Prisma.InputJsonValue,
        },
      });
    }
    return BUILTIN_INSTRUMENTS.length;
  }

  list() {
    return this.prisma.instrumentDefinition.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async get(key: string) {
    const def = await this.prisma.instrumentDefinition.findUnique({
      where: { key },
    });
    if (!def) throw new NotFoundException(`Instrument ${key} not found`);
    return def;
  }

  // Score `answers` for instrument `key` and persist the result for a patient.
  async record(key: string, patientId: string, answers: Record<string, number>) {
    const row = await this.get(key);
    const def = row.definition as unknown as InstrumentDefinitionSpec;
    const result = scoreInstrument(def, answers);

    const tenantId = getTenantId();
    const { userId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const saved = await tx.scoredInstrumentResponse.create({
        data: {
          tenantId,
          patientId,
          instrumentKey: key,
          answers: answers as unknown as Prisma.InputJsonValue,
          score: result.score,
          band: result.band,
          flags: result.flags,
          recordedById: userId ?? null,
        },
      });

      // Write the total score back as an Observation so it auto-trends via the
      // longitudinal Trends engine (Component 2).
      let observationId: string | null = null;
      if (def.observationMetric) {
        const obs = await tx.observation.create({
          data: {
            tenantId,
            patientId,
            metric: def.observationMetric,
            value: result.score,
            unit: def.scoring === 'percent' ? '%' : 'score',
            note: `${def.name}: ${result.band}`,
            recordedById: userId ?? null,
          },
        });
        observationId = obs.id;
      }

      return { ...saved, result, observationId };
    });
  }

  listResponses(patientId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.scoredInstrumentResponse.findMany({
        where: { patientId },
        orderBy: { recordedAt: 'desc' },
      }),
    );
  }
}
