import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { JwtPayload } from '../auth/jwt-payload';
import { CallRequestStatus, DocumentStatus, UserRole } from '../common/enums';
import { StudentProfile } from '../students/student-profile.entity';
import { Document } from '../documents/document.entity';
import { Application } from '../applications/application.entity';
import { CallNote } from '../calls/call-note.entity';
import { CallSession } from '../calls/call-session.entity';
import { CallRequest } from '../calls/call-request.entity';
import { ConsultantProfile } from './consultant-profile.entity';
import { AccessService } from '../common/access.service';
import { HandoverDto } from './dto/handover.dto';
import { ChatSession } from '../messaging/chat-session.entity';
import { ChatRequest } from '../messaging/chat-request.entity';
import { Conversation } from '../messaging/conversation.entity';
import { DirectMessage } from '../messaging/direct-message.entity';

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
    @InjectDataSource()
    private readonly dataSource: DataSource,
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

    await this.access.assertConsultantOwnsStudent(
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
    if (target.user?.role !== UserRole.CONSULTANT) {
      throw new BadRequestException('Target user is not a consultant');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const student = await manager.findOne(StudentProfile, {
        where: { id: dto.studentId, consultantId: fromConsultantId },
        relations: { user: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!student) {
        throw new ForbiddenException('Student is not assigned to you');
      }

      const now = new Date();

      const openCalls = await manager.find(CallSession, {
        where: {
          studentId: student.id,
          endedAt: IsNull(),
        },
      });
      for (const call of openCalls) {
        call.endedAt = now;
      }
      if (openCalls.length > 0) {
        await manager.save(CallSession, openCalls);
      }
      for (const call of openCalls) {
        await manager.update(
          CallRequest,
          { callSessionId: call.id },
          { status: CallRequestStatus.COMPLETED },
        );
      }

      const openChats = await manager.find(ChatSession, {
        where: {
          studentId: student.id,
          endedAt: IsNull(),
        },
      });
      for (const chat of openChats) {
        await manager.delete(DirectMessage, { chatSessionId: chat.id });
        chat.endedAt = now;
      }
      if (openChats.length > 0) {
        await manager.save(ChatSession, openChats);
      }
      for (const chat of openChats) {
        await manager.update(
          ChatRequest,
          { chatSessionId: chat.id },
          { status: CallRequestStatus.COMPLETED },
        );
      }

      await manager.update(
        CallRequest,
        {
          studentId: student.id,
          status: In([CallRequestStatus.PENDING, CallRequestStatus.APPROVED]),
        },
        { consultantId: target.id },
      );

      await manager.update(
        ChatRequest,
        {
          studentId: student.id,
          status: In([CallRequestStatus.PENDING, CallRequestStatus.APPROVED]),
        },
        { consultantId: target.id },
      );

      await manager.update(
        Conversation,
        { studentId: student.id },
        { consultantId: target.id },
      );

      student.consultantId = target.id;
      await manager.save(StudentProfile, student);

      const refreshed = await manager.findOne(StudentProfile, {
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
        manager.count(CallSession, { where: { studentId: refreshed.id } }),
        manager.count(Document, { where: { studentId: refreshed.id } }),
        manager.count(Application, { where: { studentId: refreshed.id } }),
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
        closedOpenChats: openChats.length,
        inherited: {
          callSessions: callCount,
          documents: documentCount,
          applications: applicationCount,
        },
        message:
          'Handover complete. The receiving consultant can read applications, documents, and prior call transcripts for this student.',
      };
    });

    return result;
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
