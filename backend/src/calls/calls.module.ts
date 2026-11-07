import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { GroqModule } from '../groq/groq.module';
import { CallSession } from './call-session.entity';
import { CallNote } from './call-note.entity';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { CallsGateway } from './calls.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([CallSession, CallNote]),
    GroqModule,
    AuthModule,
  ],
  controllers: [CallsController],
  providers: [CallsService, CallsGateway],
  exports: [CallsService],
})
export class CallsModule {}
