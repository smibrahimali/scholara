ALTER TABLE university_emails
  ADD COLUMN IF NOT EXISTS student_reply text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz;
