import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroqModule } from '../groq/groq.module';
import { StudentProfile } from '../students/student-profile.entity';
import { Document } from '../documents/document.entity';
import { Application } from '../applications/application.entity';
import { ChatMessage } from './chat-message.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [
    GroqModule,
    TypeOrmModule.forFeature([
      ChatMessage,
      StudentProfile,
      Document,
      Application,
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
