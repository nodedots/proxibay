import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken, User } from '../entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthStateService } from './oauth-state.service';
import { GithubStrategy } from './strategies/github.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([User, RefreshToken]),
  ],
  controllers: [AuthController],
  providers: [AuthService, OAuthStateService, LocalStrategy, JwtStrategy, GoogleStrategy, GithubStrategy],
  exports: [AuthService],
})
export class AuthModule {}
