-- Consultancy email log: inbound (uni → consultant) vs outbound (consultant → uni).
ALTER TABLE university_emails
  ADD COLUMN IF NOT EXISTS direction varchar(20) NOT NULL DEFAULT 'INBOUND';

UPDATE university_emails
SET direction = 'INBOUND'
WHERE direction IS NULL OR direction = '';
