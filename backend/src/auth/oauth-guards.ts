import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { OAuthStateClaim, OAuthStateService } from './oauth-state.service';

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
