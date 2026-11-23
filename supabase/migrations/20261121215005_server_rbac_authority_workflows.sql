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

-- Server-maintained CPM administrators. Roles and authority assignments are never
-- selected by the browser; they are granted only against this auth.users mapping.
CREATE TABLE IF NOT EXISTS public.cpm_admin_members (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'event_manager', 'content_manager', 'analytics_viewer')),
  authority_id TEXT REFERENCES public.approving_authorities(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS approval_history JSONB DEFAULT '[]'::jsonb;

-- 4. Enable Row Level Security (RLS) on approving_authorities
ALTER TABLE public.approving_authorities ENABLE ROW LEVEL SECURITY;

-- Authorities are readable only to authenticated users. CPM no longer performs
-- client-side password verification or role lookup.
DROP POLICY IF EXISTS "Allow public read active authorities" ON public.approving_authorities;
CREATE POLICY "Authenticated users can read authorities"
ON public.approving_authorities
FOR SELECT
TO authenticated
USING (true);

ALTER TABLE public.cpm_admin_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CPM members read own mapping" ON public.cpm_admin_members;
CREATE POLICY "CPM members read own mapping"
ON public.cpm_admin_members
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.get_cpm_admin_session()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN jsonb_build_object('active', false)
    ELSE COALESCE(
      (SELECT jsonb_build_object(
        'active', m.active,
        'role', m.role,
        'authority_id', m.authority_id,
        'authority_name', aa.name
       )
       FROM public.cpm_admin_members m
       LEFT JOIN public.approving_authorities aa ON aa.id = m.authority_id
       WHERE m.user_id = auth.uid() AND m.active = true),
      jsonb_build_object('active', false)
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cpm_admin_session() TO authenticated;

-- 5. Atomic RPC function for Safe Concurrency Event Approval with Global Clash Check
CREATE OR REPLACE FUNCTION public.approve_event_with_clash_check(
  p_event_id TEXT,
  p_authority_id TEXT,
  p_authority_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_target RECORD;
  v_clashing_name TEXT;
  v_decision JSONB;
  v_authority RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authenticated CPM session required');
  END IF;
  PERFORM set_config('vvce.authority_rpc', 'on', true);

  SELECT aa.* INTO v_authority
  FROM public.cpm_admin_members m
  JOIN public.approving_authorities aa ON aa.id = m.authority_id
  WHERE m.user_id = auth.uid()
    AND m.active = TRUE
    AND aa.active = TRUE
    AND m.role IN ('super_admin', 'event_manager');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is not an active event approving authority');
  END IF;

  p_authority_id := v_authority.id;
  p_authority_name := v_authority.name;

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

  IF v_target.authority_id IS NOT NULL
     AND v_target.authority_id <> p_authority_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This event is not assigned to the selected approving authority'
    );
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

-- 6. Atomic RPC function for club registration approval
CREATE OR REPLACE FUNCTION public.approve_club_registration(
  p_club_id TEXT,
  p_authority_id TEXT,
  p_authority_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_club RECORD;
  v_authority RECORD;
  v_decision JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authenticated CPM session required');
  END IF;
  PERFORM set_config('vvce.authority_rpc', 'on', true);

  SELECT aa.* INTO v_authority
  FROM public.cpm_admin_members m
  JOIN public.approving_authorities aa ON aa.id = m.authority_id
  WHERE m.user_id = auth.uid()
    AND m.active = TRUE
    AND aa.active = TRUE
    AND m.role IN ('super_admin', 'event_manager');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is not an active club approving authority');
  END IF;

  p_authority_id := v_authority.id;
  p_authority_name := v_authority.name;

  SELECT * INTO v_club
  FROM public.users
  WHERE id = p_club_id
    AND type = 'admin'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Club account not found');
  END IF;

  IF v_club.authority_id IS NOT NULL
     AND v_club.authority_id <> p_authority_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This club is not assigned to the selected approving authority'
    );
  END IF;

  IF COALESCE(v_club.approved, FALSE) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Club is already approved');
  END IF;

  v_decision := jsonb_build_object(
    'action', 'approved',
    'authority_id', p_authority_id,
    'authority_name', p_authority_name,
    'timestamp', NOW()
  );

  UPDATE public.users
  SET approved = TRUE,
      approval_history = COALESCE(approval_history, '[]'::jsonb) || v_decision
  WHERE id = p_club_id;

  RETURN jsonb_build_object('success', true, 'message', 'Club approved successfully');
END;
$$;

-- 7. Atomic event rejection RPC
CREATE OR REPLACE FUNCTION public.reject_event_by_authority(
  p_event_id TEXT,
  p_authority_id TEXT,
  p_authority_name TEXT,
  p_reason TEXT DEFAULT 'Rejected by Approving Authority'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_target RECORD;
  v_decision JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authenticated CPM session required');
  END IF;
  PERFORM set_config('vvce.authority_rpc', 'on', true);
  SELECT aa.id, aa.name INTO p_authority_id, p_authority_name
  FROM public.cpm_admin_members m
  JOIN public.approving_authorities aa ON aa.id = m.authority_id
  WHERE m.user_id = auth.uid()
    AND m.active = TRUE
    AND aa.active = TRUE
    AND m.role IN ('super_admin', 'event_manager');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is not an active approving authority');
  END IF;

  SELECT * INTO v_target
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  IF v_target.authority_id IS NOT NULL AND v_target.authority_id <> p_authority_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'This event is not assigned to the selected approving authority');
  END IF;

  v_decision := jsonb_build_object(
    'action', 'rejected',
    'reason', COALESCE(NULLIF(TRIM(p_reason), ''), 'Rejected by Approving Authority'),
    'authority_id', p_authority_id,
    'authority_name', p_authority_name,
    'timestamp', NOW()
  );

  UPDATE public.events
  SET status = 'rejected',
      rej_reason = COALESCE(NULLIF(TRIM(p_reason), ''), 'Rejected by Approving Authority'),
      decision_history = COALESCE(decision_history, '[]'::jsonb) || v_decision
  WHERE id = p_event_id;

  RETURN jsonb_build_object('success', true, 'message', 'Event rejected successfully');
END;
$$;

-- 8. Atomic club reject/revoke RPCs
CREATE OR REPLACE FUNCTION public.reject_club_registration(
  p_club_id TEXT,
  p_authority_id TEXT,
  p_authority_name TEXT,
  p_reason TEXT DEFAULT 'Registration rejected by Approving Authority'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_club RECORD;
  v_decision JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authenticated CPM session required');
  END IF;
  PERFORM set_config('vvce.authority_rpc', 'on', true);
  SELECT aa.id, aa.name INTO p_authority_id, p_authority_name
  FROM public.cpm_admin_members m
  JOIN public.approving_authorities aa ON aa.id = m.authority_id
  WHERE m.user_id = auth.uid()
    AND m.active = TRUE
    AND aa.active = TRUE
    AND m.role IN ('super_admin', 'event_manager');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is not an active approving authority');
  END IF;

  SELECT * INTO v_club
  FROM public.users
  WHERE id = p_club_id AND type = 'admin'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Club account not found');
  END IF;

  IF v_club.authority_id IS NOT NULL AND v_club.authority_id <> p_authority_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'This club is not assigned to the selected approving authority');
  END IF;

  v_decision := jsonb_build_object(
    'action', 'rejected',
    'reason', COALESCE(NULLIF(TRIM(p_reason), ''), 'Registration rejected by Approving Authority'),
    'authority_id', p_authority_id,
    'authority_name', p_authority_name,
    'timestamp', NOW()
  );

  UPDATE public.users
  SET approved = FALSE,
      rejection_reason = COALESCE(NULLIF(TRIM(p_reason), ''), 'Registration rejected by Approving Authority'),
      approval_history = COALESCE(approval_history, '[]'::jsonb) || v_decision
  WHERE id = p_club_id;

  RETURN jsonb_build_object('success', true, 'message', 'Club registration rejected successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_club_registration(
  p_club_id TEXT,
  p_authority_id TEXT,
  p_authority_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_club RECORD;
  v_decision JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authenticated CPM session required');
  END IF;
  PERFORM set_config('vvce.authority_rpc', 'on', true);
  SELECT aa.id, aa.name INTO p_authority_id, p_authority_name
  FROM public.cpm_admin_members m
  JOIN public.approving_authorities aa ON aa.id = m.authority_id
  WHERE m.user_id = auth.uid()
    AND m.active = TRUE
    AND aa.active = TRUE
    AND m.role IN ('super_admin', 'event_manager');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is not an active approving authority');
  END IF;

  SELECT * INTO v_club
  FROM public.users
  WHERE id = p_club_id AND type = 'admin'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Club account not found');
  END IF;

  IF v_club.authority_id IS NOT NULL AND v_club.authority_id <> p_authority_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'This club is not assigned to the selected approving authority');
  END IF;

  v_decision := jsonb_build_object(
    'action', 'revoked',
    'authority_id', p_authority_id,
    'authority_name', p_authority_name,
    'timestamp', NOW()
  );

  UPDATE public.users
  SET approved = FALSE,
      approval_history = COALESCE(approval_history, '[]'::jsonb) || v_decision
  WHERE id = p_club_id;

  RETURN jsonb_build_object('success', true, 'message', 'Club access revoked successfully');
END;
$$;

REVOKE UPDATE ON TABLE public.events FROM anon, authenticated;
REVOKE UPDATE ON TABLE public.users FROM anon, authenticated;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Approvers can update events" ON public.events;
CREATE POLICY "CPM event admins can update events"
ON public.events
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cpm_admin_members m
    WHERE m.user_id = auth.uid()
      AND m.active = TRUE
      AND m.role IN ('super_admin', 'event_manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cpm_admin_members m
    WHERE m.user_id = auth.uid()
      AND m.active = TRUE
      AND m.role IN ('super_admin', 'event_manager')
  )
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Approvers can update clubs" ON public.users;
CREATE POLICY "CPM club admins can update clubs"
ON public.users
FOR UPDATE
TO authenticated
USING (
  type = 'admin' AND EXISTS (
    SELECT 1 FROM public.cpm_admin_members m
    WHERE m.user_id = auth.uid()
      AND m.active = TRUE
      AND m.role IN ('super_admin', 'event_manager')
  )
)
WITH CHECK (
  type = 'admin' AND EXISTS (
    SELECT 1 FROM public.cpm_admin_members m
    WHERE m.user_id = auth.uid()
      AND m.active = TRUE
      AND m.role IN ('super_admin', 'event_manager')
  )
);

-- Block direct approval-state writes. Approved/rejected/revoked state must pass
-- through the auth-bound RPCs below.
CREATE OR REPLACE FUNCTION public.protect_event_approval_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('vvce.authority_rpc', true), 'off') <> 'on'
     AND (
       (NEW.status IS DISTINCT FROM OLD.status AND (NEW.status IN ('approved','rejected') OR OLD.status IN ('approved','rejected')))
       OR NEW.approved_by_authority_id IS DISTINCT FROM OLD.approved_by_authority_id
       OR NEW.approved_by_authority_name IS DISTINCT FROM OLD.approved_by_authority_name
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     ) THEN
    RAISE EXCEPTION 'Direct event approval/rejection updates are forbidden; use authority RPC';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_event_approval_columns ON public.events;
CREATE TRIGGER protect_event_approval_columns
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.protect_event_approval_columns();

CREATE OR REPLACE FUNCTION public.protect_club_approval_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('vvce.authority_rpc', true), 'off') <> 'on'
     AND (
       NEW.approved IS DISTINCT FROM OLD.approved
       OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     ) THEN
    RAISE EXCEPTION 'Direct club approval/rejection/revoke updates are forbidden; use authority RPC';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_club_approval_columns ON public.users;
CREATE TRIGGER protect_club_approval_columns
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_club_approval_columns();

REVOKE EXECUTE ON FUNCTION public.approve_event_with_clash_check(TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_club_registration(TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_event_by_authority(TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_club_registration(TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_club_registration(TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_event_with_clash_check(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_club_registration(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_event_by_authority(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_club_registration(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_club_registration(TEXT, TEXT, TEXT) TO authenticated;
