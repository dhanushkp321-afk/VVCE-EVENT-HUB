-- ============================================================================
-- VVCE Events Hub — Phase 2D: Dynamic Solo/Group Registration, Team Confirmation
--                   & Payment Proof Verification Workflow
-- Run this idempotent migration in Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Ensure event configuration & team columns exist cleanly
ALTER TABLE IF EXISTS public.events
  ADD COLUMN IF NOT EXISTS needs_payment BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_teams INT DEFAULT 0;

UPDATE public.events
SET needs_payment = TRUE
WHERE COALESCE(fee, 0) > 0 AND COALESCE(needs_payment, FALSE) = FALSE;

-- 2. Normalized event_registrations table tracking strict workflow states:
--    pending_team -> pending_payment -> pending_approval -> registered | rejected
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  user_email TEXT,
  usn TEXT,
  team_id TEXT,
  team_name TEXT,
  is_team BOOLEAN NOT NULL DEFAULT FALSE,
  team_members JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_team', 'pending_payment', 'pending_approval', 'registered', 'rejected')),
  utr_number TEXT,
  screenshot_url TEXT,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_regs_event_status
  ON public.event_registrations (event_id, status);

CREATE INDEX IF NOT EXISTS idx_event_regs_user
  ON public.event_registrations (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_regs_unique_event_user
  ON public.event_registrations (event_id, user_id);

-- 3. Enable RLS with safe policies consistent with current client access
ALTER TABLE IF EXISTS public.event_registrations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'event_registrations' AND policyname = 'Allow event_registrations access'
  ) THEN
    CREATE POLICY "Allow event_registrations access"
      ON public.event_registrations
      FOR ALL
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 4. Atomic Registration Approval RPC (checks remaining seat capacity under row lock)
CREATE OR REPLACE FUNCTION public.approve_registration_atomic(
  p_event_id TEXT,
  p_user_id TEXT,
  p_reviewer_name TEXT DEFAULT 'Organizer',
  p_team_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ev RECORD;
  v_regs JSONB;
  v_pending JSONB;
  v_teams JSONB;
  v_new_regs JSONB;
  v_member_ids JSONB := '[]'::jsonb;
  v_team RECORD;
  v_idx INT;
  v_seats_needed INT := 0;
  v_uid TEXT;
  v_max_cap INT;
BEGIN
  SELECT * INTO v_ev
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found.');
  END IF;

  v_regs    := COALESCE(v_ev.registrations, '[]'::jsonb);
  v_pending := COALESCE(v_ev.pending_payments, '[]'::jsonb);
  v_teams   := COALESCE(v_ev.teams, '[]'::jsonb);
  v_max_cap := COALESCE(v_ev.max_participants, 100);

  IF p_team_id IS NOT NULL AND TRIM(p_team_id) <> '' THEN
    FOR v_idx IN 0 .. COALESCE(jsonb_array_length(v_teams), 0) - 1 LOOP
      IF (v_teams->v_idx->>'id') = p_team_id THEN
        v_member_ids := COALESCE(v_teams->v_idx->'memberIds', '[]'::jsonb);
        v_teams := jsonb_set(v_teams, ARRAY[v_idx::TEXT, 'status'], '"registered"'::jsonb, true);
        v_teams := jsonb_set(v_teams, ARRAY[v_idx::TEXT, 'paymentStatus'], '"approved"'::jsonb, true);
        v_teams := jsonb_set(v_teams, ARRAY[v_idx::TEXT, 'rejectionReason'], 'null'::jsonb, true);
        v_teams := jsonb_set(v_teams, ARRAY[v_idx::TEXT, 'reviewedBy'], to_jsonb(p_reviewer_name), true);
        v_teams := jsonb_set(v_teams, ARRAY[v_idx::TEXT, 'reviewedAt'], to_jsonb(NOW()::TEXT), true);
      END IF;
    END LOOP;
  END IF;

  IF jsonb_array_length(v_member_ids) = 0 THEN
    v_member_ids := jsonb_build_array(p_user_id);
  END IF;

  v_new_regs := v_regs;
  FOR v_uid IN SELECT jsonb_array_elements_text(v_member_ids) LOOP
    IF NOT (v_new_regs ? v_uid) THEN
      v_seats_needed := v_seats_needed + 1;
      v_new_regs := v_new_regs || to_jsonb(v_uid);
    END IF;
  END LOOP;

  IF jsonb_array_length(v_regs) + v_seats_needed > v_max_cap THEN
    RETURN jsonb_build_object(
      'success', false,
      'capacity_full', true,
      'error', 'Cannot confirm registration: only ' || GREATEST(0, v_max_cap - jsonb_array_length(v_regs)) || ' seat(s) remaining (need ' || v_seats_needed || ').'
    );
  END IF;

  FOR v_idx IN 0 .. COALESCE(jsonb_array_length(v_pending), 0) - 1 LOOP
    IF (v_pending->v_idx->>'uid') = p_user_id
       OR (p_team_id IS NOT NULL AND (v_pending->v_idx->>'teamId') = p_team_id) THEN
      v_pending := jsonb_set(v_pending, ARRAY[v_idx::TEXT, 'status'], '"registered"'::jsonb, true);
      v_pending := jsonb_set(v_pending, ARRAY[v_idx::TEXT, 'rejectionReason'], 'null'::jsonb, true);
      v_pending := jsonb_set(v_pending, ARRAY[v_idx::TEXT, 'reviewedBy'], to_jsonb(p_reviewer_name), true);
      v_pending := jsonb_set(v_pending, ARRAY[v_idx::TEXT, 'reviewedAt'], to_jsonb(NOW()::TEXT), true);
    END IF;
  END LOOP;

  UPDATE public.events
  SET registrations    = v_new_regs,
      reg_count        = jsonb_array_length(v_new_regs),
      pending_payments = v_pending,
      teams            = v_teams
  WHERE id = p_event_id;

  UPDATE public.event_registrations
  SET status           = 'registered',
      rejection_reason = NULL,
      reviewed_by      = p_reviewer_name,
      reviewed_at      = NOW(),
      updated_at       = NOW()
  WHERE event_id = p_event_id
    AND (user_id = p_user_id OR (p_team_id IS NOT NULL AND team_id = p_team_id));

  RETURN jsonb_build_object(
    'success', true,
    'reg_count', jsonb_array_length(v_new_regs),
    'confirmed_ids', v_member_ids
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_registration_atomic(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
