/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Authentication, Login, Registration & Password Reset
   Path: js/pages/auth.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   AUTH — LOGIN / SIGNUP
───────────────────────────────────────────────────────────────*/

function switchMainTab(tab) {
  const panelSignin   = document.getElementById('panel-signin');
  const panelRegister = document.getElementById('panel-register');
  const tabSignin     = document.getElementById('tab-signin');
  const tabRegister   = document.getElementById('tab-register');
  clearAuthMsg();

  if (tab === 'signin') {
    if (panelSignin) panelSignin.style.display   = 'block';
    if (panelRegister) panelRegister.style.display = 'none';
    if (tabSignin) tabSignin.classList.add('active');
    if (tabRegister) tabRegister.classList.remove('active');
  } else {
    if (panelSignin) panelSignin.style.display   = 'none';
    if (panelRegister) panelRegister.style.display = 'block';
    if (tabSignin) tabSignin.classList.remove('active');
    if (tabRegister) tabRegister.classList.add('active');
    selectRegRole(STATE.regRole || 'student');
  }
}
window.switchMainTab = switchMainTab;

function selectRegRole(role) {
  STATE.regRole = role;
  ['student','admin','authority'].forEach(r => {
    const card = document.getElementById(`rcard-${r}`);
    const form = document.getElementById(`form-${r}`);
    if (card) card.classList.toggle('active', r === role);
    if (form) form.style.display = r === role ? 'block' : 'none';
  });
  clearAuthMsg();
}
window.selectRegRole = selectRegRole;

function toggleChip(el) { el.classList.toggle('selected'); }
window.toggleChip = toggleChip;

function showAuthMsg(msg, type = 'error') {
  const el = document.getElementById('auth-msg');
  if (el) {
    el.textContent = msg;
    el.className = `auth-msg ${type}`;
    el.style.display = '';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  toast(msg, type, 4500);
}
function clearAuthMsg() {
  const el = document.getElementById('auth-msg');
  if (el) { el.style.display = 'none'; el.textContent = ''; }
}

function isValidVvceEmail(email) {
  return /^[a-z0-9._%+-]+@vvce\.ac\.in$/i.test(String(email || '').trim());
}

function cleanAuthUrlParams() {
  try {
    const url = new URL(window.location.href);
    let changed = false;
    ['code', 'type', 'mode', 'error', 'error_code', 'error_description'].forEach(param => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    });
    const hash = url.hash || '';
    if (hash && /(access_token|refresh_token|provider_token|expires_in|token_type|type=|mode=|error=|error_code=|error_description=)/i.test(hash)) {
      url.hash = '';
      changed = true;
    }
    if (changed) {
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  } catch (e) {}
}

async function cleanupSupabaseAuthSession() {
  try { sessionStorage.removeItem('vvce_oauth_flow'); } catch (e) {}
  try {
    const sb = getSupabaseClient();
    if (sb && sb.auth) {
      await sb.auth.signOut();
    }
  } catch (e) {
    console.warn('Supabase signOut cleanup warning:', e);
  }
  cleanAuthUrlParams();
}

/* ── Login ── */
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) { showAuthMsg('Please enter your email and password.'); return; }
  if (!isValidVvceEmail(email)) {
    showAuthMsg('❌ Only @vvce.ac.in email addresses are allowed to sign in.', 'error'); return;
  }

  // 1. Check if an active Approving Authority is logging in directly with their email & password
  await syncApprovingAuthoritiesFromSupabase();
  const activeAuthorities = getActiveApprovingAuthorities();
  const matchedAuthority = activeAuthorities.find(a => a.email && a.email.toLowerCase() === email);

  if (matchedAuthority) {
    let isValid = false;
    if (matchedAuthority.password_hash && matchedAuthority.salt) {
      isValid = await verifyPasswordWithSalt(pass, matchedAuthority.password_hash, matchedAuthority.salt);
    }

    if (isValid) {
      let users = getDB('vvce_users');
      let authUser = users.find(u => u.email.toLowerCase() === email && u.type === 'authority');
      if (!authUser) {
        authUser = {
          id: matchedAuthority.id || genId('u'),
          type: 'authority',
          name: matchedAuthority.name,
          email: matchedAuthority.email,
          pass: null,
          designation: matchedAuthority.designation || 'Approving Authority',
          dept: 'Administration',
          phone: '',
          notifs: []
        };
      }

      // Unlock authority portal session directly
      STATE.user = authUser;
      STATE.authorityUnlocked = true;
      STATE.currentAuthorityId = matchedAuthority.id;
      STATE.currentAuthorityName = matchedAuthority.name;

      document.getElementById('auth-screen').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      document.body.style.background = '#f1f5f9';

      renderSidebar();
      renderTopbarUser();
      showPage('authority-portal');
      toast(`Welcome, ${matchedAuthority.name}! Direct Authority Access Granted ✓`, 'success');
      return;
    }
  }

  // 2. Standard user login check via Supabase Auth / server-side RPC (never bulk-download passwords)
  let users = getDB('vvce_users');
  let user = null;
  const sb = getSupabaseClient();

  if (sb && sb.auth) {
    window._loginInProgress = true;
    try {
      const { data: authData, error: authErr } = await sb.auth.signInWithPassword({ email, password: pass });
      if (authErr) {
        const errText = `${authErr.code || ''} ${authErr.message || ''}`;
        if (/email.*not.*confirmed|email_not_confirmed|confirm.*email/i.test(errText)) {
          showAuthMsg('⚠️ Please verify your email first. Check your @vvce.ac.in inbox (and spam folder) and click the verification link before signing in.', 'warning');
          return;
        }
      } else if (authData?.user) {
        if (!authData.user.email_confirmed_at && !authData.user.confirmed_at) {
          await sb.auth.signOut().catch(() => {});
          showAuthMsg('⚠️ Please verify your email first. Check your @vvce.ac.in inbox (and spam folder) and click the verification link before signing in.', 'warning');
          return;
        }
        const { data: rows } = await sb.from('users').select('*').ilike('email', email).limit(1);
        if (rows && rows.length > 0) {
          user = mapUser(rows[0]);
          try { localStorage.removeItem('vvce_pending_verify_email'); } catch (e) {}
        } else {
          // Email verified in Supabase Auth (e.g., pre-consumed by institutional link scanner), finalize DB profile now
          window._loginInProgress = false;
          await handleVerifiedSession({ user: authData.user }, 'LOGIN_SYNC');
          return;
        }
      }
    } catch (err) {
      console.warn('Supabase Auth password check failed, checking RPC fallback:', err);
    } finally {
      window._loginInProgress = false;
    }
  }

  // Fallback for Club Admins / Faculty / legacy accounts verified via secure RPC or single-row check
  if (!user && sb && typeof sb.rpc === 'function') {
    try {
      const { data: rpcRows, error: rpcErr } = await sb.rpc('verify_user_credentials', {
        p_email: email,
        p_pass: pass
      });
      if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
        user = mapUser(rpcRows[0]);
      } else if (rpcErr && (rpcErr.code === '42883' || rpcErr.code === 'PGRST202' || String(rpcErr.message || '').includes('verify_user_credentials'))) {
        // Pre-migration compatibility fallback while migration_phase3 SQL is pending
        const { data: rows } = await sb.from('users').select('*').ilike('email', email).limit(1);
        if (rows && rows.length > 0) {
          const candidate = rows[0];
          const ok = (candidate.password_hash && candidate.salt)
            ? await verifyPasswordWithSalt(pass, candidate.password_hash, candidate.salt)
            : (candidate.pass && candidate.pass === pass);
          if (ok) user = mapUser(candidate);
        }
      }
    } catch (err) {
      console.error('Credential verification lookup failed:', err);
    }
  }

  if (user) {
    if (!users.some(u => u.id === user.id)) {
      users.push(user);
    } else {
      users = users.map(u => u.id === user.id ? user : u);
    }
    SUPABASE_CACHE.vvce_users = users;
    if (typeof safeLocalStorageSet === 'function') safeLocalStorageSet('vvce_users', users);
  }

  if (!user) {
    showAuthMsg('Invalid email or password. Please verify your credentials or register an account.');
    return;
  }

  if (user.type === 'admin' && !user.approved) {
    showAuthMsg('Your club account is pending Dean Student Welfare approval. Please wait.', 'warning');
    return;
  }

  await launchApp(user);
}

