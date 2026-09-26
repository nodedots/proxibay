import { Body, Controller, Delete, Get, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsEmail, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  GithubCallbackGuard,
  GithubExchangeGuard,
  GithubImportCallbackGuard,
  GithubImportExchangeGuard,
  GithubImportStartGuard,
  GithubStartGuard,
  GoogleCallbackGuard,
  GoogleExchangeGuard,
  GoogleImportCallbackGuard,
  GoogleImportExchangeGuard,
  GoogleImportStartGuard,
  GoogleStartGuard,
} from './oauth-guards';
import type { OAuthImportClaim, OAuthStateClaim } from './oauth-state.service';
import type { ImportProfile } from './strategies/import.strategies';
import { err } from '../common/errors';

class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @IsBoolean() consent!: boolean;
  @IsOptional() @IsString() @MaxLength(80) displayName?: string;
}

class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}

class RefreshDto {
  @IsString() refreshToken!: string;
}

class UpdateMeDto {
  @IsOptional() @IsString() @MaxLength(80) displayName?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) photoUrl?: string | null;
  @IsOptional() @IsObject() prefs?: Record<string, unknown>;
}

class PasswordResetRequestDto {
  @IsEmail() email!: string;
}

class PasswordResetConfirmDto {
  @IsString() token!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}

