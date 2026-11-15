import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from '../students/student-profile.entity';
import { Document } from '../documents/document.entity';
import { Application } from '../applications/application.entity';
import { CallNote } from '../calls/call-note.entity';
import { CallSession } from '../calls/call-session.entity';
import { CallRequest } from '../calls/call-request.entity';
import { ConsultantProfile } from './consultant-profile.entity';
import { ConsultantsController } from './consultants.controller';
import { ConsultantsService } from './consultants.service';
import { ChatSession } from '../messaging/chat-session.entity';
import { ChatRequest } from '../messaging/chat-request.entity';
import { Conversation } from '../messaging/conversation.entity';
import { DirectMessage } from '../messaging/direct-message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentProfile,
      Document,
      Application,
      CallNote,
      CallSession,
      CallRequest,
      ConsultantProfile,
      ChatSession,
      ChatRequest,
      Conversation,
      DirectMessage,
    ]),
  ],
  controllers: [ConsultantsController],
  providers: [ConsultantsService],
})
export class ConsultantsModule {}
