import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Public probes. No guards — intended for load balancers and uptime checks.
 *
 * TWO endpoints, because they answer different questions and a load balancer
 * needs the second one:
 *
 *   GET /health        liveness. Is the process up? Deliberately never touches
 *                      the database, so a brief database outage cannot make an
 *                      orchestrator kill and restart healthy processes.
 *
 *   GET /health/ready  readiness. Can this instance actually SERVE? It runs a
 *                      real query, so it fails when Postgres is unreachable, the
 *                      credentials are wrong, or the pool is exhausted.
 *
 * Before this split there was only the liveness form, returning `{status:'ok'}`
 * unconditionally. A load balancer would have routed traffic to an instance that
 * could not reach the database at all: every request 500s while the probe stays
 * green, which is the hardest kind of outage to diagnose because the monitoring
 * says the service is fine.
 */
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check() {
    return {
      status: 'ok',
      service: 'health-os-backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    try {
      // Deliberately a real round trip. `SELECT 1` proves the connection is
      // live, not merely configured.
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      // Log the reason, return only that it is unavailable: a Prisma connection
      // error carries the DSN, and this endpoint is unauthenticated.
      this.logger.error(`readiness failed: ${(e as Error).message}`);
      // 503 so an orchestrator withholds traffic rather than serving 500s.
      throw new ServiceUnavailableException({
        status: 'unavailable',
        reason: 'database unreachable',
      });
    }
    return {
      status: 'ready',
      service: 'health-os-backend',
      database: 'reachable',
      timestamp: new Date().toISOString(),
    };
  }
}
