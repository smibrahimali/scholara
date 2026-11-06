import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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

  getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase Storage is not configured');
    }
    return this.client;
  }
}
