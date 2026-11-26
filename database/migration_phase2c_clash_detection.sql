-- ============================================================================
-- VVCE Events Hub — Phase 2C: Venue & Schedule Time-Slot Clash Detection
-- Run this idempotent migration in Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Ensure end_time column exists & add composite index for fast clash queries
ALTER TABLE IF EXISTS public.events
  ADD COLUMN IF NOT EXISTS end_time TEXT;

CREATE INDEX IF NOT EXISTS idx_events_date_venue_status
  ON public.events (date, LOWER(TRIM(venue)), status);

-- 2. Parse HH:MM, HH:MM:SS, or 12h "HH:MM AM/PM" strings into minutes from midnight
CREATE OR REPLACE FUNCTION public.vvce_parse_time_minutes(p_time TEXT)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_raw TEXT;
  v_match TEXT[];
  v_h INT;
  v_m INT;
  v_ampm TEXT;
BEGIN
  IF p_time IS NULL OR TRIM(p_time) = '' THEN
    RETURN NULL;
  END IF;
  v_raw := TRIM(p_time);

  v_match := regexp_match(v_raw, '^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$', 'i');
  IF v_match IS NOT NULL THEN
    v_h := v_match[1]::INT;
    v_m := v_match[2]::INT;
    v_ampm := UPPER(v_match[3]);
    IF v_h < 1 OR v_h > 12 OR v_m < 0 OR v_m > 59 THEN
      RETURN NULL;
    END IF;
    IF v_ampm = 'AM' AND v_h = 12 THEN
      v_h := 0;
    ELSIF v_ampm = 'PM' AND v_h <> 12 THEN
      v_h := v_h + 12;
    END IF;
    RETURN v_h * 60 + v_m;
  END IF;

  v_match := regexp_match(v_raw, '^(\d{1,2}):(\d{2})(?::\d{2})?$');
  IF v_match IS NOT NULL THEN
    v_h := v_match[1]::INT;
    v_m := v_match[2]::INT;
    IF v_h < 0 OR v_h > 23 OR v_m < 0 OR v_m > 59 THEN
      RETURN NULL;
    END IF;
    RETURN v_h * 60 + v_m;
  END IF;

  RETURN NULL;
END;
$$;

