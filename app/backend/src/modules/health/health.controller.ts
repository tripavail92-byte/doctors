import { Controller, Get } from '@nestjs/common';

/**
 * Public liveness endpoint. No guards — intended for load balancers and
 * uptime checks. GET /health returns a lightweight status payload.
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'health-os-backend',
      timestamp: new Date().toISOString(),
    };
  }
}