/* Quick demo login disabled in hardened production mode */
function quickLogin(role) {
  showAuthMsg('Quick demo bypass is disabled for security. Please sign in with your @vvce.ac.in credentials.', 'warning');
}


/* ─────────────────────────────────────────────────────────────
   SUPABASE EMAIL VERIFICATION & GOOGLE OAUTH SESSION HANDLER
───────────────────────────────────────────────────────────────*/
let _activeAuthSessionPromise = null;

async function finalizeRegistration(role, userPayload) {
  const sb = getSupabaseClient();
  if (!sb || !sb.auth) {
    showAuthMsg('Supabase is not configured. Cannot process sign up.', 'error');
    return;
  }

  const cleanEmail = (userPayload.email || '').trim().toLowerCase();
  if (!isValidVvceEmail(cleanEmail)) {
    showAuthMsg('❌ Only @vvce.ac.in email addresses are allowed.', 'error');
    return;
  }

  try {
    sessionStorage.setItem('vvce_oauth_flow', 'signup');
    sessionStorage.setItem('vvce_pending_reg_' + cleanEmail, JSON.stringify(userPayload));
    localStorage.setItem('vvce_pending_verify_email', cleanEmail);
  } catch (e) {}

  toast('Sending verification email...', 'info');
  const redirectTo = window.location.origin + window.location.pathname;

  // Supabase Auth SignUp
  const { data, error } = await sb.auth.signUp({
    email: cleanEmail,
    password: userPayload.pass,
    options: {
      emailRedirectTo: redirectTo,
      data: userPayload // Store all user details in metadata so we can access them after email verification
    }
  });

  if (error) {
    // If an auth.users record exists from an aborted Google OAuth attempt (not yet in public.users),
    // dispatch a verification magic link so ownership is still verified via @vvce.ac.in email.
    if (error.message?.toLowerCase().includes('already registered')) {
      const { error: otpErr } = await sb.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectTo
        }
      });
      if (otpErr) {
        try {
          sessionStorage.removeItem('vvce_pending_reg_' + cleanEmail);
          localStorage.removeItem('vvce_pending_verify_email');
        } catch (e) {}
        showAuthMsg('This email is already registered. Please sign in instead.', 'warning');
        return;
      }
      showAuthMsg(
        `🎉 Verification email sent to ${cleanEmail}! Please check your inbox (and spam folder) and click the verification link. Once verified, you can sign in.`,
        'success'
      );
      ['s-pass', 'a-pass', 'f-pass'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      switchMainTab('signin');
      return;
    }

    try {
      sessionStorage.removeItem('vvce_pending_reg_' + cleanEmail);
      localStorage.removeItem('vvce_pending_verify_email');
    } catch (e) {}
    if (error.status === 429 || error.message?.includes('rate limit') || error.message?.includes('over_email_send_rate_limit')) {
      showAuthMsg(
        '⚠️ Email sending is temporarily limited (Supabase free tier allows ~3 emails/hour). ' +
        'Please wait a few minutes and try again, or ask your administrator to connect a custom SMTP provider (e.g. Resend) in Supabase settings.',
        'warning'
      );
    } else {
      showAuthMsg('❌ Signup error: ' + error.message, 'error');
    }
    return;
  }

  // If the user already exists in Supabase Auth (unverified signup), resend confirmation email
  if (data?.user?.identities?.length === 0) {
    const { error: resendErr } = await sb.auth.resend({
      type: 'signup',
      email: cleanEmail,
      options: { emailRedirectTo: redirectTo }
    });
    if (resendErr) {
      const { error: otpErr } = await sb.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo }
      });
      if (otpErr) {
        showAuthMsg(
          `⚠️ Account already exists but re-sending verification email failed: ${resendErr.message}. ` +
          'Please check your spam folder or try again later.',
          'warning'
        );
        return;
      }
    }
  }

  showAuthMsg(
    `🎉 Verification email sent to ${cleanEmail}! Please check your inbox (and spam folder) and click the "Verify" button. Once verified, you can sign in.`,
    'success'
  );

  // Clear password fields and switch to sign in
  const passFields = ['s-pass', 'a-pass', 'f-pass'];
  passFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  switchMainTab('signin');
}

function resolveSignInPrefillEmail(searchParams, hashParams) {
  const fromUrl = (searchParams?.get('email') || hashParams?.get('email') || '').trim().toLowerCase();
  if (fromUrl && isValidVvceEmail(fromUrl)) return fromUrl;

  try {
    const fromLocal = (localStorage.getItem('vvce_pending_verify_email') || '').trim().toLowerCase();
    if (fromLocal && isValidVvceEmail(fromLocal)) return fromLocal;
  } catch (e) {}

  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('vvce_pending_reg_')) {
        const candidate = k.slice('vvce_pending_reg_'.length).trim().toLowerCase();
        if (candidate && isValidVvceEmail(candidate)) return candidate;
      }
    }
  } catch (e) {}

  const fromInput = (document.getElementById('login-email')?.value || '').trim().toLowerCase();
  return (fromInput && isValidVvceEmail(fromInput)) ? fromInput : '';
}

