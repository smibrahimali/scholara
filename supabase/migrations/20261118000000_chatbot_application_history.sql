-- Chatbot historical application and document fields.
-- Safe to run against an existing Scholara database: all new fields are nullable.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS intake_year integer,
  ADD COLUMN IF NOT EXISTS intake_term varchar(16),
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS fee_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrollment_confirmed_at timestamptz;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_applications_student_submitted
  ON applications (student_id, submitted_at);

CREATE INDEX IF NOT EXISTS idx_documents_student_uploaded
  ON documents (student_id, uploaded_at);
