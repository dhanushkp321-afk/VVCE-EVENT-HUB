/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Complete Application Logic
   Author: Antigravity AI
   Version: 3.0
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   GOOGLE OAUTH CONFIGURATION
   To enable real Google Sign-In:
   1. Go to https://console.cloud.google.com/
   2. Create a project → APIs & Services → Credentials
   3. Create OAuth 2.0 Client ID (Web Application type)
   4. Add http://localhost:8000 to Authorized JavaScript Origins
   5. Paste the Client ID string below
───────────────────────────────────────────────────────────────*/
const GOOGLE_CLIENT_ID = ''; /* ← Paste your Google Client ID here */

/* ─────────────────────────────────────────────────────────────
   STATE & DATABASE LAYER
───────────────────────────────────────────────────────────────*/
const STATE = {
  user: null,
  page: null,
  prevPage: null,
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  selectedDate: null,
  deanUnlocked: false,
  principalUnlocked: false,
  regRole: 'student',
  rejectEventId: null,
};

/* DB helpers */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
window.supabase = createClient(supabaseUrl, supabaseKey);

const SUPABASE_CACHE = {
  vvce_users: [],
  vvce_events: [],
  vvce_certs: [],
  vvce_academic: []
};

function getDB(key, def = []) {
  return SUPABASE_CACHE[key] || def;
}

function getDBObj(key, def = {}) {
  return SUPABASE_CACHE[key] || def;
}

async function setDB(key, val) {
  SUPABASE_CACHE[key] = val;
  if (!window.supabase) return;

  try {
    if (key === 'vvce_events') {
      const mapped = val.map(e => ({
        id: e.id, name: e.name, club: e.club, admin_id: e.adminId, emoji: e.emoji, category: e.category, date: e.date, time: e.time, end_date: e.endDate, end_time: e.endTime, venue: e.venue, max_participants: e.maxParticipants, reg_count: e.regCount, fee: e.fee, points: e.points, "desc": e.desc, branches: e.branches, status: e.status, rej_reason: e.rejReason, poster: e.poster, registrations: e.registrations, pending_payments: e.pendingPayments
      }));
      await window.supabase.from('events').upsert(mapped);
    } else if (key === 'vvce_users') {
      const mapped = val.map(u => ({
        id: u.id, type: u.type, name: u.name, email: u.email, pass: u.pass, usn: u.usn, branch: u.branch, section: u.section, year: u.year, sem: u.sem, admission_year: u.admissionYear, dept: u.dept, phone: u.phone, interests: u.interests, skills: u.skills, bio: u.bio, linkedin: u.linkedin, github: u.github, achievements: u.achievements, profile_photo: u.profilePhoto, resume: u.resume, points: u.points, points_by_sem: u.pointsBySem, notifs: u.notifs, club_name: u.clubName, club_email: u.clubEmail, domain: u.domain, faculty: u.faculty, approved: u.approved, "desc": u.desc, designation: u.designation
      }));
      await window.supabase.from('users').upsert(mapped);
    } else if (key === 'vvce_certs') {
      const mapped = val.map(c => ({
        id: c.id, "userId": c.userId, title: c.title, issuer: c.issuer, date: c.date, position: c.position, points: c.points, type: c.type, verified: c.verified
      }));
      await window.supabase.from('vvce_certs').upsert(mapped);
    } else if (key === 'vvce_academic') {
      const mapped = val.map(a => ({
        id: a.id, date: a.date, type: a.type, "desc": a.desc
      }));
      await window.supabase.from('academic').upsert(mapped);
    }
  } catch (err) {
    console.error('Failed to sync to Supabase:', err);
  }
}

async function bootApp() {
  document.getElementById('app-main').style.display = 'none';
  document.getElementById('sidebar').style.display = 'none';
  
  // Create a loading screen
  const loader = document.createElement('div');
  loader.id = 'supabase-loader';
  loader.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#fff;font-family:Outfit,sans-serif;font-size:24px;font-weight:800;z-index:9999;';
  loader.innerHTML = '<div>Connecting to live cloud database...</div>';
  document.body.appendChild(loader);

  try {
    const [uRes, eRes, cRes, aRes] = await Promise.all([
      window.supabase.from('users').select('*'),
      window.supabase.from('events').select('*'),
      window.supabase.from('vvce_certs').select('*'),
      window.supabase.from('academic').select('*')
    ]);

    if (uRes.data) {
      SUPABASE_CACHE.vvce_users = uRes.data.map(u => ({
        id: u.id, type: u.type, name: u.name, email: u.email, pass: u.pass, usn: u.usn, branch: u.branch, section: u.section, year: u.year, sem: u.sem, admissionYear: u.admission_year, dept: u.dept, phone: u.phone, interests: u.interests, skills: u.skills, bio: u.bio, linkedin: u.linkedin, github: u.github, achievements: u.achievements, profilePhoto: u.profile_photo, resume: u.resume, points: u.points, pointsBySem: u.points_by_sem, notifs: u.notifs, clubName: u.club_name, clubEmail: u.club_email, domain: u.domain, faculty: u.faculty, approved: u.approved, desc: u.desc, designation: u.designation
      }));
    }
    if (eRes.data) {
      SUPABASE_CACHE.vvce_events = eRes.data.map(e => ({
        id: e.id, name: e.name, club: e.club, adminId: e.admin_id, emoji: e.emoji, category: e.category, date: e.date, time: e.time, endDate: e.end_date, endTime: e.end_time, venue: e.venue, maxParticipants: e.max_participants, regCount: e.reg_count, fee: e.fee, points: e.points, desc: e.desc, branches: e.branches, status: e.status, rejReason: e.rej_reason, poster: e.poster, registrations: e.registrations || [], pendingPayments: e.pending_payments || []
      }));
    }
    if (cRes.data) {
      SUPABASE_CACHE.vvce_certs = cRes.data.map(c => ({
        id: c.id, userId: c.userId, title: c.title, issuer: c.issuer, date: c.date, position: c.position, points: c.points, type: c.type, verified: c.verified
      }));
    }
    if (aRes.data) {
      SUPABASE_CACHE.vvce_academic = aRes.data.map(a => ({
        id: a.id, date: a.date, type: a.type, desc: a.desc
      }));
    }
  } catch (err) {
    console.error('Failed to load from Supabase:', err);
  }

  loader.remove();
  document.getElementById('app-main').style.display = '';
  document.getElementById('sidebar').style.display = '';
  
  // Start the app
  init();
}

/* ─────────────────────────────────────────────────────────────
   UTILITY FUNCTIONS
───────────────────────────────────────────────────────────────*/
function genId(prefix = 'id') { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }
function titleCase(str) { if (!str) return ''; return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()); }
function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning'; if (h < 17) return 'afternoon'; return 'evening';
}
function avatar(name) { return name ? name.trim()[0].toUpperCase() : '?'; }

/**
 * Computes the student's current Year and Semester automatically
 * based on their admission year (stored as admissionYear).
 * Academic year starts in September each year.
 * Sept–Feb = Odd sem, Mar–Aug = Even sem.
 */
function computeStudentYearSem(user) {
  if (!user.admissionYear) {
    // Fallback if no admissionYear stored (legacy data)
    return { year: user.year || '—', sem: user.sem || '—' };
  }
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1–12
  const currentYear  = now.getFullYear();

  // Academic year starts in September (month 9).
  // Sept–Feb = Odd semester (1st half), Mar–Aug = Even semester (2nd half).
  const academicYear = currentMonth >= 9 ? currentYear : currentYear - 1;
  const yearsElapsed = academicYear - user.admissionYear;
  const studyYear = Math.min(yearsElapsed + 1, 4); // 1–4

  // Sept(9)–Feb(2) = odd sem, Mar(3)–Aug(8) = even sem
  let semInYear;
  if (currentMonth >= 9 || currentMonth <= 2) {
    semInYear = 1; // Sept–Feb → Odd semester
  } else {
    semInYear = 2; // Mar–Aug → Even semester
  }
  const semNumber = Math.min((studyYear - 1) * 2 + semInYear, 8);

  const yearLabels = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  return {
    year: yearLabels[studyYear - 1] || '4th Year',
    sem: `Sem ${semNumber}`
  };
}

/* Toast notifications */
function toast(msg, type = 'success', dur = 3200) {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(60px)'; t.style.transition = 'all 0.3s'; setTimeout(() => t.remove(), 300); }, dur);
}

/* Modal helpers */
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

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
    panelSignin.style.display   = '';
    panelRegister.style.display = 'none';
    tabSignin.classList.add('active');
    tabRegister.classList.remove('active');
  } else {
    panelSignin.style.display   = 'none';
    panelRegister.style.display = '';
    tabSignin.classList.remove('active');
    tabRegister.classList.add('active');
  }
}

function selectRegRole(role) {
  STATE.regRole = role;
  ['student','admin','authority'].forEach(r => {
    document.getElementById(`rcard-${r}`).classList.toggle('active', r === role);
    document.getElementById(`form-${r}`).style.display = r === role ? '' : 'none';
  });
  clearAuthMsg();
}

function toggleChip(el) { el.classList.toggle('selected'); }

function showAuthMsg(msg, type = 'error') {
  const el = document.getElementById('auth-msg');
  el.textContent = msg;
  el.className = `auth-msg ${type}`;
  el.style.display = '';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function clearAuthMsg() {
  const el = document.getElementById('auth-msg');
  if (el) { el.style.display = 'none'; el.textContent = ''; }
}

/* ── Login ── */
function handleLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) { showAuthMsg('Please enter your email and password.'); return; }
  if (!email.endsWith('@vvce.ac.in')) {
    showAuthMsg('❌ Only @vvce.ac.in email addresses are allowed to sign in.', 'error'); return;
  }

  const users = getDB('vvce_users');
  const user  = users.find(u => u.email.toLowerCase() === email && u.pass === pass);
  if (!user) { showAuthMsg('Invalid email or password. Try the quick demo buttons below.'); return; }

  if (user.type === 'admin' && !user.approved) {
    showAuthMsg('Your club account is pending Dean approval. Please wait.', 'warning');
    return;
  }

  launchApp(user);
}

/* Quick demo login */
function quickLogin(role) {
  const maps = {
    student:   'akash@vvce.ac.in',
    admin:     'harshill@vvce.ac.in',
    dean:      'dean.sw@vvce.ac.in',
    principal: 'principal@vvce.ac.in',
  };
  document.getElementById('login-email').value = maps[role] || maps.student;
  document.getElementById('login-pass').value  = 'demo1234';
  handleLogin();
}

/* ── Student Signup ── */
function handleStudentSignup() {
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

  if (!name || !usn || !email || !pass) { showAuthMsg('Please fill all required fields.'); return; }
  if (pass.length < 8) { showAuthMsg('Password must be at least 8 characters.'); return; }
  if (!email.endsWith('@vvce.ac.in')) { showAuthMsg('❌ Only @vvce.ac.in email addresses are allowed.', 'error'); return; }

  const users = getDB('vvce_users');
  if (users.find(u => u.email.toLowerCase() === email)) { showAuthMsg('This email is already registered. Please sign in.', 'warning'); return; }

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
    points: 0, pointsBySem: { 'Sem 1':0, 'Sem 2':0, 'Sem 3':0, 'Sem 4':0, 'Sem 5':0 },
    notifs: [{ id: genId('n'), msg: 'Welcome to VVCE Events Hub! Start exploring events.', time: 'Just now', read: false, icon: '🎉' }]
  };
  users.push(newUser);
  setDB('vvce_users', users);
  showAuthMsg('Account created successfully! Signing you in…', 'success');
  setTimeout(() => launchApp(newUser), 1000);
}

/* ── Club Admin Signup ── */
function handleAdminSignup() {
  const name      = document.getElementById('a-name').value.trim();
  const club      = document.getElementById('a-club').value.trim();
  const domain    = document.getElementById('a-domain').value;
  const branch    = document.getElementById('a-branch').value;
  const usn       = document.getElementById('a-usn').value.trim().toUpperCase();
  const faculty   = document.getElementById('a-faculty').value.trim();
  const clubEmail = document.getElementById('a-club-email').value.trim().toLowerCase();
  const email     = document.getElementById('a-email').value.trim().toLowerCase();
  const phone     = document.getElementById('a-phone').value.trim();
  const desc      = document.getElementById('a-desc').value.trim();
  const pass      = document.getElementById('a-pass').value;

  if (!name || !club || !faculty || !email || !pass || !usn) { showAuthMsg('Please fill all required fields.'); return; }
  if (pass.length < 6) { showAuthMsg('Password must be at least 6 characters.'); return; }
  if (!email.endsWith('@vvce.ac.in')) { showAuthMsg('❌ Only @vvce.ac.in email addresses are allowed.', 'error'); return; }

  const users = getDB('vvce_users');
  if (users.find(u => u.email.toLowerCase() === email)) { showAuthMsg('This email is already registered.', 'warning'); return; }

  const newUser = {
    id: genId('u'), type: 'admin', name: name.toUpperCase(), email, pass,
    clubName: club, clubEmail, domain, branch, usn, faculty, phone, desc, approved: false,
    notifs: [{ id: genId('n'), msg: 'Club registration submitted! Pending Dean SW approval.', time: 'Just now', read: false, icon: '⏳' }]
  };
  users.push(newUser);
  setDB('vvce_users', users);
  showAuthMsg('Club registration submitted! Awaiting Dean Student Welfare approval.', 'success');
}

/* ── Authority Signup ── */
function handleAuthoritySignup() {
  const name  = document.getElementById('f-name').value.trim();
  const desig = document.getElementById('f-designation').value;
  const email = document.getElementById('f-email').value.trim().toLowerCase();
  const pass  = document.getElementById('f-pass').value;

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
  users.push(newUser);
  setDB('vvce_users', users);
  showAuthMsg('Authority account created! Signing you in…', 'success');
  setTimeout(() => launchApp(newUser), 1000);
}

/* ── Forgot Password ── */
function handleForgotPassword() {
  const email = document.getElementById('login-email').value.trim();
  if (!email) { showAuthMsg('Enter your email first, then click Forgot password.', 'info'); return; }
  const users = getDB('vvce_users');
  const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) { showAuthMsg('No account found with that email.', 'error'); return; }
  showAuthMsg(`Demo mode: Your password is "${user.pass}". In production, a reset link would be emailed.`, 'info');
}

/* ── Password visibility toggle ── */
function togglePass(inputId, btn) {
  const inp = document.getElementById(inputId);
  inp.type = inp.type === 'password' ? 'text' : 'password';
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
      points: 0,
      pointsBySem: { 'Sem 1':0,'Sem 2':0,'Sem 3':0,'Sem 4':0,'Sem 5':0 },
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


/* ─────────────────────────────────────────────────────────────
   APP LAUNCH & ROUTING
───────────────────────────────────────────────────────────────*/
function launchApp(user) {
  STATE.user = user;
  STATE.deanUnlocked = false;
  STATE.principalUnlocked = false;

  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.body.style.background = '#f1f5f9';

  renderSidebar();
  renderTopbarUser();

  if (user.type === 'student') showPage('dashboard');
  else if (user.type === 'admin') showPage('admin-dashboard');
  else showPage('authority-dashboard');
}

function logout() {
  if (!confirm('Sign out of VVCE Events Hub?')) return;
  STATE.user = null;
  STATE.deanUnlocked = false;
  STATE.principalUnlocked = false;
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  document.body.style.background = '#1a2235';
  // Reset login fields
  const le = document.getElementById('login-email'); if (le) le.value = '';
  const lp = document.getElementById('login-pass');  if (lp) lp.value = '';
  clearAuthMsg();
}

function showPage(pageId) {
  const prev = STATE.page;
  STATE.prevPage = prev;
  STATE.page = pageId;

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + pageId);
  if (el) { el.classList.add('active'); el.scrollTop = 0; }

  // Update topbar title
  const titles = {
    'dashboard': 'Dashboard',
    'events': 'Events',
    'calendar': 'Academic Calendar',
    'registrations': 'My Registrations',
    'certificates': 'Certificates',
    'profile': 'My Profile',
    'admin-dashboard': 'Admin Dashboard',
    'create-event': 'Create New Event',
    'manage-events': 'My Events',
    'participants': 'Participants',
    'authority-dashboard': 'Dashboard',
    'authority-approvals': 'Event Approvals',
    'authority-clubs': 'Club Monitor',
    'authority-clash': 'Clash Detection',
    'authority-attendance': 'Attendance',
    'dean-portal': 'Dean Student Welfare Portal',
    'principal-portal': 'Principal Portal',
  };
  document.getElementById('topbar-title').textContent = titles[pageId] || pageId;

  // Back button visibility
  const mainPages = ['dashboard','admin-dashboard','authority-dashboard'];
  document.getElementById('back-btn').style.display = mainPages.includes(pageId) ? 'none' : '';

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === pageId);
  });

  // Render page content
  const renders = {
    'dashboard':            renderStudentDashboard,
    'events':               renderEventsPage,
    'calendar':             renderCalendarPage,
    'registrations':        renderRegistrationsPage,
    'certificates':         renderCertificatesPage,
    'profile':              renderProfilePage,
    'admin-dashboard':      renderAdminDashboard,
    'create-event':         renderCreateEventPage,
    'manage-events':        renderManageEventsPage,
    'participants':         renderParticipantsPage,
    'authority-dashboard':  renderAuthorityDashboard,
    'authority-approvals':  renderApprovals,
    'authority-clubs':      renderClubMonitor,
    'authority-clash':      renderClashDetect,
    'authority-attendance': renderAttendancePage,
    'dean-portal':          () => renderDeanPortal(),
    'principal-portal':     () => renderPrincipalPortal(),
  };
  if (renders[pageId]) renders[pageId]();
}

function goBack() {
  if (STATE.prevPage) showPage(STATE.prevPage);
  else {
    const home = { student:'dashboard', admin:'admin-dashboard', authority:'authority-dashboard' };
    showPage(home[STATE.user?.type] || 'dashboard');
  }
}

/* ─────────────────────────────────────────────────────────────
   SIDEBAR RENDERING
───────────────────────────────────────────────────────────────*/
function renderSidebar() {
  const user = STATE.user;

  // Avatar
  const sbAv = document.getElementById('sb-avatar');
  if (sbAv) {
    if (user.profilePhoto) {
      sbAv.innerHTML = `<img src="${user.profilePhoto}" alt="avatar">`;
    } else {
      sbAv.textContent = avatar(user.name);
    }
    sbAv.style.cursor = 'pointer';
    sbAv.onclick = () => showPage('profile');
  }

  // User info
  const sbName = document.getElementById('sb-username'); if (sbName) sbName.textContent = titleCase(user.name);
  const sbRole = document.getElementById('sb-userrole');
  if (sbRole) sbRole.textContent = {
    student: (() => { const cs = computeStudentYearSem(user); return `${user.branch || ''} • ${cs.sem}`; })(),
    admin: user.clubName || 'Club Admin',
    authority: titleCase(user.designation) || 'Faculty',
  }[user.type] || '';

  const sbBadge = document.getElementById('sb-rolebadge');
  if (sbBadge) {
    const labels = { student:'Student', admin:'Club Admin', authority:'Authority' };
    const classes = { student:'badge-student', admin:'badge-admin', authority:'badge-authority' };
    sbBadge.textContent = labels[user.type];
    sbBadge.className = `sb-badge-pill ${classes[user.type]}`;
  }

  // Nav items by role
  const nav = document.getElementById('sb-nav');
  if (!nav) return;

  let html = '';
  if (user.type === 'student') {
    html = `
      <div class="sb-section-label">Overview</div>
      ${navItem('dashboard','📊','Dashboard')}
      ${navItem('events','🗓️','Events')}
      ${navItem('registrations','📋','My Registrations')}
      ${navItem('certificates','🏆','Certificates')}
      ${navItem('calendar','📅','Academic Calendar')}
      <div class="sb-section-label">Account</div>
      ${navItem('profile','👤','My Profile')}
    `;
  } else if (user.type === 'admin') {
    html = `
      <div class="sb-section-label">Management</div>
      ${navItem('admin-dashboard','📊','Dashboard')}
      ${navItem('create-event','➕','Create Event')}
      ${navItem('manage-events','📋','My Events')}
      ${navItem('participants','👥','Participants')}
      <div class="sb-section-label">Account</div>
      ${navItem('profile','👤','Profile')}
    `;
  } else { // authority
    html = `
      <div class="sb-section-label">Overview</div>
      ${navItem('authority-dashboard','📊','Dashboard')}
      ${navItem('authority-clubs','🏛️','Club Monitor')}
      ${navItem('authority-clash','⚡','Clash Detect')}
      ${user.designation !== 'dean' && user.designation !== 'principal' ? navItem('authority-attendance','📊','Attendance') : ''}
      <div class="sb-section-label">Special Portals</div>
      <div class="nav-item dean-item" data-page="dean-portal" onclick="handleDeanPortalNav()">
        <span class="nav-icon">📋</span>
        <span class="nav-label">Dean SW Portal</span>
        <span class="portal-pill portal-pill-dean">DEAN</span>
      </div>
      <div class="nav-item princ-item" data-page="principal-portal" onclick="handlePrincipalPortalNav()">
        <span class="nav-icon">🎓</span>
        <span class="nav-label">Principal Portal</span>
        <span class="portal-pill portal-pill-princ">PRINC</span>
      </div>
    `;
  }
  nav.innerHTML = html;
}

