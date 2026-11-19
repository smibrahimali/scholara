import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from './student-profile.entity';
import { Document } from '../documents/document.entity';
import { Application } from '../applications/application.entity';
import { CallNote } from '../calls/call-note.entity';
import { GuardianProfile } from '../guardians/guardian-profile.entity';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentProfile,
      Document,
      Application,
      CallNote,
      GuardianProfile,
    ]),
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
