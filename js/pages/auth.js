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

/* ── Login ── */
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) { showAuthMsg('Please enter your email and password.'); return; }
  if (!email.endsWith('@vvce.ac.in')) {
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
    } else if (matchedAuthority.pass) {
      isValid = (pass === matchedAuthority.pass);
    } else if (matchedAuthority.id === 'auth_dean_sw' && (pass === 'deanwellfair@vvce' || pass === 'demo1234')) {
      isValid = true;
    }

    if (isValid) {
      // Find or build an authority user object for state
      let users = getDB('vvce_users');
      let authUser = users.find(u => u.email.toLowerCase() === email && u.type === 'authority');
      if (!authUser) {
        authUser = {
          id: matchedAuthority.id || genId('u'),
          type: 'authority',
          name: matchedAuthority.name,
          email: matchedAuthority.email,
          pass: pass,
          designation: matchedAuthority.designation || 'Approving Authority',
          dept: 'Administration',
          phone: '',
          notifs: []
        };
        users.push(authUser);
        setDB('vvce_users', users);
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

  // 2. Standard user login check (Students, Club Admins, Faculty)
  let users = getDB('vvce_users');
  let user = users.find(u => u.email.toLowerCase() === email && u.pass === pass);

  // Fallback to direct Supabase lookup
  if (!user) {
    const sb = getSupabaseClient();
    if (sb && typeof sb.from === 'function') {
      try {
        const { data } = await sb.from('users').select('*').ilike('email', email);
        if (data && data.length > 0) {
          const remoteUser = mapUser(data[0]);
          if (remoteUser.pass === pass) {
            user = remoteUser;
            if (!users.some(u => u.id === user.id)) {
              users.push(user);
              SUPABASE_CACHE.vvce_users = users;
              try { localStorage.setItem('vvce_users', JSON.stringify(users)); } catch(e){}
            }
          }
        }
      } catch (err) {
        console.error('Supabase direct login check failed:', err);
      }
    }
  }

  if (!user) {
    showAuthMsg('Invalid email or password. Please verify your credentials or register an account.');
    return;
  }

  if (user.type === 'admin' && !user.approved) {
    showAuthMsg('Your club account is pending Dean Student Welfare approval. Please wait.', 'warning');
    return;
  }

  launchApp(user);
}

/* Quick demo login */
function quickLogin(role) {
  const maps = {
    student:   { email: 'akash@vvce.ac.in', pass: 'demo1234' },
    admin:     { email: 'harshill@vvce.ac.in', pass: 'demo1234' },
    authority: { email: 'dean.sw@vvce.ac.in', pass: 'demo1234' },
    dean:      { email: 'dean.sw@vvce.ac.in', pass: 'demo1234' }
  };

  const target = maps[role] || maps.student;
  const emailInput = document.getElementById('login-email');
  const passInput  = document.getElementById('login-pass');
  if (emailInput) emailInput.value = target.email;
  if (passInput) passInput.value  = target.pass;

  // If logging in as Approving Authority demo, directly authenticate & unlock authority portal
  if (role === 'authority' || role === 'dean') {
    let users = getDB('vvce_users');
    let authUser = users.find(u => u.email.toLowerCase() === target.email.toLowerCase() && u.type === 'authority');
    if (!authUser) {
      authUser = {
        id: 'u3',
        type: 'authority',
        name: 'Dr. Priya Nair',
        email: 'dean.sw@vvce.ac.in',
        pass: 'demo1234',
        designation: 'Dean Student Welfare',
        dept: 'Student Welfare',
        phone: '+91 98765 43212',
        notifs: []
      };
      users.push(authUser);
      setDB('vvce_users', users);
    }

    // Auto-unlock demo authority credentials
    STATE.authorityUnlocked = true;
    STATE.currentAuthorityId = 'auth_dean_sw';
    STATE.currentAuthorityName = 'Dean Student Welfare';

    launchApp(authUser);
    showPage('authority-portal');
    toast('Logged in as Approving Authority (Dean Student Welfare) ✓', 'success');
    return;
  }

  handleLogin();
}


/* ─────────────────────────────────────────────────────────────
   SUPABASE EMAIL VERIFICATION (MAGIC LINK SIGNUP)
───────────────────────────────────────────────────────────────*/
async function finalizeRegistration(role, userPayload) {
  const sb = getSupabaseClient();
  if (!sb || !sb.auth) {
    showAuthMsg('Supabase is not configured. Cannot process sign up.', 'error');
    return;
  }

  toast('Sending verification email...', 'info');

  // Supabase Auth SignUp
  const { data, error } = await sb.auth.signUp({
    email: userPayload.email,
    password: userPayload.pass,
    options: {
      data: userPayload // Store all user details in metadata so we can access them after email verification
    }
  });

  if (error) {
    // Handle rate limit error specifically with a clear explanation
    if (error.status === 429 || error.message?.includes('rate limit') || error.message?.includes('over_email_send_rate_limit')) {
      showAuthMsg(
        '⚠️ Email sending is temporarily limited (Supabase free tier allows ~3 emails/hour). ' +
        'Please wait a few minutes and try again, or ask your administrator to connect a custom SMTP provider (e.g. Resend) in Supabase settings.',
        'warning'
      );
    } else if (error.message?.includes('already registered')) {
      showAuthMsg('This email is already registered. Please sign in instead.', 'warning');
    } else {
      showAuthMsg('❌ Signup error: ' + error.message, 'error');
    }
    return;
  }

  // If the user already exists in Supabase Auth (but maybe didn't verify yet), Supabase returns success but DOES NOT send an email!
  // We can detect this because data.user.identities will be empty.
  if (data?.user?.identities?.length === 0) {
    // Force Supabase to resend the verification email for this existing unverified account
    const { error: resendErr } = await sb.auth.resend({ type: 'signup', email: userPayload.email });
    if (resendErr) {
      showAuthMsg(
        `⚠️ Account already exists but re-sending verification email failed: ${resendErr.message}. ` +
        'Please check your spam folder or try again later.',
        'warning'
      );
      return;
    }
  }

  showAuthMsg(
    `🎉 Verification email sent to ${userPayload.email}! Please check your inbox (and spam folder) and click the "Verify" button. Once verified, you can sign in.`,
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

// Function to handle the redirect back from email verification
async function checkSupabaseEmailVerification() {
  const sb = getSupabaseClient();
  if (!sb || !sb.auth) return;

  // ── Listen for auth state changes (fires immediately when email link is clicked) ──
  // This handles the case where the user is redirected back to the site after clicking
  // the verification email link — Supabase fires SIGNED_IN with the verified session.
  if (!window._authListenerSetup) {
    window._authListenerSetup = true;
    sb.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && session.user) {
        await handleVerifiedSession(session, event);
      }
    });
  }

  try {
    // Also check immediately on page load (handles page reload after email click)
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.user) {
      await handleVerifiedSession(session, 'PAGE_LOAD');
    }
  } catch(e) {
    console.error('Email verification check failed:', e);
  }
}