@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly integrations: IntegrationsService,
    private readonly config: ConfigService,
  ) {}

  private redirectWithTokens(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    const app = this.config.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:5173';
    const url = new URL('/auth/callback', app);
    url.searchParams.set('accessToken', tokens.accessToken);
    url.searchParams.set('refreshToken', tokens.refreshToken);
    return res.redirect(url.toString());
  }

  private appUrl(path: string): string {
    const app = (this.config.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:5173').replace(/\/+$/, '');
    return `${app}${path}`;
  }

  // Brute-force protection: auth endpoints sit on their own, much tighter
  // buckets than the general API limit (Security Plan §1).
  @Throttle({ signup: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    if (!dto.consent) return err(400, 'consent_required', 'You must accept the terms to create an account.');
    return this.auth.register(dto.email, dto.password, dto.consent, dto.displayName);
  }

  @UseGuards(AuthGuard('local'))
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(@Req() req: { user: Parameters<AuthService['issueTokens']>[0] }) {
    return this.auth.issueTokens(req.user);
  }

  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.rotateRefresh(dto.refreshToken);
  }

  @Post('logout')
  async logout(@Body() dto: RefreshDto) {
    await this.auth.revokeRefresh(dto.refreshToken);
    return { ok: true };
  }

  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @Post('password-reset/request')
  async requestReset(@Body() dto: PasswordResetRequestDto) {
    await this.auth.requestPasswordReset(dto.email);
    return { ok: true };
  }

  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @Post('password-reset/confirm')
  async confirmReset(@Body() dto: PasswordResetConfirmDto) {
    await this.auth.confirmPasswordReset(dto.token, dto.password);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: { user: { userId: string } }) {
    const user = await this.auth.me(req.user.userId);
    if (!user) return err(404, 'not_found', 'User not found.');
    return { user: toMe(user) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@Req() req: { user: { userId: string } }, @Body() dto: UpdateMeDto) {
    const user = await this.auth.updateMe(req.user.userId, {
      displayName: dto.displayName,
      photoUrl: dto.photoUrl,
      prefs: dto.prefs,
    });
    return { user: toMe(user) };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  async deleteMe(@Req() req: { user: { userId: string } }) {
    await this.auth.deleteMe(req.user.userId);
    return { ok: true };
  }

  /** Provider tokens stored for import (existence only — tokens never leave the server). */
  @UseGuards(JwtAuthGuard)
  @Get('integrations')
  async listIntegrations(@Req() req: { user: { userId: string } }) {
    return { integrations: await this.auth.listIntegrations(req.user.userId) };
  }

  @UseGuards(JwtAuthGuard)
  @Get('integrations/github/repos')
  async githubRepos(@Req() req: { user: { userId: string } }) {
    return { items: await this.integrations.githubRepos(req.user.userId) };
  }

  @UseGuards(JwtAuthGuard)
  @Get('integrations/google/repos')
  async googleProjects(@Req() req: { user: { userId: string } }) {
    return { items: await this.integrations.gcpProjects(req.user.userId) };
  }

  // OAuth sign-in — callback URLs point at THIS backend. `state` is issued
  // and bound to this browser on the way out, and verified before the code
  // exchange. Exchange failures redirect to sign-in (never a raw 401 page).
  @Get('google')
  @UseGuards(GoogleStartGuard)
  googleStart() {}

  @Get('google/callback')
  @UseGuards(GoogleCallbackGuard, GoogleExchangeGuard, AuthGuard('google'))
  async googleCallback(
    @Req() req: Request & {
      user: { providerId: string; email?: string; displayName?: string; photoUrl?: string };
      oauthState?: OAuthStateClaim;
    },
    @Res() res: Response,
  ) {
    const tokens = await this.auth.upsertOAuth(
      'google', req.user.providerId, req.user.email, req.user.displayName, req.user.photoUrl,
      req.oauthState?.consent === true,
    );
    return this.redirectWithTokens(res, tokens);
  }

  @Get('github')
  @UseGuards(GithubStartGuard)
  githubStart() {}

  @Get('github/callback')
  @UseGuards(GithubCallbackGuard, GithubExchangeGuard, AuthGuard('github'))
  async githubCallback(
    @Req() req: Request & {
      user: { providerId: string; email?: string; displayName?: string; photoUrl?: string };
      oauthState?: OAuthStateClaim;
    },
    @Res() res: Response,
  ) {
    const tokens = await this.auth.upsertOAuth(
      'github', req.user.providerId, req.user.email, req.user.displayName, req.user.photoUrl,
      req.oauthState?.consent === true,
    );
    return this.redirectWithTokens(res, tokens);
  }

  // OAuth import — start guard accepts the JWT from the header or a one-time
  // ?token= query (full-page navigation carries no headers), binds userId
  // into signed state; token stored encrypted, browser returns to the picker.
  @Get('github-import')
  @UseGuards(GithubImportStartGuard)
  githubImportStart() {}

  @Get('github-import/callback')
  @UseGuards(GithubImportCallbackGuard, GithubImportExchangeGuard, AuthGuard('github-import'))
  async githubImportCallback(
    @Req() req: Request & { user: ImportProfile; importState?: OAuthImportClaim },
    @Res() res: Response,
  ) {
    await this.auth.storeIntegrationToken(req.importState!.userId, 'github', req.user.accessToken, req.user.scope);
    return res.redirect(this.appUrl('/portfolio?import=github'));
  }

  @Get('google-import')
  @UseGuards(GoogleImportStartGuard)
  googleImportStart() {}

  @Get('google-import/callback')
  @UseGuards(GoogleImportCallbackGuard, GoogleImportExchangeGuard, AuthGuard('google-import'))
  async googleImportCallback(
    @Req() req: Request & { user: ImportProfile; importState?: OAuthImportClaim },
    @Res() res: Response,
  ) {
    await this.auth.storeIntegrationToken(req.importState!.userId, 'google', req.user.accessToken, req.user.scope);
    return res.redirect(this.appUrl('/portfolio?import=google'));
  }
}

// Re-export for LoginDto use in guards if needed
export { LoginDto };

function toMe(user: {
  id: string; email?: string | null; displayName?: string | null; photoUrl?: string | null;
  passwordHash?: string | null; providerKey?: string | null; createdAt: Date;
  prefs?: Record<string, unknown> | null;
}) {
  const providers: string[] = [];
  if (user.passwordHash) providers.push('password');
  if (user.providerKey?.startsWith('google:')) providers.push('google');
  else if (user.providerKey?.startsWith('github:')) providers.push('github');
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
    providers,
    prefs: user.prefs ?? null,
  };
}