// Function to handle the redirect back from email verification, Google OAuth, or Password Recovery
async function checkSupabaseEmailVerification() {
  const sb = getSupabaseClient();
  if (!sb || !sb.auth) return;

  let isRecoveryUrl = false;
  let recoveryLinkError = null;
  let urlAuthNotice = null;
  let prefillSignInEmail = '';

  // Inspect redirect URL params BEFORE Supabase auth handlers clean or process them
  try {
    const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search || '');
    isRecoveryUrl = hashParams.get('type') === 'recovery'
      || searchParams.get('type') === 'recovery'
      || searchParams.get('mode') === 'reset'
      || hashParams.get('mode') === 'reset';

    const errCode = (searchParams.get('error_code') || hashParams.get('error_code') || '').trim().toLowerCase();
    const errType = (searchParams.get('error') || hashParams.get('error') || '').trim().toLowerCase();
    const oauthErr = searchParams.get('error_description') || hashParams.get('error_description')
      || searchParams.get('error') || hashParams.get('error');

    let oauthFlow = '';
    try { oauthFlow = sessionStorage.getItem('vvce_oauth_flow') || ''; } catch (e) {}

    if (oauthErr || errCode) {
      prefillSignInEmail = resolveSignInPrefillEmail(searchParams, hashParams);
      cleanAuthUrlParams();
      try { sessionStorage.removeItem('vvce_oauth_flow'); } catch (e) {}

      if (isRecoveryUrl) {
        recoveryLinkError = '❌ Your password reset link is invalid or has expired. Please enter your @vvce.ac.in email to request a new link.';
      } else if (
        errCode === 'otp_expired'
        || (errType === 'access_denied' && oauthFlow !== 'google')
        || /otp_expired|email link is invalid or has expired/i.test(oauthErr || '')
      ) {
        urlAuthNotice = {
          msg: 'Your verification link has already been used or expired. Please try signing in with your password or Google.',
          type: 'warning'
        };
      } else {
        urlAuthNotice = {
          msg: '❌ Sign-in could not be completed: ' + (oauthErr || errCode),
          type: 'error'
        };
      }
    } else if (isRecoveryUrl) {
      window._isPasswordRecoveryActive = true;
    }
  } catch (e) {}

  // Listen for auth state changes (email verification, Google OAuth, and PASSWORD_RECOVERY)
  if (!window._authListenerSetup) {
    window._authListenerSetup = true;
    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        window._isPasswordRecoveryActive = true;
        if (session && session.user) {
          await openRecoveryResetView(session);
        }
        return;
      }
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && session.user) {
        if (window._isPasswordRecoveryActive || window._loginInProgress) return;
        await handleVerifiedSession(session, event);
      }
    });
  }

  if (recoveryLinkError) {
    handleForgotPassword();
    const step1Msg = document.getElementById('reset-step1-msg');
    if (step1Msg) {
      step1Msg.textContent = recoveryLinkError;
      step1Msg.className = 'auth-msg error';
      step1Msg.style.display = 'block';
    }
    showAuthMsg(recoveryLinkError, 'error');
    return;
  }

  if (urlAuthNotice) {
    switchMainTab('signin');
    if (prefillSignInEmail) {
      const loginEmailInp = document.getElementById('login-email');
      if (loginEmailInp && !loginEmailInp.value) {
        loginEmailInp.value = prefillSignInEmail;
      }
    }
    showAuthMsg(urlAuthNotice.msg, urlAuthNotice.type);
    return;
  }

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.user) {
      if (window._isPasswordRecoveryActive || isRecoveryUrl) {
        window._isPasswordRecoveryActive = true;
        await openRecoveryResetView(session);
      } else {
        await handleVerifiedSession(session, 'PAGE_LOAD');
      }
    } else if (isRecoveryUrl) {
      // Recovery URL opened without a valid session (e.g. already consumed or expired token)
      cleanAuthUrlParams();
      window._isPasswordRecoveryActive = false;
      handleForgotPassword();
      const step1Msg = document.getElementById('reset-step1-msg');
      if (step1Msg) {
        step1Msg.textContent = '❌ This password reset link has expired or is invalid. Please request a new reset link.';
        step1Msg.className = 'auth-msg error';
        step1Msg.style.display = 'block';
      }
    }
  } catch(e) {
    console.error('Email verification check failed:', e);
  }
}