async function handleVerifiedSession(session, trigger) {
  const sb = getSupabaseClient();
  if (!sb) return;

  const supaUser = session.user;
  const meta = supaUser.user_metadata || {};

  // Only process if the user has verified their email
  if (!supaUser.email_confirmed_at && !supaUser.confirmed_at) return;

  // If meta has our custom type/email (set during signUp), use it to build the profile
  if (meta && meta.type && meta.email) {
    let users = getDB('vvce_users');
    let existing = users.find(u => u.email.toLowerCase() === supaUser.email.toLowerCase());

    if (!existing) {
      // Brand new verified user — save their full profile
      const newUser = { ...meta };
      users.push(newUser);
      setDB('vvce_users', users);

      const mapped = {
        id: meta.id, type: meta.type, name: meta.name, email: meta.email, pass: meta.pass,
        usn: meta.usn, branch: meta.branch, section: meta.section, year: meta.year,
        sem: meta.sem, admission_year: meta.admissionYear, dept: meta.dept, phone: meta.phone,
        interests: meta.interests, skills: meta.skills, bio: meta.bio, linkedin: meta.linkedin,
        github: meta.github, achievements: meta.achievements, profile_photo: meta.profilePhoto,
        resume: meta.resume, points: meta.points, points_by_sem: meta.pointsBySem,
        notifs: meta.notifs, club_name: meta.clubName, club_email: meta.clubEmail,
        domain: meta.domain, faculty: meta.faculty, approved: meta.approved, desc: meta.desc,
        designation: meta.designation,
        authority_id: meta.authorityId || meta.authority_id || null,
        authority_name: meta.authorityName || meta.authority_name || null,
        approval_history: meta.approvalHistory || meta.approval_history || []
      };
      await sb.from('users').upsert([mapped]);
      if (newUser.type === 'student') {
        await sb.from('registered_students').upsert([mapped]).catch(() => {});
      }

      // Clean URL hash so it doesn't re-trigger on refresh
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }

      if (newUser.type === 'admin') {
        const authLabel = newUser.authorityName || 'your Approving Authority';
        showAuthMsg(`🎉 Email verified! Club registration submitted. Awaiting ${authLabel} approval.`, 'success');
        toast('✅ Email verified! Club account submitted for approval.', 'success');
      } else {
        toast('🎉 Email verified! Welcome to VVCE Events Hub!', 'success');
        // Open the app immediately — no delay needed
        launchApp(newUser);
      }
    } else if (existing && trigger !== 'PAGE_LOAD') {
      // Returning verified user — already in DB, just launch immediately
      if (!STATE.user) {
        launchApp(existing);
      }
    }
  } else {
    // Supabase verified session but no custom metadata (direct Supabase Auth signup)
    // Try to find them in local DB by email
    const users = getDB('vvce_users');
    const existing = users.find(u => u.email.toLowerCase() === supaUser.email.toLowerCase());
    if (existing && !STATE.user && trigger !== 'PAGE_LOAD') {
      toast('🎉 Email verified! Welcome back!', 'success');
      launchApp(existing);
    }
  }
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
  if (pass.length < 6) { showAuthMsg('Password must be at least 6 characters.'); return; }
  if (!email.endsWith('@vvce.ac.in')) { showAuthMsg('❌ Only @vvce.ac.in email addresses are allowed.', 'error'); return; }

  let users = getDB('vvce_users');
  let existingUser = users.find(u => u.email.toLowerCase() === email || (usn && u.usn === usn));
  if (existingUser) {
    const sb = getSupabaseClient();
    if (sb && typeof sb.from === 'function') {
      try {
        const { data, error } = await sb.from('users').select('id, email, usn').or(`email.ilike.${email},usn.eq.${usn}`);
        if (!error && (!data || data.length === 0)) {
          // Stale local entry! Purge it from cache and localStorage
          users = users.filter(u => u.email.toLowerCase() !== email && u.usn !== usn);
          SUPABASE_CACHE.vvce_users = users;
          try { localStorage.setItem('vvce_users', JSON.stringify(users)); } catch(e){}
          existingUser = null;
        }
      } catch(e) {}
    }
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
  if (!email.endsWith('@vvce.ac.in')) { showAuthMsg('❌ Only @vvce.ac.in email addresses are allowed.', 'error'); return; }

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
  if (!email.endsWith('@vvce.ac.in')) { showAuthMsg('❌ Only @vvce.ac.in email addresses are allowed.', 'error'); return; }

  const users = getDB('vvce_users');
  if (users.find(u => u.email.toLowerCase() === email)) { showAuthMsg('This email is already registered.', 'warning'); return; }

  const newUser = {
    id: genId('u'), type: 'authority', name: name.toUpperCase(), email, pass,
    designation: desig, dept: 'Administration',
    notifs: [{ id: genId('n'), msg: 'Authority account created successfully.', time: 'Just now', read: false, icon: '✅' }]
  };

  finalizeRegistration('authority', newUser);
}

