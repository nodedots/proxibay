import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Connector } from '../entities/connector.entity';
import { Project } from '../entities/project.entity';
import { ConnectorsRegistry } from './connectors-registry.service';
import { ConnectorsController } from './connectors.controller';
import { ExternalConnector } from './providers/external.connector';
import { ExternalFetch } from './providers/external-fetch';
import { FirebaseConnector } from './providers/firebase.connector';
import { StripeConnector } from './providers/stripe.connector';
import { SupabaseConnector } from './providers/supabase.connector';

@Module({
  imports: [TypeOrmModule.forFeature([Connector, Project])],
  controllers: [ConnectorsController],
  providers: [ConnectorsRegistry, FirebaseConnector, StripeConnector, SupabaseConnector, ExternalConnector, ExternalFetch],
  exports: [ConnectorsRegistry, FirebaseConnector, StripeConnector, SupabaseConnector, ExternalConnector, ExternalFetch],
})
export class ConnectorsModule {}


