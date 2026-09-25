import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { err } from '../common/errors';

class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsBoolean() consent!: boolean;
  @IsOptional() @IsString() displayName?: string;
}

class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}

class RefreshDto {
  @IsString() refreshToken!: string;
}

@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private redirectWithTokens(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    const app = this.config.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:5173';
    const url = new URL('/auth/callback', app);
    url.searchParams.set('accessToken', tokens.accessToken);
    url.searchParams.set('refreshToken', tokens.refreshToken);
    return res.redirect(url.toString());
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    if (!dto.consent) return err(400, 'consent_required', 'You must accept the terms to create an account.');
    return this.auth.register(dto.email, dto.password, dto.consent, dto.displayName);
  }

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Req() req: { user: Parameters<AuthService['issueTokens']>[0] }) {
    return this.auth.issueTokens(req.user);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.rotateRefresh(dto.refreshToken);
  }

  @Post('logout')
  async logout(@Body() dto: RefreshDto) {
    await this.auth.revokeRefresh(dto.refreshToken);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: { user: { userId: string } }) {
    const user = await this.auth.me(req.user.userId);
    if (!user) return err(404, 'not_found', 'User not found.');
    return { user: { id: user.id, email: user.email, displayName: user.displayName, photoUrl: user.photoUrl } };
  }

  // OAuth — callback URLs point at THIS backend (Phase 3 updates the
  // Google Cloud Console + GitHub OAuth App configs to match).
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleStart() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: { user: { providerId: string; email?: string; displayName?: string; photoUrl?: string } },
    @Query('consent') consent: string | undefined,
    @Res() res: Response,
  ) {
    const tokens = await this.auth.upsertOAuth('google', req.user.providerId, req.user.email, req.user.displayName, req.user.photoUrl, consent === '1');
    return this.redirectWithTokens(res, tokens);
  }

  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubStart() {}

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(
    @Req() req: { user: { providerId: string; email?: string; displayName?: string; photoUrl?: string } },
    @Query('consent') consent: string | undefined,
    @Res() res: Response,
  ) {
    const tokens = await this.auth.upsertOAuth('github', req.user.providerId, req.user.email, req.user.displayName, req.user.photoUrl, consent === '1');
    return this.redirectWithTokens(res, tokens);
  }
}

// Re-export for LoginDto use in guards if needed
export { LoginDto };
