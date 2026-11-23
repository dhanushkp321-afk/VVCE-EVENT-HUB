-- Main-site identity is Supabase Auth. Public profile data and role mappings
-- remain in public tables; passwords never live in app metadata or public rows.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS authority_id TEXT,
  ADD COLUMN IF NOT EXISTS authority_name TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS approval_history JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.approving_authorities
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- Remove legacy client-side password stores. Supabase Auth owns all passwords.
ALTER TABLE public.users DROP COLUMN IF EXISTS pass;
ALTER TABLE public.approving_authorities DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.approving_authorities DROP COLUMN IF EXISTS salt;
ALTER TABLE public.approving_authorities DROP COLUMN IF EXISTS pass;

CREATE OR REPLACE FUNCTION public.provision_verified_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_type TEXT;
  v_meta JSONB;
BEGIN
  IF NEW.email IS NULL OR NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_profile_type := v_meta ->> 'profile_type';
  IF v_profile_type IN ('student', 'admin')
     AND lower(NEW.email) NOT LIKE '%@vvce.ac.in' THEN
    RAISE EXCEPTION 'Only @vvce.ac.in accounts may self-register';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.approving_authorities aa
    WHERE lower(aa.email) = lower(NEW.email)
      AND aa.active = TRUE
  ) THEN
    IF v_profile_type IS NOT NULL THEN
      RAISE EXCEPTION 'This email belongs to an approving authority; use the assigned authority account';
    END IF;
    UPDATE public.approving_authorities
    SET auth_user_id = NEW.id,
        updated_at = now()
    WHERE lower(email) = lower(NEW.email)
      AND active = TRUE
      AND (auth_user_id IS NULL OR auth_user_id = NEW.id);
    RETURN NEW;
  END IF;

  IF v_profile_type IS NULL THEN
    UPDATE public.users
    SET auth_user_id = NEW.id
    WHERE lower(email) = lower(NEW.email)
      AND (auth_user_id IS NULL OR auth_user_id = NEW.id);
    RETURN NEW;
  END IF;

  IF v_profile_type NOT IN ('student', 'admin') THEN
    RAISE EXCEPTION 'Self-service signup is limited to student and club accounts';
  END IF;

  INSERT INTO public.users (
    id, auth_user_id, type, name, email, usn, branch, section, year, sem,
    admission_year, dept, phone, interests, skills, bio, linkedin, github,
    achievements, profile_photo, resume, points, points_by_sem, notifs,
    club_name, club_email, domain, faculty, approved, "desc", authority_id,
    authority_name, approval_history
  ) VALUES (
    NEW.id::text, NEW.id, v_profile_type,
    COALESCE(NULLIF(v_meta ->> 'name', ''), split_part(NEW.email, '@', 1)),
    lower(NEW.email),
    NULLIF(v_meta ->> 'usn', ''),
    NULLIF(v_meta ->> 'branch', ''),
    NULLIF(v_meta ->> 'section', ''),
    NULLIF(v_meta ->> 'year', ''),
    NULLIF(v_meta ->> 'sem', ''),
    NULLIF(v_meta ->> 'admission_year', '')::integer,
    NULLIF(v_meta ->> 'dept', ''),
    NULLIF(v_meta ->> 'phone', ''),
    CASE
      WHEN jsonb_typeof(v_meta -> 'interests') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(v_meta -> 'interests'))
      ELSE ARRAY[]::text[]
    END,
    ARRAY[]::text[],
    '',
    '',
    '',
    ARRAY[]::text[],
    NULLIF(v_meta ->> 'profile_photo', ''),
    NULL,
    0,
    '{"Sem 1":0,"Sem 2":0,"Sem 3":0,"Sem 4":0,"Sem 5":0,"Sem 6":0,"Sem 7":0,"Sem 8":0}'::jsonb,
    COALESCE(v_meta -> 'notifs', '[]'::jsonb),
    NULLIF(v_meta ->> 'club_name', ''),
    NULLIF(v_meta ->> 'club_email', ''),
    NULLIF(v_meta ->> 'domain', ''),
    NULLIF(v_meta ->> 'faculty', ''),
    v_profile_type = 'student',
    NULLIF(v_meta ->> 'desc', ''),
    NULLIF(v_meta ->> 'authority_id', ''),
    NULLIF(v_meta ->> 'authority_name', ''),
    CASE WHEN v_profile_type = 'admin' THEN
      jsonb_build_array(jsonb_build_object(
        'action', 'submitted',
        'authority_id', NULLIF(v_meta ->> 'authority_id', ''),
        'authority_name', NULLIF(v_meta ->> 'authority_name', ''),
        'timestamp', now()
      ))
    ELSE '[]'::jsonb END
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS provision_verified_auth_user ON auth.users;
CREATE TRIGGER provision_verified_auth_user
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.provision_verified_auth_user();
REVOKE ALL ON FUNCTION public.provision_verified_auth_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.link_authority_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS NULL OR NEW.auth_user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF (
    SELECT count(*) FROM auth.users au
    WHERE lower(au.email) = lower(NEW.email)
      AND au.email_confirmed_at IS NOT NULL
  ) = 1 THEN
    UPDATE public.approving_authorities
    SET auth_user_id = (
      SELECT au.id FROM auth.users au
      WHERE lower(au.email) = lower(NEW.email)
        AND au.email_confirmed_at IS NOT NULL
    ),
    updated_at = now()
    WHERE id = NEW.id AND auth_user_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_authority_auth_user ON public.approving_authorities;
