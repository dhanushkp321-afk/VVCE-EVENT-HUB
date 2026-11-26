// ════════════════════════════════════════════════════════
// VVCE Events Hub — Authentication
// ════════════════════════════════════════════════════════

function switchAuthTab(tab) {
  ['login-form','student-signup-form','admin-signup-form','faculty-signup-form'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));

  const formMap = {
    'login': 'login-form',
    'student-signup': 'student-signup-form',
    'admin-signup': 'admin-signup-form',
    'faculty-signup': 'faculty-signup-form',
  };
  const el = document.getElementById(formMap[tab]);
  if (el) el.style.display = 'block';
  const tabEl = document.getElementById('tab-' + tab);
  if (tabEl) tabEl.classList.add('active');
  clearAuthMessages();
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg; el.style.display = 'block';
  const s = document.getElementById('auth-success');
  if (s) s.style.display = 'none';
}
function showAuthSuccess(msg) {
  const el = document.getElementById('auth-success');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  document.getElementById('auth-error').style.display = 'none';
}
function clearAuthMessages() {
  document.getElementById('auth-error').style.display = 'none';
  const s = document.getElementById('auth-success');
  if (s) s.style.display = 'none';
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function handleLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass  = document.getElementById('login-pass').value.trim();
  const role  = document.getElementById('login-role').value;
  if (!email || !pass) { showAuthError('Please enter your email and password.'); return; }

  const user = Data.users().find(u => u.email.toLowerCase() === email && u.password === pass);
  if (!user) { showAuthError('Invalid email or password. Please try again.'); return; }

  if (role === 'student'   && user.type !== 'student')   { showAuthError('This is not a student account. Select the correct role.'); return; }
  if (role === 'admin'     && user.type !== 'admin')     { showAuthError('This is not a club admin account.'); return; }
  if (role === 'authority' && user.type !== 'authority') { showAuthError('This is not an authority account.'); return; }

  if (user.type === 'admin' && user.status === 'pending')  { showPendingScreen(user); return; }
  if (user.type === 'admin' && user.status === 'rejected') {
    showAuthError('Your club registration was rejected. Contact the Dean of Student Welfare.');
    return;
  }
  loginSuccess(user);
}

