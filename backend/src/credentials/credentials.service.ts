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

  static verifyHmac(rawBody: Buffer, secret: string, signature: string): boolean {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature.trim(), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}
