import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { JwtPayload } from '../auth/jwt-payload';
import { UserRole, DocumentStatus } from '../common/enums';
import { StudentProfile } from '../students/student-profile.entity';
import { Document } from '../documents/document.entity';
import { Application } from '../applications/application.entity';
import { CallNote } from '../calls/call-note.entity';
import { CallSession } from '../calls/call-session.entity';
import { ConsultantProfile } from './consultant-profile.entity';
import { AccessService } from '../common/access.service';
import { HandoverDto } from './dto/handover.dto';

@Injectable()
export class ConsultantsService {
  constructor(
    @InjectRepository(StudentProfile)
    private readonly studentsRepo: Repository<StudentProfile>,
    @InjectRepository(Document)
    private readonly documentsRepo: Repository<Document>,
    @InjectRepository(Application)
    private readonly applicationsRepo: Repository<Application>,
    @InjectRepository(CallNote)
    private readonly callNotesRepo: Repository<CallNote>,
    @InjectRepository(CallSession)
    private readonly sessionsRepo: Repository<CallSession>,
    @InjectRepository(ConsultantProfile)
    private readonly consultantsRepo: Repository<ConsultantProfile>,
    private readonly access: AccessService,
  ) {}

  private requireConsultant(user: JwtPayload): string {
    if (user.role !== UserRole.CONSULTANT || !user.consultantProfileId) {
      throw new ForbiddenException('Consultants only');
    }
    return user.consultantProfileId;
  }

  async listPeers(user: JwtPayload) {
    const myId = this.requireConsultant(user);
    const peers = await this.consultantsRepo.find({
      where: { id: Not(myId) },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });

    return peers.map((peer) => ({
      id: peer.id,
      fullName: peer.user.fullName,
      email: peer.user.email,
      title: peer.title ?? null,
    }));
  }

  async handover(user: JwtPayload, dto: HandoverDto) {
    const fromConsultantId = this.requireConsultant(user);

    if (dto.toConsultantId === fromConsultantId) {
      throw new BadRequestException('Cannot hand over a student to yourself');
    }

    const student = await this.access.assertConsultantOwnsStudent(
      fromConsultantId,
      dto.studentId,
    );

    const target = await this.consultantsRepo.findOne({
      where: { id: dto.toConsultantId },
      relations: { user: true },
    });
    if (!target) {
      throw new NotFoundException('Target consultant not found');
    }

    const openCalls = await this.sessionsRepo.find({
      where: {
        studentId: student.id,
        consultantId: fromConsultantId,
        endedAt: IsNull(),
      },
    });
    if (openCalls.length > 0) {
      const now = new Date();
      for (const call of openCalls) {
        call.endedAt = now;
      }
      await this.sessionsRepo.save(openCalls);
    }

    student.consultantId = target.id;
    await this.studentsRepo.save(student);

    const refreshed = await this.studentsRepo.findOne({
      where: { id: student.id },
      relations: {
        user: true,
        consultant: { user: true },
      },
    });
    if (!refreshed) {
      throw new NotFoundException('Student not found after handover');
    }

    const [callCount, documentCount, applicationCount] = await Promise.all([
      this.sessionsRepo.count({ where: { studentId: refreshed.id } }),
      this.documentsRepo.count({ where: { studentId: refreshed.id } }),
      this.applicationsRepo.count({ where: { studentId: refreshed.id } }),
    ]);

    return {
      studentId: refreshed.id,
      studentName: refreshed.user.fullName,
      fromConsultantId,
      toConsultant: {
        id: target.id,
        fullName: target.user.fullName,
        email: target.user.email,
      },
      closedOpenCalls: openCalls.length,
      inherited: {
        callSessions: callCount,
        documents: documentCount,
        applications: applicationCount,
      },
      message:
        'Handover complete. The receiving consultant can read applications, documents, and prior call transcripts for this student.',
    };
  }

  async listAssignedStudents(user: JwtPayload) {
    const consultantId = this.requireConsultant(user);

    const students = await this.studentsRepo.find({
      where: { consultantId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });

    const enriched = await Promise.all(
      students.map(async (student) => {
        const [docs, apps] = await Promise.all([
          this.documentsRepo.find({ where: { studentId: student.id } }),
          this.applicationsRepo.find({ where: { studentId: student.id } }),
        ]);
        return {
          id: student.id,
          fullName: student.user.fullName,
          email: student.user.email,
          targetProgram: student.targetProgram,
          pendingReviews: docs.filter(
            (d) => d.status === DocumentStatus.UNDER_REVIEW,
          ).length,
          rejectedDocuments: docs.filter(
            (d) => d.status === DocumentStatus.REJECTED,
          ).length,
          applications: apps.length,
        };
      }),
    );

    return enriched;
  }

  async listCallNotes(user: JwtPayload, studentId: string) {
    await this.access.resolveReadableStudentId(user, studentId);
    return this.callNotesRepo
      .createQueryBuilder('note')
      .innerJoinAndSelect('note.callSession', 'session')
      .leftJoinAndSelect('session.consultant', 'consultant')
      .leftJoinAndSelect('consultant.user', 'consultantUser')
      .where('session.student_id = :studentId', { studentId })
      .orderBy('note.created_at', 'DESC')
      .getMany();
  }
}
