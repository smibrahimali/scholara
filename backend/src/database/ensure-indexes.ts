import { DataSource } from 'typeorm';

/** Idempotent indexes for hot FK filters (production has synchronize: false). */
export async function ensureHotIndexes(dataSource: DataSource): Promise<void> {
  const statements = [
    `CREATE INDEX IF NOT EXISTS idx_student_profiles_consultant_id ON student_profiles (consultant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_documents_student_id ON documents (student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_documents_student_status ON documents (student_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_applications_student_id ON applications (student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_application_steps_application_id ON application_steps (application_id)`,
    `CREATE INDEX IF NOT EXISTS idx_call_sessions_student_id ON call_sessions (student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_call_sessions_student_ended ON call_sessions (student_id, ended_at)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_sessions_student_id ON chat_sessions (student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_sessions_student_ended ON chat_sessions (student_id, ended_at)`,
    `CREATE INDEX IF NOT EXISTS idx_call_requests_consultant_status ON call_requests (consultant_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_call_requests_student_status ON call_requests (student_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_requests_consultant_status ON chat_requests (consultant_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_requests_student_status ON chat_requests (student_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON chat_messages (user_id, created_at)`,
  ];

  for (const sql of statements) {
    await dataSource.query(sql);
  }
}