async function handleVerifiedSession(session, trigger) {
  if (window._isPasswordRecoveryActive) return;
  if (_activeAuthSessionPromise) {
    return _activeAuthSessionPromise;
  }
  _activeAuthSessionPromise = (async () => {
    const sb = getSupabaseClient();
    if (!sb || !session?.user) return;

    const supaUser = session.user;
    const cleanEmail = (supaUser.email || '').trim().toLowerCase();
    const meta = supaUser.user_metadata || {};

    if (STATE.user && (STATE.user.email || '').toLowerCase() === cleanEmail) {
      return;
    }

    // Enforce @vvce.ac.in on all authenticated sessions (Google OAuth & Email)
    if (!isValidVvceEmail(cleanEmail)) {
      await cleanupSupabaseAuthSession();
      switchMainTab('signin');
      showAuthMsg('❌ Only @vvce.ac.in Google accounts are permitted.', 'error');
      return;
    }

    let pendingReg = null;
    try {
      const rawPending = sessionStorage.getItem('vvce_pending_reg_' + cleanEmail);
      if (rawPending) pendingReg = JSON.parse(rawPending);
    } catch (e) {}

    let oauthFlow = null;
    try { oauthFlow = sessionStorage.getItem('vvce_oauth_flow'); } catch (e) {}

    const provider = supaUser.app_metadata?.provider;
    const providers = supaUser.app_metadata?.providers || [];
    const isGoogleProvider = provider === 'google'
      || providers.includes('google')
      || (Array.isArray(supaUser.identities) && supaUser.identities.some(i => i.provider === 'google'));

    // Route Google OAuth sessions to pre-registration enforcement check
    if (oauthFlow === 'google' || (isGoogleProvider && (!meta || !meta.type) && !pendingReg)) {
      try { sessionStorage.removeItem('vvce_oauth_flow'); } catch (e) {}
      await googleLoginByEmail(
        cleanEmail,
        meta.full_name || meta.name || '',
        meta.avatar_url || meta.picture || null,
        supaUser.id
      );
      return;
    }

    // Only process email signup if email is verified
    if (!supaUser.email_confirmed_at && !supaUser.confirmed_at) return;

    const regMeta = (meta && meta.type && meta.email) ? meta : pendingReg;

    if (regMeta && regMeta.type && regMeta.email) {
      let existing = null;
      try {
        const { data: remoteRows } = await sb.from('users').select('*').ilike('email', cleanEmail).limit(1);
        if (remoteRows && remoteRows.length > 0) {
          existing = mapUser(remoteRows[0]);
        }
      } catch (e) {}

      let users = getDB('vvce_users');
      if (!existing) {
        existing = users.find(u => (u.email || '').toLowerCase() === cleanEmail) || null;
      }

      if (!existing) {
        // Brand new verified user — save profile (without pass) to Supabase Auth-backed tables & cache
        const rawPendingPass = regMeta.pass || null;
        const newUser = {
          ...regMeta,
          email: cleanEmail,
          pass: null,
          points: null,
          pointsBySem: null
        };

        const mapped = (typeof mapUserForSupabase === 'function')
          ? mapUserForSupabase(newUser)
          : {
              id: newUser.id, type: newUser.type, name: newUser.name, email: cleanEmail,
              usn: newUser.usn, branch: newUser.branch, section: newUser.section, year: newUser.year,
              sem: newUser.sem, admission_year: newUser.admissionYear, dept: newUser.dept, phone: newUser.phone,
              interests: newUser.interests, skills: newUser.skills, bio: newUser.bio, linkedin: newUser.linkedin,
              github: newUser.github, achievements: newUser.achievements, profile_photo: newUser.profilePhoto,
              resume: newUser.resume, points: null, points_by_sem: null,
              notifs: newUser.notifs, club_name: newUser.clubName, club_email: newUser.clubEmail,
              domain: newUser.domain, faculty: newUser.faculty, approved: newUser.approved, "desc": newUser.desc,
              designation: newUser.designation,
              authority_id: newUser.authorityId || newUser.authority_id || null,
              authority_name: newUser.authorityName || newUser.authority_name || null,
              approval_history: newUser.approvalHistory || newUser.approval_history || []
            };

        const { error: upsertErr } = await sb.from('users').upsert([mapped]);
        if (upsertErr) {
          showAuthMsg('❌ Could not complete registration: ' + upsertErr.message, 'error');
          return;
        }
        if (newUser.type === 'student') {
          await sb.from('registered_students').upsert([mapped]).catch(() => {});
        }
        if (pendingReg && rawPendingPass) {
          await sb.auth.updateUser({ password: rawPendingPass }).catch(() => {});
        }

        if (!users.some(u => u.id === newUser.id || (u.email || '').toLowerCase() === cleanEmail)) {
          users.push(newUser);
          SUPABASE_CACHE.vvce_users = users;
          try { localStorage.setItem('vvce_users', JSON.stringify(users)); } catch (e) {}
        }

        try {
          sessionStorage.removeItem('vvce_pending_reg_' + cleanEmail);
          sessionStorage.removeItem('vvce_oauth_flow');
          localStorage.removeItem('vvce_pending_verify_email');
        } catch (e) {}
        cleanAuthUrlParams();

        if (newUser.type === 'admin') {
          const authLabel = newUser.authorityName || 'your Approving Authority';
          showAuthMsg(`🎉 Email verified! Club registration submitted. Awaiting ${authLabel} approval.`, 'success');
          toast('✅ Email verified! Club account submitted for approval.', 'success');
        } else {
          toast('🎉 Email verified! Welcome to VVCE Events Hub!', 'success');
          launchApp(newUser);
        }
      } else {
        try {
          sessionStorage.removeItem('vvce_pending_reg_' + cleanEmail);
          sessionStorage.removeItem('vvce_oauth_flow');
          localStorage.removeItem('vvce_pending_verify_email');
        } catch (e) {}
        cleanAuthUrlParams();
        if (trigger !== 'PAGE_LOAD' && !STATE.user) {
          if (existing.type === 'admin' && !existing.approved) {
            await cleanupSupabaseAuthSession();
            showAuthMsg('Your club account is pending Approving Authority approval.', 'warning');
            return;
          }
          launchApp(existing);
        }
      }
    } else {
      // Verified Supabase session without signup metadata (e.g. email-only fallback)
      const users = getDB('vvce_users');
      let existing = users.find(u => (u.email || '').toLowerCase() === cleanEmail) || null;
      if (!existing) {
        try {
          const { data: remoteRows } = await sb.from('users').select('*').ilike('email', cleanEmail).limit(1);
          if (remoteRows && remoteRows.length > 0) existing = mapUser(remoteRows[0]);
        } catch (e) {}
      }
      if (existing && !STATE.user && trigger !== 'PAGE_LOAD') {
        cleanAuthUrlParams();
        toast('🎉 Email verified! Welcome back!', 'success');
        launchApp(existing);
      }
    }
  })().finally(() => {
    _activeAuthSessionPromise = null;
  });
  return _activeAuthSessionPromise;
}

/* ── Student Signup ── */
async function handleStudentSignup() {
  const name    = document.getElementById('s-name').value.trim();
  const usn     = document.getElementById('s-usn').value.trim().toUpperCase();
  const branch  = document.getElementById('s-branch').value;
  const section = document.getElementById('s-section').value;
  const year    = document.getElementById('s-year').value;
  const sem     = document.getElementById('s-sem').value;
  const dept    = document.getElementById('s-dept').value;
  const phone   = document.getElementById('s-phone').value.trim();
  const email   = document.getElementById('s-email').value.trim().toLowerCase();
  const pass    = document.getElementById('s-pass').value;
  const interests = [...document.querySelectorAll('#s-interests .interest-chip.selected')].map(c => c.textContent.trim());

  // ID card scanning requirement removed

  if (!name || !usn || !email || !pass) { showAuthMsg('Please fill all required fields.'); return; }
  if (!/^4[A-Z]{2}\d{2}[A-Z]{2,4}\d{3,4}$/i.test(usn)) {
    showAuthMsg('❌ Invalid USN format (e.g. 4EV25CS053 or 4VV25CS047).', 'error');
    return;
  }
  if (pass.length < 8) { showAuthMsg('Password must be at least 8 characters.'); return; }
  if (!isValidVvceEmail(email)) { showAuthMsg('❌ Only @vvce.ac.in email addresses are allowed.', 'error'); return; }

  let users = getDB('vvce_users');
  let existingUser = users.find(u => (u.email || '').toLowerCase() === email || (usn && (u.usn || '').toUpperCase() === usn));
  const sb = getSupabaseClient();
  if (sb && typeof sb.from === 'function') {
    try {
      const [{ data: uData, error: uErr }, { data: rData, error: rErr }] = await Promise.all([
        sb.from('users').select('id, email, usn').or(`email.ilike.${email},usn.ilike.${usn}`).limit(1),
        sb.from('registered_students').select('id, email, usn').or(`email.ilike.${email},usn.ilike.${usn}`).limit(1).catch(() => ({ data: [], error: null }))
      ]);
      const remoteFound = (uData && uData.length > 0) || (rData && rData.length > 0);
      if (remoteFound) {
        existingUser = (uData && uData[0]) || (rData && rData[0]);
      } else if (!uErr && existingUser) {
        // Stale non-demo local entry! Purge it from cache and localStorage
        const DEMO_IDS = ['u1', 'u2', 'u3', 'u4'];
        users = users.filter(u => DEMO_IDS.includes(u.id) || ((u.email || '').toLowerCase() !== email && (u.usn || '').toUpperCase() !== usn));
        SUPABASE_CACHE.vvce_users = users;
        try { localStorage.setItem('vvce_users', JSON.stringify(users)); } catch(e){}
        existingUser = users.find(u => (u.email || '').toLowerCase() === email || (usn && (u.usn || '').toUpperCase() === usn)) || null;
      }
    } catch(e) {}
  }

  if (existingUser) {
    showAuthMsg('This email or USN is already registered. Please sign in.', 'warning');
    return;
  }

  const newUser = {
    id: genId('u'), type: 'student', name: name.toUpperCase(), email, pass,
    usn, branch, section, year, sem, dept, phone, interests,
    admissionYear: (() => {
      // Derive admissionYear from selected year + current academic context
      const now = new Date();
      const curMonth = now.getMonth() + 1;
      const curAcadYear = curMonth >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      const yearNum = parseInt(year.charAt(0)) || 1; // "3rd Year" → 3
      return curAcadYear - (yearNum - 1);
    })(),
    skills: [], bio: '', linkedin: '', github: '', achievements: [],
    profilePhoto: null, resume: null,
    points: null, pointsBySem: null,
    notifs: [{ id: genId('n'), msg: 'Welcome to VVCE Events Hub! Start exploring events.', time: 'Just now', read: false, icon: '🎉' }]
  };

  finalizeRegistration('student', newUser);
}

