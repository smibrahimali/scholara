import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { GroqModule } from '../groq/groq.module';
import { StudentProfile } from '../students/student-profile.entity';
import { ChatRequest } from '../messaging/chat-request.entity';
import { CallSession } from './call-session.entity';
import { CallNote } from './call-note.entity';
import { CallRequest } from './call-request.entity';
import { CallsController } from './calls.controller';
import { CallRequestsController } from './call-requests.controller';
import { CallsService } from './calls.service';
import { CallRequestsService } from './call-requests.service';
import { CallsGateway } from './calls.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CallSession,
      CallNote,
      CallRequest,
      ChatRequest,
      StudentProfile,
    ]),
    GroqModule,
    AuthModule,
  ],
  controllers: [CallsController, CallRequestsController],
  providers: [CallsService, CallRequestsService, CallsGateway],
  exports: [CallsService, CallRequestsService],
})
export class CallsModule {}
