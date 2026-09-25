import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { err } from '../common/errors';
import { projectHomeStatus } from '../common/types';
import { Connector } from '../entities/connector.entity';
import { Project } from '../entities/project.entity';
import { MetricsService } from '../metrics/metrics.service';

const STATUSES = ['active', 'paused', 'archived'] as const;

class CreateProjectDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() stackTags?: string[];
  @IsOptional() @IsString() repoUrl?: string;
  @IsOptional() @IsString() liveUrl?: string;
  @IsOptional() @IsIn(['production', 'staging', 'development']) environment?: 'production' | 'staging' | 'development';
  @IsOptional() @IsString() notes?: string;
}

class UpdateProjectDto {
  @IsOptional() @IsString() name?: string | null;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() stackTags?: string[] | null;
  @IsOptional() @IsString() repoUrl?: string | null;
  @IsOptional() @IsString() liveUrl?: string | null;
  @IsOptional() @IsIn(['production', 'staging', 'development']) environment?: 'production' | 'staging' | 'development' | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsIn(['active', 'paused', 'archived']) status?: 'active' | 'paused' | 'archived';
}

@Controller('v1/projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(Connector) private readonly connectors: Repository<Connector>,
    private readonly metrics: MetricsService,
  ) {}

  @Post()
  async create(@Req() req: { user: { userId: string } }, @Body() dto: CreateProjectDto) {
    if (!dto.name?.trim()) return err(400, 'invalid_argument', 'Project "name" is required.');
    const p = await this.projects.save(this.projects.create({
      ownerId: req.user.userId,
      name: dto.name.trim(),
      status: 'active',
      description: dto.description,
      stackTags: dto.stackTags ?? [],
      repoUrl: dto.repoUrl,
      liveUrl: dto.liveUrl,
      environment: dto.environment,
      notes: dto.notes,
    }));
    return { project: p };
  }

  /** Enriched list for Portfolio cards (avoids N+1 on the client). */
  @Get()
  async list(@Req() req: { user: { userId: string } }, @Query('status') status?: string) {
    const where: Record<string, unknown> = { ownerId: req.user.userId };
    if (status && (STATUSES as readonly string[]).includes(status)) where['status'] = status;
    const projects = await this.projects.find({ where, order: { updatedAt: 'DESC' } });
    return {
      projects: await Promise.all(projects.map(async (project) => {
        const conns = await this.connectors.find({ where: { projectId: project.id } });
        const connectorStatuses = conns.map((c) => c.status);
        const latest = await this.metrics.latestPerKey(project.id, 10);
        const keyMetrics = latest.slice(0, 3).map((m) => ({
          metricType: m.metricType, key: m.key, value: Number(m.value), at: m.at,
        }));
        const homeStatus = projectHomeStatus({ hasTriggeredUnresolvedAlert: false, connectorStatuses });
        return { project, connectorStatuses, keyMetrics, homeStatus };
      })),
    };
  }

  @Patch(':projectId')
  async update(
    @Req() req: { user: { userId: string } },
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    const p = await this.projects.findOne({ where: { id: projectId } });
    if (!p || p.ownerId !== req.user.userId) return err(404, 'not_found', 'Project not found.');
    const patch: Record<string, unknown> = {};
    for (const f of ['name', 'description', 'stackTags', 'repoUrl', 'liveUrl', 'environment', 'notes', 'status'] as const) {
      if (!(f in dto)) continue;
      const v = dto[f] as unknown;
      if (f === 'name' && v !== null && (typeof v !== 'string' || !v.trim())) {
        return err(400, 'invalid_argument', 'Project "name" must not be blank.');
      }
      if (f === 'status' && !(STATUSES as readonly string[]).includes(v as string)) {
        return err(400, 'invalid_argument', 'Invalid status.');
      }
      patch[f] = v === null ? null : (f === 'name' ? (v as string).trim() : v);
    }
    await this.projects.update({ id: projectId }, patch);
    return { project: await this.projects.findOneOrFail({ where: { id: projectId } }) };
  }

  /** Soft-archive per D8; ingest goes 410. */
  @Delete(':projectId')
  async remove(@Req() req: { user: { userId: string } }, @Param('projectId') projectId: string) {
    const p = await this.projects.findOne({ where: { id: projectId } });
    if (!p || p.ownerId !== req.user.userId) return err(404, 'not_found', 'Project not found.');
    const conns = await this.connectors.find({ where: { projectId } });
    await this.projects.update({ id: projectId }, { status: 'archived' });
    for (const c of conns) await this.connectors.update({ id: c.id }, { status: 'error' });
    return {
      project: { ...p, status: 'archived' as const },
      disabledConnectors: conns.length,
      note: 'Ingest URLs now return 410 Gone.',
    };
  }
}
