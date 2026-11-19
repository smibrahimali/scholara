DO $$ BEGIN
  CREATE TYPE student_payments_category_enum AS ENUM (
    'CONSULTANT',
    'UNIVERSITY',
    'APPLICATION',
    'DOCUMENT',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE student_payments_status_enum AS ENUM (
    'PAID',
    'UPCOMING'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS student_payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
  title varchar(160) NOT NULL,
  description text,
  category student_payments_category_enum NOT NULL,
  status student_payments_status_enum NOT NULL,
  amount numeric(12, 2) NOT NULL,
  currency varchar(8) NOT NULL DEFAULT 'USD',
  occurred_on date NOT NULL,
  payee_label varchar(160),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_payments_student_id
  ON student_payments (student_id);

CREATE INDEX IF NOT EXISTS idx_student_payments_student_status_date
  ON student_payments (student_id, status, occurred_on);
