import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Repository } from 'typeorm';
import { AccessService } from '../common/access.service';
import { CallRequestStatus, UserRole } from '../common/enums';
import { JwtPayload } from '../auth/jwt-payload';
import { CallRequest } from '../calls/call-request.entity';
import { StudentProfile } from '../students/student-profile.entity';
import { ChatRequest } from './chat-request.entity';
import { ChatSession } from './chat-session.entity';
import { CreateChatRequestDto } from './dto/create-chat-request.dto';
import { RejectChatRequestDto } from './dto/reject-chat-request.dto';

const SAME_TIME_WINDOW_MS = 15 * 60_000;
const BOOKING_WINDOW_DAYS = 10;

function bookingWindowEnd(from = new Date()) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + BOOKING_WINDOW_DAYS);
  end.setHours(23, 59, 59, 999);
  return end;
}

@Injectable()
export class ChatRequestsService {
  constructor(
    @InjectRepository(ChatRequest)
    private readonly requestsRepo: Repository<ChatRequest>,
    @InjectRepository(CallRequest)
    private readonly callRequestsRepo: Repository<CallRequest>,
    @InjectRepository(StudentProfile)
    private readonly studentsRepo: Repository<StudentProfile>,
    @InjectRepository(ChatSession)
    private readonly sessionsRepo: Repository<ChatSession>,
    private readonly access: AccessService,
  ) {}

  private toDto(request: ChatRequest) {
    return {
      id: request.id,
      studentId: request.studentId,
      consultantId: request.consultantId,
      scheduledFor: request.scheduledFor,
      status: request.status,
      studentNote: request.studentNote,
      consultantNote: request.consultantNote,
      chatSessionId: request.chatSessionId,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      studentName: request.student?.user?.fullName ?? null,
      consultantName: request.consultant?.user?.fullName ?? null,
      consultantTitle: request.consultant?.title ?? null,
    };
  }

  private async loadOrFail(id: string) {
    const request = await this.requestsRepo.findOne({
      where: { id },
      relations: {
        student: { user: true },
        consultant: { user: true },
      },
    });
    if (!request) {
      throw new NotFoundException('Chat request not found');
    }
    return request;
  }

  private async healCompletedRequests(rows: ChatRequest[]) {
    const sessionIds = [
      ...new Set(
        rows
          .filter(
            (r) =>
              r.status === CallRequestStatus.APPROVED &&
              Boolean(r.chatSessionId),
          )
          .map((r) => r.chatSessionId as string),
      ),
    ];
    if (sessionIds.length === 0) {
      return;
    }

    const ended = await this.sessionsRepo.find({
      where: { id: In(sessionIds) },
      select: ['id', 'endedAt'],
    });
    const endedIds = new Set(
      ended.filter((s) => Boolean(s.endedAt)).map((s) => s.id),
    );
    if (endedIds.size === 0) {
      return;
    }

    const toComplete = rows.filter(
      (r) => r.chatSessionId && endedIds.has(r.chatSessionId),
    );
    for (const request of toComplete) {
      request.status = CallRequestStatus.COMPLETED;
    }
    await this.requestsRepo.save(toComplete);
  }

  async list(user: JwtPayload, studentId?: string, status?: string) {
    if (user.role === UserRole.CONSULTANT) {
      if (!user.consultantProfileId) {
        throw new ForbiddenException('Consultant profile missing');
      }

      const where: {
        consultantId: string;
        studentId?: string;
        status?: CallRequestStatus;
      } = { consultantId: user.consultantProfileId };

      if (studentId) {
        await this.access.assertConsultantOwnsStudent(
          user.consultantProfileId,
          studentId,
        );
        where.studentId = studentId;
      }

      if (
        status &&
        Object.values(CallRequestStatus).includes(status as CallRequestStatus)
      ) {
        where.status = status as CallRequestStatus;
      }

      const rows = await this.requestsRepo.find({
        where,
        relations: {
          student: { user: true },
          consultant: { user: true },
        },
        order: { scheduledFor: 'ASC' },
      });
      await this.healCompletedRequests(rows);
      return rows.map((r) => this.toDto(r));
    }

    const resolvedStudentId = await this.access.resolveReadableStudentId(
      user,
      studentId,
    );

    const where: {
      studentId: string;
      status?: CallRequestStatus;
    } = { studentId: resolvedStudentId };

    if (
      status &&
      Object.values(CallRequestStatus).includes(status as CallRequestStatus)
    ) {
      where.status = status as CallRequestStatus;
    }

    const rows = await this.requestsRepo.find({
      where,
      relations: {
        student: { user: true },
        consultant: { user: true },
      },
      order: { scheduledFor: 'ASC' },
    });
    await this.healCompletedRequests(rows);
    return rows.map((r) => this.toDto(r));
  }

  async create(user: JwtPayload, dto: CreateChatRequestDto) {
    if (user.role !== UserRole.STUDENT || !user.studentProfileId) {
      throw new ForbiddenException('Only students can schedule chats');
    }

    const student = await this.studentsRepo.findOne({
      where: { id: user.studentProfileId },
      relations: { consultant: { user: true }, user: true },
    });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }
    if (!student.consultantId) {
      throw new BadRequestException('No consultant assigned');
    }

    const scheduledFor = new Date(dto.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) {
      throw new BadRequestException('Invalid scheduledFor');
    }
    if (scheduledFor.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('Pick a future date and time');
    }
    if (scheduledFor.getTime() > bookingWindowEnd().getTime()) {
      throw new BadRequestException('Pick a date within the next 10 days');
    }