function navItem(page, icon, label, badge = '') {
  const isActive = STATE.page === page ? 'active' : '';
  const bdg = badge ? `<span class="nav-count">${badge}</span>` : '';
  return `<div class="nav-item ${isActive}" data-page="${page}" onclick="showPage('${page}')">
    <span class="nav-icon">${icon}</span>
    <span class="nav-label">${label}</span>${bdg}
  </div>`;
}

function renderTopbarUser() {
  const user = STATE.user;
  const av = document.getElementById('topbar-avatar');
  if (!av) return;
  if (user.profilePhoto) { av.innerHTML = `<img src="${user.profilePhoto}">`; }
  else { av.textContent = avatar(user.name); }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

/* ─────────────────────────────────────────────────────────────
   NOTIFICATION PANEL
───────────────────────────────────────────────────────────────*/
function toggleNotifPanel() {
  const panel = document.getElementById('notif-dropdown');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) renderNotifs();
}

function getRelativeTime(timestamp, fallback) {
  if (!timestamp) return fallback || 'Just now';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderNotifs() {
  const user = STATE.user;
  const notifs = user.notifs || [];
  const list = document.getElementById('notif-list');
  if (!list) return;

  const unread = notifs.filter(n => !n.read).length;
  const badge  = document.getElementById('notif-badge');
  if (badge) { badge.style.display = unread > 0 ? '' : 'none'; badge.textContent = unread; }

  if (!notifs.length) { list.innerHTML = `<div style="padding:2rem;text-align:center;color:#9ca3af;font-size:13px;">No notifications</div>`; return; }
  list.innerHTML = notifs.slice().reverse().map(n => `
    <div class="notif-item ${n.read?'':'unread'}" onclick="readNotif('${n.id}')">
      <span class="notif-item-icon">${n.icon || '🔔'}</span>
        <div style="flex:1">
          <div class="notif-item-text">${n.msg}</div>
          <div class="notif-item-time">${getRelativeTime(n.timestamp, n.time)}</div>
        </div>
      ${!n.read ? '<span class="notif-item-dot"></span>' : ''}
    </div>
  `).join('');
}

function readNotif(id) {
  const users = getDB('vvce_users');
  const u = users.find(x => x.id === STATE.user.id);
  if (u) {
    const n = (u.notifs||[]).find(x => x.id === id);
    if (n) n.read = true;
    setDB('vvce_users', users);
    STATE.user = u;
    renderNotifs();
  }
}

function markAllRead() {
  const users = getDB('vvce_users');
  const u = users.find(x => x.id === STATE.user.id);
  if (u) { (u.notifs||[]).forEach(n => n.read = true); setDB('vvce_users', users); STATE.user = u; renderNotifs(); }
}

function addNotif(msg, icon = '🔔') {
  addNotifToUser(STATE.user.id, msg, icon);
}

function addNotifToUser(userId, msg, icon = '🔔') {
  const users = getDB('vvce_users');
  const u = users.find(x => x.id === userId);
  if (u) {
    if (!u.notifs) u.notifs = [];
    u.notifs.push({ id: genId('n'), msg, icon, time: 'Just now', timestamp: Date.now(), read: false });
    setDB('vvce_users', users);
    
    // If the notified user is currently logged in, update their state and UI
    if (STATE.user && STATE.user.id === userId) {
      STATE.user = u;
      const badge = document.getElementById('notif-badge');
      if (badge) { badge.style.display = ''; }
    }
  }
}

// Close notif panel on outside click
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notif-dropdown');
  const btn   = document.getElementById('notif-btn');
  if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
    panel.classList.remove('open');
  }
});


/* ─────────────────────────────────────────────────────────────
   STUDENT DASHBOARD
───────────────────────────────────────────────────────────────*/
function renderStudentDashboard() {
  const user   = STATE.user;
  const events = getDB('vvce_events');
  const certs  = getDB('vvce_certs').filter(c => c.userId === user.id);
  const regs   = events.filter(e => (e.registrations||[]).includes(user.id));
  const upcoming = regs.filter(e => new Date(e.date) >= new Date()).slice(0,4);
  const certPts  = certs.reduce((s,c) => s+(c.points||0), 0);
  const totalPts = certPts + (user.points||0);
  const pct = Math.min(100, Math.round(totalPts / 100 * 100));

  const approved = events.filter(e => 
    e.status === 'approved' &&
    (!e.branches || e.branches.length === 0 || e.branches.includes('All') || e.branches.includes(user.branch))
  );
  let recommended = approved.filter(e => {
    const evCat = e.category || 'Technical';
    const hasInterests = user.interests && user.interests.length > 0;
    const matchesInterest = hasInterests 
      ? user.interests.some(i => evCat.toLowerCase().includes(i.toLowerCase())) 
      : true;
    const isReg = (e.registrations||[]).includes(user.id);
    const isPending = (e.pendingPayments||[]).some(p => p.uid === user.id);
    return matchesInterest && !isReg && !isPending;
  });

  if (recommended.length === 0) {
    // Fallback: Show any events they are not registered for
    recommended = approved.filter(e => 
      !(e.registrations||[]).includes(user.id) && 
      !(e.pendingPayments||[]).some(p => p.uid === user.id)
    );
  }
  recommended = recommended.slice(0,3);

  const el = document.getElementById('page-dashboard');
  el.innerHTML = `
    <!-- Welcome Banner -->
    <div class="welcome-banner">
      <div class="welcome-big-avatar" id="wb-avatar">
        ${user.profilePhoto ? `<img src="${user.profilePhoto}">` : avatar(user.name)}
      </div>
      <div class="welcome-info">
        <div class="welcome-greeting">Good ${getGreeting()},</div>
        <div class="welcome-name">${titleCase(user.name.split(' ')[0])} 👋</div>
        <div class="welcome-chips">
          <span class="welcome-chip">📍 ${user.branch||'—'} • ${computeStudentYearSem(user).sem}</span>
          <span class="welcome-chip">🏫 Sec ${user.section||'—'}</span>
          ${(user.interests||[]).map(i=>`<span class="welcome-chip">${i}</span>`).join('')}
        </div>
      </div>
      <div class="welcome-acts">
        <button class="welcome-act-btn gold" onclick="showPage('events')">Browse Events →</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      ${statCard('🎯','AICTE Points',totalPts,`${pct}% of 100-pt goal`,'stat-amber')}
      ${statCard('📅','Registered',regs.length,`${upcoming.length} upcoming`,'stat-blue')}
      ${statCard('🏆','Certificates',certs.length,`${certs.filter(c=>c.type==='achievement').length} achievements`,'stat-mint')}
      ${statCard('✅','Completed',regs.filter(e=>new Date(e.date)<new Date()).length,'Events attended','stat-pink')}
    </div>

    <!-- Two-col dashboard -->
    <div class="dash-grid">
      <!-- Left column -->
      <div>
        <!-- AICTE Points progress -->
        <div class="white-card" style="margin-bottom:1rem;">
          <div class="sec-head">
            <span class="sec-title">AICTE Activity Points</span>
            <span style="font-size:12px;color:#6b7280;">${totalPts}/100 target</span>
          </div>
          <div class="pts-bar-wrap"><div class="pts-bar" style="width:${pct}%"></div></div>
          <div class="sem-grid">
            ${Object.entries(user.pointsBySem||{}).slice(0,8).map(([s,p])=>`
              <div class="sem-cell">
                <div class="sem-val">${p}</div>
                <div class="sem-lbl">${s}</div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Recommended Events -->
        <div class="sec-head" style="margin-top:1.5rem;">
          <span class="sec-title">Recommended for You ✨</span>
          <button class="btn btn-outline" onclick="showPage('events')">View All →</button>
        </div>
        <div class="event-grid">
          ${recommended.length
            ? recommended.map(e => eventCard(e)).join('')
            : `<div class="empty-state" style="grid-column:1/-1">
                <div class="ei">🎯</div>
                <div class="et">No recommendations yet</div>
                <div class="es">Browse all events or update your interests.</div>
                <button class="btn btn-gold" style="margin-top:12px;" onclick="showPage('events')">Browse Events</button>
              </div>`
          }
        </div>
      </div>

      <!-- Right sidebar -->
      <div>
        <!-- Upcoming events -->
        <div class="sec-title" style="margin-bottom:10px;">📅 Upcoming Events</div>
        ${upcoming.length
          ? upcoming.map(e=>`
            <div class="sched-row" onclick="openEventModal('${e.id}')">
              <span class="sched-emoji">${e.emoji||'🎓'}</span>
              <div class="sched-info">
                <div class="sched-name">${e.name}</div>
                <div class="sched-meta">${formatDate(e.date)} • ${e.venue}</div>
              </div>
              <span class="att-tag att-reg">Reg.</span>
            </div>`).join('')
          : `<div class="empty-state" style="padding:1.5rem;"><div class="ei">📅</div><div class="et">No upcoming events</div></div>`
        }

      </div>
    </div>
  `;
}

function statCard(icon, label, val, sub, cls='') {
  return `
    <div class="stat-card ${cls}">
      <div class="stat-top">
        <div>
          <div class="stat-label">${label}</div>
          <div class="stat-val">${val}</div>
        </div>
        <div class="stat-icon">${icon}</div>
      </div>
      <div class="stat-sub">${sub}</div>
    </div>`;
}

/* ─────────────────────────────────────────────────────────────
   EVENTS PAGE
───────────────────────────────────────────────────────────────*/
function renderEventsPage() {
  const el = document.getElementById('page-events');
  el.innerHTML = `
    <div class="filter-row">
      <input class="search-inp" type="text" id="ev-search" placeholder="🔍 Search events by name, club…" oninput="filterEvents()">
      <select class="filter-sel" id="ev-cat" onchange="filterEvents()">
        <option value="">All Categories</option>
        <option>Technical</option><option>Cultural</option>
        <option>Sports</option><option>Workshop</option>
        <option>Management</option><option>Social</option>
      </select>
      <select class="filter-sel" id="ev-fee" onchange="filterEvents()">
        <option value="">Any Fee</option>
        <option value="free">Free</option>
        <option value="paid">Paid</option>
      </select>
    </div>
    <div class="event-grid" id="ev-grid"></div>
  `;
  filterEvents();
}

function filterEvents() {
  const q   = (document.querySelector('#page-events #ev-search')?.value||'').toLowerCase().trim();
  const cat = document.querySelector('#page-events #ev-cat')?.value||'';
  const fee = document.querySelector('#page-events #ev-fee')?.value||'';
  let evs   = getDB('vvce_events').filter(e => e.status === 'approved');

  if (STATE.user && STATE.user.type === 'student') {
    evs = evs.filter(e => !e.branches || e.branches.length === 0 || e.branches.includes('All') || e.branches.includes(STATE.user.branch));
  }

  if (q)   evs = evs.filter(e => (e.name||'').toLowerCase().includes(q)||(e.club||'').toLowerCase().includes(q)||(e.desc||'').toLowerCase().includes(q));
  if (cat) evs = evs.filter(e => (e.category||'').toLowerCase().trim() === cat.toLowerCase().trim());
  if (fee==='free') evs = evs.filter(e => !e.fee || e.fee===0);
  if (fee==='paid') evs = evs.filter(e => e.fee > 0);

  const grid = document.querySelector('#page-events #ev-grid');
  if (!grid) return;
  grid.innerHTML = evs.length
    ? evs.map(e => eventCard(e)).join('')
    : `<div class="empty-state" style="grid-column:1/-1"><div class="ei">🔍</div><div class="et">No events found</div></div>`;
}

function eventCard(ev) {
  const user  = STATE.user;
  const isReg = (ev.registrations||[]).includes(user?.id);
  const isFull= ev.regCount >= ev.maxParticipants;
  const catCls = { Technical:'cat-technical',Cultural:'cat-cultural',Sports:'cat-sports',Workshop:'cat-workshop',Management:'cat-management',Social:'cat-social' }[ev.category]||'cat-technical';

  return `
    <div class="event-card" onclick="openEventModal('${ev.id}')">
      <div class="event-poster">
        ${ev.poster?`<img src="${ev.poster}">`:`<span style="position:relative;z-index:1;">${ev.emoji||'🎓'}</span>`}
        <span class="ev-cat-badge ${catCls}">${ev.category}</span>
      </div>
      <div class="ev-body">
        <div class="ev-title">${ev.name}</div>
        <div class="ev-club">${ev.club}</div>
        <div class="ev-metas">
          <div class="ev-meta">📅 ${formatDate(ev.date)}</div>
          <div class="ev-meta">🕐 ${formatTime(ev.time)} &nbsp;|&nbsp; 📍 ${ev.venue}</div>
          <div class="ev-meta">⭐ ${ev.points||0} pts &nbsp;|&nbsp; ${ev.fee>0?`<span style="color:#b45309;">₹${ev.fee}</span>`:`<span style="color:#15803d;">FREE</span>`}</div>
          <div class="ev-meta" style="color:#6366f1;font-weight:600;">🎓 Open to: ${(ev.branches && ev.branches.length > 0) ? (ev.branches.includes('All') ? 'All Branches' : ev.branches.join(', ')) : 'All Branches'}</div>
        </div>
        <div class="ev-foot">
          <span class="ev-seats ${isFull?'full':''}">${isFull?'🔴 Full':`${ev.maxParticipants-ev.regCount} seats left`}</span>
          <div style="display:flex;gap:6px;align-items:center;">
            ${user?.type==='student'
              ? isReg
                ? `<button class="btn-reg registered" onclick="event.stopPropagation();unregisterEv('${ev.id}')">✓ Registered</button>`
                : (ev.pendingPayments && ev.pendingPayments.some(p => p.uid === STATE.user.id))
                  ? `<button class="btn-reg" style="background:#f59e0b;color:#fff;border:none;" disabled>⏳ Pending Approval</button>`
                  : isFull
                    ? `<button class="btn-reg" disabled style="opacity:.5;cursor:not-allowed;">Full</button>`
                    : `<button class="btn-reg" onclick="event.stopPropagation();registerEv('${ev.id}')">Register</button>`
              : ''
            }
          </div>
        </div>
      </div>
    </div>`;
}

function registerEv(id) {
  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  if ((ev.registrations||[]).includes(STATE.user.id)) { toast('Already registered!','info'); return; }

  if (ev.fee > 0) {
    openPaymentModal(ev);
  } else {
    completeRegistration(ev);
  }
}

let currentPaymentEvent = null;

function openPaymentModal(ev) {
  currentPaymentEvent = ev;
  document.getElementById('pmt-ev-name').textContent = ev.name;
  document.getElementById('pmt-amount').textContent = `₹${ev.fee}`;
  document.getElementById('pmt-upi-id').textContent = ev.adminUpiId || 'Not specified';
  const statusEl = document.getElementById('pmt-status');
  statusEl.style.display = 'none';
  statusEl.textContent = '';
  openModal('modal-payment');
}

/* Compress uploaded image using Canvas */
window.handleScreenshotUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      const MAX = 800;
      if (w > h && w > MAX) { h *= MAX / w; w = MAX; }
      else if (h > MAX) { w *= MAX / h; h = MAX; }
      
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      
      const b64 = canvas.toDataURL('image/jpeg', 0.6); // Compress to 60% JPEG
      submitPaymentForVerification(currentPaymentEvent, b64);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

window.submitPaymentForVerification = function(ev, b64) {
  const events = getDB('vvce_events');
  const dbEv = events.find(e => e.id === ev.id);
  if (!dbEv) return;
  
  if (!dbEv.pendingPayments) dbEv.pendingPayments = [];
  
  // Remove if already pending to prevent duplicates
  dbEv.pendingPayments = dbEv.pendingPayments.filter(p => p.uid !== STATE.user.id);
  
  dbEv.pendingPayments.push({
    uid: STATE.user.id,
    screenshot: b64,
    date: new Date().toISOString()
  });
  
  setDB('vvce_events', events);
  closeModal('modal-payment');
  
  toast('Payment screenshot submitted for verification!', 'success');
  
  addNotif(`Your payment for "${ev.name}" is pending verification by the admin.`, '⏳');
  addNotifToUser(ev.adminId, `${titleCase(STATE.user.name)} submitted a payment screenshot for "${ev.name}".`, '💳');
  
  showPage(STATE.page); // Refresh current page
};

function simulatePayment(method) {
  if (!currentPaymentEvent) return;

  const ev = currentPaymentEvent;
  const statusEl = document.getElementById('pmt-status');
  statusEl.style.display = 'block';
  statusEl.style.color = '#374151';

  const upiId = ev.adminUpiId || 'vvce@sbi';
  const name = encodeURIComponent(ev.club || 'VVCE Event');
  const amount = ev.fee;

  const upiLink = `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR`;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    let appLink = upiLink;
    if (method === 'GPay') appLink = `gpay://upi/pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR`;
    else if (method === 'PhonePe') appLink = `phonepe://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR`;
    window.location.href = appLink;
    statusEl.innerHTML = `
      <div style="text-align:center;padding-top:10px;">
        <div style="font-size:14px;color:#374151;margin-bottom:15px;">Opening ${method}... Return here after paying.</div>
        <button onclick="document.getElementById('pmt-screenshot-input').click()" class="btn-dark-register" style="width:100%;">Upload Payment Screenshot 📸</button>
      </div>
    `;
  } else {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`;
    statusEl.innerHTML = `
      <div style="text-align:center;padding-top:10px;">
        <img src="${qrUrl}" alt="UPI QR Code" style="width:180px;height:180px;border-radius:10px;margin-bottom:15px;border:1px solid #e2e8f0;padding:5px;background:#fff;">
        <div style="font-size:14px;color:#374151;margin-bottom:15px;font-weight:600;">Scan this QR code with any UPI app to pay</div>
        <button onclick="document.getElementById('pmt-screenshot-input').click()" class="btn-dark-register" style="width:100%;">Upload Payment Screenshot 📸</button>
      </div>
    `;
  }
}

function completeRegistration(ev, paid = false) {
  const events = getDB('vvce_events');
  // Re-fetch event from DB to ensure latest state
  const dbEv = events.find(e => e.id === ev.id);
  if (!dbEv) return;
  
  if (!dbEv.registrations) dbEv.registrations = [];
  dbEv.registrations.push(STATE.user.id);
  dbEv.regCount = (dbEv.regCount||0) + 1;
  setDB('vvce_events', events);
  
  if (paid) {
    addNotif(`Payment of ₹${dbEv.fee} completed and registered for "${dbEv.name}"! 🎉`, '✅');
    toast(`Payment successful! Registered for ${dbEv.name} 🎉`, 'success');
    
    // Notify Club Admin
    if (dbEv.adminId) {
      addNotifToUser(dbEv.adminId, `${STATE.user.name} registered for "${dbEv.name}" and payment of ₹${dbEv.fee} is completed! 💰`, '💰');
    }
  } else {
    addNotif(`Registered for "${dbEv.name}" on ${formatDate(dbEv.date)}! 🎉`, '🎉');
    toast(`Registered for ${dbEv.name}! 🎉`, 'success');
    
    // Notify Club Admin for free event
    if (dbEv.adminId) {
      addNotifToUser(dbEv.adminId, `${STATE.user.name} registered for "${dbEv.name}".`, '👥');
    }
  }
  
  if (STATE.page==='events') filterEvents();
  if (STATE.page==='dashboard') renderStudentDashboard();
  
  // Close the event details modal if it's open
  const detailModal = document.getElementById('modal-event-detail');
  if (detailModal && detailModal.classList.contains('open')) {
    closeModal('modal-event-detail');
  }
}

function unregisterEv(id) {
  if (!confirm('Unregister from this event?')) return;
  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  ev.registrations = (ev.registrations||[]).filter(uid => uid !== STATE.user.id);
  ev.regCount = Math.max(0, (ev.regCount||1) - 1);
  setDB('vvce_events', events);
  toast('Unregistered from event.','info');
  if (STATE.page==='events') filterEvents();
  if (STATE.page==='dashboard') renderStudentDashboard();
}

function openEventModal(id) {
  const ev   = getDB('vvce_events').find(e => e.id === id);
  if (!ev) return;
  const user  = STATE.user;
  const isReg = (ev.registrations||[]).includes(user?.id);
  const isFull= ev.regCount >= ev.maxParticipants;

  document.getElementById('modal-event-title').textContent = ev.name;
  document.getElementById('modal-event-body').innerHTML = `
    <div style="background:linear-gradient(135deg,#1e2a3d,#0f172a);border-radius:12px;height:160px;display:flex;align-items:center;justify-content:center;font-size:80px;margin-bottom:1.25rem;position:relative;overflow:hidden;">
      ${ev.poster?`<img src="${ev.poster}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;">`:`<span>${ev.emoji||'🎓'}</span>`}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1rem;">
      ${detailChip('📅','Date',formatDate(ev.date))}
      ${detailChip('🕐','Time',formatTime(ev.time))}
      ${detailChip('📍','Venue',ev.venue)}
      ${detailChip('👥','Seats',`${ev.regCount}/${ev.maxParticipants}`)}
      ${detailChip('⭐','AICTE Points',`${ev.points||0} pts`)}
      ${detailChip('🎓','Target Branches',(ev.branches && ev.branches.length > 0) ? (ev.branches.includes('All') ? 'All Branches' : ev.branches.join(', ')) : 'All Branches')}
      <div style="grid-column:1/-1;">${detailChip('💰','Fee',ev.fee>0?`₹${ev.fee}`:'FREE')}</div>
    </div>
    ${ev.desc?`<div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:1rem;"><div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:6px;">About</div><p style="font-size:13px;color:#374151;line-height:1.7;">${ev.desc}</p></div>`:''}
    ${ev.speakers?`<div style="font-size:12px;color:#6b7280;margin-bottom:8px;">Speakers: <strong style="color:#111827;">${ev.speakers}</strong></div>`:''}
    ${ev.rules?`<div style="font-size:12px;color:#6b7280;margin-bottom:12px;">Rules: ${ev.rules}</div>`:''}
    <div style="font-size:12px;color:#6b7280;margin-bottom:1rem;">Organized by: <strong style="color:#111827;">${ev.club}</strong></div>
    ${user?.type==='student' ? `
      <div style="display:flex;gap:10px;margin-top:6px;">
        ${isReg
          ? `<button onclick="unregisterEv('${ev.id}');closeModal('modal-event-detail')" class="btn btn-outline" style="flex:1;">Unregister</button>
             <div style="flex:2;padding:11px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;text-align:center;font-weight:700;font-size:14px;color:#15803d;">✓ You're Registered</div>`
          : isFull
            ? `<div style="flex:1;padding:11px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;text-align:center;font-weight:700;color:#991b1b;">Event Full</div>`
            : `<button onclick="registerEv('${ev.id}');closeModal('modal-event-detail')" style="flex:1;padding:11px;background:linear-gradient(135deg,#f59e0b,#fbbf24);border:none;border-radius:8px;font-weight:800;font-size:14px;color:#0f172a;cursor:pointer;">Register Now →</button>`
        }
      </div>` : ''
    }
  `;
  openModal('modal-event-detail');
}

