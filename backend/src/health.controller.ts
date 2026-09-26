import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@Controller()
export class HealthController {
  // Liveness probes poll this — never let the monitor trip the rate limiter.
  @SkipThrottle()
  @Get('v1/health')
  health() {
    return { ok: true };
  }
}