-- 3. Check time interval overlap (startA < endB AND endA > startB)
-- Legacy events missing end_time default to a 120-minute block.
CREATE OR REPLACE FUNCTION public.vvce_events_time_overlap(
  p_start_a TEXT,
  p_end_a TEXT,
  p_start_b TEXT,
  p_end_b TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_sa INT;
  v_ea INT;
  v_sb INT;
  v_eb INT;
BEGIN
  v_sa := public.vvce_parse_time_minutes(p_start_a);
  v_ea := public.vvce_parse_time_minutes(p_end_a);
  IF v_sa IS NULL THEN
    v_sa := 0;
    v_ea := 1440;
  ELSIF v_ea IS NULL OR v_ea <= v_sa THEN
    v_ea := LEAST(1440, v_sa + 120);
  END IF;

  v_sb := public.vvce_parse_time_minutes(p_start_b);
  v_eb := public.vvce_parse_time_minutes(p_end_b);
  IF v_sb IS NULL THEN
    v_sb := 0;
    v_eb := 1440;
  ELSIF v_eb IS NULL OR v_eb <= v_sb THEN
    v_eb := LEAST(1440, v_sb + 120);
  END IF;

  RETURN v_sa < v_eb AND v_ea > v_sb;
END;
$$;

-- 4. Atomic Pre-Insert Clash Guard RPC
CREATE OR REPLACE FUNCTION public.create_event_with_clash_check(p_event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id TEXT;
  v_name TEXT;
  v_club TEXT;
  v_date TEXT;
  v_time TEXT;
  v_end_time TEXT;
  v_venue TEXT;
  v_status TEXT;
  v_start_min INT;
  v_end_min INT;
  v_conflict RECORD;
BEGIN
  v_id       := NULLIF(TRIM(COALESCE(p_event->>'id', '')), '');
  v_name     := TRIM(COALESCE(p_event->>'name', ''));
  v_club     := TRIM(COALESCE(p_event->>'club', ''));
  v_date     := TRIM(COALESCE(p_event->>'date', ''));
  v_time     := TRIM(COALESCE(p_event->>'time', ''));
  v_end_time := TRIM(COALESCE(p_event->>'end_time', ''));
  v_venue    := TRIM(COALESCE(p_event->>'venue', ''));
  v_status   := LOWER(TRIM(COALESCE(p_event->>'status', 'pending')));

  IF v_id IS NULL OR v_name = '' OR v_date = '' OR v_time = '' OR v_venue = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing required event fields.');
  END IF;

  v_start_min := public.vvce_parse_time_minutes(v_time);
  v_end_min   := public.vvce_parse_time_minutes(v_end_time);
  IF v_start_min IS NULL OR v_end_min IS NULL OR v_end_min <= v_start_min THEN
    RETURN jsonb_build_object('success', false, 'error', 'End Time must be later than Start Time.');
  END IF;

  -- Serialize concurrent inserts/updates targeting the same Date + Venue
  PERFORM pg_advisory_xact_lock(hashtext(LOWER(v_venue) || '|' || v_date));

  IF v_status IN ('approved', 'pending', 'scheduled', 'rescheduled') THEN
    SELECT id, name, club, date, time, end_time, venue, status
    INTO v_conflict
    FROM public.events
    WHERE id <> v_id
      AND LOWER(TRIM(status)) IN ('approved', 'pending', 'scheduled', 'rescheduled')
      AND date = v_date
      AND LOWER(TRIM(venue)) = LOWER(v_venue)
      AND public.vvce_events_time_overlap(v_time, v_end_time, time, end_time)
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'clash', true,
        'conflict', jsonb_build_object(
          'id', v_conflict.id,
          'name', v_conflict.name,
          'club', v_conflict.club,
          'date', v_conflict.date,
          'time', v_conflict.time,
          'end_time', v_conflict.end_time,
          'venue', v_conflict.venue,
          'status', v_conflict.status
        ),
        'error', 'Venue slot conflict with "' || v_conflict.name || '" (' || COALESCE(v_conflict.club, 'Club') || ') on ' || v_conflict.date || ' at ' || v_conflict.venue || '.'
      );
    END IF;
  END IF;

  INSERT INTO public.events (
    id, name, club, admin_id, emoji, category, date, time, end_date, end_time,
    venue, max_participants, reg_count, fee, admin_upi_id, points, "desc", speakers, rules,
    branches, status, rej_reason, poster, registrations, pending_payments, attended_students,
    isteamevent, minteamsize, maxteamsize, teams, waitlist, waitlist_enabled, publish_at,
    authority_id, authority_name, decision_history
  )
  VALUES (
    v_id,
    v_name,
    v_club,
    NULLIF(TRIM(COALESCE(p_event->>'admin_id', '')), ''),
    COALESCE(NULLIF(TRIM(p_event->>'emoji'), ''), '🎓'),
    COALESCE(NULLIF(TRIM(p_event->>'category'), ''), 'Technical'),
    v_date,
    v_time,
    COALESCE(NULLIF(TRIM(p_event->>'end_date'), ''), v_date),
    NULLIF(v_end_time, ''),
    v_venue,
    COALESCE((p_event->>'max_participants')::INT, 100),
    COALESCE((p_event->>'reg_count')::INT, 0),
    COALESCE((p_event->>'fee')::NUMERIC, 0),
    COALESCE(p_event->>'admin_upi_id', ''),
    CASE WHEN p_event ? 'points' AND p_event->>'points' IS NOT NULL AND p_event->>'points' <> '' THEN (p_event->>'points')::INT ELSE NULL END,
    COALESCE(p_event->>'desc', ''),
    COALESCE(p_event->>'speakers', ''),
    COALESCE(p_event->>'rules', ''),
    CASE
      WHEN p_event ? 'branches' AND jsonb_typeof(p_event->'branches') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(p_event->'branches'))
      ELSE ARRAY['All']::TEXT[]
    END,
    v_status,
    p_event->>'rej_reason',
    p_event->>'poster',
    COALESCE(p_event->'registrations', '[]'::jsonb),
    COALESCE(p_event->'pending_payments', '[]'::jsonb),
    COALESCE(p_event->'attended_students', '[]'::jsonb),
    COALESCE((p_event->>'isteamevent')::BOOLEAN, (p_event->>'isTeamEvent')::BOOLEAN, false),
    COALESCE((p_event->>'minteamsize')::INT, (p_event->>'minTeamSize')::INT, 1),
    COALESCE((p_event->>'maxteamsize')::INT, (p_event->>'maxTeamSize')::INT, 1),
    COALESCE(p_event->'teams', '[]'::jsonb),
    COALESCE(p_event->'waitlist', '[]'::jsonb),
    COALESCE((p_event->>'waitlist_enabled')::BOOLEAN, false),
    NULLIF(TRIM(COALESCE(p_event->>'publish_at', '')), '')::TIMESTAMPTZ,
    NULLIF(TRIM(COALESCE(p_event->>'authority_id', '')), ''),
    NULLIF(TRIM(COALESCE(p_event->>'authority_name', '')), ''),
    COALESCE(p_event->'decision_history', '[]'::jsonb)
  );

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