/* ── Forgot Password & Instant Verification / Reset Flow (Method B) ── */
window._resetPasswordState = {
  email: '',
  targetType: '', // 'authority' | 'user'
  targetId: '',
  targetName: '',
  code: '',
  expiresAt: 0
};

function handleForgotPassword() {
  const currentLoginEmail = (document.getElementById('login-email')?.value || '').trim();
  const emailInp = document.getElementById('reset-email-input');
  if (emailInp) {
    emailInp.value = currentLoginEmail;
  }

  // Reset UI elements to step 1
  const step1 = document.getElementById('reset-step-1');
  const step2 = document.getElementById('reset-step-2');
  if (step1) step1.style.display = 'block';
  if (step2) step2.style.display = 'none';

  const msg1 = document.getElementById('reset-step1-msg');
  if (msg1) { msg1.style.display = 'none'; msg1.textContent = ''; }
  const msg2 = document.getElementById('reset-step2-msg');
  if (msg2) { msg2.style.display = 'none'; msg2.textContent = ''; }

  const otpInp = document.getElementById('reset-otp-input');
  if (otpInp) otpInp.value = '';
  const newPassInp = document.getElementById('reset-new-pass');
  if (newPassInp) newPassInp.value = '';
  const confirmPassInp = document.getElementById('reset-confirm-pass');
  if (confirmPassInp) confirmPassInp.value = '';

  openModal('modal-forgot-password');
  if (emailInp) setTimeout(() => emailInp.focus(), 150);
}
window.handleForgotPassword = handleForgotPassword;

