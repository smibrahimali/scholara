import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApplicationStepStatus, UserRole } from '../common/enums';
import { AccessService } from '../common/access.service';
import { JwtPayload } from '../auth/jwt-payload';
import { Application } from './application.entity';
import { ApplicationStep } from './application-step.entity';
import { UniversityEmail } from '../emails/university-email.entity';
import { UpdateStepDto } from './dto/update-step.dto';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationsRepo: Repository<Application>,
    @InjectRepository(ApplicationStep)
    private readonly stepsRepo: Repository<ApplicationStep>,
    @InjectRepository(UniversityEmail)
    private readonly emailsRepo: Repository<UniversityEmail>,
    private readonly access: AccessService,
  ) {}

  async listForUser(user: JwtPayload, studentId?: string) {
    const resolvedStudentId = await this.access.resolveReadableStudentId(
      user,
      studentId,
    );
    return this.applicationsRepo.find({
      where: { studentId: resolvedStudentId },
      relations: {
        university: true,
        program: true,
        steps: true,
      },
      order: { updatedAt: 'DESC' },
    });
  }

  async listEmailsForUser(user: JwtPayload, studentId?: string) {
    const resolvedStudentId = await this.access.resolveReadableStudentId(
      user,
      studentId,
    );

    const emails = await this.emailsRepo
      .createQueryBuilder('email')
      .innerJoinAndSelect('email.application', 'application')
      .leftJoinAndSelect('application.university', 'university')
      .leftJoinAndSelect('application.program', 'program')
      .where('application.student_id = :studentId', {
        studentId: resolvedStudentId,
      })
      .orderBy('email.sent_at', 'DESC')
      .getMany();

    return emails.map((email) => ({
      id: email.id,
      subject: email.subject,
      sender: email.sender,
      sentAt: email.sentAt,
      body: email.body,
      applicationId: email.applicationId,
      universityName: email.application.university?.name ?? 'University',
      programName: email.application.program?.name ?? 'Program',
      applicationStatus: email.application.status,
    }));
  }

  async getDetail(user: JwtPayload, applicationId: string) {
    const application = await this.applicationsRepo.findOne({
      where: { id: applicationId },
      relations: {
        university: true,
        program: true,
        steps: true,
        emails: true,
        student: { user: true, consultant: { user: true } },
      },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    await this.access.resolveReadableStudentId(user, application.studentId);
    application.steps = (application.steps ?? []).sort(
      (a, b) => a.stepNumber - b.stepNumber,
    );
    application.emails = (application.emails ?? []).sort(
      (a, b) => b.sentAt.getTime() - a.sentAt.getTime(),
    );
    return application;
  }

  async updateStep(
    user: JwtPayload,
    applicationId: string,
    stepNumber: number,
    dto: UpdateStepDto,
  ) {
    if (user.role !== UserRole.CONSULTANT || !user.consultantProfileId) {
      throw new ForbiddenException('Only consultants can update steps');
    }
    if (stepNumber < 1 || stepNumber > 12) {
      throw new BadRequestException('Step must be between 1 and 12');
    }
    if (dto.status === undefined && dto.notes === undefined) {
      throw new BadRequestException('Provide status and/or notes');
    }

    const application = await this.applicationsRepo.findOne({
      where: { id: applicationId },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    await this.access.assertConsultantOwnsStudent(
      user.consultantProfileId,
      application.studentId,
    );

    const step = await this.stepsRepo.findOne({
      where: { applicationId, stepNumber },
    });
    if (!step) {
      throw new NotFoundException('Application step not found');
    }

    if (dto.status !== undefined) {
      const finishing =
        dto.status === ApplicationStepStatus.COMPLETED ||
        dto.status === ApplicationStepStatus.SKIPPED;

      if (finishing && step.status !== ApplicationStepStatus.IN_PROGRESS) {
        throw new BadRequestException('Only the current step can be completed');
      }

      step.status = dto.status;
      step.completedAt = finishing ? new Date() : null;

      if (finishing && stepNumber < 12) {
        const nextStep = await this.stepsRepo.findOne({
          where: { applicationId, stepNumber: stepNumber + 1 },
        });
        if (
          nextStep &&
          nextStep.status === ApplicationStepStatus.NOT_STARTED
        ) {
          nextStep.status = ApplicationStepStatus.IN_PROGRESS;
          await this.stepsRepo.save(nextStep);
        }
      }
    }

    if (dto.notes !== undefined) {
      step.notes = dto.notes;
    }

    await this.stepsRepo.save(step);
    return this.getDetail(user, applicationId);
  }
}
