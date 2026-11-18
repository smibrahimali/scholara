ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS waitlist_position integer,
  ADD COLUMN IF NOT EXISTS waitlist_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS application_status_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status applications_status_enum,
  to_status applications_status_enum NOT NULL,
  changed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_status_history_application_changed
  ON application_status_history (application_id, changed_at);
