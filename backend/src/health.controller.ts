import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('v1/health')
  health() {
    return { ok: true };
  }
}
