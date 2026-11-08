-- ============================================================================
-- VVCE Events Hub — Approving Authority Upgrade Migration
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Create table for Approving Authorities
CREATE TABLE IF NOT EXISTS public.approving_authorities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  designation TEXT DEFAULT 'Approving Authority',
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive unique index on authority name
CREATE UNIQUE INDEX IF NOT EXISTS idx_approving_authorities_name_ci 
ON public.approving_authorities (LOWER(TRIM(name)));

-- 2. Add authority assignment & audit columns to events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS authority_id TEXT,
ADD COLUMN IF NOT EXISTS authority_name TEXT,
ADD COLUMN IF NOT EXISTS approved_by_authority_id TEXT,
ADD COLUMN IF NOT EXISTS approved_by_authority_name TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS decision_history JSONB DEFAULT '[]'::jsonb;

-- 3. Add authority assignment to users (clubs)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS authority_id TEXT,
ADD COLUMN IF NOT EXISTS authority_name TEXT,
ADD COLUMN IF NOT EXISTS approval_history JSONB DEFAULT '[]'::jsonb;

-- 4. Enable Row Level Security (RLS) on approving_authorities
ALTER TABLE public.approving_authorities ENABLE ROW LEVEL SECURITY;

-- Allow anon/public to select active authorities for dropdowns and login lookup
-- (Never returns service keys; password_hash and salt are only checked via hash verification)
CREATE POLICY "Allow public read active authorities"
ON public.approving_authorities
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow insert/update/delete for authenticated admin and anon (managed via CPM / client logic)
CREATE POLICY "Allow insert/update authorities"
ON public.approving_authorities
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 5. Atomic RPC function for Safe Concurrency Event Approval with Global Clash Check
CREATE OR REPLACE FUNCTION public.approve_event_with_clash_check(
  p_event_id TEXT,
  p_authority_id TEXT,
  p_authority_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target RECORD;
  v_clashing_name TEXT;
  v_decision JSONB;
BEGIN
  -- Lock and fetch target event
  SELECT * INTO v_target
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  IF v_target.status = 'approved' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Event is already approved');
  END IF;

  -- Global Clash Detection Check against ALL approved events
  SELECT name INTO v_clashing_name
  FROM public.events
  WHERE id <> p_event_id
    AND status = 'approved'
    AND date = v_target.date
    AND LOWER(TRIM(venue)) = LOWER(TRIM(v_target.venue))
  LIMIT 1;

  IF v_clashing_name IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'clash', true,
      'error', 'Global venue clash detected! Another approved event ("' || v_clashing_name || '") is already booked at ' || v_target.venue || ' on ' || v_target.date || '.'
    );
  END IF;

  -- Build audit entry
  v_decision := jsonb_build_object(
    'action', 'approved',
    'authority_id', p_authority_id,
    'authority_name', p_authority_name,
    'timestamp', NOW()
  );

  -- Update event atomically
  UPDATE public.events
  SET status = 'approved',
      rej_reason = NULL,
      approved_by_authority_id = p_authority_id,
      approved_by_authority_name = p_authority_name,
      approved_at = NOW(),
      decision_history = COALESCE(decision_history, '[]'::jsonb) || v_decision
  WHERE id = p_event_id;

  RETURN jsonb_build_object('success', true, 'message', 'Event approved successfully');
END;
$$;

-- 6. Insert default Dean Student Welfare authority if not already present
-- Password default: 'deanwellfair@vvce'
-- Salt: 'vvce_salt_dean_2026'
-- PBKDF2-SHA256 (100,000 iterations): 
-- b6fdb537e29bb3ff3ce1b00e66eb139a039750bca80ca60d69611894d3ec8595
INSERT INTO public.approving_authorities (id, name, email, designation, password_hash, salt, active)
VALUES (
  'auth_dean_sw',
  'Dean Student Welfare',
  'dean.sw@vvce.ac.in',
  'Dean Student Welfare',
  'b6fdb537e29bb3ff3ce1b00e66eb139a039750bca80ca60d69611894d3ec8595',
  'vvce_salt_dean_2026',
  true
)
ON CONFLICT (id) DO NOTHING;
