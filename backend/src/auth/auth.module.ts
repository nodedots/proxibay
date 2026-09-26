import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertRule } from '../entities/alert-rule.entity';
import { Connector } from '../entities/connector.entity';
import { IntegrationToken } from '../entities/integration-token.entity';
import { MetricPoint } from '../entities/metric-point.entity';
import { PasswordResetToken } from '../entities/password-reset.entity';
import { Project } from '../entities/project.entity';
import { RefreshToken, User } from '../entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IntegrationsService } from './integrations.service';
import { OAuthStateService } from './oauth-state.service';
import { GithubStrategy } from './strategies/github.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubImportStrategy, GoogleImportStrategy } from './strategies/import.strategies';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([User, RefreshToken, Project, Connector, MetricPoint, AlertRule, IntegrationToken, PasswordResetToken]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    IntegrationsService,
    OAuthStateService,
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
    GithubStrategy,
    GithubImportStrategy,
    GoogleImportStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