CREATE TRIGGER link_authority_auth_user
AFTER INSERT OR UPDATE OF email ON public.approving_authorities
FOR EACH ROW EXECUTE FUNCTION public.link_authority_auth_user();
REVOKE ALL ON FUNCTION public.link_authority_auth_user() FROM PUBLIC, anon, authenticated;

-- Link pre-existing confirmed Auth users without trusting browser-provided role data.
UPDATE public.approving_authorities aa
SET auth_user_id = au.id
FROM auth.users au
WHERE lower(aa.email) = lower(au.email)
  AND au.email_confirmed_at IS NOT NULL
  AND aa.active = TRUE
  AND aa.auth_user_id IS NULL
  AND 1 = (
    SELECT count(*) FROM auth.users au2
    WHERE lower(au2.email) = lower(aa.email)
      AND au2.email_confirmed_at IS NOT NULL
  )
  AND 1 = (
    SELECT count(*) FROM public.approving_authorities aa2
    WHERE lower(aa2.email) = lower(aa.email)
  );

UPDATE public.users u
SET auth_user_id = au.id
FROM auth.users au
WHERE lower(u.email) = lower(au.email)
  AND au.email_confirmed_at IS NOT NULL
  AND u.auth_user_id IS NULL
  AND 1 = (
    SELECT count(*) FROM auth.users au2
    WHERE lower(au2.email) = lower(u.email)
      AND au2.email_confirmed_at IS NOT NULL
  )
  AND 1 = (
    SELECT count(*) FROM public.users u2
    WHERE lower(u2.email) = lower(u.email)
  );

CREATE OR REPLACE FUNCTION public.protect_user_auth_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.approving_authorities aa
       WHERE aa.auth_user_id = auth.uid() AND aa.active = TRUE
     )
     AND COALESCE(current_setting('vvce.authority_rpc', true), 'off') <> 'on'
     AND auth.uid() IS DISTINCT FROM OLD.auth_user_id
     AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    RAISE EXCEPTION 'Authorities must use the approval workflow to update club records';
  END IF;
  IF COALESCE(current_setting('vvce.authority_rpc', true), 'off') <> 'on'
     AND (
       NEW.approved IS DISTINCT FROM OLD.approved
       OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
       OR NEW.approval_history IS DISTINCT FROM OLD.approval_history
     )
     AND EXISTS (
       SELECT 1 FROM public.approving_authorities aa
       WHERE aa.auth_user_id = auth.uid() AND aa.active = TRUE
     ) THEN
    RAISE EXCEPTION 'Authority approval decisions must use the authority RPC';
  END IF;
  IF auth.uid() = OLD.auth_user_id AND (
    NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
    OR NEW.type IS DISTINCT FROM OLD.type
    OR NEW.approved IS DISTINCT FROM OLD.approved
    OR NEW.authority_id IS DISTINCT FROM OLD.authority_id
    OR NEW.authority_name IS DISTINCT FROM OLD.authority_name
    OR NEW.approval_history IS DISTINCT FROM OLD.approval_history
  ) THEN
    RAISE EXCEPTION 'Role, approval, and authority assignment fields are server-managed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_auth_role ON public.users;