/* ── Club Logo Upload Handler ── */
window._clubLogoBase64 = null;
window.handleClubLogoUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    window._clubLogoBase64 = e.target.result;
    const preview = document.getElementById('a-logo-preview');
    if (preview) {
      preview.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:10px;">`;
    }
    toast('Club logo uploaded!', 'success');
  };
  reader.readAsDataURL(file);
};

/* ── Club Admin Signup ── */
function handleAdminSignup() {
  const faculty   = document.getElementById('a-faculty').value.trim();
  const authorityId = document.getElementById('a-authority')?.value || '';
  const activeAuthorities = getActiveApprovingAuthorities();
  const selectedAuthority = activeAuthorities.find(a => a.id === authorityId);
  const name      = document.getElementById('a-name').value.trim();
  const club      = document.getElementById('a-club').value.trim();
  const domain    = document.getElementById('a-domain').value;
  const branch    = document.getElementById('a-branch').value;
  const usn       = document.getElementById('a-usn').value.trim().toUpperCase();
  const clubEmail = document.getElementById('a-club-email').value.trim().toLowerCase();
  const email     = document.getElementById('a-email').value.trim().toLowerCase();
  const phone     = document.getElementById('a-phone').value.trim();
  const desc      = document.getElementById('a-desc').value.trim();
  const pass      = document.getElementById('a-pass').value;

  if (!authorityId || !selectedAuthority) {
    showAuthMsg('⚠️ Please select a valid Approving Authority.', 'error');
    return;
  }
  if (!faculty) {
    showAuthMsg('⚠️ Please enter the Faculty Coordinator Name.', 'error');
    return;
  }

  // ID card scanning requirement removed

  if (!name || !club || !email || !pass || !usn) { showAuthMsg('Please fill all required fields.'); return; }
  if (pass.length < 6) { showAuthMsg('Password must be at least 6 characters.'); return; }
  if (!isValidVvceEmail(email)) { showAuthMsg('❌ Only @vvce.ac.in email addresses are allowed.', 'error'); return; }

  const users = getDB('vvce_users');
  if (users.find(u => u.email.toLowerCase() === email)) { showAuthMsg('This email is already registered.', 'warning'); return; }

  const newUser = {
    id: genId('u'), type: 'admin', name: name.toUpperCase(), email, pass,
    clubName: club, clubEmail, domain, branch, usn, faculty, phone, desc, approved: false,
    authorityId: selectedAuthority.id,
    authorityName: selectedAuthority.name,
    approvalHistory: [{
      action: 'submitted',
      authorityId: selectedAuthority.id,
      authorityName: selectedAuthority.name,
      timestamp: new Date().toISOString()
    }],
    clubLogo: window._clubLogoBase64 || null,
    profilePhoto: window._clubLogoBase64 || null,
    notifs: [{ id: genId('n'), msg: `Club registration submitted! Pending approval from ${selectedAuthority.name}.`, time: 'Just now', read: false, icon: '⏳' }]
  };

  finalizeRegistration('admin', newUser);
}

/* ── Authority Signup ── */
function handleAuthoritySignup() {
  const name  = document.getElementById('f-name').value.trim();
  const desig = document.getElementById('f-designation').value;
  const email = document.getElementById('f-email').value.trim().toLowerCase();
  const pass  = document.getElementById('f-pass').value;

  // ID card scanning requirement removed

  if (!name || !email || !pass) { showAuthMsg('Please fill all required fields.'); return; }
  if (pass.length < 8) { showAuthMsg('Password must be at least 8 characters.'); return; }
  if (!isValidVvceEmail(email)) { showAuthMsg('❌ Only @vvce.ac.in email addresses are allowed.', 'error'); return; }

  const users = getDB('vvce_users');
  if (users.find(u => u.email.toLowerCase() === email)) { showAuthMsg('This email is already registered.', 'warning'); return; }

  const newUser = {
    id: genId('u'), type: 'authority', name: name.toUpperCase(), email, pass,
    designation: desig, dept: 'Administration',
    notifs: [{ id: genId('n'), msg: 'Authority account created successfully.', time: 'Just now', read: false, icon: '✅' }]
  };

  finalizeRegistration('authority', newUser);
}

/* ── Forgot Password & Supabase Email Recovery Flow ── */
window._isPasswordRecoveryActive = false;
window._resetPasswordState = {
  email: '',
  targetType: '', // 'authority' | 'user'
  targetId: '',
  targetName: ''
};

function showResetStepMsg(msgElId, text, type = 'error') {
  const msgEl = document.getElementById(msgElId);
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.className = `auth-msg ${type}`;
  msgEl.style.display = 'block';
}

async function resolveResetTargetAccount(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const sb = getSupabaseClient();

  // 1. Check Approving Authorities first (Supabase + cache)
  await syncApprovingAuthoritiesFromSupabase();
  const activeAuthorities = getActiveApprovingAuthorities();
  let authMatch = activeAuthorities.find(a => a.email && a.email.toLowerCase() === cleanEmail);

  if (!authMatch && sb && typeof sb.from === 'function') {
    try {
      const { data } = await sb.from('approving_authorities').select('*').ilike('email', cleanEmail).limit(1);
      if (data && data.length > 0) authMatch = data[0];
    } catch (e) {
      console.warn('Supabase approving_authorities check error:', e);
    }
  }

  if (authMatch) {
    return {
      targetType: 'authority',
      account: authMatch,
      targetId: authMatch.id,
      targetName: authMatch.name || 'Approving Authority'
    };
  }

  // 2. Check registered users in Supabase directly (users, then registered_students)
  let userMatch = null;
  let remoteLookupSucceeded = false;

  if (sb && typeof sb.from === 'function') {
    try {
      const { data: uData, error: uErr } = await sb.from('users').select('*').ilike('email', cleanEmail).limit(1);
      if (!uErr) {
        remoteLookupSucceeded = true;
        if (uData && uData.length > 0) userMatch = mapUser(uData[0]);
      }
      if (!userMatch) {
        const { data: rData, error: rErr } = await sb.from('registered_students').select('*').ilike('email', cleanEmail).limit(1);
        if (!rErr) {
          remoteLookupSucceeded = true;
          if (rData && rData.length > 0) userMatch = mapUser(rData[0]);
        }
      }
    } catch (e) {
      console.warn('Supabase users check error:', e);
    }
  }

  if (!userMatch && !remoteLookupSucceeded) {
    const users = getDB('vvce_users');
    userMatch = users.find(u => u.email && u.email.toLowerCase() === cleanEmail) || null;
  }

  if (userMatch) {
    return {
      targetType: 'user',
      account: userMatch,
      targetId: userMatch.id,
      targetName: userMatch.name || 'Student / Staff'
    };
  }

  return null;
}

