import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const webOrigin =
    config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173';
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
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  // Socket.io for live 1:1 WebRTC signaling is mounted by CallsGateway
  // at namespace /calls-realtime (same HTTP server / CORS origin as WEB_ORIGIN).
}
bootstrap();
