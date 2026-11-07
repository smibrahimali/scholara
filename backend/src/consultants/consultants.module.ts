import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from '../students/student-profile.entity';
import { Document } from '../documents/document.entity';
import { Application } from '../applications/application.entity';
import { CallNote } from '../calls/call-note.entity';
import { CallSession } from '../calls/call-session.entity';
import { ConsultantProfile } from './consultant-profile.entity';
import { ConsultantsController } from './consultants.controller';
import { ConsultantsService } from './consultants.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentProfile,
      Document,
      Application,
      CallNote,
      CallSession,
      ConsultantProfile,
    ]),
  ],
  controllers: [ConsultantsController],
  providers: [ConsultantsService],
})
export class ConsultantsModule {}
