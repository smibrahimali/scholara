-- Link documents to an application for university-specific paperwork.
-- application_id NULL = general student document (Civil ID, transcript, photo, etc.).

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES applications(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_documents_application_id
  ON documents (application_id);

CREATE INDEX IF NOT EXISTS idx_documents_student_application
  ON documents (student_id, application_id);
