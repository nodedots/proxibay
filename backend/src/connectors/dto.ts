import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class BaseBody {
  @IsOptional() @IsInt() @Min(5) pollIntervalMinutes?: number;
}
export class FirebaseBody extends BaseBody {
  @IsObject() @IsNotEmpty() serviceAccountJson!: Record<string, unknown>;
}
export class SupabaseBody extends BaseBody {
  @IsString() @IsNotEmpty() url!: string;
  @IsString() @IsNotEmpty() serviceKey!: string;
}
export class StripeBody extends BaseBody {
  @IsString() @IsNotEmpty() apiKey!: string;
  @IsOptional() @IsString() webhookSecret?: string;
}
export class WebhookBody extends BaseBody {}
export class ExternalBody extends BaseBody {
  @IsString() @IsNotEmpty() token!: string;
  @IsOptional() @IsString() organization?: string;
  @IsOptional() @IsString() project?: string;
  @IsOptional() @IsString() repository?: string;
  @IsOptional() @IsString() projectId?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() monitorUrl?: string;
  @IsOptional() @IsString() teamId?: string;
}
export function newConnectorId() {
  return `conn_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}
