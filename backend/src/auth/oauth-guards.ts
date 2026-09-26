import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { OAuthImportClaim, OAuthStateClaim, OAuthStateService } from './oauth-state.service';

/** Passport exchange with a browser-safe failure target (raw 401 JSON helps nobody). */
function failureRedirect(config: ConfigService, path: string): { failureRedirect: string } {
  const app = (config.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:5173').replace(/\/+$/, '');
  return { failureRedirect: `${app}${path}` };
}

@Injectable()
export class GoogleExchangeGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super();
  }
  getAuthenticateOptions(context: ExecutionContext): { failureRedirect: string } {
    void context;
    return failureRedirect(this.config, '/signin?oauth=failed');
  }
}

@Injectable()
export class GithubExchangeGuard extends AuthGuard('github') {
  constructor(private readonly config: ConfigService) {
    super();
  }
  getAuthenticateOptions(context: ExecutionContext): { failureRedirect: string } {
    void context;
    return failureRedirect(this.config, '/signin?oauth=failed');
  }
}

@Injectable()
export class GithubImportExchangeGuard extends AuthGuard('github-import') {
  constructor(private readonly config: ConfigService) {
    super();
  }
  getAuthenticateOptions(context: ExecutionContext): { failureRedirect: string } {
    void context;
    return failureRedirect(this.config, '/portfolio?import=github&error=denied');
  }
}

@Injectable()
export class GoogleImportExchangeGuard extends AuthGuard('google-import') {
  constructor(private readonly config: ConfigService) {
    super();
  }
  getAuthenticateOptions(context: ExecutionContext): { failureRedirect: string } {
    void context;
    return failureRedirect(this.config, '/portfolio?import=google&error=denied');
  }
}

/**
 * OAuth guards (Security Plan section 1: CSRF during the OAuth handshake).
 *
 * The Start guards run on the authorize endpoint and mint the signed `state`
 * plus the binding cookie just before the browser is redirected out.
 *
 * The Callback guards run on the callback BEFORE the passport code exchange,
 * so a state we did not issue, or one minted in a different browser, is
 * rejected before the authorization code is ever exchanged. Consent travels
 * inside the verified state rather than a query parameter.
 *
 * Written out per provider rather than derived from a factory, because Nest
 * reads constructor metadata from the decorated class itself: a factory-built
 * subclass with no explicit constructor would receive no injected dependencies.
 */

@Injectable()
export class GoogleStartGuard extends AuthGuard('google') {
  constructor(private readonly states: OAuthStateService) {
    super();
  }
  getAuthenticateOptions(context: ExecutionContext): { state: string } {
    const http = context.switchToHttp();
    return {
      state: this.states.issue(http.getRequest() as Request, http.getResponse() as Response, 'google'),
    };
  }
}

@Injectable()
export class GithubStartGuard extends AuthGuard('github') {
  constructor(private readonly states: OAuthStateService) {
    super();
  }
  getAuthenticateOptions(context: ExecutionContext): { state: string } {
    const http = context.switchToHttp();
    return {
      state: this.states.issue(http.getRequest() as Request, http.getResponse() as Response, 'github'),
    };
  }
}

@Injectable()
export class GoogleCallbackGuard implements CanActivate {
  constructor(private readonly states: OAuthStateService) {}
  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest() as Request & { oauthState?: OAuthStateClaim };
    req.oauthState = this.states.verify(req, http.getResponse() as Response, 'google');
    return true;
  }
}

@Injectable()
export class GithubCallbackGuard implements CanActivate {
  constructor(private readonly states: OAuthStateService) {}
  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest() as Request & { oauthState?: OAuthStateClaim };
    req.oauthState = this.states.verify(req, http.getResponse() as Response, 'github');
    return true;
  }
}

/**
 * Import guards: bind the already-authenticated user into the signed state.
 * Full-page navigation to the authorize URL carries no Authorization header,
 * so the guards accept EITHER req.user (JwtAuthGuard ran first) OR a
 * one-time `?token=` access token verified here. The token is verified and
 * dropped — never stored, never logged.
 */
function userIdFromRequest(req: Request & { user?: { userId: string } }, jwt: JwtService, config: ConfigService): string {
  if (req.user?.userId) return req.user.userId;
  const q = req.query?.['token'];
  const raw = Array.isArray(q) ? q[0] : q;
  if (typeof raw === 'string' && raw) {
    try {
      const payload = jwt.verify<{ sub?: string }>(raw, {
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      });
      if (payload.sub) return payload.sub;
    } catch {
      // Fall through to the 401 below.
    }
  }
  throw new UnauthorizedException({ error: { code: 'unauthenticated', message: 'Not signed in.' } });
}

@Injectable()
export class GithubImportStartGuard extends AuthGuard('github-import') {
  constructor(
    private readonly states: OAuthStateService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    super();
  }
  getAuthenticateOptions(context: ExecutionContext): { state: string } {
    const http = context.switchToHttp();
    const req = http.getRequest() as Request & { user?: { userId: string } };
    return {
      state: this.states.issueImport(req, http.getResponse() as Response, 'github', userIdFromRequest(req, this.jwt, this.config)),
    };
  }
}

@Injectable()
export class GoogleImportStartGuard extends AuthGuard('google-import') {
  constructor(
    private readonly states: OAuthStateService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    super();
  }
  getAuthenticateOptions(context: ExecutionContext): { state: string } {
    const http = context.switchToHttp();
    const req = http.getRequest() as Request & { user?: { userId: string } };
    return {
      state: this.states.issueImport(req, http.getResponse() as Response, 'google', userIdFromRequest(req, this.jwt, this.config)),
    };
  }
}

@Injectable()
export class GithubImportCallbackGuard implements CanActivate {
  constructor(private readonly states: OAuthStateService) {}
  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest() as Request & { importState?: OAuthImportClaim };
    req.importState = this.states.verifyImport(req, http.getResponse() as Response, 'github');
    return true;
  }
}

@Injectable()
export class GoogleImportCallbackGuard implements CanActivate {
  constructor(private readonly states: OAuthStateService) {}
  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest() as Request & { importState?: OAuthImportClaim };
    req.importState = this.states.verifyImport(req, http.getResponse() as Response, 'google');
    return true;
  }
}