    const open = await this.requestsRepo.findOne({
      where: {
        studentId: student.id,
        status: In([CallRequestStatus.PENDING, CallRequestStatus.APPROVED]),
      },
    });
    if (open) {
      throw new BadRequestException(
        'You already have a pending or approved chat request. Cancel or wait before scheduling another.',
      );
    }

    await this.assertNoSameTimeCallConflict(student.id, scheduledFor);

    try {
      const saved = await this.requestsRepo.save(
        this.requestsRepo.create({
          studentId: student.id,
          consultantId: student.consultantId,
          scheduledFor,
          status: CallRequestStatus.PENDING,
          studentNote: dto.note?.trim() || null,
          consultantNote: null,
          chatSessionId: null,
        }),
      );
      return this.toDto(await this.loadOrFail(saved.id));
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException(
          'You already have a pending or approved chat request. Cancel or wait before scheduling another.',
        );
      }
      throw error;
    }
  }

  private async assertNoSameTimeCallConflict(
    studentId: string,
    scheduledFor: Date,
  ) {
    const from = new Date(scheduledFor.getTime() - SAME_TIME_WINDOW_MS);
    const to = new Date(scheduledFor.getTime() + SAME_TIME_WINDOW_MS);
    const clash = await this.callRequestsRepo.findOne({
      where: {
        studentId,
        status: In([CallRequestStatus.PENDING, CallRequestStatus.APPROVED]),
        scheduledFor: Between(from, to),
      },
    });
    if (clash) {
      throw new BadRequestException(
        'You already have a call scheduled at this time. Pick another time.',
      );
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }

  async cancel(user: JwtPayload, id: string) {
    if (user.role !== UserRole.STUDENT || !user.studentProfileId) {
      throw new ForbiddenException('Only students can cancel their requests');
    }

    const request = await this.loadOrFail(id);
    if (request.studentId !== user.studentProfileId) {
      throw new ForbiddenException('Not your chat request');
    }
    if (request.status !== CallRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    request.status = CallRequestStatus.CANCELLED;
    await this.requestsRepo.save(request);
    return this.toDto(await this.loadOrFail(request.id));
  }

  async approve(user: JwtPayload, id: string) {
    if (user.role !== UserRole.CONSULTANT || !user.consultantProfileId) {
      throw new ForbiddenException('Consultants only');
    }

    const request = await this.loadOrFail(id);
    if (request.consultantId !== user.consultantProfileId) {
      throw new ForbiddenException('Not assigned to you');
    }
    await this.access.assertConsultantOwnsStudent(
      user.consultantProfileId,
      request.studentId,
    );

    if (request.status !== CallRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be approved');
    }

    request.status = CallRequestStatus.APPROVED;
    await this.requestsRepo.save(request);
    return this.toDto(await this.loadOrFail(request.id));
  }

  async reject(user: JwtPayload, id: string, dto: RejectChatRequestDto) {
    if (user.role !== UserRole.CONSULTANT || !user.consultantProfileId) {
      throw new ForbiddenException('Consultants only');
    }

    const request = await this.loadOrFail(id);
    if (request.consultantId !== user.consultantProfileId) {
      throw new ForbiddenException('Not assigned to you');
    }
    await this.access.assertConsultantOwnsStudent(
      user.consultantProfileId,
      request.studentId,
    );

    if (request.status !== CallRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    request.status = CallRequestStatus.REJECTED;
    request.consultantNote = dto.reason?.trim() || null;
    await this.requestsRepo.save(request);
    return this.toDto(await this.loadOrFail(request.id));
  }

  async requireApprovedForStart(user: JwtPayload, chatRequestId: string) {
    if (user.role !== UserRole.CONSULTANT || !user.consultantProfileId) {
      throw new ForbiddenException('Consultants only');
    }

    const request = await this.loadOrFail(chatRequestId);
    if (request.consultantId !== user.consultantProfileId) {
      throw new ForbiddenException('Not assigned to you');
    }
    await this.access.assertConsultantOwnsStudent(
      user.consultantProfileId,
      request.studentId,
    );

    if (request.status !== CallRequestStatus.APPROVED) {
      throw new BadRequestException(
        'Chat request must be approved before starting an encrypted chat',
      );
    }
    if (request.chatSessionId) {
      throw new BadRequestException(
        'An encrypted chat was already started for this request',
      );
    }

    return request;
  }

  async attachSession(chatRequestId: string, chatSessionId: string) {
    const result = await this.requestsRepo.update(
      {
        id: chatRequestId,
        status: CallRequestStatus.APPROVED,
        chatSessionId: IsNull(),
      },
      { chatSessionId },
    );
    if (!result.affected) {
      throw new BadRequestException(
        'An encrypted chat was already started for this request',
      );
    }
    return this.toDto(await this.loadOrFail(chatRequestId));
  }

  async completeBySessionId(chatSessionId: string) {
    const request = await this.requestsRepo.findOne({
      where: { chatSessionId },
    });
    if (!request) return null;
    if (
      request.status === CallRequestStatus.APPROVED ||
      request.status === CallRequestStatus.PENDING
    ) {
      request.status = CallRequestStatus.COMPLETED;
      await this.requestsRepo.save(request);
    }
    return request;
  }
}
