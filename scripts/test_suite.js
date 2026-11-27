const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');

function createStorageMock() {
  const store = new Map();
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); }
  };
}

function createElementMock(id = '') {
  const classes = new Set();
  return {
    id,
    value: '',
    textContent: '',
    innerText: '',
    innerHTML: '',
    className: '',
    disabled: false,
    checked: false,
    style: {},
    dataset: {},
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      toggle: (c, force) => (force === undefined ? (classes.has(c) ? classes.delete(c) : classes.add(c)) : (force ? classes.add(c) : classes.delete(c))),
      contains: c => classes.has(c)
    },
    setAttribute() {},
    getAttribute() { return null; },
    scrollIntoView() {},
    focus() {},
    appendChild() {},
    remove() {}
  };
}

function loadAppSandbox(supabaseMock = null) {
  const elements = new Map();
  const getEl = (id) => {
    if (!elements.has(id)) elements.set(id, createElementMock(id));
    return elements.get(id);
  };

  const tracked = {
    authMsgs: [],
    toasts: [],
    launchedUsers: [],
    mainTabs: [],
    regRoles: [],
    modalOpens: [],
    modalCloses: [],
    notifsSent: [],
    activeUrl: 'https://events.vvce.ac.in/'
  };

  const sandbox = {
    console,
    Date,
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    Promise,
    Set,
    Map,
    URL,
    encodeURIComponent,
    decodeURIComponent,
    setTimeout: () => 0,
    clearTimeout: () => {},
    TextEncoder,
    TextDecoder,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    crypto: crypto.webcrypto || crypto,
    localStorage: createStorageMock(),
    sessionStorage: createStorageMock(),
    navigator: { userAgent: 'node-test' },
    document: {
      body: { style: {}, classList: createElementMock('body').classList },
      activeElement: null,
      getElementById: getEl,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: (tag) => createElementMock(tag),
      addEventListener: () => {}
    },
    window: null
  };

  sandbox.window = sandbox;
  sandbox.location = {
    origin: 'https://events.vvce.ac.in',
    pathname: '/index.html',
    href: tracked.activeUrl,
    search: '',
    hash: ''
  };
  sandbox.window.location = sandbox.location;
  sandbox.history = {
    replaceState: (_s, _t, newUrl) => {
      tracked.activeUrl = newUrl;
      sandbox.location.href = 'https://events.vvce.ac.in' + newUrl;
      sandbox.location.hash = '';
      sandbox.location.search = '';
    }
  };
  sandbox.window.history = sandbox.history;
  sandbox.window.supabase = supabaseMock;

  vm.createContext(sandbox);

  const filesToLoad = [
    'js/core/config.js',
    'js/core/database.js',
    'js/core/utils.js',
    'js/pages/auth.js',
    'js/pages/events.js'
  ];

  for (const rel of filesToLoad) {
    const code = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
    vm.runInContext(code, sandbox, { filename: rel });
  }
  vm.runInContext('Object.assign(window, { STATE, SUPABASE_CACHE, DEFAULT_USERS })', sandbox);

  // Override UI hooks cleanly after source scripts define defaults
  sandbox.getSupabaseClient = () => sandbox.window.supabase;
  sandbox.toast = (msg, type) => tracked.toasts.push({ msg, type });
  sandbox.openModal = (id) => tracked.modalOpens.push(id);
  sandbox.closeModal = (id) => tracked.modalCloses.push(id);
  sandbox.showPage = () => {};
  sandbox.launchApp = async (user) => { tracked.launchedUsers.push(user); };
  sandbox.renderSidebar = () => {};
  sandbox.renderTopbarUser = () => {};
  sandbox.addNotif = (msg, icon) => tracked.notifsSent.push({ uid: sandbox.STATE.user?.id, msg, icon });
  sandbox.addNotifToUser = (uid, msg, icon) => tracked.notifsSent.push({ uid, msg, icon });

  const origSwitchMainTab = sandbox.switchMainTab;
  sandbox.switchMainTab = (tab) => {
    tracked.mainTabs.push(tab);
    return origSwitchMainTab(tab);
  };
  const origSelectRegRole = sandbox.selectRegRole;
  sandbox.selectRegRole = (role) => {
    tracked.regRoles.push(role);
    return origSelectRegRole(role);
  };
  const origShowAuthMsg = sandbox.showAuthMsg;
  sandbox.showAuthMsg = (msg, type = 'error') => {
    tracked.authMsgs.push({ msg, type });
    return origShowAuthMsg(msg, type);
  };

  return { sandbox, tracked, getEl };
}

