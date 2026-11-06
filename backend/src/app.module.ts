import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { StorageModule } from './storage/storage.module';
import { AccessModule } from './common/access.module';
import { DocumentsModule } from './documents/documents.module';
import { ApplicationsModule } from './applications/applications.module';
import { StudentsModule } from './students/students.module';
import { ConsultantsModule } from './consultants/consultants.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      validate: validateEnv,
    }),
    DatabaseModule,
    AccessModule,
    StorageModule,
    AuthModule,
    HealthModule,
    DocumentsModule,
    ApplicationsModule,
    StudentsModule,
    ConsultantsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
