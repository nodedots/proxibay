import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Connector } from '../entities/connector.entity';
import { Project } from '../entities/project.entity';
import { MetricsModule } from '../metrics/metrics.module';
import { ProjectsController } from './projects.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Connector]), MetricsModule],
  controllers: [ProjectsController],
})
export class ProjectsModule {}
