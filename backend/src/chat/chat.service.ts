import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessService } from '../common/access.service';
import { ApplicationStepStatus, UserRole } from '../common/enums';
import { JwtPayload } from '../auth/jwt-payload';
import { GroqService, GroqChatMessage } from '../groq/groq.service';
import { StudentProfile } from '../students/student-profile.entity';
import { Document } from '../documents/document.entity';
import { Application } from '../applications/application.entity';
import { ChatMessage } from './chat-message.entity';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

const HISTORY_LIMIT = 40;
const CONTEXT_HISTORY_LIMIT = 20;

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatRepo: Repository<ChatMessage>,
    @InjectRepository(StudentProfile)
    private readonly studentsRepo: Repository<StudentProfile>,
    @InjectRepository(Document)
    private readonly documentsRepo: Repository<Document>,
    @InjectRepository(Application)
    private readonly applicationsRepo: Repository<Application>,
    private readonly groq: GroqService,
    private readonly access: AccessService,
  ) {}

  async listMessages(user: JwtPayload): Promise<ChatMessage[]> {
    return this.chatRepo.find({
      where: { userId: user.sub },
      order: { createdAt: 'ASC' },
      take: HISTORY_LIMIT,
    });
  }

  async clearMessages(user: JwtPayload): Promise<{ deleted: number }> {
    const result = await this.chatRepo.delete({ userId: user.sub });
    return { deleted: result.affected ?? 0 };
  }

  async sendMessage(
    user: JwtPayload,
    dto: SendChatMessageDto,
  ): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage }> {
    const userMessage = await this.chatRepo.save(
      this.chatRepo.create({
        userId: user.sub,
        role: 'user',
        content: dto.content.trim(),
      }),
    );

    const history = await this.chatRepo.find({
      where: { userId: user.sub },
      order: { createdAt: 'DESC' },
      take: CONTEXT_HISTORY_LIMIT,
    });
    history.reverse();

    const systemPrompt = await this.buildSystemPrompt(user, dto.studentId);
    const groqMessages: GroqChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })),
    ];

    const reply = await this.groq.chatCompletion(groqMessages);

    const assistantMessage = await this.chatRepo.save(
      this.chatRepo.create({
        userId: user.sub,
        role: 'assistant',
        content: reply,
      }),
    );

    return { userMessage, assistantMessage };
  }

  private async buildSystemPrompt(
    user: JwtPayload,
    requestedStudentId?: string,
  ): Promise<string> {
    const lines = [
      'You are Scholara Assistant, a helpful university admissions coach inside the Scholara demo app.',
      'Use only the factual context below. If something is missing, say you do not have that data.',
      'Do not invent universities, deadlines, document statuses, or decisions.',
      'Keep answers concise and actionable for a short supervisor demo.',
      `Caller: ${user.fullName} (${user.email}), role=${user.role}.`,
    ];

    if (user.role === UserRole.GUARDIAN) {
      lines.push(
        'The caller is a guardian with read-only access to one linked student.',
      );
    }

    if (user.role === UserRole.CONSULTANT && !requestedStudentId) {
      lines.push(
        'The caller is a consultant. No studentId was provided for this message, so answer generally about Scholara workflows (document review, 12-step applications, call notes). Ask which assigned student they mean when student-specific facts are needed.',
      );
      return lines.join('\n');
    }

    try {
      const studentId = await this.access.resolveReadableStudentId(
        user,
        requestedStudentId,
      );
      const context = await this.loadStudentContext(studentId);
      lines.push('Student context:', context);
    } catch {
      if (user.role === UserRole.CONSULTANT) {
        lines.push(
          'Could not load the requested student (not assigned or missing). Answer generally and ask for a valid assigned student.',
        );
      } else {
        lines.push('No student context could be loaded for this caller.');
      }
    }

    return lines.join('\n');
  }

  private async loadStudentContext(studentId: string): Promise<string> {
    const student = await this.studentsRepo.findOne({
      where: { id: studentId },
      relations: { user: true, consultant: { user: true } },
    });
    if (!student) {
      return 'Student not found.';
    }

    const [documents, applications] = await Promise.all([
      this.documentsRepo.find({
        where: { studentId },
        order: { updatedAt: 'DESC' },
      }),
      this.applicationsRepo.find({
        where: { studentId },
        relations: { university: true, program: true, steps: true },
        order: { updatedAt: 'DESC' },
      }),
    ]);

    const docLines = documents.map(
      (d) =>
        `- ${d.title} (${d.documentType}): ${d.status}${
          d.rejectionReason ? ` — ${d.rejectionReason}` : ''
        }`,
    );

    const appLines = applications.map((app) => {
      const completed =
        app.steps?.filter((s) => s.status === ApplicationStepStatus.COMPLETED)
          .length ?? 0;
      const total = app.steps?.length ?? 0;
      const deadlines = [
        app.feeDueDate ? `feeDue=${app.feeDueDate}` : null,
        app.meritListDate ? `meritList=${app.meritListDate}` : null,
      ]
        .filter(Boolean)
        .join(', ');
      return `- ${app.university.name} / ${app.program.name}: status=${app.status}, steps=${completed}/${total}${
        deadlines ? `, ${deadlines}` : ''
      }${app.decisionNotes ? `, notes=${app.decisionNotes}` : ''}`;
    });

    return [
      `Student: ${student.user.fullName} (${student.user.email})`,
      `Consultant: ${student.consultant?.user.fullName ?? 'unassigned'}`,
      'Documents:',
      ...(docLines.length ? docLines : ['- none']),
      'Applications:',
      ...(appLines.length ? appLines : ['- none']),
    ].join('\n');
  }
}
