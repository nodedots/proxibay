import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';

/**
 * GitHub OAuth — repo read-scoped per the GitHub App correction from the
 * security work (request the minimum that covers repo import).
 */
@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GITHUB_CLIENT_ID') ?? 'unset',
      clientSecret: config.get<string>('GITHUB_CLIENT_SECRET') ?? 'unset',
      callbackURL: config.get<string>('GITHUB_CALLBACK_URL') ?? 'http://localhost:3001/v1/auth/github/callback',
      scope: ['read:user', 'user:email', 'repo'],
    });
  }
  async validate(_at: string, _rt: string, profile: { id: string; emails?: Array<{ value: string }>; displayName?: string; username?: string; photos?: Array<{ value: string }> }) {
    return {
      provider: 'github' as const,
      providerId: String(profile.id),
      email: profile.emails?.[0]?.value,
      displayName: profile.displayName ?? profile.username,
      photoUrl: profile.photos?.[0]?.value,
    };
  }
}
