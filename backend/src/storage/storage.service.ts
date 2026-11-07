import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/** Storage-only Supabase client. DB access goes through TypeORM. */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: SupabaseClient | null = null;
  readonly bucket = 'student-documents';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (
      !url ||
      !key ||
      url.includes('your_') ||
      key.includes('your_') ||
      url.includes('YOUR_PROJECT')
    ) {
      this.logger.warn(
        'Supabase Storage is not configured yet. Document file upload will be unavailable until SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.',
      );
      return;
    }

    this.client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    this.logger.log('Supabase Storage client ready');
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }
    return this.client;
  }

  async uploadObject(
    path: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    const client = this.requireClient();
    const { error } = await client.storage.from(this.bucket).upload(path, body, {
      contentType,
      upsert: true,
    });
    if (error) {
      this.logger.error(`Storage upload failed: ${error.message}`);
      throw new ServiceUnavailableException(
        `Could not upload file to storage: ${error.message}`,
      );
    }
    return path;
  }

  async createSignedUrl(
    path: string,
    expiresInSeconds = 60 * 10,
  ): Promise<string> {
    const client = this.requireClient();
    const { data, error } = await client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) {
      const message = error?.message ?? 'no url returned';
      this.logger.error(`Signed URL failed: ${message}`);
      const missing =
        /not found|does not exist|404|Object not found/i.test(message) ||
        !data?.signedUrl;
      if (missing) {
        throw new ServiceUnavailableException({
          code: 'STORAGE_OBJECT_MISSING',
          message: 'File is missing from storage.',
        });
      }
      throw new ServiceUnavailableException(
        'Could not create a download link for this file.',
      );
    }
    return data.signedUrl;
  }

  /** Returns false when the object is gone or cannot be read. */
  async objectExists(path: string): Promise<boolean> {
    if (!this.client || !path) return false;
    const folder = path.includes('/')
      ? path.slice(0, path.lastIndexOf('/'))
      : '';
    const name = path.includes('/')
      ? path.slice(path.lastIndexOf('/') + 1)
      : path;
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(folder, { search: name, limit: 20 });
    if (error) {
      this.logger.warn(`Storage list failed: ${error.message}`);
      return false;
    }
    return (data ?? []).some((item) => item.name === name);
  }

  async removeObject(path: string): Promise<void> {
    if (!this.client || !path) return;
    const { error } = await this.client.storage.from(this.bucket).remove([path]);
    if (error) {
      this.logger.warn(`Storage remove skipped: ${error.message}`);
    }
  }
}
