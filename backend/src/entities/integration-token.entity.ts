import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Provider OAuth tokens kept for import flows (GitHub repo listing, GCP
 * project listing). Stored AES-256-GCM-encrypted via CredentialsService —
 * never plaintext, never returned to clients. One row per (user, provider).
 */
@Entity({ name: 'integration_tokens' })
@Index(['userId', 'provider'], { unique: true })
export class IntegrationToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  provider!: 'github' | 'google';

  @Column({ name: 'access_token_enc', type: 'text' })
  accessTokenEnc!: string;

  @Column({ type: 'text', nullable: true })
  scope?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