function detailChip(icon,label,val) {
  return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">
    <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;font-weight:700;margin-bottom:3px;">${icon} ${label}</div>
    <div style="font-size:13px;color:#111827;font-weight:600;">${val}</div>
  </div>`;
}


/* ─────────────────────────────────────────────────────────────
   CALENDAR PAGE
───────────────────────────────────────────────────────────────*/
function renderCalendarPage() {
  const el = document.getElementById('page-calendar');
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 300px;gap:1.5rem;">
      <div>
        <div class="cal-wrap">
          <div class="cal-head">
            <span class="sec-title" id="cal-month-title"></span>
            <div class="cal-nav">
              <button onclick="changeMonth(-1)">‹</button>
              <button onclick="changeMonth(1)">›</button>
            </div>
          </div>
          <div class="cal-grid" id="cal-grid"></div>
          <div class="cal-legend">
            <div class="legend-item"><div class="legend-dot" style="background:linear-gradient(135deg,#f59e0b,#fbbf24)"></div>Today</div>
            <div class="legend-item"><div class="legend-dot" style="background:#3b82f6"></div>Event Day</div>
            <div class="legend-item"><div class="legend-dot" style="background:#ef4444"></div>Holiday</div>
            <div class="legend-item"><div class="legend-dot" style="background:#f59e0b"></div>Exam</div>
          </div>
        </div>
      </div>
      <div>
        <div class="sec-head"><span class="sec-title">Events on Date</span></div>
        <div id="cal-events-panel"><p style="color:#9ca3af;font-size:13px;padding:12px;background:#f8fafc;border-radius:8px;">Click a date to view events</p></div>
        <div style="margin-top:1.5rem;">
          <div class="sec-head"><span class="sec-title">Academic Schedule</span></div>
          <div id="acad-schedule"></div>
        </div>
      </div>
    </div>
  `;
  drawCalendar();
  renderAcadSchedule();
}

function changeMonth(d) { STATE.calMonth += d; if(STATE.calMonth<0){STATE.calMonth=11;STATE.calYear--;}else if(STATE.calMonth>11){STATE.calMonth=0;STATE.calYear++;} drawCalendar(); }

function drawCalendar() {
  const year=STATE.calYear, month=STATE.calMonth;
  const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const now=new Date();

  const titleEl = document.getElementById('cal-month-title');
  if (titleEl) titleEl.textContent = `${monthNames[month]} ${year}`;

  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Day headers
  dayNames.forEach(d => { const el=document.createElement('div'); el.className='cal-day-lbl'; el.textContent=d; grid.appendChild(el); });

  const firstDay = new Date(year,month,1).getDay();
  const totalDays = new Date(year,month+1,0).getDate();
  let events = getDB('vvce_events').filter(e=>e.status==='approved');
  if (STATE.user && STATE.user.type === 'student') {
    events = events.filter(e => !e.branches || e.branches.length === 0 || e.branches.includes('All') || e.branches.includes(STATE.user.branch));
  }
  const acad   = getDB('vvce_academic');

  for(let i=0;i<firstDay;i++){const c=document.createElement('div');c.className='cal-day other';grid.appendChild(c);}

  for(let d=1;d<=totalDays;d++){
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell=document.createElement('div');
    cell.className='cal-day';
    cell.textContent=d;

    const isToday=now.getFullYear()===year&&now.getMonth()===month&&now.getDate()===d;
    const hasEv=events.some(e=>e.date===ds);
    const sched=acad.find(s=>s.date===ds);

    if(isToday) cell.classList.add('today');
    else if(hasEv) cell.classList.add('has-ev');
    if(sched?.type==='holiday') cell.classList.add('holiday');
    else if(sched?.type==='exam') cell.classList.add('exam');

    cell.dataset.date = ds;
    cell.onclick = function() {
      const calGrid = document.getElementById('cal-grid');
      if (calGrid) calGrid.querySelectorAll('.cal-day.selected').forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');
      STATE.selectedDate = this.dataset.date;
      showCalDateEvents(this.dataset.date);
    };
    grid.appendChild(cell);
  }
}

function showCalDateEvents(ds) {
  let events = getDB('vvce_events').filter(e=>e.status==='approved'&&e.date===ds);
  if (STATE.user && STATE.user.type === 'student') {
    events = events.filter(e => !e.branches || e.branches.length === 0 || e.branches.includes('All') || e.branches.includes(STATE.user.branch));
  }
  const panel  = document.getElementById('cal-events-panel');
  if (!panel) return;
  if (!events.length) { panel.innerHTML=`<p style="color:#9ca3af;font-size:13px;padding:12px;background:#f8fafc;border-radius:8px;">No events on ${formatDate(ds)}</p>`; return; }
  panel.innerHTML = events.map(e=>`
    <div class="sched-row" onclick="openEventModal('${e.id}')">
      <span class="sched-emoji">${e.emoji||'🎓'}</span>
      <div class="sched-info">
        <div class="sched-name">${e.name}</div>
        <div class="sched-meta">${formatTime(e.time)} • ${e.venue}</div>
      </div>
    </div>`).join('');
}

function renderAcadSchedule() {
  const acad   = getDB('vvce_academic');
  const events = getDB('vvce_events').filter(e=>e.status==='approved');
  const panel  = document.getElementById('acad-schedule');
  if (!panel) return;

  const upcoming = [...acad,...events.map(e=>({date:e.date,type:'event',label:e.name}))].filter(s=>new Date(s.date)>=new Date()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6);

  if (!upcoming.length) { panel.innerHTML=`<p style="color:#9ca3af;font-size:13px;">No upcoming events</p>`; return; }
  panel.innerHTML = upcoming.map(s=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;">
      <div style="font-size:18px;">${s.type==='holiday'?'🏖️':s.type==='exam'?'📝':'🎓'}</div>
      <div style="flex:1;font-size:13px;font-weight:700;color:#111827;">${s.label}</div>
      <div style="font-size:11px;color:#6b7280;">${formatDate(s.date)}</div>
    </div>`).join('');
}


/* ─────────────────────────────────────────────────────────────
   REGISTRATIONS PAGE
───────────────────────────────────────────────────────────────*/
function renderRegistrationsPage() {
  const events   = getDB('vvce_events');
  const myRegs   = events.filter(e=>(e.registrations||[]).includes(STATE.user.id));
  const now      = new Date();
  const upcoming = myRegs.filter(e=>new Date(e.date)>=now);
  const past     = myRegs.filter(e=>new Date(e.date)<now);
  const el       = document.getElementById('page-registrations');

  el.innerHTML = `
    <div class="tab-bar">
      <button class="tab-btn active" id="tab-up" onclick="switchRegTab('upcoming')">Upcoming (${upcoming.length})</button>
      <button class="tab-btn" id="tab-past" onclick="switchRegTab('past')">Past Events (${past.length})</button>
    </div>
    <div id="reg-upcoming">${regList(upcoming,false)}</div>
    <div id="reg-past" style="display:none;">${regList(past,true)}</div>
  `;
}

function switchRegTab(which) {
  document.getElementById('tab-up').classList.toggle('active', which==='upcoming');
  document.getElementById('tab-past').classList.toggle('active', which==='past');
  document.getElementById('reg-upcoming').style.display = which==='upcoming'?'':'none';
  document.getElementById('reg-past').style.display = which==='past'?'':'none';
}

function regList(evs, past) {
  if (!evs.length) return `<div class="empty-state"><div class="ei">📋</div><div class="et">${past?'No past events.':'No upcoming registrations.'}</div>${!past?`<button class="btn btn-gold" style="margin-top:12px;" onclick="showPage('events')">Browse Events</button>`:''}</div>`;
  return evs.map(e=>`
    <div class="sched-row" style="margin-bottom:8px;" onclick="openEventModal('${e.id}')">
      <span class="sched-emoji" style="font-size:32px;">${e.emoji||'🎓'}</span>
      <div class="sched-info">
        <div class="sched-name" style="font-size:14px;">${e.name}</div>
        <div class="sched-meta">${e.club}</div>
        <div class="sched-meta">${formatDate(e.date)} • ${formatTime(e.time)} • ${e.venue}</div>
      </div>
      <div style="text-align:right;">
        <span class="att-tag ${past ? (e.attendedStudents?.includes(STATE.user.id) ? 'att-done' : 'att-reg') : 'att-reg'}" style="${past && !e.attendedStudents?.includes(STATE.user.id) ? 'background:rgba(239,68,68,0.1);color:#ef4444;border-color:rgba(239,68,68,0.3);' : ''}">
          ${past ? (e.attendedStudents?.includes(STATE.user.id) ? '✓ Attended' : '❌ Not Attended') : 'Registered'}
        </span>
        <div style="font-size:11px;color:#9ca3af;margin-top:4px;">⭐ ${e.points||0} pts</div>
      </div>
    </div>`).join('');
}


/* ─────────────────────────────────────────────────────────────
   CERTIFICATES PAGE
───────────────────────────────────────────────────────────────*/
function renderCertificatesPage() {
  const user  = STATE.user;
  const certs = getDB('vvce_certs').filter(c=>c.userId===user.id);
  const certPts = certs.reduce((s,c)=>s+(c.points||0),0);
  const totalPts = certPts + (user.points||0);
  const el = document.getElementById('page-certificates');

  el.innerHTML = `
    <div class="sec-head">
      <span class="sec-title">My Certificates (${certs.length})</span>
      <button class="btn btn-gold" onclick="openModal('modal-cert-upload')">+ Upload Certificate</button>
    </div>

    <!-- Summary banner -->
    <div style="background:linear-gradient(135deg,#111827,#1e2a3d);border-radius:12px;padding:1.25rem 1.5rem;margin-bottom:1.5rem;display:flex;align-items:center;gap:2rem;flex-wrap:wrap;">
      <div style="text-align:center;">
        <div style="font-family:'Outfit',sans-serif;font-size:40px;font-weight:900;color:#f59e0b;">${totalPts}</div>
        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:700;">Total AICTE Points</div>
      </div>
      <div style="width:1px;height:50px;background:rgba(255,255,255,0.08);"></div>
      <div style="flex:1;min-width:180px;">
        <div style="font-size:13px;color:#d1d5db;margin-bottom:6px;">Progress to AICTE Target (100 pts)</div>
        <div class="pts-bar-wrap"><div class="pts-bar" style="width:${Math.min(100,totalPts)}%"></div></div>
        <div style="font-size:11px;color:#9ca3af;margin-top:4px;">${totalPts}/100 points</div>
      </div>
      <div style="display:flex;gap:1.5rem;">
        <div style="text-align:center;"><div style="font-family:'Outfit',sans-serif;font-size:24px;font-weight:900;color:#fbbf24;">${certs.filter(c=>c.type==='achievement').length}</div><div style="font-size:11px;color:#9ca3af;">Achievements</div></div>
        <div style="text-align:center;"><div style="font-family:'Outfit',sans-serif;font-size:24px;font-weight:900;color:#10b981;">${certs.filter(c=>c.type==='participation').length}</div><div style="font-size:11px;color:#9ca3af;">Participation</div></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;">
      ${certs.length
        ? certs.map(c=>`
          <div class="cert-card" style="${c.autoGenerated?'border:1px solid rgba(99,102,241,0.25);':''}"
          >
            <div class="cert-card-head">
              <span class="cert-type" style="color:${c.type==='achievement'?'#b45309':'#1d4ed8'}">${c.type==='achievement'?'🏆 Achievement':'🎖 Participation'}</span>
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                ${c.autoGenerated ? `<span style="padding:2px 8px;border-radius:10px;background:rgba(99,102,241,0.15);color:#a5b4fc;font-size:10px;font-weight:700;border:1px solid rgba(99,102,241,0.25);">🎓 Event Award</span>` : ''}
                ${c.verified ? `<span class="badge badge-green">✓ Verified</span>` : `<span class="badge badge-amber">⏳ Pending</span>`}
              </div>
            </div>
            <div class="cert-title">${c.title}</div>
            <div class="cert-issuer">${c.issuer}</div>
            <div style="font-size:12px;color:#9ca3af;margin-bottom:8px;">${formatDate(c.date)} • ${c.position}</div>
            <div class="cert-foot">
              <span class="cert-pts">⭐ ${c.points} AICTE Points</span>
              <button class="cert-dl-btn" onclick="downloadCertPDF('${c.id}')">Download PDF</button>
            </div>
          </div>`).join('')
        : `<div class="empty-state" style="grid-column:1/-1"><div class="ei">📜</div><div class="et">No certificates yet</div><div class="es">Participate in events to earn certificates</div><button class="btn btn-gold" style="margin-top:12px;" onclick="showPage('events')">Browse Events</button></div>`
      }
    </div>
  `;
}

function submitCertificate() {
  const title  = document.getElementById('cert-title').value.trim();
  const issuer = document.getElementById('cert-issuer').value.trim();
  const date   = document.getElementById('cert-date').value;
  const pos    = document.getElementById('cert-position').value;
  const pts    = parseInt(document.getElementById('cert-points').value||'0');

  if (!title||!issuer||!date) { toast('Please fill all required fields.','error'); return; }

  const certs = getDB('vvce_certs');
  certs.push({ id:genId('c'), userId:STATE.user.id, title, issuer, date, position:pos, points:pts, type:['Winner','Runner-up'].includes(pos)?'achievement':'participation', verified:false });
  setDB('vvce_certs', certs);
  closeModal('modal-cert-upload');
  toast('Certificate submitted for verification! ⏳','success');
  if (STATE.page==='certificates') renderCertificatesPage();
}

/* ── Certificate PDF Generator ── */
window.downloadCertPDF = function(certId) {
  const cert  = getDB('vvce_certs').find(c => c.id === certId);
  const user  = STATE.user;
  if (!cert) { toast('Certificate not found.','error'); return; }

  const isAchievement = cert.type === 'achievement';
  const dateStr = new Date(cert.date).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Certificate – ${cert.title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Outfit:wght@300;400;600&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;}
    body{width:297mm;height:210mm;display:flex;align-items:center;justify-content:center;background:#fff;font-family:'Outfit',sans-serif;}
    .cert{width:280mm;height:198mm;border:8px solid ${isAchievement?'#b45309':'#1e40af'};border-radius:6px;position:relative;
      background:linear-gradient(135deg,#fffbeb 0%,#ffffff 50%,#eff6ff 100%);
      display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16mm 20mm;text-align:center;}
    .cert::before{content:'';position:absolute;inset:12px;border:2px solid ${isAchievement?'rgba(180,83,9,0.25)':'rgba(30,64,175,0.2)'};border-radius:3px;pointer-events:none;}
    .corner{position:absolute;width:40px;height:40px;border-color:${isAchievement?'#b45309':'#1e40af'};border-style:solid;opacity:.4;}
    .tl{top:20px;left:20px;border-width:3px 0 0 3px;}
    .tr{top:20px;right:20px;border-width:3px 3px 0 0;}
    .bl{bottom:20px;left:20px;border-width:0 0 3px 3px;}
    .br{bottom:20px;right:20px;border-width:0 3px 3px 0;}
    .logo{font-size:13px;letter-spacing:.15em;text-transform:uppercase;color:#6b7280;margin-bottom:6px;}
    .badge{font-size:32px;margin-bottom:8px;}
    .head{font-family:'Playfair Display',serif;font-size:11px;letter-spacing:.3em;text-transform:uppercase;
      color:${isAchievement?'#92400e':'#1e40af'};margin-bottom:10px;}
    .name{font-family:'Playfair Display',serif;font-size:36px;font-weight:900;
      color:#111827;border-bottom:2px solid ${isAchievement?'#b45309':'#1e40af'};
      padding-bottom:6px;margin-bottom:10px;line-height:1.2;}
    .body{font-size:14px;color:#374151;line-height:1.7;max-width:200mm;}
    .event{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;
      color:${isAchievement?'#92400e':'#1e40af'};display:inline;}
    .pts-badge{display:inline-block;margin-top:12px;padding:6px 20px;border-radius:20px;
      background:${isAchievement?'rgba(180,83,9,0.1)':'rgba(30,64,175,0.08)'};
      border:1px solid ${isAchievement?'rgba(180,83,9,0.3)':'rgba(30,64,175,0.25)'};
      color:${isAchievement?'#92400e':'#1e40af'};font-size:13px;font-weight:700;}
    .footer{margin-top:14px;display:flex;justify-content:space-between;width:100%;align-items:flex-end;}
    .sig{text-align:center;flex:1;}
    .sig-line{width:120px;height:1px;background:#9ca3af;margin:0 auto 4px;}
    .sig-name{font-size:11px;color:#6b7280;}
    .date-box{font-size:12px;color:#6b7280;text-align:center;flex:1;}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
  </style></head>
  <body><div class="cert">
    <div class="corner tl"></div><div class="corner tr"></div>
    <div class="corner bl"></div><div class="corner br"></div>
    <div class="logo">Visvesvaraya Vidyavardhaka College of Engineering, Mysuru</div>
    <div class="badge">${isAchievement?'🏆':'🎓'}</div>
    <div class="head">Certificate of ${isAchievement?'Achievement':'Participation'}</div>
    <div class="name">${user.name || 'Student'}</div>
    <div class="body">
      has successfully ${isAchievement?'won the <strong>'+cert.position+'</strong> position in':'participated in'}
      the event <span class="event">${cert.title}</span><br>
      organised by <strong>${cert.issuer}</strong>
    </div>
    <div class="pts-badge">⭐ ${cert.points} AICTE Activity Points Awarded</div>
    <div class="footer">
      <div class="sig"><div class="sig-line"></div><div class="sig-name">Club Coordinator</div></div>
      <div class="date-box"><strong>${dateStr}</strong><br><span style="font-size:10px;">Date of Event</span></div>
      <div class="sig"><div class="sig-line"></div><div class="sig-name">Dean – Student Welfare</div></div>
    </div>
  </div></body></html>`;

  const win = window.open('','_blank','width=1200,height=900');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 800);
};


