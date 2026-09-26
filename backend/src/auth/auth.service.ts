import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Repository, MoreThan, IsNull } from 'typeorm';
import { AuditService, maskEmail } from '../common/audit.service';
import { RefreshToken, User } from '../entities/user.entity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email?: string | null; displayName?: string | null };
}

/**
 * Cost-12 placeholder hash. Compared whenever an account (or its password
 * hash) is missing, so a failed login takes the same bcrypt work as a wrong
 * password and response timing cannot be used to enumerate registered emails.
 * Generated once at module load; never matches a real password.
 */
const DUMMY_HASH = bcrypt.hashSync(`dummy:${crypto.randomBytes(16).toString('hex')}`, 12);

/** Identical message for wrong-password and no-such-account — never reveal which. */
const LOGIN_FAILED = 'Invalid email or password.';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refresh: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async validateLocal(email: string, password: string): Promise<User> {
    const user = await this.users.findOne({ where: { email: email.toLowerCase() } });
    const stored = user?.passwordHash ?? DUMMY_HASH;
    const ok = await bcrypt.compare(password, stored);
    if (!user?.passwordHash || !ok) {
      this.audit.event('auth.login.failure', { email: maskEmail(email), reason: 'invalid_credentials' });
      throw new UnauthorizedException({ error: { code: 'invalid_credentials', message: LOGIN_FAILED } });
    }
    this.audit.event('auth.login.success', { user_id: user.id, email: maskEmail(user.email) });
    return user;
  }

  /** Email/password signup — replicates the signup/consent-checkbox flow. */
  async register(email: string, password: string, consent: boolean, displayName?: string): Promise<TokenPair> {
    if (!consent) {
      this.audit.event('auth.register.rejected', { email: maskEmail(email), reason: 'consent_required' });
      throw new UnauthorizedException({
        error: { code: 'consent_required', message: 'You must accept the terms to create an account.' },
      });
    }
    const existing = await this.users.findOne({ where: { email: email.toLowerCase() } });
    if (existing) {
      // See report note: this response does confirm the email is registered.
      this.audit.event('auth.register.rejected', { email: maskEmail(email), reason: 'email_taken' });
      throw new UnauthorizedException({
        error: { code: 'email_taken', message: 'That email is already registered — sign in instead.' },
      });
    }
    const user = await this.users.save(
      this.users.create({
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 12),
        displayName,
        consentAcceptedAt: new Date(),
      }),
    );
    this.audit.event('auth.register.success', { user_id: user.id, email: maskEmail(user.email), consent: true });
    return this.issueTokens(user);
  }

  /** OAuth upsert: find by provider link, else by email (link), else create. */
  async upsertOAuth(
    provider: 'google' | 'github',
    providerId: string,
    email: string | undefined,
    displayName: string | undefined,
    photoUrl: string | undefined,
    consent: boolean,
  ): Promise<TokenPair> {
    const providerKey = `${provider}:${providerId}`;
    let user = await this.users.findOne({ where: { providerKey } });
    if (!user && email) {
      const byEmail = await this.users.findOne({ where: { email: email.toLowerCase() } });
      user = byEmail ?? null;
      if (user) {
        user.providerKey = user.providerKey ?? providerKey;
        user.displayName = user.displayName ?? displayName;
        user.photoUrl = user.photoUrl ?? photoUrl;
        if (consent && !user.consentAcceptedAt) user.consentAcceptedAt = new Date();
        await this.users.save(user);
      }
    }
    if (!user) {
      if (!consent) {
        throw new UnauthorizedException({
          error: { code: 'consent_required', message: 'You must accept the terms to create an account.' },
        });
      }
      user = await this.users.save(
        this.users.create({
          email: email?.toLowerCase() ?? null,
          displayName,
          photoUrl,
          providerKey,
          consentAcceptedAt: new Date(),
        }),
      );
    }
    this.audit.event('auth.oauth.success', { provider, user_id: user.id, email: maskEmail(user.email), consent });
    return this.issueTokens(user);
  }

  async issueTokens(user: User): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
      },
    );
    const opaque = crypto.randomBytes(48).toString('hex');
    const ttl = this.config.get<string>('JWT_REFRESH_TTL') ?? '30d';
    const ms = parseTtlMs(ttl);
    await this.refresh.save(
      this.refresh.create({
        userId: user.id,
        tokenHash: crypto.createHash('sha256').update(opaque).digest('hex'),
        expiresAt: new Date(Date.now() + ms),
      }),
    );
    return {
      accessToken,
      refreshToken: opaque,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    };
  }

  async rotateRefresh(opaque: string): Promise<TokenPair> {
    const hash = crypto.createHash('sha256').update(opaque).digest('hex');
    const row = await this.refresh.findOne({
      where: { tokenHash: hash, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    if (!row) {
      this.audit.event('auth.refresh.rejected', { reason: 'invalid_or_expired' });
      throw new UnauthorizedException({
        error: { code: 'invalid_refresh', message: 'Session expired — sign in again.' },
      });
    }
    // Rotation: the presented token is revoked BEFORE a replacement is issued,
    // so a replayed (stolen) copy fails the revokedAt IS NULL lookup above.
    row.revokedAt = new Date();
    await this.refresh.save(row);
    const user = await this.users.findOneOrFail({ where: { id: row.userId } });
    this.audit.event('auth.refresh.rotated', { user_id: user.id });
    return this.issueTokens(user);
  }

  async revokeRefresh(opaque: string): Promise<void> {
    const hash = crypto.createHash('sha256').update(opaque).digest('hex');
    const res = await this.refresh.update({ tokenHash: hash, revokedAt: IsNull() }, { revokedAt: new Date() });
    this.audit.event('auth.logout', { revoked: (res.affected ?? 0) > 0 });
  }

  async me(userId: string): Promise<User | null> {
    return this.users.findOne({ where: { id: userId } });
  }
}

function parseTtlMs(ttl: string): number {
  const m = ttl.match(/^(\d+)([smhd])$/);
  if (!m || !m[1] || !m[2]) return 30 * 86400000;
  const n = Number(m[1]);
  return ({ s: 1000, m: 60000, h: 3600000, d: 86400000 } as Record<string, number>)[m[2]]! * n;
}
