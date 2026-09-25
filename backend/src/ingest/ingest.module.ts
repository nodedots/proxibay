import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Connector } from '../entities/connector.entity';
import { Project } from '../entities/project.entity';
import { ConnectorsModule } from '../connectors/connectors.module';
import { MetricsModule } from '../metrics/metrics.module';
import { IngestController } from './ingest.controller';
import { StripeGuard } from './stripe.guard';
import { WebhookGuard } from './webhook.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Connector, Project]), ConnectorsModule, MetricsModule],
  controllers: [IngestController],
  providers: [WebhookGuard, StripeGuard],
})
export class IngestModule {}
