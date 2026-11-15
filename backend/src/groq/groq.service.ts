import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type GroqChatRole = 'system' | 'user' | 'assistant';

export interface GroqChatMessage {
  role: GroqChatRole;
  content: string;
}

interface GroqChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
}

@Injectable()
export class GroqService implements OnModuleInit {
  private readonly logger = new Logger(GroqService.name);
  private apiKey: string | null = null;
  private model = 'openai/gpt-oss-20b';
  private readonly endpoint = 'https://api.groq.com/openai/v1/chat/completions';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const key = this.config.get<string>('GROQ_API_KEY')?.trim();
    const model = this.config.get<string>('GROQ_MODEL')?.trim();

    if (!key || key.includes('your_')) {
      this.logger.warn(
        'Groq is not configured yet. Chat will be unavailable until GROQ_API_KEY is set.',
      );
      return;
    }

    this.apiKey = key;
    if (model) {
      this.model = model;
    }
    this.logger.log(`Groq client ready (model=${this.model})`);
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  private requireApiKey(): string {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'Groq is not configured. Set GROQ_API_KEY in the root .env.',
      );
    }
    return this.apiKey;
  }

  async chatCompletion(messages: GroqChatMessage[]): Promise<string> {
    const apiKey = this.requireApiKey();
    if (!messages.some((m) => m.content?.trim())) {
      throw new ServiceUnavailableException(
        'No message content to send to AI.',
      );
    }

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown network error';
      this.logger.error(`Groq request failed: ${message}`);
      throw new ServiceUnavailableException(
        'Could not reach Groq. Try again shortly.',
      );
    }

    const payload = await this.readJson<GroqChatCompletionResponse>(response);

    if (!response.ok) {
      const detail = payload.error?.message ?? `HTTP ${response.status}`;
      this.logger.error(`Groq API error: ${detail}`);
      throw new ServiceUnavailableException(
        'AI temporarily unavailable. Try again shortly.',
      );
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new ServiceUnavailableException('Groq returned an empty reply.');
    }
    return content;
  }

  async transcribeAudio(
    file: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<string> {
    const apiKey = this.requireApiKey();
    const form = new FormData();
    const bytes = new Uint8Array(file);
    form.append(
      'file',
      new Blob([bytes], { type: mimeType || 'audio/webm' }),
      filename || 'chunk.webm',
    );
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'json');
    form.append('temperature', '0');

    let response: Response;
    try {
      response = await fetch(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: form,
          signal: AbortSignal.timeout(30_000),
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown network error';
      this.logger.error(`Groq transcription failed: ${message}`);
      throw new ServiceUnavailableException(
        'Could not reach Groq transcription. Try again shortly.',
      );
    }

    const payload = await this.readJson<{
      text?: string;
      error?: { message?: string };
    }>(response);

    if (!response.ok) {
      const detail = payload.error?.message ?? `HTTP ${response.status}`;
      this.logger.error(`Groq transcription error: ${detail}`);
      throw new ServiceUnavailableException(
        'Speech transcription temporarily unavailable. Try again shortly.',
      );
    }

    const text = payload.text?.trim() ?? '';
    return text;
  }

  private async readJson<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid JSON body';
      this.logger.error(`Groq response parse failed: ${message}`);
      throw new ServiceUnavailableException(
        'AI temporarily unavailable. Try again shortly.',
      );
    }
  }
}
