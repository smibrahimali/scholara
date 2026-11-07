import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from './application.entity';
import { ApplicationStep } from './application-step.entity';
import { UniversityEmail } from '../emails/university-email.entity';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { EmailsController } from '../emails/emails.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, ApplicationStep, UniversityEmail]),
  ],
  controllers: [ApplicationsController, EmailsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
