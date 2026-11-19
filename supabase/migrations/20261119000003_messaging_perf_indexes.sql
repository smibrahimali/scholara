-- Performance indexes for messaging, emails, and document reviews.
-- Safe / idempotent for demo + production (synchronize: false).

CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created
  ON direct_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_consultant_id
  ON conversations (consultant_id);

CREATE INDEX IF NOT EXISTS idx_university_emails_application_id
  ON university_emails (application_id);

CREATE INDEX IF NOT EXISTS idx_document_reviews_document_id
  ON document_reviews (document_id);