-- 5. Atomic Pre-Update Clash Guard RPC (excludes own event ID)
CREATE OR REPLACE FUNCTION public.update_event_with_clash_check(
  p_event_id TEXT,
  p_event JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_name TEXT;
  v_club TEXT;
  v_date TEXT;
  v_time TEXT;
  v_end_time TEXT;
  v_venue TEXT;
  v_status TEXT;
  v_start_min INT;
  v_end_min INT;
  v_conflict RECORD;
BEGIN
  v_name     := TRIM(COALESCE(p_event->>'name', ''));
  v_club     := TRIM(COALESCE(p_event->>'club', ''));
  v_date     := TRIM(COALESCE(p_event->>'date', ''));
  v_time     := TRIM(COALESCE(p_event->>'time', ''));
  v_end_time := TRIM(COALESCE(p_event->>'end_time', ''));
  v_venue    := TRIM(COALESCE(p_event->>'venue', ''));
  v_status   := LOWER(TRIM(COALESCE(p_event->>'status', 'pending')));

  IF p_event_id IS NULL OR v_name = '' OR v_date = '' OR v_time = '' OR v_venue = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing required event fields.');
  END IF;

  v_start_min := public.vvce_parse_time_minutes(v_time);
  v_end_min   := public.vvce_parse_time_minutes(v_end_time);
  IF v_start_min IS NULL OR v_end_min IS NULL OR v_end_min <= v_start_min THEN
    RETURN jsonb_build_object('success', false, 'error', 'End Time must be later than Start Time.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(LOWER(v_venue) || '|' || v_date));

  IF v_status IN ('approved', 'pending', 'scheduled', 'rescheduled') THEN
    SELECT id, name, club, date, time, end_time, venue, status
    INTO v_conflict
    FROM public.events
    WHERE id <> p_event_id
      AND LOWER(TRIM(status)) IN ('approved', 'pending', 'scheduled', 'rescheduled')
      AND date = v_date
      AND LOWER(TRIM(venue)) = LOWER(v_venue)
      AND public.vvce_events_time_overlap(v_time, v_end_time, time, end_time)
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'clash', true,
        'conflict', jsonb_build_object(
          'id', v_conflict.id,
          'name', v_conflict.name,
          'club', v_conflict.club,
          'date', v_conflict.date,
          'time', v_conflict.time,
          'end_time', v_conflict.end_time,
          'venue', v_conflict.venue,
          'status', v_conflict.status
        ),
        'error', 'Venue slot conflict with "' || v_conflict.name || '" (' || COALESCE(v_conflict.club, 'Club') || ') on ' || v_conflict.date || ' at ' || v_conflict.venue || '.'
      );
    END IF;
  END IF;

  UPDATE public.events
  SET name             = v_name,
      club             = v_club,
      category         = COALESCE(NULLIF(TRIM(p_event->>'category'), ''), category),
      date             = v_date,
      time             = v_time,
      end_date         = COALESCE(NULLIF(TRIM(p_event->>'end_date'), ''), v_date),
      end_time         = NULLIF(v_end_time, ''),
      venue            = v_venue,
      max_participants = COALESCE((p_event->>'max_participants')::INT, max_participants),
      fee              = COALESCE((p_event->>'fee')::NUMERIC, fee),
      admin_upi_id     = COALESCE(p_event->>'admin_upi_id', admin_upi_id),
      "desc"           = COALESCE(p_event->>'desc', "desc"),
      speakers         = COALESCE(p_event->>'speakers', speakers),
      rules            = COALESCE(p_event->>'rules', rules),
      poster           = COALESCE(p_event->>'poster', poster),
      status           = v_status,
      rej_reason       = p_event->>'rej_reason'
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found.');
  END IF;

  RETURN jsonb_build_object('success', true, 'id', p_event_id);
END;
$$;

-- 6. Upgrade Authority Approval RPC to check time-slot overlap instead of whole-day blocking
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
  v_conflict RECORD;
  v_decision JSONB;
BEGIN
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

  PERFORM pg_advisory_xact_lock(hashtext(LOWER(TRIM(v_target.venue)) || '|' || v_target.date));

  SELECT id, name, club, date, time, end_time, venue INTO v_conflict
  FROM public.events
  WHERE id <> p_event_id
    AND status = 'approved'
    AND date = v_target.date
    AND LOWER(TRIM(venue)) = LOWER(TRIM(v_target.venue))
    AND public.vvce_events_time_overlap(v_target.time, v_target.end_time, time, end_time)
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'clash', true,
      'error', 'Global venue clash detected! Approved event "' || v_conflict.name || '" (' || COALESCE(v_conflict.club, 'Club') || ') overlaps at ' || v_target.venue || ' on ' || v_target.date || '.'
    );
  END IF;

  v_decision := jsonb_build_object(
    'action', 'approved',
    'authority_id', p_authority_id,
    'authority_name', p_authority_name,
    'timestamp', NOW()
  );

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

GRANT EXECUTE ON FUNCTION public.vvce_parse_time_minutes(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vvce_events_time_overlap(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_event_with_clash_check(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_event_with_clash_check(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_event_with_clash_check(TEXT, TEXT, TEXT) TO anon, authenticated;