CREATE TRIGGER protect_user_auth_role
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_user_auth_role();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approving_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpm_admin_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.users FROM anon;
GRANT SELECT, UPDATE ON public.users TO authenticated;
DROP POLICY IF EXISTS "Users can read profiles" ON public.users;
CREATE POLICY "Authenticated users can read profiles"
ON public.users FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE TO authenticated
USING (
  auth_user_id = (SELECT auth.uid())
  OR (
    authority_id IS NULL
    AND COALESCE(current_setting('vvce.authority_rpc', true), 'off') = 'on'
    AND EXISTS (
      SELECT 1 FROM public.approving_authorities aa
      WHERE aa.auth_user_id = (SELECT auth.uid())
        AND aa.active = TRUE
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.approving_authorities aa
    WHERE aa.auth_user_id = (SELECT auth.uid())
      AND aa.active = TRUE
      AND aa.id = users.authority_id
  )
)
WITH CHECK (
  auth_user_id = (SELECT auth.uid())
  OR (
    authority_id IS NULL
    AND COALESCE(current_setting('vvce.authority_rpc', true), 'off') = 'on'
    AND EXISTS (
      SELECT 1 FROM public.approving_authorities aa
      WHERE aa.auth_user_id = (SELECT auth.uid())
        AND aa.active = TRUE
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.approving_authorities aa
    WHERE aa.auth_user_id = (SELECT auth.uid())
      AND aa.active = TRUE
      AND aa.id = users.authority_id
  )
);

REVOKE ALL ON public.approving_authorities FROM anon, authenticated;
GRANT SELECT (id, name, email, designation, active, created_at, updated_at)
ON public.approving_authorities TO anon, authenticated;
GRANT SELECT (auth_user_id)
ON public.approving_authorities TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.approving_authorities TO authenticated;

DROP POLICY IF EXISTS "Allow public read active authorities" ON public.approving_authorities;
DROP POLICY IF EXISTS "Authenticated users can read authorities" ON public.approving_authorities;
CREATE POLICY "Anyone can list active authority names"
ON public.approving_authorities FOR SELECT TO anon, authenticated
USING (active = TRUE);
CREATE POLICY "CPM super admins manage authorities"
ON public.approving_authorities FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.cpm_admin_members m
  WHERE m.user_id = (SELECT auth.uid())
    AND m.active = TRUE
    AND m.role = 'super_admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.cpm_admin_members m
  WHERE m.user_id = (SELECT auth.uid())
    AND m.active = TRUE
    AND m.role = 'super_admin'
));

DROP POLICY IF EXISTS "CPM members read own mapping" ON public.cpm_admin_members;
CREATE POLICY "CPM members read own mapping"
ON public.cpm_admin_members FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.cpm_admin_members FROM anon, authenticated;
GRANT SELECT ON public.cpm_admin_members TO authenticated;

CREATE OR REPLACE FUNCTION public.authority_decision(
  p_action TEXT,
  p_target_id TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_authority RECORD;
  v_event RECORD;
  v_club RECORD;
  v_clashing_name TEXT;
  v_decision JSONB;
  v_reason TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authenticated authority session required');
  END IF;

  SELECT id, name INTO v_authority
  FROM public.approving_authorities
  WHERE auth_user_id = auth.uid() AND active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is not an active approving authority');
  END IF;

  IF p_action IN ('approve_event', 'reject_event') THEN
    SELECT * INTO v_event FROM public.events WHERE id = p_target_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Event not found');
    END IF;
    IF v_event.authority_id IS NOT NULL AND v_event.authority_id <> v_authority.id THEN
      RETURN jsonb_build_object('success', false, 'error', 'This event is assigned to another authority');
    END IF;

    IF p_action = 'approve_event' THEN
      SELECT name INTO v_clashing_name
      FROM public.events
      WHERE id <> p_target_id
        AND status = 'approved'
        AND date = v_event.date
        AND lower(trim(venue)) = lower(trim(v_event.venue))
      LIMIT 1;
      IF v_clashing_name IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'clash', true,
          'error', 'Venue clash with approved event "' || v_clashing_name || '"');
      END IF;
      v_decision := jsonb_build_object('action', 'approved',
        'authority_id', v_authority.id, 'authority_name', v_authority.name, 'timestamp', now());
      PERFORM set_config('vvce.authority_rpc', 'on', true);
      UPDATE public.events
      SET status = 'approved', rej_reason = NULL,
          approved_by_authority_id = v_authority.id,
          approved_by_authority_name = v_authority.name,
          approved_at = now(),
          decision_history = COALESCE(decision_history, '[]'::jsonb) || v_decision
      WHERE id = p_target_id;
    ELSE
      v_reason := COALESCE(NULLIF(trim(p_reason), ''), 'Rejected by Approving Authority');
      v_decision := jsonb_build_object('action', 'rejected', 'reason', v_reason,
        'authority_id', v_authority.id, 'authority_name', v_authority.name, 'timestamp', now());
      PERFORM set_config('vvce.authority_rpc', 'on', true);
      UPDATE public.events
      SET status = 'rejected', rej_reason = v_reason,
          decision_history = COALESCE(decision_history, '[]'::jsonb) || v_decision
      WHERE id = p_target_id;
    END IF;
    RETURN jsonb_build_object('success', true, 'message', 'Event decision saved');
  END IF;

  IF p_action IN ('approve_club', 'reject_club', 'revoke_club') THEN
    SELECT * INTO v_club FROM public.users
    WHERE id = p_target_id AND type = 'admin' FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Club account not found');
    END IF;
    IF v_club.authority_id IS NOT NULL AND v_club.authority_id <> v_authority.id THEN
      RETURN jsonb_build_object('success', false, 'error', 'This club is assigned to another authority');
    END IF;

    IF p_action = 'approve_club' THEN
      PERFORM set_config('vvce.authority_rpc', 'on', true);
      v_decision := jsonb_build_object('action', 'approved',
        'authority_id', v_authority.id, 'authority_name', v_authority.name, 'timestamp', now());
      UPDATE public.users
      SET approved = TRUE, rejection_reason = NULL,
          approval_history = COALESCE(approval_history, '[]'::jsonb) || v_decision
      WHERE id = p_target_id;
    ELSE
      PERFORM set_config('vvce.authority_rpc', 'on', true);
      v_reason := CASE WHEN p_action = 'revoke_club' THEN NULL
        ELSE COALESCE(NULLIF(trim(p_reason), ''), 'Registration rejected by Approving Authority') END;
      v_decision := jsonb_build_object('action', CASE WHEN p_action = 'revoke_club' THEN 'revoked' ELSE 'rejected' END,
        'reason', v_reason, 'authority_id', v_authority.id,
        'authority_name', v_authority.name, 'timestamp', now());
      UPDATE public.users
      SET approved = FALSE,
          rejection_reason = v_reason,
          approval_history = COALESCE(approval_history, '[]'::jsonb) || v_decision
      WHERE id = p_target_id;
    END IF;
    RETURN jsonb_build_object('success', true, 'message', 'Club decision saved');
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Unsupported authority action');
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_event_with_clash_check(
  p_event_id TEXT, p_authority_id TEXT, p_authority_name TEXT
) RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT public.authority_decision('approve_event', p_event_id, NULL); $$;

