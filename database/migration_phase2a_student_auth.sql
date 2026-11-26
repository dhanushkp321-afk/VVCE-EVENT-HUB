-- ============================================================================
-- VVCE Events Hub — Phase 2A: Two-Step Student Auth & @vvce.ac.in Enforcement
-- Run this idempotent migration in Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Support linking verified Google OAuth ID on user profile records
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS google_id TEXT;

DO $$
BEGIN
  IF to_regclass('public.registered_students') IS NOT NULL THEN
    ALTER TABLE public.registered_students
      ADD COLUMN IF NOT EXISTS google_id TEXT;
  END IF;
END $$;

-- 2. Database-level @vvce.ac.in institutional domain enforcement
CREATE OR REPLACE FUNCTION public.enforce_vvce_email_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NULL OR LOWER(TRIM(NEW.email)) !~ '^[a-z0-9._%+-]+@vvce\.ac\.in$' THEN
    RAISE EXCEPTION 'Only @vvce.ac.in institutional email addresses are permitted (received: %).', COALESCE(NEW.email, 'NULL')
      USING ERRCODE = 'check_violation';
  END IF;
  NEW.email := LOWER(TRIM(NEW.email));
  IF NEW.usn IS NOT NULL AND TRIM(NEW.usn) <> '' THEN
    NEW.usn := UPPER(TRIM(NEW.usn));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_vvce_email_users ON public.users;
CREATE TRIGGER trg_enforce_vvce_email_users
  BEFORE INSERT OR UPDATE OF email, usn ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_vvce_email_domain();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_users_vvce_email'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT chk_users_vvce_email
      CHECK (LOWER(TRIM(email)) ~ '^[a-z0-9._%+-]+@vvce\.ac\.in$') NOT VALID;
  END IF;
END $$;

-- Case-insensitive unique indexes on email and non-empty USN
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_ci
  ON public.users (LOWER(TRIM(email)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_usn_ci
  ON public.users (UPPER(TRIM(usn)))
  WHERE usn IS NOT NULL AND TRIM(usn) <> '';

-- Mirror constraints & indexes onto public.registered_students if present
DO $$
BEGIN
  IF to_regclass('public.registered_students') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_enforce_vvce_email_reg_students ON public.registered_students;
    CREATE TRIGGER trg_enforce_vvce_email_reg_students
      BEFORE INSERT OR UPDATE OF email, usn ON public.registered_students
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_vvce_email_domain();

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'chk_reg_students_vvce_email'
        AND conrelid = 'public.registered_students'::regclass
    ) THEN
      ALTER TABLE public.registered_students
        ADD CONSTRAINT chk_reg_students_vvce_email
        CHECK (LOWER(TRIM(email)) ~ '^[a-z0-9._%+-]+@vvce\.ac\.in$') NOT VALID;
    END IF;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_reg_students_email_ci
      ON public.registered_students (LOWER(TRIM(email)));

    CREATE UNIQUE INDEX IF NOT EXISTS idx_reg_students_usn_ci
      ON public.registered_students (UPPER(TRIM(usn)))
      WHERE usn IS NOT NULL AND TRIM(usn) <> '';
  END IF;
END $$;
