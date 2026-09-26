import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';

const COOKIE = 'stackduck_oauth_state';
const TTL = '5m';

export type OAuthProvider = 'google' | 'github';

export interface OAuthStateClaim {
  provider: OAuthProvider;
  consent: boolean;
}

export interface OAuthImportClaim {
  provider: OAuthProvider;
  userId: string;
}

/**
 * OAuth CSRF protection (Security Plan §1): the `state` sent to Google/GitHub
 * must be verifiable as something WE issued before the code exchange runs.
 *
 * Two bindings, both required:
 *  1. `state` is a signed token (purpose + provider + nonce, 5-minute expiry).
 *     Signature key is derived from JWT_ACCESS_SECRET, so an access token can
 *     never be replayed as a state and vice-versa.
 *  2. `nonce` is also set as an httpOnly SameSite=Lax cookie, so a state minted
 *     in an attacker's browser cannot be completed in the victim's — the
 *     callback fails unless both halves match.
 *
 * The consent flag rides inside the signed state, so the callback no longer
 * trusts a query parameter for account-creation consent.
 */
@Injectable()
export class OAuthStateService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private secret(): string {
    const base =
      this.config.get<string>('JWT_OAUTH_STATE_SECRET') ??
      this.config.get<string>('JWT_ACCESS_SECRET') ??
      '';
    if (!base) throw new Error('JWT_ACCESS_SECRET (or JWT_OAUTH_STATE_SECRET) must be set.');
    return this.config.get<string>('JWT_OAUTH_STATE_SECRET') ? base : `${base}::oauth-state`;
  }

  /** Called on the authorize redirect: mints state, sets the binding cookie. */
  issue(req: Request, res: Response, provider: OAuthProvider): string {
    const nonce = cryptoRandom();
    const consent = req.query?.consent === '1';
    const state = this.jwt.sign(
      { purpose: 'oauth_state', provider, nonce, consent },
      { secret: this.secret(), expiresIn: TTL },
    );
    res.cookie(COOKIE, nonce, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure(req),
      path: '/v1/auth',
      maxAge: 5 * 60 * 1000,
    });
    return state;
  }

  /** Called on the callback, BEFORE the passport exchange: verifies both halves. */
  verify(req: Request, res: Response, provider: OAuthProvider): OAuthStateClaim {
    const state = firstString(req.query?.['state']);
    const nonce = readCookie(req.headers?.cookie, COOKIE);
    if (!state || !nonce) {
      throw new BadRequestException({
        error: { code: 'oauth_state_missing', message: 'Sign-in could not be verified — start again from the sign-in page.' },
      });
    }
    let payload: Record<string, unknown>;
    try {
      payload = this.jwt.verify<Record<string, unknown>>(state, { secret: this.secret() });
    } catch {
      throw new BadRequestException({
        error: { code: 'oauth_state_invalid', message: 'That sign-in link expired or was tampered with — start again.' },
      });
    }
    if (
      payload['purpose'] !== 'oauth_state' ||
      payload['provider'] !== provider ||
      typeof payload['nonce'] !== 'string' ||
      !timingSafeEqual(payload['nonce'] as string, nonce)
    ) {
      throw new BadRequestException({
        error: { code: 'oauth_state_mismatch', message: 'Sign-in could not be verified — start again from the sign-in page.' },
      });
    }
    res.clearCookie(COOKIE, { path: '/v1/auth' });
    return { provider, consent: payload['consent'] === true };
  }

  /**
   * Import-time state: same signed-state + cookie binding, but the claim
   * carries the already-authenticated user's id so the callback can store
   * the provider token against the right account without a session.
   */
  issueImport(req: Request, res: Response, provider: OAuthProvider, userId: string): string {
    const nonce = cryptoRandom();
    const state = this.jwt.sign(
      { purpose: 'oauth_import', provider, nonce, userId },
      { secret: this.secret(), expiresIn: TTL },
    );
    res.cookie(COOKIE, nonce, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure(req),
      path: '/v1/auth',
      maxAge: 5 * 60 * 1000,
    });
    return state;
  }

  /** Verifies import state before the token exchange; returns who to store for. */
  verifyImport(req: Request, res: Response, provider: OAuthProvider): OAuthImportClaim {
    const state = firstString(req.query?.['state']);
    const nonce = readCookie(req.headers?.cookie, COOKIE);
    if (!state || !nonce) {
      throw new BadRequestException({
        error: { code: 'oauth_state_missing', message: 'Import could not be verified — start again from the portfolio.' },
      });
    }
    let payload: Record<string, unknown>;
    try {
      payload = this.jwt.verify<Record<string, unknown>>(state, { secret: this.secret() });
    } catch {
      throw new BadRequestException({
        error: { code: 'oauth_state_invalid', message: 'That import link expired or was tampered with — start again.' },
      });
    }
    if (
      payload['purpose'] !== 'oauth_import' ||
      payload['provider'] !== provider ||
      typeof payload['nonce'] !== 'string' ||
      typeof payload['userId'] !== 'string' ||
      !timingSafeEqual(payload['nonce'] as string, nonce)
    ) {
      throw new BadRequestException({
        error: { code: 'oauth_state_mismatch', message: 'Import could not be verified — start again from the portfolio.' },
      });
    }
    res.clearCookie(COOKIE, { path: '/v1/auth' });
    return { provider, userId: payload['userId'] as string };
  }
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function firstString(v: unknown): string | null {
  if (Array.isArray(v)) v = v[0];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isSecure(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function cryptoRandom(): string {
  return randomBytes(16).toString('hex');
}
