-- Scope assistant history per dossier so consultants do not mix students.
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS context_student_id uuid;

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_context_created
  ON chat_messages (user_id, context_student_id, created_at DESC);