function handleForgotPassword() {
  const currentLoginEmail = (document.getElementById('login-email')?.value || '').trim();
  const emailInp = document.getElementById('reset-email-input');
  if (emailInp) {
    emailInp.value = currentLoginEmail;
  }

  const step1 = document.getElementById('reset-step-1');
  const step2 = document.getElementById('reset-step-2');
  if (step1) step1.style.display = 'block';
  if (step2) step2.style.display = 'none';

  const msg1 = document.getElementById('reset-step1-msg');
  if (msg1) { msg1.style.display = 'none'; msg1.textContent = ''; }
  const msg2 = document.getElementById('reset-step2-msg');
  if (msg2) { msg2.style.display = 'none'; msg2.textContent = ''; }

  const btn = document.getElementById('btn-send-reset-code');
  if (btn) { btn.disabled = false; btn.textContent = 'Send Reset Link →'; }

  const newPassInp = document.getElementById('reset-new-pass');
  if (newPassInp) newPassInp.value = '';
  const confirmPassInp = document.getElementById('reset-confirm-pass');
  if (confirmPassInp) confirmPassInp.value = '';

  openModal('modal-forgot-password');
  if (emailInp) setTimeout(() => emailInp.focus(), 150);
}
window.handleForgotPassword = handleForgotPassword;

async function closeForgotPasswordModal() {
  if (window._isPasswordRecoveryActive) {
    window._isPasswordRecoveryActive = false;
    window._recoveryViewOpenedFor = null;
    try { sessionStorage.removeItem('vvce_pw_reset_ctx'); } catch (e) {}
    await cleanupSupabaseAuthSession();
  }
  closeModal('modal-forgot-password');
}
window.closeForgotPasswordModal = closeForgotPasswordModal;

async function backToResetStep1() {
  if (window._isPasswordRecoveryActive) {
    window._isPasswordRecoveryActive = false;
    window._recoveryViewOpenedFor = null;
    await cleanupSupabaseAuthSession();
  }
  const step1 = document.getElementById('reset-step-1');
  const step2 = document.getElementById('reset-step-2');
  if (step1) step1.style.display = 'block';
  if (step2) step2.style.display = 'none';
  const msg2 = document.getElementById('reset-step2-msg');
  if (msg2) { msg2.style.display = 'none'; msg2.textContent = ''; }
}
window.backToResetStep1 = backToResetStep1;

async function sendResetVerificationCode() {
  const msgEl = document.getElementById('reset-step1-msg');
  if (msgEl) { msgEl.style.display = 'none'; msgEl.textContent = ''; }

  const email = (document.getElementById('reset-email-input')?.value || '').trim().toLowerCase();
  if (!email) {
    showResetStepMsg('reset-step1-msg', 'Please enter your VVCE email address.', 'error');
    return;
  }
  if (!isValidVvceEmail(email)) {
    showResetStepMsg('reset-step1-msg', '❌ Only @vvce.ac.in institutional email addresses are permitted.', 'error');
    return;
  }

  const btn = document.getElementById('btn-send-reset-code');
  if (btn) { btn.disabled = true; btn.textContent = 'Checking Account...'; }

  try {
    const sb = getSupabaseClient();
    if (!sb || !sb.auth) {
      showResetStepMsg('reset-step1-msg', 'Authentication service unavailable. Please check your Supabase configuration.', 'error');
      return;
    }

    const resolved = await resolveResetTargetAccount(email);
    if (!resolved) {
      showResetStepMsg(
        'reset-step1-msg',
        '❌ No registered account found with that @vvce.ac.in email. Please check your spelling or register first.',
        'error'
      );
      return;
    }

    window._resetPasswordState = {
      email,
      targetType: resolved.targetType,
      targetId: resolved.targetId,
      targetName: resolved.targetName
    };
    try {
      sessionStorage.setItem('vvce_pw_reset_ctx', JSON.stringify(window._resetPasswordState));
    } catch (e) {}

    if (btn) btn.textContent = 'Sending Reset Link...';

    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      if (error.status === 429 || /rate limit|over_email_send_rate_limit/i.test(error.message || '')) {
        showResetStepMsg(
          'reset-step1-msg',
          '⚠️ Too many reset requests right now. Please wait a couple of minutes and try again.',
          'warning'
        );
      } else {
        showResetStepMsg('reset-step1-msg', '❌ Could not send password reset email: ' + error.message, 'error');
      }
      return;
    }

    showResetStepMsg(
      'reset-step1-msg',
      `✅ Check your VVCE inbox for the reset link sent to ${email}. Click the link in your email (also check spam/junk) to set a new password.`,
      'success'
    );
    toast('Check your VVCE inbox for the reset link', 'success', 5000);
  } catch (err) {
    console.error('Password reset email error:', err);
    showResetStepMsg('reset-step1-msg', '❌ Failed to initiate password reset: ' + (err.message || 'Unknown error'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send Reset Link →'; }
  }
}
window.sendResetVerificationCode = sendResetVerificationCode;

async function openRecoveryResetView(session) {
  const recoveryEmail = (session?.user?.email || '').trim().toLowerCase();
  if (!isValidVvceEmail(recoveryEmail)) {
    window._isPasswordRecoveryActive = false;
    window._recoveryViewOpenedFor = null;
    await cleanupSupabaseAuthSession();
    showAuthMsg('❌ Only @vvce.ac.in institutional accounts can reset passwords here.', 'error');
    return;
  }

  const modalEl = document.getElementById('modal-forgot-password');
  const step2El = document.getElementById('reset-step-2');
  if (
    window._recoveryViewOpenedFor === recoveryEmail &&
    modalEl?.classList.contains('open') &&
    step2El?.style.display === 'block'
  ) {
    return;
  }
  window._recoveryViewOpenedFor = recoveryEmail;

  let ctx = null;
  try {
    const raw = sessionStorage.getItem('vvce_pw_reset_ctx');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email === recoveryEmail) ctx = parsed;
    }
  } catch (e) {}

  if (!ctx) {
    const resolved = await resolveResetTargetAccount(recoveryEmail);
    ctx = resolved
      ? {
          email: recoveryEmail,
          targetType: resolved.targetType,
          targetId: resolved.targetId,
          targetName: resolved.targetName
        }
      : {
          email: recoveryEmail,
          targetType: 'user',
          targetId: '',
          targetName: recoveryEmail
        };
  }

  window._resetPasswordState = ctx;

  // Ensure user is on Auth screen (not logged into app yet)
  STATE.user = null;
  const appEl = document.getElementById('app');
  const authEl = document.getElementById('auth-screen');
  if (appEl) appEl.style.display = 'none';
  if (authEl) authEl.style.display = 'flex';
  switchMainTab('signin');
  cleanAuthUrlParams();

  const targetNameEl = document.getElementById('reset-target-name');
  if (targetNameEl) targetNameEl.textContent = ctx.targetName || recoveryEmail;

  const bannerEl = document.getElementById('reset-code-banner');
  if (bannerEl) {
    bannerEl.innerHTML = `Reset link verified for <strong>${recoveryEmail}</strong>. Enter and confirm your new password below.`;
  }

  const msg1 = document.getElementById('reset-step1-msg');
  if (msg1) { msg1.style.display = 'none'; msg1.textContent = ''; }
  const msg2 = document.getElementById('reset-step2-msg');
  if (msg2) { msg2.style.display = 'none'; msg2.textContent = ''; }

  const newPassInp = document.getElementById('reset-new-pass');
  if (newPassInp) newPassInp.value = '';
  const confirmPassInp = document.getElementById('reset-confirm-pass');
  if (confirmPassInp) confirmPassInp.value = '';

  const step1 = document.getElementById('reset-step-1');
  const step2 = document.getElementById('reset-step-2');
  if (step1) step1.style.display = 'none';
  if (step2) step2.style.display = 'block';

  openModal('modal-forgot-password');
  if (newPassInp) setTimeout(() => newPassInp.focus(), 150);
}
window.openRecoveryResetView = openRecoveryResetView;

