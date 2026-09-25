import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';

/**
 * Guards manual job triggers. Enabled only when JOBS_TRIGGER_SECRET is set
 * (staging/dev); the route 404s when unset so production is unaffected.
 * Constant-time compare + header secret keeps it off the public surface.
 */
@Injectable()
export class JobsTriggerGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const configured = this.config.get<string>('JOBS_TRIGGER_SECRET') ?? '';
    if (!configured) throw new NotFoundException();
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const provided = req.headers['x-jobs-trigger-secret'] ?? '';
    const a = Buffer.from(configured, 'utf8');
    const b = Buffer.from(String(provided), 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new NotFoundException();
    return true;
  }
}
