import { Global, Injectable, Logger, Module } from '@nestjs/common';

/**
 * Structured audit trail for security-relevant events (Security Plan §6:
 * "log authentication events and connector connection events, but never log
 * raw credentials, tokens, or full request bodies containing secrets").
 *
 * Events are emitted as `event=<name> key=value …` on a single logger line so
 * they are greppable in Railway's log stream without a logging backend.
 * Callers pass identifiers only — never secrets, tokens, or request bodies.
 * Emails are masked by callers via {@link maskEmail}.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('audit');

  event(name: string, fields: Record<string, string | number | boolean | null | undefined> = {}): void {
    const payload = Object.entries(fields)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}=${String(v).replace(/\s+/g, '_')}`)
      .join(' ');
    this.logger.log(`event=${name}${payload ? ` ${payload}` : ''}`);
  }
}

/** `jane@example.com` → `j***@example.com` — enough to spot patterns, not to harvest. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '-';
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
