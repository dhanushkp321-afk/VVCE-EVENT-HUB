-- DESTRUCTIVE: run manually in the Supabase SQL Editor only after backing up.
-- Removes every main-site event, app user, registered student and Supabase Auth
-- account (including CPM logins). This does not remove other authority records.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.registered_students') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.registered_students';
  END IF;
END
$$;

DELETE FROM public.events;
DELETE FROM public.users;
DELETE FROM auth.users;

-- Remove only the known built-in Dean fixture; preserve authorities configured
-- by administrators for the fresh test setup.
DELETE FROM public.approving_authorities
WHERE id = 'auth_dean_sw'
  AND name = 'Dean Student Welfare'
  AND lower(email) = 'dean.sw@vvce.ac.in';

COMMIT;