async function executePasswordReset() {
  const msgEl = document.getElementById('reset-step2-msg');
  if (msgEl) { msgEl.style.display = 'none'; msgEl.textContent = ''; }

  const newPass = document.getElementById('reset-new-pass')?.value || '';
  const confirmPass = document.getElementById('reset-confirm-pass')?.value || '';

  const sb = getSupabaseClient();
  if (!sb || !sb.auth) {
    showResetStepMsg('reset-step2-msg', '❌ Authentication service unavailable. Please try again later.', 'error');
    return;
  }

  const { data: sessionData } = await sb.auth.getSession();
  const session = sessionData?.session;
  if (!window._isPasswordRecoveryActive || !session || !session.user) {
    showResetStepMsg(
      'reset-step2-msg',
      '❌ Your password reset link has expired or is invalid. Please click Back and request a new reset link.',
      'error'
    );
    return;
  }

  if (!newPass || newPass.length < 8) {
    showResetStepMsg('reset-step2-msg', '❌ Password must be at least 8 characters long.', 'error');
    return;
  }

  if (newPass !== confirmPass) {
    showResetStepMsg('reset-step2-msg', '❌ Passwords do not match. Please re-enter.', 'error');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-reset');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Updating Password...'; }

  try {
    const recoveryEmail = (session.user.email || window._resetPasswordState.email || '').trim().toLowerCase();
    if (!isValidVvceEmail(recoveryEmail)) {
      showResetStepMsg('reset-step2-msg', '❌ Only @vvce.ac.in accounts are permitted.', 'error');
      return;
    }

    // 1. Update password securely in Supabase Auth
    const { error: authUpdErr } = await sb.auth.updateUser({ password: newPass });
    if (authUpdErr) {
      const msg = /expired|invalid|token|session/i.test(authUpdErr.message || '')
        ? '❌ Your reset link has expired or is invalid. Please go back and request a new reset link.'
        : '❌ Could not update password: ' + authUpdErr.message;
      showResetStepMsg('reset-step2-msg', msg, 'error');
      return;
    }

    // 2. Sync application record so standard email/password & authority logins use the new password
    let { targetType, targetId } = window._resetPasswordState;
    if (!targetId) {
      const resolved = await resolveResetTargetAccount(recoveryEmail);
      if (resolved) {
        targetType = resolved.targetType;
        targetId = resolved.targetId;
      }
    }

    if (targetType === 'authority') {
      // Authority password reset: Salt + PBKDF2 hash (no plaintext pass column on approving_authorities)
      const salt = 'salt_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const { hash } = await hashPasswordWithSalt(newPass, salt);
      const updatedAt = new Date().toISOString();

      if (typeof sb.from === 'function') {
        const query = sb.from('approving_authorities').update({
          password_hash: hash,
          salt: salt,
          updated_at: updatedAt
        });
        const { error: authTblErr } = targetId
          ? await query.eq('id', targetId)
          : await query.ilike('email', recoveryEmail);
        if (authTblErr) console.warn('approving_authorities update warning:', authTblErr.message);
      }

      if (Array.isArray(APPROVING_AUTHORITIES_CACHE)) {
        const item = APPROVING_AUTHORITIES_CACHE.find(
          a => (targetId && a.id === targetId) || (a.email && a.email.toLowerCase() === recoveryEmail)
        );
        if (item) {
          item.password_hash = hash;
          item.salt = salt;
          delete item.pass;
          item.updated_at = updatedAt;
        }
      }
      const rawAuth = localStorage.getItem('vvce_approving_authorities');
      if (rawAuth) {
        try {
          const list = JSON.parse(rawAuth);
          const target = list.find(
            a => (targetId && a.id === targetId) || (a.email && a.email.toLowerCase() === recoveryEmail)
          );
          if (target) {
            target.password_hash = hash;
            target.salt = salt;
            delete target.pass;
            target.updated_at = updatedAt;
            localStorage.setItem('vvce_approving_authorities', JSON.stringify(list));
          }
        } catch (e) {}
      }

      // Authority credentials live strictly in approving_authorities / auth.users; clear any legacy cached pass
      const users = getDB('vvce_users');
      const uIdx = users.findIndex(
        u => (targetId && u.id === targetId) || (u.email && u.email.toLowerCase() === recoveryEmail)
      );
      if (uIdx > -1) {
        users[uIdx].pass = null;
        SUPABASE_CACHE.vvce_users = users;
        try { localStorage.setItem('vvce_users', JSON.stringify(users)); } catch (e) {}
      }
    } else {
      // Regular user password relies strictly on Supabase Auth (auth.users); do not write pass to public.users
      const users = getDB('vvce_users');
      const uIdx = users.findIndex(
        u => (targetId && u.id === targetId) || (u.email && u.email.toLowerCase() === recoveryEmail)
      );
      if (uIdx > -1) {
        users[uIdx].pass = null;
        SUPABASE_CACHE.vvce_users = users;
        try { localStorage.setItem('vvce_users', JSON.stringify(users)); } catch (e) {}
      }
    }

    // 3. End recovery session, clear URL hash & state, and redirect cleanly to Sign In
    window._isPasswordRecoveryActive = false;
    window._recoveryViewOpenedFor = null;
    window._resetPasswordState = { email: '', targetType: '', targetId: '', targetName: '' };
    try { sessionStorage.removeItem('vvce_pw_reset_ctx'); } catch (e) {}
    await cleanupSupabaseAuthSession();

    closeModal('modal-forgot-password');
    switchMainTab('signin');

    const loginEmail = document.getElementById('login-email');
    if (loginEmail) loginEmail.value = recoveryEmail;
    const loginPass = document.getElementById('login-pass');
    if (loginPass) {
      loginPass.value = '';
      setTimeout(() => loginPass.focus(), 250);
    }

    showAuthMsg(`✅ Password updated successfully for ${recoveryEmail}! Please sign in with your new password.`, 'success');
    toast('Password reset successfully! Please sign in.', 'success', 5000);
  } catch (err) {
    console.error('Password reset execution failed:', err);
    showResetStepMsg('reset-step2-msg', '❌ Failed to reset password: ' + (err.message || 'Unknown error'), 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save New Password ✓'; }
  }
}
window.executePasswordReset = executePasswordReset;

/* ── Password visibility toggle ── */
function togglePass(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const isPass = inp.type === 'password';
  inp.type = isPass ? 'text' : 'password';
  if (btn) {
    if (isPass) {
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
      btn.title = "Hide Password";
    } else {
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      btn.title = "Show Password";
    }
  }
}


/* ─────────────────────────────────────────────────────────────
   GOOGLE SIGN-IN (GIS / SUPABASE OAUTH — RETURNING USERS ONLY)
───────────────────────────────────────────────────────────────*/
function initGoogleAuth() {
  if (typeof google === 'undefined' || !GOOGLE_CLIENT_ID) return;
  try {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleSignIn,
      hd: 'vvce.ac.in',      /* hint: restrict picker to this domain */
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    const el = document.getElementById('g_id_onload');
    if (el) el.setAttribute('data-client_id', GOOGLE_CLIENT_ID);
  } catch(e) { /* GIS not available */ }
}

async function startSupabaseGoogleOAuth() {
  const sb = getSupabaseClient();
  if (!sb || !sb.auth) {
    showAuthMsg('Google Sign-In is unavailable because authentication service is not initialized.', 'error');
    return;
  }
  try { sessionStorage.setItem('vvce_oauth_flow', 'google'); } catch (e) {}
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
      queryParams: {
        hd: 'vvce.ac.in',
        prompt: 'select_account'
      }
    }
  });
  if (error) {
    try { sessionStorage.removeItem('vvce_oauth_flow'); } catch (e) {}
    showAuthMsg('❌ Google sign-in error: ' + error.message, 'error');
  }
}

