import { ServiceUnavailableException } from '@nestjs/common';
import { GroqService } from './groq.service';

describe('GroqService safe errors (P1-4)', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'GROQ_API_KEY') return 'gsk_test_key';
      if (key === 'GROQ_MODEL') return 'openai/gpt-oss-20b';
      return undefined;
    }),
  };

  let service: GroqService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GroqService(config as never);
    service.onModuleInit();
  });

  it('returns a generic message when Groq chat API fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () =>
        Promise.resolve({ error: { message: 'Invalid API Key secret-xyz' } }),
    }) as never;

    await expect(
      service.chatCompletion([{ role: 'user', content: 'hi' }]),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    try {
      await service.chatCompletion([{ role: 'user', content: 'hi' }]);
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(String((error as Error).message)).not.toContain('secret-xyz');
      expect(String((error as Error).message)).not.toContain('Invalid API Key');
      expect(String((error as Error).message)).toContain(
        'AI temporarily unavailable',
      );
    }
  });

  it('throws when GROQ_API_KEY is missing', async () => {
    const bare = new GroqService({
      get: () => undefined,
    } as never);
    bare.onModuleInit();
    await expect(
      bare.chatCompletion([{ role: 'user', content: 'hi' }]),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps malformed JSON responses to ServiceUnavailableException', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('Unexpected token')),
    }) as never;

    await expect(
      service.chatCompletion([{ role: 'user', content: 'hi' }]),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
