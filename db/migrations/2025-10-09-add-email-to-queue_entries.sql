-- Migration: Add email column to queue_entries, enforce one submission per email, index and basic validation
-- Run in Supabase SQL editor.

BEGIN;

-- 1) Add email column (nullable initially)
ALTER TABLE public.queue_entries
ADD COLUMN IF NOT EXISTS email text;

-- 2) Basic check: length limits and simple presence of '@'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'queue_entries_email_length_check'
  ) THEN
    ALTER TABLE public.queue_entries
    ADD CONSTRAINT queue_entries_email_length_check CHECK (
      (email IS NULL) OR (char_length(email) >= 3 AND char_length(email) <= 254)
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'queue_entries_email_format_check'
  ) THEN
    ALTER TABLE public.queue_entries
    ADD CONSTRAINT queue_entries_email_format_check CHECK (
      (email IS NULL) OR (position('@' in email) > 1)
    );
  END IF;
END$$;

-- 3) Enforce one submission per email using a unique index (NULLs allowed)
CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_entries_email ON public.queue_entries((lower(email))) WHERE email IS NOT NULL;

-- 4) Add an index on status and ticket already exists in previous migrations but we keep safe
CREATE INDEX IF NOT EXISTS idx_queue_entries_status ON public.queue_entries USING btree (status);
CREATE INDEX IF NOT EXISTS idx_queue_entries_ticket ON public.queue_entries USING btree (ticket);

COMMIT;

-- Notes:
-- - After running, existing rows will have NULL email. New inserts must include a unique email per submitter.
-- - The application should validate email format client-side and handle unique constraint errors returned by Postgres/Supabase.