/* ─────────────────────────────────────────────────────────────
   PROFILE PAGE
───────────────────────────────────────────────────────────────*/
function renderProfilePage() {
  const user  = STATE.user;
  const certs = getDB('vvce_certs').filter(c=>c.userId===user.id);
  const regs  = getDB('vvce_events').filter(e=>(e.registrations||[]).includes(user.id));
  const total = certs.reduce((s,c)=>s+(c.points||0),0)+(user.points||0);
  const el    = document.getElementById('page-profile');

  if (user.type !== 'student') { el.innerHTML = renderAuthorityProfile(); return; }

  el.innerHTML = `
    <!-- Main profile card -->
    <div class="profile-head-card">
      <div class="prof-head-row">
        <div class="prof-avatar-wrap" onclick="triggerPhotoUpload()">
          <div class="prof-avatar">
            ${user.profilePhoto?`<img src="${user.profilePhoto}">`:`<span>${avatar(user.name)}</span>`}
          </div>
          <div class="photo-edit-overlay">📷</div>
          <input type="file" id="photo-upload" style="display:none;" accept="image/*" onchange="handlePhotoUpload(this)">
        </div>
        <div class="prof-info" style="flex:1;">
          <h2>${titleCase(user.name)}</h2>
          <div class="prof-meta-row" style="color:#6b7280;">${user.usn||'—'} &nbsp;•&nbsp; ${user.branch||'—'} &nbsp;•&nbsp; ${computeStudentYearSem(user).year} &nbsp;•&nbsp; Sec ${user.section||'—'}</div>
          <div class="prof-meta-row" style="font-size:12px;color:#9ca3af;margin-top:2px;">${user.email}</div>
          ${user.bio?`<div style="font-size:13px;color:#374151;margin-top:8px;font-style:italic;line-height:1.5;">"${user.bio}"</div>`:''}
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;">
            ${(user.interests||[]).map(i=>`<span class="interest-chip selected" style="cursor:default;">${i}</span>`).join('')}
          </div>
        </div>
        <button class="btn btn-gold" onclick="openProfileEdit()" style="align-self:flex-start;white-space:nowrap;">✏️ Edit Profile</button>
      </div>
      <div class="prof-stats">
        <div class="prof-stat"><div class="val">${total}</div><div class="lbl">AICTE Points</div></div>
        <div class="prof-stat"><div class="val">${regs.length}</div><div class="lbl">Registered</div></div>
        <div class="prof-stat"><div class="val">${certs.length}</div><div class="lbl">Certificates</div></div>
        <div class="prof-stat"><div class="val">${regs.filter(e=>new Date(e.date)<new Date()).length}</div><div class="lbl">Attended</div></div>
      </div>
    </div>

    <!-- Two-col info -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
      <div class="white-card">
        <div class="sec-title" style="margin-bottom:1rem;">Academic Details</div>
        <div class="prof-grid">
          ${profField('USN',user.usn)} ${profField('Branch',user.branch)}
          ${profField('Year', computeStudentYearSem(user).year)} ${profField('Semester', computeStudentYearSem(user).sem)}
          ${profField('Section',user.section)} ${profField('Email',user.email)}
        </div>
      </div>
      <div class="white-card">
        <div class="sec-title" style="margin-bottom:1rem;">Contact & Links</div>
        <div class="prof-grid">
          ${profField('Phone',user.phone)}
          ${profFieldLink('LinkedIn',user.linkedin)}
          ${profFieldLink('GitHub',user.github)}
        </div>
        <div style="margin-top:12px;">
          <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:6px;">Skills</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;">
            ${(user.skills||[]).length
              ? user.skills.map(s=>`<span class="skill-chip">${s}</span>`).join('')
              : `<span style="font-size:13px;color:#9ca3af;">No skills added. <span style="color:#f59e0b;cursor:pointer;" onclick="openProfileEdit()">Add →</span></span>`
            }
          </div>
        </div>
        ${user.resume?`<div style="margin-top:10px;"><a href="${user.resume}" download style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;color:#1d4ed8;font-size:12px;font-weight:700;">📄 Download Resume</a></div>`:''}
      </div>
    </div>

    <!-- Achievements -->
    <div class="white-card" style="margin-bottom:1rem;">
      <div class="sec-head"><span class="sec-title">Achievements & Awards</span><button class="btn btn-outline" onclick="openProfileEdit()">+ Add</button></div>
      ${(user.achievements||[]).length
        ? user.achievements.map(a=>`
          <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;">
            <div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#f59e0b,#fbbf24);display:flex;align-items:center;justify-content:center;font-size:14px;">🏆</div>
            <div style="font-size:13px;font-weight:600;color:#111827;">${a}</div>
          </div>`).join('')
        : `<div style="color:#9ca3af;font-size:13px;">No achievements added. <span style="color:#f59e0b;cursor:pointer;" onclick="openProfileEdit()">Add achievements →</span></div>`
      }
    </div>

    <!-- AICTE Sem breakdown -->
    <div class="white-card">
      <div class="sec-title" style="margin-bottom:1rem;">AICTE Points — Semester Breakdown</div>
      <div class="sem-grid">
        ${Object.entries(user.pointsBySem||{}).map(([s,p])=>`<div class="sem-cell"><div class="sem-val">${p}</div><div class="sem-lbl">${s}</div></div>`).join('')}
      </div>
    </div>
  `;
}

function renderAuthorityProfile() {
  const user = STATE.user;
  const isClubAdmin = user.type === 'admin';
  return `
    <div class="profile-head-card">
      <div class="prof-head-row">
        <div class="prof-avatar-wrap" onclick="triggerPhotoUpload()">
          <div class="prof-avatar">${user.profilePhoto?`<img src="${user.profilePhoto}">`:`<span>${avatar(user.name)}</span>`}</div>
          <div class="photo-edit-overlay">📷</div>
          <input type="file" id="photo-upload" style="display:none;" accept="image/*" onchange="handlePhotoUpload(this)">
        </div>
        <div class="prof-info" style="flex:1;">
          <h2>${titleCase(user.name)}</h2>
          ${isClubAdmin
            ? `<div class="prof-meta-row" style="color:#f59e0b;font-weight:700;font-size:15px;">🏛️ ${user.clubName||'Club Admin'}</div>`
            : `<div class="prof-meta-row" style="color:#6b7280;">${titleCase(user.designation||'')} &nbsp;•&nbsp; ${user.dept||''}</div>`
          }
          <div class="prof-meta-row" style="font-size:12px;color:#9ca3af;">${user.email}</div>
        </div>
        <button class="btn btn-gold" onclick="openProfileEdit()" style="align-self:flex-start;white-space:nowrap;">✏️ Edit Profile</button>
      </div>
    </div>

    ${isClubAdmin ? `
    <!-- Club Details -->
    <div class="white-card" style="margin-top:1rem;">
      <div class="sec-head"><span class="sec-title">🏛️ Club Information</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px;">
        ${profField('Club Name', user.clubName)}
        ${profField('Domain / Category', user.domain)}
        ${profField('Department', user.dept || user.branch)}
        ${profField('Faculty Coordinator', user.faculty)}
        ${profField('Club Email', user.clubEmail)}
        ${profField('Phone', user.phone)}
      </div>
      ${user.desc ? `<div style="margin-top:12px;"><label style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:700;">About the Club</label><div style="margin-top:4px;font-size:13px;color:#374151;line-height:1.6;">${user.desc}</div></div>` : ''}
    </div>

    <!-- Personal Info -->
    <div class="white-card" style="margin-top:1rem;">
      <div class="sec-head"><span class="sec-title">👤 Representative Details</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px;">
        ${profField('Representative Name', titleCase(user.name))}
        ${profField('VVCE Email', user.email)}
        ${profField('USN', user.usn)}
        ${profField('Phone', user.phone)}
      </div>
      ${user.bio ? `<div style="margin-top:12px;"><label style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:700;">Bio</label><div style="margin-top:4px;font-size:13px;color:#374151;font-style:italic;">&ldquo;${user.bio}&rdquo;</div></div>` : ''}
      ${(user.skills||[]).length ? `
        <div style="margin-top:12px;">
          <label style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:700;">Skills</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">${user.skills.map(s=>`<span class="skill-chip">${s}</span>`).join('')}</div>
        </div>` : ''}
      <div style="display:flex;gap:8px;margin-top:12px;">
        ${user.linkedin?`<a href="https://${user.linkedin}" target="_blank" class="soc-link">LinkedIn</a>`:''}
        ${user.github?`<a href="https://${user.github}" target="_blank" class="soc-link">GitHub</a>`:''}
      </div>
    </div>` : `
    <div class="white-card" style="margin-top:1rem;">
      <div class="sec-head"><span class="sec-title">👤 Profile Details</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px;">
        ${profField('Designation', titleCase(user.designation||''))}
        ${profField('Department', user.dept)}
        ${profField('Email', user.email)}
        ${profField('Phone', user.phone)}
      </div>
    </div>`}
  `;
}

function profField(label, val) { return `<div class="prof-field"><label>${label}</label><span>${val||'—'}</span></div>`; }
function profFieldLink(label, val) {
  if (!val) return profField(label,'—');
  return `<div class="prof-field"><label>${label}</label><a href="https://${val}" target="_blank" style="font-size:13px;color:#f59e0b;font-weight:600;">${val}</a></div>`;
}

function triggerPhotoUpload() { document.getElementById('photo-upload')?.click(); }
function handlePhotoUpload(input) {
  const file=input.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=e=>{ updateUser({profilePhoto:e.target.result}); toast('Profile photo updated! 📷','success'); renderProfilePage(); renderSidebar(); renderTopbarUser(); };
  r.readAsDataURL(file);
}

function openProfileEdit() {
  const user=STATE.user;
  const isClubAdmin = user.type === 'admin';
  const isAuthority = user.type === 'authority';

  if (isClubAdmin) {
    document.getElementById('modal-profile-body').innerHTML=`
      <div style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:10px;">🏛️ Club Information</div>
      <div class="form-row">
        <div class="form-group"><label>Club Name</label><input type="text" id="pe-clubname" value="${user.clubName||''}" placeholder="e.g. CSE Club"></div>
        <div class="form-group"><label>Domain / Category</label><input type="text" id="pe-domain" value="${user.domain||''}" placeholder="e.g. Technical"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Department</label><input type="text" id="pe-dept" value="${user.dept||user.branch||''}" placeholder="e.g. CSE"></div>
        <div class="form-group"><label>Faculty Coordinator</label><input type="text" id="pe-faculty" value="${user.faculty||''}" placeholder="Dr. / Prof. Name"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Club Email</label><input type="email" id="pe-clubemail" value="${user.clubEmail||''}" placeholder="club@vvce.ac.in"></div>
        <div class="form-group"><label>Phone</label><input type="text" id="pe-phone" value="${user.phone||''}" placeholder="+91 9876543210"></div>
      </div>
      <div class="form-group"><label>About the Club</label><textarea id="pe-desc" rows="3" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;resize:vertical;outline:none;" placeholder="Brief description of your club...">${user.desc||''}</textarea></div>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:14px 0;">
      <div style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:10px;">👤 Representative Details</div>
      <div class="form-row">
        <div class="form-group"><label>Representative Name <span style="color:#9ca3af;font-size:11px;">(account name)</span></label><input type="text" value="${titleCase(user.name)}" disabled style="background:#f9fafb;color:#9ca3af;cursor:not-allowed;padding:10px;border:1.5px solid #e2e8f0;border-radius:6px;width:100%;font-size:13px;"></div>
        <div class="form-group"><label>VVCE Email <span style="color:#9ca3af;font-size:11px;">(cannot change)</span></label><input type="email" value="${user.email}" disabled style="background:#f9fafb;color:#9ca3af;cursor:not-allowed;padding:10px;border:1.5px solid #e2e8f0;border-radius:6px;width:100%;font-size:13px;"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>USN</label><input type="text" id="pe-usn" value="${user.usn||''}" placeholder="e.g. 4VV22CS001"></div>
      </div>
      <button class="btn-dark-register" onclick="saveProfileEdit()">Save Changes</button>
    `;
  } else if (isAuthority) {
    document.getElementById('modal-profile-body').innerHTML=`
      <div style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:10px;">🎓 Faculty Details</div>
      <div class="form-row">
        <div class="form-group"><label>Full Name <span style="color:#9ca3af;font-size:11px;">(Dr. / Prof. Name)</span></label><input type="text" id="pe-name" value="${user.name||''}" placeholder="e.g. Dr. John Doe"></div>
        <div class="form-group"><label>Designation <span style="color:#9ca3af;font-size:11px;">(e.g. Faculty, Dean)</span></label><input type="text" id="pe-designation" value="${user.designation||''}" placeholder="e.g. Faculty"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>VVCE Email</label><input type="email" id="pe-email" value="${user.email||''}" placeholder="faculty@vvce.ac.in"></div>
      </div>
      <button class="btn-dark-register" onclick="saveProfileEdit()">Save Changes</button>
    `;
  } else {
    document.getElementById('modal-profile-body').innerHTML=`
      <div class="form-row">
        <div class="form-group"><label>Phone Number</label><input type="text" id="pe-phone" value="${user.phone||''}" placeholder="9876543210"></div>
        <div class="form-group"><label>LinkedIn URL</label><input type="text" id="pe-linkedin" value="${user.linkedin||''}" placeholder="linkedin.com/in/yourname"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>GitHub URL</label><input type="text" id="pe-github" value="${user.github||''}" placeholder="github.com/yourname"></div>
        <div class="form-group"><label>Skills (comma-separated)</label><input type="text" id="pe-skills" value="${(user.skills||[]).join(', ')}" placeholder="Python, React, Node.js"></div>
      </div>
      <div class="form-group"><label>Bio / About Me</label><textarea id="pe-bio" rows="3" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;resize:vertical;outline:none;" placeholder="Write a short bio...">${user.bio||''}</textarea></div>
      <div class="form-group"><label>Achievements (one per line)</label><textarea id="pe-achievements" rows="4" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;resize:vertical;outline:none;" placeholder="e.g. Hackathon Winner 2024">${(user.achievements||[]).join('\n')}</textarea></div>
      <div class="form-group">
        <label>Interests</label>
        <div class="interest-grid" id="pe-interests">
          ${['Technical','Cultural','Sports','Management','Workshop','Social'].map(i=>`<span class="interest-chip ${(user.interests||[]).includes(i)?'selected':''}" onclick="toggleChip(this)">${i}</span>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label>Resume Upload</label>
        <div class="upload-zone" onclick="document.getElementById('resume-upload').click()">
          <div class="upload-icon">📄</div>
          <p>${user.resume?'Resume uploaded — click to replace':'Click to upload your resume (PDF)'}</p>
          <input type="file" id="resume-upload" style="display:none;" accept=".pdf,.doc,.docx" onchange="handleResumeUpload(this)">
        </div>
      </div>
      <button class="btn-dark-register" onclick="saveProfileEdit()">Save Changes</button>
    `;
  }
  openModal('modal-profile-edit');
}

function saveProfileEdit() {
  const isClubAdmin = STATE.user.type === 'admin';
  const isAuthority = STATE.user.type === 'authority';
  const updates = {};
  
  if (isAuthority) {
    updates.name = document.getElementById('pe-name')?.value.trim();
    updates.designation = document.getElementById('pe-designation')?.value.trim();
    updates.email = document.getElementById('pe-email')?.value.trim();
  } else {
    updates.phone = document.getElementById('pe-phone')?.value.trim();
    updates.linkedin = document.getElementById('pe-linkedin')?.value.trim();
    updates.github = document.getElementById('pe-github')?.value.trim();
    updates.skills = document.getElementById('pe-skills')?.value.split(',').map(s=>s.trim()).filter(Boolean);
    updates.bio = document.getElementById('pe-bio')?.value.trim();
  }

  if (isClubAdmin) {
    updates.clubName  = document.getElementById('pe-clubname')?.value.trim();
    updates.domain    = document.getElementById('pe-domain')?.value.trim();
    updates.dept      = document.getElementById('pe-dept')?.value.trim();
    updates.faculty   = document.getElementById('pe-faculty')?.value.trim();
    updates.clubEmail = document.getElementById('pe-clubemail')?.value.trim();
    updates.desc      = document.getElementById('pe-desc')?.value.trim();
    updates.usn       = document.getElementById('pe-usn')?.value.trim();
  } else if (!isAuthority) {
    const achEl = document.getElementById('pe-achievements');
    if (achEl) updates.achievements = achEl.value.split('\n').map(s=>s.trim()).filter(Boolean);
    updates.interests = [...document.querySelectorAll('#pe-interests .interest-chip.selected')].map(c=>c.textContent.trim());
  }

  updateUser(updates);
  closeModal('modal-profile-edit');
  toast('Profile updated! ✅','success');
  renderProfilePage();
  renderSidebar();
}

function handleResumeUpload(input) {
  const file=input.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=e=>{ updateUser({resume:e.target.result}); toast('Resume uploaded! 📄','success'); };
  r.readAsDataURL(file);
}

function updateUser(updates) {
  const users=getDB('vvce_users');
  const idx=users.findIndex(u=>u.id===STATE.user.id);
  if(idx>-1){ Object.assign(users[idx],updates); setDB('vvce_users',users); STATE.user=users[idx]; }
}


/* ─────────────────────────────────────────────────────────────
   ADMIN DASHBOARD
───────────────────────────────────────────────────────────────*/
function renderAdminDashboard() {
  const user   = STATE.user;
  const events = getDB('vvce_events').filter(e=>e.adminId===user.id);
  const approved = events.filter(e=>e.status==='approved');
  const pending  = events.filter(e=>e.status==='pending');
  const totalRegs= approved.reduce((s,e)=>s+(e.regCount||0),0);
  const el       = document.getElementById('page-admin-dashboard');

  // Recent 6-month chart data based on actual registrations
  const d = new Date();
  const months = [];
  const chartData = [0, 0, 0, 0, 0, 0];
  
  for (let i = 5; i >= 0; i--) {
    const temp = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(temp.toLocaleString('default', { month: 'short' }));
  }

  approved.forEach(e => {
    if (e.regCount > 0 && e.date) {
      const evDate = new Date(e.date);
      const diffMonths = (d.getFullYear() - evDate.getFullYear()) * 12 + (d.getMonth() - evDate.getMonth());
      if (diffMonths >= 0 && diffMonths <= 5) {
        chartData[5 - diffMonths] += e.regCount;
      }
    }
  });

  const max=Math.max(...chartData,1);

  el.innerHTML=`
    <!-- Stats row -->
    <div class="stats-row">
      ${statCard('📅','Total Events',events.length,'All time','stat-blue')}
      ${statCard('✅','Approved',approved.length,'Active events','stat-mint')}
      ${statCard('⏳','Pending Approval',pending.length,'Awaiting Dean review','stat-amber')}
      ${statCard('👥','Total Registrations',totalRegs,'Across all events','stat-purple')}
    </div>



    <div class="admin-main-grid">
      <!-- Left: chart -->
      <div class="white-card">
        <div class="sec-head"><span class="sec-title">Registrations (Last 6 Months)</span></div>
        <div class="analytics-chart" id="admin-chart">
          ${chartData.some(v=>v>0)
            ? chartData.map((v,i)=>`
              <div class="chart-bar-row">
                <span class="chart-lbl">${months[i]}</span>
                <div class="chart-track"><div class="chart-fill" style="width:${Math.round(v/max*100)}%">${v>0?v:''}</div></div>
              </div>`).join('')
            : `<div class="chart-empty">No registrations yet. The progress graph will appear here once students start registering for your events.</div>`
          }
        </div>
      </div>

      <!-- Right: quick actions -->
      <div>
        <div class="sec-title" style="margin-bottom:10px;">Quick Actions</div>
        <div class="qa-grid">
          <div class="qa-card" onclick="showPage('create-event')"><span class="qa-icon">➕</span><div class="qa-label">Create Event</div></div>
          <div class="qa-card" onclick="showPage('manage-events')"><span class="qa-icon">📋</span><div class="qa-label">Manage Events</div></div>
          <div class="qa-card" onclick="showPage('participants')"><span class="qa-icon">👥</span><div class="qa-label">View Participants</div></div>
          <div class="qa-card" onclick="toast('Clash detection feature coming soon!','info')"><span class="qa-icon">⚡</span><div class="qa-label">Clash Detect</div></div>
        </div>

        <!-- Recent events -->
        <div class="sec-title" style="margin:1rem 0 10px;">Recent Events</div>
        ${events.slice(0,3).map(e=>`
          <div class="ev-row" onclick="showPage('manage-events')">
            <span class="ev-row-emoji">${e.emoji||'🎓'}</span>
            <div class="ev-row-info">
              <div class="ev-row-name">${e.name}</div>
              <div class="ev-row-meta">${formatDate(e.date)} • ${e.venue}</div>
            </div>
            <span class="badge ${e.status==='approved'?'badge-green':e.status==='pending'?'badge-amber':'badge-red'}">${e.status}</span>
          </div>`).join('') || `<div class="empty-state" style="padding:1.5rem;"><div class="ei">📅</div><div class="et">No events yet</div></div>`}
      </div>
    </div>
  `;
}


/* ─────────────────────────────────────────────────────────────
   CREATE EVENT PAGE
───────────────────────────────────────────────────────────────*/
function renderCreateEventPage() {
  const el = document.getElementById('page-create-event');
  el.innerHTML = `
    <div class="create-ev-wrap">
      <div class="create-ev-title">Create New Event</div>
      <div class="create-ev-sub">Fill in the details below. Event will be sent for authority approval.</div>
      <div class="create-ev-card">

        <div class="form-row">
          <div class="form-group"><label>Event Name *</label><input type="text" id="ev-name" placeholder="e.g. HackVVCE 2025"></div>
          <div class="form-group"><label>Club / Organizer Name *</label><input type="text" id="ev-club" value="${STATE.user.clubName||''}" placeholder="e.g. CSE Club"></div>
        </div>

        <div class="form-group"><label>Description</label><textarea id="ev-desc" rows="3" placeholder="Describe the event, schedule, prizes, etc."></textarea></div>

        <div class="form-row" style="grid-template-columns:1fr 1fr 1fr;">
          <div class="form-group"><label>Event Date *</label><input type="date" id="ev-date"></div>
          <div class="form-group"><label>Start Time *</label><input type="time" id="ev-time"></div>
          <div class="form-group"><label>Max Participants *</label><input type="number" id="ev-max" value="100" min="5"></div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Venue *</label>
            <select id="ev-venue">
              <option value="Seminar Hall A">Seminar Hall A</option>
              <option value="Seminar Hall B">Seminar Hall B</option>
              <option value="Main Auditorium">Main Auditorium</option>
              <option value="Mechanical Seminar Hall">Mechanical Seminar Hall</option>
              <option value="EC Seminar Hall">EC Seminar Hall</option>
              <option value="Computer Lab 1">Computer Lab 1</option>
              <option value="Computer Lab 2">Computer Lab 2</option>
              <option value="Sports Ground">Sports Ground</option>
              <option value="Conference Room B">Conference Room B</option>
            </select>
          </div>
          <div class="form-group">
            <label>Category *</label>
            <select id="ev-cat">
              <option>Technical</option><option>Cultural</option>
              <option>Sports</option><option>Workshop</option>
              <option>Management</option><option>Social</option>
            </select>
          </div>
        </div>

        <!-- Target Branches -->
        <div class="form-group" style="margin-bottom:18px;">
          <label style="display:flex;align-items:center;gap:8px;">🎓 Target Branches
            <span style="font-size:11px;color:#9ca3af;font-weight:400;">— Hold Ctrl / Cmd to select multiple</span>
          </label>
          <select id="ev-branches" multiple
            style="width:100%;border-radius:10px;padding:8px 10px;background:#1e2a3d;
            border:1.5px solid rgba(99,102,241,0.3);color:#e2e8f0;font-size:13px;
            font-family:'Outfit',sans-serif;outline:none;height:130px;cursor:pointer;">
            <option value="All" selected style="padding:6px;">🏫 All Branches (Open to Everyone)</option>
            <option value="CSE"  style="padding:6px;">💻 CSE — Computer Science &amp; Engineering</option>
            <option value="CSE/AIML" style="padding:6px;">🤖 CSE / AI&amp;ML — Artificial Intelligence &amp; Machine Learning</option>
            <option value="ECE"  style="padding:6px;">📡 ECE — Electronics &amp; Communication Engineering</option>
            <option value="ME"   style="padding:6px;">⚙️ ME — Mechanical Engineering</option>
            <option value="EEE"  style="padding:6px;">⚡ EEE — Electrical &amp; Electronics Engineering</option>
            <option value="CV"   style="padding:6px;">🏗️ CV — Civil Engineering</option>
            <option value="ISE"  style="padding:6px;">🖥️ ISE — Information Science &amp; Engineering</option>
          </select>
          <div style="font-size:11px;color:#6b7280;margin-top:5px;">Select <strong style="color:#a5b4fc;">All Branches</strong> to open the event to every department.</div>
        </div>

        <div class="form-divider">Additional Details</div>

        <div class="toggle-row">
          <label class="toggle-sw"><input type="checkbox" id="ev-gives-points" checked><span class="toggle-track"></span></label>
          <div class="toggle-info">
            <div class="toggle-lbl">This event provides AICTE Activity Points</div>
            <div class="toggle-desc">Toggle on to award points to participants</div>
          </div>
        </div>
        <div id="ev-points-wrap" class="form-group" style="margin-left:56px;">
          <label>AICTE Points Awarded</label>
          <input type="number" id="ev-points" value="10" min="0">
        </div>

        <div class="toggle-row">
          <label class="toggle-sw"><input type="checkbox" id="ev-needs-payment"><span class="toggle-track"></span></label>
          <div class="toggle-info">
            <div class="toggle-lbl">Require Payment Proof</div>
            <div class="toggle-desc" style="color:#ef4444;">Future feature — no payment gateway active. Students will need to upload payment screenshot for registration.</div>
          </div>
        </div>

        <div class="form-row" style="margin-top:10px;">
          <div class="form-group"><label>Entry Fee (₹) — 0 = Free</label><input type="number" id="create-ev-fee" value="0" min="0"></div>
          <div class="form-group"><label>Club UPI ID (for payments)</label><input type="text" id="create-ev-upi" placeholder="e.g. clubname@upi"></div>
        </div>

        <div class="form-group"><label>Speakers / Resource Persons</label><input type="text" id="ev-speakers" placeholder="Dr. Ramesh Kumar, Prof. Meena S"></div>

        <div class="form-group"><label>Rules / Terms</label><textarea id="ev-rules" rows="2" placeholder="Any specific requirements..."></textarea></div>

        <div class="form-divider">Event Poster (optional)</div>
        <div class="upload-zone" onclick="document.getElementById('ev-poster-input').click()">
          <div class="upload-icon">🖼️</div>
          <p id="ev-poster-txt">Click to upload event poster</p>
          <span>PNG, JPG supported</span>
          <input type="file" id="ev-poster-input" accept="image/*" style="display:none;" onchange="handlePosterUpload(event)">
          <input type="hidden" id="ev-poster-data" value="">
        </div>
        <img id="ev-poster-preview" style="display:none;width:100%;max-height:180px;object-fit:cover;border-radius:10px;margin-top:8px;">

        <div class="create-form-btns">
          <button class="btn-create-draft" onclick="submitEvent('draft')">Save as Draft</button>
          <button class="btn-create-submit" onclick="submitEvent('pending')">Submit for Dean Approval →</button>
        </div>
      </div>
    </div>
  `;

  // Toggle points fields
  document.getElementById('ev-gives-points').addEventListener('change', function() {
    document.getElementById('ev-points-wrap').style.display = this.checked ? '' : 'none';
  });
}

function handlePosterUpload(e) {
  const file=e.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=ev=>{
    document.getElementById('ev-poster-data').value=ev.target.result;
    document.getElementById('ev-poster-txt').textContent='📎 '+file.name;
    const prev=document.getElementById('ev-poster-preview'); prev.src=ev.target.result; prev.style.display='';
  };
  r.readAsDataURL(file);
}

function submitEvent(status='pending') {
  const name  = document.getElementById('ev-name').value.trim();
  const club  = document.getElementById('ev-club').value.trim();
  const date  = document.getElementById('ev-date').value;
  const time  = document.getElementById('ev-time').value;
  const max   = parseInt(document.getElementById('ev-max').value||'100');
  const venue    = document.getElementById('ev-venue').value;
  const cat      = document.getElementById('ev-cat').value;
  const branchEl = document.getElementById('ev-branches');
  const branches = branchEl ? [...branchEl.selectedOptions].map(o => o.value) : ['All'];

  if (!name||!club||!date||!time||!venue) { toast('Please fill all required fields (marked with *).','error'); return; }

  const events = getDB('vvce_events');
  const ev = {
    id: genId('ev'), name, club, adminId: STATE.user.id,
    emoji: '🎓', category: cat, date, time,
    endDate: date, endTime: '',
    venue, maxParticipants: max, regCount: 0,
    fee: parseInt(document.getElementById('create-ev-fee').value||'0'),
    adminUpiId: document.getElementById('create-ev-upi')?.value.trim() || '',
    points: document.getElementById('ev-gives-points').checked ? parseInt(document.getElementById('ev-points').value||'0') : 0,
    desc: document.getElementById('ev-desc').value.trim(),
    speakers: document.getElementById('ev-speakers').value.trim(),
    rules: document.getElementById('ev-rules').value.trim(),
    poster: document.getElementById('ev-poster-data').value||null,
    branches: branches.length ? branches : ['All'],
    status, rejReason: null, registrations: []
  };
  events.push(ev);
  setDB('vvce_events', events);

  if (status==='pending') {
    toast(`Event "${name}" submitted for Dean approval! ✅`,'success');
    // Notify authority
    const users=getDB('vvce_users');
    users.filter(u=>u.type==='authority').forEach(u=>{
      if(!u.notifs) u.notifs=[];
      u.notifs.push({id:genId('n'),msg:`New event "${name}" by ${club} needs your approval.`,icon:'📋',time:'Just now',timestamp:Date.now(),read:false});
    });
    setDB('vvce_users',users);
  } else {
    toast(`Event saved as draft.`,'info');
  }
  showPage('manage-events');
}


/* ─────────────────────────────────────────────────────────────
   MANAGE EVENTS PAGE (Admin)
───────────────────────────────────────────────────────────────*/
function renderManageEventsPage() {
  const events = getDB('vvce_events').filter(e=>e.adminId===STATE.user.id);
  const el = document.getElementById('page-manage-events');
  el.innerHTML = `
    <div class="sec-head">
      <span class="sec-title">My Events (${events.length})</span>
      <button class="btn btn-gold" onclick="showPage('create-event')">+ Create Event</button>
    </div>
    ${events.length
      ? events.map(e=>`
        <div class="ev-row">
          <span class="ev-row-emoji">${e.emoji||'🎓'}</span>
          <div class="ev-row-info">
            <div class="ev-row-name">${e.name}</div>
            <div class="ev-row-meta">${formatDate(e.date)} • ${e.venue} • ${e.regCount||0}/${e.maxParticipants} registered</div>
            ${e.rejReason?`<div style="font-size:11px;color:#dc2626;margin-top:3px;">Rejected: ${e.rejReason}</div>`:''}
          </div>
          <span class="badge ${e.status==='approved'?'badge-green':e.status==='pending'?'badge-amber':e.status==='draft'?'badge-gray':'badge-red'}">${e.status}</span>
          <div class="ev-row-acts">
            <button class="btn btn-outline" onclick="openEventModal('${e.id}')">View</button>
            ${e.status==='draft'?`<button class="btn btn-gold" onclick="submitDraftEvent('${e.id}')">Submit</button>`:''}
          </div>
        </div>`).join('')
      : `<div class="empty-state"><div class="ei">📅</div><div class="et">No events yet</div><div class="es">Create your first event to get started.</div><button class="btn btn-gold" style="margin-top:12px;" onclick="showPage('create-event')">Create Event</button></div>`
    }
  `;
}

function submitDraftEvent(id) {
  const events=getDB('vvce_events'); const ev=events.find(e=>e.id===id);
  if(ev){ev.status='pending';setDB('vvce_events',events);toast('Event submitted for approval!','success');renderManageEventsPage();}
}

/* ─────────────────────────────────────────────────────────────
   PARTICIPANTS PAGE (Admin)
───────────────────────────────────────────────────────────────*/
function renderParticipantsPage() {
  const myEvents = getDB('vvce_events').filter(e=>e.adminId===STATE.user.id&&e.status==='approved');
  const allUsers = getDB('vvce_users');
  const el = document.getElementById('page-participants');

  if (!myEvents.length) { el.innerHTML=`<div class="empty-state"><div class="ei">👥</div><div class="et">No approved events</div></div>`; return; }

  let pendingHtml = '';
  myEvents.forEach(ev => {
    if (ev.pendingPayments && ev.pendingPayments.length) {
      ev.pendingPayments.forEach(p => {
        const student = allUsers.find(u=>u.id===p.uid);
        if (!student) return;
        pendingHtml += `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;
            background:linear-gradient(135deg,#1e1a2e,#2d1f3d);border-radius:10px;margin-bottom:8px;
            border:1px solid rgba(251,191,36,0.3);">
            <div>
              <div style="font-weight:700;color:#fbbf24;font-size:13px;">💳 ${student.name}</div>
              <div style="font-size:11px;color:#9ca3af;">${ev.name} • ₹${ev.fee} • ${student.usn||student.email}</div>
              <div style="font-size:11px;color:#9ca3af;">${formatDate(p.date?.split('T')[0]||new Date().toISOString().split('T')[0])}</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button onclick="viewScreenshot('${p.screenshot}')" style="padding:8px 12px;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-weight:700;font-size:11px;cursor:pointer;">📸 View</button>
              <button onclick="approvePayment('${ev.id}','${p.uid}')" style="padding:8px 12px;background:#10b981;color:#fff;border:none;border-radius:6px;font-weight:700;font-size:11px;cursor:pointer;">✅ Approve</button>
              <button onclick="rejectPayment('${ev.id}','${p.uid}')" style="padding:8px 12px;background:#ef4444;color:#fff;border:none;border-radius:6px;font-weight:700;font-size:11px;cursor:pointer;">❌ Reject</button>
            </div>
          </div>`;
      });
    }
  });

  let html = `
    ${pendingHtml ? `
      <div style="margin-bottom:18px;">
        <div style="font-weight:700;color:#fbbf24;font-size:14px;margin-bottom:10px;">⏳ Pending Screenshot Verifications (${pendingHtml.split('✅ Approve').length-1})</div>
        ${pendingHtml}
      </div>
      <div style="border-top:1px solid rgba(255,255,255,0.08);margin-bottom:18px;"></div>` : ''}
    <div class="filter-row">
      <select class="filter-sel" id="part-ev-filter" onchange="renderParticipantTable()">
        ${myEvents.map(e=>`<option value="${e.id}">${e.name}</option>`).join('')}
      </select>
      <input class="search-inp" id="part-search" placeholder="🔍 Search participant…" oninput="renderParticipantTable()">
    </div>
    <div id="part-table-wrap"></div>
  `;
  el.innerHTML = html;
  renderParticipantTable();
}

window.viewScreenshot = function(b64) {
  document.getElementById('screenshot-img-view').src = b64;
  openModal('modal-screenshot');
};

window.approvePayment = function(eventId, uid) {
  if (!confirm('Approve this payment and confirm registration?')) return;
  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  
  ev.pendingPayments = ev.pendingPayments.filter(p => p.uid !== uid);
  
  if (!ev.registrations) ev.registrations = [];
  if (!ev.registrations.includes(uid)) {
    ev.registrations.push(uid);
    ev.regCount = (ev.regCount||0) + 1;
  }
  
  setDB('vvce_events', events);
  addNotifToUser(uid, `Your payment for "${ev.name}" was approved! 🎉 You are now officially registered.`, '✅');
  toast('Payment approved and registration confirmed.', 'success');
  renderParticipantsPage();
};

window.rejectPayment = function(eventId, uid) {
  if (!confirm('Reject this payment? The student will need to register again.')) return;
  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  
  ev.pendingPayments = ev.pendingPayments.filter(p => p.uid !== uid);
  setDB('vvce_events', events);
  
  addNotifToUser(uid, `Your payment screenshot for "${ev.name}" was rejected. Please contact the club or register again.`, '❌');
  toast('Payment rejected.', 'info');
  renderParticipantsPage();
}

function renderParticipantTable() {
  const evId = document.getElementById('part-ev-filter')?.value;
  const q    = (document.getElementById('part-search')?.value||'').toLowerCase();
  const ev   = getDB('vvce_events').find(e=>e.id===evId);
  const allUsers = getDB('vvce_users');
  const wrap = document.getElementById('part-table-wrap'); if (!wrap) return;

  const partIds  = ev?.registrations||[];
  const attended = ev?.attendedStudents||[];
  let parts = allUsers.filter(u=>partIds.includes(u.id));
  if (q) parts = parts.filter(u=>u.name.toLowerCase().includes(q)||u.usn?.toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q));

  if (!parts.length) { wrap.innerHTML=`<div class="empty-state"><div class="ei">👥</div><div class="et">No participants yet</div></div>`; return; }

  const attendedCount = parts.filter(p=>attended.includes(p.id)).length;
  const absentCount   = parts.length - attendedCount;
  const attendPct     = parts.length ? Math.round(attendedCount/parts.length*100) : 0;

  wrap.innerHTML=`
    <!-- Attendance Summary Bar -->
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:16px;padding:14px 18px;
      background:linear-gradient(135deg,#0f172a,#1a2744);border-radius:12px;
      border:1px solid rgba(99,102,241,0.2);flex-wrap:wrap;">
      <div style="text-align:center;">
        <div style="font-size:24px;font-weight:900;color:#10b981;font-family:'Outfit',sans-serif;">${attendedCount}</div>
        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Attended</div>
      </div>
      <div style="width:1px;height:36px;background:rgba(255,255,255,0.08);"></div>
      <div style="text-align:center;">
        <div style="font-size:24px;font-weight:900;color:#ef4444;font-family:'Outfit',sans-serif;">${absentCount}</div>
        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Absent</div>
      </div>
      <div style="width:1px;height:36px;background:rgba(255,255,255,0.08);"></div>
      <div style="text-align:center;">
        <div style="font-size:24px;font-weight:900;color:#e2e8f0;font-family:'Outfit',sans-serif;">${parts.length}</div>
        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Total</div>
      </div>
      <div style="flex:1;min-width:140px;margin-left:4px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:12px;color:#9ca3af;">Attendance Rate</span>
          <span style="font-size:12px;font-weight:700;color:#10b981;">${attendPct}%</span>
        </div>
        <div style="height:7px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${attendPct}%;background:linear-gradient(90deg,#10b981,#34d399);border-radius:4px;transition:width 0.5s ease;"></div>
        </div>
      </div>
      <div style="font-size:11px;color:#6b7280;border-left:1px solid rgba(255,255,255,0.06);padding-left:14px;">
        🎓 Marking <strong style="color:#a5b4fc;">Attended</strong> auto-awards<br>AICTE points &amp; certificate
      </div>
    </div>

    <!-- Participants Table -->
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>#</th><th>Name</th><th>USN</th><th>Branch / Sem</th><th>Phone</th><th>Email</th><th>Attendance</th></tr></thead>
        <tbody>
          ${parts.map((p,i)=>{
            const isAtt = attended.includes(p.id);
            return `
            <tr>
              <td>${i+1}</td>
              <td><div class="td-name">${titleCase(p.name)}</div></td>
              <td>${p.usn||'—'}</td>
              <td>${p.branch||'—'} • ${p.sem||'—'}</td>
              <td>${p.phone||'—'}</td>
              <td>${p.email}</td>
              <td>
                <button
                  onclick="toggleAttendance('${evId}','${p.id}')"
                  style="padding:5px 14px;border-radius:20px;border:1px solid ${isAtt?'rgba(16,185,129,0.35)':'rgba(239,68,68,0.3)'};
                  background:${isAtt?'rgba(16,185,129,0.12)':'rgba(239,68,68,0.1)'};
                  color:${isAtt?'#10b981':'#ef4444'};cursor:pointer;font-size:12px;font-weight:700;
                  transition:all 0.2s;white-space:nowrap;">
                  ${isAtt?'✅ Attended':'❌ Not Attended'}
                </button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:10px;font-size:12px;color:#9ca3af;">
      Total: ${parts.length} registered &nbsp;|&nbsp; ${attendedCount} attended &nbsp;|&nbsp; ${absentCount} absent
    </div>
  `;
}

/* Toggle attendance and award / revoke rewards */
window.toggleAttendance = function(eventId, userId) {
  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  if (!ev.attendedStudents) ev.attendedStudents = [];

  const isAtt = ev.attendedStudents.includes(userId);
  if (isAtt) {
    ev.attendedStudents = ev.attendedStudents.filter(id => id !== userId);
    applyAttendanceRewards(eventId, userId, false, ev);
    toast('Marked as Not Attended — rewards revoked.', 'info');
  } else {
    ev.attendedStudents.push(userId);
    applyAttendanceRewards(eventId, userId, true, ev);
    toast('Marked as Attended! 🎓 AICTE points & certificate awarded.', 'success');
  }
  setDB('vvce_events', events);
  renderParticipantTable();
};

function applyAttendanceRewards(eventId, userId, attended, ev) {
  let certs = getDB('vvce_certs');
  /* Remove any existing auto-cert for this user + event first */
  certs = certs.filter(c => !(c.autoGenerated && c.eventId === eventId && c.userId === userId));
  if (attended) {
    certs.push({
      id: genId('ac'),
      userId,
      title: ev.name,
      issuer: ev.club || 'VVCE',
      date: ev.date,
      position: 'Participant',
      points: ev.points || 0,
      type: 'participation',
      verified: true,
      autoGenerated: true,
      eventId
    });
  }
  setDB('vvce_certs', certs);
}


/* ─────────────────────────────────────────────────────────────
   AUTHORITY DASHBOARD
───────────────────────────────────────────────────────────────*/
function renderAuthorityDashboard() {
  const user   = STATE.user;
  const events = getDB('vvce_events');
  const clubs  = getDB('vvce_users').filter(u=>u.type==='admin');
  const approved = events.filter(e=>e.status==='approved');
  const pending  = events.filter(e=>e.status==='pending');
  const el = document.getElementById('page-authority-dashboard');

  const isPrincipal = user.designation === 'principal';
  const isDean      = user.designation === 'dean';

  const today = new Date().toISOString().split('T')[0];
  const todayEvents = approved.filter(e=>e.date===today);

  el.innerHTML=`
    <div class="stats-row">
      ${statCard('🏛️','Total Clubs',clubs.filter(c=>c.approved).length,'Active clubs','stat-mint')}
      ${statCard('📅','Upcoming Events',approved.filter(e=>e.date>=today).length,'This week','stat-blue')}
      ${statCard('⚡','Slot Conflicts',checkClashCount(),'Venue clashes','stat-pink')}
    </div>

    <!-- Quick actions -->
    <div class="auth-qa-grid">
      <div class="auth-qa-card" onclick="showPage('authority-clubs')">
        <span class="auth-qa-icon">🏛️</span>
        <div class="auth-qa-label">Monitor Events</div>
      </div>
      <div class="auth-qa-card" onclick="showPage('authority-clash')">
        <span class="auth-qa-icon">⚡</span>
        <div class="auth-qa-label">Check Clashes</div>
      </div>
      <div class="auth-qa-card" onclick="showPage('authority-attendance')">
        <span class="auth-qa-icon">📊</span>
        <div class="auth-qa-label">Attendance</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 300px;gap:1.5rem;">
      <!-- Today's schedule -->
      <div class="white-card">
        <div class="sec-head"><span class="sec-title">Today's Events (${formatDate(today)})</span></div>
        ${todayEvents.length
          ? todayEvents.map(e=>`
            <div class="today-row">
              <span class="today-time">${formatTime(e.time)}</span>
              <div class="today-dot"></div>
              <div class="today-info">
                <div class="today-name">${e.name}</div>
                <div class="today-meta">${e.club} • ${e.venue}</div>
              </div>
            </div>`).join('')
          : `<div class="empty-state" style="padding:1.5rem;"><div class="ei">📅</div><div class="et">No events today</div></div>`
        }
      </div>

      <!-- Principal availability (right side) -->
      <div>
        ${renderPrincipalAvailability()}
        ${isDean||isPrincipal?`
          <div style="margin-top:1rem;">
            <div class="sec-title" style="margin-bottom:10px;">Special Portals</div>
            ${isDean||isPrincipal?`<div class="auth-qa-card" style="margin-bottom:8px;" onclick="handleDeanPortalNav()"><span class="auth-qa-icon">📋</span><div class="auth-qa-label">Dean SW Portal</div></div>`:''}
            ${isPrincipal?`<div class="auth-qa-card" onclick="handlePrincipalPortalNav()"><span class="auth-qa-icon">🎓</span><div class="auth-qa-label">Principal Portal</div></div>`:''}
          </div>`:''
        }
      </div>
    </div>
  `;
}

function renderPrincipalAvailability() {
  const princStatus = JSON.parse(localStorage.getItem('vvce_principal_status') || '{"text":"Available","note":"","updated":"Just now","color":"#48bb78","icon":"✅"}');
  return `
    <div class="avail-card">
      <div class="avail-head">
        <span class="sec-title" style="font-size:14px;">Principal Availability</span>
      </div>
      <div class="avail-status" style="display:flex;align-items:center;gap:8px;">
        <div style="color:${princStatus.color};font-size:18px;">${princStatus.icon}</div>
        <div style="font-weight:600;">${princStatus.text}</div>
      </div>
      ${princStatus.note ? `<div style="font-size:12px;color:#4b5563;margin-top:4px;">"${princStatus.note}"</div>` : ''}
      <div class="avail-upd" style="margin-top:8px;">Updated ${princStatus.updated}</div>
    </div>`;
}

function checkClashCount() {
  const events = getDB('vvce_events').filter(e=>e.status==='approved');
  let clashes  = 0;
  for(let i=0;i<events.length;i++) for(let j=i+1;j<events.length;j++) {
    if(events[i].date===events[j].date && events[i].venue===events[j].venue) clashes++;
  }
  return clashes;
}


/* ─────────────────────────────────────────────────────────────
   EVENT APPROVALS PAGE (Authority)
───────────────────────────────────────────────────────────────*/
function renderApprovals() {
  const events  = getDB('vvce_events');
  const pending = events.filter(e=>e.status==='pending');
  const el      = document.getElementById('page-authority-approvals');

  el.innerHTML=`
    <div class="sec-head">
      <span class="sec-title">Event Approvals (${pending.length} pending)</span>
    </div>
    ${pending.length
      ? pending.map(e=>`
        <div class="white-card" style="margin-bottom:10px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
            <div style="display:flex;gap:12px;align-items:flex-start;">
              <span style="font-size:36px;">${e.emoji||'🎓'}</span>
              <div>
                <div style="font-weight:800;font-size:16px;color:#111827;">${e.name}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:3px;">${e.club}</div>
                <div style="display:grid;grid-template-columns:repeat(3,auto);gap:6px 16px;margin-top:8px;font-size:12px;color:#374151;">
                  <span>📅 ${formatDate(e.date)}</span>
                  <span>🕐 ${formatTime(e.time)}</span>
                  <span>📍 ${e.venue}</span>
                  <span>👥 Max: ${e.maxParticipants}</span>
                  <span>⭐ ${e.points} pts</span>
                  <span>💰 ${e.fee>0?`₹${e.fee}`:'Free'}</span>
                </div>
                ${e.desc?`<div style="font-size:12px;color:#374151;margin-top:8px;line-height:1.5;max-width:500px;">${e.desc}</div>`:''}
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
              <button class="btn btn-green" onclick="approveEvent('${e.id}')">✓ Approve</button>
              <button class="btn btn-red" onclick="openRejectModal('${e.id}')">✕ Reject</button>
            </div>
          </div>
        </div>`).join('')
      : `<div class="empty-state"><div class="ei">✅</div><div class="et">All caught up!</div><div class="es">No events pending approval.</div></div>`
    }

    <!-- Recently processed -->
    <div style="margin-top:1.5rem;">
      <div class="sec-title" style="margin-bottom:10px;">Recently Processed</div>
      ${events.filter(e=>e.status==='approved'||e.status==='rejected').slice(0,5).map(e=>`
        <div class="ev-row">
          <span class="ev-row-emoji">${e.emoji||'🎓'}</span>
          <div class="ev-row-info"><div class="ev-row-name">${e.name}</div><div class="ev-row-meta">${e.club} • ${formatDate(e.date)}</div></div>
          <span class="badge ${e.status==='approved'?'badge-green':'badge-red'}">${e.status}</span>
        </div>`).join('') || `<p style="color:#9ca3af;font-size:13px;">None yet.</p>`}
    </div>
  `;
}

function approveEvent(id) {
  const events=getDB('vvce_events'); const ev=events.find(e=>e.id===id);
  if(!ev) return;
  ev.status='approved'; ev.rejReason=null;
  setDB('vvce_events',events);
  // Notify admin
  const users=getDB('vvce_users'); const admin=users.find(u=>u.id===ev.adminId);
  if(admin){if(!admin.notifs)admin.notifs=[];admin.notifs.push({id:genId('n'),msg:`Your event "${ev.name}" has been approved! 🎉`,icon:'✅',time:'Just now',timestamp:Date.now(),read:false});setDB('vvce_users',users);}
  toast(`"${ev.name}" approved! ✅`,'success');
  if (STATE.page === 'dean-portal') renderDeanPortal('event-approvals');
  else renderApprovals();
}

function openRejectModal(id) {
  STATE.rejectEventId=id;
  document.getElementById('reject-reason').value='';
  openModal('modal-reject');
}
function confirmReject() {
  const id=STATE.rejectEventId; const reason=document.getElementById('reject-reason').value.trim();
  if(!reason){toast('Please provide a rejection reason.','error');return;}
  const events=getDB('vvce_events'); const ev=events.find(e=>e.id===id);
  if(!ev) return;
  ev.status='rejected'; ev.rejReason=reason;
  setDB('vvce_events',events);
  const users=getDB('vvce_users'); const admin=users.find(u=>u.id===ev.adminId);
  if(admin){if(!admin.notifs)admin.notifs=[];admin.notifs.push({id:genId('n'),msg:`Your event "${ev.name}" was rejected: ${reason}`,icon:'❌',time:'Just now',timestamp:Date.now(),read:false});setDB('vvce_users',users);}
  closeModal('modal-reject');
  toast(`Event rejected.`,'info');
  if (STATE.page === 'dean-portal') renderDeanPortal('event-approvals');
  else renderApprovals();
}


/* ─────────────────────────────────────────────────────────────
   CLUB MONITOR PAGE
───────────────────────────────────────────────────────────────*/
function renderClubMonitor() {
  const clubs = getDB('vvce_users').filter(u=>u.type==='admin' && u.approved);
  const el    = document.getElementById('page-authority-clubs');

  el.innerHTML=`
    <div class="sec-head"><span class="sec-title">Club Monitor (${clubs.length} active clubs)</span></div>
    <div id="clubs-list">${renderClubCards(clubs)}</div>
  `;
}

function filterClubs(filter) {
  const clubs = getDB('vvce_users').filter(u=>u.type==='admin' && u.approved);
  const listEl = document.getElementById('clubs-list'); if(listEl) listEl.innerHTML=renderClubCards(clubs);
}

function renderClubCards(clubs) {
  if(!clubs.length) return `<div class="empty-state"><div class="ei">🏛️</div><div class="et">No clubs found</div></div>`;
  const allEvents = getDB('vvce_events');
  return clubs.map(c => {
    const hasEvents = allEvents.some(e => e.adminId === c.id && (e.status === 'approved' || e.status === 'completed'));
    let statusBadge = '';
    if (!c.approved) {
      statusBadge = '<span class="badge badge-amber">Pending</span>';
    } else if (hasEvents) {
      statusBadge = '<span class="badge badge-green">Active (Conducting Events)</span>';
    } else {
      statusBadge = '<span class="badge" style="background:#e5e7eb;color:#374151;">Inactive (No Events)</span>';
    }

    return `
    <div class="cpcard ${c.approved?'':'cpcard-pending'}">
      <div class="cpcard-head">
        <div>
          <div class="cpcard-name">${c.clubName||c.name}</div>
          <div class="cpcard-domain">${c.domain||'—'} • ${c.dept||'—'}</div>
        </div>
        ${statusBadge}
      </div>
      <div class="cpcard-info">
        <span>👤 Rep: ${titleCase(c.name)}</span>
        <span>👩‍🏫 Faculty: ${c.faculty||'—'}</span>
        <span>📧 ${c.clubEmail||c.email}</span>
        <span>📞 ${c.phone||'—'}</span>
      </div>
      <div class="cpcard-acts">
        <button class="btn btn-outline" onclick="viewClubDetail('${c.id}')">View Details</button>
      </div>
    </div>`;
  }).join('');
}

function approveClub(id) {
  const users=getDB('vvce_users'); const club=users.find(u=>u.id===id);
  if(!club) return;
  club.approved=true; setDB('vvce_users',users);
  if(club.id===STATE.user.id) STATE.user=club;
  toast(`${club.clubName} approved! ✅`,'success');
  renderClubMonitor();
}
function revokeClub(id) {
  if(!confirm("Revoke this club's access?")) return;
  const users=getDB('vvce_users'); const club=users.find(u=>u.id===id);
  if(!club) return;
  club.approved=false; setDB('vvce_users',users);
  toast('Club access revoked.','warning'); renderClubMonitor();
}
function viewClubDetail(id) {
  const club=getDB('vvce_users').find(u=>u.id===id); if(!club) return;
  const evs = getDB('vvce_events').filter(e=>e.adminId===id);
  document.getElementById('modal-club-body').innerHTML=`
    <div style="margin-bottom:1rem;">
      <div style="font-size:20px;font-weight:900;color:#111827;margin-bottom:4px;">${club.clubName}</div>
      <span class="badge ${club.approved?'badge-green':'badge-amber'}">${club.approved?'Active':'Pending'}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;margin-bottom:1rem;">
      <div><strong>Representative:</strong> ${titleCase(club.name)}</div>
      <div><strong>Faculty:</strong> ${club.faculty||'—'}</div>
      <div><strong>Domain:</strong> ${club.domain||'—'}</div>
      <div><strong>Phone:</strong> ${club.phone||'—'}</div>
      <div><strong>Club Email:</strong> ${club.clubEmail||'—'}</div>
      <div><strong>Rep Email:</strong> ${club.email}</div>
    </div>
    ${club.desc?`<div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:1rem;font-size:13px;color:#374151;">${club.desc}</div>`:''}
    <div><strong style="font-size:13px;">Events (${evs.length})</strong></div>
    ${evs.slice(0,5).map(e=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
      <span>${e.emoji||'🎓'}</span>
      <span style="flex:1;">${e.name}</span>
      <span class="badge ${e.status==='approved'?'badge-green':e.status==='pending'?'badge-amber':'badge-red'}">${e.status}</span>
    </div>`).join('')||'<p style="color:#9ca3af;font-size:13px;">No events yet.</p>'}
  `;
  openModal('modal-club-detail');
}


/* ─────────────────────────────────────────────────────────────
   CLASH DETECTION PAGE
───────────────────────────────────────────────────────────────*/
function renderClashDetect() {
  const allEvents  = getDB('vvce_events').filter(e=>e.status==='approved'||e.status==='pending');
  const dateVal = document.getElementById('clash-date-filter')?.value || '';
  const events = dateVal ? allEvents.filter(e => e.date === dateVal) : allEvents;
  
  const clashes = [];
  for(let i=0;i<events.length;i++) for(let j=i+1;j<events.length;j++) {
    if(events[i].date===events[j].date && events[i].venue===events[j].venue) {
      clashes.push([events[i],events[j]]);
    }
  }

  window.runClashFilter = () => renderClashDetect();

  const el = document.getElementById('page-authority-clash');
  el.innerHTML=`
    <div class="sec-head">
      <span class="sec-title">Clash Detection</span>
      <span class="badge ${clashes.length?'badge-red':'badge-green'}">${clashes.length} clashes found</span>
    </div>
    
    <div style="background:rgba(255,255,255,0.8);padding:1rem;border-radius:10px;margin-bottom:1rem;display:flex;align-items:center;gap:10px;">
      <label style="font-weight:700;font-size:13px;">Check specific date:</label>
      <input type="date" id="clash-date-filter" class="auth-input" style="max-width:200px;margin-bottom:0;" value="${dateVal}" onchange="runClashFilter()">
      <button class="btn-sm btn-outline" onclick="document.getElementById('clash-date-filter').value='';runClashFilter()">Clear</button>
    </div>
    ${clashes.length
      ? clashes.map(([a,b])=>`
        <div class="clash-chip clash-error">
          <div style="font-weight:700;font-size:13px;margin-bottom:8px;">⚡ Venue & Time Conflict</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
            <div style="background:rgba(255,255,255,0.6);padding:8px;border-radius:6px;">
              <div style="font-weight:700;">${a.name}</div>
              <div style="color:#6b7280;">${a.club} • ${formatTime(a.time)}</div>
            </div>
            <div style="background:rgba(255,255,255,0.6);padding:8px;border-radius:6px;">
              <div style="font-weight:700;">${b.name}</div>
              <div style="color:#6b7280;">${b.club} • ${formatTime(b.time)}</div>
            </div>
          </div>
          <div style="font-size:11px;color:#991b1b;margin-top:6px;">📍 ${a.venue} — 📅 ${formatDate(a.date)}</div>
        </div>`).join('')
      : `<div class="clash-chip clash-ok"><div style="font-weight:700;color:#15803d;">✓ No venue clashes detected!</div><div style="font-size:12px;color:#059669;margin-top:4px;">All approved events have unique venue-date combinations.</div></div>`
    }

    <!-- All events table -->
    <div style="margin-top:1.5rem;">
      <div class="sec-title" style="margin-bottom:10px;">All Scheduled Events</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Event</th><th>Club</th><th>Date</th><th>Time</th><th>Venue</th><th>Status</th></tr></thead>
          <tbody>
            ${events.sort((a,b)=>a.date.localeCompare(b.date)).map(e=>`
              <tr>
                <td class="td-name">${e.name}</td>
                <td>${e.club}</td>
                <td>${formatDate(e.date)}</td>
                <td>${formatTime(e.time)}</td>
                <td>${e.venue}</td>
                <td><span class="badge ${e.status==='approved'?'badge-green':'badge-amber'}">${e.status}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}


window.showAuthStudents = function(eventId) {
  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const users = getDB('vvce_users');
  const registeredUsers = (ev.registrations || []).map(id => users.find(u => u.id === id)).filter(u => u);
  const attended = ev.attendedStudents || [];

  const attendedCount = registeredUsers.filter(u => attended.includes(u.id)).length;

  const modalBody = document.getElementById('modal-auth-students-body');
  if (registeredUsers.length === 0) {
    modalBody.innerHTML = '<div style="padding:20px;text-align:center;color:#6b7280;">No students registered yet.</div>';
  } else {
    modalBody.innerHTML = `
      <!-- Mini summary -->
      <div style="display:flex;gap:20px;padding:12px 16px;background:linear-gradient(135deg,#0f172a,#1a2744);
        border-radius:10px;margin-bottom:14px;border:1px solid rgba(99,102,241,0.15);">
        <div style="text-align:center;"><div style="font-size:20px;font-weight:900;color:#10b981;font-family:'Outfit',sans-serif;">${attendedCount}</div><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;">Attended</div></div>
        <div style="width:1px;background:rgba(255,255,255,0.07);"></div>
        <div style="text-align:center;"><div style="font-size:20px;font-weight:900;color:#ef4444;font-family:'Outfit',sans-serif;">${registeredUsers.length-attendedCount}</div><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;">Absent</div></div>
        <div style="width:1px;background:rgba(255,255,255,0.07);"></div>
        <div style="text-align:center;"><div style="font-size:20px;font-weight:900;color:#e2e8f0;font-family:'Outfit',sans-serif;">${registeredUsers.length}</div><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;">Total</div></div>
      </div>
      <div class="table-wrap">
        <table class="data-table" style="width:100%;">
          <thead><tr><th>Name</th><th>USN</th><th>Branch</th><th>Attendance</th></tr></thead>
          <tbody>
            ${registeredUsers.map(u => {
              const isAtt = attended.includes(u.id);
              const badge = isAtt
                ? `<span style="padding:3px 10px;border-radius:12px;background:rgba(16,185,129,0.12);color:#10b981;font-size:11px;font-weight:700;border:1px solid rgba(16,185,129,0.3);">✅ Attended</span>`
                : `<span style="padding:3px 10px;border-radius:12px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:11px;font-weight:700;border:1px solid rgba(239,68,68,0.3);">❌ Not Attended</span>`;
              return `<tr><td style="font-weight:600;">${u.name}</td><td>${u.usn||'N/A'}</td><td>${u.branch||'N/A'}</td><td>${badge}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  document.getElementById('modal-auth-students-title').innerText = `Registered Students: ${ev.name}`;
  openModal('modal-auth-students');
};

/* ─────────────────────────────────────────────────────────────
   ATTENDANCE PAGE (Authority)
───────────────────────────────────────────────────────────────*/
function renderAttendancePage() {
  const events   = getDB('vvce_events').filter(e=>e.status==='approved');
  const allUsers = getDB('vvce_users');
  const el       = document.getElementById('page-authority-attendance');

  el.innerHTML=`
    <div class="sec-head">
      <span class="sec-title">Event Attendance Overview</span>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Event</th><th>Club</th><th>Date</th><th>Venue</th><th>Registered</th><th>Capacity</th><th>Fill Rate</th></tr></thead>
        <tbody>
          ${events.sort((a,b)=>b.date.localeCompare(a.date)).map(e=>{
            const fillPct=Math.round((e.regCount||0)/e.maxParticipants*100);
            return `<tr>
              <td class="td-name">${e.name}</td>
              <td>${e.club}</td>
              <td>${formatDate(e.date)}</td>
              <td>${e.venue}</td>
              <td style="cursor:pointer; color:#2563eb; text-decoration:underline;" onclick="showAuthStudents('${e.id}')" title="View Registered Students"><strong>${e.regCount||0}</strong></td>
              <td>${e.maxParticipants}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="flex:1;height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden;min-width:60px;">
                    <div style="height:100%;width:${fillPct}%;background:${fillPct>90?'#ef4444':fillPct>60?'#f59e0b':'#10b981'};border-radius:3px;"></div>
                  </div>
                  <span style="font-size:11px;font-weight:700;color:#374151;">${fillPct}%</span>
                </div>
              </td>
            </tr>`;}).join('')}
        </tbody>
      </table>
    </div>
  `;
}


/* ─────────────────────────────────────────────────────────────
   DEAN PORTAL
───────────────────────────────────────────────────────────────*/
const DEAN_PASS = 'deanwellfair@vvce';

function handleDeanPortalNav() {
  if (STATE.deanUnlocked) { showPage('dean-portal'); return; }
  document.getElementById('dean-pass-input').value='';
  document.getElementById('dean-pass-error').style.display='none';
  openModal('modal-dean-pass');
}

function verifyDeanPassword() {
  const pass = document.getElementById('dean-pass-input').value;
  if (pass === DEAN_PASS) {
    STATE.deanUnlocked = true;
    closeModal('modal-dean-pass');
    showPage('dean-portal');
  } else {
    const err=document.getElementById('dean-pass-error');
    err.textContent='Incorrect password. Try again.'; err.style.display='';
  }
}

function renderDeanPortal(activeTab='dashboard') {
  if (!STATE.deanUnlocked) { handleDeanPortalNav(); return; }

  const clubs  = getDB('vvce_users').filter(u=>u.type==='admin');
  const events = getDB('vvce_events');
  const pending = events.filter(e=>e.status==='pending');
  const approved = events.filter(e=>e.status==='approved');
  const today  = new Date().toISOString().split('T')[0];
  const el     = document.getElementById('page-dean-portal');

  el.innerHTML=`
    <!-- Authenticated header -->
    <div class="dean-portal-hdr">
      <div class="dpicon dpicon-gold">📋</div>
      <div class="dp-info">
        <div class="dp-title">Dean Student Welfare Portal <span class="dp-authed">✓ AUTHENTICATED</span></div>
        <div class="dp-sub">Exclusive administrative portal</div>
      </div>
      <button class="dp-lock-btn" onclick="lockDeanPortal()">🔒 Lock Portal</button>
    </div>

    <!-- Portal tabs -->
    <div class="portal-tabs">
      <button class="portal-tab ${activeTab==='dashboard'?'active':''}" onclick="renderDeanPortal('dashboard')">🏠 Dashboard</button>
      <button class="portal-tab ${activeTab==='approvals'?'active':''}" onclick="renderDeanPortal('approvals')">
        🏛️ Club Approvals ${clubs.filter(c=>!c.approved).length>0?`<span class="portal-tab-badge">${clubs.filter(c=>!c.approved).length}</span>`:''}
      </button>
      <button class="portal-tab ${activeTab==='event-approvals'?'active':''}" onclick="renderDeanPortal('event-approvals')">
        ✅ Event Approvals ${pending.length>0?`<span class="portal-tab-badge">${pending.length}</span>`:''}
      </button>
      <button class="portal-tab ${activeTab==='events'?'active':''}" onclick="renderDeanPortal('events')">📅 Event Monitor</button>
      <button class="portal-tab ${activeTab==='clash'?'active':''}" onclick="renderDeanPortal('clash')">⚡ Clash Detection</button>
    </div>

    <div id="dean-tab-content">
      ${activeTab==='dashboard' ? deanDashboardContent(clubs,events,pending,approved,today) : ''}
      ${activeTab==='approvals' ? deanApprovalsContent(clubs) : ''}
      ${activeTab==='event-approvals' ? deanEventApprovalsContent(pending) : ''}
      ${activeTab==='events'    ? deanEventsContent(events,today) : ''}
      ${activeTab==='clash'     ? deanClashContent(events) : ''}
    </div>
  `;
}

function deanDashboardContent(clubs,events,pending,approved,today) {
  const clashes=checkClashCount();
  return `
    <div class="stats-row">
      ${statCard('🏛️','Active Clubs',clubs.filter(c=>c.approved).length,'Registered clubs','stat-mint')}
      ${statCard('⏳','Pending Approvals',pending.length,'Events to review','stat-amber')}
      ${statCard('📅','Upcoming Events',approved.filter(e=>e.date>=today).length,'Approved events','stat-blue')}
      ${statCard('⚡','Slot Conflicts',clashes,'Venue clashes','stat-pink')}
    </div>
    <div class="white-card" style="margin-top:1rem;">
      <div class="sec-title" style="margin-bottom:1rem;">Quick Actions</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        <div class="auth-qa-card" onclick="renderDeanPortal('approvals')">
          <span class="auth-qa-icon">✅</span>
          <div class="auth-qa-label">Review Pending Clubs</div>
          ${pending.length?`<div style="font-size:11px;color:#b45309;font-weight:600;">${pending.length} item pending</div>`:''}
        </div>
        <div class="auth-qa-card" onclick="renderDeanPortal('events')">
          <span class="auth-qa-icon">📅</span>
          <div class="auth-qa-label">Monitor Events</div>
        </div>
        <div class="auth-qa-card" onclick="renderDeanPortal('clash')">
          <span class="auth-qa-icon">⚡</span>
          <div class="auth-qa-label">Check Clashes</div>
        </div>
      </div>
    </div>
  `;
}

function deanApprovalsContent(clubs) {
  const pending  = clubs.filter(c=>!c.approved);
  const approved = clubs.filter(c=>c.approved);
  return `
    <div class="sec-head"><span class="sec-title">Pending Club Registrations (${pending.length})</span></div>
    ${pending.length
      ? pending.map(c=>`
        <div class="white-card" style="margin-bottom:10px;">
          <div class="cpcard-head">
            <div><div class="cpcard-name">${c.clubName||c.name}</div><div class="cpcard-domain">${c.domain||'—'} • ${c.email}</div></div>
            <span class="badge badge-amber">Pending</span>
          </div>
          <div class="cpcard-info" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:#374151;margin:10px 0;">
            <span>👤 Rep: ${titleCase(c.name)}</span>
            <span>👩‍🏫 Faculty: ${c.faculty||'—'}</span>
            <span>📧 Club: ${c.clubEmail||'—'}</span>
            <span>📞 ${c.phone||'—'}</span>
          </div>
          ${c.desc?`<div style="font-size:12px;color:#374151;background:#f8fafc;padding:8px;border-radius:6px;margin-bottom:10px;">${c.desc}</div>`:''}
          <div style="display:flex;gap:8px;">
            <button class="btn btn-green" onclick="deanApproveClub('${c.id}')">✓ Approve Club</button>
            <button class="btn btn-red" onclick="deanRejectClub('${c.id}')">✕ Reject</button>
            <button class="btn btn-outline" onclick="viewClubDetail('${c.id}')">View Details</button>
          </div>
        </div>`).join('')
      : `<div class="empty-state"><div class="ei">✅</div><div class="et">No pending clubs</div></div>`
    }
    ${approved.length?`
      <div style="margin-top:1.5rem;">
        <div class="sec-title" style="margin-bottom:10px;">Approved Clubs (${approved.length})</div>
        ${approved.map(c=>`
          <div class="ev-row">
            <span class="ev-row-emoji">🏛️</span>
            <div class="ev-row-info"><div class="ev-row-name">${c.clubName}</div><div class="ev-row-meta">${c.domain||'—'} • ${titleCase(c.name)}</div></div>
            <span class="badge badge-green">Active</span>
            <button class="btn btn-red btn-sm" onclick="revokeClub('${c.id}');renderDeanPortal('approvals')">Revoke</button>
          </div>`).join('')}
      </div>`:''
    }
  `;
}

function deanEventApprovalsContent(pending) {
  return `
    <div class="sec-head">
      <span class="sec-title">Event Approvals (${pending.length} pending)</span>
    </div>
    ${pending.length
      ? pending.map(e=>`
        <div class="white-card" style="margin-bottom:10px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
            <div style="display:flex;gap:12px;align-items:flex-start;">
              <span style="font-size:36px;">${e.emoji||'🎓'}</span>
              <div>
                <div style="font-weight:800;font-size:16px;color:#111827;">${e.name}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:3px;">${e.club}</div>
                <div style="display:grid;grid-template-columns:repeat(3,auto);gap:6px 16px;margin-top:8px;font-size:12px;color:#374151;">
                  <span>📅 ${formatDate(e.date)}</span>
                  <span>🕐 ${formatTime(e.time)}</span>
                  <span>📍 ${e.venue}</span>
                  <span>👥 Max: ${e.maxParticipants}</span>
                  <span>⭐ ${e.points} pts</span>
                  <span>💰 ${e.fee>0?`₹${e.fee}`:'Free'}</span>
                </div>
                ${e.desc?`<div style="font-size:12px;color:#374151;margin-top:8px;line-height:1.5;max-width:500px;">${e.desc}</div>`:''}
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
              <button class="btn btn-green" onclick="approveEvent('${e.id}')">✓ Approve</button>
              <button class="btn btn-red" onclick="openRejectModal('${e.id}')">✕ Reject</button>
            </div>
          </div>
        </div>`).join('')
      : `<div class="empty-state"><div class="ei">✅</div><div class="et">All caught up!</div><div class="es">No events pending approval.</div></div>`
    }
  `;
}

function deanEventsContent(events,today) {
  const sorted = events.slice().sort((a,b)=>a.date.localeCompare(b.date));
  return `
    <div class="filter-row">
      <input class="search-inp" id="dean-ev-search" placeholder="🔍 Search events…" oninput="deanFilterEvents()">
      <select class="filter-sel" id="dean-ev-status" onchange="deanFilterEvents()">
        <option value="">All Status</option>
        <option value="approved">Approved</option>
        <option value="pending">Pending</option>
        <option value="rejected">Rejected</option>
      </select>
    </div>
    <div id="dean-ev-list">
      ${sorted.map(e=>`
        <div class="ev-row">
          <span class="ev-row-emoji">${e.emoji||'🎓'}</span>
          <div class="ev-row-info">
            <div class="ev-row-name">${e.name}</div>
            <div class="ev-row-meta">${e.club} • ${formatDate(e.date)} • ${e.venue}</div>
          </div>
          <span class="badge ${e.status==='approved'?'badge-green':e.status==='pending'?'badge-amber':e.status==='draft'?'badge-gray':'badge-red'}">${e.status}</span>
          ${e.status==='pending'?`<button class="btn btn-green" onclick="approveEvent('${e.id}');renderDeanPortal('events')">Approve</button>
          <button class="btn btn-red" onclick="openRejectModal('${e.id}')">Reject</button>`:''}
        </div>`).join('') || `<div class="empty-state"><div class="ei">📅</div><div class="et">No events</div></div>`
      }
    </div>
  `;
}

function deanFilterEvents() {
  const q      = (document.getElementById('dean-ev-search')?.value||'').toLowerCase();
  const status = document.getElementById('dean-ev-status')?.value||'';
  let evs      = getDB('vvce_events');
  if (q) evs = evs.filter(e=>e.name.toLowerCase().includes(q)||e.club.toLowerCase().includes(q));
  if (status) evs = evs.filter(e=>e.status===status);
  const listEl = document.getElementById('dean-ev-list'); if (!listEl) return;
  const today  = new Date().toISOString().split('T')[0];
  listEl.innerHTML = evs.map(e=>`
    <div class="ev-row">
      <span class="ev-row-emoji">${e.emoji||'🎓'}</span>
      <div class="ev-row-info"><div class="ev-row-name">${e.name}</div><div class="ev-row-meta">${e.club} • ${formatDate(e.date)}</div></div>
      <span class="badge ${e.status==='approved'?'badge-green':e.status==='pending'?'badge-amber':'badge-red'}">${e.status}</span>
      ${e.status==='pending'?`<button class="btn btn-green" onclick="approveEvent('${e.id}');renderDeanPortal('events')">Approve</button>`:''}</div>`).join('') ||
    `<div class="empty-state"><div class="ei">🔍</div><div class="et">No events found</div></div>`;
}

function deanClashContent(events) {
  const dateVal = document.getElementById('dean-clash-date-filter')?.value || '';
  let approved = events.filter(e=>e.status==='approved');
  if (dateVal) approved = approved.filter(e=>e.date===dateVal);

  const clashes=[];
  for(let i=0;i<approved.length;i++) for(let j=i+1;j<approved.length;j++) {
    if(approved[i].date===approved[j].date&&approved[i].venue===approved[j].venue) clashes.push([approved[i],approved[j]]);
  }

  window.runDeanClashFilter = () => renderDeanPortal('clash');

  return `
    <div class="sec-head"><span class="sec-title">Venue Clash Detection</span><span class="badge ${clashes.length?'badge-red':'badge-green'}">${clashes.length} clashes</span></div>
    
    <div style="background:rgba(255,255,255,0.8);padding:1rem;border-radius:10px;margin-bottom:1rem;display:flex;align-items:center;gap:10px;">
      <label style="font-weight:700;font-size:13px;">Check specific date:</label>
      <input type="date" id="dean-clash-date-filter" class="auth-input" style="max-width:200px;margin-bottom:0;" value="${dateVal}" onchange="runDeanClashFilter()">
      <button class="btn-sm btn-outline" onclick="document.getElementById('dean-clash-date-filter').value='';runDeanClashFilter()">Clear</button>
    </div>

    ${clashes.length
      ? clashes.map(([a,b])=>`
        <div class="clash-chip clash-error">
          <div style="font-weight:700;margin-bottom:6px;">⚡ Conflict at ${a.venue} on ${formatDate(a.date)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
            <div style="background:rgba(255,255,255,0.7);padding:8px;border-radius:6px;"><strong>${a.name}</strong><br>${a.club} • ${formatTime(a.time)}</div>
            <div style="background:rgba(255,255,255,0.7);padding:8px;border-radius:6px;"><strong>${b.name}</strong><br>${b.club} • ${formatTime(b.time)}</div>
          </div>
        </div>`).join('')
      : `<div class="clash-chip clash-ok"><strong>✅ No venue clashes detected!</strong><br><span style="font-size:12px;color:#059669;">All approved events have unique time-venue combinations.</span></div>`
    }
  `;
}

function deanApproveClub(id) { approveClub(id); setTimeout(()=>renderDeanPortal('approvals'),100); }
function deanRejectClub(id) {
  if(!confirm('Reject this club registration?')) return;
  const users=getDB('vvce_users'); const club=users.find(u=>u.id===id);
  if(!club) return;
  club.approved=false; setDB('vvce_users',users);
  toast('Club registration rejected.','info');
  renderDeanPortal('approvals');
}

function lockDeanPortal() {
  STATE.deanUnlocked=false;
  toast('Dean portal locked.','info');
  showPage('authority-dashboard');
}


/* ─────────────────────────────────────────────────────────────
   PRINCIPAL PORTAL
───────────────────────────────────────────────────────────────*/
const PRINCIPAL_PASS = 'principal@vvce2025';

function handlePrincipalPortalNav() {
  if (STATE.principalUnlocked) { showPage('principal-portal'); return; }
  document.getElementById('principal-pass-input').value='';
  document.getElementById('principal-pass-error').style.display='none';
  openModal('modal-principal-pass');
}

function verifyPrincipalPassword() {
  const pass=document.getElementById('principal-pass-input').value;
  if(pass===PRINCIPAL_PASS){
    STATE.principalUnlocked=true;
    closeModal('modal-principal-pass');
    showPage('principal-portal');
  } else {
    const err=document.getElementById('principal-pass-error');
    err.textContent='Incorrect password. Please try again.'; err.style.display='';
  }
}

window.toggleAttendEvent = function(eventId) {
  const toAttend = getDB('vvce_princ_attend');
  if(toAttend.includes(eventId)) {
    setDB('vvce_princ_attend', toAttend.filter(id => id !== eventId));
    toast('Event removed from your schedule.');
  } else {
    toAttend.push(eventId);
    setDB('vvce_princ_attend', toAttend);
    toast('Event added to your schedule!', 'success');
  }
  renderPrincipalPortal();
};

window.simulatePrincipalEmailNotif = function(eventName, timeStr) {
  toast(`📧 Email sent to princy@vvce.ac.in: Reminder - ${eventName} starts in 5 minutes!`, 'info', 6000);
};

function renderPrincipalPortal() {
  if(!STATE.principalUnlocked){ handlePrincipalPortalNav(); return; }
  const events = getDB('vvce_events');
  const clubs  = getDB('vvce_users').filter(u=>u.type==='admin');
  const users  = getDB('vvce_users').filter(u=>u.type==='student');
  const toAttendIds = getDB('vvce_princ_attend');
  const princStatus = JSON.parse(localStorage.getItem('vvce_principal_status') || '{"text":"Available","note":"","updated":"Just now","color":"#48bb78","icon":"✅"}');
  const princSchedules = JSON.parse(localStorage.getItem('vvce_principal_schedule') || '[]');
  const el     = document.getElementById('page-principal-portal');
  
  if (toAttendIds.length > 0 && !window.demoEmailSent) {
    const firstEvent = events.find(e => e.id === toAttendIds[0]);
    if (firstEvent) {
      setTimeout(() => simulatePrincipalEmailNotif(firstEvent.name, firstEvent.time), 1500);
      window.demoEmailSent = true;
    }
  }

  el.innerHTML=`
    <div class="dean-portal-hdr">
      <div class="dpicon dpicon-purple">🎓</div>
      <div class="dp-info">
        <div class="dp-title">Principal Portal <span class="dp-authed" style="background:rgba(139,92,246,0.15);color:#a78bfa;border-color:rgba(139,92,246,0.2);">✓ AUTHENTICATED</span></div>
        <div class="dp-sub">Institution-level overview and controls</div>
      </div>
      <button class="dp-lock-btn" onclick="lockPrincipalPortal()">🔒 Lock Portal</button>
    </div>

    <!-- Current Status Section -->
    <div class="white-card" style="margin-bottom:1.5rem; border: 1px solid ${princStatus.color}; background-color: #fffaf0;">
      <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
         <div><span style="color:${princStatus.color};font-size:12px;">●</span> Current Status<br><strong style="font-size:16px;">${princStatus.icon} ${princStatus.text}</strong></div>
         <div style="font-size:12px; color:#a0aec0;">Updated ${princStatus.updated}</div>
      </div>
      <input type="text" id="princ-status-note" value="${princStatus.note}" placeholder="Optional status note (e.g. Back by 3 PM)..." style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:1rem; font-family:inherit;">
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px; margin-bottom:1rem;">
        <button class="btn" style="background:#48bb78; color:white;" onclick="setPrincStatus('Available', '#48bb78', '✅')">✅ Available</button>
        <button class="btn" style="background:#4299e1; color:white;" onclick="setPrincStatus('In Meeting', '#4299e1', '🤝')">🤝 In Meeting</button>
        <button class="btn" style="background:#ed8936; color:white;" onclick="setPrincStatus('Out of Campus', '#ed8936', '🏎️')">🏎️ Out of Campus</button>
        <button class="btn" style="background:#4a5568; color:white;" onclick="setPrincStatus('Not Available', '#4a5568', '⛔')">⛔ Not Available</button>
      </div>
      <div style="display:flex; gap:10px;">
         <select id="princ-status-select" style="flex:1; padding:10px; border:1px solid #e2e8f0; border-radius:8px;">
           <option value="Available" ${princStatus.text === 'Available' ? 'selected' : ''}>Available</option>
           <option value="In Meeting" ${princStatus.text === 'In Meeting' ? 'selected' : ''}>In Meeting</option>
           <option value="Out of Campus" ${princStatus.text === 'Out of Campus' ? 'selected' : ''}>Out of Campus</option>
           <option value="Not Available" ${princStatus.text === 'Not Available' ? 'selected' : ''}>Not Available</option>
         </select>
         <button class="btn" style="background:#8b5cf6; color:white; padding:0 20px;" onclick="updatePrincStatusBtn()">Update</button>
      </div>
    </div>

    <!-- Schedule Manager Section -->
    <div class="white-card" style="margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <div>
          <div style="font-size:18px; font-weight:700;">Schedule Manager</div>
          <div style="font-size:12px; color:#718096;">${princSchedules.length} Item(s)</div>
        </div>
        <button class="btn" style="background:#8b5cf6; color:white;" onclick="openPrincScheduleModal()">+ Add Schedule</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
           <thead><tr><th>DATE</th><th>TIME</th><th>PURPOSE</th><th>LOCATION</th><th>NOTES</th><th>ACTIONS</th></tr></thead>
           <tbody>
             ${princSchedules.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:#9ca3af;">No schedules added yet.</td></tr>' : ''}
             ${princSchedules.map(s => `<tr>
               <td>${s.date}</td>
               <td>${s.time}</td>
               <td>${s.purpose}</td>
               <td>${s.location}</td>
               <td>${s.notes}</td>
               <td>
                 <button class="btn btn-outline" style="padding:4px 8px;font-size:11px;" onclick="editPrincSchedule('${s.id}')">Edit</button> 
                 <button class="btn btn-outline" style="padding:4px 8px;font-size:11px;color:red;border-color:red;" onclick="deletePrincSchedule('${s.id}')">Del</button>
               </td>
             </tr>`).join('')}
           </tbody>
        </table>
      </div>
    </div>

    <div class="stats-row">
      ${statCard('👥','Total Students',users.length,'Registered students','stat-blue')}
      ${statCard('🏛️','Active Clubs',clubs.filter(c=>c.approved).length,'Approved clubs','stat-mint')}
      ${statCard('📅','Total Events',events.filter(e=>e.status==='approved').length,'Approved events','stat-amber')}
      ${statCard('📌','Events to Attend',toAttendIds.length,'My Schedule','stat-purple')}
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:1.5rem;">
      <!-- Events overview -->
      <div class="white-card">
        <div class="sec-title" style="margin-bottom:1rem;">Institution Events & Scheduling</div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Event</th><th>Date & Time</th><th>Venue</th><th>My Schedule</th></tr></thead>
            <tbody>
              ${events.filter(e=>e.status==='approved').slice(0,10).map(e=>`
                <tr style="cursor:pointer;" onclick="openEventModal('${e.id}')">
                  <td class="td-name">${e.name}</td>
                  <td>${formatDate(e.date)} ${formatTime(e.time)}</td>
                  <td>${e.venue}</td>
                  <td>
                    ${toAttendIds.includes(e.id)
                      ? `<button class="btn btn-green" style="padding:6px 12px;font-size:12px;" onclick="event.stopPropagation(); toggleAttendEvent('${e.id}')">✓ Attending</button>`
                      : `<button class="btn btn-outline" style="padding:6px 12px;font-size:12px;" onclick="event.stopPropagation(); toggleAttendEvent('${e.id}')">+ Attend</button>`
                    }
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right panel -->
      <div>
        <div class="avail-card" style="margin-bottom:1rem;">
          <div class="avail-head"><span style="font-weight:700;font-size:14px;">My Schedule (To Attend)</span></div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">
            ${toAttendIds.length === 0 
              ? `<div style="font-size:12px;color:#6b7280;text-align:center;">No events in schedule</div>`
              : toAttendIds.map(id => {
                  const e = events.find(ev=>ev.id===id);
                  if(!e) return '';
                  return `<div style="background:rgba(255,255,255,0.7);padding:10px;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;" onclick="openEventModal('${e.id}')">
                            <div style="font-weight:700;font-size:13px;color:#111827;">${e.name}</div>
                            <div style="font-size:11px;color:#4b5563;margin-top:4px;">🕒 ${formatDate(e.date)} at ${formatTime(e.time)}</div>
                            <div style="font-size:11px;color:#4b5563;margin-top:2px;">📍 ${e.venue}</div>
                          </div>`;
                }).join('')
            }
          </div>
        </div>
        <div class="white-card">
          <div class="sec-title" style="margin-bottom:10px;">Event Types Overview</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <span style="font-size:13px;font-weight:600;">On-Campus Events</span>
              <span class="badge badge-green">${events.filter(e=>e.venue.toLowerCase().includes('hall') || e.venue.toLowerCase().includes('lab') || e.venue.toLowerCase().includes('ground') || e.venue.toLowerCase().includes('room')).length} Active</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;">
              <span style="font-size:13px;font-weight:600;">Off-Campus Events</span>
              <span class="badge badge-amber">${events.filter(e=>!e.venue.toLowerCase().includes('hall') && !e.venue.toLowerCase().includes('lab') && !e.venue.toLowerCase().includes('ground') && !e.venue.toLowerCase().includes('room')).length} Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function lockPrincipalPortal() {
  STATE.principalUnlocked=false;
  toast('Principal portal locked.','info');
  showPage('authority-dashboard');
}

/* ── Principal Status & Schedule Logic ── */
window.setPrincStatus = function(text, color, icon) {
  const note = document.getElementById('princ-status-note').value;
  const updated = new Date().toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
  localStorage.setItem('vvce_principal_status', JSON.stringify({text, note, updated, color, icon}));
  renderPrincipalPortal();
  toast('Status updated successfully!', 'success');
};

window.updatePrincStatusBtn = function() {
  const select = document.getElementById('princ-status-select');
  const text = select.value;
  let color = '#48bb78', icon = '✅';
  if(text === 'In Meeting') { color = '#4299e1'; icon = '🤝'; }
  else if(text === 'Out of Campus') { color = '#ed8936'; icon = '🏎️'; }
  else if(text === 'Not Available') { color = '#4a5568'; icon = '⛔'; }
  setPrincStatus(text, color, icon);
};

window.openPrincScheduleModal = function(id = null) {
  if (id) {
    const schedules = JSON.parse(localStorage.getItem('vvce_principal_schedule') || '[]');
    const s = schedules.find(x => x.id === id);
    if(s) {
      document.getElementById('ps-date').value = s.dateRaw || s.date;
      document.getElementById('ps-time').value = s.time;
      document.getElementById('ps-purpose').value = s.purpose;
      document.getElementById('ps-location').value = s.location;
      document.getElementById('ps-notes').value = s.notes;
      window.editingPrincScheduleId = id;
    }
  } else {
    document.getElementById('ps-date').value = '';
    document.getElementById('ps-time').value = '';
    document.getElementById('ps-purpose').value = '';
    document.getElementById('ps-location').value = '';
    document.getElementById('ps-notes').value = '';
    window.editingPrincScheduleId = null;
  }
  openModal('modal-princ-schedule');
};

window.savePrincSchedule = function() {
  const dateRaw = document.getElementById('ps-date').value;
  const time = document.getElementById('ps-time').value;
  const purpose = document.getElementById('ps-purpose').value;
  const location = document.getElementById('ps-location').value;
  const notes = document.getElementById('ps-notes').value;

  if(!dateRaw || !time || !purpose) {
    toast('Please fill date, time, and purpose.', 'error');
    return;
  }
  
  const d = new Date(dateRaw);
  const dateStr = d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric', year:'numeric'});

  const schedules = JSON.parse(localStorage.getItem('vvce_principal_schedule') || '[]');
  
  if (window.editingPrincScheduleId) {
    const idx = schedules.findIndex(x => x.id === window.editingPrincScheduleId);
    if(idx > -1) {
      schedules[idx] = { id: window.editingPrincScheduleId, dateRaw, date: dateStr, time, purpose, location, notes };
      toast('Schedule updated!', 'success');
    }
  } else {
    schedules.push({
      id: 'ps_' + Date.now(),
      dateRaw,
      date: dateStr,
      time, purpose, location, notes
    });
    toast('Schedule added!', 'success');
  }
  
  localStorage.setItem('vvce_principal_schedule', JSON.stringify(schedules));
  closeModal('modal-princ-schedule');
  renderPrincipalPortal();
};

window.editPrincSchedule = function(id) {
  openPrincScheduleModal(id);
};

window.deletePrincSchedule = function(id) {
  if(!confirm('Delete this schedule?')) return;
  let schedules = JSON.parse(localStorage.getItem('vvce_principal_schedule') || '[]');
  schedules = schedules.filter(x => x.id !== id);
  localStorage.setItem('vvce_principal_schedule', JSON.stringify(schedules));
  toast('Schedule deleted.', 'info');
  renderPrincipalPortal();
};


/* ─────────────────────────────────────────────────────────────
   CLUB CARD STYLES (missing from CSS, added inline via JS)
───────────────────────────────────────────────────────────────*/
(function addClubCardStyles(){
  const style=document.createElement('style');
  style.textContent=`
    .cpcard{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1.25rem;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);transition:all 0.18s;}
    .cpcard:hover{box-shadow:0 4px 12px rgba(0,0,0,0.08);}
    .cpcard-pending{border-left:3px solid #f59e0b;}
    .cpcard-head{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;}
    .cpcard-name{font-family:'Outfit',sans-serif;font-size:16px;font-weight:800;color:#111827;}
    .cpcard-domain{font-size:12px;color:#6b7280;margin-top:2px;}
    .cpcard-info{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:#374151;margin-bottom:10px;}
    .cpcard-acts{display:flex;gap:8px;}
    .analytics-chart{padding:0.5rem 0;}
    .chart-bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
    .chart-lbl{font-size:11px;color:#6b7280;width:28px;text-align:right;flex-shrink:0;}
    .chart-track{flex:1;height:22px;background:#f1f5f9;border-radius:4px;overflow:hidden;}
    .chart-fill{height:100%;background:linear-gradient(90deg,#d97706,#fbbf24);border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;font-size:10px;font-weight:700;color:#0f172a;transition:width 1s ease;}
    .chart-empty{text-align:center;padding:2rem;color:#9ca3af;font-size:13px;}
    @media(max-width:600px){.prof-head-row{flex-direction:column;}.prof-stats{flex-direction:column;gap:0.5rem;}.create-ev-wrap{padding:0;}}
  `;
  document.head.appendChild(style);
})();


/* ─────────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', function() {
  bootApp();
  // Set default register role (student form visible)
  selectRegRole('student');
  // Init Google Sign-In after GIS script finishes loading
  if (typeof google !== 'undefined') {
    initGoogleAuth();
  } else {
    window.addEventListener('load', initGoogleAuth);
  }
});

// Expose all functions to window for inline onclick handlers in HTML
window.addNotif = addNotif; window.addNotifToUser = addNotifToUser; window.applyAttendanceRewards = applyAttendanceRewards; window.approveClub = approveClub; window.approveEvent = approveEvent; window.avatar = avatar; window.changeMonth = changeMonth; window.checkClashCount = checkClashCount; window.clearAuthMsg = clearAuthMsg; window.closeModal = closeModal; window.completeRegistration = completeRegistration; window.computeStudentYearSem = computeStudentYearSem; window.confirmReject = confirmReject; window.deanApprovalsContent = deanApprovalsContent; window.deanApproveClub = deanApproveClub; window.deanClashContent = deanClashContent; window.deanDashboardContent = deanDashboardContent; window.deanEventApprovalsContent = deanEventApprovalsContent; window.deanEventsContent = deanEventsContent; window.deanFilterEvents = deanFilterEvents; window.deanRejectClub = deanRejectClub; window.detailChip = detailChip; window.drawCalendar = drawCalendar; window.eventCard = eventCard; window.filterClubs = filterClubs; window.filterEvents = filterEvents; window.formatDate = formatDate; window.formatTime = formatTime; window.genId = genId; window.getDB = getDB; window.getDBObj = getDBObj; window.getGreeting = getGreeting; window.getRelativeTime = getRelativeTime; window.goBack = goBack; window.googleLoginByEmail = googleLoginByEmail; window.handleAdminSignup = handleAdminSignup; window.handleAuthoritySignup = handleAuthoritySignup; window.handleDeanPortalNav = handleDeanPortalNav; window.handleForgotPassword = handleForgotPassword; window.handleLogin = handleLogin; window.handlePhotoUpload = handlePhotoUpload; window.handlePosterUpload = handlePosterUpload; window.handlePrincipalPortalNav = handlePrincipalPortalNav; window.handleResumeUpload = handleResumeUpload; window.handleStudentSignup = handleStudentSignup; window.initGoogleAuth = initGoogleAuth; window.launchApp = launchApp; window.lockDeanPortal = lockDeanPortal; window.lockPrincipalPortal = lockPrincipalPortal; window.logout = logout; window.manualGoogleEmailEntry = manualGoogleEmailEntry; window.markAllRead = markAllRead; window.navItem = navItem; window.openEventModal = openEventModal; window.openModal = openModal; window.openPaymentModal = openPaymentModal; window.openProfileEdit = openProfileEdit; window.openRejectModal = openRejectModal; window.profField = profField; window.profFieldLink = profFieldLink; window.quickLogin = quickLogin; window.readNotif = readNotif; window.registerEv = registerEv; window.regList = regList; window.renderAcadSchedule = renderAcadSchedule; window.renderAdminDashboard = renderAdminDashboard; window.renderApprovals = renderApprovals; window.renderAttendancePage = renderAttendancePage; window.renderAuthorityDashboard = renderAuthorityDashboard; window.renderAuthorityProfile = renderAuthorityProfile; window.renderCalendarPage = renderCalendarPage; window.renderCertificatesPage = renderCertificatesPage; window.renderClashDetect = renderClashDetect; window.renderClubCards = renderClubCards; window.renderClubMonitor = renderClubMonitor; window.renderCreateEventPage = renderCreateEventPage; window.renderDeanPortal = renderDeanPortal; window.renderEventsPage = renderEventsPage; window.renderManageEventsPage = renderManageEventsPage; window.renderNotifs = renderNotifs; window.renderParticipantsPage = renderParticipantsPage; window.renderParticipantTable = renderParticipantTable; window.renderPrincipalAvailability = renderPrincipalAvailability; window.renderPrincipalPortal = renderPrincipalPortal; window.renderProfilePage = renderProfilePage; window.renderRegistrationsPage = renderRegistrationsPage; window.renderSidebar = renderSidebar; window.renderStudentDashboard = renderStudentDashboard; window.renderTopbarUser = renderTopbarUser; window.revokeClub = revokeClub; window.saveProfileEdit = saveProfileEdit; window.selectRegRole = selectRegRole; window.showAuthMsg = showAuthMsg; window.showCalDateEvents = showCalDateEvents; window.showPage = showPage; window.simulatePayment = simulatePayment; window.statCard = statCard; window.submitCertificate = submitCertificate; window.submitDraftEvent = submitDraftEvent; window.submitEvent = submitEvent; window.switchMainTab = switchMainTab; window.switchRegTab = switchRegTab; window.titleCase = titleCase; window.toast = toast; window.toggleChip = toggleChip; window.toggleNotifPanel = toggleNotifPanel; window.togglePass = togglePass; window.toggleSidebar = toggleSidebar; window.triggerPhotoUpload = triggerPhotoUpload; window.unregisterEv = unregisterEv; window.updateUser = updateUser; window.verifyDeanPassword = verifyDeanPassword; window.verifyPrincipalPassword = verifyPrincipalPassword; window.viewClubDetail = viewClubDetail;
