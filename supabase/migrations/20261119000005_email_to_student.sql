-- Student-facing email log: consultant → student only.
UPDATE university_emails
SET direction = 'TO_STUDENT'
WHERE direction IS NULL
   OR direction IN ('INBOUND', 'OUTBOUND', '');

ALTER TABLE university_emails
  ALTER COLUMN direction SET DEFAULT 'TO_STUDENT';
