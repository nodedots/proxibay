import { Body, Controller, Module, Post } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuditService } from '../common/audit.service';
import { Feedback } from '../entities/feedback.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

class FeedbackDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsString() @MinLength(1) @MaxLength(2000) message!: string;
}

/**
 * Public feedback notes (replaces the Firestore `feedback` collection).
 * No account needed — tight rate limit instead. Reviewed via SQL.
 */
@Controller('v1/feedback')
export class FeedbackController {
  constructor(
    @InjectRepository(Feedback) private readonly feedback: Repository<Feedback>,
    private readonly audit: AuditService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post()
  async submit(@Body() dto: FeedbackDto) {
    if (!dto.message?.trim()) {
      return { error: { code: 'invalid_argument', message: 'Message must not be empty.' } };
    }
    const row = await this.feedback.save(
      this.feedback.create({
        name: dto.name?.trim().slice(0, 100) || null,
        email: dto.email?.trim().slice(0, 254) || null,
        message: dto.message.trim().slice(0, 2000),
      }),
    );
    this.audit.event('feedback.received', { feedback_id: row.id });
    return { ok: true };
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Feedback])],
  controllers: [FeedbackController],
})
export class FeedbackModule {}