CREATE OR REPLACE FUNCTION public.reject_event_by_authority(
  p_event_id TEXT, p_authority_id TEXT, p_authority_name TEXT,
  p_reason TEXT DEFAULT 'Rejected by Approving Authority'
) RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT public.authority_decision('reject_event', p_event_id, p_reason); $$;

CREATE OR REPLACE FUNCTION public.approve_club_registration(
  p_club_id TEXT, p_authority_id TEXT, p_authority_name TEXT
) RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT public.authority_decision('approve_club', p_club_id, NULL); $$;

CREATE OR REPLACE FUNCTION public.reject_club_registration(
  p_club_id TEXT, p_authority_id TEXT, p_authority_name TEXT,
  p_reason TEXT DEFAULT 'Registration rejected by Approving Authority'
) RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT public.authority_decision('reject_club', p_club_id, p_reason); $$;

CREATE OR REPLACE FUNCTION public.revoke_club_registration(
  p_club_id TEXT, p_authority_id TEXT, p_authority_name TEXT
) RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT public.authority_decision('revoke_club', p_club_id, NULL); $$;

REVOKE EXECUTE ON FUNCTION public.authority_decision(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authority_decision(TEXT, TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_event_with_clash_check(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_club_registration(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_event_by_authority(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_club_registration(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_club_registration(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_event_with_clash_check(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_club_registration(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_event_by_authority(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_club_registration(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_club_registration(TEXT, TEXT, TEXT) TO authenticated;

DROP POLICY IF EXISTS "CPM event admins can update events" ON public.events;
CREATE POLICY "Authenticated organizers and authorities update events"
ON public.events FOR UPDATE TO authenticated
USING (
  admin_id::text = (SELECT auth.uid())::text
  OR EXISTS (
    SELECT 1 FROM public.approving_authorities aa
    WHERE aa.auth_user_id = (SELECT auth.uid())
      AND aa.active = TRUE
      AND (events.authority_id IS NULL OR events.authority_id = aa.id)
  )
  OR EXISTS (
    SELECT 1 FROM public.cpm_admin_members m
    WHERE m.user_id = (SELECT auth.uid()) AND m.active = TRUE
      AND m.role IN ('super_admin', 'event_manager')
  )
)
WITH CHECK (
  admin_id::text = (SELECT auth.uid())::text
  OR EXISTS (
    SELECT 1 FROM public.approving_authorities aa
    WHERE aa.auth_user_id = (SELECT auth.uid())
      AND aa.active = TRUE
      AND (events.authority_id IS NULL OR events.authority_id = aa.id)
  )
  OR EXISTS (
    SELECT 1 FROM public.cpm_admin_members m
    WHERE m.user_id = (SELECT auth.uid()) AND m.active = TRUE
      AND m.role IN ('super_admin', 'event_manager')
  )
);

DROP POLICY IF EXISTS "Approvers can update events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can read events" ON public.events;
CREATE POLICY "Authenticated users can read events"
ON public.events FOR SELECT TO authenticated USING (true);

REVOKE ALL ON public.events FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;