import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AccessService } from '../common/access.service';
import { UserRole } from '../common/enums';
import { JwtPayload } from '../auth/jwt-payload';
import { GroqService } from '../groq/groq.service';
import { CallSession } from './call-session.entity';
import { CallNote } from './call-note.entity';
import { StartCallDto } from './dto/start-call.dto';
import { UpdateTranscriptDto } from './dto/update-transcript.dto';
import { UpsertCallNoteDto } from './dto/upsert-call-note.dto';
import { LiveTranscriptLineDto } from './dto/live-transcript-line.dto';

@Injectable()
export class CallsService {
  constructor(
    @InjectRepository(CallSession)
    private readonly sessionsRepo: Repository<CallSession>,
    @InjectRepository(CallNote)
    private readonly notesRepo: Repository<CallNote>,
    private readonly access: AccessService,
    private readonly groq: GroqService,
  ) {}

  async listForUser(user: JwtPayload, studentId?: string) {
    const resolvedStudentId = await this.access.resolveReadableStudentId(
      user,
      studentId,
    );

    return this.sessionsRepo.find({
      where: { studentId: resolvedStudentId },
      relations: {
        note: true,
        consultant: { user: true },
        student: { user: true },
      },
      order: { startedAt: 'DESC' },
    });
  }

  async getById(user: JwtPayload, id: string) {
    const session = await this.findSessionOrFail(id);
    await this.access.resolveReadableStudentId(user, session.studentId);
    return session;
  }

  async start(user: JwtPayload, dto: StartCallDto) {
    this.requireConsultant(user);
    await this.access.assertConsultantOwnsStudent(
      user.consultantProfileId!,
      dto.studentId,
    );

    const open = await this.sessionsRepo.findOne({
      where: {
        studentId: dto.studentId,
        consultantId: user.consultantProfileId!,
        endedAt: IsNull(),
      },
    });
    if (open) {
      throw new BadRequestException(
        'An open call already exists for this student. End it before starting another.',
      );
    }

    const session = await this.sessionsRepo.save(
      this.sessionsRepo.create({
        studentId: dto.studentId,
        consultantId: user.consultantProfileId!,
        startedAt: new Date(),
        endedAt: null,
        transcript: null,
      }),
    );

    return this.findSessionOrFail(session.id);
  }

  async updateTranscript(
    user: JwtPayload,
    id: string,
    dto: UpdateTranscriptDto,
  ) {
    const session = await this.requireOwnedSession(user, id);

    const next = dto.transcript.trim();
    if (dto.append) {
      const existing = session.transcript?.trim();
      session.transcript = existing ? `${existing}\n${next}` : next;
    } else {
      session.transcript = next;
    }

    await this.sessionsRepo.save(session);
    return this.findSessionOrFail(session.id);
  }

  async assertCanJoinLiveCall(user: JwtPayload, id: string) {
    return this.requireLiveParticipant(user, id);
  }

  /** Student or assigned consultant appends a spoken line while the call is open. */
  async appendLiveLine(
    user: JwtPayload,
    id: string,
    dto: LiveTranscriptLineDto,
  ) {
    const session = await this.requireLiveParticipant(user, id);
    const line = `${user.fullName}: ${dto.text.trim()}`;
    await this.appendTranscriptLine(session, line);
    return this.findSessionOrFail(session.id);
  }

  /** Audio chunk → Groq Whisper → append speaker-labeled line. */
  async transcribeLiveAudio(
    user: JwtPayload,
    id: string,
    file?: Express.Multer.File,
  ) {
    const session = await this.requireLiveParticipant(user, id);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Audio file is required');
    }
    if (file.size > 4 * 1024 * 1024) {
      throw new BadRequestException('Audio chunk must be under 4MB');
    }

    const text = await this.groq.transcribeAudio(
      file.buffer,
      file.originalname || 'chunk.webm',
      file.mimetype || 'audio/webm',
    );
    if (!text) {
      return this.findSessionOrFail(session.id);
    }

    const line = `${user.fullName}: ${text}`;
    await this.appendTranscriptLine(session, line);
    return this.findSessionOrFail(session.id);
  }

  async end(user: JwtPayload, id: string) {
    const session = await this.requireOwnedSession(user, id);
    if (session.endedAt) {
      throw new BadRequestException('Call is already ended');
    }
    session.endedAt = new Date();
    await this.sessionsRepo.save(session);
    return this.findSessionOrFail(session.id);
  }

  private async appendTranscriptLine(session: CallSession, line: string) {
    const existing = session.transcript?.trim();
    session.transcript = existing ? `${existing}\n${line}` : line;
    await this.sessionsRepo.save(session);
  }

  private async requireLiveParticipant(user: JwtPayload, id: string) {
    const session = await this.findSessionOrFail(id);
    if (session.endedAt) {
      throw new BadRequestException('Call has already ended');
    }
    await this.access.resolveReadableStudentId(user, session.studentId);

    if (user.role === UserRole.GUARDIAN) {
      throw new ForbiddenException('Guardians can view calls but not speak');
    }

    if (
      user.role === UserRole.CONSULTANT &&
      session.consultantId !== user.consultantProfileId
    ) {
      throw new ForbiddenException('Only the assigned consultant can speak');
    }

    return session;
  }

  async upsertNote(user: JwtPayload, id: string, dto: UpsertCallNoteDto) {
    const session = await this.requireOwnedSession(user, id);

    let note = await this.notesRepo.findOne({
      where: { callSessionId: session.id },
    });

    if (!note) {
      note = this.notesRepo.create({ callSessionId: session.id });
    }

    note.summary = dto.summary.trim();
    note.actionItems = dto.actionItems.trim();
    note.universitiesDiscussed = dto.universitiesDiscussed.trim();
    note.followUps = dto.followUps.trim();

    await this.notesRepo.save(note);
    return this.findSessionOrFail(session.id);
  }

  private requireConsultant(user: JwtPayload) {
    if (user.role !== UserRole.CONSULTANT || !user.consultantProfileId) {
      throw new ForbiddenException('Consultants only');
    }
  }

  private async requireOwnedSession(user: JwtPayload, id: string) {
    this.requireConsultant(user);
    const session = await this.findSessionOrFail(id);
    if (session.consultantId !== user.consultantProfileId) {
      throw new ForbiddenException('Call is not assigned to you');
    }
    return session;
  }

  private async findSessionOrFail(id: string) {
    const session = await this.sessionsRepo.findOne({
      where: { id },
      relations: {
        note: true,
        consultant: { user: true },
        student: { user: true },
      },
    });
    if (!session) {
      throw new NotFoundException('Call session not found');
    }
    return session;
  }
}
