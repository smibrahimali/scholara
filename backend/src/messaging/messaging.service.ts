import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UserRole } from '../common/enums';
import { JwtPayload } from '../auth/jwt-payload';
import { AccessService } from '../common/access.service';
import { StudentProfile } from '../students/student-profile.entity';
import { Conversation } from './conversation.entity';
import { DirectMessage } from './direct-message.entity';
import { ChatSession } from './chat-session.entity';
import { ChatRequestsService } from './chat-requests.service';

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepo: Repository<Conversation>,
    @InjectRepository(DirectMessage)
    private readonly messagesRepo: Repository<DirectMessage>,
    @InjectRepository(StudentProfile)
    private readonly studentsRepo: Repository<StudentProfile>,
    @InjectRepository(ChatSession)
    private readonly sessionsRepo: Repository<ChatSession>,
    private readonly access: AccessService,
    private readonly chatRequests: ChatRequestsService,
  ) {}

  private toMessageDto(message: DirectMessage) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      chatSessionId: message.chatSessionId,
      senderUserId: message.senderUserId,
      senderName: message.sender?.fullName ?? 'User',
      body: message.body,
      readAt: message.readAt,
      createdAt: message.createdAt,
    };
  }

  private toSessionDto(session: ChatSession) {
    return {
      id: session.id,
      studentId: session.studentId,
      consultantId: session.consultantId,
      conversationId: session.conversationId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      studentName: session.student?.user?.fullName ?? null,
      consultantName: session.consultant?.user?.fullName ?? null,
    };
  }

  private toConversationDto(
    conversation: Conversation,
    lastMessage?: DirectMessage | null,
  ) {
    return {
      id: conversation.id,
      studentId: conversation.studentId,
      consultantId: conversation.consultantId,
      studentName: conversation.student?.user?.fullName ?? null,
      consultantName: conversation.consultant?.user?.fullName ?? null,
      consultantTitle: conversation.consultant?.title ?? null,
      updatedAt: conversation.updatedAt,
      createdAt: conversation.createdAt,
      lastMessage: lastMessage ? this.toMessageDto(lastMessage) : null,
    };
  }

  async assertCanAccessConversation(
    user: JwtPayload,
    conversationId: string,
  ): Promise<Conversation> {
    const conversation = await this.conversationsRepo.findOne({
      where: { id: conversationId },
      relations: {
        student: { user: true },
        consultant: { user: true },
      },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (user.role === UserRole.STUDENT) {
      if (user.studentProfileId !== conversation.studentId) {
        throw new ForbiddenException('Cannot access this conversation');
      }
      return conversation;
    }

    if (user.role === UserRole.GUARDIAN) {
      if (user.linkedStudentId !== conversation.studentId) {
        throw new ForbiddenException('Cannot access this conversation');
      }
      return conversation;
    }

    if (user.role === UserRole.CONSULTANT) {
      if (!user.consultantProfileId) {
        throw new ForbiddenException('Consultant profile missing');
      }
      await this.access.assertConsultantOwnsStudent(
        user.consultantProfileId,
        conversation.studentId,
      );
      return conversation;
    }

    throw new ForbiddenException('Unsupported role');
  }

  async getOrCreateConversation(user: JwtPayload, studentId?: string) {
    if (user.role === UserRole.GUARDIAN) {
      throw new ForbiddenException(
        'Guardians can view messages but open via linked student',
      );
    }

    let resolvedStudentId: string;

    if (user.role === UserRole.STUDENT) {
      if (!user.studentProfileId) {
        throw new ForbiddenException('Student profile missing');
      }
      resolvedStudentId = user.studentProfileId;
    } else if (user.role === UserRole.CONSULTANT) {
      if (!studentId) {
        throw new BadRequestException('studentId is required for consultants');
      }
      if (!user.consultantProfileId) {
        throw new ForbiddenException('Consultant profile missing');
      }
      await this.access.assertConsultantOwnsStudent(
        user.consultantProfileId,
        studentId,
      );
      resolvedStudentId = studentId;
    } else {
      throw new ForbiddenException('Unsupported role');
    }

    const student = await this.studentsRepo.findOne({
      where: { id: resolvedStudentId },
      relations: { user: true, consultant: { user: true } },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (!student.consultantId) {
      throw new BadRequestException('Student has no assigned consultant');
    }

    let conversation = await this.conversationsRepo.findOne({
      where: { studentId: resolvedStudentId },
      relations: {
        student: { user: true },
        consultant: { user: true },
      },
    });

    if (!conversation) {
      conversation = await this.conversationsRepo.save(
        this.conversationsRepo.create({
          studentId: resolvedStudentId,
          consultantId: student.consultantId,
        }),
      );
      conversation = await this.conversationsRepo.findOneOrFail({
        where: { id: conversation.id },
        relations: {
          student: { user: true },
          consultant: { user: true },
        },
      });
    } else if (conversation.consultantId !== student.consultantId) {
      conversation.consultantId = student.consultantId;
      await this.conversationsRepo.save(conversation);
      conversation = await this.conversationsRepo.findOneOrFail({
        where: { id: conversation.id },
        relations: {
          student: { user: true },
          consultant: { user: true },
        },
      });
    }

    const lastMessage = await this.messagesRepo.findOne({
      where: { conversationId: conversation.id },
      relations: { sender: true },
      order: { createdAt: 'DESC' },
    });

    return this.toConversationDto(conversation, lastMessage);
  }

  async listConversations(user: JwtPayload) {
    if (user.role === UserRole.CONSULTANT) {
      if (!user.consultantProfileId) {
        throw new ForbiddenException('Consultant profile missing');
      }
      const conversations = await this.conversationsRepo.find({
        where: { consultantId: user.consultantProfileId },
        relations: {
          student: { user: true },
          consultant: { user: true },
        },
        order: { updatedAt: 'DESC' },
      });

      const items = [];
      for (const conversation of conversations) {
        const lastMessage = await this.messagesRepo.findOne({
          where: { conversationId: conversation.id },
          relations: { sender: true },
          order: { createdAt: 'DESC' },
        });
        items.push(this.toConversationDto(conversation, lastMessage));
      }
      return items;
    }

    if (user.role === UserRole.STUDENT) {
      const conversation = await this.getOrCreateConversation(user);
      return [conversation];
    }

    if (user.role === UserRole.GUARDIAN) {
      if (!user.linkedStudentId) {
        return [];
      }
      const existing = await this.conversationsRepo.findOne({
        where: { studentId: user.linkedStudentId },
        relations: {
          student: { user: true },
          consultant: { user: true },
        },
      });
      if (!existing) return [];
      const lastMessage = await this.messagesRepo.findOne({
        where: { conversationId: existing.id },
        relations: { sender: true },
        order: { createdAt: 'DESC' },
      });
      return [this.toConversationDto(existing, lastMessage)];
    }

    throw new ForbiddenException('Unsupported role');
  }

  async listMessages(
    user: JwtPayload,
    conversationId: string,
    limit = 50,
    before?: string,
  ) {
    const conversation = await this.assertCanAccessConversation(
      user,
      conversationId,
    );

    const open = await this.sessionsRepo.findOne({
      where: {
        studentId: conversation.studentId,
        endedAt: IsNull(),
      },
    });
    if (!open) {
      return [];
    }

    const take = Math.min(Math.max(limit, 1), 100);
    const qb = this.messagesRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .where('m.conversation_id = :conversationId', { conversationId })
      .andWhere('m.chat_session_id = :sessionId', { sessionId: open.id })
      .orderBy('m.created_at', 'DESC')
      .take(take);

    if (before) {
      const pivot = await this.messagesRepo.findOne({ where: { id: before } });
      if (pivot) {
        qb.andWhere('m.created_at < :before', { before: pivot.createdAt });
      }
    }

    const rows = await qb.getMany();
    return rows.reverse().map((row) => this.toMessageDto(row));
  }

  async sendMessage(user: JwtPayload, conversationId: string, body: string) {
    if (user.role === UserRole.GUARDIAN) {
      throw new ForbiddenException('Guardians cannot send messages');
    }

    const conversation = await this.assertCanAccessConversation(
      user,
      conversationId,
    );

    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException('Message body is required');
    }

    if (user.role === UserRole.CONSULTANT) {
      if (!user.consultantProfileId) {
        throw new ForbiddenException('Consultant profile missing');
      }
      if (conversation.consultantId !== user.consultantProfileId) {
        throw new ForbiddenException('Not the assigned consultant');
      }
    }

    if (user.role === UserRole.STUDENT) {
      if (user.studentProfileId !== conversation.studentId) {
        throw new ForbiddenException('Cannot message this conversation');
      }
    }

    const open = await this.sessionsRepo.findOne({
      where: {
        studentId: conversation.studentId,
        endedAt: IsNull(),
      },
      order: { startedAt: 'DESC' },
    });
    if (!open) {
      throw new BadRequestException(
        'No open encrypted chat. Schedule a 1:1 chat and wait for your consultant to start it.',
      );
    }

    const saved = await this.messagesRepo.save(
      this.messagesRepo.create({
        conversationId,
        chatSessionId: open.id,
        senderUserId: user.sub,
        body: trimmed,
        readAt: null,
      }),
    );

    conversation.updatedAt = new Date();
    await this.conversationsRepo.save(conversation);

    const withSender = await this.messagesRepo.findOneOrFail({
      where: { id: saved.id },
      relations: { sender: true },
    });

    return this.toMessageDto(withSender);
  }

  async markRead(user: JwtPayload, conversationId: string) {
    await this.assertCanAccessConversation(user, conversationId);

    await this.messagesRepo
      .createQueryBuilder()
      .update(DirectMessage)
      .set({ readAt: () => 'NOW()' })
      .where('conversation_id = :conversationId', { conversationId })
      .andWhere('sender_user_id != :userId', { userId: user.sub })
      .andWhere('read_at IS NULL')
      .execute();

    return { ok: true };
  }

  async getOpenSession(user: JwtPayload, studentId?: string) {
    const resolvedStudentId = await this.access.resolveReadableStudentId(
      user,
      studentId,
    );

    const session = await this.sessionsRepo.findOne({
      where: {
        studentId: resolvedStudentId,
        endedAt: IsNull(),
      },
      relations: {
        student: { user: true },
        consultant: { user: true },
      },
      order: { startedAt: 'DESC' },
    });

    return session ? this.toSessionDto(session) : null;
  }

  async startSession(user: JwtPayload, chatRequestId: string) {
    const request = await this.chatRequests.requireApprovedForStart(
      user,
      chatRequestId,
    );

    const open = await this.sessionsRepo.findOne({
      where: {
        studentId: request.studentId,
        endedAt: IsNull(),
      },
    });
    if (open) {
      throw new BadRequestException(
        'An encrypted chat is already open for this student. End it before starting another.',
      );
    }

    const conversation = await this.getOrCreateConversation(
      user,
      request.studentId,
    );

    const session = await this.sessionsRepo.save(
      this.sessionsRepo.create({
        studentId: request.studentId,
        consultantId: user.consultantProfileId!,
        conversationId: conversation.id,
        startedAt: new Date(),
        endedAt: null,
      }),
    );

    try {
      await this.chatRequests.attachSession(request.id, session.id);
    } catch (error) {
      await this.sessionsRepo.delete(session.id);
      throw error;
    }

    const loaded = await this.sessionsRepo.findOneOrFail({
      where: { id: session.id },
      relations: {
        student: { user: true },
        consultant: { user: true },
      },
    });

    return this.toSessionDto(loaded);
  }

  async endSession(user: JwtPayload, sessionId: string) {
    if (user.role !== UserRole.CONSULTANT || !user.consultantProfileId) {
      throw new ForbiddenException('Only consultants can end encrypted chats');
    }

    const session = await this.sessionsRepo.findOne({
      where: { id: sessionId },
      relations: {
        student: { user: true },
        consultant: { user: true },
      },
    });
    if (!session) {
      throw new NotFoundException('Chat session not found');
    }
    if (session.consultantId !== user.consultantProfileId) {
      throw new ForbiddenException('Not your chat session');
    }
    await this.access.assertConsultantOwnsStudent(
      user.consultantProfileId,
      session.studentId,
    );

    if (session.endedAt) {
      return this.toSessionDto(session);
    }

    await this.messagesRepo.delete({ chatSessionId: session.id });
    session.endedAt = new Date();
    await this.sessionsRepo.save(session);
    await this.chatRequests.completeBySessionId(session.id);

    return this.toSessionDto(
      await this.sessionsRepo.findOneOrFail({
        where: { id: session.id },
        relations: {
          student: { user: true },
          consultant: { user: true },
        },
      }),
    );
  }
}
