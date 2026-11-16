import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CallRequest } from '../calls/call-request.entity';
import { StudentProfile } from '../students/student-profile.entity';
import { Conversation } from './conversation.entity';
import { DirectMessage } from './direct-message.entity';
import { ChatSession } from './chat-session.entity';
import { ChatRequest } from './chat-request.entity';
import { MessagingController } from './messaging.controller';
import { MessagingGateway } from './messaging.gateway';
import { MessagingService } from './messaging.service';
import { ChatRequestsController } from './chat-requests.controller';
import { ChatRequestsService } from './chat-requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      DirectMessage,
      StudentProfile,
      ChatSession,
      ChatRequest,
      CallRequest,
    ]),
    AuthModule,
  ],
  controllers: [MessagingController, ChatRequestsController],
  providers: [MessagingService, MessagingGateway, ChatRequestsService],
  exports: [MessagingService, ChatRequestsService],
})
export class MessagingModule {}
