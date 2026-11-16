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
import { ChatRequest } from '../messaging/chat-request.entity';
import { StudentProfile } from '../students/student-profile.entity';
import { CallRequest } from './call-request.entity';
import { CallSession } from './call-session.entity';
import { CreateCallRequestDto } from './dto/create-call-request.dto';
import { RejectCallRequestDto } from './dto/reject-call-request.dto';

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
export class CallRequestsService {
  constructor(
    @InjectRepository(CallRequest)
    private readonly requestsRepo: Repository<CallRequest>,
    @InjectRepository(ChatRequest)
    private readonly chatRequestsRepo: Repository<ChatRequest>,
    @InjectRepository(StudentProfile)
    private readonly studentsRepo: Repository<StudentProfile>,
    @InjectRepository(CallSession)
    private readonly sessionsRepo: Repository<CallSession>,
    private readonly access: AccessService,
  ) {}

  private toDto(request: CallRequest) {
    return {
      id: request.id,
      studentId: request.studentId,
      consultantId: request.consultantId,
      scheduledFor: request.scheduledFor,
      status: request.status,
      studentNote: request.studentNote,
      consultantNote: request.consultantNote,
      callSessionId: request.callSessionId,
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
      throw new NotFoundException('Call request not found');
    }
    return request;
  }

  private async healCompletedRequests(rows: CallRequest[]) {
    for (const request of rows) {
      if (
        request.status !== CallRequestStatus.APPROVED ||
        !request.callSessionId
      ) {
        continue;
      }
      const session = await this.sessionsRepo.findOne({
        where: { id: request.callSessionId },
      });
      if (session?.endedAt) {
        request.status = CallRequestStatus.COMPLETED;
        await this.requestsRepo.save(request);
      }
    }
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

  async create(user: JwtPayload, dto: CreateCallRequestDto) {
    if (user.role !== UserRole.STUDENT || !user.studentProfileId) {
      throw new ForbiddenException('Only students can schedule calls');
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
        'You already have a pending or approved call request. Cancel or wait before scheduling another.',
      );
    }

    await this.assertNoSameTimeChatConflict(student.id, scheduledFor);

    try {
      const saved = await this.requestsRepo.save(
        this.requestsRepo.create({
          studentId: student.id,
          consultantId: student.consultantId,
          scheduledFor,
          status: CallRequestStatus.PENDING,
          studentNote: dto.note?.trim() || null,
          consultantNote: null,
          callSessionId: null,
        }),
      );
      return this.toDto(await this.loadOrFail(saved.id));
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException(
          'You already have a pending or approved call request. Cancel or wait before scheduling another.',
        );
      }
      throw error;
    }
  }

  private async assertNoSameTimeChatConflict(
    studentId: string,
    scheduledFor: Date,
  ) {
    const from = new Date(scheduledFor.getTime() - SAME_TIME_WINDOW_MS);
    const to = new Date(scheduledFor.getTime() + SAME_TIME_WINDOW_MS);
    const clash = await this.chatRequestsRepo.findOne({
      where: {
        studentId,
        status: In([CallRequestStatus.PENDING, CallRequestStatus.APPROVED]),
        scheduledFor: Between(from, to),
      },
    });
    if (clash) {
      throw new BadRequestException(
        'You already have a chat scheduled at this time. Pick another time.',
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
      throw new ForbiddenException('Not your call request');
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

  async reject(user: JwtPayload, id: string, dto: RejectCallRequestDto) {
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

  /** Used by CallsService.start — load approved request owned by consultant. */
  async requireApprovedForStart(user: JwtPayload, callRequestId: string) {
    if (user.role !== UserRole.CONSULTANT || !user.consultantProfileId) {
      throw new ForbiddenException('Consultants only');
    }

    const request = await this.loadOrFail(callRequestId);
    if (request.consultantId !== user.consultantProfileId) {
      throw new ForbiddenException('Not assigned to you');
    }
    await this.access.assertConsultantOwnsStudent(
      user.consultantProfileId,
      request.studentId,
    );

    if (request.status !== CallRequestStatus.APPROVED) {
      throw new BadRequestException(
        'Call request must be approved before starting a live call',
      );
    }
    if (request.callSessionId) {
      throw new BadRequestException(
        'A live call was already started for this request',
      );
    }

    return request;
  }

  async attachSession(callRequestId: string, callSessionId: string) {
    const result = await this.requestsRepo.update(
      {
        id: callRequestId,
        status: CallRequestStatus.APPROVED,
        callSessionId: IsNull(),
      },
      { callSessionId },
    );
    if (!result.affected) {
      throw new BadRequestException(
        'A live call was already started for this request',
      );
    }
    return this.toDto(await this.loadOrFail(callRequestId));
  }

  /** When a live session ends, move the linked request out of Active. */
  async completeBySessionId(callSessionId: string) {
    const request = await this.requestsRepo.findOne({
      where: { callSessionId },
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
