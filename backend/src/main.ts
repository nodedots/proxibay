import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { raw } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);

  // Raw bodies for HMAC/Stripe signature verification on ingest routes;
  // JSON everywhere else. Route-scoped so guards see a Buffer.
  const rawJson = raw({ type: 'application/json', limit: '1mb' });
  const jsonParser = json({ limit: '1mb' });
  const server = app.getHttpAdapter().getInstance() as {
    use: (path: string, ...handlers: Array<(req: Request, res: Response, next: NextFunction) => void>) => void;
  };
  server.use('/v1/ingest', rawJson);
  server.use('/v1/stripe', rawJson);
  server.use('/v1', (req: Request, _res: Response, next: NextFunction) => {
    if (Buffer.isBuffer((req as unknown as { body: unknown }).body)) return next();
    return jsonParser(req, _res, next);
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: [config.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:5173'],
    credentials: true,
  });
  await app.listen(Number(process.env.PORT ?? 3001));
  // eslint-disable-next-line no-console
  console.log(`stackduck-api listening on :${process.env.PORT ?? 3001}`);
}

void bootstrap();
