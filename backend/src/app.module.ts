import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsModule } from './alerts/alerts.module';
import { AuthModule } from './auth/auth.module';
import { TimescaleSetupService } from './config/timescale-setup.service';
import { ConnectorsModule } from './connectors/connectors.module';
import { CredentialsModule } from './credentials/credentials.module';
import { AlertRule } from './entities/alert-rule.entity';
import { Connector } from './entities/connector.entity';
import { MetricPoint } from './entities/metric-point.entity';
import { Project } from './entities/project.entity';
import { RefreshToken, User } from './entities/user.entity';
import { HealthController } from './health.controller';
import { IngestModule } from './ingest/ingest.module';
import { JobsModule } from './jobs/jobs.module';
import { MetricsModule } from './metrics/metrics.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['backend/.env', '.env'] }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 300 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [User, RefreshToken, Project, Connector, MetricPoint, AlertRule],
        synchronize: true,
        ssl: false,
      }),
    }),
    CredentialsModule,
    AuthModule,
    ProjectsModule,
    ConnectorsModule,
    MetricsModule,
    AlertsModule,
    IngestModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [TimescaleSetupService],
})
export class AppModule {}
