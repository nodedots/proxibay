import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as GithubPassport } from 'passport-github2';
import { Strategy as GooglePassport, Profile } from 'passport-google-oauth20';

export interface ImportProfile {
  provider: 'github' | 'google';
  accessToken: string;
  scope?: string;
}

/**
 * Import-time OAuth (NOT sign-in): requested lazily from the portfolio Import
 * menu, stores the provider token encrypted for listing only. GitHub gets the
 * `repo` scope here — and only here — so sign-in itself stays identity-only.
 * Google gets the read-only Cloud Resource Manager scope for GCP listing.
 */
@Injectable()
export class GithubImportStrategy extends PassportStrategy(GithubPassport, 'github-import') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GITHUB_CLIENT_ID') ?? 'unset',
      clientSecret: config.get<string>('GITHUB_CLIENT_SECRET') ?? 'unset',
      callbackURL:
        config.get<string>('GITHUB_IMPORT_CALLBACK_URL') ??
        'http://localhost:3001/v1/auth/github-import/callback',
      scope: ['read:user', 'user:email', 'repo'],
    });
  }
  async validate(accessToken: string): Promise<ImportProfile> {
    return { provider: 'github', accessToken, scope: 'repo' };
  }
}

@Injectable()
export class GoogleImportStrategy extends PassportStrategy(GooglePassport, 'google-import') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') ?? 'unset',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') ?? 'unset',
      callbackURL:
        config.get<string>('GOOGLE_IMPORT_CALLBACK_URL') ??
        'http://localhost:3001/v1/auth/google-import/callback',
      scope: ['profile', 'email', 'https://www.googleapis.com/auth/cloudplatform.read-only'],
    });
  }
  async validate(accessToken: string, _rt: string, _profile: Profile): Promise<ImportProfile> {
    return { provider: 'google', accessToken, scope: 'cloudplatform.read-only' };
  }
}