function backToResetStep1() {
  const step1 = document.getElementById('reset-step-1');
  const step2 = document.getElementById('reset-step-2');
  if (step1) step1.style.display = 'block';
  if (step2) step2.style.display = 'none';
}
window.backToResetStep1 = backToResetStep1;

async function sendResetVerificationCode() {
  const msgEl = document.getElementById('reset-step1-msg');
  if (msgEl) { msgEl.style.display = 'none'; msgEl.textContent = ''; }

  const email = (document.getElementById('reset-email-input')?.value || '').trim().toLowerCase();
  if (!email) {
    if (msgEl) {
      msgEl.textContent = 'Please enter your VVCE email address.';
      msgEl.className = 'auth-msg error';
      msgEl.style.display = 'block';
    }
    return;
  }
  if (!email.endsWith('@vvce.ac.in')) {
    if (msgEl) {
      msgEl.textContent = '❌ Only @vvce.ac.in institutional email addresses are permitted.';
      msgEl.className = 'auth-msg error';
      msgEl.style.display = 'block';
    }
    return;
  }

  const btn = document.getElementById('btn-send-reset-code');
  if (btn) { btn.disabled = true; btn.textContent = 'Verifying Account...'; }

  try {
    let matchedAccount = null;
    let targetType = 'user';

    // 1. Check Approving Authorities first (Supabase & local cache)
    await syncApprovingAuthoritiesFromSupabase();
    const activeAuthorities = getActiveApprovingAuthorities();
    let authMatch = activeAuthorities.find(a => a.email && a.email.toLowerCase() === email);

    if (!authMatch) {
      const sb = getSupabaseClient();
      if (sb && typeof sb.from === 'function') {
        try {
          const { data } = await sb.from('approving_authorities').select('*').ilike('email', email);
          if (data && data.length > 0) authMatch = data[0];
        } catch(e) { console.warn('Supabase approving_authorities check error:', e); }
      }
    }

    if (authMatch) {
      matchedAccount = authMatch;
      targetType = 'authority';
    } else {
      // 2. Check regular users in local DB
      let users = getDB('vvce_users');
      let userMatch = users.find(u => u.email && u.email.toLowerCase() === email);

      // Check Supabase users table fallback
      if (!userMatch) {
        const sb = getSupabaseClient();
        if (sb && typeof sb.from === 'function') {
          try {
            const { data } = await sb.from('users').select('*').ilike('email', email);
            if (data && data.length > 0) {
              userMatch = mapUser(data[0]);
              if (!users.some(u => u.id === userMatch.id)) {
                users.push(userMatch);
                SUPABASE_CACHE.vvce_users = users;
                try { localStorage.setItem('vvce_users', JSON.stringify(users)); } catch(e){}
              }
            }
          } catch(e) { console.warn('Supabase users check error:', e); }
        }
      }

      if (userMatch) {
        matchedAccount = userMatch;
        targetType = 'user';
      }
    }

    if (!matchedAccount) {
      if (msgEl) {
        msgEl.textContent = '❌ No registered account found with that email. Please check your spelling or register.';
        msgEl.className = 'auth-msg error';
        msgEl.style.display = 'block';
      }
      if (btn) { btn.disabled = false; btn.textContent = 'Verify Account & Send Code →'; }
      return;
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    window._resetPasswordState = {
      email,
      targetType,
      targetId: matchedAccount.id,
      targetName: matchedAccount.name || (targetType === 'authority' ? 'Approving Authority' : 'Student/Staff'),
      code,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    };

    // Attempt sending email via /api/send-otp
    try {
      fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          otp: code,
          name: _resetPasswordState.targetName
        })
      }).catch(err => console.warn('OTP API warning (non-blocking):', err));
    } catch(e) {}

    // Update Step 2 UI
    const targetNameEl = document.getElementById('reset-target-name');
    if (targetNameEl) targetNameEl.textContent = _resetPasswordState.targetName;

    const bannerEl = document.getElementById('reset-code-banner');
    if (bannerEl) {
      bannerEl.innerHTML = 
        `Verification code sent to <strong>${email}</strong>.<br>` +
        `<span style="display:inline-block; margin-top:4px; font-weight:700; color:#1e1b4b; background:#e0e7ff; padding:3px 8px; border-radius:6px; font-size:12px;">Instant Code: <strong style="letter-spacing:1px; color:#4338ca;">${code}</strong></span>`;
    }

    const step1 = document.getElementById('reset-step-1');
    const step2 = document.getElementById('reset-step-2');
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'block';

    const otpInp = document.getElementById('reset-otp-input');
    if (otpInp) {
      otpInp.value = '';
      setTimeout(() => otpInp.focus(), 150);
    }
    toast(`Verification code generated for ${email}`, 'info');
  } catch(err) {
    console.error('Password reset code error:', err);
    if (msgEl) {
      msgEl.textContent = 'Failed to initiate password reset: ' + (err.message || 'Unknown error');
      msgEl.className = 'auth-msg error';
      msgEl.style.display = 'block';
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Verify Account & Send Code →'; }
  }
}
window.sendResetVerificationCode = sendResetVerificationCode;

