import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { UserRole } from '../common/enums';
import { JwtPayload } from '../auth/jwt-payload';

describe('ChatService Groq ordering (P1-3)', () => {
  const chatRepo = {
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((v: unknown) => v),
    delete: jest.fn(),
  };
  const studentsRepo = { find: jest.fn(), findOne: jest.fn() };
  const documentsRepo = { find: jest.fn() };
  const applicationsRepo = { find: jest.fn() };
  const groq = {
    chatCompletion: jest.fn(),
  };
  const access = {
    resolveReadableStudentId: jest.fn().mockResolvedValue('student-1'),
  };

  let service: ChatService;

  beforeEach(() => {
    jest.clearAllMocks();
    chatRepo.find.mockResolvedValue([]);
    chatRepo.delete.mockResolvedValue({ affected: 0 });
    applicationsRepo.find.mockResolvedValue([]);
    documentsRepo.find.mockResolvedValue([]);
    studentsRepo.find.mockResolvedValue([]);
    studentsRepo.findOne.mockResolvedValue(null);
    service = new ChatService(
      chatRepo as never,
      studentsRepo as never,
      documentsRepo as never,
      applicationsRepo as never,
      {} as never,
      groq as never,
      access as never,
    );
  });

  const student: JwtPayload = {
    sub: 'user-student',
    email: 'student@scholara.demo',
    fullName: 'Ali Raza',
    role: UserRole.STUDENT,
    studentProfileId: 'student-1',
  };

  const consultant: JwtPayload = {
    sub: 'user-consultant',
    email: 'consultant1@scholara.demo',
    fullName: 'Sara Ahmed',
    role: UserRole.CONSULTANT,
    consultantProfileId: 'consultant-1',
  };

  it('does not persist a user message when Groq fails', async () => {
    groq.chatCompletion.mockRejectedValue(
      new ServiceUnavailableException(
        'AI temporarily unavailable. Try again shortly.',
      ),
    );

    await expect(
      service.sendMessage(student, {
        content: 'What documents am I missing?',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(chatRepo.save).not.toHaveBeenCalled();
  });

  it('persists both turns only after Groq succeeds', async () => {
    groq.chatCompletion.mockResolvedValue('You are missing a passport photo.');
    chatRepo.save
      .mockResolvedValueOnce({
        id: 'm1',
        role: 'user',
        content: 'What documents am I missing?',
        userId: student.sub,
        contextStudentId: 'student-1',
      })
      .mockResolvedValueOnce({
        id: 'm2',
        role: 'assistant',
        content: 'You are missing a passport photo.',
        userId: student.sub,
        contextStudentId: 'student-1',
      });

    const result = await service.sendMessage(student, {
      content: 'What documents am I missing?',
    });
    expect(groq.chatCompletion).toHaveBeenCalled();
    expect(chatRepo.save).toHaveBeenCalledTimes(2);
    expect(result.assistantMessage.content).toContain('passport');
    expect(chatRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ contextStudentId: 'student-1' }),
    );
  });

  it('answers greetings without calling Groq', async () => {
    chatRepo.save.mockImplementation(async (row: unknown) => row);

    const result = await service.sendMessage(student, { content: 'hello' });
    expect(groq.chatCompletion).not.toHaveBeenCalled();
    expect(result.assistantMessage.content).toContain('Ali');
    expect(result.assistantMessage.content).toContain('[[SUGGESTIONS:');
  });

  it('answers end-chat without calling Groq', async () => {
    chatRepo.save.mockImplementation(async (row: unknown) => row);

    const result = await service.sendMessage(student, {
      content: 'end this chat',
    });
    expect(groq.chatCompletion).not.toHaveBeenCalled();
    expect(result.assistantMessage.content).toContain('[[END_CHAT]]');
  });

  it('answers university-specific submission dates without Groq', async () => {
    applicationsRepo.find.mockResolvedValue([
      {
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        submittedAt: new Date('2026-09-28T00:00:00.000Z'),
        university: { name: 'Khalifa University' },
        program: { name: 'BS Computer Science' },
      },
      {
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
        submittedAt: new Date('2026-10-14T00:00:00.000Z'),
        university: { name: 'Qatar University' },
        program: { name: 'BS Computer Science' },
      },
    ]);
    chatRepo.save
      .mockResolvedValueOnce({ role: 'user' })
      .mockResolvedValueOnce({
        role: 'assistant',
        content:
          'You submitted your Khalifa University application for BS Computer Science on 2026-09-28.',
      });

    const result = await service.sendMessage(student, {
      content: 'When did I apply to Khalifa University?',
    });

    expect(result.assistantMessage.content).toContain('Khalifa University');
    expect(result.assistantMessage.content).toContain('2026-09-28');
    expect(groq.chatCompletion).not.toHaveBeenCalled();
  });

  it('does not treat an acceptance question as a submission-date lookup', async () => {
    groq.chatCompletion.mockResolvedValue('The decision date is not recorded.');
    chatRepo.save
      .mockResolvedValueOnce({ role: 'user' })
      .mockResolvedValueOnce({
        role: 'assistant',
        content: 'The decision date is not recorded.',
      });

    await service.sendMessage(student, {
      content: 'When was my Khalifa University application accepted?',
    });

    expect(groq.chatCompletion).toHaveBeenCalled();
  });

  it('shortens verbose Groq replies and fixes application-fee wording', async () => {
    groq.chatCompletion.mockResolvedValue(
      [
        'Your Khalifa University application was accepted, but enrollment is blocked until the AED 45,000 application fee is verified by the finance office.',
        'The fee receipt you uploaded on 2026-11-10 is still under review (last reviewed 2026-11-11).',
        'Once that review is complete, you will receive confirmation to proceed with enrollment and then we can also talk about waitlists and Qatar.',
        '[[NAVIGATE:/app/applications|Open Applications]]',
      ].join(' '),
    );
    chatRepo.save.mockImplementation(async (row: unknown) => row);

    const result = await service.sendMessage(student, {
      content: 'You said my application was approved. When do I enroll?',
    });

    expect(result.assistantMessage.content).toMatch(/enrollment\/offer fee/i);
    expect(result.assistantMessage.content).not.toMatch(/application fee/i);
    expect(result.assistantMessage.content).toContain(
      '[[NAVIGATE:/app/applications|Open Applications]]',
    );
    const body = result.assistantMessage.content
      .replace(/\[\[[^\]]*\]\]/g, '')
      .trim();
    expect(body.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(40);
    expect(body).not.toMatch(/last reviewed/i);
  });

  it('does not treat enroll questions as document-date lookups', async () => {
    documentsRepo.find.mockResolvedValue([
      {
        title: 'Qatar University Application Form',
        documentType: 'APP_FORM',
        status: 'VERIFIED',
        verifiedAt: new Date('2026-10-13T00:00:00.000Z'),
      },
    ]);
    groq.chatCompletion.mockResolvedValue(
      'Enrollment waits on fee verification in your Scholara record.',
    );
    chatRepo.save.mockImplementation(async (row: unknown) => row);

    const result = await service.sendMessage(student, {
      content: 'You said my application was approved. When do I enroll?',
    });

    expect(groq.chatCompletion).toHaveBeenCalled();
    expect(result.assistantMessage.content).not.toMatch(/Application Form was verified/i);
  });

  it('says Rejected when asked for a verified date on a rejected document', async () => {
    documentsRepo.find.mockResolvedValue([
      {
        title: 'Official Academic Transcript',
        documentType: 'TRANSCRIPT',
        status: 'REJECTED',
        verifiedAt: null,
        rejectedAt: new Date('2026-11-07T09:30:00.000Z'),
        rejectionReason: 'Blurred scan; seal not legible.',
      },
    ]);
    chatRepo.save.mockImplementation(async (row: unknown) => row);

    const result = await service.sendMessage(student, {
      content: 'When was my Official Academic Transcript verified?',
    });

    expect(groq.chatCompletion).not.toHaveBeenCalled();
    expect(result.assistantMessage.content).toMatch(/Rejected/i);
    expect(result.assistantMessage.content).toContain('2026-11-07');
    expect(result.assistantMessage.content).toMatch(/Blurred scan/i);
  });

  it('falls through to Groq when consultant desk asks date without studentId', async () => {
    access.resolveReadableStudentId.mockRejectedValue(
      new ForbiddenException('studentId is required for consultants'),
    );
    groq.chatCompletion.mockResolvedValue(
      'Open a student dossier for application dates.',
    );
    chatRepo.save
      .mockResolvedValueOnce({ role: 'user', contextStudentId: null })
      .mockResolvedValueOnce({
        role: 'assistant',
        content: 'Open a student dossier for application dates.',
      });

    const result = await service.sendMessage(consultant, {
      content: 'When did the student apply to Khalifa University?',
    });

    expect(result.assistantMessage.content).toContain('dossier');
    expect(groq.chatCompletion).toHaveBeenCalled();
    expect(chatRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ contextStudentId: null }),
    );
  });

  it('rejects persist after clear during a direct-answer path', async () => {
    access.resolveReadableStudentId.mockResolvedValue('student-1');
    let releaseFind!: (rows: unknown[]) => void;
    applicationsRepo.find.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseFind = resolve;
        }),
    );

    const sendPromise = service.sendMessage(student, {
      content: 'When did I apply to Khalifa University?',
    });
    // Clear while the date lookup is still awaiting DB.
    await service.clearMessages(student);
    releaseFind([
      {
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        submittedAt: new Date('2026-09-28T00:00:00.000Z'),
        university: { name: 'Khalifa University' },
        program: { name: 'BS Computer Science' },
      },
    ]);

    await expect(sendPromise).rejects.toBeInstanceOf(BadRequestException);
    expect(chatRepo.save).not.toHaveBeenCalled();
  });

  it('rate-limits excessive sends from one user', async () => {
    groq.chatCompletion.mockResolvedValue('ok');
    chatRepo.save.mockImplementation(async (row: unknown) => row);

    for (let i = 0; i < 20; i += 1) {
      await service.sendMessage(student, { content: `ping ${i}` });
    }

    await expect(
      service.sendMessage(student, { content: 'one too many' }),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
