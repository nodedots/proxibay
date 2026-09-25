import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsModule } from '../alerts/alerts.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { Connector } from '../entities/connector.entity';
import { Project } from '../entities/project.entity';
import { MetricsModule } from '../metrics/metrics.module';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Connector]),
    ConnectorsModule,
    MetricsModule,
    AlertsModule,
  ],
  providers: [JobsService],
})
export class JobsModule {}