async function executePasswordReset() {
  const msgEl = document.getElementById('reset-step2-msg');
  if (msgEl) { msgEl.style.display = 'none'; msgEl.textContent = ''; }

  const otp = (document.getElementById('reset-otp-input')?.value || '').trim();
  const newPass = document.getElementById('reset-new-pass')?.value || '';
  const confirmPass = document.getElementById('reset-confirm-pass')?.value || '';

  if (!otp) {
    if (msgEl) {
      msgEl.textContent = 'Please enter the 6-digit verification code.';
      msgEl.className = 'auth-msg error';
      msgEl.style.display = 'block';
    }
    return;
  }

  if (otp !== window._resetPasswordState.code) {
    if (msgEl) {
      msgEl.textContent = '❌ Invalid verification code. Please check and re-enter.';
      msgEl.className = 'auth-msg error';
      msgEl.style.display = 'block';
    }
    return;
  }

  if (Date.now() > window._resetPasswordState.expiresAt) {
    if (msgEl) {
      msgEl.textContent = '❌ Verification code has expired. Please go back and request a new code.';
      msgEl.className = 'auth-msg error';
      msgEl.style.display = 'block';
    }
    return;
  }

  if (!newPass || newPass.length < 6) {
    if (msgEl) {
      msgEl.textContent = '❌ Password must be at least 6 characters long.';
      msgEl.className = 'auth-msg error';
      msgEl.style.display = 'block';
    }
    return;
  }

  if (newPass !== confirmPass) {
    if (msgEl) {
      msgEl.textContent = '❌ Passwords do not match. Please re-enter.';
      msgEl.className = 'auth-msg error';
      msgEl.style.display = 'block';
    }
    return;
  }

  const submitBtn = document.getElementById('btn-submit-reset');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Updating Password...'; }

  try {
    const sb = getSupabaseClient();
    const { email, targetType, targetId } = window._resetPasswordState;

    if (targetType === 'authority') {
      // 1. Authority password reset: Salt + PBKDF2 hash
      const salt = 'salt_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const { hash } = await hashPasswordWithSalt(newPass, salt);

      // Update in Supabase
      if (sb && typeof sb.from === 'function') {
        try {
          await sb.from('approving_authorities').update({
            password_hash: hash,
            salt: salt,
            pass: newPass,
            updated_at: new Date().toISOString()
          }).eq('id', targetId);
        } catch(e) { console.warn('Supabase approving_authorities update warning:', e); }
      }

      // Update local authorities cache
      if (Array.isArray(APPROVING_AUTHORITIES_CACHE)) {
        const item = APPROVING_AUTHORITIES_CACHE.find(a => a.id === targetId || (a.email && a.email.toLowerCase() === email));
        if (item) {
          item.password_hash = hash;
          item.salt = salt;
          item.pass = newPass;
          item.updated_at = new Date().toISOString();
        }
      }
      let rawAuth = localStorage.getItem('vvce_approving_authorities');
      if (rawAuth) {
        try {
          let list = JSON.parse(rawAuth);
          let target = list.find(a => a.id === targetId || (a.email && a.email.toLowerCase() === email));
          if (target) {
            target.password_hash = hash;
            target.salt = salt;
            target.pass = newPass;
            target.updated_at = new Date().toISOString();
            localStorage.setItem('vvce_approving_authorities', JSON.stringify(list));
          }
        } catch(e) {}
      }

      // Also update in vvce_users if authority has an entry there
      let users = getDB('vvce_users');
      let uIdx = users.findIndex(u => u.id === targetId || (u.email && u.email.toLowerCase() === email));
      if (uIdx > -1) {
        users[uIdx].pass = newPass;
        setDB('vvce_users', users);
      }
    } else {
      // 2. Regular user password reset (Student, Club Admin, Faculty)
      if (sb && typeof sb.from === 'function') {
        try {
          await sb.from('users').update({
            pass: newPass
          }).eq('id', targetId);
        } catch(e) {
          try {
            await sb.from('users').update({ pass: newPass }).ilike('email', email);
          } catch(e2) {
            console.warn('Supabase users table update warning:', e2);
          }
        }
      }

      // Update local storage
      let users = getDB('vvce_users');
      let uIdx = users.findIndex(u => u.id === targetId || (u.email && u.email.toLowerCase() === email));
      if (uIdx > -1) {
        users[uIdx].pass = newPass;
        setDB('vvce_users', users);
      }
      if (STATE.user && (STATE.user.id === targetId || STATE.user.email?.toLowerCase() === email)) {
        STATE.user.pass = newPass;
      }
    }

    // Set email into login input and clear password input
    const loginEmail = document.getElementById('login-email');
    if (loginEmail) loginEmail.value = email;
    const loginPass = document.getElementById('login-pass');
    if (loginPass) {
      loginPass.value = '';
      setTimeout(() => loginPass.focus(), 250);
    }

    closeModal('modal-forgot-password');
    showAuthMsg(`✅ Password updated successfully for ${email}! You can now sign in with your new password.`, 'success');
    toast('Password reset successfully! Please sign in.', 'success', 5000);
  } catch(err) {
    console.error('Password reset execution failed:', err);
    if (msgEl) {
      msgEl.textContent = '❌ Failed to reset password: ' + (err.message || 'Unknown error');
      msgEl.className = 'auth-msg error';
      msgEl.style.display = 'block';
    }
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
   GOOGLE SIGN-IN (GIS)
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
    /* Update the hidden GIS element with real client_id */
    const el = document.getElementById('g_id_onload');
    if (el) el.setAttribute('data-client_id', GOOGLE_CLIENT_ID);
  } catch(e) { /* GIS not available */ }
}