/* Called when user clicks the Google button */
window.triggerGoogleSignIn = async function() {
  clearAuthMsg();
  if (typeof google !== 'undefined' && GOOGLE_CLIENT_ID) {
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        startSupabaseGoogleOAuth();
      }
    });
    return;
  }
  await startSupabaseGoogleOAuth();
};

/* Called by GIS with JWT credential after Google Identity Services popup */
window.handleGoogleSignIn = async function(response) {
  try {
    const parts = response.credential.split('.');
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    const payload = JSON.parse(jsonPayload);
    const email   = (payload.email || '').trim().toLowerCase();
    const name    = payload.name || '';
    const photo   = payload.picture || null;
    const googleId = payload.sub || null;

    if (payload.email_verified === false || !isValidVvceEmail(email)) {
      await cleanupSupabaseAuthSession();
      showAuthMsg('❌ Only @vvce.ac.in Google accounts are permitted.', 'error');
      return;
    }
    await googleLoginByEmail(email, name, photo, googleId);
  } catch(e) {
    showAuthMsg('Google sign-in failed. Please try again.', 'error');
  }
};

/* Pre-registration check & login for verified Google OAuth users (NEVER auto-create) */
async function googleLoginByEmail(email, name = '', photo = null, googleId = null) {
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!isValidVvceEmail(cleanEmail)) {
    await cleanupSupabaseAuthSession();
    switchMainTab('signin');
    showAuthMsg('❌ Only @vvce.ac.in Google accounts are permitted.', 'error');
    return;
  }

  const sb = getSupabaseClient();
  let user = null;
  let remoteLookupSucceeded = false;

  // Query Supabase registered profiles directly (users first, then registered_students)
  if (sb && typeof sb.from === 'function') {
    try {
      const { data: uData, error: uErr } = await sb
        .from('users')
        .select('*')
        .ilike('email', cleanEmail)
        .limit(1);

      if (!uErr) {
        remoteLookupSucceeded = true;
        if (uData && uData.length > 0) {
          user = mapUser(uData[0]);
        }
      }

      if (!user) {
        const { data: rData, error: rErr } = await sb
          .from('registered_students')
          .select('*')
          .ilike('email', cleanEmail)
          .limit(1);
        if (!rErr) {
          remoteLookupSucceeded = true;
          if (rData && rData.length > 0) {
            user = mapUser(rData[0]);
          }
        }
      }
    } catch (err) {
      console.warn('Supabase pre-registration check error:', err);
    }
  }

  // Only check local cache if Supabase was unavailable/offline
  if (!user && !remoteLookupSucceeded) {
    const localUsers = getDB('vvce_users');
    user = localUsers.find(u => (u.email || '').toLowerCase() === cleanEmail) || null;
  }

  // Enforce two-step flow: unregistered users MUST register first
  if (!user) {
    await cleanupSupabaseAuthSession();

    // Remove any stale non-demo local entry for this email
    const DEMO_IDS = ['u1', 'u2', 'u3', 'u4'];
    if (Array.isArray(SUPABASE_CACHE.vvce_users)) {
      SUPABASE_CACHE.vvce_users = SUPABASE_CACHE.vvce_users.filter(
        u => DEMO_IDS.includes(u.id) || (u.email || '').toLowerCase() !== cleanEmail
      );
      try { localStorage.setItem('vvce_users', JSON.stringify(SUPABASE_CACHE.vvce_users)); } catch (e) {}
    }

    switchMainTab('register');
    selectRegRole('student');
    const sEmailInp = document.getElementById('s-email');
    if (sEmailInp) sEmailInp.value = cleanEmail;
    const sNameInp = document.getElementById('s-name');
    if (sNameInp && !sNameInp.value && name) sNameInp.value = name.toUpperCase();

    showAuthMsg(
      'Account not found. Please complete the registration form first using your @vvce.ac.in email.',
      'error'
    );
    return;
  }

  if (user.type === 'admin' && !user.approved) {
    await cleanupSupabaseAuthSession();
    switchMainTab('signin');
    showAuthMsg('Your club account is pending Approving Authority approval. Please wait.', 'warning');
    return;
  }

  // Link google_id and initial profile photo if available
  const profileUpdates = {};
  if (googleId && !user.googleId) {
    user.googleId = googleId;
    profileUpdates.google_id = googleId;
  }
  if (photo && !user.profilePhoto) {
    user.profilePhoto = photo;
    profileUpdates.profile_photo = photo;
  }

  // Keep local cache synchronized with remote user row
  const users = getDB('vvce_users');
  const existingIdx = users.findIndex(u => u.id === user.id || (u.email || '').toLowerCase() === cleanEmail);
  if (existingIdx > -1) {
    users[existingIdx] = user;
  } else {
    users.push(user);
  }
  SUPABASE_CACHE.vvce_users = users;
  if (typeof safeLocalStorageSet === 'function') safeLocalStorageSet('vvce_users', users);

  if (sb && typeof sb.from === 'function' && Object.keys(profileUpdates).length > 0) {
    try {
      const { error: updErr } = await sb.from('users').update(profileUpdates).eq('id', user.id);
      // Graceful fallback if google_id migration hasn't been executed in Supabase yet
      if (updErr && profileUpdates.profile_photo) {
        await sb.from('users').update({ profile_photo: profileUpdates.profile_photo }).eq('id', user.id).catch(() => {});
      }
    } catch (e) {}
  }

  cleanAuthUrlParams();
  await launchApp(user);
}