function createMockSupabase({ usersRows = [], registeredStudentsRows = [] } = {}) {
  const calls = {
    signOutCount: 0,
    insertedUsers: [],
    updatedUsers: [],
    eventUpdates: [],
    regUpserts: []
  };

  const makeTableQuery = (tableName) => {
    let filterEmail = null;
    const query = {
      select() { return query; },
      ilike(_col, val) { filterEmail = String(val || '').toLowerCase(); return query; },
      eq() { return query; },
      order() { return query; },
      range() { return query; },
      async limit() {
        if (tableName === 'users') {
          const matched = filterEmail
            ? usersRows.filter(u => String(u.email || '').toLowerCase() === filterEmail)
            : usersRows;
          return { data: matched, error: null };
        }
        if (tableName === 'registered_students') {
          const matched = filterEmail
            ? registeredStudentsRows.filter(u => String(u.email || '').toLowerCase() === filterEmail)
            : registeredStudentsRows;
          return { data: matched, error: null };
        }
        return { data: [], error: null };
      },
      insert(rows) {
        if (tableName === 'users') calls.insertedUsers.push(...rows);
        return Promise.resolve({ data: rows, error: null });
      },
      upsert(rows) {
        if (tableName === 'event_registrations') calls.regUpserts.push(...rows);
        return { catch() {} };
      },
      update(payload) {
        return {
          eq(col, val) {
            if (tableName === 'users') calls.updatedUsers.push({ col, val, payload });
            if (tableName === 'events') calls.eventUpdates.push({ col, val, payload });
            return {
              catch() {}
            };
          }
        };
      }
    };
    return query;
  };

  const sb = {
    auth: {
      async signOut() {
        calls.signOutCount += 1;
        return { error: null };
      },
      async getSession() {
        return { data: { session: null }, error: null };
      }
    },
    from: (tableName) => makeTableQuery(tableName),
    async rpc() { return { data: null, error: null }; }
  };

  return { sb, calls };
}

