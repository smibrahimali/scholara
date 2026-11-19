import { ServiceUnavailableException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { UserRole } from '../common/enums';
import { JwtPayload } from '../auth/jwt-payload';

describe('ChatService Groq ordering (P1-3)', () => {
  const chatRepo = {
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((v: unknown) => v),
  };
  const studentsRepo = {};
  const documentsRepo = {};
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
    applicationsRepo.find.mockResolvedValue([]);
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

  it('does not persist a user message when Groq fails', async () => {
    groq.chatCompletion.mockRejectedValue(
      new ServiceUnavailableException(
        'AI temporarily unavailable. Try again shortly.',
      ),
    );

    await expect(
      service.sendMessage(student, { content: 'hello' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(chatRepo.save).not.toHaveBeenCalled();
  });

  it('persists both turns only after Groq succeeds', async () => {
    groq.chatCompletion.mockResolvedValue('hi there');
    chatRepo.save
      .mockResolvedValueOnce({
        id: 'm1',
        role: 'user',
        content: 'hello',
        userId: student.sub,
      })
      .mockResolvedValueOnce({
        id: 'm2',
        role: 'assistant',
        content: 'hi there',
        userId: student.sub,
      });

    const result = await service.sendMessage(student, { content: 'hello' });
    expect(groq.chatCompletion).toHaveBeenCalled();
    expect(chatRepo.save).toHaveBeenCalledTimes(2);
    expect(result.assistantMessage.content).toBe('hi there');
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
});
