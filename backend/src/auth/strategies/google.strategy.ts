import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';

/** Google OAuth — standard profile/email scopes (same as before). */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') ?? 'unset',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') ?? 'unset',
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL') ?? 'http://localhost:3001/v1/auth/google/callback',
      scope: ['profile', 'email'],
    });
  }
  async validate(_at: string, _rt: string, profile: Profile) {
    return {
      provider: 'google' as const,
      providerId: profile.id,
      email: profile.emails?.[0]?.value,
      displayName: profile.displayName,
      photoUrl: profile.photos?.[0]?.value,
    };
  }
}