/* Called when user clicks the Google button */
window.triggerGoogleSignIn = function() {
  if (typeof google !== 'undefined' && GOOGLE_CLIENT_ID) {
    /* Use real Google OAuth popup */
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        /* Fallback to manual entry if popup blocked */
        manualGoogleEmailEntry();
      }
    });
    return;
  }
  /* No Client ID configured — use manual email entry fallback */
  manualGoogleEmailEntry();
};

function manualGoogleEmailEntry() {
  const email = prompt('Enter your VVCE Google email address:\n(Must end with @vvce.ac.in)');
  if (!email) return;
  const clean = email.trim().toLowerCase();
  if (!clean.endsWith('@vvce.ac.in')) {
    showAuthMsg('❌ Only @vvce.ac.in Google accounts are allowed to sign in.', 'error');
    return;
  }
  googleLoginByEmail(clean);
}

/* Called by GIS with JWT credential after real Google OAuth */
window.handleGoogleSignIn = function(response) {
  try {
    const parts   = response.credential.split('.');
    const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    const email   = (payload.email || '').toLowerCase();
    const name    = payload.name  || '';
    const photo   = payload.picture || null;
    if (!email.endsWith('@vvce.ac.in')) {
      showAuthMsg('❌ Only @vvce.ac.in Google accounts are permitted.', 'error'); return;
    }
    googleLoginByEmail(email, name, photo);
  } catch(e) {
    showAuthMsg('Google sign-in failed. Please try again.', 'error');
  }
};

