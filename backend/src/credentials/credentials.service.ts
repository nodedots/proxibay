import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';

/**
 * Step 6 (decided): encrypted columns in Postgres via app-level AES-256-GCM.
 * Replaces Firestore/Secret Manager tie-in (D4). Format: v1:<iv>:<tag>:<ct>
 * (all base64). Key from CREDENTIALS_ENCRYPTION_KEY (32 raw bytes, base64).
 */
@Injectable()
export class CredentialsService {
  private readonly key: Buffer;
  constructor(config: ConfigService) {
    const raw = config.get<string>('CREDENTIALS_ENCRYPTION_KEY') ?? '';
    const key = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
    if (key.length !== 32) {
      throw new Error(
        'CREDENTIALS_ENCRYPTION_KEY must be 32 bytes base64-encoded. ' +
          "Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
      );
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
  }

  decrypt(payload: string): string {
    const [v, ivB64, tagB64, ctB64] = payload.split(':');
    if (v !== 'v1' || !ivB64 || !tagB64 || !ctB64) throw new Error('malformed credentials payload');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return (
      decipher.update(Buffer.from(ctB64, 'base64'), undefined, 'utf8') + decipher.final('utf8')
    );
  }

  static generateSigningSecret(): string {
    return `whsec_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Freshness window for webhook delivery (Security Plan §5). The sender must
   * supply `X-Stackduck-Timestamp` in unix seconds (milliseconds tolerated).
   * Anything outside `toleranceSec` — 5 minutes — is refused even when the
   * signature is still mathematically valid, which is what stops a captured
   * payload from being replayed later.
   */
  static checkTimestampWindow(
    timestampHeader: string | undefined,
    nowMs = Date.now(),
    toleranceSec = 300,
  ): 'ok' | 'missing_timestamp' | 'stale_timestamp' {
    const seconds = CredentialsService.toSeconds(timestampHeader);
    if (seconds === null) return 'missing_timestamp';
    if (Math.abs(Math.floor(nowMs / 1000) - seconds) > toleranceSec) return 'stale_timestamp';
    return 'ok';
  }

  /**
   * Generic-webhook signature: X-Stackduck-Signature must equal
   * hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`), verified inside the
   * freshness window.
   *
   * Signing the timestamp (rather than the body alone) is the whole point: an
   * attacker cannot refresh the header on a captured request without breaking
   * the MAC, so a stolen payload has a short useful life. The body is
   * concatenated as raw bytes, so senders should reproduce
   * `HMAC(secret, timestamp + '.' + body)` over the exact bytes they transmitted.
   */
  static verifyWebhookSignature(
    timestampHeader: string | undefined,
    rawBody: Buffer,
    secret: string,
    signature: string,
    nowMs = Date.now(),
    toleranceSec = 300,
  ): 'ok' | 'missing_timestamp' | 'stale_timestamp' | 'bad_signature' {
    const window = CredentialsService.checkTimestampWindow(timestampHeader, nowMs, toleranceSec);
    if (window !== 'ok') return window;
    const sec = CredentialsService.toSeconds(timestampHeader)!;
    const signed = Buffer.concat([Buffer.from(`${sec}.`, 'utf8'), rawBody]);
    const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature.trim(), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? 'ok' : 'bad_signature';
  }

  private static toSeconds(timestampHeader: string | undefined): number | null {
    const parsed = Number(timestampHeader);
    if (!timestampHeader || !Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed > 1e12 ? Math.floor(parsed / 1000) : Math.floor(parsed);
  }
}