function showPendingScreen(user) {
  document.getElementById('auth-screen').innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;">
      <div style="text-align:center;max-width:480px;width:100%;">
        <div style="width:80px;height:80px;border-radius:20px;background:linear-gradient(135deg,var(--gold),var(--gold2));display:flex;align-items:center;justify-content:center;font-size:36px;margin:0 auto 1.5rem;box-shadow:0 8px 28px rgba(240,165,0,0.4);">⏳</div>
        <h2 style="font-family:'Outfit',sans-serif;font-size:24px;font-weight:800;color:var(--text1);margin-bottom:8px;">Approval Pending</h2>
        <p style="color:var(--text2);line-height:1.8;margin-bottom:1.5rem;font-size:14px;">
          Your club <strong style="color:var(--gold2)">${user.clubName}</strong> registration is under review by the
          <strong>Dean of Student Welfare</strong>.<br>You'll be notified once approved (usually 2–3 working days).
        </p>
        <div style="background:rgba(240,165,0,0.08);border:1px solid rgba(240,165,0,0.25);border-radius:14px;padding:1.25rem;margin-bottom:1.5rem;text-align:left;">
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;font-weight:700;margin-bottom:3px;">Submitted By</div>
          <div style="font-weight:700;color:var(--text1);margin-bottom:10px;">${user.adminName}</div>
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;font-weight:700;margin-bottom:3px;">Club</div>
          <div style="font-weight:700;color:var(--gold2);">${user.clubName}</div>
        </div>
        <button onclick="location.reload()" style="padding:13px 36px;background:linear-gradient(135deg,var(--accent),#9b5de5);border:none;border-radius:10px;color:white;font-family:'Outfit',sans-serif;font-weight:700;font-size:15px;cursor:pointer;box-shadow:0 6px 20px rgba(108,99,255,0.4);">← Back to Login</button>
      </div>
    </div>`;
}

function loginSuccess(user) {
  STATE.currentUser = user;
  sessionStorage.setItem('vvce_session', JSON.stringify(user));
  initApp();
}

// ── STUDENT SIGNUP ────────────────────────────────────────────────────────────
function handleStudentSignup() {
  const name    = document.getElementById('s-name').value.trim();
  const usn     = document.getElementById('s-usn').value.trim().toUpperCase();
  const year    = document.getElementById('s-year').value;
  const sem     = document.getElementById('s-sem').value;
  const branch  = document.getElementById('s-branch').value;
  const section = document.getElementById('s-section').value;
  const email   = document.getElementById('s-email').value.trim().toLowerCase();
  const pass    = document.getElementById('s-pass').value;

  if (!name || !usn || !email || !pass) { showAuthError('Please fill all required fields.'); return; }
  if (!email.endsWith('@vvce.ac.in'))   { showAuthError('Use your official VVCE email (@vvce.ac.in).'); return; }
  if (pass.length < 6)                  { showAuthError('Password must be at least 6 characters.'); return; }
  if (Data.users().find(u => u.email === email)) { showAuthError('An account with this email already exists.'); return; }

  const interests = [...document.querySelectorAll('#s-interests .interest-chip.selected')].map(c => c.textContent);
  DB.push('users', {
    id: genId('u'), type:'student',
    name, usn, year, sem, branch, section, email, password: pass, interests,
    phone:'', linkedin:'', github:'', skills:[], bio:'',
    profilePhoto:null, resume:null, achievements:[], points:0,
    pointsBySem:{'Sem 1':0,'Sem 2':0,'Sem 3':0,'Sem 4':0,'Sem 5':0,'Sem 6':0,'Sem 7':0,'Sem 8':0}
  });
  showAuthSuccess('Account created! You can now sign in.');
  setTimeout(() => switchAuthTab('login'), 1600);
}

// ── CLUB ADMIN SIGNUP ─────────────────────────────────────────────────────────
function handleAdminSignup() {
  const clubName = document.getElementById('a-club').value.trim();
  const domain   = document.getElementById('a-domain').value;
  const dept     = document.getElementById('a-dept').value;
  const adminName= document.getElementById('a-name').value.trim();
  const phone    = document.getElementById('a-phone').value.trim();
  const faculty  = document.getElementById('a-faculty').value.trim();
  const desc     = document.getElementById('a-desc').value.trim();
  const email    = document.getElementById('a-email').value.trim().toLowerCase();
  const pass     = document.getElementById('a-pass').value;
  const pass2    = document.getElementById('a-pass2').value;

  if (!clubName || !adminName || !email || !pass) { showAuthError('Please fill all required fields.'); return; }
  if (pass !== pass2)   { showAuthError('Passwords do not match.'); return; }
  if (pass.length < 6)  { showAuthError('Password must be at least 6 characters.'); return; }
  if (Data.users().find(u => u.email === email)) { showAuthError('An account with this email already exists.'); return; }

  const newAdmin = {
    id: genId('a'), type:'admin',
    clubName, domain, dept, adminName, phone,
    facultyCoordinator: faculty, description: desc,
    email, password: pass, status:'pending',
    submittedAt: new Date().toISOString().split('T')[0]
  };
  DB.push('users', newAdmin);

  // Notify all deans
  Data.users().filter(u => u.type === 'authority' && (u.designation === 'dean' || u.designation === 'principal')).forEach(a => {
    Mutate.addNotif({ id: genId('n'), userId: a.id, message: `New club registration pending: ${clubName}`, time:'Just now', read:false, icon:'🔔' });
  });

  showAuthSuccess('Club registration submitted! Awaiting Dean of Student Welfare approval.');
  setTimeout(() => switchAuthTab('login'), 2800);
}

// ── AUTHORITY SIGNUP ──────────────────────────────────────────────────────────
function handleFacultySignup() {
  const name        = document.getElementById('f-name').value.trim();
  const designation = document.getElementById('f-designation').value;
  const dept        = document.getElementById('f-dept').value;
  const email       = document.getElementById('f-email').value.trim().toLowerCase();
  const pass        = document.getElementById('f-pass').value;
  const pass2       = document.getElementById('f-pass2').value;

  if (!name || !email || !pass) { showAuthError('Please fill all required fields.'); return; }
  if (pass !== pass2)  { showAuthError('Passwords do not match.'); return; }
  if (pass.length < 6) { showAuthError('Password must be at least 6 characters.'); return; }
  if (Data.users().find(u => u.email === email)) { showAuthError('An account with this email already exists.'); return; }

  DB.push('users', { id: genId('f'), type:'authority', name, designation, dept, email, password: pass });
  showAuthSuccess('Authority account created! You can now sign in.');
  setTimeout(() => switchAuthTab('login'), 1600);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function toggleInterest(el) { el.classList.toggle('selected'); }

function quickLogin(role) {
  const map = {
    student:   { email:'student@vvce.ac.in',   pass:'password123', role:'student' },
    admin:     { email:'ieee@vvce.ac.in',       pass:'admin123',    role:'admin' },
    dean:      { email:'dean@vvce.ac.in',       pass:'dean123',     role:'authority' },
    principal: { email:'principal@vvce.ac.in',  pass:'principal123',role:'authority' },
    hod:       { email:'hod.cs@vvce.ac.in',     pass:'hod123',      role:'authority' },
  };
  const c = map[role]; if (!c) return;
  document.getElementById('login-email').value = c.email;
  document.getElementById('login-pass').value  = c.pass;
  document.getElementById('login-role').value  = c.role;
  switchAuthTab('login');
  setTimeout(handleLogin, 120);
}

function logout() {
  STATE.currentUser  = null;
  STATE.deanUnlocked = false;
  STATE.pageHistory  = [];
  sessionStorage.removeItem('vvce_session');
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value  = '';
  clearAuthMessages();
}