/* Find or auto-create user, then launch app */
function googleLoginByEmail(email, name, photo) {
  const users = getDB('vvce_users');
  let user = users.find(u => u.email.toLowerCase() === email);

  if (!user) {
    /* Auto-create student account for first-time @vvce.ac.in sign-in */
    const displayName = name
      || email.split('@')[0].replace(/[._]/g,' ')
          .replace(/\b\w/g, c => c.toUpperCase());
    user = {
      id: genId('u'), type: 'student',
      name: displayName.toUpperCase(), email, pass: null,
      profilePhoto: photo || null,
      usn: '', branch: 'CS', section: 'A',
      year: '1st Year', sem: 'Sem 1',
      dept: 'Computer Science', phone: '',
      interests: [], skills: [], bio: '',
      linkedin: '', github: '', achievements: [],
      points: null,
      pointsBySem: null,
      notifs: [{ id:genId('n'), msg:'Welcome to VVCE Events Hub! 🎉 Please complete your profile.', time:'Just now', read:false, icon:'🎉' }]
    };
    users.push(user);
    setDB('vvce_users', users);
    toast('Account created via Google Sign-In! Please complete your profile. 🎓', 'success');
  }

  if (user.type === 'admin' && !user.approved) {
    showAuthMsg('Your club account is pending Dean SW approval.', 'warning'); return;
  }
  launchApp(user);
}

