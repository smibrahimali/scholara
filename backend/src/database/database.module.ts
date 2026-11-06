import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { StudentProfile } from '../students/student-profile.entity';
import { GuardianProfile } from '../guardians/guardian-profile.entity';
import { ConsultantProfile } from '../consultants/consultant-profile.entity';
import { University } from '../universities/university.entity';
import { Program } from '../programs/program.entity';
import { Application } from '../applications/application.entity';
import { ApplicationStep } from '../applications/application-step.entity';
import { Document } from '../documents/document.entity';
import { DocumentReview } from '../documents/document-review.entity';
import { UniversityEmail } from '../emails/university-email.entity';
import { CallSession } from '../calls/call-session.entity';
import { CallNote } from '../calls/call-note.entity';
import { ChatMessage } from '../chat/chat-message.entity';

export const entities = [
  User,
  StudentProfile,
  GuardianProfile,
  ConsultantProfile,
  University,
  Program,
  Application,
  ApplicationStep,
  Document,
  DocumentReview,
  UniversityEmail,
  CallSession,
  CallNote,
  ChatMessage,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        if (!databaseUrl) {
          throw new Error('DATABASE_URL is required');
        }

        return {
          type: 'postgres' as const,
          url: databaseUrl,
          entities,
          synchronize: config.get<string>('NODE_ENV') !== 'production',
          logging: config.get<string>('NODE_ENV') === 'development',
          ssl: {
            rejectUnauthorized: false,
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