async function runTests() {
  console.log('--- VVCE EVENTS HUB AUTOMATED TEST SUITE (PHASES 1–3) ---');
  let passed = 0;
  function pass(label) {
    passed += 1;
    console.log(`✅ PASS: ${label}`);
  }

  // ─────────────────────────────────────────────────────────────
  // 1. Domain Validation: isValidVvceEmail (Phase 2A)
  // ─────────────────────────────────────────────────────────────
  {
    const { sandbox } = loadAppSandbox();
    assert.strictEqual(sandbox.isValidVvceEmail('akash@vvce.ac.in'), true);
    assert.strictEqual(sandbox.isValidVvceEmail('STUD.4VV22CS001@VVCE.AC.IN'), true);
    assert.strictEqual(sandbox.isValidVvceEmail('  dean.sw@vvce.ac.in  '), true);
    assert.strictEqual(sandbox.isValidVvceEmail('user@gmail.com'), false);
    assert.strictEqual(sandbox.isValidVvceEmail('user@vvce.ac.in.evil.com'), false);
    assert.strictEqual(sandbox.isValidVvceEmail('user@sub.vvce.ac.in'), false);
    assert.strictEqual(sandbox.isValidVvceEmail(''), false);
    assert.strictEqual(sandbox.isValidVvceEmail(null), false);
    pass('1. isValidVvceEmail enforces strict @vvce.ac.in domain');
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Google Pre-Registration Gate (Phase 2A)
  // ─────────────────────────────────────────────────────────────
  {
    // 2a: Unregistered @vvce.ac.in Google user is signed out, NEVER auto-created, redirected to Register
    const mockA = createMockSupabase({ usersRows: [], registeredStudentsRows: [] });
    const ctxA = loadAppSandbox(mockA.sb);
    // Ensure a non-demo matching email isn't left in local cache
    ctxA.sandbox.SUPABASE_CACHE.vvce_users = [
      { id: 'u1', type: 'student', name: 'Demo', email: 'akash@vvce.ac.in', pass: null }
    ];

    await ctxA.sandbox.googleLoginByEmail('newstudent@vvce.ac.in', 'New Student', 'https://pic.test/a.jpg', 'gid_999');

    assert.strictEqual(mockA.calls.signOutCount, 1, 'Expected immediate sb.auth.signOut() for unregistered Google login');
    assert.strictEqual(mockA.calls.insertedUsers.length, 0, 'Must never auto-create users row on Google login');
    assert.strictEqual(ctxA.tracked.launchedUsers.length, 0, 'Unregistered user must not launch dashboard');
    assert.strictEqual(ctxA.tracked.mainTabs.slice(-1)[0], 'register', 'Should switch to Register tab');
    assert.strictEqual(ctxA.tracked.regRoles.slice(-1)[0], 'student', 'Should select student registration form');
    assert.strictEqual(ctxA.getEl('s-email').value, 'newstudent@vvce.ac.in');
    assert.strictEqual(
      ctxA.tracked.authMsgs.slice(-1)[0].msg,
      'Account not found. Please complete the registration form first using your @vvce.ac.in email.'
    );
    pass('2a. Unregistered @vvce.ac.in Google login signs out, blocks auto-create & redirects to Register');

    // 2b: Non-@vvce.ac.in Google login is rejected & signed out immediately
    const mockB = createMockSupabase({ usersRows: [] });
    const ctxB = loadAppSandbox(mockB.sb);
    await ctxB.sandbox.googleLoginByEmail('outsider@gmail.com', 'Outsider');
    assert.strictEqual(mockB.calls.signOutCount, 1);
    assert.strictEqual(ctxB.tracked.launchedUsers.length, 0);
    assert.strictEqual(ctxB.tracked.mainTabs.slice(-1)[0], 'signin');
    pass('2b. Non-@vvce.ac.in Google email rejected & signed out');

    // 2c: Pre-registered @vvce.ac.in Google student signs in cleanly & links google_id
    const registeredRow = {
      id: 'stu_101',
      type: 'student',
      name: 'Meera K',
      email: 'meera@vvce.ac.in',
      usn: '4VV23CS042',
      branch: 'CSE',
      approved: true,
      notifs: []
    };
    const mockC = createMockSupabase({ usersRows: [registeredRow] });
    const ctxC = loadAppSandbox(mockC.sb);
    await ctxC.sandbox.googleLoginByEmail('meera@vvce.ac.in', 'Meera K', 'https://pic.test/m.jpg', 'gid_101');
    assert.strictEqual(mockC.calls.signOutCount, 0);
    assert.strictEqual(ctxC.tracked.launchedUsers.length, 1);
    assert.strictEqual(ctxC.tracked.launchedUsers[0].id, 'stu_101');
    assert.strictEqual(mockC.calls.updatedUsers.length, 1);
    assert.strictEqual(mockC.calls.updatedUsers[0].payload.google_id, 'gid_101');
    pass('2c. Registered @vvce.ac.in Google user logs in and links google_id');
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Venue & Time-Slot Overlap Clash Math (Phase 2C)
  // ─────────────────────────────────────────────────────────────
  {
    const { sandbox } = loadAppSandbox();
    assert.strictEqual(sandbox.parseTimeToMinutes('09:30'), 570);
    assert.strictEqual(sandbox.parseTimeToMinutes('2:15 PM'), 855);
    assert.strictEqual(sandbox.parseTimeToMinutes('12:00 AM'), 0);
    assert.strictEqual(sandbox.parseTimeToMinutes('12:30 PM'), 750);
    assert.strictEqual(sandbox.parseTimeToMinutes('invalid'), null);

    const baseApproved = {
      id: 'ev_10',
      name: 'HackVVCE',
      club: 'CSE Club',
      date: '2026-12-10',
      time: '09:00',
      endTime: '11:00',
      venue: 'Main Auditorium',
      status: 'approved'
    };

    // Partial overlap
    assert.strictEqual(sandbox.doEventSlotsOverlap(
      { id: 'ev_new', date: '2026-12-10', time: '10:30', endTime: '12:00', venue: ' main auditorium ', status: 'pending' },
      baseApproved
    ), true);

    // Adjacent edge touch (11:00 == 11:00) MUST NOT clash
    assert.strictEqual(sandbox.doEventSlotsOverlap(
      { id: 'ev_new', date: '2026-12-10', time: '11:00', endTime: '13:00', venue: 'Main Auditorium', status: 'pending' },
      baseApproved
    ), false);

    // Afternoon same-day same-venue slot MUST NOT clash
    assert.strictEqual(sandbox.doEventSlotsOverlap(
      { id: 'ev_new', date: '2026-12-10', time: '14:00', endTime: '16:00', venue: 'Main Auditorium', status: 'pending' },
      baseApproved
    ), false);

    // Self-edit MUST NOT clash with itself
    assert.strictEqual(sandbox.doEventSlotsOverlap(
      { ...baseApproved, time: '09:30', endTime: '11:30' },
      baseApproved
    ), false);

    // Rejected/cancelled events MUST NOT block slots
    assert.strictEqual(sandbox.doEventSlotsOverlap(
      { id: 'ev_new', date: '2026-12-10', time: '09:30', endTime: '10:30', venue: 'Main Auditorium', status: 'pending' },
      { ...baseApproved, status: 'rejected' }
    ), false);
    assert.strictEqual(sandbox.doEventSlotsOverlap(
      { id: 'ev_new', date: '2026-12-10', time: '09:30', endTime: '10:30', venue: 'Main Auditorium', status: 'pending' },
      { ...baseApproved, status: 'cancelled' }
    ), false);

    // Legacy event missing endTime defaults to +120m (14:00 -> 16:00)
    const legacyNoEnd = {
      id: 'ev_legacy',
      date: '2026-12-11',
      time: '14:00',
      venue: 'Seminar Hall A',
      status: 'scheduled'
    };
    assert.strictEqual(sandbox.doEventSlotsOverlap(
      { id: 'ev_new2', date: '2026-12-11', time: '15:30', endTime: '16:30', venue: 'Seminar Hall A', status: 'pending' },
      legacyNoEnd
    ), true);
    assert.strictEqual(sandbox.doEventSlotsOverlap(
      { id: 'ev_new2', date: '2026-12-11', time: '16:00', endTime: '17:30', venue: 'Seminar Hall A', status: 'pending' },
      legacyNoEnd
    ), false);

    pass('3. Time-slot clash logic enforces startA < endB && endA > startB accurately');
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Solo vs. Group Registration State Progression (Phase 2D)
  // ─────────────────────────────────────────────────────────────
  {
    const mock = createMockSupabase();
    const { sandbox } = loadAppSandbox(mock.sb);
    const leader = { id: 'stu_1', type: 'student', name: 'Asha R', email: 'asha@vvce.ac.in', usn: '4VV23CS001' };
    const mate = { id: 'stu_2', type: 'student', name: 'Bhanu S', email: 'bhanu@vvce.ac.in', usn: '4VV23CS002' };
    sandbox.STATE.user = leader;

    // 4a. Solo Free Event: skips team steps -> none -> pending_approval -> registered
    const soloFreeEv = {
      id: 'ev_sf',
      name: 'Solo Coding',
      isTeamEvent: false,
      minTeamSize: 1,
      maxTeamSize: 1,
      fee: 0,
      needsPayment: false,
      registrations: [],
      pendingPayments: []
    };
    let prog = sandbox.getEventRegistrationProgress(soloFreeEv, leader);
    assert.strictEqual(prog.status, 'none');
    assert.strictEqual(prog.isGroup, false);
    assert.strictEqual(prog.requiresPayment, false);
    const stepperSolo = sandbox.renderRegistrationStepper(soloFreeEv, prog);
    assert.ok(stepperSolo.includes('Solo (Skipped)'));
    assert.ok(stepperSolo.includes('Free (Skipped)'));

    soloFreeEv.pendingPayments.push({ uid: leader.id, status: 'pending_approval', isTeam: false });
    assert.strictEqual(sandbox.getEventRegistrationProgress(soloFreeEv, leader).status, 'pending_approval');

    soloFreeEv.registrations.push(leader.id);
    assert.strictEqual(sandbox.getEventRegistrationProgress(soloFreeEv, leader).status, 'registered');

    // 4b. Solo Paid Event: pending_payment -> pending_approval -> rejected -> pending_approval -> registered
    const soloPaidEv = {
      id: 'ev_sp',
      name: 'AI Bootcamp',
      isTeamEvent: false,
      minTeamSize: 1,
      maxTeamSize: 1,
      fee: 150,
      needsPayment: true,
      registrations: [],
      pendingPayments: [{ uid: leader.id, status: 'rejected', rejectionReason: 'Blurry UTR', isTeam: false }]
    };
    prog = sandbox.getEventRegistrationProgress(soloPaidEv, leader);
    assert.strictEqual(prog.status, 'rejected');
    assert.strictEqual(prog.rejectionReason, 'Blurry UTR');
    assert.strictEqual(prog.requiresPayment, true);

    // 4c. Group Paid Event: pending_team -> pending_payment -> pending_approval -> registered
    const groupPaidEv = {
      id: 'ev_gp',
      name: 'Hackathon 2026',
      isTeamEvent: true,
      minTeamSize: 2,
      maxTeamSize: 3,
      fee: 200,
      needsPayment: true,
      registrations: [],
      pendingPayments: [],
      teams: [{
        id: 'team_1',
        name: 'ByteSquad',
        leaderId: leader.id,
        leaderName: leader.name,
        leaderEmail: leader.email,
        memberIds: [leader.id],
        pendingEmails: [mate.email],
        status: 'pending_team',
        paymentStatus: 'pending'
      }]
    };
    sandbox.SUPABASE_CACHE.vvce_events = [groupPaidEv];
    sandbox.SUPABASE_CACHE.vvce_users = [leader, mate];

    assert.strictEqual(sandbox.getEventRegistrationProgress(groupPaidEv, leader).status, 'pending_team');
    assert.strictEqual(sandbox.getEventRegistrationProgress(groupPaidEv, mate).status, 'pending_team');
    assert.strictEqual(sandbox.getEventRegistrationProgress(groupPaidEv, mate).isPendingInvite, true);

    // Simulate invite still pending -> evaluateAndAdvanceTeamState keeps pending_team
    await sandbox.evaluateAndAdvanceTeamState(groupPaidEv, groupPaidEv.teams[0], [groupPaidEv]);
    assert.strictEqual(groupPaidEv.teams[0].status, 'pending_team');
    assert.strictEqual(groupPaidEv.registrations.length, 0);

    // Teammate accepts invite -> pendingEmails becomes empty, transitions to pending_payment (never registered!)
    groupPaidEv.teams[0].memberIds.push(mate.id);
    groupPaidEv.teams[0].pendingEmails = [];
    await sandbox.evaluateAndAdvanceTeamState(groupPaidEv, groupPaidEv.teams[0], [groupPaidEv]);
    assert.strictEqual(groupPaidEv.teams[0].status, 'pending_payment');
    assert.strictEqual(sandbox.getEventRegistrationProgress(groupPaidEv, leader).status, 'pending_payment');
    assert.strictEqual(groupPaidEv.registrations.length, 0);

    // Payment proof submitted -> pending_approval
    groupPaidEv.teams[0].status = 'pending_approval';
    groupPaidEv.pendingPayments.push({ uid: leader.id, teamId: 'team_1', status: 'pending_approval', isTeam: true, utrNumber: 'UTR123456' });
    assert.strictEqual(sandbox.getEventRegistrationProgress(groupPaidEv, leader).status, 'pending_approval');

    // Free group event transitions directly pending_team -> pending_approval upon confirmation
    const groupFreeEv = {
      id: 'ev_gf',
      name: 'Design Sprint',
      isTeamEvent: true,
      minTeamSize: 2,
      maxTeamSize: 4,
      fee: 0,
      needsPayment: false,
      registrations: [],
      pendingPayments: [],
      teams: [{
        id: 'team_2',
        name: 'Designers',
        leaderId: leader.id,
        leaderName: leader.name,
        leaderEmail: leader.email,
        memberIds: [leader.id, mate.id],
        pendingEmails: [],
        status: 'pending_team'
      }]
    };
    await sandbox.evaluateAndAdvanceTeamState(groupFreeEv, groupFreeEv.teams[0], [groupFreeEv]);
    assert.strictEqual(groupFreeEv.teams[0].status, 'pending_approval');
    assert.strictEqual(sandbox.getEventRegistrationProgress(groupFreeEv, leader).status, 'pending_approval');

    pass('4. Solo vs Group registration progression & invite transition gates verified');
  }

  // ─────────────────────────────────────────────────────────────
  // 5. XSS & URL Sanitization Helpers (Phase 3)
  // ─────────────────────────────────────────────────────────────
  {
    const { sandbox } = loadAppSandbox();
    assert.strictEqual(
      sandbox.escapeHTML('<img src=x onerror="alert(\'xss\')">&'),
      '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;&amp;'
    );
    assert.strictEqual(sandbox.escapeHTML(null), '');
    assert.strictEqual(sandbox.escapeHTML(undefined), '');
    assert.strictEqual(sandbox.escapeHTML('Tech & Innovation 2026'), 'Tech &amp; Innovation 2026');

    assert.strictEqual(sandbox.sanitizeUrl('javascript:alert(1)'), '');
    assert.strictEqual(sandbox.sanitizeUrl('  JAVASCRIPT:void(0)  '), '');
    assert.strictEqual(sandbox.sanitizeUrl('vbscript:msgbox(1)'), '');
    assert.strictEqual(sandbox.sanitizeUrl('data:text/html,<script>alert(1)</script>'), '');
    assert.strictEqual(sandbox.sanitizeUrl('https://vvce.ac.in/poster.png'), 'https://vvce.ac.in/poster.png');
    assert.strictEqual(sandbox.sanitizeUrl('data:image/jpeg;base64,abc123'), 'data:image/jpeg;base64,abc123');
    pass('5. escapeHTML and sanitizeUrl neutralize XSS payloads and unsafe schemes');
  }

  // ─────────────────────────────────────────────────────────────
  // 6. PBKDF2, Credential Hardening & Branch Helpers (Phases 1–3)
  // ─────────────────────────────────────────────────────────────
  {
    const { sandbox } = loadAppSandbox();
    const passText = 'TestAuthorityPass@2026';
    const salt = 'vvce_salt_random_123';
    const { hash } = await sandbox.hashPasswordWithSalt(passText, salt);
    assert.strictEqual(hash.length, 64, 'PBKDF2-SHA256 hex digest must be 64 characters');
    assert.strictEqual(await sandbox.verifyPasswordWithSalt(passText, hash, salt), true);
    assert.strictEqual(await sandbox.verifyPasswordWithSalt('WrongPassword', hash, salt), false);
    assert.strictEqual(await sandbox.verifyPasswordWithSalt(passText, hash, 'different_salt'), false);

    // Ensure DEFAULT_USERS carry zero plaintext demo passwords and mapUser never leaks pass
    assert.ok(sandbox.DEFAULT_USERS.every(u => u.pass === null), 'DEFAULT_USERS must never ship plaintext pass');
    const mapped = sandbox.mapUser({ id: 'u9', type: 'student', name: 'Test', email: 'test@vvce.ac.in', pass: 'secret123' });
    assert.strictEqual('pass' in mapped, false, 'mapUser must omit plaintext pass property');

    // Canonical branch matching
    assert.strictEqual(sandbox.isBranchMatch(['All'], 'ECE'), true);
    assert.strictEqual(sandbox.isBranchMatch(['CSE'], 'CS'), true);
    assert.strictEqual(sandbox.isBranchMatch(['CSE/AIML'], 'AIML'), true);
    assert.strictEqual(sandbox.isBranchMatch(['ME'], 'CSE'), false);

    // Ensure APPROVING_AUTHORITIES_CACHE seed hash format is valid 64-char SHA-256 hex digest
    await sandbox.syncApprovingAuthoritiesFromSupabase();
    const activeAuths = sandbox.getActiveApprovingAuthorities();
    assert.ok(activeAuths.length >= 1, 'Expected default active authority entry');
    assert.match(activeAuths[0].password_hash, /^[0-9a-f]{64}$/);
    assert.ok(Boolean(activeAuths[0].salt));

    pass('6. PBKDF2 hashing, credential stripping, and branch matching helpers verified');
  }

  console.log(`\n--- ALL ${passed} TEST GROUPS PASSED SUCCESSFULLY ---`);
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
