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
  const applicationsRepo = {};
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
    service = new ChatService(
      chatRepo as never,
      studentsRepo as never,
      documentsRepo as never,
      applicationsRepo as never,
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
});
