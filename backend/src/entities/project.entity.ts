import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Environment, ProjectStatus } from '../common/types';
import { Connector } from './connector.entity';
import { AlertRule } from './alert-rule.entity';

@Entity({ name: 'projects' })
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Replaces Firestore ownerId (Firebase uid) — now our own users.id */
  @Index()
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'stack_tags', type: 'text', array: true, default: '{}' })
  stackTags!: string[];

  @Column({ name: 'repo_url', type: 'text', nullable: true })
  repoUrl?: string | null;

  @Column({ name: 'live_url', type: 'text', nullable: true })
  liveUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  environment?: Environment | null;

  @Column({ type: 'text', default: 'active' })
  status!: ProjectStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => Connector, (c) => c.project)
  connectors?: Connector[];

  @OneToMany(() => AlertRule, (r) => r.project)
  alertRules?: AlertRule[];
}
