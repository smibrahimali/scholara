import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { ensureHotIndexes } from './database/ensure-indexes';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  try {
    await ensureHotIndexes(app.get(DataSource));
  } catch (err) {
    console.warn('Index ensure skipped:', err);
  }

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const webOrigin = config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173';
  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });

  const swagger = new DocumentBuilder()
    .setTitle('Scholara API')
    .setDescription('University admission management API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swagger),
  );

  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port, '0.0.0.0');
  // Socket.io namespaces (same HTTP server / CORS as WEB_ORIGIN):
  // - /calls-realtime — WebRTC signaling
  // - /messaging-realtime — student↔consultant direct messages
}
void bootstrap().catch((err: unknown) => {
  console.error('Failed to bootstrap NestJS', err);
  process.exit(1);
});
