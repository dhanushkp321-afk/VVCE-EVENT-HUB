/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Complete Application Logic (Bundled Distribution)
   Generated from separated modular architecture:
   - js/core/* (Configuration, Database layer, Utilities, Router)
   - js/pages/* (Auth, Student, Faculty, Authority, Events, Clubs, etc.)
   ═══════════════════════════════════════════════════════════════ */

/* ─── Module: js/core/config.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Configuration, State & Supabase Setup
   Path: js/core/config.js
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   GOOGLE OAUTH CONFIGURATION
   To enable GIS One-Tap in addition to Supabase Google OAuth:
   Paste your Google Web OAuth Client ID below.
───────────────────────────────────────────────────────────────*/
const GOOGLE_CLIENT_ID = '';

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
  authorityUnlocked: false,
  currentAuthorityId: null,
  currentAuthorityName: null,
  regRole: 'student',
  rejectEventId: null,
  registrationLocked: false
};

const supabaseUrl = 'https://nkugbdencpvhhvgqybgi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rdWdiZGVuY3B2aGh2Z3F5YmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4OTY3MzMsImV4cCI6MjA5NjQ3MjczM30.YFFnsWBymu4R59aMHTEq6ogwI0xb4xjbavpto1FrVWY';

function getSupabaseClient() {
  if (window.supabase && typeof window.supabase.from === 'function') {
    return window.supabase;
  }
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    return window.supabase;
  }
  if (typeof createClient === 'function') {
    window.supabase = createClient(supabaseUrl, supabaseKey);
    return window.supabase;
  }
  return null;
}

/* Offline fallback roster skeletons (zero plaintext passwords) */
const DEFAULT_USERS = [
  { id: 'u1', type: 'student', name: 'Akash Sharma', email: 'akash@vvce.ac.in', pass: null, isDemo: true, usn: '4VV21CS001', branch: 'CS', section: 'A', year: '4th Year', sem: 'Sem 8', admissionYear: 2021, dept: 'Computer Science', phone: '+91 98765 43210', interests: ['Technical', 'Workshop'], skills: [], bio: '', linkedin: '', github: '', achievements: [], profilePhoto: null, resume: null, points: null, pointsBySem: null, notifs: [] },
  { id: 'u2', type: 'admin', name: 'Harshill M Gowda', email: 'harshill@vvce.ac.in', pass: null, isDemo: true, clubName: 'CSE Club', clubEmail: 'cseclub@vvce.ac.in', domain: 'Technical', branch: 'CSE', usn: '4VV21CS045', faculty: 'Dr. Ramesh Kumar', phone: '+91 98765 43211', desc: 'Official Computer Science Club of VVCE', approved: true, notifs: [] },
  { id: 'u3', type: 'authority', name: 'Dr. Priya Nair', email: 'dean.sw@vvce.ac.in', pass: null, isDemo: true, designation: 'dean', dept: 'Student Welfare', phone: '+91 98765 43212', notifs: [] },
  { id: 'u4', type: 'authority', name: 'Prof. Vijay Rao', email: 'principal@vvce.ac.in', pass: null, isDemo: true, designation: 'principal', dept: 'Administration', phone: '+91 98765 43213', notifs: [] }
];

const SUPABASE_CACHE = {
  vvce_users: [],
  vvce_events: [],
  vvce_certs: [],
  vvce_academic: []
};


/* ─── Module: js/core/database.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Database Layer, Paginated Sync & Atomic Mutations
   Path: js/core/database.js
   ═══════════════════════════════════════════════════════════════ */

let APPROVING_AUTHORITIES_CACHE = [];
let _bootLastRunMs = 0;
let _bootInFlightPromise = null;
let _refreshLastRunMs = 0;

const SAFE_USER_BULK_COLUMNS = 'id,type,name,email,usn,branch,section,year,sem,admission_year,dept,phone,interests,skills,bio,linkedin,github,achievements,profile_photo,club_name,club_email,domain,faculty,approved,"desc",designation,authority_id,authority_name,approval_history';

function safeLocalStorageSet(key, valueObj) {
  try {
    localStorage.setItem(key, JSON.stringify(valueObj));
  } catch (e) {
    // Gracefully ignore QuotaExceededError when user count exceeds localStorage 5MB limit
    if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
      console.warn(`localStorage quota reached for ${key}; continuing with in-memory cache.`);
    }
  }
}

/* ============================================================================
   APPROVING AUTHORITIES & SECURITY HELPERS
   ============================================================================ */
async function hashPasswordWithSalt(password, saltStr) {
  const enc = new TextEncoder();
  const salt = enc.encode(saltStr || ('salt_' + Math.random().toString(36).substring(2, 10)));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return { hash: hashHex, salt: new TextDecoder().decode(salt) };
}

async function verifyPasswordWithSalt(password, storedHash, saltStr) {
  try {
    const { hash } = await hashPasswordWithSalt(password, saltStr);
    return hash === storedHash;
  } catch (e) {
    console.error('Password verification error:', e);
    return false;
  }
}

async function syncApprovingAuthoritiesFromSupabase() {
  const sb = getSupabaseClient();
  try {
    if (sb) {
      const { data, error } = await sb.from('approving_authorities').select('*').order('created_at', { ascending: true });
      if (!error && Array.isArray(data) && data.length > 0) {
        APPROVING_AUTHORITIES_CACHE = data;
        safeLocalStorageSet('vvce_approving_authorities', data);
        populateClubRegistrationAuthoritiesDropdown();
        return data;
      }
    }
  } catch (err) {
    console.warn('syncApprovingAuthoritiesFromSupabase warning:', err);
  }

  const raw = localStorage.getItem('vvce_approving_authorities');
  if (raw) {
    try {
      APPROVING_AUTHORITIES_CACHE = JSON.parse(raw);
    } catch (e) {
      APPROVING_AUTHORITIES_CACHE = [];
    }
  }

  if (!APPROVING_AUTHORITIES_CACHE.length) {
    APPROVING_AUTHORITIES_CACHE = [
      {
        id: 'auth_dean_sw',
        name: 'Dean Student Welfare',
        email: 'dean.sw@vvce.ac.in',
        designation: 'Dean Student Welfare',
        password_hash: 'b6fdb537e29bb3ff3ce1b00e66eb139a039750bca80ca60d69611894d3ec8595',
        salt: 'vvce_salt_dean_2026',
        active: true,
        created_at: new Date().toISOString()
      }
    ];
    safeLocalStorageSet('vvce_approving_authorities', APPROVING_AUTHORITIES_CACHE);
  }
  populateClubRegistrationAuthoritiesDropdown();
  return APPROVING_AUTHORITIES_CACHE;
}

function getActiveApprovingAuthorities() {
  return APPROVING_AUTHORITIES_CACHE.filter(a => a.active !== false);
}

function populateClubRegistrationAuthoritiesDropdown() {
  const sel = document.getElementById('a-authority');
  if (!sel) return;
  const active = getActiveApprovingAuthorities();
  if (!active.length) {
    sel.innerHTML = '<option value="">-- No Active Approving Authorities --</option>';
    return;
  }
  const currentVal = sel.value;
  const esc = typeof escapeHTML === 'function' ? escapeHTML : (s => String(s || ''));
  sel.innerHTML = '<option value="">-- Select Approving Authority --</option>' +
    active.map(a => `<option value="${esc(a.id)}">${esc(a.name)} (${esc(a.designation || 'Approving Authority')})</option>`).join('');
  if (currentVal && active.some(a => a.id === currentVal)) {
    sel.value = currentVal;
  }
}

/* Stores payment screenshots keyed by "eventId::uid" to avoid embedding base64 in onclick attrs */
const PENDING_SCREENSHOTS = {};

function getDB(key, def = []) {
  if (key === 'vvce_principal_status') {
    return getDBObj('vvce_principal_status', { text: "Available", note: "", updated: "Just now", color: "#48bb78", icon: "✅" });
  }
  if (SUPABASE_CACHE[key] && Array.isArray(SUPABASE_CACHE[key]) && SUPABASE_CACHE[key].length > 0) {
    return SUPABASE_CACHE[key];
  }
  try {
    const local = localStorage.getItem(key);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        SUPABASE_CACHE[key] = parsed;
        return parsed;
      }
    }
  } catch (e) {}
  if (key === 'vvce_users') {
    SUPABASE_CACHE['vvce_users'] = DEFAULT_USERS.slice();
    return SUPABASE_CACHE['vvce_users'];
  }
  return def;
}

function getDBObj(key, def = {}) {
  const cached = SUPABASE_CACHE[key];
  if (cached && typeof cached === 'object' && !Array.isArray(cached) && Object.keys(cached).length > 0) {
    return cached;
  }
  try {
    const local = localStorage.getItem(key);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        SUPABASE_CACHE[key] = parsed;
        return parsed;
      }
    }
  } catch (e) {}
  return def;
}

/* Paginated fetch helper: retrieves beyond PostgREST's 1,000-row cap safely */
async function fetchPaginatedTable(sb, table, columns = '*', { pageSize = 1000, maxRows = 10000, applyFilter = null } = {}) {
  const allRows = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    let query = sb.from(table).select(columns).range(offset, offset + pageSize - 1);
    if (typeof applyFilter === 'function') {
      query = applyFilter(query);
    }
    const { data, error } = await query;
    if (error) {
      return { data: allRows, error };
    }
    if (!Array.isArray(data) || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
  }
  return { data: allRows, error: null };
}

function mapEventForSupabase(e) {
  return {
    id: e.id,
    name: e.name,
    club: e.club,
    admin_id: e.adminId || e.admin_id,
    emoji: e.emoji || '🎓',
    category: e.category || 'Technical',
    date: e.date,
    time: e.time,
    end_date: e.endDate || e.end_date || e.date,
    end_time: (e.endTime || e.end_time || '').trim() || null,
    venue: e.venue,
    max_participants: e.maxParticipants ?? e.max_participants ?? 100,
    reg_count: e.regCount ?? e.reg_count ?? 0,
    fee: e.fee ?? 0,
    needs_payment: !!(e.needsPayment ?? e.needs_payment ?? (Number(e.fee || 0) > 0)),
    admin_upi_id: e.adminUpiId || e.admin_upi_id || '',
    points: e.points ?? null,
    desc: e.desc || '',
    speakers: e.speakers || '',
    rules: e.rules || '',
    branches: e.branches || ['All'],
    status: e.status || 'pending',
    rej_reason: e.rejReason || e.rej_reason || null,
    poster: e.poster || null,
    registrations: e.registrations || [],
    pending_payments: e.pendingPayments || e.pending_payments || [],
    attended_students: e.attendedStudents || e.attended_students || [],
    isTeamEvent: e.isTeamEvent ?? false,
    minTeamSize: e.minTeamSize ?? 1,
    maxTeamSize: e.maxTeamSize ?? 1,
    teams: e.teams || [],
    waitlist: e.waitlist || [],
    waitlist_enabled: e.waitlist_enabled ?? e.waitlistEnabled ?? false,
    publish_at: e.publish_at || e.publishAt || null,
    authority_id: e.authority_id || e.authorityId || null,
    authority_name: e.authority_name || e.authorityName || null,
    approved_by_authority_id: e.approved_by_authority_id || e.approvedByAuthorityId || null,
    approved_by_authority_name: e.approved_by_authority_name || e.approvedByAuthorityName || null,
    approved_at: e.approved_at || e.approvedAt || null,
    decision_history: e.decision_history || e.decisionHistory || []
  };
}

function mapUserForSupabase(u) {
  return {
    id: u.id,
    type: u.type,
    name: u.name,
    email: u.email,
    usn: u.usn,
    branch: u.branch,
    section: u.section,
    year: u.year,
    sem: u.sem,
    admission_year: u.admissionYear,
    dept: u.dept,
    phone: u.phone,
    interests: u.interests,
    skills: u.skills,
    bio: u.bio,
    linkedin: u.linkedin,
    github: u.github,
    achievements: u.achievements,
    profile_photo: u.profilePhoto,
    resume: u.resume,
    points: u.points ?? null,
    points_by_sem: u.pointsBySem ?? u.points_by_sem ?? null,
    notifs: u.notifs,
    club_name: u.clubName,
    club_email: u.clubEmail,
    domain: u.domain,
    faculty: u.faculty,
    approved: u.approved,
    "desc": u.desc,
    designation: u.designation,
    authority_id: u.authorityId || u.authority_id || null,
    authority_name: u.authorityName || u.authority_name || null,
    approval_history: u.approvalHistory || u.approval_history || []
  };
}

async function syncEventsFromSupabase() {
  const sb = getSupabaseClient();
  if (!sb) return getDB('vvce_events');
  try {
    const { data, error } = await fetchPaginatedTable(sb, 'events', '*', { pageSize: 500, maxRows: 5000 });
    if (!error && Array.isArray(data)) {
      const mapped = data.map(mapEvent);
      SUPABASE_CACHE.vvce_events = mapped;
      safeLocalStorageSet('vvce_events', mapped);
      return mapped;
    }
  } catch (e) {
    console.warn('syncEventsFromSupabase failed:', e);
  }
  return getDB('vvce_events');
}

/* Fetch current user's own notifications and private profile fields (excluded from bulk queries) */
async function fetchUserOwnDetails(userId) {
  const sb = getSupabaseClient();
  if (!sb || !userId || ['u1', 'u2', 'u3', 'u4'].includes(userId)) return null;
  try {
    const { data, error } = await sb
      .from('users')
      .select('id, notifs, resume')
      .eq('id', userId)
      .maybeSingle();
    if (!error && data) {
      if (STATE.user && STATE.user.id === userId) {
        STATE.user.notifs = Array.isArray(data.notifs) ? data.notifs : (STATE.user.notifs || []);
        STATE.user.resume = data.resume || STATE.user.resume || null;
      }
      const cacheIdx = (SUPABASE_CACHE.vvce_users || []).findIndex(u => u.id === userId);
      if (cacheIdx > -1) {
        SUPABASE_CACHE.vvce_users[cacheIdx].notifs = data.notifs || [];
        SUPABASE_CACHE.vvce_users[cacheIdx].resume = data.resume || null;
      }
      if (typeof renderNotifs === 'function') {
        const unread = (STATE.user?.notifs || []).filter(n => !n.read).length;
        const badge = document.getElementById('notif-badge');
        if (badge) { badge.style.display = unread > 0 ? '' : 'none'; badge.textContent = unread; }
      }
      return data;
    }
  } catch (e) {
    console.warn('fetchUserOwnDetails warning:', e);
  }
  return null;
}

/* Atomic single-row notification push (avoids O(N) setDB('vvce_users', all6000Users)) */
async function pushUserNotifAtomic(userId, notifObj) {
  if (!userId || !notifObj) return;
  const users = getDB('vvce_users');
  const u = users.find(x => x.id === userId);
  if (u) {
    if (!Array.isArray(u.notifs)) u.notifs = [];
    u.notifs = [...u.notifs, notifObj].slice(-50);
    SUPABASE_CACHE.vvce_users = users;
    safeLocalStorageSet('vvce_users', users);
  }

  const sb = getSupabaseClient();
  if (!sb || ['u1', 'u2', 'u3', 'u4'].includes(userId)) return;

  try {
    if (typeof sb.rpc === 'function') {
      const { error: rpcErr } = await sb.rpc('push_user_notif', {
        p_user_id: userId,
        p_notif: notifObj
      });
      if (!rpcErr) return;
    }
    const { data: row } = await sb.from('users').select('notifs').eq('id', userId).maybeSingle();
    const merged = [...(Array.isArray(row?.notifs) ? row.notifs : []), notifObj].slice(-50);
    await sb.from('users').update({ notifs: merged }).eq('id', userId);
  } catch (e) {
    console.warn('pushUserNotifAtomic warning:', e);
  }
}

/* Atomic single-row read/mark-all-read update */
async function markUserNotifsReadAtomic(userId, notifId = null) {
  if (!userId) return;
  const users = getDB('vvce_users');
  const u = users.find(x => x.id === userId);
  if (u && Array.isArray(u.notifs)) {
    u.notifs.forEach(n => {
      if (!notifId || n.id === notifId) n.read = true;
    });
    SUPABASE_CACHE.vvce_users = users;
    safeLocalStorageSet('vvce_users', users);
  }

  const sb = getSupabaseClient();
  if (!sb || ['u1', 'u2', 'u3', 'u4'].includes(userId)) return;

  try {
    if (typeof sb.rpc === 'function') {
      const { error: rpcErr } = await sb.rpc('mark_notif_read', {
        p_user_id: userId,
        p_notif_id: notifId
      });
      if (!rpcErr) return;
    }
    if (u && Array.isArray(u.notifs)) {
      await sb.from('users').update({ notifs: u.notifs }).eq('id', userId);
    }
  } catch (e) {
    console.warn('markUserNotifsReadAtomic warning:', e);
  }
}

/* Single-row profile / user field update (no 6,000-user full-table write) */
async function updateSingleUserRow(userId, camelUpdates) {
  if (!userId) return;
  const users = getDB('vvce_users');
  const idx = users.findIndex(u => u.id === userId);
  if (idx > -1) {
    Object.assign(users[idx], camelUpdates);
    SUPABASE_CACHE.vvce_users = users;
    safeLocalStorageSet('vvce_users', users);
    if (STATE.user && STATE.user.id === userId) {
      STATE.user = users[idx];
    }
  }

  const sb = getSupabaseClient();
  if (!sb || typeof sb.from !== 'function' || ['u1', 'u2', 'u3', 'u4'].includes(userId)) return;

  const dbPatch = {};
  const colMap = {
    name: 'name', email: 'email', usn: 'usn', branch: 'branch', section: 'section',
    year: 'year', sem: 'sem', dept: 'dept', phone: 'phone', interests: 'interests',
    skills: 'skills', bio: 'bio', linkedin: 'linkedin', github: 'github',
    achievements: 'achievements', profilePhoto: 'profile_photo', resume: 'resume',
    clubName: 'club_name', clubEmail: 'club_email', domain: 'domain', faculty: 'faculty',
    approved: 'approved', desc: 'desc', designation: 'designation',
    approvalHistory: 'approval_history', rejectionReason: 'rejection_reason'
  };
  Object.entries(camelUpdates || {}).forEach(([k, v]) => {
    if (colMap[k]) dbPatch[colMap[k]] = v;
  });

  if (Object.keys(dbPatch).length > 0) {
    try {
      await sb.from('users').update(dbPatch).eq('id', userId);
    } catch (e) {
      console.warn('updateSingleUserRow warning:', e);
    }
  }
}

/* Single certificate upsert / delete (avoids DELETE NOT IN 414 URI Too Long) */
async function syncSingleCertToSupabase(cert, remove = false) {
  const sb = getSupabaseClient();
  if (!sb || typeof sb.from !== 'function' || !cert?.id) return;
  try {
    if (remove) {
      await sb.from('vvce_certs').delete().eq('id', cert.id);
    } else {
      await sb.from('vvce_certs').upsert([{
        id: cert.id,
        "userId": cert.userId,
        title: cert.title,
        issuer: cert.issuer,
        date: cert.date,
        position: cert.position,
        points: cert.points ?? null,
        type: cert.type,
        verified: cert.verified,
        auto_generated: cert.autoGenerated || false,
        event_id: cert.eventId || null
      }]);
    }
  } catch (e) {
    console.warn('syncSingleCertToSupabase warning:', e);
  }
}

async function setDB(key, val) {
  SUPABASE_CACHE[key] = val;
  safeLocalStorageSet(key, val);

  const sb = getSupabaseClient();
  if (!sb || typeof sb.from !== 'function') return;

  try {
    if (key === 'vvce_events') {
      const mapped = val.map(mapEventForSupabase);
      const { error } = await sb.from('events').upsert(mapped);
      if (error) {
        if (/needs_payment|column|schema/i.test(error.message || '')) {
          const fallbackMapped = mapped.map(({ needs_payment, ...rest }) => rest);
          const { error: fbErr } = await sb.from('events').upsert(fallbackMapped);
          if (fbErr) console.warn('Events upsert warning:', fbErr.message);
        } else {
          console.warn('Events upsert warning:', error.message);
        }
      }
    } else if (key === 'vvce_users') {
      // Never mass-upsert 6,000 users from client; batch only non-demo rows cleanly if called
      const DEMO_IDS = ['u1', 'u2', 'u3', 'u4'];
      const realUsers = val.filter(u => !DEMO_IDS.includes(u.id)).map(mapUserForSupabase);
      const chunkSize = 200;
      for (let i = 0; i < realUsers.length; i += chunkSize) {
        await sb.from('users').upsert(realUsers.slice(i, i + chunkSize));
      }
    } else if (key === 'vvce_certs') {
      // Never use DELETE ... NOT IN (...) (causes 414 URI Too Long and cross-user overwrites)
      const mapped = val.map(c => ({
        id: c.id,
        "userId": c.userId,
        title: c.title,
        issuer: c.issuer,
        date: c.date,
        position: c.position,
        points: c.points ?? null,
        type: c.type,
        verified: c.verified,
        auto_generated: c.autoGenerated || false,
        event_id: c.eventId || null
      }));
      if (mapped.length > 0) {
        await sb.from('vvce_certs').upsert(mapped);
      }
    } else if (key === 'vvce_academic') {
      const mapped = val.map(a => ({ id: a.id, date: a.date, type: a.type, "desc": a.desc }));
      await sb.from('academic').upsert(mapped);
    } else if (key === 'vvce_principal_status') {
      const mapped = { id: 'status', text: val.text, note: val.note, updated: val.updated, color: val.color, icon: val.icon };
      await sb.from('principal_status').upsert([mapped]);
    } else if (key === 'vvce_principal_schedule') {
      const mapped = val.map(s => ({ id: s.id, date: s.date, start_time: s.startTime, end_time: s.endTime, title: s.title, "desc": s.desc }));
      await sb.from('principal_schedules').delete().neq('id', '0');
      if (mapped.length > 0) await sb.from('principal_schedules').insert(mapped);
    } else if (key === 'vvce_princ_attend') {
      const mapped = val.map(id => ({ event_id: id }));
      await sb.from('princ_attend').delete().neq('event_id', '0');
      if (mapped.length > 0) await sb.from('princ_attend').insert(mapped);
    }
  } catch (err) {
    console.error('Failed to sync to Supabase:', err);
  }
}

/* Branch Matching Helper */
function getCanonicalBranch(branch) {
  if (!branch) return '';
  const b = String(branch).toUpperCase().replace(/[^A-Z0-9/]/g, '').trim();
  if (b === 'ALL') return 'ALL';
  if (b.includes('AIML') || b.includes('AI') || b.includes('ML')) return 'CSE/AIML';
  if (b === 'CS' || b === 'CSE' || b.includes('COMPUTERSCIENCE') || b.includes('COMPUTER')) return 'CSE';
  if (b === 'IS' || b === 'ISE' || b.includes('INFORMATION')) return 'ISE';
  if (b === 'EC' || b === 'ECE' || b.includes('ELECTRONICS')) return 'ECE';
  if (b === 'EE' || b === 'EEE' || b.includes('ELECTRICAL')) return 'EEE';
  if (b === 'ME' || b === 'MECH' || b.includes('MECHANICAL')) return 'ME';
  if (b === 'CV' || b === 'CIVIL') return 'CV';
  return b;
}

function isBranchMatch(eventBranches, userBranch) {
  if (!eventBranches || !eventBranches.length) return true;
  const userCanon = getCanonicalBranch(userBranch);
  if (!userCanon) return true;

  return eventBranches.some(eb => {
    const evCanon = getCanonicalBranch(eb);
    if (evCanon === 'ALL') return true;
    return evCanon === userCanon;
  });
}

/* Mappers (never hydrate or expose password columns into general cache) */
function mapUser(u) {
  return {
    id: u.id,
    type: u.type,
    name: u.name,
    email: u.email,
    usn: u.usn,
    branch: u.branch,
    section: u.section,
    year: u.year,
    sem: u.sem,
    admissionYear: u.admission_year,
    dept: u.dept,
    phone: u.phone,
    interests: u.interests,
    skills: u.skills,
    bio: u.bio,
    linkedin: u.linkedin,
    github: u.github,
    achievements: u.achievements,
    profilePhoto: u.profile_photo,
    resume: u.resume || null,
    points: u.points ?? null,
    pointsBySem: u.points_by_sem ?? null,
    notifs: u.notifs || [],
    clubName: u.club_name,
    clubEmail: u.club_email,
    domain: u.domain,
    faculty: u.faculty,
    approved: u.approved,
    desc: u.desc,
    designation: u.designation,
    googleId: u.google_id || u.googleId || null,
    authorityId: u.authority_id || u.authorityId || null,
    authorityName: u.authority_name || u.authorityName || null,
    approvalHistory: u.approval_history || u.approvalHistory || []
  };
}

function mapEvent(e) {
  return {
    id: e.id, name: e.name, club: e.club, adminId: e.admin_id, emoji: e.emoji, category: e.category, date: e.date, time: e.time, endDate: e.end_date, endTime: e.end_time || e.endTime || '', venue: e.venue, maxParticipants: e.max_participants, regCount: e.reg_count, fee: e.fee, needsPayment: Boolean(e.needs_payment ?? e.needsPayment ?? (Number(e.fee || 0) > 0)), adminUpiId: e.admin_upi_id || '', points: e.points ?? null, desc: e.desc, speakers: e.speakers || '', rules: e.rules || '', branches: e.branches, status: e.status, rejReason: e.rej_reason, poster: e.poster, registrations: e.registrations || [], pendingPayments: e.pending_payments || [], attendedStudents: e.attended_students || [],
    isTeamEvent: e.isTeamEvent ?? e.is_team_event ?? e.isteamevent ?? false,
    minTeamSize: e.minTeamSize ?? e.min_team_size ?? e.minteamsize ?? 1,
    maxTeamSize: e.maxTeamSize ?? e.max_team_size ?? e.maxteamsize ?? 1,
    teams: e.teams || [],
    waitlist: e.waitlist || [],
    waitlist_enabled: e.waitlist_enabled ?? e.waitlistEnabled ?? false,
    publish_at: e.publish_at || e.publishAt || null,
    authorityId: e.authority_id || e.authorityId || null,
    authorityName: e.authority_name || e.authorityName || null,
    approvedByAuthorityId: e.approved_by_authority_id || e.approvedByAuthorityId || null,
    approvedByAuthorityName: e.approved_by_authority_name || e.approvedByAuthorityName || null,
    approvedAt: e.approved_at || e.approvedAt || null,
    decisionHistory: e.decision_history || e.decisionHistory || []
  };
}

function mapCert(c) {
  return {
    id: c.id, userId: c.userId, title: c.title, issuer: c.issuer, date: c.date, position: c.position, points: c.points ?? null, type: c.type, verified: c.verified, autoGenerated: c.auto_generated || false, eventId: c.event_id || null
  };
}

function mapAcademic(a) {
  return { id: a.id, date: a.date, type: a.type, desc: a.desc };
}

function mapPrincipalStatus(s) {
  if (!s) return { text: "Available", note: "", updated: "Just now", color: "#48bb78", icon: "✅" };
  return {
    text: s.text || 'Available',
    note: (s.note === 'undefined' || !s.note) ? '' : s.note,
    updated: s.updated || 'Just now',
    color: s.color || '#48bb78',
    icon: s.icon || '✅'
  };
}

function mapPrincipalSchedule(s) {
  return { id: s.id, date: s.date, startTime: s.start_time, endTime: s.end_time, title: s.title, desc: s.desc };
}

let _rtRenderDebounce = null;
function handleRealtimeUpdate(key, payload) {
  const { eventType, new: newRecord, old: oldRecord } = payload;
  const cache = SUPABASE_CACHE[key] || [];

  if (key === 'vvce_principal_status') {
    SUPABASE_CACHE.vvce_principal_status = eventType === 'DELETE'
      ? { text: "Available", note: "", updated: "Just now", color: "#48bb78", icon: "✅" }
      : mapPrincipalStatus(newRecord);
    safeLocalStorageSet('vvce_principal_status', SUPABASE_CACHE.vvce_principal_status);
  } else if (key === 'vvce_princ_attend') {
    if (eventType === 'INSERT' && !SUPABASE_CACHE.vvce_princ_attend.includes(newRecord.event_id)) {
      SUPABASE_CACHE.vvce_princ_attend.push(newRecord.event_id);
    } else if (eventType === 'DELETE') {
      SUPABASE_CACHE.vvce_princ_attend = SUPABASE_CACHE.vvce_princ_attend.filter(id => id !== oldRecord.event_id);
    }
  } else {
    const mapper = {
      vvce_users: mapUser,
      vvce_events: mapEvent,
      vvce_certs: mapCert,
      vvce_academic: mapAcademic,
      vvce_principal_schedule: mapPrincipalSchedule
    }[key];

    if (eventType === 'DELETE') {
      SUPABASE_CACHE[key] = cache.filter(item => item.id !== oldRecord.id);
    } else if (eventType === 'INSERT') {
      if (!cache.some(item => item.id === newRecord.id) && mapper) {
        cache.push(mapper(newRecord));
      }
    } else if (eventType === 'UPDATE') {
      if (key === 'vvce_events' && newRecord.status === 'archived') {
        SUPABASE_CACHE[key] = cache.filter(item => item.id !== newRecord.id);
      } else {
        const idx = cache.findIndex(item => item.id === newRecord.id);
        if (idx !== -1 && mapper) cache[idx] = mapper(newRecord);
        else if (mapper) cache.push(mapper(newRecord));
      }
    }
    safeLocalStorageSet(key, SUPABASE_CACHE[key]);
  }

  if (STATE.user) {
    const updatedUser = (SUPABASE_CACHE.vvce_users || []).find(u => u.id === STATE.user.id);
    if (updatedUser) {
      if (STATE.user.type === 'admin' && STATE.user.approved && !updatedUser.approved) {
        STATE.user = null;
        STATE.deanUnlocked = false;
        STATE.principalUnlocked = false;
        document.getElementById('app').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
        document.body.style.background = '#1a2235';
        toast('Your club access has been revoked by your Approving Authority.', 'warning');
        return;
      }
      STATE.user = updatedUser;
    }
  }

  // Debounce UI refreshes during bursts
  const activeTag = document.activeElement ? document.activeElement.tagName : '';
  const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';
  if (!isTyping && STATE.page) {
    clearTimeout(_rtRenderDebounce);
    _rtRenderDebounce = setTimeout(() => {
      if (STATE.page === 'participants' && typeof renderParticipantTable === 'function') {
        renderParticipantTable();
      } else if ((STATE.page === 'authority-portal' || STATE.page === 'dean-portal') && STATE.authorityUnlocked) {
        renderAuthorityPortal();
      } else if (STATE.page) {
        showPage(STATE.page);
      }
    }, 180);
  }
}

let realtimeChannel = null;
let _realtimeScopedUserId = null;

/* Scope Supabase Realtime cleanly so 5,000+ browsers don't subscribe to global users broadcasts */
function setupRealtimeSync(forceResubscribe = false) {
  const sb = getSupabaseClient();
  if (!sb || typeof sb.channel !== 'function') return;

  const targetUid = STATE.user?.id && !['u1', 'u2', 'u3', 'u4'].includes(STATE.user.id) ? STATE.user.id : null;
  if (realtimeChannel && !forceResubscribe && _realtimeScopedUserId === targetUid) return;

  if (realtimeChannel) {
    try { sb.removeChannel(realtimeChannel); } catch (e) {}
    realtimeChannel = null;
  }
  _realtimeScopedUserId = targetUid;

  const ch = sb.channel('vvce-hub-scoped')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, payload => {
      handleRealtimeUpdate('vvce_events', payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'academic' }, payload => {
      handleRealtimeUpdate('vvce_academic', payload);
    });

  if (targetUid) {
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${targetUid}` }, payload => {
      handleRealtimeUpdate('vvce_users', payload);
    });
    if (STATE.user?.type === 'student') {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'vvce_certs', filter: `userId=eq.${targetUid}` }, payload => {
        handleRealtimeUpdate('vvce_certs', payload);
      });
    } else {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'vvce_certs' }, payload => {
        handleRealtimeUpdate('vvce_certs', payload);
      });
    }
  }

  realtimeChannel = ch.subscribe();
}

/* Lightweight foreground refresh when switching tabs back to active session */
async function refreshActivePortalState() {
  const now = Date.now();
  if (now - _refreshLastRunMs < 30000) return; // 30s cooldown prevents tab-switch DB storms
  _refreshLastRunMs = now;

  if (!STATE.user) {
    await checkSupabaseEmailVerification();
    return;
  }

  await syncEventsFromSupabase();
  await fetchUserOwnDetails(STATE.user.id);
  if (STATE.page && !document.activeElement?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) {
    if (STATE.page === 'participants' && typeof renderParticipantTable === 'function') {
      renderParticipantTable();
    } else {
      showPage(STATE.page);
    }
  }
}

async function bootApp(force = false) {
  const sb = getSupabaseClient();
  if (!sb || typeof sb.from !== 'function') {
    console.warn('Supabase client not ready yet, working in local mode.');
    return;
  }

  if (_bootInFlightPromise) return _bootInFlightPromise;
  const now = Date.now();
  if (!force && _bootLastRunMs > 0 && (now - _bootLastRunMs < 45000)) {
    return;
  }

  _bootInFlightPromise = (async () => {
    _bootLastRunMs = Date.now();
    await checkSupabaseEmailVerification();
    checkTeamInviteUrl();

    try {
      const certsPromise = (STATE.user?.type === 'student')
        ? fetchPaginatedTable(sb, 'vvce_certs', '*', { applyFilter: q => q.eq('userId', STATE.user.id) })
        : fetchPaginatedTable(sb, 'vvce_certs', '*', { pageSize: 1000, maxRows: 5000 });

      const [uRes, eRes, cRes, aRes, psRes, pscRes, paRes] = await Promise.all([
        fetchPaginatedTable(sb, 'users', SAFE_USER_BULK_COLUMNS, { pageSize: 1000, maxRows: 10000 }),
        fetchPaginatedTable(sb, 'events', '*', { pageSize: 500, maxRows: 5000 }),
        certsPromise,
        sb.from('academic').select('*'),
        sb.from('principal_status').select('*'),
        sb.from('principal_schedules').select('*'),
        sb.from('princ_attend').select('*')
      ]);

      // Fallback without SAFE_USER_BULK_COLUMNS if any optional column doesn't exist yet
      let rawUsers = uRes?.data || [];
      if (uRes?.error) {
        const fbUsers = await fetchPaginatedTable(sb, 'users', 'id,type,name,email,usn,branch,section,year,sem,admission_year,dept,phone,interests,skills,bio,linkedin,github,achievements,profile_photo,club_name,club_email,domain,faculty,approved,"desc",designation,authority_id,authority_name,approval_history', { pageSize: 1000, maxRows: 10000 });
        rawUsers = fbUsers.data || [];
      }

      if (rawUsers.length > 0) {
        const DEMO_IDS = ['u1', 'u2', 'u3', 'u4'];
        const remoteUsers = rawUsers.map(mapUser);
        const remoteEmails = new Set(remoteUsers.map(u => (u.email || '').toLowerCase()));
        const demoUsers = DEFAULT_USERS.filter(du => DEMO_IDS.includes(du.id) && !remoteEmails.has(du.email.toLowerCase()));

        // Preserve current user's loaded private fields (notifs/resume) across boot refreshes
        if (STATE.user) {
          const curIdx = remoteUsers.findIndex(u => u.id === STATE.user.id);
          if (curIdx > -1) {
            remoteUsers[curIdx].notifs = STATE.user.notifs || [];
            remoteUsers[curIdx].resume = STATE.user.resume || null;
          }
        }

        const finalUsers = [...remoteUsers, ...demoUsers];
        SUPABASE_CACHE.vvce_users = finalUsers;
        safeLocalStorageSet('vvce_users', finalUsers);
      }

      if (eRes && eRes.data) {
        SUPABASE_CACHE.vvce_events = eRes.data.map(mapEvent);
        safeLocalStorageSet('vvce_events', SUPABASE_CACHE.vvce_events);
      }
      if (cRes && cRes.data && cRes.data.length > 0) {
        SUPABASE_CACHE.vvce_certs = cRes.data.map(mapCert);
        safeLocalStorageSet('vvce_certs', SUPABASE_CACHE.vvce_certs);
      }
      if (aRes && aRes.data && aRes.data.length > 0) {
        SUPABASE_CACHE.vvce_academic = aRes.data.map(a => ({ id: a.id, date: a.date, type: a.type, desc: a.desc }));
        safeLocalStorageSet('vvce_academic', SUPABASE_CACHE.vvce_academic);
      }
      if (psRes && psRes.data && psRes.data.length > 0) {
        SUPABASE_CACHE.vvce_principal_status = mapPrincipalStatus(psRes.data[0]);
        safeLocalStorageSet('vvce_principal_status', SUPABASE_CACHE.vvce_principal_status);
      } else {
        SUPABASE_CACHE.vvce_principal_status = { text: "Available", note: "", updated: "Just now", color: "#48bb78", icon: "✅" };
      }
      SUPABASE_CACHE.vvce_principal_schedule = (pscRes && pscRes.data)
        ? pscRes.data.map(s => ({ id: s.id, date: s.date, startTime: s.start_time, endTime: s.end_time, title: s.title, desc: s.desc }))
        : [];
      SUPABASE_CACHE.vvce_princ_attend = (paRes && paRes.data) ? paRes.data.map(r => r.event_id) : [];

      if (STATE.user?.id) {
        await fetchUserOwnDetails(STATE.user.id);
      }
      setupRealtimeSync();
      checkTeamInviteUrl();

      if (STATE.page && !document.activeElement?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) {
        if (STATE.page === 'participants' && typeof renderParticipantTable === 'function') {
          renderParticipantTable();
        } else {
          showPage(STATE.page);
        }
      }
    } catch (err) {
      console.error('Failed to load from Supabase:', err);
    }
  })().finally(() => {
    _bootInFlightPromise = null;
  });

  return _bootInFlightPromise;
}


/* ─── Module: js/core/utils.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Utility Functions, Modals, Toasts & Clash Detectors
   Path: js/core/utils.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   UTILITY FUNCTIONS
───────────────────────────────────────────────────────────────*/
function genId(prefix = 'id') { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function sanitizeUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^(javascript|vbscript):/i.test(raw)) return '';
  if (/^data:/i.test(raw) && !/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(raw)) return '';
  return raw;
}
function titleCase(str) { if (!str) return ''; return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()); }
function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(t) {
  if (!t) return '';
  const mins = parseTimeToMinutes(t); if (mins === null) return String(t); const h = Math.floor(mins / 60), m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning'; if (h < 17) return 'afternoon'; return 'evening';
}
function avatar(name) { return name ? name.trim()[0].toUpperCase() : '?'; }

/* Parse "HH:MM", "HH:MM:SS", or "10:00 AM" into minutes from midnight (0..1439) */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const raw = String(timeStr).trim();
  if (!raw) return null;

  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const meridiem = ampmMatch[3].toUpperCase();
    if (h < 1 || h > 12 || m < 0 || m > 59) return null;
    if (meridiem === 'AM' && h === 12) h = 0;
    else if (meridiem === 'PM' && h !== 12) h += 12;
    return h * 60 + m;
  }

  const h24Match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (h24Match) {
    const h = parseInt(h24Match[1], 10);
    const m = parseInt(h24Match[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  return null;
}

/* Compute [start, end) minute interval; legacy events without end_time default to +2h block */
function getEventTimeRangeMinutes(ev) {
  const start = parseTimeToMinutes(ev?.time || ev?.startTime || ev?.start_time);
  if (start === null) {
    return { start: 0, end: 1440, estimated: true };
  }
  const parsedEnd = parseTimeToMinutes(ev?.endTime || ev?.end_time);
  if (parsedEnd !== null && parsedEnd > start) {
    return { start, end: parsedEnd, estimated: false };
  }
  return { start, end: Math.min(1440, start + 120), estimated: true };
}

function formatEventTimeSlot(ev) {
  const startStr = ev?.time || ev?.startTime || ev?.start_time;
  const endStr = ev?.endTime || ev?.end_time;
  if (!startStr) return 'Time TBA';
  if (endStr && parseTimeToMinutes(endStr) !== null) {
    return `${formatTime(startStr)} – ${formatTime(endStr)}`;
  }
  const range = getEventTimeRangeMinutes(ev);
  const estH = String(Math.floor(range.end / 60)).padStart(2, '0');
  const estM = String(range.end % 60).padStart(2, '0');
  return `${formatTime(startStr)} – ${formatTime(`${estH}:${estM}`)} (est.)`;
}

const SLOT_BLOCKING_STATUSES = ['approved', 'pending', 'scheduled', 'rescheduled'];

function isSlotBlockingEvent(ev, allowedStatuses = SLOT_BLOCKING_STATUSES) {
  const st = String(ev?.status || '').trim().toLowerCase();
  return allowedStatuses.includes(st);
}

/* True iff two events share Date + Venue and have overlapping [start, end) time intervals */
function doEventSlotsOverlap(eventA, eventB, opts = {}) {
  if (!eventA || !eventB) return false;
  if (eventA.id && eventB.id && String(eventA.id) === String(eventB.id)) return false;

  const allowed = opts.allowedStatuses || SLOT_BLOCKING_STATUSES;
  if (!isSlotBlockingEvent(eventB, allowed)) return false;

  const dateA = String(eventA.date || '').trim();
  const dateB = String(eventB.date || '').trim();
  if (!dateA || !dateB || dateA !== dateB) return false;

  const venueA = String(eventA.venue || '').trim().toLowerCase();
  const venueB = String(eventB.venue || '').trim().toLowerCase();
  if (!venueA || !venueB || venueA !== venueB) return false;

  const rA = getEventTimeRangeMinutes(eventA);
  const rB = getEventTimeRangeMinutes(eventB);
  return rA.start < rB.end && rA.end > rB.start;
}

/**
 * Computes the student's current Year and Semester automatically
 * based on their admission year (stored as admissionYear).
 * Academic year starts in September each year.
 * Sept–Feb = Odd sem, Mar–Aug = Even sem.
 */
function computeStudentYearSem(user, dateStr = null) {
  if (!user.admissionYear) {
    // Fallback if no admissionYear stored (legacy data)
    return { year: user.year || '—', sem: user.sem || '—' };
  }
  const now = dateStr ? new Date(dateStr) : new Date();
  const currentMonth = now.getMonth() + 1; // 1–12
  const currentYear  = now.getFullYear();

  // Academic year starts in September (month 9).
  // Sept–Feb = Odd semester (1st half), Mar–Aug = Even semester (2nd half).
  const academicYear = currentMonth >= 9 ? currentYear : currentYear - 1;
  const yearsElapsed = academicYear - user.admissionYear;
  
  // Constrain to 1st-4th year. If date is earlier than admission, fallback to 1.
  const studyYear = Math.max(1, Math.min(yearsElapsed + 1, 4)); // 1–4

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
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('open');
    el.style.display = 'flex';
  }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
    el.style.display = 'none';
  }
}


/* ─── Module: js/core/router.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — App Routing, Navigation, Sidebar & Topbar Notifications
   Path: js/core/router.js
   ═══════════════════════════════════════════════════════════════ */

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
  checkTeamInviteUrl();
  if (typeof fetchUserOwnDetails === 'function') fetchUserOwnDetails(user.id);
  if (typeof setupRealtimeSync === 'function') setupRealtimeSync(true);

  if (user.type === 'student') {
    showPage('dashboard');
  } else if (user.type === 'admin') {
    showPage('admin-dashboard');
  } else if (user.type === 'authority') {
    // If authority is already unlocked, land directly on authority-portal
    if (STATE.authorityUnlocked && STATE.currentAuthorityId) {
      showPage('authority-portal');
    } else {
      showPage('authority-dashboard');
    }
  } else {
    showPage('dashboard');
  }
}

function logout() {
  if (!confirm('Sign out of VVCE Events Hub?')) return;
  try {
    sessionStorage.removeItem('vvce_oauth_flow');
    const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (sb && sb.auth) sb.auth.signOut().catch(() => {});
  } catch (e) {}
  STATE.user = null;
  STATE.deanUnlocked = false;
  STATE.principalUnlocked = false;
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  if (!window.currentTheme || !window.currentTheme.bannerUrl) {
    document.body.style.backgroundColor = '#1a2235';
  }
  // Reset login fields
  const le = document.getElementById('login-email'); if (le) le.value = '';
  const lp = document.getElementById('login-pass');  if (lp) lp.value = '';
  clearAuthMsg();
}

function showPage(pageId) {
  if (STATE.user?.type === 'admin' && pageId === 'authority-clash') { pageId = 'create-event'; }
  const prev = STATE.page;
  STATE.prevPage = prev;
  STATE.page = pageId;

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + pageId);
  if (el) { el.classList.add('active'); el.scrollTop = 0; }

  // Auto-close sidebar on mobile when navigating
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
  }

  // Update topbar title
  const titles = {
    'dashboard': 'Dashboard',
    'events': 'Events',
    'clubs': 'VVCE Clubs Directory',
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
    'authority-portal': 'Approving Authority Portal',
    'dean-portal': 'Approving Authority Portal',
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
    'clubs':                () => renderClubsDirectoryPage(),
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
    'authority-portal':     () => renderAuthorityPortal(),
    'dean-portal':          () => renderAuthorityPortal(),
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
      sbAv.innerHTML = `<img src="${sanitizeUrl(user.profilePhoto)}" alt="avatar">`;
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
    authority: STATE.authorityUnlocked && STATE.currentAuthorityName ? STATE.currentAuthorityName : (titleCase(user.designation) || 'Approving Authority'),
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
      ${navItem('events','🗓️','All Events')}
      ${navItem('clubs','🏛️','Clubs')}
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
      ${navItem('events','🗓️','All Events')}
      ${navItem('clubs','🏛️','Clubs')}
      ${navItem('create-event','➕','Create Event')}
      ${navItem('manage-events','📋','My Events')}
      ${navItem('participants','👥','Participants')}

      <div class="sb-section-label">Account</div>
      ${navItem('profile','👤','Profile')}
    `;
  } else { // authority (Faculty / Approving Authority)
    const isUnlocked = STATE.authorityUnlocked;
    const currentAuthName = STATE.currentAuthorityName || 'Select Authority';

    // Count pending events assigned to currently unlocked authority
    const allPending = getDB('vvce_events').filter(e => e.status === 'pending');
    const myPending = isUnlocked && STATE.currentAuthorityId
      ? allPending.filter(e => !e.authorityId || e.authorityId === STATE.currentAuthorityId)
      : allPending;
    const pendingBadge = myPending.length > 0 ? String(myPending.length) : '';

    html = `
      <div class="sb-section-label">Faculty Navigation</div>
      ${navItem('authority-dashboard','📊','Dashboard')}
      ${navItem('events','📅','All Events')}
      ${navItem('clubs','👥','Clubs Directory')}
      ${navItem('authority-clubs','🏛️','Club Activity Monitor')}
      ${navItem('authority-clash','⚡','Clash Detect')}
      ${navItem('authority-attendance','📋','Attendance')}

      <div class="sb-section-label">Approving Authority</div>
      <div class="nav-item dean-item ${STATE.page==='authority-portal'?'active':''}" data-page="authority-portal" onclick="handleAuthoritySectionNav()">
        <span class="nav-icon">🔐</span>
        <div style="display:flex; flex-direction:column; line-height:1.2; overflow:hidden;">
          <span class="nav-label" style="font-size:12.5px;">Approving Authority</span>
          <span style="font-size:10px; color:${isUnlocked?'#86efac':'#cbd5e1'}; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">
            ${isUnlocked ? '✓ ' + escapeHTML(currentAuthName) : 'Login Required'}
          </span>
        </div>
        ${isUnlocked && pendingBadge ? `<span class="portal-tab-badge" style="margin-left:auto;margin-right:6px;">${escapeHTML(pendingBadge)}</span>` : ''}
        <span class="portal-pill portal-pill-dean">${isUnlocked ? 'ACTIVE' : 'LOCK'}</span>
      </div>
    `;
  }

  nav.innerHTML = html;
}

function navItem(page, icon, label, badge = '') {
  const isActive = STATE.page === page ? 'active' : '';
  const bdg = badge ? `<span class="nav-count">${escapeHTML(badge)}</span>` : '';
  return `<div class="nav-item ${isActive}" data-page="${escapeHTML(page)}" onclick="showPage('${escapeHTML(page)}')">
    <span class="nav-icon">${escapeHTML(icon)}</span>
    <span class="nav-label">${escapeHTML(label)}</span>${bdg}
  </div>`;
}

function renderTopbarUser() {
  const user = STATE.user;
  const av = document.getElementById('topbar-avatar');
  if (!av) return;
  if (user.profilePhoto) { av.innerHTML = `<img src="${sanitizeUrl(user.profilePhoto)}">`; }
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
    <div class="notif-item ${n.read?'':'unread'}" onclick="readNotif('${escapeHTML(n.id)}')">
      <span class="notif-item-icon">${escapeHTML(n.icon || '🔔')}</span>
        <div style="flex:1">
          <div class="notif-item-text">${escapeHTML(n.msg)}</div>
          <div class="notif-item-time">${escapeHTML(getRelativeTime(n.timestamp, n.time))}</div>
        </div>
      ${!n.read ? '<span class="notif-item-dot"></span>' : ''}
    </div>
  `).join('');
}

async function readNotif(id) {
  if (!STATE.user) return;
  const users = getDB('vvce_users');
  const u = users.find(x => x.id === STATE.user.id);
  const notifs = (u?.notifs || STATE.user.notifs || []).map(n => n.id === id ? { ...n, read: true } : n);
  if (u) u.notifs = notifs;
  STATE.user.notifs = notifs;
  renderNotifs();
  if (typeof markUserNotifsReadAtomic === 'function') {
    await markUserNotifsReadAtomic(STATE.user.id, id);
  }
}

async function markAllRead() {
  if (!STATE.user) return;
  const users = getDB('vvce_users');
  const u = users.find(x => x.id === STATE.user.id);
  const notifs = (u?.notifs || STATE.user.notifs || []).map(n => ({ ...n, read: true }));
  if (u) u.notifs = notifs;
  STATE.user.notifs = notifs;
  renderNotifs();
  if (typeof markUserNotifsReadAtomic === 'function') {
    await markUserNotifsReadAtomic(STATE.user.id, null);
  }
}

function addNotif(msg, icon = '🔔') {
  if (!STATE.user) return;
  addNotifToUser(STATE.user.id, msg, icon);
}

function addNotifToUser(userId, msg, icon = '🔔') {
  const notifObj = { id: genId('n'), msg, icon, time: 'Just now', timestamp: Date.now(), read: false };
  if (typeof pushUserNotifAtomic === 'function') {
    pushUserNotifAtomic(userId, notifObj);
  }
  if (STATE.user && STATE.user.id === userId) {
    const badge = document.getElementById('notif-badge');
    if (badge) { badge.style.display = ''; }
  }
}

// Close notif panel and sidebar on outside click
document.addEventListener('click', (e) => {
  const notifPanel = document.getElementById('notif-dropdown');
  const notifBtn   = document.getElementById('notif-btn');
  if (notifPanel && notifBtn && !notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
    notifPanel.classList.remove('open');
  }

  const sidebar = document.getElementById('sidebar');
  const hamBtn = document.querySelector('.hamburger-btn');
  // If clicking outside sidebar AND not clicking the hamburger button, close it
  if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(e.target)) {
    if (!hamBtn || !hamBtn.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  }
});


/* ─── Module: js/pages/auth.js ─── */
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
    try {
      const { data: authData, error: authErr } = await sb.auth.signInWithPassword({ email, password: pass });
      if (!authErr && authData?.user) {
        const { data: rows } = await sb.from('users').select('*').ilike('email', email).limit(1);
        if (rows && rows.length > 0) {
          user = mapUser(rows[0]);
        }
      }
    } catch (err) {
      console.warn('Supabase Auth password check failed, checking RPC fallback:', err);
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
    sessionStorage.setItem('vvce_pending_reg_' + cleanEmail, JSON.stringify(userPayload)); try { localStorage.setItem('vvce_pending_verify_email', cleanEmail); } catch (e) {}
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
        try { sessionStorage.removeItem('vvce_pending_reg_' + cleanEmail); localStorage.removeItem('vvce_pending_verify_email'); } catch (e) {}
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

    try { sessionStorage.removeItem('vvce_pending_reg_' + cleanEmail); localStorage.removeItem('vvce_pending_verify_email'); } catch (e) {}
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

// Function to handle the redirect back from email verification, Google OAuth, or Password Recovery
function resolveSignInPrefillEmail(searchParams, hashParams) { const fromUrl = (searchParams?.get('email') || hashParams?.get('email') || '').trim().toLowerCase(); if (fromUrl && isValidVvceEmail(fromUrl)) return fromUrl; try { const fromLocal = (localStorage.getItem('vvce_pending_verify_email') || '').trim().toLowerCase(); if (fromLocal && isValidVvceEmail(fromLocal)) return fromLocal; } catch (e) {} try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k && k.startsWith('vvce_pending_reg_')) { const candidate = k.slice('vvce_pending_reg_'.length).trim().toLowerCase(); if (candidate && isValidVvceEmail(candidate)) return candidate; } } } catch (e) {} const fromInput = (document.getElementById('login-email')?.value || '').trim().toLowerCase(); return (fromInput && isValidVvceEmail(fromInput)) ? fromInput : ''; } async function checkSupabaseEmailVerification() {
  const sb = getSupabaseClient();
  if (!sb || !sb.auth) return;

  let isRecoveryUrl = false;
  let recoveryLinkError = null; let urlAuthNotice = null; let prefillSignInEmail = '';

  // Inspect redirect URL params BEFORE Supabase auth handlers clean or process them
  try {
    const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search || '');
    isRecoveryUrl = hashParams.get('type') === 'recovery'
      || searchParams.get('type') === 'recovery'
      || searchParams.get('mode') === 'reset' || hashParams.get('mode') === 'reset';

    const errCode = (searchParams.get('error_code') || hashParams.get('error_code') || '').trim().toLowerCase(); const errType = (searchParams.get('error') || hashParams.get('error') || '').trim().toLowerCase();
    const oauthErr = searchParams.get('error_description') || hashParams.get('error_description')
      || searchParams.get('error') || hashParams.get('error');

    let oauthFlow = ''; try { oauthFlow = sessionStorage.getItem('vvce_oauth_flow') || ''; } catch (e) {} if (oauthErr || errCode) { prefillSignInEmail = resolveSignInPrefillEmail(searchParams, hashParams);
      cleanAuthUrlParams();
      try { sessionStorage.removeItem('vvce_oauth_flow'); } catch (e) {}
      let hasResetCtx = false;
      try { hasResetCtx = !!sessionStorage.getItem('vvce_pw_reset_ctx'); } catch (e) {}

      if (isRecoveryUrl) {
        recoveryLinkError = '❌ Your password reset link is invalid or has expired. Please enter your @vvce.ac.in email to request a new link.';
      } else {
        if (errCode === 'otp_expired' || (errType === 'access_denied' && oauthFlow !== 'google') || /otp_expired|email link is invalid or has expired/i.test(oauthErr || '')) { urlAuthNotice = { msg: 'Your verification link has already been used or expired. Please try signing in with your password or Google.', type: 'warning' }; } else { urlAuthNotice = { msg: '❌ Sign-in could not be completed: ' + (oauthErr || errCode), type: 'error' }; }
      }
    } else if (isRecoveryUrl) {
      window._isPasswordRecoveryActive = true;
    }
  } catch (e) {}

  if (!window._authListenerSetup) { window._authListenerSetup = true; sb.auth.onAuthStateChange(async (event, session) => { if (event === 'PASSWORD_RECOVERY') { window._isPasswordRecoveryActive = true; if (session && session.user) await openRecoveryResetView(session); return; } if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && session.user) { if (window._isPasswordRecoveryActive) return; await handleVerifiedSession(session, event); } }); } if (urlAuthNotice) { switchMainTab('signin'); if (prefillSignInEmail) { const loginEmailInp = document.getElementById('login-email'); if (loginEmailInp && !loginEmailInp.value) loginEmailInp.value = prefillSignInEmail; } showAuthMsg(urlAuthNotice.msg, urlAuthNotice.type); return; } if (recoveryLinkError) {
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
        if (window._isPasswordRecoveryActive) return;
        await handleVerifiedSession(session, event);
      }
    });
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
        // Brand new verified user — save full profile to Supabase & local cache
        const newUser = {
          ...regMeta,
          email: cleanEmail,
          points: null,
          pointsBySem: null
        };

        const mapped = {
          id: newUser.id, type: newUser.type, name: newUser.name, email: cleanEmail, pass: newUser.pass,
          usn: newUser.usn, branch: newUser.branch, section: newUser.section, year: newUser.year,
          sem: newUser.sem, admission_year: newUser.admissionYear, dept: newUser.dept, phone: newUser.phone,
          interests: newUser.interests, skills: newUser.skills, bio: newUser.bio, linkedin: newUser.linkedin,
          github: newUser.github, achievements: newUser.achievements, profile_photo: newUser.profilePhoto,
          resume: newUser.resume, points: null, points_by_sem: null,
          notifs: newUser.notifs, club_name: newUser.clubName, club_email: newUser.clubEmail,
          domain: newUser.domain, faculty: newUser.faculty, approved: newUser.approved, desc: newUser.desc,
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
        if (pendingReg && newUser.pass) {
          await sb.auth.updateUser({ password: newUser.pass }).catch(() => {});
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

      // Sync authority mirror entry in users table if one exists
      const users = getDB('vvce_users');
      const uIdx = users.findIndex(
        u => (targetId && u.id === targetId) || (u.email && u.email.toLowerCase() === recoveryEmail)
      );
      if (uIdx > -1) {
        users[uIdx].pass = newPass;
        SUPABASE_CACHE.vvce_users = users;
        try { localStorage.setItem('vvce_users', JSON.stringify(users)); } catch (e) {}
      }
      if (typeof sb.from === 'function') {
        await sb.from('users').update({ pass: newPass }).ilike('email', recoveryEmail).catch(() => {});
      }
    } else {
      // Regular user password sync (Student, Club Admin, Faculty)
      if (typeof sb.from === 'function') {
        const updQuery = sb.from('users').update({ pass: newPass });
        const { error: uUpdErr } = targetId
          ? await updQuery.eq('id', targetId)
          : await updQuery.ilike('email', recoveryEmail);
        if (uUpdErr) console.warn('Supabase users update warning:', uUpdErr.message);

        await sb.from('registered_students').update({ pass: newPass }).ilike('email', recoveryEmail).catch(() => {});
      }

      const users = getDB('vvce_users');
      const uIdx = users.findIndex(
        u => (targetId && u.id === targetId) || (u.email && u.email.toLowerCase() === recoveryEmail)
      );
      if (uIdx > -1) {
        users[uIdx].pass = newPass;
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



/* ─── Module: js/pages/student-dashboard.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Student Dashboard
   Path: js/pages/student-dashboard.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   STUDENT DASHBOARD
───────────────────────────────────────────────────────────────*/
function renderStudentDashboard() {
  const user   = STATE.user;
  const events = getDB('vvce_events');
  const certs  = getDB('vvce_certs').filter(c => c.userId === user.id);
  const regs   = events.filter(e => (e.registrations||[]).includes(user.id));
  const _now = new Date();
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const upcoming = regs.filter(e => e.date && e.date >= todayStr).slice(0, 4);
  const approved = events.filter(e => {
    const s = (e.status || '').toLowerCase().trim();
    const isVisibleStatus = s === 'approved' || s === 'published' || s === 'rescheduled' || 
                            (s === 'scheduled' && (!e.publish_at || new Date(e.publish_at) <= new Date()));
    const isTargetBranch = isBranchMatch(e.branches, user.branch);
    return isVisibleStatus && isTargetBranch;
  });
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
  recommended = recommended.slice(0,6);

  const themeGreetingHTML = (window.currentTheme && window.currentTheme.showGreeting && window.currentTheme.greeting) 
    ? `<div class="dashboard-festive-ribbon" style="background: linear-gradient(90deg, ${window.currentTheme.primary || '#f59e0b'}, ${window.currentTheme.secondary || '#fbbf24'}); color: #ffffff; padding: 12px 20px; text-align: center; font-weight: 800; font-size: 14px; letter-spacing: 0.02em; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center; gap: 8px;">
         <span>${escapeHTML(window.currentTheme.greeting)}</span>
       </div>`
    : '';

  const el = document.getElementById('page-dashboard');
  el.innerHTML = `
    ${themeGreetingHTML}
    <!-- Welcome Banner -->
    <div class="welcome-banner">
      <div class="welcome-big-avatar" id="wb-avatar">
        ${user.profilePhoto ? `<img src="${sanitizeUrl(user.profilePhoto)}">` : escapeHTML(avatar(user.name))}
      </div>
      <div class="welcome-info">
        <div class="welcome-greeting">Good ${escapeHTML(getGreeting())},</div>
        <div class="welcome-name">${escapeHTML(titleCase(user.name.split(' ')[0]))} 👋</div>
        <div class="welcome-chips">
          <span class="welcome-chip">📍 ${escapeHTML(user.branch||'—')} • ${escapeHTML(computeStudentYearSem(user).sem)}</span>
          <span class="welcome-chip">🏫 Sec ${escapeHTML(user.section||'—')}</span>
          ${(user.interests||[]).map(i=>`<span class="welcome-chip">${escapeHTML(i)}</span>`).join('')}
        </div>
      </div>
      <div class="welcome-acts">
        <button class="welcome-act-btn gold" onclick="showPage('events')">Browse Events →</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-row" style="grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));">
      ${statCard('📅','Registered',regs.length,`${upcoming.length} upcoming`,'stat-blue')}
      ${statCard('🏆','Certificates',certs.length,`${certs.filter(c=>c.type==='achievement').length} achievements`,'stat-mint')}
      ${statCard('✅','Completed',regs.filter(e=>e.date && e.date < todayStr).length,'Events attended','stat-pink')}
    </div>

    <!-- Two-col dashboard -->
    <div class="dash-grid">
      <!-- Left column -->
      <div>
        <!-- Recommended Events -->
        <div class="sec-head" style="margin-top:0;">
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
          ? upcoming.map(e => {
              const userTeam = (e.teams || []).find(t => t.leaderId === user.id || (t.memberIds || []).includes(user.id));
              const prog = typeof getEventRegistrationProgress === 'function' ? getEventRegistrationProgress(e, user) : { status: 'registered' };
              const statusBadgeHtml = prog.status === 'pending_team' ? `<span class="att-tag" style="background:#fffbeb;color:#b45309;border:1px solid #fde68a;font-weight:700;">⏳ Team Pending</span>` : prog.status === 'pending_payment' ? `<span class="att-tag" style="background:#fffbeb;color:#b45309;border:1px solid #fde68a;font-weight:700;">💳 Pay Proof</span>` : prog.status === 'pending_approval' ? `<span class="att-tag" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;font-weight:700;">⏳ Approval</span>` : prog.status === 'rejected' ? `<span class="att-tag" style="background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;font-weight:700;">❌ Rejected</span>` : `<span class="att-tag att-reg">✓ Reg.</span>`;
              return `
                <div class="sched-row" onclick="openEventModal('${escapeHTML(e.id)}')">
                  <span class="sched-emoji">${escapeHTML(e.emoji||'🎓')}</span>
                  <div class="sched-info">
                    <div class="sched-name">${escapeHTML(e.name)}</div>
                    <div class="sched-meta">${escapeHTML(formatDate(e.date))} • ${escapeHTML(e.venue)}${userTeam ? ` &bull; 👥 ${escapeHTML(userTeam.name)}` : ''}</div>
                  </div>
                  ${statusBadgeHtml}
                </div>`;
            }).join('')
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


/* ─── Module: js/pages/events.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Events Feed, Dynamic Solo/Group Registration & Payment Proof
   Path: js/pages/events.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   REGISTRATION STATE MACHINE & PROGRESS STEPPER
   States: none | pending_team | pending_payment | pending_approval | rejected | registered
───────────────────────────────────────────────────────────────*/
function getEventRegistrationProgress(ev, user = STATE.user) {
  const maxTeam = Number(ev?.maxTeamSize || 1);
  const isGroup = Boolean(ev?.isTeamEvent && maxTeam > 1);
  const requiresPayment = Number(ev?.fee || 0) > 0 || Boolean(ev?.needsPayment);

  if (!user || !ev) {
    return { status: 'none', isGroup, requiresPayment, team: null, pmt: null, isLeader: false, isPendingInvite: false, rejectionReason: null };
  }

  const userId = user.id;
  const userEmail = String(user.email || '').toLowerCase();

  const team = (ev.teams || []).find(t =>
    t.leaderId === userId ||
    (t.memberIds || []).includes(userId) ||
    (t.pendingEmails || []).some(em => String(em).toLowerCase() === userEmail)
  ) || null;

  const pmt = (ev.pendingPayments || []).find(p =>
    p.uid === userId ||
    (team && (String(p.teamId || '') === String(team.id) || String(p.teamData?.teamId || '') === String(team.id)))
  ) || null;

  const isLeader = Boolean(team && team.leaderId === userId);
  const isPendingInvite = Boolean(team && (team.pendingEmails || []).some(em => String(em).toLowerCase() === userEmail));
  const rejectionReason = pmt?.rejectionReason || team?.rejectionReason || null;

  if ((ev.registrations || []).includes(userId)) {
    return { status: 'registered', isGroup, requiresPayment, team, pmt, isLeader, isPendingInvite, rejectionReason: null };
  }

  if (team) {
    const pendingLeft = (team.pendingEmails || []).length;
    if (pendingLeft > 0 || team.status === 'pending_team') {
      return { status: 'pending_team', isGroup, requiresPayment, team, pmt, isLeader, isPendingInvite, rejectionReason };
    }
    if (pmt?.status === 'rejected' || team.status === 'rejected' || team.paymentStatus === 'rejected') {
      return { status: 'rejected', isGroup, requiresPayment, team, pmt, isLeader, isPendingInvite, rejectionReason };
    }
    if (pmt?.status === 'pending_approval' || team.status === 'pending_approval' || pmt?.status === 'submitted' || team.paymentStatus === 'submitted') {
      return { status: 'pending_approval', isGroup, requiresPayment, team, pmt, isLeader, isPendingInvite, rejectionReason: null };
    }
    if (requiresPayment) {
      return { status: 'pending_payment', isGroup, requiresPayment, team, pmt, isLeader, isPendingInvite, rejectionReason };
    }
    return { status: 'pending_approval', isGroup, requiresPayment, team, pmt, isLeader, isPendingInvite, rejectionReason: null };
  }

  if (pmt) {
    const pStatus = pmt.status || 'pending_approval';
    return {
      status: pStatus === 'submitted' ? 'pending_approval' : pStatus,
      isGroup,
      requiresPayment,
      team: null,
      pmt,
      isLeader: false,
      isPendingInvite: false,
      rejectionReason
    };
  }

  return { status: 'none', isGroup, requiresPayment, team: null, pmt: null, isLeader: false, isPendingInvite: false, rejectionReason: null };
}
window.getEventRegistrationProgress = getEventRegistrationProgress;

function renderRegistrationStepper(ev, prog = null) {
  const p = prog || getEventRegistrationProgress(ev, STATE.user);
  const st = p.status;
  const activeMap = { none: 1, pending_team: 2, pending_payment: 3, pending_approval: 4, rejected: p.requiresPayment ? 3 : 4, registered: 5 };
  let activeStep = activeMap[st] || 1;
  if (!p.isGroup && activeStep < 3 && st === 'none') {
    activeStep = p.requiresPayment ? 3 : 4;
  }

  const steps = [
    { num: 1, label: 'Team Setup',       skipped: !p.isGroup, detail: !p.isGroup ? 'Solo (Skipped)' : '' },
    { num: 2, label: 'Team Confirmation', skipped: !p.isGroup, detail: !p.isGroup ? 'Solo (Skipped)' : '' },
    { num: 3, label: 'Payment Proof',     skipped: !p.requiresPayment, detail: !p.requiresPayment ? 'Free (Skipped)' : '' },
    { num: 4, label: 'Organizer Approval', skipped: false, detail: '' },
    { num: 5, label: 'Registered',        skipped: false, detail: '' }
  ];

  return `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 10px 8px;width:100%;box-sizing:border-box;">
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;align-items:start;">
        ${steps.map(s => {
          const isRejectedStep = st === 'rejected' && ((p.requiresPayment && s.num === 3) || (!p.requiresPayment && s.num === 4));
          const isDone = st === 'registered' ? true : (!s.skipped && s.num < activeStep && !isRejectedStep);
          const isCurrent = !s.skipped && s.num === activeStep && st !== 'registered' && !isRejectedStep;

          let bg = '#e2e8f0', fg = '#64748b', txt = '#64748b', icon = String(s.num);
          if (s.skipped) {
            bg = '#f1f5f9'; fg = '#94a3b8'; txt = '#94a3b8'; icon = '—';
          } else if (isRejectedStep) {
            bg = '#fee2e2'; fg = '#b91c1c'; txt = '#b91c1c'; icon = '✕';
          } else if (isDone || (st === 'registered' && s.num === 5)) {
            bg = '#10b981'; fg = '#ffffff'; txt = '#15803d'; icon = '✓';
          } else if (isCurrent) {
            bg = '#f59e0b'; fg = '#0f172a'; txt = '#b45309'; icon = String(s.num);
          }

          return `
            <div style="display:flex;flex-direction:column;align-items:center;text-align:center;">
              <div style="width:22px;height:22px;border-radius:50%;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;margin-bottom:4px;border:1px solid rgba(15,23,42,0.06);">
                ${icon}
              </div>
              <div style="font-size:10px;font-weight:${isCurrent || isRejectedStep ? '800' : '600'};color:${txt};line-height:1.2;">${s.label}</div>
              ${s.detail ? `<div style="font-size:9px;color:#94a3b8;margin-top:1px;">${s.detail}</div>` : ''}
            </div>`;
        }).join('')}
      </div>
    </div>`;
}
window.renderRegistrationStepper = renderRegistrationStepper;

async function syncEventRegistrationStateToSupabase(ev, regRecord = null) {
  const sb = getSupabaseClient();
  if (!sb) return;
  if (typeof sb.from === 'function') {
    await sb.from('events').update({
      registrations: ev.registrations || [],
      reg_count: (ev.registrations || []).length,
      pending_payments: ev.pendingPayments || [],
      teams: ev.teams || []
    }).eq('id', ev.id).catch(() => {});

    if (regRecord && regRecord.uid) {
      const row = {
        id: regRecord.id || `er_${ev.id}_${regRecord.uid}`,
        event_id: ev.id,
        user_id: regRecord.uid,
        user_name: regRecord.userName || null,
        user_email: regRecord.userEmail || null,
        usn: regRecord.usn || null,
        team_id: regRecord.teamId || null,
        team_name: regRecord.teamName || null,
        is_team: Boolean(regRecord.isTeam),
        team_members: regRecord.teamData?.memberDetails || [],
        status: regRecord.status || 'pending_approval',
        utr_number: regRecord.utrNumber || null,
        screenshot_url: regRecord.screenshot || null,
        rejection_reason: regRecord.rejectionReason || null,
        submitted_at: regRecord.submittedAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await sb.from('event_registrations').upsert([row]).catch(() => {});
    }
  }
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
  syncEventsFromSupabase().then(() => {
    if (STATE.page === 'events') filterEvents();
  });
}

function filterEvents() {
  const q   = (document.querySelector('#page-events #ev-search')?.value||'').toLowerCase().trim();
  const cat = document.querySelector('#page-events #ev-cat')?.value||'';
  const fee = document.querySelector('#page-events #ev-fee')?.value||'';
  let evs   = getDB('vvce_events').filter(e => {
    const s = (e.status || '').toLowerCase().trim();
    if (s === 'archived' || s === 'draft' || s === 'pending' || s === 'rejected') return false;
    if (s === 'scheduled' && e.publish_at && new Date(e.publish_at) > new Date()) return false;
    return s === 'approved' || s === 'published' || s === 'rescheduled' || s === 'cancelled' || s === 'scheduled';
  });

  if (STATE.user && STATE.user.type === 'student') {
    evs = evs.filter(e => isBranchMatch(e.branches, STATE.user.branch));
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
  const prog  = getEventRegistrationProgress(ev, user);
  const currentRegCount = (ev.registrations || []).length;
  const maxCap = ev.max_participants || ev.maxParticipants || 100;
  const isFull = currentRegCount >= maxCap;
  const isCancelled = ev.status === 'cancelled';
  const isRescheduled = ev.status === 'rescheduled';
  const catCls = { Technical:'cat-technical',Cultural:'cat-cultural',Sports:'cat-sports',Workshop:'cat-workshop',Management:'cat-management',Social:'cat-social' }[ev.category]||'cat-technical';

  let actionBtnHtml = '';
  if (user?.type === 'student') {
    if (isCancelled) {
      actionBtnHtml = `<button class="btn-reg" disabled style="background:#ef444420;color:#ef4444;border:1px solid #ef444440;cursor:not-allowed;">Cancelled</button>`;
    } else if (prog.status === 'registered') {
      actionBtnHtml = `<button class="btn-reg registered" onclick="event.stopPropagation();unregisterEv('${ev.id}')">✓ Registered</button>`;
    } else if (prog.status === 'pending_team') {
      actionBtnHtml = `<button class="btn-reg" style="background:#fffbeb;color:#b45309;border:1px solid #fde68a;" onclick="event.stopPropagation();openEventModal('${ev.id}')">⏳ Confirm Team</button>`;
    } else if (prog.status === 'pending_payment') {
      actionBtnHtml = `<button class="btn-reg" style="background:#f59e0b;color:#0f172a;border:none;" onclick="event.stopPropagation();reopenRegistrationPayment('${ev.id}')">💳 Upload Proof</button>`;
    } else if (prog.status === 'pending_approval') {
      actionBtnHtml = `<button class="btn-reg" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;" onclick="event.stopPropagation();openEventModal('${ev.id}')">⏳ Pending Approval</button>`;
    } else if (prog.status === 'rejected') {
      actionBtnHtml = `<button class="btn-reg" style="background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;" onclick="event.stopPropagation();reopenRegistrationPayment('${ev.id}')">❌ Re-upload Proof</button>`;
    } else if (STATE.registrationLocked) {
      actionBtnHtml = `<button class="btn-reg" disabled style="background:#64748b;color:#fff;border:none;cursor:not-allowed;">🔒 Paused</button>`;
    } else if (isFull) {
      actionBtnHtml = ev.waitlist_enabled
        ? `<button class="btn-reg" style="background:#f59e0b;color:#fff;border:none;" onclick="event.stopPropagation();joinWaitlist('${ev.id}')">⏳ Waitlist</button>`
        : `<button class="btn-reg" disabled style="opacity:.5;cursor:not-allowed;">Full</button>`;
    } else {
      actionBtnHtml = `<button class="btn-reg" onclick="event.stopPropagation();registerEv('${ev.id}')">Register</button>`;
    }
  }

  return `
    <div class="event-card ${isCancelled ? 'ev-cancelled-card' : ''}" onclick="openEventModal('${escapeHTML(ev.id)}')">
      <div class="event-poster">
        ${ev.poster?`<img src="${sanitizeUrl(ev.poster)}">`:`<span style="position:relative;z-index:1;">${escapeHTML(ev.emoji||'🎓')}</span>`}
        <span class="ev-cat-badge ${catCls}">${escapeHTML(ev.category)}</span>
        ${isCancelled ? `<span class="ev-cat-badge" style="top:10px;right:10px;left:auto;background:#ef4444;color:#fff;font-weight:800;">🚫 CANCELLED</span>` : ''}
        ${isRescheduled ? `<span class="ev-cat-badge" style="top:10px;right:10px;left:auto;background:#f59e0b;color:#fff;font-weight:800;">⚠️ RESCHEDULED</span>` : ''}
      </div>
      <div class="ev-body">
        <div class="ev-title">${escapeHTML(ev.name)}</div>
        <div class="ev-club">${escapeHTML(ev.club)}</div>
        ${isCancelled ? `<div style="background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; padding:6px 10px; border-radius:6px; font-size:12px; font-weight:600; margin:6px 0;">🚫 <strong>Event Cancelled:</strong> ${escapeHTML(ev.rejReason || 'Due to administrative schedule changes.')}</div>` : ''}
        ${isRescheduled ? `<div style="background:#fffbeb; border:1px solid #fde68a; color:#b45309; padding:6px 10px; border-radius:6px; font-size:12px; font-weight:600; margin:6px 0;">⚠️ <strong>Rescheduled:</strong> Now on ${escapeHTML(formatDate(ev.date))} @ ${escapeHTML(formatTime(ev.time))}</div>` : ''}
        ${prog.status === 'rejected' && prog.rejectionReason ? `<div style="background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; padding:6px 10px; border-radius:6px; font-size:11.5px; font-weight:600; margin:6px 0;">❌ <strong>Rejected:</strong> ${escapeHTML(prog.rejectionReason)}</div>` : ''}
        <div class="ev-metas">
          <div class="ev-meta">📅 ${escapeHTML(formatDate(ev.date))}</div>
          <div class="ev-meta">🕐 ${escapeHTML(formatEventTimeSlot(ev))} &nbsp;|&nbsp; 📍 ${escapeHTML(ev.venue)}</div>
          <div class="ev-meta">💰 ${ev.fee>0?`<span style="color:#b45309;">₹${escapeHTML(ev.fee)}</span>`:(ev.needsPayment ? `<span style="color:#b45309;">Proof Required</span>` : `<span style="color:#15803d;">FREE</span>`)}</div>
          <div class="ev-meta" style="color:#6366f1;font-weight:600;">🎓 Open to: ${(ev.branches && ev.branches.length > 0) ? (ev.branches.includes('All') ? 'All Branches' : ev.branches.map(b => escapeHTML(b)).join(', ')) : 'All Branches'}</div>
          ${prog.isGroup ? `<div class="ev-meta" style="color:#7c3aed;font-weight:700;">👥 Group Event &nbsp;|&nbsp; ${escapeHTML(ev.minTeamSize || 2)}–${escapeHTML(ev.maxTeamSize || 4)} members</div>` : `<div class="ev-meta" style="color:#0369a1;font-weight:600;">👤 Solo Participation</div>`}
          ${ev.desc ? `
            <div style="background:#fffdf5;border-left:3px solid #f59e0b;padding:6px 9px;border-radius:6px;font-size:11.5px;color:#78350f;line-height:1.45;margin-top:7px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
              <strong style="color:#b45309;">📝 Description:</strong> ${escapeHTML(ev.desc)}
            </div>` : ''}
          ${ev.rules ? `
            <div style="background:#fef2f2;border-left:3px solid #ef4444;padding:6px 9px;border-radius:6px;font-size:11px;color:#7f1d1d;line-height:1.4;margin-top:5px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;">
              <strong style="color:#b91c1c;">⚖️ Rules:</strong> ${escapeHTML(ev.rules)}
            </div>` : ''}
        </div>
        <div class="ev-foot">
          <span class="ev-seats ${isFull?'full':''}">${
            isCancelled ? 'Cancelled' :
            isFull ? '🔴 Full' :
            prog.isGroup ? `👥 ${(ev.teams||[]).filter(t => t.status === 'registered').length} confirmed team(s) (${currentRegCount}/${maxCap} people)` :
            `${maxCap - currentRegCount} seats left`
          }</span>
          <div style="display:flex;gap:6px;align-items:center;">
            ${actionBtnHtml}
          </div>
        </div>
      </div>
    </div>`;
}

/* ─────────────────────────────────────────────────────────────
   TEAM REGISTRATION (Draft in memory until "Register Team" submitted)
───────────────────────────────────────────────────────────────*/
let _teamRegEventId = null;
let _teamRegTeamId = null;
let _teamMembers = []; // array of { name, email, token }

function toggleTeamFields() {
  const isChecked = document.getElementById('ev-is-team')?.checked || false;
  const wrap = document.getElementById('ev-team-wrap');
  const card = document.getElementById('team-event-card-wrap');
  const title = document.getElementById('team-card-title');

  if (wrap) wrap.style.display = isChecked ? 'block' : 'none';
  if (card) {
    card.style.background = isChecked ? '#f5f3ff' : '#f8fafc';
    card.style.borderColor = isChecked ? '#8b5cf6' : '#e2e8f0';
    card.style.boxShadow = isChecked ? '0 2px 8px rgba(139,92,246,0.15)' : 'none';
  }
  if (title) title.style.color = isChecked ? '#6d28d9' : '#0f172a';

  const maxInput = document.getElementById('ev-max');
  const hint = document.getElementById('ev-max-team-hint');
  if (maxInput) {
    maxInput.disabled = isChecked;
    maxInput.style.opacity = isChecked ? '0.45' : '1';
    maxInput.style.cursor = isChecked ? 'not-allowed' : '';
    maxInput.style.background = isChecked ? '#f1f0ff' : '';
  }
  if (hint) hint.style.display = isChecked ? 'block' : 'none';
  if (isChecked) updateMaxParticipantsFromTeam();
}

function updateMaxParticipantsFromTeam() {
  const maxTeams = parseInt(document.getElementById('ev-max-teams')?.value || '20');
  const maxMembers = parseInt(document.getElementById('ev-team-max')?.value || '4');
  const maxInput = document.getElementById('ev-max');
  if (maxInput && maxTeams > 0 && maxMembers > 0) {
    maxInput.value = maxTeams * maxMembers;
  }
}

function openTeamRegisterModal(ev) {
  _teamRegEventId = ev.id;
  _teamRegTeamId = genId('team');
  _teamMembers = [];

  document.getElementById('team-modal-event-name').textContent = '📅 ' + ev.name;
  document.getElementById('team-name-input').value = '';
  document.getElementById('team-leader-name').textContent = STATE.user.name;
  document.getElementById('team-leader-email').textContent = STATE.user.email;
  document.getElementById('team-members-list').innerHTML = '';
  if (document.getElementById('team-member-name-input')) document.getElementById('team-member-name-input').value = '';
  if (document.getElementById('team-member-email-input')) document.getElementById('team-member-email-input').value = '';
  document.getElementById('team-member-error').style.display = 'none';

  const min = ev.minTeamSize || 2;
  const max = ev.maxTeamSize || 4;
  document.getElementById('team-size-hint').textContent =
    `ℹ️ Teams require ${min}–${max} members (including you). After submitting the team, invites will be sent to all teammates to confirm before registration can proceed.`;

  const stepperWrap = document.getElementById('team-reg-stepper');
  if (stepperWrap) {
    stepperWrap.innerHTML = renderRegistrationStepper(ev, {
      status: 'none',
      isGroup: true,
      requiresPayment: Number(ev.fee || 0) > 0 || Boolean(ev.needsPayment)
    });
  }

  openModal('modal-team-register');
}

window.cancelTeamRegistrationDraft = function() {
  // Clean up any unsaved draft state cleanly so Cancel leaves zero orphan records
  _teamRegEventId = null;
  _teamRegTeamId = null;
  _teamMembers = [];
  closeModal('modal-team-register');
};

function renderTeamMembersList() {
  const list = document.getElementById('team-members-list');
  if (!list) return;

  list.innerHTML = _teamMembers.map((member, idx) => {
    const memEmail = typeof member === 'object' ? member.email : member;
    const memName = typeof member === 'object' ? member.name : '';

    return `
      <div style="display:flex; align-items:center; gap:8px; padding:8px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:6px; font-size:13px; flex-wrap:wrap;">
        <span style="font-size:15px;">👤</span>
        <div style="flex:1; min-width:140px; overflow:hidden; text-overflow:ellipsis;">
          ${memName ? `<strong style="color:#1e293b;">${memName}</strong> • ` : ''}
          <span style="color:#4b5563; font-weight:500;">${memEmail}</span>
        </div>
        <span style="font-size:11px; color:#64748b; font-weight:600; background:#e2e8f0; padding:2px 8px; border-radius:12px;">Queued to Invite</span>
        <button type="button" onclick="removeTeamMember(${idx})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:16px; padding:0 4px;" title="Remove">×</button>
      </div>
    `;
  }).join('');
}

function addTeamMember() {
  const nameInput = document.getElementById('team-member-name-input');
  const emailInput = document.getElementById('team-member-email-input');
  const errEl = document.getElementById('team-member-error');

  const name = (nameInput?.value || '').trim();
  const email = (emailInput?.value || '').trim().toLowerCase();
  errEl.style.display = 'none';

  if (!name) {
    errEl.textContent = '❌ Please enter teammate\'s name.';
    errEl.style.display = 'block';
    nameInput?.focus();
    return;
  }
  if (!email || !/^[a-z0-9._%+-]+@vvce\.ac\.in$/i.test(email)) {
    errEl.textContent = '❌ Only valid @vvce.ac.in email addresses are allowed.';
    errEl.style.display = 'block';
    emailInput?.focus();
    return;
  }
  if (email === STATE.user.email.toLowerCase()) {
    errEl.textContent = '❌ You are already the team leader — no need to add yourself.';
    errEl.style.display = 'block';
    return;
  }
  if (_teamMembers.some(m => (typeof m === 'object' ? m.email : m).toLowerCase() === email)) {
    errEl.textContent = '❌ This teammate email has already been added.';
    errEl.style.display = 'block';
    return;
  }

  const ev = getDB('vvce_events').find(e => e.id === _teamRegEventId);
  if (!ev) return;

  const maxOther = (ev.maxTeamSize || 4) - 1;
  if (_teamMembers.length >= maxOther) {
    errEl.textContent = `❌ Maximum ${ev.maxTeamSize || 4} members per team (including you).`;
    errEl.style.display = 'block';
    return;
  }

  _teamMembers.push({ name, email, token: genId('tok') });
  if (nameInput) nameInput.value = '';
  if (emailInput) emailInput.value = '';
  renderTeamMembersList();
}

function removeTeamMember(idx) {
  _teamMembers.splice(idx, 1);
  renderTeamMembersList();
}

async function dispatchSingleMemberInvite({ email, memberName, team, ev, inviteToken }) {
  const siteUrl = window.location.origin + window.location.pathname;
  const inviteLink = `${siteUrl}?teamInvite=${team.id}&event=${ev.id}&token=${encodeURIComponent(inviteToken)}`;
  const sb = getSupabaseClient();
  let emailSent = false;

  // Send in-app notification if teammate user is already in cache
  const existingUser = getDB('vvce_users').find(u => (u.email || '').toLowerCase() === email.toLowerCase());
  if (existingUser) {
    addNotifToUser(
      existingUser.id,
      `You were invited by ${STATE.user.name} to join Team "${team.name}" for "${ev.name}". Open My Registrations to confirm!`,
      '👥'
    );
  }

  if (sb && sb.auth) {
    try {
      const res = await sb.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: inviteLink,
          data: {
            teamInvite: true,
            teamId: team.id,
            teamName: team.name,
            eventId: ev.id,
            eventName: ev.name,
            inviterName: STATE.user.name,
            memberName,
            inviteToken
          }
        }
      });
      if (!res?.error) emailSent = true;
    } catch (e) {
      console.warn('OTP team invite warning:', e);
    }
  }

  return { emailSent, inviteLink };
}

async function submitTeamRegistration() {
  const teamName = document.getElementById('team-name-input').value.trim();
  const errEl = document.getElementById('team-member-error');
  errEl.style.display = 'none';

  if (!teamName) {
    errEl.textContent = '❌ Please enter a team name.';
    errEl.style.display = 'block';
    return;
  }

  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === _teamRegEventId);
  if (!ev) return;

  const totalMembers = 1 + _teamMembers.length;
  const minTeam = ev.minTeamSize || 2;
  const maxTeam = ev.maxTeamSize || 4;

  if (totalMembers < minTeam) {
    errEl.textContent = `❌ You need at least ${minTeam} members (including yourself). Add ${minTeam - totalMembers} more.`;
    errEl.style.display = 'block';
    return;
  }
  if (totalMembers > maxTeam) {
    errEl.textContent = `❌ Maximum allowed team size is ${maxTeam} members (including yourself). Remove ${totalMembers - maxTeam} member(s).`;
    errEl.style.display = 'block';
    return;
  }

  const currentRegCount = (ev.registrations || []).length;
  const maxCap = ev.max_participants || ev.maxParticipants || 100;
  if (currentRegCount + totalMembers > maxCap) {
    errEl.textContent = `❌ Adding this team (${totalMembers} members) exceeds total event capacity (${maxCap}). Only ${Math.max(0, maxCap - currentRegCount)} spot(s) left.`;
    errEl.style.display = 'block';
    return;
  }

  const submitBtn = document.getElementById('btn-submit-team-reg');
  const origLabel = submitBtn ? submitBtn.textContent : 'Register Team 🚀';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Team & Sending Invites... ⏳';
  }

  try {
    const memberEmails = _teamMembers.map(m => m.email);
    const memberDetails = _teamMembers.map(m => ({
      name: m.name,
      email: m.email,
      status: 'pending',
      token: m.token || genId('tok')
    }));
    const requiresPayment = Number(ev.fee || 0) > 0 || Boolean(ev.needsPayment);
    const teamInviteToken = genId('inv');

    const initialStatus = memberEmails.length > 0
      ? 'pending_team'
      : (requiresPayment ? 'pending_payment' : 'pending_approval');

    if (!ev.teams) ev.teams = [];
    const team = {
      id: _teamRegTeamId || genId('team'),
      name: teamName,
      inviteToken: teamInviteToken,
      leaderId: STATE.user.id,
      leaderName: STATE.user.name,
      leaderEmail: STATE.user.email,
      memberEmails: [...memberEmails],
      memberDetails: [...memberDetails],
      memberIds: [STATE.user.id],
      pendingEmails: [...memberEmails],
      pendingMembers: memberDetails.map(d => ({ name: d.name, email: d.email })),
      status: initialStatus,
      paymentStatus: requiresPayment ? 'pending' : 'free',
      utrNumber: null,
      screenshot: null,
      rejectionReason: null,
      createdAt: new Date().toISOString()
    };
    ev.teams.push(team);

    let approvalEntry = null;
    if (initialStatus === 'pending_approval') {
      if (!ev.pendingPayments) ev.pendingPayments = [];
      ev.pendingPayments = ev.pendingPayments.filter(p => String(p.teamId || '') !== String(team.id));
      approvalEntry = {
        id: genId('reg'),
        uid: STATE.user.id,
        userName: STATE.user.name,
        userEmail: STATE.user.email,
        usn: STATE.user.usn || '',
        status: 'pending_approval',
        isTeam: true,
        teamId: team.id,
        teamName: team.name,
        teamData: { teamId: team.id, teamName: team.name, memberDetails },
        utrNumber: null,
        screenshot: null,
        submittedAt: new Date().toISOString()
      };
      ev.pendingPayments.push(approvalEntry);
    }

    await setDB('vvce_events', events);
    await syncEventRegistrationStateToSupabase(ev, approvalEntry || {
      uid: STATE.user.id,
      userName: STATE.user.name,
      userEmail: STATE.user.email,
      usn: STATE.user.usn || '',
      teamId: team.id,
      teamName: team.name,
      isTeam: true,
      status: initialStatus
    });

    // Dispatch verification invite emails to teammates
    let dispatchedCount = 0;
    for (const mem of memberDetails) {
      const res = await dispatchSingleMemberInvite({
        email: mem.email,
        memberName: mem.name,
        team,
        ev,
        inviteToken: mem.token || team.inviteToken
      });
      if (res.emailSent) dispatchedCount++;
    }

    _teamRegEventId = null;
    _teamRegTeamId = null;
    _teamMembers = [];
    closeModal('modal-team-register');

    if (initialStatus === 'pending_team') {
      addNotif(`Team "${teamName}" created for "${ev.name}". Waiting for ${memberEmails.length} teammate(s) to confirm.`, '⏳');
      toast(
        dispatchedCount > 0
          ? `Team created! Sent ${dispatchedCount}/${memberEmails.length} invite emails. Teammates must confirm before proceeding. ⏳`
          : `Team "${teamName}" created! Share the invite links from Manage Team so teammates can confirm. ⏳`,
        'success',
        6000
      );
      openEventModal(ev.id);
    } else if (initialStatus === 'pending_payment') {
      openPaymentModal(ev, team);
    } else {
      addNotif(`Team "${teamName}" submitted for organizer approval for "${ev.name}". ⏳`, '📋');
      if (ev.adminId) addNotifToUser(ev.adminId, `Team "${teamName}" requested registration for "${ev.name}".`, '👥');
      toast(`Team "${teamName}" submitted! Awaiting organizer approval. ⏳`, 'success', 5000);
      openEventModal(ev.id);
    }

    if (STATE.page === 'events') filterEvents();
    if (STATE.page === 'dashboard') renderStudentDashboard();
    if (STATE.page === 'registrations') renderRegistrationsPage();
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = origLabel;
    }
  }
}

// Called on page load & after auth/event sync — checks ?teamInvite=...&event=...&token=...
function checkTeamInviteUrl() {
  const params = new URLSearchParams(window.location.search);
  let teamId = params.get('teamInvite');
  let eventId = params.get('event');
  let token = params.get('token') || '';

  if (teamId && eventId) {
    try {
      sessionStorage.setItem('vvce_pending_invite', JSON.stringify({ teamId, eventId, token }));
    } catch (e) {}
    try { window.history.replaceState({}, '', window.location.pathname); } catch (e) {}
  } else {
    try {
      const saved = sessionStorage.getItem('vvce_pending_invite');
      if (saved) {
        const parsed = JSON.parse(saved);
        teamId = parsed.teamId;
        eventId = parsed.eventId;
        token = parsed.token || '';
      }
    } catch (e) {}
  }

  if (!teamId || !eventId) return;

  const events = getDB('vvce_events');
  const ev = events.find(e => String(e.id) === String(eventId));
  if (!ev) return;

  const team = (ev.teams || []).find(t => String(t.id) === String(teamId));
  if (!team) {
    try { sessionStorage.removeItem('vvce_pending_invite'); } catch (e) {}
    return;
  }

  window._pendingTeamInvite = { teamId, eventId, token };

  if (STATE.user) {
    const isAlreadyConfirmedMember = (ev.registrations || []).includes(STATE.user.id)
      || (team.memberIds || []).includes(STATE.user.id);
    if (isAlreadyConfirmedMember) {
      const banner = document.getElementById('team-invite-banner');
      if (banner) banner.style.display = 'none';
      try { sessionStorage.removeItem('vvce_pending_invite'); } catch (e) {}
      return;
    }
  }

  // Show Team Invite confirmation banner cleanly (require explicit confirm or login)
  const banner = document.getElementById('team-invite-banner');
  const msgEl = document.getElementById('invite-banner-msg');
  const subEl = document.getElementById('invite-banner-sub');
  const btnEl = document.getElementById('invite-banner-btn');
  if (banner && msgEl) {
    msgEl.textContent = `You've been invited to join Team "${team.name}" for ${ev.name}!`;
    if (STATE.user) {
      const userEmail = (STATE.user.email || '').toLowerCase();
      const isTarget = (team.pendingEmails || []).some(e => e.toLowerCase() === userEmail)
        || (team.memberEmails || []).some(e => e.toLowerCase() === userEmail);
      if (isTarget) {
        subEl.textContent = `Invited by ${team.leaderName}. Click "Confirm Attendance / Accept Invite" to verify your spot!`;
      } else {
        subEl.textContent = `Signed in as ${STATE.user.email}. Invited teammates: ${(team.memberEmails || []).join(', ')}.`;
      }
      if (btnEl) btnEl.textContent = '✅ Confirm Attendance / Accept Invite';
    } else {
      subEl.textContent = `Invited by ${team.leaderName}. Please sign in with your @vvce.ac.in account to accept.`;
      if (btnEl) btnEl.textContent = '🔑 Sign In to Accept';
    }
    banner.style.display = 'block';
  }
}

window.dismissTeamInviteBanner = function() {
  const banner = document.getElementById('team-invite-banner');
  if (banner) banner.style.display = 'none';
  try { sessionStorage.removeItem('vvce_pending_invite'); } catch (e) {}
  window._pendingTeamInvite = null;
};

function escapeStr(s) {
  if (!s) return '';
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function buildMemberInviteUrl(team, ev, memberEmail = '') {
  const siteUrl = window.location.origin + window.location.pathname;
  const det = (team?.memberDetails || []).find(d => (d.email || '').toLowerCase() === memberEmail.toLowerCase());
  const token = det?.token || team?.inviteToken || '';
  return `${siteUrl}?teamInvite=${team.id}&event=${ev.id}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
}

window.copyTeamInviteLink = function(teamId, eventId, memberNameOrEmail, memberToken = '') {
  const siteUrl = window.location.origin + window.location.pathname;
  const url = `${siteUrl}?teamInvite=${teamId}&event=${eventId}${memberToken ? `&token=${encodeURIComponent(memberToken)}` : ''}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      toast(`📋 Invite link for ${memberNameOrEmail || 'teammate'} copied!`, 'success', 4500);
    }).catch(() => {
      prompt('Copy team invite link:', url);
    });
  } else {
    prompt('Copy team invite link:', url);
  }
};

window.openMailtoVerification = function(memberEmail, memberName, teamName, eventName, teamId, eventId, memberToken = '') {
  const siteUrl = window.location.origin + window.location.pathname;
  const inviteLink = `${siteUrl}?teamInvite=${teamId}&event=${eventId}${memberToken ? `&token=${encodeURIComponent(memberToken)}` : ''}`;
  const inviterName = STATE.user ? STATE.user.name : 'Your Team Leader';

  const subject = encodeURIComponent(`Invitation to join Team "${teamName}" for ${eventName} - VVCE Events Hub`);
  const body = encodeURIComponent(
`Hi ${memberName || 'there'},

You have been invited by ${inviterName} to join Team "${teamName}" for "${eventName}" on VVCE Events Hub.

Click the link below to confirm your attendance & join the team:
${inviteLink}

Regards,
VVCE Events Hub — Vidyavardhaka College of Engineering`
  );

  window.open(`mailto:${memberEmail}?subject=${subject}&body=${body}`, '_blank');
  toast(`Opening email composer for ${memberEmail}... 📧`, 'info', 4000);
};

/* Helper: check if all teammates confirmed and transition team_status -> pending_payment | pending_approval */
async function evaluateAndAdvanceTeamState(ev, team, eventsList) {
  const pendingLeft = (team.pendingEmails || []).length;
  const confirmedCount = (team.memberIds || []).length;
  const minTeam = ev.minTeamSize || 2;
  const requiresPayment = Number(ev.fee || 0) > 0 || Boolean(ev.needsPayment);

  if (pendingLeft === 0 && confirmedCount >= minTeam) {
    if (requiresPayment) {
      if (team.status === 'pending_team') {
        team.status = 'pending_payment';
        team.paymentStatus = 'pending';
        if (team.leaderId) {
          addNotifToUser(
            team.leaderId,
            `All teammates confirmed for "${team.name}" (${ev.name})! Next: upload your Payment Proof.`,
            '💳'
          );
        }
      }
    } else if (team.status !== 'registered') {
      team.status = 'pending_approval';
      team.paymentStatus = 'free';
      if (!ev.pendingPayments) ev.pendingPayments = [];
      let entry = ev.pendingPayments.find(p => String(p.teamId || '') === String(team.id));
      if (!entry) {
        const leaderUser = getDB('vvce_users').find(u => u.id === team.leaderId);
        entry = {
          id: genId('reg'),
          uid: team.leaderId,
          userName: team.leaderName || leaderUser?.name || 'Team Leader',
          userEmail: team.leaderEmail || leaderUser?.email || '',
          usn: leaderUser?.usn || '',
          status: 'pending_approval',
          isTeam: true,
          teamId: team.id,
          teamName: team.name,
          teamData: { teamId: team.id, teamName: team.name, memberDetails: team.memberDetails || [] },
          utrNumber: null,
          screenshot: null,
          submittedAt: new Date().toISOString()
        };
        ev.pendingPayments.push(entry);
      } else {
        entry.status = 'pending_approval';
      }
      if (team.leaderId) {
        addNotifToUser(
          team.leaderId,
          `All teammates confirmed for "${team.name}" (${ev.name})! Submitted for organizer approval.`,
          '📋'
        );
      }
      if (ev.adminId) {
        addNotifToUser(ev.adminId, `Team "${team.name}" confirmed all members for "${ev.name}" and awaits organizer approval.`, '👥');
      }
    }
  } else {
    if (team.status !== 'registered') {
      team.status = 'pending_team';
    }
  }

  await setDB('vvce_events', eventsList);
  await syncEventRegistrationStateToSupabase(ev, {
    uid: team.leaderId,
    userName: team.leaderName,
    userEmail: team.leaderEmail,
    teamId: team.id,
    teamName: team.name,
    isTeam: true,
    teamData: { memberDetails: team.memberDetails || [] },
    status: team.status
  });
}

async function acceptTeamInvite(btn = null) {
  let invite = window._pendingTeamInvite;
  if (!invite) {
    try {
      const saved = sessionStorage.getItem('vvce_pending_invite');
      if (saved) invite = JSON.parse(saved);
    } catch (e) {}
  }
  if (!invite) return;
  const { teamId, eventId, token } = invite;

  if (!STATE.user) {
    toast('Please sign in with your @vvce.ac.in account to confirm your invite.', 'info');
    if (document.getElementById('auth-screen')?.style.display !== 'none') {
      const emailInput = document.getElementById('login-email');
      if (emailInput) {
        emailInput.focus();
        showAuthMsg('Please sign in to confirm your team invite.', 'info');
      }
    }
    return;
  }

  const targetBtn = btn || document.getElementById('invite-banner-btn');
  const origText = targetBtn ? targetBtn.textContent : '';
  if (targetBtn) {
    targetBtn.disabled = true;
    targetBtn.textContent = 'Confirming... ⏳';
  }

  try {
    await syncEventsFromSupabase();
    const events = getDB('vvce_events');
    const ev = events.find(e => String(e.id) === String(eventId));
    if (!ev) {
      toast('Event not found or no longer active.', 'error');
      return;
    }
    const team = (ev.teams || []).find(t => String(t.id) === String(teamId));
    if (!team) {
      toast('Team not found or registration was cancelled.', 'error');
      dismissTeamInviteBanner();
      return;
    }

    const userEmail = (STATE.user.email || '').toLowerCase();
    const isEmailMatch = (team.pendingEmails || []).some(e => e.toLowerCase() === userEmail)
      || (team.memberEmails || []).some(e => e.toLowerCase() === userEmail);

    if (!isEmailMatch) {
      toast(`This invite is for (${(team.memberEmails || []).join(', ')}). Signed in as ${STATE.user.email}.`, 'error', 5000);
      return;
    }

    // Validate token when token was passed in link
    const memberDet = (team.memberDetails || []).find(d => (d.email || '').toLowerCase() === userEmail);
    if (token) {
      const validTeamToken = team.inviteToken && String(token) === String(team.inviteToken);
      const validMemberToken = memberDet?.token && String(token) === String(memberDet.token);
      if (team.inviteToken && !validTeamToken && !validMemberToken) {
        toast('❌ Invalid or outdated team invitation token.', 'error');
        return;
      }
    }

    // Confirm member ONLY inside team (never add to ev.registrations until organizer approval)
    if (!team.memberIds) team.memberIds = [];
    if (!team.memberIds.includes(STATE.user.id)) {
      team.memberIds.push(STATE.user.id);
    }
    team.pendingEmails = (team.pendingEmails || []).filter(e => e.toLowerCase() !== userEmail);
    if (team.pendingMembers) {
      team.pendingMembers = team.pendingMembers.filter(m => (typeof m === 'object' ? m.email : m).toLowerCase() !== userEmail);
    }
    if (memberDet) {
      memberDet.status = 'confirmed';
      memberDet.userId = STATE.user.id;
      memberDet.confirmedAt = new Date().toISOString();
    }

    await evaluateAndAdvanceTeamState(ev, team, events);
    dismissTeamInviteBanner();

    addNotif(`You confirmed your spot in Team "${team.name}" for "${ev.name}"!`, '✅');
    if (team.leaderId) {
      addNotifToUser(team.leaderId, `${STATE.user.name} confirmed and joined Team "${team.name}" (${ev.name})! ✅`, '👥');
    }

    const nextMsg = team.status === 'pending_team'
      ? `Spot confirmed in "${team.name}"! Waiting for remaining teammates.`
      : (team.status === 'pending_payment'
        ? `All members confirmed! Team "${team.name}" is ready for Payment Proof upload.`
        : `All members confirmed! Team "${team.name}" submitted for organizer approval.`);

    toast(nextMsg, 'success', 5500);

    if (STATE.page === 'events') filterEvents();
    if (STATE.page === 'dashboard') renderStudentDashboard();
    if (STATE.page === 'registrations') renderRegistrationsPage();
    if (document.getElementById('modal-manage-team')?.classList.contains('open')) {
      openManageTeamModal(ev.id, team.id);
    }
    if (document.getElementById('modal-event-detail')?.classList.contains('open')) {
      openEventModal(ev.id);
    }
  } finally {
    if (targetBtn) {
      targetBtn.disabled = false;
      targetBtn.textContent = origText;
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   TEAM MANAGEMENT & MEMBER CONTROLS (Resend, Replace, Remove, Add)
───────────────────────────────────────────────────────────────*/
let _currentManageEventId = null;
let _currentManageTeamId = null;

function openManageTeamModal(eventId, teamId) {
  _currentManageEventId = eventId;
  _currentManageTeamId = teamId;

  const events = getDB('vvce_events');
  const ev = events.find(e => String(e.id) === String(eventId));
  if (!ev) return;
  const team = (ev.teams || []).find(t => String(t.id) === String(teamId));
  if (!team) return;

  const allUsers = getDB('vvce_users', []);
  const isLeader = team.leaderId === STATE.user?.id;
  const minTeam = ev.minTeamSize || 2;
  const maxTeam = ev.maxTeamSize || 4;
  const prog = getEventRegistrationProgress(ev, STATE.user);

  const titleEl = document.getElementById('manage-team-title');
  const subEl = document.getElementById('manage-team-sub');
  if (titleEl) titleEl.textContent = `👥 Manage Team: ${team.name}`;
  if (subEl) subEl.textContent = `Event: ${ev.name} • Team size: ${minTeam}–${maxTeam} members`;

  const stepperEl = document.getElementById('manage-team-stepper');
  if (stepperEl) stepperEl.innerHTML = renderRegistrationStepper(ev, prog);

  const lName = document.getElementById('manage-team-leader-name');
  const lEmail = document.getElementById('manage-team-leader-email');
  if (lName) lName.textContent = team.leaderName || 'Team Leader';
  if (lEmail) lEmail.textContent = team.leaderEmail || '';

  const statusBanner = document.getElementById('manage-team-status-banner');
  const pendingCount = (team.pendingEmails || []).length;
  const confirmedMembers = allUsers.filter(u => (team.memberIds || []).includes(u.id) && u.id !== team.leaderId);
  const totalEnrolled = (team.memberIds || []).length + pendingCount;

  if (statusBanner) {
    if (pendingCount > 0) {
      statusBanner.style.background = '#fffbeb';
      statusBanner.style.border = '1px solid #fde68a';
      statusBanner.style.color = '#b45309';
      statusBanner.innerHTML = `<strong>⏳ Step 2 — Team Confirmation:</strong> ${pendingCount} teammate(s) must click their invite link before you can proceed.`;
    } else if (prog.status === 'pending_payment') {
      statusBanner.style.background = '#eff6ff';
      statusBanner.style.border = '1px solid #bfdbfe';
      statusBanner.style.color = '#1d4ed8';
      statusBanner.innerHTML = `<strong>💳 Step 3 — Payment Proof Needed:</strong> All ${totalEnrolled} team members confirmed! Upload your UTR &amp; Payment Screenshot below.`;
    } else if (prog.status === 'pending_approval') {
      statusBanner.style.background = '#eff6ff';
      statusBanner.style.border = '1px solid #bfdbfe';
      statusBanner.style.color = '#1d4ed8';
      statusBanner.innerHTML = `<strong>⏳ Step 4 — Organizer Approval:</strong> All team members &amp; proof submitted. Waiting for club admin confirmation.`;
    } else if (prog.status === 'rejected') {
      statusBanner.style.background = '#fef2f2';
      statusBanner.style.border = '1px solid #fecaca';
      statusBanner.style.color = '#991b1b';
      statusBanner.innerHTML = `<strong>❌ Rejected:</strong> ${escapeHTML(prog.rejectionReason || 'Verification rejected.')} Please re-upload your payment proof.`;
    } else {
      statusBanner.style.background = '#f0fdf4';
      statusBanner.style.border = '1px solid #bbf7d0';
      statusBanner.style.color = '#15803d';
      statusBanner.innerHTML = `<strong>✅ Step 5 — Registered:</strong> Team "${escapeHTML(team.name)}" (${totalEnrolled} members) is officially confirmed!`;
    }
  }

  const cCount = document.getElementById('manage-team-confirmed-count');
  const pCount = document.getElementById('manage-team-pending-count');
  if (cCount) cCount.textContent = (team.memberIds || []).length;
  if (pCount) pCount.textContent = pendingCount;

  // Confirmed Members
  const confirmedListEl = document.getElementById('manage-team-confirmed-list');
  if (confirmedListEl) {
    if (confirmedMembers.length === 0) {
      confirmedListEl.innerHTML = `<div style="font-size:12px; color:#9ca3af; font-style:italic; padding:6px 0;">No teammates have confirmed yet.</div>`;
    } else {
      confirmedListEl.innerHTML = confirmedMembers.map(m => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:6px; font-size:13px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>👤</span>
            <div>
              <div style="font-weight:700; color:#1e293b;">${escapeHTML(m.name)}</div>
              <div style="font-size:11px; color:#64748b;">${escapeHTML(m.email)} ${m.usn ? `• ${escapeHTML(m.usn)}` : ''}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:11px; font-weight:700; color:#15803d; background:#dcfce7; border:1px solid #86efac; padding:3px 10px; border-radius:12px;">✓ Confirmed</span>
            ${isLeader && prog.status !== 'registered' ? `<button type="button" onclick="removeConfirmedTeamMember('${escapeHTML(m.id)}', this)" style="padding:4px 8px; background:#fee2e2; color:#ef4444; border:1px solid #fca5a5; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">Remove</button>` : ''}
          </div>
        </div>
      `).join('');
    }
  }

  // Pending Members
  const pendingListEl = document.getElementById('manage-team-pending-list');
  if (pendingListEl) {
    if ((team.pendingEmails || []).length === 0) {
      pendingListEl.innerHTML = `<div style="font-size:12px; color:#15803d; font-weight:600; padding:6px 0;">🎉 All invited teammates have confirmed!</div>`;
    } else {
      pendingListEl.innerHTML = (team.pendingEmails || []).map(email => {
        const memDetail = (team.memberDetails || team.pendingMembers || []).find(m => (typeof m === 'object' ? m.email : m).toLowerCase() === email.toLowerCase());
        const memName = memDetail?.name || '';
        const memTok = memDetail?.token || team.inviteToken || '';
        return `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:#fffdf5; border:1px solid #fef08a; border-radius:8px; margin-bottom:6px; font-size:13px; flex-wrap:wrap; gap:6px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>✉️</span>
            <div>
              <div style="font-weight:600; color:#374151;">
                ${memName ? `<span style="color:#1e293b; font-weight:700;">${escapeHTML(memName)}</span> • ` : ''}<span>${escapeHTML(email)}</span>
              </div>
              <div style="font-size:11px; color:#b45309;">⏳ Awaiting Teammate Confirmation</div>
            </div>
          </div>
          ${isLeader ? `
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <button type="button" onclick="resendTeamInviteEmail('${escapeHTML(email)}', this)" style="padding:4px 9px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">🔁 Resend Invite</button>
              <button type="button" onclick="copyTeamInviteLink('${escapeHTML(team.id)}','${escapeHTML(ev.id)}','${escapeHTML(escapeStr(memName||email))}','${escapeHTML(escapeStr(memTok))}')" style="padding:4px 9px; background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">📋 Copy Link</button>
              <button type="button" onclick="replaceTeamInvitePrompt('${escapeHTML(email)}', this)" style="padding:4px 9px; background:#f5f3ff; color:#7c3aed; border:1px solid #ddd6fe; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">✏️ Replace</button>
              <button type="button" onclick="removePendingTeamInvite('${escapeHTML(email)}', this)" style="padding:4px 9px; background:#fee2e2; color:#ef4444; border:1px solid #fca5a5; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">🗑️ Remove</button>
            </div>
          ` : `<span style="font-size:10.5px; font-weight:700; color:#b45309; background:#fef3c7; border:1px solid #fde68a; padding:2px 8px; border-radius:10px;">⏳ Pending</span>`}
        </div>
      `;
      }).join('');
    }
  }

  // Add Member box visibility
  const addSection = document.getElementById('manage-team-add-section');
  const errEl = document.getElementById('manage-team-err');
  if (document.getElementById('manage-team-new-name')) document.getElementById('manage-team-new-name').value = '';
  if (document.getElementById('manage-team-new-email')) document.getElementById('manage-team-new-email').value = '';
  if (errEl) errEl.style.display = 'none';
  if (addSection) {
    addSection.style.display = (isLeader && totalEnrolled < maxTeam && prog.status !== 'registered') ? 'block' : 'none';
  }

  // Action bar (Next step / Re-upload payment proof + Done)
  const actBar = document.getElementById('manage-team-action-bar');
  if (actBar) {
    let nextBtn = '';
    if (isLeader && (prog.status === 'pending_payment' || (prog.status === 'rejected' && prog.requiresPayment))) {
      const lbl = prog.status === 'rejected' ? '🔄 Re-upload Payment Proof' : '💳 Proceed to Payment Proof →';
      nextBtn = `<button type="button" onclick="closeModal('modal-manage-team');reopenRegistrationPayment('${ev.id}')" style="flex:2; padding:11px; background:linear-gradient(135deg,#f59e0b,#fbbf24); border:none; border-radius:10px; font-weight:800; font-size:13px; color:#0f172a; cursor:pointer;">${lbl}</button>`;
    }
    actBar.innerHTML = `${nextBtn}<button type="button" onclick="closeModal('modal-manage-team')" style="flex:1; padding:11px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:10px; font-weight:700; font-size:13px; color:#334155; cursor:pointer;">Done</button>`;
  }

  openModal('modal-manage-team');
}

async function resendTeamInviteEmail(email, btn = null) {
  if (!_currentManageEventId || !_currentManageTeamId) return;
  const events = getDB('vvce_events');
  const ev = events.find(e => String(e.id) === String(_currentManageEventId));
  if (!ev) return;
  const team = (ev.teams || []).find(t => String(t.id) === String(_currentManageTeamId));
  if (!team) return;

  const origText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Sending... ⏳'; }

  try {
    const memDetail = (team.memberDetails || team.pendingMembers || []).find(m => (typeof m === 'object' ? m.email : m).toLowerCase() === email.toLowerCase());
    const memName = memDetail?.name || '';
    const tok = memDetail?.token || team.inviteToken || genId('tok');
    if (memDetail && !memDetail.token) memDetail.token = tok;

    const { emailSent } = await dispatchSingleMemberInvite({
      email,
      memberName: memName,
      team,
      ev,
      inviteToken: tok
    });

    if (emailSent) {
      toast(`Invite email resent to ${memName ? memName + ' (' + email + ')' : email}! 🚀`, 'success');
    } else {
      toast(`Notification sent! Use "📋 Copy Link" to share the invite directly with ${memName || email}.`, 'info', 5000);
    }
  } catch (err) {
    toast(`Could not resend invite: ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
  }
}

async function replaceTeamInvitePrompt(oldEmail, btn = null) {
  const events = getDB('vvce_events');
  const ev = events.find(e => String(e.id) === String(_currentManageEventId));
  if (!ev) return;
  const team = (ev.teams || []).find(t => String(t.id) === String(_currentManageTeamId));
  if (!team) return;

  const oldDetail = (team.memberDetails || team.pendingMembers || []).find(m => (typeof m === 'object' ? m.email : m).toLowerCase() === oldEmail.toLowerCase());
  const defaultOldName = oldDetail?.name || '';

  const newNameRaw = prompt(`Enter new teammate's name to replace ${defaultOldName ? defaultOldName + ' (' + oldEmail + ')' : oldEmail}:`, defaultOldName);
  if (!newNameRaw || !newNameRaw.trim()) return;
  const newName = newNameRaw.trim();

  const newEmailRaw = prompt(`Enter new @vvce.ac.in email for ${newName}:`);
  if (!newEmailRaw) return;
  const newEmail = newEmailRaw.trim().toLowerCase();

  if (!/^[a-z0-9._%+-]+@vvce\.ac\.in$/i.test(newEmail)) {
    toast('Only valid @vvce.ac.in email addresses are allowed.', 'error');
    return;
  }
  if (newEmail === STATE.user?.email.toLowerCase()) {
    toast('You are the team leader — cannot add yourself as a member.', 'error');
    return;
  }
  if ((team.memberEmails || []).some(e => e.toLowerCase() === newEmail) || (team.pendingEmails || []).some(e => e.toLowerCase() === newEmail)) {
    toast('This email is already in the team.', 'error');
    return;
  }

  const origText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Replacing... ⏳'; }

  try {
    const newToken = genId('tok');
    team.pendingEmails = (team.pendingEmails || []).map(e => e.toLowerCase() === oldEmail.toLowerCase() ? newEmail : e);
    team.memberEmails = (team.memberEmails || []).map(e => e.toLowerCase() === oldEmail.toLowerCase() ? newEmail : e);

    if (!team.pendingMembers) team.pendingMembers = [];
    const pIdx = team.pendingMembers.findIndex(m => (typeof m === 'object' ? m.email : m).toLowerCase() === oldEmail.toLowerCase());
    if (pIdx >= 0) team.pendingMembers[pIdx] = { name: newName, email: newEmail };
    else team.pendingMembers.push({ name: newName, email: newEmail });

    if (!team.memberDetails) team.memberDetails = [];
    const dIdx = team.memberDetails.findIndex(m => (typeof m === 'object' ? m.email : m).toLowerCase() === oldEmail.toLowerCase());
    if (dIdx >= 0) team.memberDetails[dIdx] = { name: newName, email: newEmail, status: 'pending', token: newToken };
    else team.memberDetails.push({ name: newName, email: newEmail, status: 'pending', token: newToken });

    await setDB('vvce_events', events);
    await syncEventRegistrationStateToSupabase(ev);
    await dispatchSingleMemberInvite({ email: newEmail, memberName: newName, team, ev, inviteToken: newToken });

    toast(`Replaced with ${newName} (${newEmail}) and sent invite! 🎉`, 'success');
    openManageTeamModal(_currentManageEventId, _currentManageTeamId);
    if (STATE.page === 'registrations') renderRegistrationsPage();
    if (STATE.page === 'dashboard') renderStudentDashboard();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
  }
}

async function removePendingTeamInvite(email, btn = null) {
  if (!confirm(`Remove invite for ${email}?`)) return;
  const origText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Removing...'; }

  try {
    const events = getDB('vvce_events');
    const ev = events.find(e => String(e.id) === String(_currentManageEventId));
    if (!ev) return;
    const team = (ev.teams || []).find(t => String(t.id) === String(_currentManageTeamId));
    if (!team) return;

    const minTeam = ev.minTeamSize || 2;
    const afterTotal = (team.memberIds || []).length + ((team.pendingEmails || []).length - 1);
    if (afterTotal < minTeam) {
      toast(`⚠️ Removing this member drops team below the minimum of ${minTeam}. Replace instead or cancel team.`, 'warning', 5000);
      return;
    }

    team.pendingEmails = (team.pendingEmails || []).filter(e => e.toLowerCase() !== email.toLowerCase());
    team.memberEmails = (team.memberEmails || []).filter(e => e.toLowerCase() !== email.toLowerCase());
    if (team.pendingMembers) team.pendingMembers = team.pendingMembers.filter(m => (typeof m === 'object' ? m.email : m).toLowerCase() !== email.toLowerCase());
    if (team.memberDetails) team.memberDetails = team.memberDetails.filter(m => (typeof m === 'object' ? m.email : m).toLowerCase() !== email.toLowerCase());

    await evaluateAndAdvanceTeamState(ev, team, events);
    toast(`Invite for ${email} removed.`, 'info');
    openManageTeamModal(_currentManageEventId, _currentManageTeamId);
    if (STATE.page === 'registrations') renderRegistrationsPage();
    if (STATE.page === 'dashboard') renderStudentDashboard();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
  }
}

async function removeConfirmedTeamMember(memberId, btn = null) {
  if (!confirm('Remove this confirmed member from your team?')) return;
  const origText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Removing...'; }

  try {
    const events = getDB('vvce_events');
    const ev = events.find(e => String(e.id) === String(_currentManageEventId));
    if (!ev) return;
    const team = (ev.teams || []).find(t => String(t.id) === String(_currentManageTeamId));
    if (!team) return;

    const minTeam = ev.minTeamSize || 2;
    const afterTotal = ((team.memberIds || []).length - 1) + (team.pendingEmails || []).length;
    if (afterTotal < minTeam) {
      toast(`⚠️ Removing this member drops team below minimum size (${minTeam}). Add a replacement member first.`, 'warning', 5000);
      return;
    }

    const removedUser = getDB('vvce_users', []).find(u => u.id === memberId);
    team.memberIds = (team.memberIds || []).filter(id => id !== memberId);
    if (removedUser) {
      team.memberEmails = (team.memberEmails || []).filter(e => e.toLowerCase() !== removedUser.email.toLowerCase());
      if (team.memberDetails) team.memberDetails = team.memberDetails.filter(m => (typeof m === 'object' ? m.email : m).toLowerCase() !== removedUser.email.toLowerCase());
    }
    ev.registrations = (ev.registrations || []).filter(id => id !== memberId);
    ev.regCount = ev.registrations.length;

    await evaluateAndAdvanceTeamState(ev, team, events);
    if (removedUser) {
      addNotifToUser(memberId, `You were removed from team "${team.name}" for "${ev.name}" by the team leader.`, '👥');
    }
    toast('Member removed from team.', 'info');
    openManageTeamModal(_currentManageEventId, _currentManageTeamId);
    if (STATE.page === 'registrations') renderRegistrationsPage();
    if (STATE.page === 'dashboard') renderStudentDashboard();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
  }
}

async function manageTeamAddMember(btn = null) {
  const nameInput = document.getElementById('manage-team-new-name');
  const emailInput = document.getElementById('manage-team-new-email');
  const errEl = document.getElementById('manage-team-err');
  const name = (nameInput?.value || '').trim();
  const email = (emailInput?.value || '').trim().toLowerCase();
  if (errEl) errEl.style.display = 'none';

  if (!name) {
    if (errEl) { errEl.textContent = '❌ Please enter teammate\'s name.'; errEl.style.display = 'block'; }
    nameInput?.focus();
    return;
  }
  if (!email || !/^[a-z0-9._%+-]+@vvce\.ac\.in$/i.test(email)) {
    if (errEl) { errEl.textContent = '❌ Only valid @vvce.ac.in email addresses are allowed.'; errEl.style.display = 'block'; }
    emailInput?.focus();
    return;
  }
  if (email === STATE.user?.email.toLowerCase()) {
    if (errEl) { errEl.textContent = '❌ You are already the team leader.'; errEl.style.display = 'block'; }
    return;
  }

  const events = getDB('vvce_events');
  const ev = events.find(e => String(e.id) === String(_currentManageEventId));
  if (!ev) return;
  const team = (ev.teams || []).find(t => String(t.id) === String(_currentManageTeamId));
  if (!team) return;

  const totalMembers = (team.memberIds || []).length + (team.pendingEmails || []).length;
  const maxTeam = ev.maxTeamSize || 4;
  if (totalMembers >= maxTeam) {
    if (errEl) { errEl.textContent = `❌ Maximum team size is ${maxTeam} members.`; errEl.style.display = 'block'; }
    return;
  }
  if ((team.memberEmails || []).some(e => e.toLowerCase() === email) || (team.pendingEmails || []).some(e => e.toLowerCase() === email)) {
    if (errEl) { errEl.textContent = '❌ This email is already in the team.'; errEl.style.display = 'block'; }
    return;
  }

  const addBtn = btn || document.querySelector('#manage-team-add-section button');
  const origText = addBtn ? addBtn.textContent : '';
  if (addBtn) { addBtn.disabled = true; addBtn.textContent = 'Inviting... ⏳'; }

  try {
    const token = genId('tok');
    if (!team.pendingEmails) team.pendingEmails = [];
    if (!team.memberEmails) team.memberEmails = [];
    if (!team.pendingMembers) team.pendingMembers = [];
    if (!team.memberDetails) team.memberDetails = [];

    team.pendingEmails.push(email);
    team.memberEmails.push(email);
    team.pendingMembers.push({ name, email });
    team.memberDetails.push({ name, email, status: 'pending', token });
    team.status = 'pending_team';

    await setDB('vvce_events', events);
    await syncEventRegistrationStateToSupabase(ev);
    const { emailSent } = await dispatchSingleMemberInvite({ email, memberName: name, team, ev, inviteToken: token });

    toast(emailSent ? `Invite sent to ${name} (${email})! 🎉` : `Added ${name}! Use "📋 Copy Link" to share invite.`, 'success');

    if (nameInput) nameInput.value = '';
    if (emailInput) emailInput.value = '';
    openManageTeamModal(_currentManageEventId, _currentManageTeamId);
    if (STATE.page === 'registrations') renderRegistrationsPage();
    if (STATE.page === 'dashboard') renderStudentDashboard();
  } finally {
    if (addBtn) { addBtn.disabled = false; addBtn.textContent = origText; }
  }
}

/* ─────────────────────────────────────────────────────────────
   WAITLIST
───────────────────────────────────────────────────────────────*/
function joinWaitlist(id) {
  if (STATE.registrationLocked) {
    toast('Event registrations are temporarily paused by administration.', 'warning');
    return;
  }
  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  if (!ev.waitlist) ev.waitlist = [];
  if (ev.waitlist.includes(STATE.user.id)) {
    toast('You are already on the waitlist for this event.', 'info');
    return;
  }
  ev.waitlist.push(STATE.user.id);
  setDB('vvce_events', events);
  const sb = getSupabaseClient();
  if (sb) {
    sb.from('events').update({ waitlist: ev.waitlist }).eq('id', id).catch(() => {});
  }
  addNotif(`You have been added to the waitlist for ${ev.name}. You will be notified if a slot opens up.`, '⏳');
  toast('Added to waitlist! You will be notified if a seat opens up.', 'success');
  if (STATE.page === 'events') renderEventsPage();
  else if (STATE.page === 'clubs') renderClubsDirectoryPage();
}

/* ─────────────────────────────────────────────────────────────
   PAYMENT PROOF UPLOAD (UTR + Supabase Storage bucket 'payment-proofs')
───────────────────────────────────────────────────────────────*/
let currentPaymentEvent = null;
let currentPaymentTeam = null;
let _stagedPaymentBlob = null;
let _stagedPaymentDataUrl = null;

window.reopenRegistrationPayment = function(eventId) {
  const ev = getDB('vvce_events').find(e => String(e.id) === String(eventId));
  if (!ev) return;
  const prog = getEventRegistrationProgress(ev, STATE.user);
  if (prog.isGroup && !prog.isLeader && prog.team) {
    toast(`Only team leader (${prog.team.leaderName}) can submit or re-upload team payment proof.`, 'info', 4500);
    return;
  }
  if (!prog.requiresPayment && prog.status === 'rejected') {
    submitSoloApprovalRequest(ev);
    return;
  }
  openPaymentModal(ev, prog.team, prog.rejectionReason);
};

function openPaymentModal(ev, teamObj = null, rejectionReason = null) {
  currentPaymentEvent = ev;
  currentPaymentTeam = teamObj || (STATE.pendingTeamReg?.evId === ev.id ? { id: STATE.pendingTeamReg.teamId, name: STATE.pendingTeamReg.teamName } : null);
  _stagedPaymentBlob = null;
  _stagedPaymentDataUrl = null;

  document.getElementById('pmt-ev-name').textContent = currentPaymentTeam ? `${ev.name} • Team: ${currentPaymentTeam.name}` : ev.name;
  document.getElementById('pmt-amount').textContent = Number(ev.fee || 0) > 0 ? `₹${ev.fee}` : 'Verification Required';

  const upiEl = document.getElementById('pmt-upi-id');
  if (ev.adminUpiId) {
    upiEl.textContent = ev.adminUpiId;
    upiEl.style.color = '#10b981';
  } else {
    upiEl.textContent = 'Not configured — contact club directly';
    upiEl.style.color = '#ef4444';
  }

  const prog = getEventRegistrationProgress(ev, STATE.user);
  const stepperEl = document.getElementById('pmt-stepper');
  if (stepperEl) {
    stepperEl.innerHTML = renderRegistrationStepper(ev, {
      ...prog,
      status: rejectionReason ? 'rejected' : 'pending_payment'
    });
  }

  const rejBanner = document.getElementById('pmt-rejection-banner');
  if (rejBanner) {
    if (rejectionReason) {
      rejBanner.style.display = 'block';
      rejBanner.innerHTML = `<strong>❌ Previous Submission Rejected:</strong> ${escapeHTML(rejectionReason)}<br><span style="font-size:11.5px;">Please enter a valid Transaction ID / UTR and upload a clear payment screenshot.</span>`;
    } else {
      rejBanner.style.display = 'none';
      rejBanner.innerHTML = '';
    }
  }

  const utrInp = document.getElementById('pmt-utr-input');
  if (utrInp) utrInp.value = prog.pmt?.utrNumber || '';
  const shotPreview = document.getElementById('pmt-screenshot-preview');
  if (shotPreview) { shotPreview.style.display = 'none'; shotPreview.src = ''; }
  const shotLbl = document.getElementById('pmt-screenshot-label');
  if (shotLbl) shotLbl.textContent = 'Click to select payment screenshot (JPG/PNG)';
  const shotInp = document.getElementById('pmt-screenshot-input');
  if (shotInp) shotInp.value = '';
  const errEl = document.getElementById('pmt-err');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  const statusEl = document.getElementById('pmt-status');
  if (statusEl) { statusEl.style.display = 'none'; statusEl.innerHTML = ''; }

  openModal('modal-payment');
}

/* Compress screenshot image cleanly with Canvas and stage preview + blob */
window.handleScreenshotUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      const MAX = 900;
      if (w > h && w > MAX) { h *= MAX / w; w = MAX; }
      else if (h > MAX) { w *= MAX / h; h = MAX; }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      _stagedPaymentDataUrl = canvas.toDataURL('image/jpeg', 0.65);
      canvas.toBlob(blob => { _stagedPaymentBlob = blob; }, 'image/jpeg', 0.65);

      const previewEl = document.getElementById('pmt-screenshot-preview');
      if (previewEl) {
        previewEl.src = _stagedPaymentDataUrl;
        previewEl.style.display = 'block';
      }
      const lblEl = document.getElementById('pmt-screenshot-label');
      if (lblEl) lblEl.textContent = `📎 ${file.name} (ready)`;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

async function uploadPaymentScreenshotToStorage(evId, userId) {
  const sb = getSupabaseClient();
  if (sb && sb.storage && _stagedPaymentBlob) {
    try {
      const filePath = `${evId}/${userId}_${Date.now()}.jpg`;
      const { error: upErr } = await sb.storage
        .from('payment-proofs')
        .upload(filePath, _stagedPaymentBlob, { contentType: 'image/jpeg', upsert: true });

      if (!upErr) {
        const { data: pubData } = sb.storage.from('payment-proofs').getPublicUrl(filePath);
        if (pubData?.publicUrl) {
          return pubData.publicUrl;
        }
      } else {
        console.warn('Supabase storage upload warning (using compressed inline fallback):', upErr.message);
      }
    } catch (e) {
      console.warn('Payment proof bucket fallback:', e);
    }
  }
  return _stagedPaymentDataUrl;
}

window.submitPaymentProofForm = async function() {
  if (!currentPaymentEvent) return;
  const errEl = document.getElementById('pmt-err');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

  const utr = (document.getElementById('pmt-utr-input')?.value || '').trim();
  if (!utr || utr.length < 6) {
    if (errEl) {
      errEl.textContent = '❌ Please enter a valid Transaction ID / UTR number (at least 6 characters).';
      errEl.style.display = 'block';
    }
    document.getElementById('pmt-utr-input')?.focus();
    return;
  }
  if (!_stagedPaymentDataUrl) {
    if (errEl) {
      errEl.textContent = '❌ Please upload your payment screenshot image.';
      errEl.style.display = 'block';
    }
    return;
  }

  const submitBtn = document.getElementById('btn-submit-payment-proof');
  const origLabel = submitBtn ? submitBtn.textContent : 'Submit Payment Proof for Approval →';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading Proof... ⏳';
  }

  try {
    const events = getDB('vvce_events');
    const dbEv = events.find(e => e.id === currentPaymentEvent.id);
    if (!dbEv) return;

    const screenshotUrlOrData = await uploadPaymentScreenshotToStorage(dbEv.id, STATE.user.id);
    const submittedAt = new Date().toISOString();
    const team = currentPaymentTeam?.id
      ? (dbEv.teams || []).find(t => String(t.id) === String(currentPaymentTeam.id))
      : null;

    if (!dbEv.pendingPayments) dbEv.pendingPayments = [];
    dbEv.pendingPayments = dbEv.pendingPayments.filter(p =>
      !(p.uid === STATE.user.id && (!team || !p.teamId || String(p.teamId) === String(team.id)))
    );

    const paymentObj = {
      id: genId('reg'),
      uid: STATE.user.id,
      userName: STATE.user.name,
      userEmail: STATE.user.email,
      usn: STATE.user.usn || '',
      status: 'pending_approval',
      isTeam: Boolean(team),
      teamId: team ? team.id : null,
      teamName: team ? team.name : null,
      teamData: team ? { teamId: team.id, teamName: team.name, memberDetails: team.memberDetails || [] } : null,
      utrNumber: utr,
      screenshot: screenshotUrlOrData,
      rejectionReason: null,
      date: submittedAt,
      submittedAt
    };
    dbEv.pendingPayments.push(paymentObj);

    if (team) {
      team.status = 'pending_approval';
      team.paymentStatus = 'submitted';
      team.utrNumber = utr;
      team.screenshot = screenshotUrlOrData;
      team.rejectionReason = null;
      team.submittedAt = submittedAt;
    }

    await setDB('vvce_events', events);
    await syncEventRegistrationStateToSupabase(dbEv, paymentObj);

    STATE.pendingTeamReg = null;
    _stagedPaymentBlob = null;
    _stagedPaymentDataUrl = null;
    closeModal('modal-payment');

    toast('Payment proof submitted! Awaiting organizer verification. ⏳', 'success', 5000);
    addNotif(`Your payment proof (UTR: ${utr}) for "${dbEv.name}" is awaiting organizer verification.`, '⏳');
    if (dbEv.adminId) {
      addNotifToUser(
        dbEv.adminId,
        `${titleCase(STATE.user.name)} submitted payment proof (UTR: ${utr}) for "${dbEv.name}".`,
        '💳'
      );
    }

    if (STATE.page === 'events') filterEvents();
    if (STATE.page === 'dashboard') renderStudentDashboard();
    if (STATE.page === 'registrations') renderRegistrationsPage();
    if (document.getElementById('modal-event-detail')?.classList.contains('open')) {
      openEventModal(dbEv.id);
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = origLabel;
    }
  }
};

function simulatePayment(method) {
  if (!currentPaymentEvent) return;
  const ev = currentPaymentEvent;
  const statusEl = document.getElementById('pmt-status');
  statusEl.style.display = 'block';
  statusEl.style.color = '#374151';

  const upiId = ev.adminUpiId || 'vvce@sbi';
  const name = encodeURIComponent(ev.club || 'VVCE Event');
  const amount = ev.fee || 0;
  const upiLink = `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR`;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    let appLink = upiLink;
    if (method === 'GPay') appLink = `gpay://upi/pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR`;
    else if (method === 'PhonePe') appLink = `phonepe://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR`;
    window.location.href = appLink;
    statusEl.innerHTML = `<div style="font-size:12.5px;color:#1d4ed8;background:#eff6ff;padding:8px 10px;border-radius:8px;border:1px solid #bfdbfe;">Opening ${escapeHTML(method)}... After paying, enter your Transaction ID / UTR and attach the screenshot below.</div>`;
  } else {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiLink)}`;
    statusEl.innerHTML = `
      <div style="text-align:center;padding:8px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
        <img src="${qrUrl}" alt="UPI QR Code" style="width:155px;height:155px;border-radius:8px;border:1px solid #e2e8f0;padding:4px;background:#fff;margin-bottom:6px;">
        <div style="font-size:12px;color:#475569;font-weight:600;">Scan QR with any UPI app, then submit UTR &amp; screenshot below.</div>
      </div>`;
  }
}

/* ─────────────────────────────────────────────────────────────
   DYNAMIC REGISTRATION DISPATCH (Solo maxTeamSize === 1 vs Group > 1)
───────────────────────────────────────────────────────────────*/
function registerEv(id) {
  if (STATE.registrationLocked) {
    toast('Event registrations are temporarily paused by administration.', 'warning');
    return;
  }
  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === id);
  if (!ev) return;

  const prog = getEventRegistrationProgress(ev, STATE.user);
  if (prog.status === 'registered') {
    toast('Already registered!', 'info');
    return;
  }
  if (prog.status === 'pending_payment' || (prog.status === 'rejected' && prog.requiresPayment)) {
    reopenRegistrationPayment(ev.id);
    return;
  }
  if (prog.status === 'pending_team' && prog.team) {
    if (prog.isPendingInvite) {
      window._pendingTeamInvite = { teamId: prog.team.id, eventId: ev.id, token: prog.team.inviteToken || '' };
      acceptTeamInvite();
    } else if (prog.isLeader) {
      openManageTeamModal(ev.id, prog.team.id);
    } else {
      openEventModal(ev.id);
    }
    return;
  }
  if (prog.status === 'pending_approval') {
    toast('Your registration is awaiting organizer approval.', 'info');
    openEventModal(ev.id);
    return;
  }

  const currentRegCount = (ev.registrations || []).length;
  const maxCap = ev.max_participants || ev.maxParticipants || 100;
  if (currentRegCount >= maxCap) {
    if (ev.waitlist_enabled) {
      joinWaitlist(id);
    } else {
      toast('Event capacity is full.', 'warning');
    }
    return;
  }

  // Dynamic branching strictly by maxTeamSize
  const isGroupEvent = Boolean(ev.isTeamEvent && Number(ev.maxTeamSize || 1) > 1);
  if (isGroupEvent) {
    openTeamRegisterModal(ev);
    return;
  }

  // Solo (maxTeamSize === 1): skip team steps completely
  const requiresPayment = Number(ev.fee || 0) > 0 || Boolean(ev.needsPayment);
  if (requiresPayment) {
    openPaymentModal(ev);
  } else {
    submitSoloApprovalRequest(ev);
  }
}

async function submitSoloApprovalRequest(ev) {
  const events = getDB('vvce_events');
  const dbEv = events.find(e => e.id === ev.id);
  if (!dbEv) return;

  if (!dbEv.pendingPayments) dbEv.pendingPayments = [];
  dbEv.pendingPayments = dbEv.pendingPayments.filter(p => p.uid !== STATE.user.id || p.isTeam);

  const submittedAt = new Date().toISOString();
  const reqObj = {
    id: genId('reg'),
    uid: STATE.user.id,
    userName: STATE.user.name,
    userEmail: STATE.user.email,
    usn: STATE.user.usn || '',
    status: 'pending_approval',
    isTeam: false,
    teamId: null,
    teamName: null,
    utrNumber: null,
    screenshot: null,
    rejectionReason: null,
    date: submittedAt,
    submittedAt
  };
  dbEv.pendingPayments.push(reqObj);

  await setDB('vvce_events', events);
  await syncEventRegistrationStateToSupabase(dbEv, reqObj);

  addNotif(`Registration submitted for "${dbEv.name}" — awaiting organizer confirmation.`, '⏳');
  if (dbEv.adminId) {
    addNotifToUser(dbEv.adminId, `${titleCase(STATE.user.name)} requested registration for "${dbEv.name}".`, '📋');
  }
  toast(`Submitted for organizer approval! ⏳`, 'success', 4500);

  if (STATE.page === 'events') filterEvents();
  if (STATE.page === 'dashboard') renderStudentDashboard();
  if (STATE.page === 'registrations') renderRegistrationsPage();
  if (document.getElementById('modal-event-detail')?.classList.contains('open')) {
    openEventModal(dbEv.id);
  }
}

async function unregisterEv(id) {
  if (!confirm('Cancel your registration for this event?')) return;
  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === id);
  if (!ev) return;

  const userId = STATE.user.id;
  const userEmail = (STATE.user.email || '').toLowerCase();

  ev.registrations = (ev.registrations || []).filter(uid => uid !== userId);
  ev.pendingPayments = (ev.pendingPayments || []).filter(p => p.uid !== userId);

  if (ev.isTeamEvent && ev.teams) {
    const ownedDraftTeams = ev.teams.filter(t => t.leaderId === userId && t.status !== 'registered');
    ownedDraftTeams.forEach(t => {
      ev.pendingPayments = ev.pendingPayments.filter(p => String(p.teamId || '') !== String(t.id));
    });
    ev.teams = ev.teams.filter(t => !(t.leaderId === userId && t.status !== 'registered'));
    ev.teams.forEach(t => {
      if (t.memberIds && t.memberIds.includes(userId)) {
        t.memberIds = t.memberIds.filter(uid => uid !== userId);
        if (userEmail && t.pendingEmails && !t.pendingEmails.includes(userEmail)) {
          t.pendingEmails.push(userEmail);
        }
        if (t.status !== 'registered') t.status = 'pending_team';
      }
    });
  }
  ev.regCount = ev.registrations.length;

  await setDB('vvce_events', events);
  await syncEventRegistrationStateToSupabase(ev);
  const sb = getSupabaseClient();
  if (sb && typeof sb.from === 'function') {
    await sb.from('event_registrations').delete().eq('event_id', id).eq('user_id', userId).catch(() => {});
  }

  toast('Registration cancelled.', 'info');
  if (STATE.page === 'events') filterEvents();
  if (STATE.page === 'dashboard') renderStudentDashboard();
  if (STATE.page === 'registrations') renderRegistrationsPage();
}

function openEventModal(id) {
  const ev   = getDB('vvce_events').find(e => e.id === id);
  if (!ev) return;
  const user  = STATE.user;
  const prog  = getEventRegistrationProgress(ev, user);
  const currentRegCount = (ev.registrations || []).length;
  const maxCap = ev.max_participants || ev.maxParticipants || 100;
  const isFull = currentRegCount >= maxCap;

  let teamInfoHtml = '';
  if (prog.isGroup && prog.team && user) {
    const myTeam = prog.team;
    const isLeader = prog.isLeader;
    const isConfirmed = isLeader || (myTeam.memberIds || []).includes(user.id);
    const pendingCount = (myTeam.pendingEmails || []).length;
    const confirmedCount = (myTeam.memberIds || []).length;
    const totalTeam = confirmedCount + pendingCount;
    const allUsers = getDB('vvce_users', []);
    const confirmedUsers = allUsers.filter(u => (myTeam.memberIds || []).includes(u.id));

    teamInfoHtml = `
      <div style="background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:12px;padding:14px 16px;margin-bottom:1rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span style="font-weight:800;color:#6d28d9;font-size:14px;">👥 Team: ${escapeHTML(myTeam.name)}</span>
          <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px;background:${isLeader ? '#7c3aed;color:#fff;' : '#ede9fe;color:#6d28d9;'}">${isLeader ? '👑 Team Leader' : (isConfirmed ? '👤 Confirmed Member' : '⏳ Invited Member')}</span>
        </div>

        <div style="font-size:12px;color:#4b5563;margin-bottom:10px;">
          Leader: <strong>${escapeHTML(myTeam.leaderName)}</strong> &bull; Roster Status:
          <span style="font-weight:700;color:${pendingCount === 0 ? '#10b981' : '#f59e0b'}">${pendingCount === 0 ? `✅ All ${totalTeam} Members Confirmed` : `⏳ ${confirmedCount}/${totalTeam} Confirmed (${pendingCount} Pending)`}</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #e2e8f0;padding:6px 10px;border-radius:8px;font-size:12px;">
            <span style="font-weight:600;color:#1e293b;">👑 ${escapeHTML(myTeam.leaderName)} <span style="font-size:11px;color:#64748b;">(${escapeHTML(myTeam.leaderEmail)})</span></span>
            <span style="font-size:10.5px;font-weight:700;color:#15803d;background:#dcfce7;border:1px solid #86efac;padding:2px 8px;border-radius:10px;">✓ Leader</span>
          </div>

          ${confirmedUsers.filter(u => u.id !== myTeam.leaderId).map(u => `
            <div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #e2e8f0;padding:6px 10px;border-radius:8px;font-size:12px;">
              <span style="font-weight:600;color:#1e293b;">👤 ${escapeHTML(u.name)} <span style="font-size:11px;color:#64748b;">(${escapeHTML(u.email)})</span></span>
              <span style="font-size:10.5px;font-weight:700;color:#15803d;background:#dcfce7;border:1px solid #86efac;padding:2px 8px;border-radius:10px;">✓ Confirmed</span>
            </div>
          `).join('')}

          ${(myTeam.pendingEmails || []).map(email => {
            const det = (myTeam.memberDetails || myTeam.pendingMembers || []).find(d => (typeof d === 'object' ? d.email : d).toLowerCase() === email.toLowerCase());
            const name = det?.name || '';
            return `
              <div style="display:flex;align-items:center;justify-content:space-between;background:#fffdf5;border:1px solid #fef08a;padding:6px 10px;border-radius:8px;font-size:12px;">
                <span style="font-weight:500;color:#78350f;">✉️ ${name ? `<strong style="color:#1e293b;">${escapeHTML(name)}</strong> • ` : ''}${escapeHTML(email)}</span>
                <span style="font-size:10.5px;font-weight:700;color:#b45309;background:#fef3c7;border:1px solid #fde68a;padding:2px 8px;border-radius:10px;">⏳ Invite Pending</span>
              </div>
            `;
          }).join('')}
        </div>

        ${isLeader ? `
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <button onclick="closeModal('modal-event-detail');openManageTeamModal('${escapeHTML(ev.id)}','${escapeHTML(myTeam.id)}')" style="padding:6px 12px;background:#7c3aed;color:#fff;border:none;border-radius:6px;font-weight:700;font-size:11.5px;cursor:pointer;">
              ✏️ Manage / Resend / Replace Team
            </button>
          </div>
        ` : (prog.isPendingInvite ? `
          <div style="margin-top:10px;">
            <button onclick="window._pendingTeamInvite={teamId:'${escapeHTML(myTeam.id)}',eventId:'${escapeHTML(ev.id)}',token:'${escapeHTML(myTeam.inviteToken||'')}'};acceptTeamInvite(this);" style="padding:8px 14px;background:#15803d;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;">
              ✅ Confirm Attendance / Accept Invite
            </button>
          </div>
        ` : '')}
      </div>
    `;
  }

  let modalActionHtml = '';
  if (user?.type === 'student') {
    if (prog.status === 'registered') {
      modalActionHtml = `
        <button onclick="unregisterEv('${ev.id}');closeModal('modal-event-detail')" class="btn btn-outline" style="flex:1;">Unregister</button>
        <div style="flex:2;padding:11px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;text-align:center;font-weight:700;font-size:14px;color:#15803d;">✓ Registered &amp; Confirmed</div>`;
    } else if (prog.status === 'pending_team') {
      modalActionHtml = `
        <button onclick="unregisterEv('${ev.id}');closeModal('modal-event-detail')" class="btn btn-outline" style="flex:1;">Cancel</button>
        <div style="flex:2;padding:11px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;text-align:center;font-weight:700;font-size:13px;color:#b45309;">⏳ Waiting for Teammates to Confirm</div>`;
    } else if (prog.status === 'pending_payment') {
      modalActionHtml = `
        <button onclick="unregisterEv('${ev.id}');closeModal('modal-event-detail')" class="btn btn-outline" style="flex:1;">Cancel</button>
        <button onclick="closeModal('modal-event-detail');reopenRegistrationPayment('${ev.id}')" style="flex:2;padding:11px;background:linear-gradient(135deg,#f59e0b,#fbbf24);border:none;border-radius:8px;font-weight:800;font-size:14px;color:#0f172a;cursor:pointer;">💳 Upload Payment Proof →</button>`;
    } else if (prog.status === 'pending_approval') {
      modalActionHtml = `
        <button onclick="unregisterEv('${ev.id}');closeModal('modal-event-detail')" class="btn btn-outline" style="flex:1;">Withdraw</button>
        <div style="flex:2;padding:11px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;text-align:center;font-weight:700;font-size:13.5px;color:#1d4ed8;">⏳ Pending Organizer Approval</div>`;
    } else if (prog.status === 'rejected') {
      const btnText = prog.requiresPayment ? '🔄 Re-upload Payment Proof' : '🔄 Resubmit for Approval';
      modalActionHtml = `
        <button onclick="unregisterEv('${ev.id}');closeModal('modal-event-detail')" class="btn btn-outline" style="flex:1;">Cancel</button>
        <button onclick="closeModal('modal-event-detail');reopenRegistrationPayment('${ev.id}')" style="flex:2;padding:11px;background:#ef4444;border:none;border-radius:8px;font-weight:800;font-size:13.5px;color:#fff;cursor:pointer;">${btnText}</button>`;
    } else if (STATE.registrationLocked) {
      modalActionHtml = `<div style="flex:1;padding:11px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;text-align:center;font-weight:700;color:#64748b;">🔒 Registrations Paused by Admin</div>`;
    } else if (isFull) {
      modalActionHtml = ev.waitlist_enabled
        ? `<button onclick="joinWaitlist('${ev.id}');closeModal('modal-event-detail')" style="flex:1;padding:11px;background:#f59e0b;border:none;border-radius:8px;font-weight:700;color:#fff;cursor:pointer;">⏳ Join Waitlist</button>`
        : `<div style="flex:1;padding:11px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;text-align:center;font-weight:700;color:#991b1b;">Event Full</div>`;
    } else {
      modalActionHtml = `<button onclick="closeModal('modal-event-detail');registerEv('${ev.id}')" style="flex:1;padding:11px;background:linear-gradient(135deg,#f59e0b,#fbbf24);border:none;border-radius:8px;font-weight:800;font-size:14px;color:#0f172a;cursor:pointer;">Register Now →</button>`;
    }
  }

  document.getElementById('modal-event-title').textContent = ev.name;
  document.getElementById('modal-event-body').innerHTML = `
    <div style="background:linear-gradient(135deg,#1e2a3d,#0f172a);border-radius:12px;height:160px;display:flex;align-items:center;justify-content:center;font-size:80px;margin-bottom:1.25rem;position:relative;overflow:hidden;">
      ${ev.poster?`<img src="${sanitizeUrl(ev.poster)}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;">`:`<span>${escapeHTML(ev.emoji||'🎓')}</span>`}
    </div>
    ${user?.type === 'student' ? `<div style="margin-bottom:1rem;">${renderRegistrationStepper(ev, prog)}</div>` : ''}
    ${prog.status === 'rejected' && prog.rejectionReason ? `
      <div style="background:#fef2f2;border:1.5px solid #fecaca;color:#991b1b;padding:10px 14px;border-radius:10px;font-size:12.5px;margin-bottom:1rem;">
        <strong>❌ Registration / Payment Rejected:</strong> ${escapeHTML(prog.rejectionReason)}
      </div>` : ''}
    ${teamInfoHtml}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1rem;">
      ${detailChip('📅','Date',formatDate(ev.date))}
      ${detailChip('🕐','Time',formatEventTimeSlot(ev))}
      ${detailChip('📍','Venue',ev.venue)}
      ${detailChip('👥','Capacity', prog.isGroup ? `${(ev.teams||[]).filter(t => t.status === 'registered').length} confirmed teams (${currentRegCount}/${maxCap} people)` : `${currentRegCount}/${maxCap} seats`)}
      ${prog.isGroup ? detailChip('👥','Team Size', `${ev.minTeamSize || 2}–${ev.maxTeamSize || 4} members`) : detailChip('👤','Participation', 'Solo Event')}
      ${detailChip('🎓','Target Branches',(ev.branches && ev.branches.length > 0) ? (ev.branches.includes('All') ? 'All Branches' : ev.branches.join(', ')) : 'All Branches')}
      <div style="grid-column:1/-1;">${detailChip('💰','Fee',ev.fee>0?`₹${ev.fee}`:(ev.needsPayment ? 'Payment Proof Required' : 'FREE'))}</div>
    </div>
    ${ev.desc?`
      <div style="background:#fffdf5;border:1.5px solid #fef08a;border-left:5px solid #f59e0b;border-radius:10px;padding:14px 16px;margin-bottom:1rem;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div style="font-size:11.5px;font-weight:800;color:#b45309;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
          📝 Event Description
        </div>
        <p style="font-size:13.5px;color:#1e293b;line-height:1.75;white-space:pre-line;margin:0;font-weight:500;">${escapeHTML(ev.desc)}</p>
      </div>`:''}
    ${ev.speakers?`<div style="font-size:12px;color:#6b7280;margin-bottom:10px;background:#f8fafc;padding:8px 12px;border-radius:6px;border:1px solid #e2e8f0;">🎙️ Speakers: <strong style="color:#111827;">${escapeHTML(ev.speakers)}</strong></div>`:''}
    ${ev.rules?`
      <div style="background:#fef2f2;border:1.5px solid #fecaca;border-left:5px solid #ef4444;border-radius:10px;padding:14px 16px;margin-bottom:1rem;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div style="font-size:11.5px;font-weight:800;color:#b91c1c;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
          ⚖️ Important Rules &amp; Guidelines
        </div>
        <p style="font-size:13.5px;color:#1e293b;line-height:1.75;white-space:pre-line;margin:0;font-weight:500;">${escapeHTML(ev.rules)}</p>
      </div>`:''}
    <div style="font-size:12px;color:#6b7280;margin-bottom:1rem;">Organized by: <strong style="color:#111827;">${escapeHTML(ev.club)}</strong></div>
    ${user?.type === 'student' ? `<div style="display:flex;gap:10px;margin-top:6px;">${modalActionHtml}</div>` : ''}
  `;
  openModal('modal-event-detail');
}

function detailChip(icon, label, val) {
  return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">
    <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;font-weight:700;margin-bottom:3px;">${escapeHTML(icon)} ${escapeHTML(label)}</div>
    <div style="font-size:13px;color:#111827;font-weight:600;">${escapeHTML(val)}</div>
  </div>`;
}


/* ─── Module: js/pages/clubs.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Clubs Directory & Club Profiles
   Path: js/pages/clubs.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   CLUBS DIRECTORY & CLUB-SPECIFIC EVENTS
───────────────────────────────────────────────────────────────*/
function renderClubsDirectoryPage(selectedClubName = null) {
  const el = document.getElementById('page-clubs');
  if (!el) return;

  const users = getDB('vvce_users');
  const allEvents = getDB('vvce_events').filter(e => e.status !== 'archived');

  // If a specific club is selected, render club-exclusive events view
  if (selectedClubName) {
    const clubUser = users.find(u => u.type === 'admin' && (u.clubName || '').toLowerCase() === selectedClubName.toLowerCase());
    const clubEvents = allEvents.filter(e => (e.club || '').toLowerCase() === selectedClubName.toLowerCase());
    const upcoming = clubEvents.filter(e => e.date >= new Date().toISOString().split('T')[0] && e.status !== 'completed');
    const past = clubEvents.filter(e => e.date < new Date().toISOString().split('T')[0] || e.status === 'completed');

    el.innerHTML = `
      <div style="margin-bottom:1.5rem;">
        <button class="btn" style="background:#1e293b; color:#fff; display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; font-weight:600; font-size:13px; margin-bottom:1rem; cursor:pointer;" onclick="renderClubsDirectoryPage()">
          ← Back to All Clubs
        </button>
        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:1.5rem; display:flex; gap:1.5rem; align-items:center; box-shadow:0 1px 3px rgba(0,0,0,0.05); flex-wrap:wrap;">
          <div style="width:64px; height:64px; border-radius:12px; background:linear-gradient(135deg, #4f46e5, #7c3aed); color:#fff; display:flex; align-items:center; justify-content:center; font-size:28px; font-weight:700;">
            ${clubUser?.clubLogo ? `<img src="${sanitizeUrl(clubUser.clubLogo)}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">` : '🏛️'}
          </div>
          <div style="flex:1;">
            <h2 style="font-family:'Outfit',sans-serif; font-size:1.5rem; color:#1e293b; margin-bottom:4px;">${escapeHTML(selectedClubName)}</h2>
            <div style="display:flex; gap:12px; flex-wrap:wrap; font-size:13px; color:#64748b;">
              <span><strong>Domain:</strong> ${escapeHTML(clubUser?.domain || 'Multi-disciplinary')}</span>
              <span>•</span>
              <span><strong>Faculty Coordinator:</strong> ${escapeHTML(clubUser?.faculty || 'Faculty in Charge')}</span>
              <span>•</span>
              <span><strong>Total Events:</strong> ${clubEvents.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-bottom:1rem; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
        <button id="tab-club-up" class="btn" style="background:#4f46e5; color:#fff; padding:6px 14px; font-size:13px;" onclick="switchClubTab('upcoming', '${escapeHTML(selectedClubName.replace(/'/g, "\\'"))}')">Upcoming Events (${upcoming.length})</button>
        <button id="tab-club-past" class="btn" style="background:#f1f5f9; color:#475569; padding:6px 14px; font-size:13px;" onclick="switchClubTab('past', '${escapeHTML(selectedClubName.replace(/'/g, "\\'"))}')">Past & Completed (${past.length})</button>
      </div>

      <div class="event-grid" id="club-events-grid">
        ${upcoming.length > 0 ? upcoming.map(e => eventCard(e)).join('') : `<div class="empty-state" style="grid-column:1/-1; padding:3rem; text-align:center;"><div style="font-size:32px;">🗓️</div><p style="color:#64748b; margin-top:8px;">No upcoming events scheduled for ${escapeHTML(selectedClubName)}.</p></div>`}
      </div>
    `;
    return;
  }

  // Otherwise, render full Clubs Directory grid
  // Gather registered clubs
  const clubAdmins = users.filter(u => u.type === 'admin' && u.approved && u.clubName);
  const knownClubNames = new Set(clubAdmins.map(u => u.clubName.toLowerCase()));
  
  // Include clubs from events that might not have an admin account
  allEvents.forEach(e => {
    if (e.club && !knownClubNames.has(e.club.toLowerCase())) {
      knownClubNames.add(e.club.toLowerCase());
      clubAdmins.push({ clubName: e.club, domain: e.category || 'General', faculty: 'Club Lead' });
    }
  });

  el.innerHTML = `
    <div style="margin-bottom:1.5rem;">
      <h2 style="font-family:'Outfit',sans-serif; font-size:1.6rem; color:#1e293b;">🏛️ VVCE Clubs & Student Chapters</h2>
      <p style="color:#64748b; font-size:14px; margin-top:4px;">Explore official college clubs, student associations, and browse their exclusive events.</p>
      <div style="margin-top:1rem;">
        <input type="text" class="search-inp" placeholder="🔍 Search clubs by name or domain..." oninput="filterClubsView(this.value)">
      </div>
    </div>

    <div class="event-grid" id="clubs-directory-grid">
      ${clubAdmins.map(c => {
        const cEvents = allEvents.filter(e => (e.club || '').toLowerCase() === c.clubName.toLowerCase());
        return `
          <div class="event-card" style="cursor:pointer;" onclick="renderClubsDirectoryPage('${escapeHTML(c.clubName.replace(/'/g, "\\'"))}')">
            <div style="padding:1.5rem; display:flex; flex-direction:column; justify-content:space-between; height:100%;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                  <div style="width:48px; height:48px; border-radius:10px; background:linear-gradient(135deg,#e0e7ff,#c7d2fe); color:#4338ca; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:700;">
                    ${c.clubLogo ? `<img src="${sanitizeUrl(c.clubLogo)}" style="width:100%; height:100%; object-fit:cover; border-radius:10px;">` : '🏛️'}
                  </div>
                  <span class="badge" style="background:#eef2ff; color:#4f46e5; border:1px solid #c7d2fe; font-size:11px; padding:3px 8px; border-radius:6px; font-weight:600;">${escapeHTML(c.domain || 'Club')}</span>
                </div>
                <h3 style="font-family:'Outfit',sans-serif; font-size:1.15rem; color:#0f172a; margin-bottom:6px;">${escapeHTML(c.clubName)}</h3>
                <p style="font-size:12px; color:#64748b; margin-bottom:12px;">${c.desc ? escapeHTML(c.desc.slice(0, 95)) + '...' : 'Official student chapter at Vidyavardhaka College of Engineering.'}</p>
                <div style="font-size:12px; color:#475569; display:flex; flex-direction:column; gap:4px; margin-bottom:14px;">
                  <span>👤 <strong>Coordinator:</strong> ${escapeHTML(c.faculty || 'Faculty in Charge')}</span>
                  <span>📅 <strong>Events Hosted:</strong> ${cEvents.length} events</span>
                </div>
              </div>
              <button class="btn" style="background:#4f46e5; color:#fff; width:100%; padding:10px; border-radius:8px; font-weight:600; font-size:13px; text-align:center;">
                View Club Events ➔
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function switchClubTab(type, clubName) {
  const allEvents = getDB('vvce_events').filter(e => (e.club || '').toLowerCase() === clubName.toLowerCase() && e.status !== 'archived');
  const now = new Date().toISOString().split('T')[0];
  const events = type === 'upcoming'
    ? allEvents.filter(e => e.date >= now && e.status !== 'completed')
    : allEvents.filter(e => e.date < now || e.status === 'completed');

  document.getElementById('tab-club-up').style.background = type === 'upcoming' ? '#4f46e5' : '#f1f5f9';
  document.getElementById('tab-club-up').style.color = type === 'upcoming' ? '#fff' : '#475569';
  document.getElementById('tab-club-past').style.background = type === 'past' ? '#4f46e5' : '#f1f5f9';
  document.getElementById('tab-club-past').style.color = type === 'past' ? '#fff' : '#475569';

  const grid = document.getElementById('club-events-grid');
  grid.innerHTML = events.length > 0
    ? events.map(e => eventCard(e)).join('')
    : `<div class="empty-state" style="grid-column:1/-1; padding:3rem; text-align:center;"><p style="color:#64748b;">No ${type} events for this club.</p></div>`;
}

function filterClubsView(term) {
  const t = term.toLowerCase().trim();
  const cards = document.querySelectorAll('#clubs-directory-grid .event-card');
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(t) ? '' : 'none';
  });
}



/* ─── Module: js/pages/calendar.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Calendar Page & Academic Timetable
   Path: js/pages/calendar.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   CALENDAR PAGE
───────────────────────────────────────────────────────────────*/
function renderCalendarPage() {
  const el = document.getElementById('page-calendar');
  el.innerHTML = `
    <style>
      .cal-layout { display:grid; grid-template-columns:1fr 300px; gap:1.5rem; }
      @media (max-width: 768px) { .cal-layout { grid-template-columns:1fr; } }
    </style>
    <div class="cal-layout">
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
  let events = getDB('vvce_events').filter(e=>e.status==='approved' || e.status==='rescheduled' || e.status==='completed');
  if (STATE.user && STATE.user.type === 'student') {
    events = events.filter(e => isBranchMatch(e.branches, STATE.user.branch));
  }
  const acad   = getDB('vvce_academic');

  for(let i=0;i<firstDay;i++){const c=document.createElement('div');c.className='cal-day other';grid.appendChild(c);}

  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  let selectedDateToLoad = STATE.selectedDate || todayStr;
  let defaultSelectedCell = null;

  for(let d=1;d<=totalDays;d++){
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell=document.createElement('div');
    cell.className='cal-day';

    const isToday=now.getFullYear()===year&&now.getMonth()===month&&now.getDate()===d;
    const dayEvents = events.filter(e=>e.date===ds);
    const sched = acad.find(s=>s.date===ds);

    if(isToday) cell.classList.add('today');
    if(dayEvents.length > 0) cell.classList.add('has-ev');
    if(sched?.type==='holiday') cell.classList.add('holiday');
    else if(sched?.type==='exam') cell.classList.add('exam');

    let dotsHtml = '';
    if (dayEvents.length > 0) {
      dotsHtml += `<span style="width:5px; height:5px; border-radius:50%; background:#2563eb; display:inline-block; margin:0 1px;"></span>`;
    }
    if (sched?.type==='holiday') {
      dotsHtml += `<span style="width:5px; height:5px; border-radius:50%; background:#ef4444; display:inline-block; margin:0 1px;"></span>`;
    } else if (sched?.type==='exam') {
      dotsHtml += `<span style="width:5px; height:5px; border-radius:50%; background:#f59e0b; display:inline-block; margin:0 1px;"></span>`;
    }

    cell.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%;">
        <span>${d}</span>
        ${dotsHtml ? `<div style="display:flex; gap:2px; margin-top:2px;">${dotsHtml}</div>` : ''}
      </div>
    `;

    cell.dataset.date = ds;
    cell.onclick = function() {
      const calGrid = document.getElementById('cal-grid');
      if (calGrid) calGrid.querySelectorAll('.cal-day.selected').forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');
      STATE.selectedDate = this.dataset.date;
      showCalDateEvents(this.dataset.date);
    };

    if (ds === selectedDateToLoad || (isToday && !STATE.selectedDate)) {
      cell.classList.add('selected');
      defaultSelectedCell = cell;
      selectedDateToLoad = ds;
    }

    grid.appendChild(cell);
  }

  // Pre-load events for selected date on initial view
  showCalDateEvents(selectedDateToLoad);
}

function showCalDateEvents(ds) {
  let events = getDB('vvce_events').filter(e=>(e.status==='approved'||e.status==='rescheduled'||e.status==='completed')&&e.date===ds);
  if (STATE.user && STATE.user.type === 'student') {
    events = events.filter(e => isBranchMatch(e.branches, STATE.user.branch));
  }
  const acad = getDB('vvce_academic').filter(a => a.date === ds);
  const panel  = document.getElementById('cal-events-panel');
  if (!panel) return;

  if (!events.length && !acad.length) {
    panel.innerHTML=`<p style="color:#64748b;font-size:13px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">No scheduled events on <strong>${formatDate(ds)}</strong></p>`;
    return;
  }

  let html = `<div style="font-size:12px; font-weight:700; color:#64748b; margin-bottom:8px;">📅 Schedule for ${formatDate(ds)}:</div>`;

  if (acad.length) {
    html += acad.map(a => `
      <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:${a.type==='holiday'?'#fef2f2':'#fffbeb'};border:1px solid ${a.type==='holiday'?'#fecaca':'#fde68a'};border-radius:8px;margin-bottom:8px;font-size:13px;font-weight:700;color:${a.type==='holiday'?'#dc2626':'#b45309'};">
        <span>${a.type==='holiday'?'🏖️ Holiday:':'📝 Exam:'}</span>
        <span>${escapeHTML(a.desc || a.type)}</span>
      </div>
    `).join('');
  }

  if (events.length) {
    html += events.map(e=>`
      <div class="sched-row" onclick="openEventModal('${escapeHTML(e.id)}')" style="cursor:pointer; margin-bottom:8px;">
        <span class="sched-emoji">${escapeHTML(e.emoji||'🎓')}</span>
        <div class="sched-info">
          <div class="sched-name">${escapeHTML(e.name)}</div>
          <div class="sched-meta">${escapeHTML(formatTime(e.time))} • ${escapeHTML(e.venue)} • ${escapeHTML(e.club)}</div>
        </div>
        <span class="badge ${e.status==='approved'?'badge-green':'badge-amber'}">${escapeHTML(e.status)}</span>
      </div>`).join('');
  }

  panel.innerHTML = html;
}

function renderAcadSchedule() {
  const acad   = getDB('vvce_academic');
  let events   = getDB('vvce_events').filter(e=>e.status==='approved'||e.status==='rescheduled');
  if (STATE.user && STATE.user.type === 'student') {
    events = events.filter(e => isBranchMatch(e.branches, STATE.user.branch));
  }
  const panel  = document.getElementById('acad-schedule');
  if (!panel) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const upcoming = [
    ...acad.map(a => ({ date: a.date, type: a.type, label: a.desc || a.type })),
    ...events.map(e => ({ date: e.date, type: 'event', label: e.name }))
  ].filter(s => s.date >= todayStr).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6);

  if (!upcoming.length) { panel.innerHTML=`<p style="color:#9ca3af;font-size:13px;">No upcoming events</p>`; return; }
  panel.innerHTML = upcoming.map(s=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;">
      <div style="font-size:18px;">${s.type==='holiday'?'🏖️':s.type==='exam'?'📝':'🎓'}</div>
      <div style="flex:1;font-size:13px;font-weight:700;color:#111827;">${escapeHTML(s.label)}</div>
      <div style="font-size:11px;color:#6b7280;">${escapeHTML(formatDate(s.date))}</div>
    </div>`).join('');
}



/* ─── Module: js/pages/registrations.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Student Event Registrations & Passes
   Path: js/pages/registrations.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   REGISTRATIONS PAGE
───────────────────────────────────────────────────────────────*/
function renderRegistrationsPage() {
  const events    = getDB('vvce_events');
  const userId    = STATE.user?.id;
  const userEmail = (STATE.user?.email || '').toLowerCase();
  const _now      = new Date();
  const todayStr  = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;

  // Find all events relevant to user (registered, leader, member, pending invite, or solo pending/rejected)
  const myRegs = events.filter(e => {
    const prog = typeof getEventRegistrationProgress === 'function' ? getEventRegistrationProgress(e, STATE.user) : null;
    if (prog && prog.status !== 'none') return true;
    const isReg = (e.registrations || []).includes(userId);
    const inTeam = e.isTeamEvent && (e.teams || []).some(t =>
      t.leaderId === userId ||
      (t.memberIds || []).includes(userId) ||
      (t.pendingEmails || []).some(em => em.toLowerCase() === userEmail)
    );
    return isReg || inTeam;
  });

  const pendingTeams = [];
  const confirmedUpcoming = [];
  const past = [];

  myRegs.forEach(e => {
    const isPast = Boolean(e.date && e.date < todayStr);
    if (isPast) {
      past.push(e);
      return;
    }

    const prog = typeof getEventRegistrationProgress === 'function' ? getEventRegistrationProgress(e, STATE.user) : null;
    if (prog && prog.status === 'registered') {
      confirmedUpcoming.push(e);
    } else if (prog && ['pending_team', 'pending_payment', 'pending_approval', 'rejected'].includes(prog.status)) {
      pendingTeams.push(e);
    } else if ((e.registrations || []).includes(userId)) {
      confirmedUpcoming.push(e);
    } else {
      pendingTeams.push(e);
    }
  });

  const el = document.getElementById('page-registrations');
  if (!el) return;

  el.innerHTML = `
    <div class="tab-bar" style="display:flex; gap:8px; margin-bottom:18px; border-bottom:2px solid #e2e8f0; padding-bottom:8px; flex-wrap:wrap;">
      <button class="tab-btn active" id="tab-up" onclick="switchRegTab('upcoming')">
        ✓ Confirmed (${confirmedUpcoming.length})
      </button>
      <button class="tab-btn" id="tab-pending" onclick="switchRegTab('pending')" style="${pendingTeams.length > 0 ? 'color:#b45309; font-weight:700;' : ''}">
        ⏳ Pending / Action Needed (${pendingTeams.length})
      </button>
      <button class="tab-btn" id="tab-past" onclick="switchRegTab('past')">
        Past Events (${past.length})
      </button>
    </div>
    <div id="reg-upcoming">${regList(confirmedUpcoming, false, false)}</div>
    <div id="reg-pending" style="display:none;">${regList(pendingTeams, false, true)}</div>
    <div id="reg-past" style="display:none;">${regList(past, true, false)}</div>
  `;
}

function switchRegTab(which) {
  const tabUp = document.getElementById('tab-up');
  const tabPending = document.getElementById('tab-pending');
  const tabPast = document.getElementById('tab-past');
  const regUp = document.getElementById('reg-upcoming');
  const regPending = document.getElementById('reg-pending');
  const regPast = document.getElementById('reg-past');

  if (tabUp) tabUp.classList.toggle('active', which === 'upcoming');
  if (tabPending) tabPending.classList.toggle('active', which === 'pending');
  if (tabPast) tabPast.classList.toggle('active', which === 'past');

  if (regUp) regUp.style.display = which === 'upcoming' ? 'block' : 'none';
  if (regPending) regPending.style.display = which === 'pending' ? 'block' : 'none';
  if (regPast) regPast.style.display = which === 'past' ? 'block' : 'none';
}

function regList(evs, past, isPendingTab = false) {
  if (!evs.length) {
    if (isPendingTab) {
      return `<div class="empty-state"><div class="ei">🎉</div><div class="et">No pending registrations or actions</div><p style="font-size:12.5px; color:#6b7280; margin-top:4px;">You have no registrations awaiting team confirmation, payment proof, or organizer approval.</p></div>`;
    }
    return `<div class="empty-state"><div class="ei">📋</div><div class="et">${past ? 'No past events.' : 'No upcoming confirmed registrations.'}</div>${!past ? `<button class="btn btn-gold" style="margin-top:12px;" onclick="showPage('events')">Browse Events</button>` : ''}</div>`;
  }

  const userId = STATE.user?.id;
  const userEmail = (STATE.user?.email || '').toLowerCase();

  return evs.map(e => {
    const userTeam = (e.teams || []).find(t =>
      t.leaderId === userId ||
      (t.memberIds || []).includes(userId) ||
      (t.pendingEmails || []).some(em => em.toLowerCase() === userEmail)
    );
    const isLeader = userTeam && userTeam.leaderId === userId;
    const isPendingInvite = userTeam && (userTeam.pendingEmails || []).some(em => em.toLowerCase() === userEmail);
    const pendingCount = userTeam ? (userTeam.pendingEmails || []).length : 0;
    const confirmedCount = userTeam ? (userTeam.memberIds || []).length : 1;
    const totalTeam = confirmedCount + pendingCount;

    const prog = typeof getEventRegistrationProgress === 'function' ? getEventRegistrationProgress(e, STATE.user) : null;
    const status = prog?.status || 'registered';

    let tagHtml = '';
    let actionBtnHtml = '';

    if (past) {
      const attended = e.attendedStudents?.includes(userId);
      tagHtml = `
        <span class="att-tag ${attended ? 'att-done' : 'att-reg'}" style="${!attended ? 'background:rgba(239,68,68,0.1);color:#ef4444;border-color:rgba(239,68,68,0.3);' : ''}">
          ${attended ? '✓ Attended' : '❌ Not Attended'}
        </span>
      `;
    } else if (status === 'registered') {
      tagHtml = `<span class="att-tag" style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;font-weight:700;">✓ Registered</span>`;
    } else if (status === 'pending_team') {
      tagHtml = isPendingInvite
        ? `<span class="att-tag" style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;font-weight:700;">⏳ Invite Pending</span>`
        : `<span class="att-tag" style="background:#fffbeb;color:#b45309;border:1px solid #fde68a;font-weight:700;">⏳ Team Confirmation (${confirmedCount}/${totalTeam})</span>`;
    } else if (status === 'pending_payment') {
      tagHtml = `<span class="att-tag" style="background:#fffbeb;color:#b45309;border:1px solid #fde68a;font-weight:700;">💳 Payment Proof Needed</span>`;
    } else if (status === 'pending_approval') {
      tagHtml = `<span class="att-tag" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;font-weight:700;">⏳ Pending Organizer Approval</span>`;
    } else if (status === 'rejected') {
      tagHtml = `<span class="att-tag" style="background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;font-weight:700;">❌ Rejected</span>`;
    }

    if (!past) {
      if (isPendingInvite && userTeam) {
        actionBtnHtml += `
          <button onclick="event.stopPropagation();window._pendingTeamInvite={teamId:'${userTeam.id}',eventId:'${e.id}',token:'${userTeam.inviteToken||''}'};acceptTeamInvite(this);" style="padding:4px 10px;background:#15803d;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;margin-top:2px;">
            ✅ Accept &amp; Join
          </button>`;
      }
      if ((status === 'pending_payment' || status === 'rejected') && (!userTeam || isLeader)) {
        const payLabel = status === 'rejected'
          ? (prog?.requiresPayment ? '🔄 Re-upload Payment Proof' : '🔄 Resubmit Registration')
          : '💳 Upload Payment Proof';
        actionBtnHtml += `
          <button onclick="event.stopPropagation();reopenRegistrationPayment('${e.id}')" style="padding:4px 10px;background:#f59e0b;color:#0f172a;border:none;border-radius:6px;font-size:11px;font-weight:800;cursor:pointer;margin-top:2px;">
            ${payLabel}
          </button>`;
      }
      if (isLeader && userTeam) {
        actionBtnHtml += `
          <button onclick="event.stopPropagation();openManageTeamModal('${e.id}','${userTeam.id}')" style="padding:4px 10px;background:#ede9fe;color:#6d28d9;border:1px solid #c4b5fd;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;margin-top:2px;">
            ✏️ Alter Team
          </button>`;
      }
    }

    return `
      <div class="sched-row" style="margin-bottom:10px;cursor:pointer;flex-direction:column;align-items:stretch;gap:8px;" onclick="openEventModal('${escapeHTML(e.id)}')">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span class="sched-emoji" style="font-size:32px;">${escapeHTML(e.emoji||'🎓')}</span>
          <div class="sched-info" style="flex:1;min-width:200px;">
            <div class="sched-name" style="font-size:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              ${escapeHTML(e.name)}
              ${e.isTeamEvent && userTeam ? `
                <span style="font-size:11px;font-weight:700;background:#f5f3ff;color:#7c3aed;padding:2px 8px;border-radius:12px;border:1px solid #ddd6fe;">
                  👥 ${escapeHTML(userTeam.name)} ${isLeader ? '👑 (Leader)' : (isPendingInvite ? '⏳ (Invited)' : '👤 (Member)')}
                </span>
              ` : ''}
            </div>
            <div class="sched-meta">${escapeHTML(e.club)} &bull; ${escapeHTML(formatDate(e.date))} • ${escapeHTML(formatTime(e.time))} • ${escapeHTML(e.venue)}</div>
            ${status === 'rejected' && prog?.rejectionReason ? `
              <div style="font-size:11.5px;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;padding:4px 8px;border-radius:6px;margin-top:4px;font-weight:600;">
                ❌ Rejected: ${escapeHTML(prog.rejectionReason)}
              </div>` : ''}
            ${e.isTeamEvent && userTeam && pendingCount > 0 ? `
              <div style="font-size:11.5px;color:#d97706;font-weight:600;margin-top:3px;">
                ⚠️ Waiting for invite confirmation from: ${(userTeam.pendingEmails || []).map(email => {
                  const det = (userTeam.pendingMembers || userTeam.memberDetails || []).find(d => (typeof d === 'object' ? d.email : d).toLowerCase() === email.toLowerCase());
                  return det?.name ? `${escapeHTML(det.name)} (${escapeHTML(email)})` : escapeHTML(email);
                }).join(', ')}
              </div>
            ` : ''}
          </div>
          <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            ${tagHtml}
            ${actionBtnHtml}
          </div>
        </div>
        ${!past && typeof renderRegistrationStepper === 'function' ? renderRegistrationStepper(e, prog) : ''}
      </div>
    `;
  }).join('');
}



/* ─── Module: js/pages/certificates.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Certificates & PDF Generation
   Path: js/pages/certificates.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   CERTIFICATES PAGE
───────────────────────────────────────────────────────────────*/
function renderCertificatesPage() {
  const user  = STATE.user;
  const certs = getDB('vvce_certs').filter(c=>c.userId===user.id);
  const el = document.getElementById('page-certificates');

  el.innerHTML = `
    <div class="sec-head">
      <span class="sec-title">My Certificates (${certs.length})</span>
      <button class="btn btn-gold" onclick="openModal('modal-cert-upload')">+ Upload Certificate</button>
    </div>

    <!-- Summary banner -->
    <div style="background:linear-gradient(135deg,#111827,#1e2a3d);border-radius:12px;padding:1.25rem 1.5rem;margin-bottom:1.5rem;display:flex;align-items:center;justify-content:space-around;gap:2rem;flex-wrap:wrap;">
      <div style="text-align:center;">
        <div style="font-family:'Outfit',sans-serif;font-size:32px;font-weight:900;color:#f59e0b;">${certs.length}</div>
        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:700;">Total Certificates</div>
      </div>
      <div style="width:1px;height:44px;background:rgba(255,255,255,0.08);"></div>
      <div style="text-align:center;">
        <div style="font-family:'Outfit',sans-serif;font-size:32px;font-weight:900;color:#fbbf24;">${certs.filter(c=>c.type==='achievement').length}</div>
        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:700;">Achievements</div>
      </div>
      <div style="width:1px;height:44px;background:rgba(255,255,255,0.08);"></div>
      <div style="text-align:center;">
        <div style="font-family:'Outfit',sans-serif;font-size:32px;font-weight:900;color:#10b981;">${certs.filter(c=>c.type==='participation').length}</div>
        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:700;">Participation</div>
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
            <div class="cert-title">${escapeHTML(c.title)}</div>
            <div class="cert-issuer">${escapeHTML(c.issuer)}</div>
            <div style="font-size:12px;color:#9ca3af;margin-bottom:8px;">${escapeHTML(formatDate(c.date))} • ${escapeHTML(c.position)}</div>
            <div class="cert-foot" style="justify-content:flex-end;">
              <button class="cert-dl-btn" onclick="downloadCertPDF('${escapeHTML(c.id)}')">Download PDF</button>
            </div>
          </div>`).join('')
        : `<div class="empty-state" style="grid-column:1/-1"><div class="ei">📜</div><div class="et">No certificates yet</div><div class="es">Participate in events to earn certificates</div><button class="btn btn-gold" style="margin-top:12px;" onclick="showPage('events')">Browse Events</button></div>`
      }
    </div>
  `;
}

async function submitCertificate() {
  const title  = document.getElementById('cert-title').value.trim();
  const issuer = document.getElementById('cert-issuer').value.trim();
  const date   = document.getElementById('cert-date').value;
  const pos    = document.getElementById('cert-position').value;

  if (!title||!issuer||!date) { toast('Please fill all required fields.','error'); return; }

  const newCert = {
    id: genId('c'),
    userId: STATE.user.id,
    title,
    issuer,
    date,
    position: pos,
    type: ['Winner','Runner-up'].includes(pos) ? 'achievement' : 'participation',
    verified: false
  };
  await syncSingleCertToSupabase(newCert, false);
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
  <title>Certificate – ${escapeHTML(cert.title)}</title>
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
    <div class="name">${escapeHTML(user.name || 'Student')}</div>
    <div class="body">
      has successfully ${isAchievement?'won the <strong>'+escapeHTML(cert.position)+'</strong> position in':'participated in'}
      the event <span class="event">${escapeHTML(cert.title)}</span><br>
      organised by <strong>${escapeHTML(cert.issuer)}</strong>
    </div>
    <div class="footer">
      <div class="sig"><div class="sig-line"></div><div class="sig-name">Club Coordinator</div></div>
      <div class="date-box"><strong>${dateStr}</strong><br><span style="font-size:10px;">Date of Event</span></div>
      <div class="sig"><div class="sig-line"></div><div class="sig-name">Dean – Student Welfare</div></div>
    </div>
  </div></body></html>`;

  const win = window.open('','_blank','width=1200,height=900');
  if (!win) {
    toast('Popup blocked! Please allow popups for this site to print/download your certificate PDF.', 'warning', 5000);
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 800);
};



/* ─── Module: js/pages/profile.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — User Profile & Academic Credentials
   Path: js/pages/profile.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   PROFILE PAGE
───────────────────────────────────────────────────────────────*/
function renderProfilePage() {
  const user  = STATE.user;
  const certs = getDB('vvce_certs').filter(c=>c.userId===user.id);
  const regs  = getDB('vvce_events').filter(e=>(e.registrations||[]).includes(user.id));
  const el    = document.getElementById('page-profile');

  if (user.type !== 'student') { el.innerHTML = renderAuthorityProfile(); return; }

  el.innerHTML = `
    <!-- Main profile card -->
    <div class="profile-head-card">
      <div class="prof-head-row">
        <div class="prof-avatar-wrap" onclick="triggerPhotoUpload()">
          <div class="prof-avatar">
            ${user.profilePhoto?`<img src="${sanitizeUrl(user.profilePhoto)}">`:`<span>${escapeHTML(avatar(user.name))}</span>`}
          </div>
          <div class="photo-edit-overlay">📷</div>
          <input type="file" id="photo-upload" style="display:none;" accept="image/*" onchange="handlePhotoUpload(this)">
        </div>
        <div class="prof-info" style="flex:1;">
          <h2>${escapeHTML(titleCase(user.name))}</h2>
          <div class="prof-meta-row" style="color:#6b7280;">${escapeHTML(user.usn||'—')} &nbsp;•&nbsp; ${escapeHTML(user.branch||'—')} &nbsp;•&nbsp; ${escapeHTML(computeStudentYearSem(user).year)} &nbsp;•&nbsp; Sec ${escapeHTML(user.section||'—')}</div>
          <div class="prof-meta-row" style="font-size:12px;color:#9ca3af;margin-top:2px;">${escapeHTML(user.email)}</div>
          ${user.bio?`<div style="font-size:13px;color:#374151;margin-top:8px;font-style:italic;line-height:1.5;">"${escapeHTML(user.bio)}"</div>`:''}
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;">
            ${(user.interests||[]).map(i=>`<span class="interest-chip selected" style="cursor:default;">${escapeHTML(i)}</span>`).join('')}
          </div>
        </div>
        <button class="btn btn-gold" onclick="openProfileEdit()" style="align-self:flex-start;white-space:nowrap;">✏️ Edit Profile</button>
      </div>
      <div class="prof-stats">
        <div class="prof-stat"><div class="val">${regs.length}</div><div class="lbl">Registered</div></div>
        <div class="prof-stat"><div class="val">${certs.length}</div><div class="lbl">Certificates</div></div>
        <div class="prof-stat"><div class="val">${(() => { const _n=new Date(); const _t=`${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`; return regs.filter(e=>e.date && e.date < _t).length; })()}</div><div class="lbl">Attended</div></div>
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
              ? user.skills.map(s=>`<span class="skill-chip">${escapeHTML(s)}</span>`).join('')
              : `<span style="font-size:13px;color:#9ca3af;">No skills added. <span style="color:#f59e0b;cursor:pointer;" onclick="openProfileEdit()">Add →</span></span>`
            }
          </div>
        </div>
        ${user.resume?`<div style="margin-top:10px;"><a href="${sanitizeUrl(user.resume)}" download style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;color:#1d4ed8;font-size:12px;font-weight:700;">📄 Download Resume</a></div>`:''}
      </div>
    </div>

    <!-- Achievements -->
    <div class="white-card" style="margin-bottom:1rem;">
      <div class="sec-head"><span class="sec-title">Achievements & Awards</span><button class="btn btn-outline" onclick="openProfileEdit()">+ Add</button></div>
      ${(user.achievements||[]).length
        ? user.achievements.map(a=>`
          <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;">
            <div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#f59e0b,#fbbf24);display:flex;align-items:center;justify-content:center;font-size:14px;">🏆</div>
            <div style="font-size:13px;font-weight:600;color:#111827;">${escapeHTML(a)}</div>
          </div>`).join('')
        : `<div style="color:#9ca3af;font-size:13px;">No achievements added. <span style="color:#f59e0b;cursor:pointer;" onclick="openProfileEdit()">Add achievements →</span></div>`
      }
    </div>

  `;
}

function renderAuthorityProfile() {
  const user = STATE.user;
  const isClubAdmin = user.type === 'admin';
  const displayLogo = user.clubLogo || user.profilePhoto;
  return `
    <div class="profile-head-card">
      <div class="prof-head-row">
        <div class="prof-avatar-wrap" onclick="triggerPhotoUpload()">
          <div class="prof-avatar">${displayLogo?`<img src="${displayLogo}">`:`<span>${isClubAdmin?'🏛️':avatar(user.name)}</span>`}</div>
          <div class="photo-edit-overlay">📷</div>
          <input type="file" id="photo-upload" style="display:none;" accept="image/*" onchange="handlePhotoUpload(this)">
        </div>
        <div class="prof-info" style="flex:1;">
          ${isClubAdmin ? `
            <h2 style="font-size:22px; font-weight:800; color:#111827; margin:0;">${escapeHTML(user.clubName || 'Club Admin')}</h2>
            <div class="prof-meta-row" style="color:#4f46e5; font-weight:700; font-size:14px; margin-top:4px;">
              👤 Representative: ${escapeHTML(titleCase(user.name))}
            </div>
            <div class="prof-meta-row" style="color:#059669; font-weight:600; font-size:13px; margin-top:2px;">
              👩‍🏫 Faculty Coordinator: ${escapeHTML(user.faculty || '—')}
            </div>
            <div class="prof-meta-row" style="color:#6b7280; font-size:12px; margin-top:2px;">
              🏛️ ${escapeHTML(user.domain || 'General')} Domain &nbsp;•&nbsp; ${escapeHTML(user.dept || user.branch || '—')} Department
            </div>
          ` : `
            <h2>${escapeHTML(titleCase(user.name))}</h2>
            <div class="prof-meta-row" style="color:#6b7280;">${escapeHTML(titleCase(user.designation||''))} &nbsp;•&nbsp; ${escapeHTML(user.dept||'')}</div>
            <div class="prof-meta-row" style="font-size:12px;color:#9ca3af;">${escapeHTML(user.email)}</div>
          `}
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
      ${user.desc ? `<div style="margin-top:12px;"><label style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:700;">About the Club</label><div style="margin-top:4px;font-size:13px;color:#374151;line-height:1.6;">${escapeHTML(user.desc)}</div></div>` : ''}
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
      ${user.bio ? `<div style="margin-top:12px;"><label style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:700;">Bio</label><div style="margin-top:4px;font-size:13px;color:#374151;font-style:italic;">&ldquo;${escapeHTML(user.bio)}&rdquo;</div></div>` : ''}
      ${(user.skills||[]).length ? `
        <div style="margin-top:12px;">
          <label style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:700;">Skills</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">${user.skills.map(s=>`<span class="skill-chip">${escapeHTML(s)}</span>`).join('')}</div>
        </div>` : ''}
      <div style="display:flex;gap:8px;margin-top:12px;">
        ${user.linkedin?`<a href="${sanitizeUrl(/^https?:\/\//i.test(user.linkedin) ? user.linkedin : 'https://' + user.linkedin)}" target="_blank" rel="noopener" class="soc-link">LinkedIn</a>`:''}
        ${user.github?`<a href="${sanitizeUrl(/^https?:\/\//i.test(user.github) ? user.github : 'https://' + user.github)}" target="_blank" rel="noopener" class="soc-link">GitHub</a>`:''}
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

function profField(label, val) { return `<div class="prof-field"><label>${escapeHTML(label)}</label><span>${escapeHTML(val||'—')}</span></div>`; }
function profFieldLink(label, val) {
  if (!val) return profField(label,'—');
  const rawUrl = /^https?:\/\//i.test(val) ? val : 'https://' + val;
  const safeUrl = sanitizeUrl(rawUrl);
  return `<div class="prof-field"><label>${escapeHTML(label)}</label><a href="${safeUrl}" target="_blank" rel="noopener" style="font-size:13px;color:#f59e0b;font-weight:600;">${escapeHTML(val)}</a></div>`;
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
        <div class="form-group"><label>Club Name</label><input type="text" id="pe-clubname" value="${escapeHTML(user.clubName||'')}" placeholder="e.g. CSE Club"></div>
        <div class="form-group"><label>Domain / Category</label><input type="text" id="pe-domain" value="${escapeHTML(user.domain||'')}" placeholder="e.g. Technical"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Department</label><input type="text" id="pe-dept" value="${escapeHTML(user.dept||user.branch||'')}" placeholder="e.g. CSE"></div>
        <div class="form-group"><label>Faculty Coordinator</label><input type="text" id="pe-faculty" value="${escapeHTML(user.faculty||'')}" placeholder="Dr. / Prof. Name"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Club Email</label><input type="email" id="pe-clubemail" value="${escapeHTML(user.clubEmail||'')}" placeholder="club@vvce.ac.in"></div>
        <div class="form-group"><label>Phone</label><input type="text" id="pe-phone" value="${escapeHTML(user.phone||'')}" placeholder="+91 9876543210"></div>
      </div>
      <div class="form-group"><label>About the Club</label><textarea id="pe-desc" rows="3" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;resize:vertical;outline:none;" placeholder="Brief description of your club...">${escapeHTML(user.desc||'')}</textarea></div>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:14px 0;">
      <div style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:10px;">👤 Representative Details</div>
      <div class="form-row">
        <div class="form-group"><label>Representative Name <span style="color:#9ca3af;font-size:11px;">(account name)</span></label><input type="text" value="${escapeHTML(titleCase(user.name))}" disabled style="background:#f9fafb;color:#9ca3af;cursor:not-allowed;padding:10px;border:1.5px solid #e2e8f0;border-radius:6px;width:100%;font-size:13px;"></div>
        <div class="form-group"><label>VVCE Email <span style="color:#9ca3af;font-size:11px;">(cannot change)</span></label><input type="email" value="${escapeHTML(user.email)}" disabled style="background:#f9fafb;color:#9ca3af;cursor:not-allowed;padding:10px;border:1.5px solid #e2e8f0;border-radius:6px;width:100%;font-size:13px;"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>USN</label><input type="text" id="pe-usn" value="${escapeHTML(user.usn||'')}" placeholder="e.g. 4VV22CS001"></div>
      </div>
      <button class="btn-dark-register" onclick="saveProfileEdit()">Save Changes</button>
    `;
  } else if (isAuthority) {
    document.getElementById('modal-profile-body').innerHTML=`
      <div style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:10px;">🎓 Faculty Details</div>
      <div class="form-row">
        <div class="form-group"><label>Full Name <span style="color:#9ca3af;font-size:11px;">(Dr. / Prof. Name)</span></label><input type="text" id="pe-name" value="${escapeHTML(user.name||'')}" placeholder="e.g. Dr. John Doe"></div>
        <div class="form-group"><label>Designation <span style="color:#9ca3af;font-size:11px;">(e.g. Faculty, Dean)</span></label><input type="text" id="pe-designation" value="${escapeHTML(user.designation||'')}" placeholder="e.g. Faculty"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>VVCE Email</label><input type="email" id="pe-email" value="${escapeHTML(user.email||'')}" placeholder="faculty@vvce.ac.in"></div>
      </div>
      <button class="btn-dark-register" onclick="saveProfileEdit()">Save Changes</button>
    `;
  } else {
    document.getElementById('modal-profile-body').innerHTML=`
      <div class="form-row">
        <div class="form-group"><label>Phone Number</label><input type="text" id="pe-phone" value="${escapeHTML(user.phone||'')}" placeholder="9876543210"></div>
        <div class="form-group"><label>LinkedIn URL</label><input type="text" id="pe-linkedin" value="${escapeHTML(user.linkedin||'')}" placeholder="linkedin.com/in/yourname"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>GitHub URL</label><input type="text" id="pe-github" value="${escapeHTML(user.github||'')}" placeholder="github.com/yourname"></div>
        <div class="form-group"><label>Skills (comma-separated)</label><input type="text" id="pe-skills" value="${escapeHTML((user.skills||[]).join(', '))}" placeholder="Python, React, Node.js"></div>
      </div>
      <div class="form-group"><label>Bio / About Me</label><textarea id="pe-bio" rows="3" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;resize:vertical;outline:none;" placeholder="Write a short bio...">${escapeHTML(user.bio||'')}</textarea></div>
      <div class="form-group"><label>Achievements (one per line)</label><textarea id="pe-achievements" rows="4" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;resize:vertical;outline:none;" placeholder="e.g. Hackathon Winner 2024">${escapeHTML((user.achievements||[]).join('\n'))}</textarea></div>
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

async function saveProfileEdit() {
  const isClubAdmin = STATE.user.type === 'admin';
  const isAuthority = STATE.user.type === 'authority';
  const updates = {};
  
  if (isAuthority) {
    const newName = (document.getElementById('pe-name')?.value || '').trim();
    const newDesig = (document.getElementById('pe-designation')?.value || '').trim();
    const newEmail = (document.getElementById('pe-email')?.value || '').trim().toLowerCase();
    if (!newName || !newEmail) {
      toast('Name and email are required.', 'error');
      return;
    }
    if (!newEmail.endsWith('@vvce.ac.in')) {
      toast('❌ Only @vvce.ac.in email addresses are permitted.', 'error');
      return;
    }
    const allUsers = getDB('vvce_users');
    const duplicate = allUsers.find(u => u.id !== STATE.user.id && (u.email || '').toLowerCase() === newEmail);
    if (duplicate) {
      toast('❌ That email is already in use by another account.', 'error');
      return;
    }
    updates.name = newName;
    updates.designation = newDesig;
    updates.email = newEmail;

    // Sync authority updates to approving_authorities if applicable
    const sb = getSupabaseClient();
    const targetAuthId = STATE.currentAuthorityId || STATE.user.id;
    if (sb && typeof sb.from === 'function') {
      try {
        await sb.from('approving_authorities').update({
          name: newName,
          designation: newDesig || 'Approving Authority',
          email: newEmail,
          updated_at: new Date().toISOString()
        }).eq('id', targetAuthId);
      } catch (e) { console.warn('Sync authority profile warning:', e); }
    }
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

async function updateUser(updates) {
  if (!STATE.user) return;
  if (typeof updateSingleUserRow === 'function') {
    const updated = await updateSingleUserRow(STATE.user.id, updates);
    if (updated) { STATE.user = updated; return; }
  }
  const users = getDB('vvce_users');
  const idx = users.findIndex(u => u.id === STATE.user.id);
  if (idx > -1) { Object.assign(users[idx], updates); STATE.user = users[idx]; }
}



/* ─── Module: js/pages/faculty-dashboard.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Faculty / Club Admin Dashboard
   Path: js/pages/faculty-dashboard.js
   ═══════════════════════════════════════════════════════════════ */

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

      <!-- Right: quick actions & principal availability -->
      <div>
        

        <div class="sec-title" style="margin-bottom:10px;">Quick Actions</div>
        <div class="qa-grid">
          <div class="qa-card" onclick="showPage('create-event')"><span class="qa-icon">➕</span><div class="qa-label">Create Event</div></div>
          <div class="qa-card" onclick="showPage('manage-events')"><span class="qa-icon">📋</span><div class="qa-label">Manage Events</div></div>
          <div class="qa-card" onclick="showPage('participants')"><span class="qa-icon">👥</span><div class="qa-label">View Participants</div></div>
          <div class="qa-card" onclick="showPage('events')"><span class="qa-icon">🗓️</span><div class="qa-label">All Events</div></div>
        </div>

        <!-- Recent events -->
        <div class="sec-title" style="margin:1rem 0 10px;">Recent Events</div>
        ${events.slice(0,3).map(e=>`
          <div class="ev-row" onclick="showPage('manage-events')">
            <span class="ev-row-emoji">${escapeHTML(e.emoji||'🎓')}</span>
            <div class="ev-row-info">
              <div class="ev-row-name">${escapeHTML(e.name)}</div>
              <div class="ev-row-meta">${escapeHTML(formatDate(e.date))} • ${escapeHTML(e.venue)}</div>
            </div>
            <span class="badge ${e.status==='approved'?'badge-green':e.status==='pending'?'badge-amber':'badge-red'}">${escapeHTML(e.status)}</span>
          </div>`).join('') || `<div class="empty-state" style="padding:1.5rem;"><div class="ei">📅</div><div class="et">No events yet</div></div>`}
      </div>
    </div>
  `;
}



/* ─── Module: js/pages/create-event.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Create & Edit Event Form
   Path: js/pages/create-event.js
   ═══════════════════════════════════════════════════════════════ */

let _clashDebounceTimer = null;
let _clashCheckSeq = 0;
let _isCheckingClash = false;
let _hasVenueClash = false;
let _hasInvalidTimeRange = false;
let _isSubmittingEvent = false;

/* ─────────────────────────────────────────────────────────────
   CREATE / EDIT EVENT PAGE
───────────────────────────────────────────────────────────────*/
window.editClubEvent = function(eventId) {
  window._pendingEditEventId = eventId;
  showPage('create-event');
};

function renderCreateEventPage(explicitEditId = null) {
  const editId = explicitEditId || window._pendingEditEventId || null;
  window._pendingEditEventId = null;
  window._editingEventId = editId;

  const events = getDB('vvce_events');
  const existingEv = editId ? events.find(e => String(e.id) === String(editId)) : null;
  if (editId && !existingEv) {
    window._editingEventId = null;
  }

  // Reset clash & submit states on fresh page render
  clearTimeout(_clashDebounceTimer);
  _clashCheckSeq++;
  _isCheckingClash = false;
  _hasVenueClash = false;
  _hasInvalidTimeRange = false;
  _isSubmittingEvent = false;

  const selectedBranches = existingEv?.branches?.length ? existingEv.branches : ['All'];
  const isAllBranches = selectedBranches.includes('All');
  const isTeam = !!existingEv?.isTeamEvent;
  const venueOptions = [
    'Seminar Hall A',
    'Seminar Hall B',
    'Main Auditorium',
    'Mechanical Seminar Hall',
    'EC Seminar Hall',
    'Computer Lab 1',
    'Computer Lab 2',
    'Sports Ground',
    'Conference Room B'
  ];
  const existingVenue = existingEv?.venue || 'Seminar Hall A';
  if (existingEv?.venue && !venueOptions.includes(existingEv.venue)) {
    venueOptions.unshift(existingEv.venue);
  }
  const catOptions = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Management', 'Social'];
  const branchChoices = [
    { val: 'All', label: '🏫 All Branches', bold: true },
    { val: 'CSE', label: '💻 CSE' },
    { val: 'CSE/AIML', label: '🤖 CSE / AI&amp;ML' },
    { val: 'ISE', label: '🖥️ ISE' },
    { val: 'ECE', label: '📡 ECE' },
    { val: 'ME', label: '⚙️ ME (Mech)' },
    { val: 'EEE', label: '⚡ EEE' },
    { val: 'CV', label: '🏗️ CV (Civil)' }
  ];

  const el = document.getElementById('page-create-event');
  el.innerHTML = `
    <div class="create-ev-wrap">
      <div class="create-ev-title">${existingEv ? 'Edit Event' : 'Create New Event'}</div>
      <div class="create-ev-sub">${existingEv ? 'Update your event details below. Changes will be validated against active venue bookings.' : 'Fill in the details below. Event will be sent for authority approval.'}</div>
      <div class="create-ev-card">

        <div class="form-row">
          <div class="form-group"><label>Event Name *</label><input type="text" id="ev-name" placeholder="e.g. HackVVCE 2025"></div>
          <div class="form-group"><label>Club / Organizer Name *</label><input type="text" id="ev-club" placeholder="e.g. CSE Club"></div>
        </div>

        <div class="form-group" style="background:#fffbeb; border:1.5px solid #fde68a; border-radius:12px; padding:14px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label style="font-weight:700; color:#b45309; margin:0; display:flex; align-items:center; gap:6px;">
              📝 Event Description *
            </label>
            <span style="font-size:11px; background:#fef3c7; color:#b45309; border:1px solid #fcd34d; padding:2px 8px; border-radius:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">⚠️ Important</span>
          </div>
          <textarea id="ev-desc" rows="4" placeholder="Provide a detailed description of the event, itinerary, prizes, key takeaways, etc." style="width:100%; border:1.5px solid #fcd34d; border-radius:8px; padding:10px 12px; font-size:13.5px; background:#ffffff; outline:none; box-sizing:border-box; font-family:'Inter',sans-serif;"></textarea>
          <div style="font-size:11px; color:#92400e; margin-top:5px; font-weight:500;">💡 Detailed descriptions attract more students and help with authority approval.</div>
        </div>

        <div class="form-row" style="grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));">
          <div class="form-group"><label>Event Date *</label><input type="date" id="ev-date"></div>
          <div class="form-group"><label>Start Time *</label><input type="time" id="ev-time"></div>
          <div class="form-group"><label>End Time *</label><input type="time" id="ev-end-time"></div>
        </div>

        <div class="form-row" style="grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));">
          <div class="form-group">
            <label>Venue *</label>
            <select id="ev-venue">
              ${venueOptions.map(v => `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Category *</label>
            <select id="ev-cat">
              ${catOptions.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" id="ev-max-wrap">
            <label id="ev-max-label">Max Participants *</label>
            <input type="number" id="ev-max" value="${existingEv?.maxParticipants || 100}" min="5">
            <div id="ev-max-team-hint" style="display:none; font-size:11px; color:#7c3aed; margin-top:4px; font-weight:600;">
              Auto-calculated from Max Teams × Max Members
            </div>
          </div>
        </div>

        <!-- Inline Real-Time Venue & Schedule Clash Banner -->
        <div id="ev-clash-banner" style="display:none; margin-bottom:16px;"></div>

        <!-- Target Branches -->
        <div class="form-group" style="margin-bottom:18px;">
          <label style="display:flex;align-items:center;gap:8px;font-weight:700;color:#1e293b;margin-bottom:4px;">
            🎓 Target Branches (Select Multiple)
          </label>
          <div style="font-size:12px;color:#64748b;margin-bottom:10px;">
            Click to select one, multiple, or all eligible branches for this event:
          </div>
          <div id="branch-pills-wrap" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));gap:10px;">
            ${branchChoices.map(b => {
              const checked = b.val === 'All' ? isAllBranches : (!isAllBranches && selectedBranches.includes(b.val));
              return `
                <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;cursor:pointer;user-select:none;">
                  <input type="checkbox" name="target-branch" value="${b.val}" ${checked ? 'checked' : ''} onchange="handleBranchCheckboxChange(this)" style="width:16px;height:16px;accent-color:#4f46e5;cursor:pointer;">
                  <span style="font-size:13px;font-weight:${b.bold ? '700' : '600'};color:${b.bold ? '#0f172a' : '#334155'};">${b.label}</span>
                </label>`;
            }).join('')}
          </div>
        </div>

        <div class="form-divider">Additional Details</div>

        <!-- Team / Group Event Configuration Card -->
        <div id="team-event-card-wrap" style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:12px; padding:14px 16px; margin-bottom:14px; transition:all 0.2s;">
          <div style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;" onclick="const cb = document.getElementById('ev-is-team'); cb.checked = !cb.checked; toggleTeamFields();">
            <div style="display:flex; align-items:center; gap:12px;">
              <span style="font-size:24px;">👥</span>
              <div>
                <div style="font-weight:700; font-size:14px; color:#0f172a;" id="team-card-title">This is a Team / Group Event</div>
                <div style="font-size:12px; color:#64748b;" id="team-card-sub">Enable to allow students to form teams, set a team name, and invite teammates via email</div>
              </div>
            </div>
            <label class="toggle-sw" onclick="event.stopPropagation();">
              <input type="checkbox" id="ev-is-team" ${isTeam ? 'checked' : ''} onchange="toggleTeamFields()">
              <span class="toggle-track"></span>
            </label>
          </div>
          
          <div id="ev-team-wrap" style="display:${isTeam ? 'block' : 'none'}; margin-top:14px; padding-top:12px; border-top:1px solid #e2e8f0;">
            <div style="font-size:12px; font-weight:700; color:#7c3aed; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:8px;">
              👥 Team Size Limits (Including Team Leader)
            </div>
            <div class="form-row" style="grid-template-columns:1fr 1fr 1fr; margin-bottom:0;">
              <div class="form-group" style="margin-bottom:0;">
                <label style="font-size:12px; font-weight:600; color:#374151;">Minimum Members *</label>
                <input type="number" id="ev-team-min" value="${existingEv?.minTeamSize || 2}" min="1" max="20" style="background:#ffffff; border:1.5px solid #c4b5fd;" onchange="updateMaxParticipantsFromTeam()">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label style="font-size:12px; font-weight:600; color:#374151;">Maximum Members *</label>
                <input type="number" id="ev-team-max" value="${existingEv?.maxTeamSize || 4}" min="1" max="20" style="background:#ffffff; border:1.5px solid #c4b5fd;" onchange="updateMaxParticipantsFromTeam()">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label style="font-size:12px; font-weight:700; color:#6d28d9;">Max Teams *</label>
                <input type="number" id="ev-max-teams" value="${existingEv?.maxTeams || 20}" min="1" style="background:#ffffff; border:1.5px solid #8b5cf6;" oninput="updateMaxParticipantsFromTeam()">
                <div style="font-size:10.5px; color:#6d28d9; margin-top:3px; font-weight:500;">Total = Teams × Max Members</div>
              </div>
            </div>
          </div>
        </div>

        <div class="toggle-row">
          <label class="toggle-sw"><input type="checkbox" id="ev-needs-payment" ${(existingEv?.needsPayment || existingEv?.fee > 0) ? 'checked' : ''}><span class="toggle-track"></span></label>
          <div class="toggle-info">
            <div class="toggle-lbl">Require Payment Proof</div>
            <div class="toggle-desc" style="color:#64748b;">Students must submit a Transaction ID / UTR and payment screenshot for organizer approval.</div>
          </div>
        </div>

        <div class="form-row" style="margin-top:10px;">
          <div class="form-group"><label>Entry Fee (₹) — 0 = Free</label><input type="number" id="create-ev-fee" value="${existingEv?.fee || 0}" min="0"></div>
          <div class="form-group"><label>Club UPI ID (for payments)</label><input type="text" id="create-ev-upi" placeholder="e.g. clubname@upi"></div>
        </div>

        <div class="form-group"><label>Speakers / Resource Persons</label><input type="text" id="ev-speakers" placeholder="Dr. Ramesh Kumar, Prof. Meena S"></div>

        <div class="form-group" style="background:#fef2f2; border:1.5px solid #fecaca; border-radius:12px; padding:14px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label style="font-weight:700; color:#b91c1c; margin:0; display:flex; align-items:center; gap:6px;">
              ⚖️ Rules / Terms & Guidelines *
            </label>
            <span style="font-size:11px; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; padding:2px 8px; border-radius:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">⚠️ Crucial</span>
          </div>
          <textarea id="ev-rules" rows="3" placeholder="Specify team guidelines, eligibility criteria, submission rules, dress code, dos and don'ts..." style="width:100%; border:1.5px solid #fca5a5; border-radius:8px; padding:10px 12px; font-size:13.5px; background:#ffffff; outline:none; box-sizing:border-box; font-family:'Inter',sans-serif;"></textarea>
          <div style="font-size:11px; color:#991b1b; margin-top:5px; font-weight:500;">💡 Clearly stated rules prevent disputes and guide participants during the event.</div>
        </div>

        <div class="form-divider">Event Poster (optional)</div>
        <div class="upload-zone" onclick="document.getElementById('ev-poster-input').click()">
          <div class="upload-icon">🖼️</div>
          <p id="ev-poster-txt">${existingEv?.poster ? 'Poster loaded — click to replace' : 'Click to upload event poster'}</p>
          <span>PNG, JPG supported</span>
          <input type="file" id="ev-poster-input" accept="image/*" style="display:none;" onchange="handlePosterUpload(event)">
          <input type="hidden" id="ev-poster-data" value="">
        </div>
        <img id="ev-poster-preview" style="${existingEv?.poster ? 'display:block;' : 'display:none;'}width:100%;max-height:180px;object-fit:cover;border-radius:10px;margin-top:8px;">

        <div class="create-form-btns">
          <button type="button" class="btn-create-draft" onclick="submitEvent('draft')">Save as Draft</button>
          <button type="button" class="btn-create-submit" onclick="submitEvent('pending')">${existingEv ? 'Save & Resubmit for Approval →' : 'Submit for Approval →'}</button>
        </div>
      </div>
    </div>
  `;

  // Populate field values safely via DOM properties (preserves quotes/special chars)
  document.getElementById('ev-name').value = existingEv?.name || '';
  document.getElementById('ev-club').value = existingEv?.club || STATE.user?.clubName || '';
  document.getElementById('ev-desc').value = existingEv?.desc || '';
  document.getElementById('ev-date').value = existingEv?.date || '';
  document.getElementById('ev-time').value = normalizeTimeForInput(existingEv?.time || '');
  document.getElementById('ev-end-time').value = normalizeTimeForInput(existingEv?.endTime || '');
  document.getElementById('ev-venue').value = existingVenue;
  document.getElementById('ev-cat').value = existingEv?.category || 'Technical';
  document.getElementById('create-ev-upi').value = existingEv?.adminUpiId || '';
  document.getElementById('ev-speakers').value = existingEv?.speakers || '';
  document.getElementById('ev-rules').value = existingEv?.rules || '';
  if (existingEv?.poster) {
    document.getElementById('ev-poster-data').value = existingEv.poster;
    document.getElementById('ev-poster-preview').src = existingEv.poster;
  }

  if (typeof toggleTeamFields === 'function' && isTeam) {
    toggleTeamFields();
  }

  attachCreateEventClashListeners();
  if (existingEv && existingEv.date && existingEv.time && existingEv.venue) {
    runRealtimeVenueClashCheck(++_clashCheckSeq);
  }
}

function normalizeTimeForInput(t) {
  const mins = parseTimeToMinutes(t);
  if (mins === null) return '';
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function autoFillEndTimeIfEmpty() {
  const startVal = document.getElementById('ev-time')?.value || '';
  const endInp = document.getElementById('ev-end-time');
  if (!startVal || !endInp || endInp.value) return;
  const startMin = parseTimeToMinutes(startVal);
  if (startMin === null) return;
  const endMin = Math.min(23 * 60 + 59, startMin + 120);
  const hh = String(Math.floor(endMin / 60)).padStart(2, '0');
  const mm = String(endMin % 60).padStart(2, '0');
  endInp.value = `${hh}:${mm}`;
}

function attachCreateEventClashListeners() {
  const dateEl = document.getElementById('ev-date');
  const timeEl = document.getElementById('ev-time');
  const endEl  = document.getElementById('ev-end-time');
  const venueEl = document.getElementById('ev-venue');

  if (timeEl) {
    timeEl.addEventListener('change', autoFillEndTimeIfEmpty);
    timeEl.addEventListener('input', scheduleVenueClashCheck);
    timeEl.addEventListener('change', scheduleVenueClashCheck);
  }
  [dateEl, endEl, venueEl].forEach(inp => {
    if (!inp) return;
    inp.addEventListener('input', scheduleVenueClashCheck);
    inp.addEventListener('change', scheduleVenueClashCheck);
  });
}

function syncCreateSubmitButtonState() {
  if (_isSubmittingEvent) return;
  const submitBtn = document.querySelector('.btn-create-submit');
  if (!submitBtn) return;

  const blocked = _isCheckingClash || _hasVenueClash || _hasInvalidTimeRange;
  submitBtn.disabled = blocked;
  submitBtn.style.opacity = blocked ? '0.55' : '1';
  submitBtn.style.cursor = blocked ? 'not-allowed' : 'pointer';

  if (_isCheckingClash) {
    submitBtn.title = 'Checking venue & schedule availability...';
  } else if (_hasInvalidTimeRange) {
    submitBtn.title = 'End Time must be later than Start Time.';
  } else if (_hasVenueClash) {
    submitBtn.title = 'Resolve the venue/time conflict before submitting.';
  } else {
    submitBtn.title = '';
  }
}

function renderClashBannerState(state, payload = null) {
  const banner = document.getElementById('ev-clash-banner');
  if (!banner) return;

  if (state === 'hidden') {
    banner.style.display = 'none';
    banner.innerHTML = '';
    return;
  }

  if (state === 'checking') {
    banner.style.display = 'block';
    banner.innerHTML = `
      <div style="background:#eff6ff; border:1.5px solid #bfdbfe; color:#1e40af; padding:11px 14px; border-radius:10px; font-size:13px; font-weight:600; display:flex; align-items:center; gap:8px;">
        <span>⏳</span>
        <span>Checking real-time venue & schedule availability...</span>
      </div>`;
    return;
  }

  if (state === 'invalid_time') {
    banner.style.display = 'block';
    banner.innerHTML = `
      <div style="background:#fef2f2; border:1.5px solid #fecaca; color:#b91c1c; padding:12px 14px; border-radius:10px; font-size:13px; font-weight:700; display:flex; align-items:center; gap:8px;">
        <span>⚠️</span>
        <span>End Time must be later than Start Time.</span>
      </div>`;
    return;
  }

  if (state === 'conflict' && Array.isArray(payload) && payload.length > 0) {
    banner.style.display = 'block';
    banner.innerHTML = `
      <div style="background:#fef2f2; border:1.5px solid #f87171; border-radius:12px; padding:14px 16px; box-shadow:0 4px 12px rgba(239,68,68,0.1);">
        <div style="display:flex; align-items:center; gap:8px; font-weight:800; font-size:13.5px; color:#991b1b; margin-bottom:10px;">
          <span style="font-size:18px;">⚠️</span>
          <span>VENUE &amp; SCHEDULE CLASH DETECTED — Submission Blocked</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${payload.map(c => `
            <div style="background:#ffffff; border:1px solid #fca5a5; border-radius:8px; padding:10px 12px; font-size:12.5px; color:#1e293b;">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                <strong style="font-size:13.5px; color:#991b1b;">${escapeHTML(c.name || 'Untitled Event')}</strong>
                <span class="badge ${c.status === 'approved' ? 'badge-green' : 'badge-amber'}">${escapeHTML(String(c.status || 'pending').toUpperCase())}</span>
              </div>
              <div style="color:#475569; margin-bottom:3px;">🏛️ <strong>Organizing Club:</strong> ${escapeHTML(c.club || 'Unknown Club')}</div>
              <div style="color:#475569;">📅 <strong>Booked Slot:</strong> ${escapeHTML(formatDate(c.date))} &bull; 📍 ${escapeHTML(c.venue)} &bull; 🕐 ${escapeHTML(formatEventTimeSlot(c))}</div>
            </div>
          `).join('')}
        </div>
        <div style="font-size:11.5px; color:#b91c1c; font-weight:600; margin-top:10px;">
          Please pick a different Venue, Event Date, or non-overlapping Start/End Time to enable submission.
        </div>
      </div>`;
    return;
  }

  if (state === 'available') {
    banner.style.display = 'block';
    banner.innerHTML = `
      <div style="background:#f0fdf4; border:1.5px solid #86efac; color:#15803d; padding:10px 14px; border-radius:10px; font-size:12.5px; font-weight:700; display:flex; align-items:center; gap:8px;">
        <span>✅</span>
        <span>Venue slot is available (${escapeHTML(formatDate(payload.date))} • ${escapeHTML(payload.venue)} • ${escapeHTML(formatTime(payload.time))} – ${escapeHTML(formatTime(payload.endTime))}).</span>
      </div>`;
  }
}

async function fetchConflictingVenueEvents({ date, time, endTime, venue, excludeEventId = null }) {
  const draftEv = {
    id: excludeEventId || '__new_event__',
    date,
    time,
    endTime,
    venue
  };

  let candidateEvents = [];
  const sb = getSupabaseClient();

  if (sb && typeof sb.from === 'function') {
    try {
      let query = sb
        .from('events')
        .select('id, name, club, date, time, end_time, venue, status')
        .eq('date', date)
        .ilike('venue', venue)
        .in('status', SLOT_BLOCKING_STATUSES);

      if (excludeEventId) {
        query = query.neq('id', excludeEventId);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        candidateEvents = data.map(r => ({
          id: r.id,
          name: r.name,
          club: r.club,
          date: r.date,
          time: r.time,
          endTime: r.end_time || '',
          venue: r.venue,
          status: r.status
        }));
      }
    } catch (e) {
      console.warn('Supabase real-time clash query fallback to cache:', e);
    }
  }

  // Merge local cached active events to ensure offline/pending cache hits are never missed
  const cached = getDB('vvce_events');
  cached.forEach(ev => {
    if (!candidateEvents.some(c => String(c.id) === String(ev.id))) {
      candidateEvents.push(ev);
    }
  });

  return candidateEvents.filter(other => {
    if (excludeEventId && String(other.id) === String(excludeEventId)) return false;
    return doEventSlotsOverlap(draftEv, other);
  });
}

function scheduleVenueClashCheck() {
  clearTimeout(_clashDebounceTimer);
  const seqId = ++_clashCheckSeq;

  const date    = document.getElementById('ev-date')?.value || '';
  const time    = document.getElementById('ev-time')?.value || '';
  const endTime = document.getElementById('ev-end-time')?.value || '';
  const venue   = document.getElementById('ev-venue')?.value || '';

  if (!date || !time || !endTime || !venue) {
    _isCheckingClash = false;
    _hasVenueClash = false;
    _hasInvalidTimeRange = false;
    renderClashBannerState('hidden');
    syncCreateSubmitButtonState();
    return;
  }

  const startMin = parseTimeToMinutes(time);
  const endMin = parseTimeToMinutes(endTime);
  if (startMin === null || endMin === null || endMin <= startMin) {
    _isCheckingClash = false;
    _hasInvalidTimeRange = true;
    _hasVenueClash = false;
    renderClashBannerState('invalid_time');
    syncCreateSubmitButtonState();
    return;
  }

  _hasInvalidTimeRange = false;
  _isCheckingClash = true;
  renderClashBannerState('checking');
  syncCreateSubmitButtonState();

  _clashDebounceTimer = setTimeout(() => {
    runRealtimeVenueClashCheck(seqId);
  }, 300);
}

async function runRealtimeVenueClashCheck(seqId) {
  const date    = document.getElementById('ev-date')?.value || '';
  const time    = document.getElementById('ev-time')?.value || '';
  const endTime = document.getElementById('ev-end-time')?.value || '';
  const venue   = document.getElementById('ev-venue')?.value || '';

  if (!date || !time || !endTime || !venue) {
    if (seqId === _clashCheckSeq) {
      _isCheckingClash = false;
      _hasVenueClash = false;
      renderClashBannerState('hidden');
      syncCreateSubmitButtonState();
    }
    return;
  }

  const startMin = parseTimeToMinutes(time);
  const endMin = parseTimeToMinutes(endTime);
  if (startMin === null || endMin === null || endMin <= startMin) {
    if (seqId === _clashCheckSeq) {
      _isCheckingClash = false;
      _hasInvalidTimeRange = true;
      _hasVenueClash = false;
      renderClashBannerState('invalid_time');
      syncCreateSubmitButtonState();
    }
    return;
  }

  const conflicts = await fetchConflictingVenueEvents({
    date,
    time,
    endTime,
    venue,
    excludeEventId: window._editingEventId || null
  });

  if (seqId !== _clashCheckSeq) return; // Stale response

  _isCheckingClash = false;
  _hasInvalidTimeRange = false;
  _hasVenueClash = conflicts.length > 0;

  if (_hasVenueClash) {
    renderClashBannerState('conflict', conflicts);
  } else {
    renderClashBannerState('available', { date, time, endTime, venue });
  }
  syncCreateSubmitButtonState();
}

window.handleBranchCheckboxChange = function(cb) {
  const allCb = document.querySelector('input[name="target-branch"][value="All"]');
  const others = [...document.querySelectorAll('input[name="target-branch"]:not([value="All"])')];
  
  if (cb.value === 'All') {
    if (cb.checked) {
      others.forEach(o => o.checked = false);
    }
  } else {
    if (cb.checked && allCb) {
      allCb.checked = false;
    }
    if (!others.some(o => o.checked) && allCb) {
      allCb.checked = true;
    }
  }
};

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

async function submitEvent(status='pending') {
  if (_isSubmittingEvent) return;

  const name    = document.getElementById('ev-name').value.trim();
  const club    = document.getElementById('ev-club').value.trim();
  const date    = document.getElementById('ev-date').value;
  const time    = document.getElementById('ev-time').value;
  const endTime = document.getElementById('ev-end-time')?.value || '';
  const max     = parseInt(document.getElementById('ev-max').value||'100');
  const venue   = document.getElementById('ev-venue').value;
  const cat     = document.getElementById('ev-cat').value;
  const checkedBranchEls = [...document.querySelectorAll('input[name="target-branch"]:checked')];
  let branches = checkedBranchEls.map(cb => cb.value);
  if (!branches.length || branches.includes('All')) {
    branches = ['All'];
  }

  const desc  = document.getElementById('ev-desc').value.trim();
  const rules = document.getElementById('ev-rules').value.trim();
  if (!name||!club||!date||!time||!endTime||!venue||!desc||!rules) {
    toast('Please fill all required fields (marked with *, including End Time).','error');
    return;
  }

  const startMin = parseTimeToMinutes(time);
  const endMin = parseTimeToMinutes(endTime);
  if (startMin === null || endMin === null || endMin <= startMin) {
    _hasInvalidTimeRange = true;
    renderClashBannerState('invalid_time');
    syncCreateSubmitButtonState();
    toast('⚠️ End Time must be later than Start Time.', 'error');
    return;
  }

  const userClub = STATE.user;
  const authorityId = userClub.authorityId || null;
  const authorityName = userClub.authorityName || 'Approving Authority';
  const fee = parseInt(document.getElementById('create-ev-fee').value||'0');
  const needsPayment = Boolean(document.getElementById('ev-needs-payment')?.checked || fee > 0);
  const upiId = document.getElementById('create-ev-upi')?.value.trim() || '';
  if ((fee > 0 || needsPayment) && !upiId) {
    toast('⚠️ Payment proof is required — please add a Club UPI ID (or disable Require Payment Proof & set fee to 0).', 'error');
    return;
  }

  const isTeamEvent = document.getElementById('ev-is-team')?.checked || false;
  const minTeamSize = isTeamEvent ? parseInt(document.getElementById('ev-team-min')?.value || '2') : 1;
  const maxTeamSize = isTeamEvent ? parseInt(document.getElementById('ev-team-max')?.value || '4') : 1;
  const maxTeams    = isTeamEvent ? parseInt(document.getElementById('ev-max-teams')?.value || '20') : 0;

  if (isTeamEvent && (!maxTeams || maxTeams < 1)) {
    toast('⚠️ Please enter the maximum number of teams allowed.', 'error');
    return;
  }

  const editingId = window._editingEventId || null;

  // Lock submit buttons during pre-submit validation & persistence
  _isSubmittingEvent = true;
  const submitBtn = document.querySelector('.btn-create-submit');
  const draftBtn  = document.querySelector('.btn-create-draft');
  const origSubmitLabel = submitBtn ? submitBtn.textContent : 'Submit for Approval →';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = status === 'pending' ? `Checking & Sending to ${authorityName}... ⏳` : 'Saving Draft... ⏳';
    submitBtn.style.opacity = '0.65';
    submitBtn.style.cursor = 'not-allowed';
  }
  if (draftBtn) {
    draftBtn.disabled = true;
    draftBtn.style.opacity = '0.65';
    draftBtn.style.cursor = 'not-allowed';
  }

  try {
    // 1. Final client + direct Supabase overlap check right before saving
    if (status !== 'draft') {
      const conflicts = await fetchConflictingVenueEvents({
        date,
        time,
        endTime,
        venue,
        excludeEventId: editingId
      });
      if (conflicts.length > 0) {
        _hasVenueClash = true;
        renderClashBannerState('conflict', conflicts);
        const first = conflicts[0];
        toast(`⚠️ Venue conflict with "${first.name}" (${first.club}) on ${formatDate(first.date)} (${formatEventTimeSlot(first)}).`, 'error', 5500);
        return;
      }
    }

    const computedMax = isTeamEvent ? (maxTeams * maxTeamSize) : max;
    const events = getDB('vvce_events');
    const prevEv = editingId ? events.find(e => String(e.id) === String(editingId)) : null;

    const ev = {
      ...(prevEv || {}),
      id: prevEv ? prevEv.id : genId('ev'),
      name,
      club,
      adminId: prevEv?.adminId || STATE.user.id,
      emoji: prevEv?.emoji || '🎓',
      category: cat,
      date,
      time,
      endDate: date,
      endTime,
      venue,
      maxParticipants: computedMax,
      regCount: prevEv?.regCount || 0,
      fee,
      needsPayment,
      adminUpiId: upiId,
      desc,
      speakers: document.getElementById('ev-speakers').value.trim(),
      rules,
      poster: document.getElementById('ev-poster-data').value || null,
      branches: branches.length ? branches : ['All'],
      isTeamEvent,
      minTeamSize,
      maxTeamSize,
      maxTeams,
      teams: prevEv?.teams || [],
      status,
      rejReason: null,
      registrations: prevEv?.registrations || [],
      pendingPayments: prevEv?.pendingPayments || [],
      authorityId: prevEv?.authorityId || authorityId,
      authorityName: prevEv?.authorityName || authorityName,
      decisionHistory: [
        ...(prevEv?.decisionHistory || []),
        {
          action: prevEv ? 'resubmitted' : 'submitted',
          authorityId: prevEv?.authorityId || authorityId,
          authorityName: prevEv?.authorityName || authorityName,
          timestamp: new Date().toISOString()
        }
      ]
    };

    // 2. Atomic DB concurrency guard via Postgres RPC (with safe direct-upsert fallback)
    const sb = getSupabaseClient();
    let savedAtomically = false;
    const dbRow = mapEventForSupabase(ev);

    if (sb) {
      try {
        const rpcName = prevEv ? 'update_event_with_clash_check' : 'create_event_with_clash_check';
        const rpcArgs = prevEv ? { p_event_id: ev.id, p_event: dbRow } : { p_event: dbRow };
        const { data: rpcData, error: rpcErr } = await sb.rpc(rpcName, rpcArgs);

        if (!rpcErr && rpcData) {
          if (!rpcData.success) {
            if (rpcData.clash && rpcData.conflict) {
              _hasVenueClash = true;
              renderClashBannerState('conflict', [rpcData.conflict]);
            }
            toast(`⚠️ ${rpcData.error || 'Slot already booked by another event.'}`, 'error', 6000);
            return;
          }
          savedAtomically = true;
        }
      } catch (rpcException) {
        console.warn('Atomic clash-check RPC unavailable, falling back to direct upsert:', rpcException);
      }

      if (!savedAtomically) {
        if (status !== 'draft') {
          const freshConflicts = await fetchConflictingVenueEvents({
            date,
            time,
            endTime,
            venue,
            excludeEventId: editingId
          });
          if (freshConflicts.length > 0) {
            _hasVenueClash = true;
            renderClashBannerState('conflict', freshConflicts);
            toast(`⚠️ Venue conflict detected just before saving.`, 'error', 5500);
            return;
          }
        }
        const { error: upsertErr } = await sb.from('events').upsert([dbRow]);
        if (upsertErr) {
          throw new Error(upsertErr.message);
        }
      }

      await syncEventsFromSupabase();
      await syncApprovingAuthoritiesFromSupabase();
    } else {
      if (prevEv) {
        const idx = events.findIndex(e => String(e.id) === String(ev.id));
        if (idx > -1) events[idx] = ev;
        else events.push(ev);
      } else {
        events.push(ev);
      }
      await setDB('vvce_events', events);
    }

    // Ensure local cache has latest event immediately
    const cachedAfter = getDB('vvce_events');
    const cIdx = cachedAfter.findIndex(e => String(e.id) === String(ev.id));
    if (cIdx > -1) cachedAfter[cIdx] = ev;
    else cachedAfter.push(ev);
    SUPABASE_CACHE.vvce_events = cachedAfter;
    try { localStorage.setItem('vvce_events', JSON.stringify(cachedAfter)); } catch (e) {}

    window._editingEventId = null;

    if (status === 'pending') {
      toast(`Event request "${name}" sent to ${authorityName} for approval! ⏳`, 'success');
      const users = getDB('vvce_users');
      const authRecord = getActiveApprovingAuthorities().find(a => a.id === authorityId);
      const authEmail = authRecord?.email ? authRecord.email.toLowerCase() : null;
      const targets = users.filter(u => u.type === 'authority' && (
        !authorityId || u.id === authorityId || (authEmail && (u.email || '').toLowerCase() === authEmail)
      ));
      targets.forEach(u => {
        if (!u.notifs) u.notifs = [];
        u.notifs.push({ id: genId('n'), msg: `New event "${name}" by ${club} needs your approval.`, icon: '📋', time: 'Just now', timestamp: Date.now(), read: false });
      });
      await setDB('vvce_users', users);
      showPage('admin-dashboard');
    } else {
      toast(`Event saved as draft.`, 'info');
      showPage('manage-events');
    }
  } catch (err) {
    console.error('Error submitting event:', err);
    toast('Error submitting event: ' + err.message, 'error');
  } finally {
    _isSubmittingEvent = false;
    if (submitBtn) {
      submitBtn.textContent = origSubmitLabel;
    }
    if (draftBtn) {
      draftBtn.disabled = false;
      draftBtn.style.opacity = '1';
      draftBtn.style.cursor = 'pointer';
    }
    syncCreateSubmitButtonState();
  }
}


/* ─── Module: js/pages/manage-events.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Manage Organized Club Events
   Path: js/pages/manage-events.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   MANAGE EVENTS PAGE (Admin)
───────────────────────────────────────────────────────────────*/
function renderManageEventsPage() {
  const events = getDB('vvce_events').filter(e=>e.adminId===STATE.user.id && e.status !== 'archived');
  const allScheduled = getDB('vvce_events').filter(e=>e.status==='approved'||e.status==='pending');

  const el = document.getElementById('page-manage-events');
  el.innerHTML = `
    <div class="sec-head">
      <span class="sec-title">My Events (${events.length})</span>
      <button class="btn btn-gold" onclick="showPage('create-event')">+ Create Event</button>
    </div>
    ${events.length
      ? events.map(e=>{
        const clash = isSlotBlockingEvent(e) ? allScheduled.find(o => doEventSlotsOverlap(e, o)) : null;
        return `
        <div class="ev-row" style="${clash ? 'border-left: 4.5px solid #ef4444; background: #fff8f8; box-shadow: 0 2px 8px rgba(239,68,68,0.1);' : ''}">
          <span class="ev-row-emoji">${escapeHTML(e.emoji||'🎓')}</span>
          <div class="ev-row-info">
            <div class="ev-row-name">
              ${clash ? '<span style="color:#ef4444; font-weight:800;">⚠️ </span>' : ''}${escapeHTML(e.name)}
            </div>
            <div class="ev-row-meta">${escapeHTML(formatDate(e.date))} • ${escapeHTML(formatEventTimeSlot(e))} • ${escapeHTML(e.venue)} • ${e.isTeamEvent ? `👥 ${(e.teams||[]).length} teams (${e.regCount||0}/${e.maxParticipants})` : `👤 ${e.regCount||0}/${e.maxParticipants} registered`}</div>
            ${clash ? `<div style="font-size:11px;font-weight:700;color:#dc2626;background:#fee2e2;border:1px solid #fca5a5;padding:3px 8px;border-radius:6px;display:inline-block;margin-top:4px;">⚡ Slot Clash with "${escapeHTML(clash.name)}" (${escapeHTML(clash.club)}) on ${escapeHTML(formatDate(e.date))} (${escapeHTML(formatEventTimeSlot(clash))}) at ${escapeHTML(e.venue)}</div>` : ''}
            ${e.rejReason?`<div style="font-size:11px;color:#dc2626;margin-top:3px;">Rejected: ${escapeHTML(e.rejReason)}</div>`:''}
          </div>
          <span class="badge ${clash ? 'badge-red' : (e.status==='approved'?'badge-green':e.status==='pending'?'badge-amber':e.status==='draft'?'badge-gray':'badge-red')}">${clash ? '⚠️ CLASH' : escapeHTML(e.status)}</span>
          <div class="ev-row-acts">
            <button class="btn btn-outline" onclick="openEventModal('${escapeHTML(e.id)}')">View</button>
            ${(e.status==='draft'||e.status==='pending'||e.status==='rejected')?`<button class="btn btn-outline" onclick="editClubEvent('${escapeHTML(e.id)}')">Edit</button>`:''}
            ${e.status==='draft'?`<button class="btn btn-gold" onclick="submitDraftEvent('${escapeHTML(e.id)}')">Submit</button>`:''}
          </div>
        </div>`;
      }).join('')
      : `<div class="empty-state"><div class="ei">📅</div><div class="et">No events yet</div><div class="es">Create your first event to get started.</div><button class="btn btn-gold" style="margin-top:12px;" onclick="showPage('create-event')">Create Event</button></div>`
    }
  `;
  syncEventsFromSupabase().then(fresh => {
    const freshCount = fresh.filter(e => e.adminId === STATE.user.id && e.status !== 'archived').length;
    if (freshCount !== events.length && STATE.page === 'manage-events') {
      renderManageEventsPage();
    }
  });
}

async function submitDraftEvent(id) {
  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === id);
  if (!ev) return;

  // Prevent submitting a draft if an active event already occupies the overlapping venue time slot
  const clash = events.find(o => doEventSlotsOverlap(ev, o));
  if (clash) {
    toast(`⚠️ Slot Clash with "${clash.name}" (${clash.club}) on ${formatDate(clash.date)} (${formatEventTimeSlot(clash)}) at ${clash.venue}. Edit date/time/venue first.`, 'error', 5500);
    return;
  }

  const authorityId = ev.authorityId || STATE.user?.authorityId || null;
  const authorityName = ev.authorityName || STATE.user?.authorityName || 'Approving Authority';
  ev.status = 'pending';
  ev.authorityId = authorityId;
  ev.authorityName = authorityName;
  if (!ev.decisionHistory) ev.decisionHistory = [];
  ev.decisionHistory.push({
    action: 'submitted',
    authorityId,
    authorityName,
    timestamp: new Date().toISOString()
  });

  await setDB('vvce_events', events);
  const sb = getSupabaseClient();
  if (sb) {
    try {
      await sb.from('events').upsert([mapEventForSupabase(ev)]);
    } catch (e) { console.warn('Draft submit Supabase sync warning:', e); }
  }

  const users = getDB('vvce_users');
  const authRecord = getActiveApprovingAuthorities().find(a => a.id === authorityId);
  const authEmail = authRecord?.email ? authRecord.email.toLowerCase() : null;
  users.filter(u => u.type === 'authority' && (
    !authorityId || u.id === authorityId || (authEmail && (u.email || '').toLowerCase() === authEmail)
  )).forEach(u => {
    const nObj = { id: genId('n'), msg: `New event "${ev.name}" by ${ev.club} needs your approval.`, icon: '📋', time: 'Just now', timestamp: Date.now(), read: false };
    if (typeof pushUserNotifAtomic === 'function') pushUserNotifAtomic(u.id, nObj);
  });

  toast(`Event "${ev.name}" submitted to ${authorityName} for approval! ✅`, 'success');
  showPage('admin-dashboard');
}


/* ─── Module: js/pages/participants.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Participants Management & QR Attendance Scanner
   Path: js/pages/participants.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   PARTICIPANTS PAGE (Admin)
───────────────────────────────────────────────────────────────*/
function renderParticipantsPage() {
  const myEvents = getDB('vvce_events').filter(e => e.adminId === STATE.user.id && e.status === 'approved');
  const allUsers = getDB('vvce_users');
  const el = document.getElementById('page-participants');

  if (!myEvents.length) {
    el.innerHTML = `<div class="empty-state"><div class="ei">👥</div><div class="et">No approved events</div></div>`;
    return;
  }

  let pendingHtml = '';
  let pendingCount = 0;

  myEvents.forEach(ev => {
    const queue = (ev.pendingPayments || []).filter(p => {
      const st = p.status || 'pending_approval';
      return st === 'pending_approval';
    });

    queue.forEach(p => {
      const student = allUsers.find(u => u.id === p.uid);
      const displayName = student?.name || p.userName || 'Student';
      const displayId = student?.usn || p.usn || student?.email || p.userEmail || p.uid;
      const team = p.teamId
        ? (ev.teams || []).find(t => String(t.id) === String(p.teamId))
        : (p.teamData?.teamId ? (ev.teams || []).find(t => String(t.id) === String(p.teamData.teamId)) : null);

      const isGroup = Boolean(p.isTeam || team);
      const memberIds = team ? (team.memberIds || []) : [p.uid];
      const rosterMembers = memberIds.map(mid => {
        const u = allUsers.find(usr => usr.id === mid);
        return u ? `${titleCase(u.name)}${u.usn ? ` (${u.usn})` : ''}` : (mid === p.uid ? titleCase(displayName) : mid);
      });

      pendingCount++;
      const screenshotKey = `${ev.id}::${p.uid}${team ? '::' + team.id : ''}`;
      PENDING_SCREENSHOTS[screenshotKey] = p.screenshot || '';
      const hasScreenshot = !!p.screenshot;
      const utrText = p.utrNumber || p.utr_number || '';
      const teamIdArg = team ? team.id : '';
      const submittedStr = p.submittedAt || p.date || new Date().toISOString();

      pendingHtml += `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;padding:14px 16px;
          background:linear-gradient(135deg,#1e1a2e,#2d1f3d);border-radius:12px;margin-bottom:10px;
          border:1px solid rgba(251,191,36,0.35);flex-wrap:wrap;gap:12px;">
          <div style="flex:1;min-width:220px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
              <span style="font-weight:800;color:#fbbf24;font-size:14px;">
                ${isGroup ? `👥 Team: ${escapeHTML(team?.name || p.teamName || p.teamData?.teamName || 'Team')}` : `👤 ${escapeHTML(titleCase(displayName))}`}
              </span>
              <span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:10px;background:${isGroup ? 'rgba(139,92,246,0.22)' : 'rgba(59,130,246,0.22)'};color:${isGroup ? '#ddd6fe' : '#bfdbfe'};">
                ${isGroup ? `Group (${rosterMembers.length} members)` : 'Solo'}
              </span>
              ${(ev.fee > 0 || ev.needsPayment)
                ? `<span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(245,158,11,0.2);color:#fde68a;">💳 ₹${escapeHTML(ev.fee || 0)}</span>`
                : `<span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(16,185,129,0.2);color:#a7f3d0;">🆓 Free Entry</span>`
              }
            </div>
            <div style="font-size:12px;color:#e2e8f0;margin-bottom:3px;">
              <strong>${escapeHTML(ev.name)}</strong> &bull; Lead / Registrant: ${escapeHTML(titleCase(displayName))} (${escapeHTML(displayId)})
            </div>
            ${isGroup ? `
              <div style="font-size:11.5px;color:#cbd5e1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:6px 10px;margin:6px 0;">
                <strong style="color:#a5b4fc;">Confirmed Team Roster:</strong> ${rosterMembers.map(r => escapeHTML(r)).join(', ')}
              </div>` : ''}
            ${utrText ? `<div style="font-size:11.5px;color:#93c5fd;margin-top:3px;">🔢 <strong>UTR / Transaction ID:</strong> <code style="background:rgba(15,23,42,0.7);padding:2px 6px;border-radius:4px;color:#f8fafc;">${escapeHTML(utrText)}</code></div>` : ''}
            <div style="font-size:11px;color:#9ca3af;margin-top:3px;">Submitted: ${escapeHTML(formatDate(submittedStr.split('T')[0]))}</div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;align-self:center;">
            ${hasScreenshot
              ? `<button type="button" onclick="viewScreenshot('${escapeHTML(screenshotKey)}')" style="padding:8px 12px;background:#3b82f6;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:11.5px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                  📸 View Payment Proof
                 </button>`
              : ((ev.fee > 0 || ev.needsPayment) ? `<span style="padding:8px 12px;background:#374151;color:#9ca3af;border-radius:8px;font-size:11px;">No screenshot</span>` : '')
            }
            <button type="button" onclick="approvePayment('${escapeHTML(ev.id)}','${escapeHTML(p.uid)}','${escapeHTML(teamIdArg)}',this)" style="padding:8px 14px;background:#10b981;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:11.5px;cursor:pointer;">✅ Approve &amp; Confirm Registration</button>
            <button type="button" onclick="rejectPayment('${escapeHTML(ev.id)}','${escapeHTML(p.uid)}','${escapeHTML(teamIdArg)}',this)" style="padding:8px 12px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:11.5px;cursor:pointer;">✕ Reject</button>
          </div>
        </div>`;
    });
  });

  let html = `
    <div style="margin-bottom:18px; background:rgba(15,23,42,0.03); border:1px solid #e2e8f0; border-radius:14px; padding:14px 16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <div style="font-weight:800;color:#0f172a;font-size:15px;">⏳ Pending Registrations / Verify Payments (${pendingCount})</div>
        <span style="font-size:11.5px;color:#64748b;">Verify payment proofs &amp; team rosters before confirming seats</span>
      </div>
      ${pendingHtml || `<div style="font-size:12.5px;color:#64748b;padding:8px 0;">✅ No registrations or payment proofs waiting for verification right now.</div>`}
    </div>
    <div class="filter-row">
      <select class="filter-sel" id="part-ev-filter" onchange="renderParticipantTable()">
        ${myEvents.map(e => `<option value="${escapeHTML(e.id)}">${escapeHTML(e.name)}</option>`).join('')}
      </select>
      <input class="search-inp" id="part-search" placeholder="🔍 Search participant…" oninput="renderParticipantTable()">
    </div>
    <div id="part-table-wrap"></div>
  `;
  el.innerHTML = html;
  renderParticipantTable();
}

window.viewScreenshot = function(key) {
  const src = PENDING_SCREENSHOTS[key] || key;
  if (!src || src === 'undefined') {
    toast('No screenshot available for this submission.', 'error');
    return;
  }
  document.getElementById('screenshot-img-view').src = src;
  openModal('modal-screenshot');
};

window.approvePayment = async function(eventId, uid, teamId = '', btn = null) {
  if (!confirm('Approve and confirm this registration? Remaining seat capacity will be verified.')) return;

  const origText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Confirming... ⏳'; }

  try {
    const events = getDB('vvce_events');
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;

    const pmt = (ev.pendingPayments || []).find(p =>
      (p.uid === uid && (!teamId || !p.teamId || String(p.teamId) === String(teamId))) ||
      (teamId && String(p.teamId || p.teamData?.teamId) === String(teamId))
    );
    const resolvedTeamId = teamId || pmt?.teamId || pmt?.teamData?.teamId || null;
    const team = resolvedTeamId ? (ev.teams || []).find(t => String(t.id) === String(resolvedTeamId)) : null;

    const memberIdsToConfirm = team ? [...new Set(team.memberIds || [uid])] : [uid];
    const currentRegs = [...(ev.registrations || [])];
    const newSeatsNeeded = memberIdsToConfirm.filter(id => !currentRegs.includes(id)).length;
    const maxCap = ev.maxParticipants || ev.max_participants || 100;

    if (currentRegs.length + newSeatsNeeded > maxCap) {
      const seatsLeft = Math.max(0, maxCap - currentRegs.length);
      toast(`❌ Cannot approve: only ${seatsLeft} seat(s) left (needs ${newSeatsNeeded}).`, 'error', 5500);
      return;
    }

    const reviewerName = STATE.user?.name || 'Organizer';
    const reviewedAt = new Date().toISOString();
    const sb = getSupabaseClient();
    let rpcHandled = false;

    if (sb && typeof sb.rpc === 'function') {
      try {
        const { data: rpcData, error: rpcErr } = await sb.rpc('approve_registration_atomic', {
          p_event_id: eventId,
          p_user_id: uid,
          p_reviewer_name: reviewerName,
          p_team_id: resolvedTeamId
        });
        if (!rpcErr && rpcData) {
          if (!rpcData.success) {
            toast(`❌ ${rpcData.error || 'Approval blocked due to capacity limit.'}`, 'error', 5500);
            return;
          }
          rpcHandled = true;
        }
      } catch (e) {
        console.warn('approve_registration_atomic RPC fallback to direct update:', e);
      }
    }

    // Update local + event state cleanly
    memberIdsToConfirm.forEach(id => {
      if (!currentRegs.includes(id)) currentRegs.push(id);
    });
    ev.registrations = currentRegs;
    ev.regCount = currentRegs.length;

    if (team) {
      team.status = 'registered';
      team.paymentStatus = 'approved';
      team.rejectionReason = null;
      team.reviewedBy = reviewerName;
      team.reviewedAt = reviewedAt;
    }
    if (pmt) {
      pmt.status = 'registered';
      pmt.rejectionReason = null;
      pmt.reviewedBy = reviewerName;
      pmt.reviewedAt = reviewedAt;
    }

    if (!rpcHandled && sb && typeof sb.from === 'function') {
      await sb.from('events').update({
        registrations: ev.registrations,
        reg_count: ev.regCount,
        pending_payments: ev.pendingPayments,
        teams: ev.teams
      }).eq('id', eventId).catch(() => {});

      await sb.from('event_registrations').update({
        status: 'registered',
        rejection_reason: null,
        reviewed_by: reviewerName,
        reviewed_at: reviewedAt,
        updated_at: reviewedAt
      }).eq('event_id', eventId).eq('user_id', uid).catch(() => {});
    }

    await setDB('vvce_events', events);

    memberIdsToConfirm.forEach(memberId => {
      addNotifToUser(
        memberId,
        team
          ? `Registration CONFIRMED for "${ev.name}" (Team "${team.name}")! 🎉 Your spot is locked in.`
          : `Registration CONFIRMED for "${ev.name}"! 🎉 Your spot is locked in.`,
        '✅'
      );
    });

    toast('Registration approved and confirmed! 🎉', 'success');
    renderParticipantsPage();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
  }
};

window.rejectPayment = async function(eventId, uid, teamId = '', btn = null) {
  const reason = prompt('Enter reason for rejecting this registration / payment proof (e.g. blurred screenshot or mismatched UTR):');
  if (reason === null) return;
  const cleanReason = reason.trim() || 'Payment proof or registration details could not be verified. Please re-upload.';

  const origText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Rejecting...'; }

  try {
    const events = getDB('vvce_events');
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;

    const pmt = (ev.pendingPayments || []).find(p =>
      (p.uid === uid && (!teamId || !p.teamId || String(p.teamId) === String(teamId))) ||
      (teamId && String(p.teamId || p.teamData?.teamId) === String(teamId))
    );
    const resolvedTeamId = teamId || pmt?.teamId || pmt?.teamData?.teamId || null;
    const team = resolvedTeamId ? (ev.teams || []).find(t => String(t.id) === String(resolvedTeamId)) : null;

    const reviewerName = STATE.user?.name || 'Organizer';
    const reviewedAt = new Date().toISOString();

    if (pmt) {
      pmt.status = 'rejected';
      pmt.rejectionReason = cleanReason;
      pmt.reviewedBy = reviewerName;
      pmt.reviewedAt = reviewedAt;
    }
    if (team) {
      team.status = 'rejected';
      team.paymentStatus = 'rejected';
      team.rejectionReason = cleanReason;
      team.reviewedBy = reviewerName;
      team.reviewedAt = reviewedAt;
    }

    const sb = getSupabaseClient();
    if (sb && typeof sb.from === 'function') {
      await sb.from('events').update({
        pending_payments: ev.pendingPayments,
        teams: ev.teams
      }).eq('id', eventId).catch(() => {});

      await sb.from('event_registrations').update({
        status: 'rejected',
        rejection_reason: cleanReason,
        reviewed_by: reviewerName,
        reviewed_at: reviewedAt,
        updated_at: reviewedAt
      }).eq('event_id', eventId).eq('user_id', uid).catch(() => {});
    }

    await setDB('vvce_events', events);
    addNotifToUser(uid, `Registration/Payment for "${ev.name}" was rejected: ${cleanReason}. You can re-upload your proof from My Registrations.`, '❌');
    toast('Submission rejected with reason.', 'info');
    renderParticipantsPage();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
  }
};

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

  // If team event, prepend a team groupings section
  let teamHtml = '';
  if (ev?.isTeamEvent && (ev.teams||[]).length > 0) {
    teamHtml = `
      <div style="margin-bottom:20px;">
        <div style="font-size:13px; font-weight:700; color:#a5b4fc; text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px;">👥 Teams (${ev.teams.length})</div>
        ${ev.teams.map((team, ti) => {
          const members = allUsers.filter(u => team.memberIds.includes(u.id));
          return `
          <div style="background:linear-gradient(135deg,#0f172a,#1a2744); border:1px solid rgba(99,102,241,0.2); border-radius:12px; padding:14px 16px; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
              <span style="font-size:20px;">🏆</span>
              <div style="flex:1;">
                <div style="font-weight:800; color:#e2e8f0; font-size:15px;">${escapeHTML(team.name)}</div>
                <div style="font-size:11px; color:#6b7280;">Lead: ${escapeHTML(team.leaderName)} &bull; ${members.length} confirmed, ${team.pendingEmails.length} pending</div>
              </div>
              <span style="font-size:11px; font-weight:600; color:#10b981; background:rgba(16,185,129,0.1); padding:3px 10px; border-radius:20px;">Team ${ti+1}</span>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${members.map(m => `
                <div style="display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:5px 10px; font-size:12px; color:#cbd5e1;">
                  ${m.id === team.leaderId ? '⭐' : '👤'} <span>${escapeHTML(titleCase(m.name))}</span>
                  <span style="color:#6b7280; font-size:11px;">${escapeHTML(m.usn||m.email)}</span>
                  <span style="font-size:10px; font-weight:700; color:#10b981; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); padding:1px 6px; border-radius:10px;">✓ Added</span>
                </div>`).join('')}
              ${team.pendingEmails.map(email => {
                const det = (team.pendingMembers || team.memberDetails || []).find(d => (typeof d === 'object' ? d.email : d).toLowerCase() === email.toLowerCase());
                const name = det?.name || '';
                return `
                <div style="display:flex; align-items:center; gap:6px; background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.2); border-radius:8px; padding:5px 10px; font-size:12px; color:#fbbf24;">
                  ✉️ <span>${name ? `<strong>${escapeHTML(name)}</strong> • ` : ''}${escapeHTML(email)}</span>
                  <span style="font-size:10px; font-weight:700; color:#f59e0b; background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.3); padding:1px 6px; border-radius:10px;">⏳ Pending</span>
                </div>`;
              }).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  const attendedCount = parts.filter(p=>attended.includes(p.id)).length;
  const absentCount   = parts.length - attendedCount;
  const attendPct     = parts.length ? Math.round(attendedCount/parts.length*100) : 0;

  wrap.innerHTML=`
    ${teamHtml}
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
        🎓 Marking <strong style="color:#a5b4fc;">Attended</strong> auto-awards<br>Participation Certificate
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
              <td><div class="td-name">${escapeHTML(titleCase(p.name))}</div></td>
              <td>${escapeHTML(p.usn||'—')}</td>
              <td>${escapeHTML(p.branch||'—')} • ${escapeHTML(p.sem||'—')}</td>
              <td>${escapeHTML(p.phone||'—')}</td>
              <td>${escapeHTML(p.email)}</td>
              <td>
                <button
                  onclick="toggleAttendance('${escapeHTML(evId)}','${escapeHTML(p.id)}')"
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
window.toggleAttendance = async function(eventId, userId) {
  if (window._isTogglingAttendance) return;
  window._isTogglingAttendance = true;

  try {
    const events = getDB('vvce_events');
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;
    if (!ev.attendedStudents) ev.attendedStudents = [];

    const isAtt = ev.attendedStudents.includes(userId);
    if (isAtt) {
      ev.attendedStudents = ev.attendedStudents.filter(id => id !== userId);
      renderParticipantTable(); // Update instantly for UX
      await applyAttendanceRewards(eventId, userId, false, ev); // revoke certs + points first
      await setDB('vvce_events', events);                       // then save event state
      toast('Marked as Not Attended — certificate revoked.', 'info');
    } else {
      ev.attendedStudents.push(userId);
      renderParticipantTable(); // Update instantly for UX
      await applyAttendanceRewards(eventId, userId, true, ev);  // issue/revoke certificate
      await setDB('vvce_events', events);                       // then save event state
      toast('Marked as Attended! 🎓 Participation certificate awarded.', 'success');
    }
  } finally {
    window._isTogglingAttendance = false;
  }
};

async function applyAttendanceRewards(eventId, userId, attended, ev) {
  const targetCertId = `ac_${eventId}_${userId}`;
  const certObj = {
    id: targetCertId,
    userId,
    title: ev.name,
    issuer: ev.club || 'VVCE',
    date: ev.date,
    position: 'Participant',
    type: 'participation',
    verified: true,
    autoGenerated: true,
    eventId
  };

  if (typeof syncSingleCertToSupabase === 'function') {
    await syncSingleCertToSupabase(certObj, !attended);
  }
  const sb = getSupabaseClient();
  if (sb && typeof sb.rpc === 'function') {
    try {
      await sb.rpc('toggle_attendance_atomic', {
        p_event_id: eventId,
        p_user_id: userId,
        p_attended: Boolean(attended)
      });
    } catch (_) {}
  }
}


/* Helper to verify if current user is the Dean of Student Welfare */
function isDeanUser(user = STATE.user) {
  if (!user) return false;
  return user.type === 'authority' && (
    user.designation === 'dean' ||
    (user.email && user.email.toLowerCase() === 'dean.sw@vvce.ac.in') ||
    (user.email && user.email.toLowerCase().startsWith('dean'))
  );
}


/* ─── Module: js/pages/authority-portal.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Approving Authority Portal (6-Tab Modern Architecture)
   Path: js/pages/authority-portal.js
   ═══════════════════════════════════════════════════════════════ */

/* ============================================================================
   GENERALIZED APPROVING AUTHORITY PORTAL & AUTHENTICATION
   ============================================================================ */

window.handleAuthoritySectionNav = function() {
  if (STATE.authorityUnlocked && STATE.currentAuthorityId) {
    showPage('authority-portal');
    return;
  }
  openAuthoritySelectionModal();
};

window.openAuthoritySelectionModal = function() {
  const active = getActiveApprovingAuthorities();
  const modal = document.getElementById('modal-authority-pass');
  if (!modal) return;

  const titleEl = document.getElementById('authority-modal-title');
  if (titleEl) titleEl.textContent = 'Approving Authority Portal';

  // Inject authority selector dropdown above password input if not present
  let selContainer = document.getElementById('auth-modal-select-container');
  if (!selContainer) {
    const passInput = document.getElementById('authority-pass-input');
    selContainer = document.createElement('div');
    selContainer.id = 'auth-modal-select-container';
    selContainer.style.marginBottom = '12px';
    selContainer.innerHTML = `
      <label style="display:block; font-size:12px; font-weight:700; color:#cbd5e1; margin-bottom:5px; text-align:left;">
        Select Approving Authority
      </label>
      <select id="modal-authority-select" class="auth-input" style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.2); color:#fff; cursor:pointer;" onchange="onAuthorityModalSelectChange()">
      </select>
    `;
    passInput.parentElement.parentElement.insertBefore(selContainer, passInput.parentElement);
  }

  const sel = document.getElementById('modal-authority-select');
  if (sel) {
    if (!active.length) {
      sel.innerHTML = '<option value="">-- No Active Authorities Found --</option>';
    } else {
      sel.innerHTML = '<option value="">-- Select Authority to Access --</option>' +
        active.map(a => `<option value="${escapeHTML(a.id)}">${escapeHTML(a.name)} (${escapeHTML(a.designation || 'Approving Authority')})</option>`).join('');
      if (STATE.currentAuthorityId && active.some(a => a.id === STATE.currentAuthorityId)) {
        sel.value = STATE.currentAuthorityId;
      }
    }
  }

  const passInput = document.getElementById('authority-pass-input');
  if (passInput) passInput.value = '';
  const err = document.getElementById('authority-pass-error');
  if (err) err.style.display = 'none';

  openModal('modal-authority-pass');
};

window.onAuthorityModalSelectChange = function() {
  const err = document.getElementById('authority-pass-error');
  if (err) err.style.display = 'none';
};

window.verifyAuthorityPassword = async function() {
  const sel = document.getElementById('modal-authority-select');
  const authId = sel ? sel.value : null;
  const pass = document.getElementById('authority-pass-input').value;
  const err = document.getElementById('authority-pass-error');

  if (!authId) {
    err.textContent = 'Please select an approving authority from the list.';
    err.style.display = 'block';
    return;
  }

  const authorities = getActiveApprovingAuthorities();
  const target = authorities.find(a => a.id === authId);
  if (!target) {
    err.textContent = 'Selected authority is not active or no longer exists.';
    err.style.display = 'block';
    return;
  }

  let isValid = false;
  // Target must have stored salt and password_hash
  if (target.password_hash && target.salt) {
    isValid = await verifyPasswordWithSalt(pass, target.password_hash, target.salt);
  }

  if (isValid) {
    STATE.authorityUnlocked = true;
    STATE.currentAuthorityId = target.id;
    STATE.currentAuthorityName = target.name;
    closeModal('modal-authority-pass');
    toast(`Authenticated as ${target.name}! ✓`, 'success');
    renderSidebar();
    showPage('authority-portal');
  } else {
    err.textContent = 'Invalid credentials for ' + target.name + '. Please try again.';
    err.style.display = 'block';
  }
};

window.lockAuthorityPortal = function() {
  STATE.authorityUnlocked = false;
  STATE.currentAuthorityId = null;
  STATE.currentAuthorityName = null;
  toast('Approving Authority portal locked.', 'info');
  renderSidebar();
  showPage('authority-dashboard');
};

function renderAuthorityPortal(activeTab = 'dashboard') {
  if (!STATE.authorityUnlocked || !STATE.currentAuthorityId) {
    handleAuthoritySectionNav();
    return;
  }

  const currentAuthId = STATE.currentAuthorityId;
  const currentAuthName = STATE.currentAuthorityName || 'Approving Authority';

  // Background sync for freshness
  syncEventsFromSupabase().then(() => {
    // re-render if still active
  });

  const allClubs = getDB('vvce_users').filter(u => u.type === 'admin');
  // Filter clubs assigned to this authority (or unassigned/legacy clubs)
  const assignedClubs = allClubs.filter(c => !c.authorityId || c.authorityId === currentAuthId);

  const allEvents = getDB('vvce_events').filter(e => e.status !== 'archived');
  // Filter events assigned to this authority (or unassigned legacy events)
  const assignedEvents = allEvents.filter(e => !e.authorityId || e.authorityId === currentAuthId);

  const pendingEvents = assignedEvents.filter(e => e.status === 'pending');
  const approvedEvents = assignedEvents.filter(e => e.status === 'approved');
  const rejectedEvents = assignedEvents.filter(e => e.status === 'rejected');
  const today = new Date().toISOString().split('T')[0];

  const pendingClubs = assignedClubs.filter(c => !c.approved);
  const approvedClubs = assignedClubs.filter(c => c.approved);

  const el = document.getElementById('page-authority-portal');
  if (!el) return;

  el.innerHTML = `
    <!-- Authenticated Authority Header -->
    <div class="dean-portal-hdr" style="background:linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%); border:1px solid rgba(199,210,254,0.3);">
      <div class="dpicon dpicon-gold" style="background:#4338ca;">🏛️</div>
      <div class="dp-info">
        <div class="dp-title" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          ${currentAuthName}
          <span class="dp-authed" style="background:rgba(34,197,94,0.2); color:#4ade80; border-color:rgba(34,197,94,0.3);">✓ AUTHORIZED</span>
        </div>
        <div class="dp-sub">Official Approving Authority Review & Decision Queue</div>
      </div>
      <button class="dp-lock-btn" onclick="lockAuthorityPortal()" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2);">🔒 Lock Portal</button>
    </div>

    <!-- Portal Navigation Tabs -->
    <div class="portal-tabs" style="gap:8px;">
      <button class="portal-tab ${activeTab==='dashboard'?'active':''}" onclick="renderAuthorityPortal('dashboard')">📊 Overview</button>
      <button class="portal-tab ${activeTab==='club-approvals'?'active':''}" onclick="renderAuthorityPortal('club-approvals')">
        👥 Club Registrations ${pendingClubs.length>0 ? `<span class="portal-tab-badge">${pendingClubs.length}</span>` : ''}
      </button>
      <button class="portal-tab ${activeTab==='event-approvals'?'active':''}" onclick="renderAuthorityPortal('event-approvals')">
        📋 Event Approvals ${pendingEvents.length>0 ? `<span class="portal-tab-badge">${pendingEvents.length}</span>` : ''}
      </button>
      <button class="portal-tab ${activeTab==='events'?'active':''}" onclick="renderAuthorityPortal('events')">📅 Event Records</button>
      <button class="portal-tab ${activeTab==='clubs'?'active':''}" onclick="renderAuthorityPortal('clubs')">🏛️ Assigned Clubs</button>
      <button class="portal-tab ${activeTab==='clash'?'active':''}" onclick="renderAuthorityPortal('clash')">⚡ Global Clash Detection</button>
    </div>

    <div id="authority-tab-content">
      ${activeTab==='dashboard' ? renderAuthorityDashboardTab(assignedClubs, assignedEvents, pendingClubs, pendingEvents, approvedEvents, today) : ''}
      ${activeTab==='club-approvals' ? renderAuthorityClubApprovalsTab(pendingClubs, approvedClubs) : ''}
      ${activeTab==='event-approvals' ? renderAuthorityEventApprovalsTab(pendingEvents) : ''}
      ${activeTab==='events' ? renderAuthorityEventRecordsTab(assignedEvents, today) : ''}
      ${activeTab==='clubs' ? renderAuthorityClubRecordsTab(assignedClubs, allEvents) : ''}
      ${activeTab==='clash' ? renderAuthorityClashTab() : ''}
    </div>
  `;
}

function renderAuthorityDashboardTab(clubs, events, pendingClubs, pendingEvents, approvedEvents, today) {
  const globalClashCount = checkClashCount();
  const upcomingEvents = approvedEvents.filter(e => e.date >= today);

  return `
    <div class="stats-row" style="margin-bottom:1.5rem;">
      ${statCard('🏛️', 'Assigned Clubs', clubs.length, `${clubs.filter(c=>c.approved).length} approved, ${pendingClubs.length} pending`, 'stat-mint')}
      ${statCard('👥', 'Club Reg Requests', pendingClubs.length, 'Needs verification', pendingClubs.length ? 'stat-amber' : 'stat-mint')}
      ${statCard('⏳', 'Pending Events', pendingEvents.length, 'Awaiting approval', pendingEvents.length ? 'stat-amber' : 'stat-mint')}
      ${statCard('📅', 'Upcoming Events', upcomingEvents.length, 'Scheduled & live', 'stat-blue')}
      ${statCard('⚡', 'Global Clashes', globalClashCount, 'Across campus', globalClashCount ? 'stat-pink' : 'stat-mint')}
    </div>

    <div class="white-card" style="margin-top:1rem;">
      <div class="sec-title" style="margin-bottom:1rem;">Quick Authority Actions</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
        <div class="auth-qa-card" onclick="renderAuthorityPortal('club-approvals')">
          <span class="auth-qa-icon">👥</span>
          <div class="auth-qa-label">Review Club Registrations</div>
          ${pendingClubs.length ? `<div style="font-size:11px;color:#b45309;font-weight:600;">${pendingClubs.length} pending approval</div>` : '<div style="font-size:11px;color:#10b981;">Up to date</div>'}
        </div>
        <div class="auth-qa-card" onclick="renderAuthorityPortal('event-approvals')">
          <span class="auth-qa-icon">📋</span>
          <div class="auth-qa-label">Approve Event Proposals</div>
          ${pendingEvents.length ? `<div style="font-size:11px;color:#b45309;font-weight:600;">${pendingEvents.length} events pending</div>` : '<div style="font-size:11px;color:#10b981;">No pending proposals</div>'}
        </div>
        <div class="auth-qa-card" onclick="renderAuthorityPortal('clash')">
          <span class="auth-qa-icon">⚡</span>
          <div class="auth-qa-label">Global Clash Detection</div>
          <div style="font-size:11px;color:#64748b;">Cross-department verification</div>
        </div>
        <div class="auth-qa-card" onclick="renderAuthorityPortal('clubs')">
          <span class="auth-qa-icon">🏛️</span>
          <div class="auth-qa-label">Track Club Activities</div>
          <div style="font-size:11px;color:#64748b;">${clubs.length} assigned clubs</div>
        </div>
      </div>
    </div>
  `;
}

function renderAuthorityClubApprovalsTab(pending, approved) {
  return `
    <div class="sec-head">
      <span class="sec-title">Pending Club Registrations (${pending.length})</span>
    </div>
    ${pending.length ? pending.map(c => `
      <div class="white-card" style="margin-bottom:12px; border-left:4px solid #f59e0b;">
        <div class="cpcard-head">
          <div>
            <div class="cpcard-name" style="font-size:18px;">${escapeHTML(c.clubName || c.name)}</div>
            <div class="cpcard-domain">${escapeHTML(c.domain || 'General')} • ${escapeHTML(c.branch || 'VVCE')} • ${escapeHTML(c.email)}</div>
          </div>
          <span class="badge badge-amber">Pending Registration</span>
        </div>
        <div class="cpcard-info" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:8px; font-size:13px; color:#374151; margin:12px 0;">
          <span>👤 <strong>Lead Rep:</strong> ${escapeHTML(titleCase(c.name))} (${escapeHTML(c.usn || '-')})</span>
          <span>👩‍🏫 <strong>Faculty Coord:</strong> ${escapeHTML(c.faculty || '-')}</span>
          <span>📧 <strong>Club Email:</strong> ${escapeHTML(c.clubEmail || '-')}</span>
          <span>📞 <strong>Contact Phone:</strong> ${escapeHTML(c.phone || '-')}</span>
        </div>
        ${c.desc ? `<div style="font-size:13px; color:#334155; background:#f8fafc; padding:10px 14px; border-radius:8px; margin-bottom:12px; border:1px solid #e2e8f0;">${escapeHTML(c.desc)}</div>` : ''}
        
        <!-- Decision Actions -->
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <button class="btn btn-green" onclick="authorityApproveClub('${escapeHTML(c.id)}')">✓ Approve Club Registration</button>
          <button class="btn btn-red" onclick="authorityRejectClubPrompt('${escapeHTML(c.id)}')">✕ Reject with Reason</button>
          <button class="btn btn-outline" onclick="viewClubDetail('${escapeHTML(c.id)}')">View Full Dossier</button>
        </div>
      </div>
    `).join('') : `
      <div class="empty-state" style="padding:40px 20px;">
        <div class="ei">✓</div>
        <div class="et">No Pending Club Registrations</div>
        <div class="es">All club registration requests for this authority have been processed.</div>
      </div>
    `}

    ${approved.length ? `
      <div style="margin-top:2rem;">
        <div class="sec-title" style="margin-bottom:12px;">Active Approved Clubs (${approved.length})</div>
        ${approved.map(c => `
          <div class="ev-row" style="margin-bottom:8px;">
            <span class="ev-row-emoji">🏛️</span>
            <div class="ev-row-info">
              <div class="ev-row-name">${escapeHTML(c.clubName || c.name)}</div>
              <div class="ev-row-meta">${escapeHTML(c.domain || 'General')} • Rep: ${escapeHTML(titleCase(c.name))} • Coord: ${escapeHTML(c.faculty || '-')}</div>
            </div>
            <span class="badge badge-green">Active</span>
            <button class="btn btn-outline btn-sm" onclick="viewClubDetail('${escapeHTML(c.id)}')">Dossier</button>
            <button class="btn btn-red btn-sm" onclick="authorityRevokeClub('${escapeHTML(c.id)}')">Revoke Access</button>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

function renderAuthorityEventApprovalsTab(pending) {
  const allActiveEvents = getDB('vvce_events').filter(e => e.status === 'approved' || e.status === 'pending');

  return `
    <div class="sec-head">
      <span class="sec-title">Event Proposals Awaiting Your Approval (${pending.length})</span>
    </div>
    ${pending.length ? pending.map(e => {
      // Check for overlapping venue time-slot clash against approved events
      const conflict = allActiveEvents.find(other =>
        doEventSlotsOverlap(e, other, { allowedStatuses: ['approved'] })
      );

      return `
        <div class="white-card" style="margin-bottom:14px; border: ${conflict ? '2px solid #ef4444' : '1px solid #e2e8f0'}; background:${conflict ? '#fff5f5' : '#fff'};">
          ${conflict ? `
            <div style="background:#fee2e2; border:1px solid #fca5a5; color:#991b1b; padding:10px 14px; border-radius:8px; margin-bottom:12px; font-size:12.5px; font-weight:700; display:flex; align-items:center; gap:8px;">
              <span style="font-size:18px;">⚠️</span>
              <div>
                GLOBAL VENUE CLASH WARNING: Conflicting approved event "${escapeHTML(conflict.name)}" (${escapeHTML(conflict.club)}) is already booked at ${escapeHTML(e.venue)} on ${escapeHTML(formatDate(e.date))} (${escapeHTML(formatEventTimeSlot(conflict))}). Approval is blocked.
              </div>
            </div>
          ` : ''}

          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
            <div style="display:flex; gap:14px; align-items:flex-start;">
              <span style="font-size:40px;">${escapeHTML(e.emoji || '🎓')}</span>
              <div>
                <div style="font-weight:800; font-size:18px; color:#0f172a;">${escapeHTML(e.name)}</div>
                <div style="font-size:13px; color:#64748b; margin-top:2px;">Organized by <strong>${escapeHTML(e.club)}</strong></div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:6px 16px; margin-top:10px; font-size:12.5px; color:#334155;">
                  <span>📅 <strong>Date:</strong> ${escapeHTML(formatDate(e.date))}</span>
                  <span>🕐 <strong>Time:</strong> ${escapeHTML(formatTime(e.time))}</span>
                  <span>📍 <strong>Venue:</strong> ${escapeHTML(e.venue)}</span>
                  <span>👥 <strong>Max Part:</strong> ${escapeHTML(e.maxParticipants)}</span>
                  <span>💰 <strong>Fee:</strong> ${e.fee > 0 ? '₹' + escapeHTML(e.fee) : 'Free'}</span>
                </div>
                ${e.desc ? `<div style="font-size:13px; color:#475569; margin-top:10px; line-height:1.5; background:#f8fafc; padding:10px 12px; border-radius:8px;">${escapeHTML(e.desc)}</div>` : ''}
              </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end; flex-shrink:0;">
              ${conflict ? `
                <button class="btn" style="background:#cbd5e1; color:#64748b; cursor:not-allowed;" title="Resolve venue conflict before approving" disabled>
                  ⚠️ Clash Blocked
                </button>
              ` : `
                <button class="btn btn-green" onclick="authorityApproveEvent('${e.id}')">
                  ✓ Approve Event
                </button>
              `}
              <button class="btn btn-red" onclick="authorityRejectEventPrompt('${e.id}')">
                ✕ Reject with Reason
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('') : `
      <div class="empty-state" style="padding:40px 20px;">
        <div class="ei">✓</div>
        <div class="et">All Caught Up!</div>
        <div class="es">No event proposals pending review for this authority.</div>
      </div>
    `}
  `;
}

function renderAuthorityEventRecordsTab(events, today) {
  const sorted = events.slice().sort((a,b) => (b.date || '').localeCompare(a.date || ''));

  return `
    <div class="filter-row" style="margin-bottom:1rem;">
      <input class="search-inp" id="auth-ev-search" placeholder="🔍 Search event records by name or club..." oninput="authorityFilterEventRecords()">
      <select class="filter-sel" id="auth-ev-status" onchange="authorityFilterEventRecords()">
        <option value="">All Statuses</option>
        <option value="approved">Approved</option>
        <option value="pending">Pending</option>
        <option value="rejected">Rejected</option>
      </select>
    </div>
    <div id="auth-ev-records-list">
      ${renderAuthorityEventRows(sorted)}
    </div>
  `;
}

function renderAuthorityEventRows(evList) {
  if (!evList.length) return '<div class="empty-state"><div class="ei">📅</div><div class="et">No events found</div></div>';

  return evList.map(e => `
    <div class="ev-row" style="margin-bottom:8px;">
      <span class="ev-row-emoji">${escapeHTML(e.emoji || '🎓')}</span>
      <div class="ev-row-info">
        <div class="ev-row-name" style="font-weight:700;">${escapeHTML(e.name)}</div>
        <div class="ev-row-meta">${escapeHTML(e.club)} • ${escapeHTML(formatDate(e.date))} • 📍 ${escapeHTML(e.venue)}</div>
        ${e.rejReason ? `<div style="font-size:11px; color:#dc2626; margin-top:2px;">Rejection Note: ${escapeHTML(e.rejReason)}</div>` : ''}
      </div>
      <span class="badge ${e.status==='approved'?'badge-green':e.status==='pending'?'badge-amber':'badge-red'}">
        ${escapeHTML(e.status.toUpperCase())}
      </span>
      ${e.status==='pending' ? `
        <button class="btn btn-green btn-sm" onclick="authorityApproveEvent('${escapeHTML(e.id)}')">Approve</button>
        <button class="btn btn-red btn-sm" onclick="authorityRejectEventPrompt('${escapeHTML(e.id)}')">Reject</button>
      ` : ''}
    </div>
  `).join('');
}

function authorityFilterEventRecords() {
  const q = (document.getElementById('auth-ev-search')?.value || '').toLowerCase();
  const status = document.getElementById('auth-ev-status')?.value || '';
  const currentAuthId = STATE.currentAuthorityId;
  let evs = getDB('vvce_events').filter(e => !e.authorityId || e.authorityId === currentAuthId);

  if (q) evs = evs.filter(e => e.name.toLowerCase().includes(q) || (e.club && e.club.toLowerCase().includes(q)));
  if (status) evs = evs.filter(e => e.status === status);

  const container = document.getElementById('auth-ev-records-list');
  if (container) container.innerHTML = renderAuthorityEventRows(evs);
}

function renderAuthorityClubRecordsTab(clubs, allEvents) {
  return `
    <div class="sec-head">
      <span class="sec-title">Clubs Assigned to This Authority (${clubs.length})</span>
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:14px;">
      ${clubs.map(c => {
        const clubEvents = allEvents.filter(e => e.adminId === c.id || e.club === c.clubName);
        const appCount = clubEvents.filter(e => e.status === 'approved').length;
        const pendCount = clubEvents.filter(e => e.status === 'pending').length;
        const rejCount = clubEvents.filter(e => e.status === 'rejected').length;

        return `
          <div class="white-card" style="box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
              <div>
                <h4 style="font-size:16px; font-weight:800; margin:0; color:#0f172a;">${escapeHTML(c.clubName || c.name)}</h4>
                <div style="font-size:12px; color:#64748b;">${escapeHTML(c.domain || 'Technical')} • Coord: ${escapeHTML(c.faculty || '-')}</div>
              </div>
              <span class="badge ${c.approved ? 'badge-green' : 'badge-amber'}">${c.approved ? 'Approved' : 'Pending'}</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; background:#f8fafc; padding:8px 10px; border-radius:8px; margin:10px 0; text-align:center; font-size:11px;">
              <div><strong style="color:#10b981; font-size:14px;">${appCount}</strong><br>Approved</div>
              <div><strong style="color:#f59e0b; font-size:14px;">${pendCount}</strong><br>Pending</div>
              <div><strong style="color:#ef4444; font-size:14px;">${rejCount}</strong><br>Rejected</div>
            </div>
            <div style="font-size:12px; color:#475569; margin-bottom:10px;">
              <div>👤 <strong>Representative:</strong> ${escapeHTML(titleCase(c.name))} (${escapeHTML(c.usn || '-')})</div>
              <div>📧 <strong>Contact:</strong> ${escapeHTML(c.clubEmail || c.email)}</div>
            </div>
            <button class="btn btn-outline btn-sm" style="width:100%;" onclick="viewClubDetail('${escapeHTML(c.id)}')">View Club Details & History</button>
          </div>
        `;
      }).join('') || '<div class="empty-state"><div class="ei">🏛️</div><div class="et">No assigned clubs</div></div>'}
    </div>
  `;
}

function renderAuthorityClashTab() {
  const events = getDB('vvce_events');
  return deanClashContent(events);
}

// -----------------------------------------------------------------------------
// Authority Approval & Rejection Handlers with Global Clash Enforcement
// -----------------------------------------------------------------------------
window.authorityApproveEvent = async function(id) {
  if (!STATE.authorityUnlocked || !STATE.currentAuthorityId) {
    toast('⚠️ You must authenticate as an Approving Authority first.', 'error');
    return;
  }

  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === id);
  if (!ev) {
    toast('Event not found.', 'error');
    return;
  }

  // 1. Client-Side Global Time-Slot Clash Verification across ALL clubs/departments
  const allEvents = events.filter(e => e.status === 'approved' && e.id !== id);
  const clash = allEvents.find(other =>
    doEventSlotsOverlap(ev, other, { allowedStatuses: ['approved'] })
  );

  if (clash) {
    toast(`⚠️ Cannot approve! Global clash detected with approved event "${clash.name}" (${clash.club}) at ${ev.venue} on ${formatDate(ev.date)} (${formatEventTimeSlot(clash)}).`, 'error', 6000);
    return;
  }

  const currentAuthId = STATE.currentAuthorityId;
  const currentAuthName = STATE.currentAuthorityName || 'Approving Authority';

  // 2. Server/Database Atomic Concurrency Check (via RPC if configured in Supabase)
  const sb = getSupabaseClient();
  let serverHandled = false;

  if (sb) {
    try {
      const { data, error } = await sb.rpc('approve_event_with_clash_check', {
        p_event_id: id,
        p_authority_id: currentAuthId,
        p_authority_name: currentAuthName
      });

      if (!error && data) {
        if (!data.success) {
          toast(`⚠️ Approval Rejected by Server: ${data.error}`, 'error', 6000);
          return;
        }
        serverHandled = true;
      }
    } catch (rpcErr) {
      console.warn('RPC approve_event_with_clash_check fallback to direct update:', rpcErr);
    }
  }

  // Local state update & audit history
  const decisionEntry = {
    action: 'approved',
    authorityId: currentAuthId,
    authorityName: currentAuthName,
    timestamp: new Date().toISOString()
  };

  ev.status = 'approved';
  ev.rejReason = null;
  ev.approvedByAuthorityId = currentAuthId;
  ev.approvedByAuthorityName = currentAuthName;
  ev.approvedAt = new Date().toISOString();
  if (!ev.decisionHistory) ev.decisionHistory = [];
  ev.decisionHistory.push(decisionEntry);

  await setDB('vvce_events', events);

  if (!serverHandled && sb) {
    try {
      await sb.from('events').update({
        status: 'approved',
        rej_reason: null,
        approved_by_authority_id: currentAuthId,
        approved_by_authority_name: currentAuthName,
        approved_at: new Date().toISOString(),
        decision_history: ev.decisionHistory
      }).eq('id', id);
    } catch(e) {
      console.warn('Supabase direct update:', e);
    }
  }

  // Notify Club Admin
  const users = getDB('vvce_users');
  const admin = users.find(u => u.id === ev.adminId);
  if (admin) {
    if (!admin.notifs) admin.notifs = [];
    admin.notifs.push({
      id: genId('n'),
      msg: `Your event proposal "${ev.name}" was APPROVED by ${currentAuthName}! 🎉`,
      icon: '✓',
      time: 'Just now',
      timestamp: Date.now(),
      read: false
    });
    setDB('vvce_users', users);
  }

  toast(`Event "${ev.name}" approved successfully by ${currentAuthName}! ✓`, 'success');
  renderAuthorityPortal('event-approvals');
};

window.authorityRejectEventPrompt = async function(id) {
  const reason = prompt('Please enter a rejection reason (optional):');
  if (reason === null) return; // user cancelled prompt

  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === id);
  if (!ev) return;

  const currentAuthId = STATE.currentAuthorityId;
  const currentAuthName = STATE.currentAuthorityName || 'Approving Authority';

  const decisionEntry = {
    action: 'rejected',
    reason: reason.trim() || 'Not specified',
    authorityId: currentAuthId,
    authorityName: currentAuthName,
    timestamp: new Date().toISOString()
  };

  ev.status = 'rejected';
  ev.rejReason = reason.trim() || 'Rejected by Approving Authority';
  if (!ev.decisionHistory) ev.decisionHistory = [];
  ev.decisionHistory.push(decisionEntry);

  await setDB('vvce_events', events);

  const sb = getSupabaseClient();
  if (sb) {
    try {
      await sb.from('events').update({
        status: 'rejected',
        rej_reason: ev.rejReason,
        decision_history: ev.decisionHistory
      }).eq('id', id);
    } catch(e) {}
  }

  // Notify Club Admin
  const users = getDB('vvce_users');
  const admin = users.find(u => u.id === ev.adminId);
  if (admin) {
    if (!admin.notifs) admin.notifs = [];
    admin.notifs.push({
      id: genId('n'),
      msg: `Your event proposal "${ev.name}" was REJECTED by ${currentAuthName}. Reason: ${ev.rejReason}`,
      icon: '✕',
      time: 'Just now',
      timestamp: Date.now(),
      read: false
    });
    setDB('vvce_users', users);
  }

  toast(`Event proposal rejected.`, 'warning');
  renderAuthorityPortal('event-approvals');
};

window.authorityApproveClub = async function(id) {
  const users = getDB('vvce_users');
  const club = users.find(u => u.id === id);
  if (!club) return;

  const currentAuthId = STATE.currentAuthorityId;
  const currentAuthName = STATE.currentAuthorityName || 'Approving Authority';

  club.approved = true;
  if (!club.approvalHistory) club.approvalHistory = [];
  club.approvalHistory.push({
    action: 'approved',
    authorityId: currentAuthId,
    authorityName: currentAuthName,
    timestamp: new Date().toISOString()
  });

  if (typeof updateSingleUserRow === 'function') {
    await updateSingleUserRow(club.id, { approved: true, approvalHistory: club.approvalHistory });
  } else {
    await setDB('vvce_users', users);
  }

  if (club.id === STATE.user.id) STATE.user = club;
  toast(`Club "${club.clubName || club.name}" approved successfully! ✓`, 'success');
  renderAuthorityPortal('club-approvals');
};

window.authorityRejectClubPrompt = async function(id) {
  const reason = prompt('Please enter the reason for rejecting this club registration:');
  if (reason === null) return;

  const users = getDB('vvce_users');
  const club = users.find(u => u.id === id);
  if (!club) return;

  const currentAuthId = STATE.currentAuthorityId;
  const currentAuthName = STATE.currentAuthorityName || 'Approving Authority';

  club.approved = false;
  club.rejectionReason = reason.trim() || 'Registration rejected by Approving Authority';
  if (!club.approvalHistory) club.approvalHistory = [];
  club.approvalHistory.push({
    action: 'rejected',
    reason: club.rejectionReason,
    authorityId: currentAuthId,
    authorityName: currentAuthName,
    timestamp: new Date().toISOString()
  });

  if (typeof updateSingleUserRow === 'function') {
    await updateSingleUserRow(club.id, { approved: false, rejectionReason: club.rejectionReason, approvalHistory: club.approvalHistory });
  } else {
    await setDB('vvce_users', users);
  }
  toast('Club registration rejected.', 'warning');
  renderAuthorityPortal('club-approvals');
};

window.authorityRevokeClub = async function(id) {
  if (!confirm('Are you sure you want to revoke this club\'s active status?')) return;
  const users = getDB('vvce_users');
  const club = users.find(u => u.id === id);
  if (!club) return;

  club.approved = false;
  if (typeof updateSingleUserRow === 'function') {
    await updateSingleUserRow(club.id, { approved: false });
  } else {
    await setDB('vvce_users', users);
  }
  toast('Club access revoked.', 'warning');
  renderAuthorityPortal('club-approvals');
};


/* ─── Module: js/pages/authority-views.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Authority Dashboard & Monitor Views (Dean / Principal)
   Path: js/pages/authority-views.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   AUTHORITY DASHBOARD
───────────────────────────────────────────────────────────────*/
function renderAuthorityDashboard() {
  const events = getDB('vvce_events');
  const clubs  = getDB('vvce_users').filter(u=>u.type==='admin');
  const approved = events.filter(e=>e.status==='approved');
  const el = document.getElementById('page-authority-dashboard');

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
  `;
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
  const canAct  = Boolean(STATE.authorityUnlocked && STATE.currentAuthorityId);

  el.innerHTML=`
    <div class="sec-head">
      <span class="sec-title">Event Approvals (${pending.length} pending)</span>
    </div>
    ${!canAct ? `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;font-size:13px;color:#1e40af;">
        <span style="font-size:22px;">ℹ️</span>
        <div><strong>Authority Portal Locked:</strong> Unlock the <strong>Approving Authority Portal</strong> to approve or reject club events. This view is read-only until unlocked.</div>
      </div>
    ` : ''}
    ${pending.length
      ? pending.map(e=>`
        <div class="white-card" style="margin-bottom:10px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
            <div style="display:flex;gap:12px;align-items:flex-start;">
              <span style="font-size:36px;">${escapeHTML(e.emoji||'🎓')}</span>
              <div>
                <div style="font-weight:800;font-size:16px;color:#111827;">${escapeHTML(e.name)}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:3px;">${escapeHTML(e.club)}</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:8px;font-size:12px;color:#374151;">
                  <span>📅 ${escapeHTML(formatDate(e.date))}</span>
                  <span>🕐 ${escapeHTML(formatTime(e.time))}</span>
                  <span>📍 ${escapeHTML(e.venue)}</span>
                  <span>👥 Max: ${escapeHTML(e.maxParticipants)}</span>
                  <span>💰 ${e.fee>0?`₹${escapeHTML(e.fee)}`:'Free'}</span>
                </div>
                ${e.desc?`<div style="font-size:12px;color:#374151;margin-top:8px;line-height:1.5;max-width:500px;">${escapeHTML(e.desc)}</div>`:''}
              </div>
            </div>
            ${canAct ? `
              <div style="display:flex;gap:8px;flex-shrink:0;">
                <button class="btn btn-green" onclick="authorityApproveEvent('${escapeHTML(e.id)}')">✓ Approve</button>
                <button class="btn btn-red" onclick="authorityRejectEventPrompt('${escapeHTML(e.id)}')">✕ Reject</button>
              </div>
            ` : `
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
                <span class="badge badge-amber">⏳ Pending Authority Review</span>
                <span style="font-size:11px;color:#64748b;font-weight:600;">Unlock Authority Portal to act</span>
              </div>
            `}
          </div>
        </div>`).join('')
      : `<div class="empty-state"><div class="ei">✅</div><div class="et">All caught up!</div><div class="es">No events pending approval.</div></div>`
    }

    <!-- Recently processed -->
    <div style="margin-top:1.5rem;">
      <div class="sec-title" style="margin-bottom:10px;">Recently Processed</div>
      ${events.filter(e=>e.status==='approved'||e.status==='rejected').slice(0,5).map(e=>`
        <div class="ev-row">
          <span class="ev-row-emoji">${escapeHTML(e.emoji||'🎓')}</span>
          <div class="ev-row-info"><div class="ev-row-name">${escapeHTML(e.name)}</div><div class="ev-row-meta">${escapeHTML(e.club)} • ${escapeHTML(formatDate(e.date))}</div></div>
          <span class="badge ${e.status==='approved'?'badge-green':'badge-red'}">${escapeHTML(e.status)}</span>
        </div>`).join('') || `<p style="color:#9ca3af;font-size:13px;">None yet.</p>`}
    </div>
  `;
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
          <div class="cpcard-name">${escapeHTML(c.clubName||c.name)}</div>
          <div class="cpcard-domain">${escapeHTML(c.domain||'—')} • ${escapeHTML(c.dept||'—')}</div>
        </div>
        ${statusBadge}
      </div>
      <div class="cpcard-info">
        <span>👤 Rep: ${escapeHTML(titleCase(c.name))}</span>
        <span>👩‍🏫 Faculty: ${escapeHTML(c.faculty||'—')}</span>
        <span>📧 ${escapeHTML(c.clubEmail||c.email)}</span>
        <span>📞 ${escapeHTML(c.phone||'—')}</span>
      </div>
      <div class="cpcard-acts">
        <button class="btn btn-outline" onclick="viewClubDetail('${escapeHTML(c.id)}')">View Details</button>
      </div>
    </div>`;
  }).join('');
}

async function approveClub(id) {
  const users=getDB('vvce_users'); const club=users.find(u=>u.id===id);
  if(!club) return;
  club.approved=true;
  if (typeof updateSingleUserRow === 'function') await updateSingleUserRow(id, { approved: true });
  else setDB('vvce_users',users);
  if(club.id===STATE.user.id) STATE.user=club;
  toast(`${club.clubName} approved! ✅`,'success');
  renderClubMonitor();
}
async function revokeClub(id) {
  if(!confirm("Revoke this club's access?")) return;
  const users=getDB('vvce_users'); const club=users.find(u=>u.id===id);
  if(!club) return;
  club.approved=false;
  if (typeof updateSingleUserRow === 'function') await updateSingleUserRow(id, { approved: false });
  else setDB('vvce_users',users);
  toast('Club access revoked.','warning'); renderClubMonitor();
}
function viewClubDetail(id) {
  const club=getDB('vvce_users').find(u=>u.id===id); if(!club) return;
  const evs = getDB('vvce_events').filter(e=>e.adminId===id);
  document.getElementById('modal-club-body').innerHTML=`
    <div style="margin-bottom:1rem;">
      <div style="font-size:20px;font-weight:900;color:#111827;margin-bottom:4px;">${escapeHTML(club.clubName)}</div>
      <span class="badge ${club.approved?'badge-green':'badge-amber'}">${club.approved?'Active':'Pending'}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;margin-bottom:1rem;">
      <div><strong>Representative:</strong> ${escapeHTML(titleCase(club.name))}</div>
      <div><strong>Faculty:</strong> ${escapeHTML(club.faculty||'—')}</div>
      <div><strong>Domain:</strong> ${escapeHTML(club.domain||'—')}</div>
      <div><strong>Phone:</strong> ${escapeHTML(club.phone||'—')}</div>
      <div><strong>Club Email:</strong> ${escapeHTML(club.clubEmail||'—')}</div>
      <div><strong>Rep Email:</strong> ${escapeHTML(club.email)}</div>
    </div>
    ${club.desc?`<div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:1rem;font-size:13px;color:#374151;">${escapeHTML(club.desc)}</div>`:''}
    <div><strong style="font-size:13px;">Events (${evs.length})</strong></div>
    ${evs.slice(0,5).map(e=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
      <span>${escapeHTML(e.emoji||'🎓')}</span>
      <span style="flex:1;">${escapeHTML(e.name)}</span>
      <span class="badge ${e.status==='approved'?'badge-green':e.status==='pending'?'badge-amber':'badge-red'}">${escapeHTML(e.status)}</span>
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
  const clashingMap = new Map();
  for(let i=0;i<events.length;i++) {
    for(let j=i+1;j<events.length;j++) {
      const a = events[i], b = events[j];
      if(doEventSlotsOverlap(a, b)) {
        clashes.push([a, b]);
        if (!clashingMap.has(a.id)) clashingMap.set(a.id, []);
        if (!clashingMap.has(b.id)) clashingMap.set(b.id, []);
        clashingMap.get(a.id).push(b.name);
        clashingMap.get(b.id).push(a.name);
      }
    }
  }

  window.runClashFilter = () => renderClashDetect();

  const el = document.getElementById('page-authority-clash');
  el.innerHTML=`
    <div class="sec-head">
      <span class="sec-title">Venue Clash Detection</span>
      <span class="badge ${clashes.length?'badge-red':'badge-green'}">${clashes.length} ${clashes.length === 1 ? 'clash' : 'clashes'} found</span>
    </div>
    
    <div style="background:rgba(255,255,255,0.85);padding:1rem;border-radius:12px;margin-bottom:1rem;display:flex;align-items:center;gap:10px;border:1px solid #e2e8f0;flex-wrap:wrap;">
      <label style="font-weight:700;font-size:13px;color:#334155;">Check specific date:</label>
      <input type="date" id="clash-date-filter" class="auth-input" style="max-width:200px;margin-bottom:0;" value="${dateVal}" onchange="runClashFilter()">
      <button class="btn-sm btn-outline" onclick="document.getElementById('clash-date-filter').value='';runClashFilter()">Show All Dates</button>
    </div>
    ${clashes.length
      ? clashes.map(([a,b])=>`
        <div class="clash-chip clash-error" style="border: 1.5px solid #ef4444; background: #fef2f2; box-shadow: 0 4px 12px rgba(239,68,68,0.12); margin-bottom: 12px; border-radius: 12px; padding: 14px;">
          <div style="font-weight:800;font-size:13.5px;color:#b91c1c;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <span>⚠️ VENUE CLASH DETECTED</span>
            <span style="font-size:12px;color:#7f1d1d;font-weight:600;">(Same date & venue)</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12.5px;">
            <div style="background:#ffffff;border:1px solid #fca5a5;padding:10px;border-radius:8px;">
              <div style="font-weight:800;color:#0f172a;">${escapeHTML(a.name)}</div>
              <div style="color:#64748b;margin-top:2px;">🏛️ ${escapeHTML(a.club)} • ⏰ ${escapeHTML(formatEventTimeSlot(a))}</div>
              <div style="margin-top:4px;"><span class="badge ${a.status==='approved'?'badge-green':'badge-amber'}">${escapeHTML(a.status.toUpperCase())}</span></div>
            </div>
            <div style="background:#ffffff;border:1px solid #fca5a5;padding:10px;border-radius:8px;">
              <div style="font-weight:800;color:#0f172a;">${escapeHTML(b.name)}</div>
              <div style="color:#64748b;margin-top:2px;">🏛️ ${escapeHTML(b.club)} • ⏰ ${escapeHTML(formatEventTimeSlot(b))}</div>
              <div style="margin-top:4px;"><span class="badge ${b.status==='approved'?'badge-green':'badge-amber'}">${escapeHTML(b.status.toUpperCase())}</span></div>
            </div>
          </div>
          <div style="font-size:12px;font-weight:700;color:#991b1b;margin-top:8px;">📍 Venue: ${escapeHTML(a.venue)} &bull; 📅 Date: ${escapeHTML(formatDate(a.date))}</div>
        </div>`).join('')
      : `<div class="clash-chip clash-ok" style="border:1.5px solid #86efac;background:#f0fdf4;border-radius:12px;padding:14px;"><div style="font-weight:700;color:#15803d;">✓ No venue clashes detected!</div><div style="font-size:12px;color:#059669;margin-top:4px;">All events have distinct dates or separate venues.</div></div>`
    }

    <!-- All events table with highlighted red mark for clashes -->
    <div style="margin-top:1.5rem;">
      <div class="sec-head">
        <span class="sec-title">All Scheduled Events</span>
        <span style="font-size:12px; color:#64748b;">(Events with conflicts highlighted in red)</span>
      </div>
      <div class="table-wrap" style="border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; background:#fff;">
        <table class="data-table">
          <thead><tr><th>Event</th><th>Club</th><th>Date</th><th>Time</th><th>Venue</th><th>Status</th></tr></thead>
          <tbody>
            ${events.sort((a,b)=>a.date.localeCompare(b.date)).map(e=>{
              const hasClash = clashingMap.has(e.id);
              const otherNames = hasClash ? clashingMap.get(e.id).join(', ') : '';
              return `
                <tr style="${hasClash ? 'background:#fee2e2 !important; border-left:5px solid #dc2626;' : ''}">
                  <td class="td-name">
                    <div style="display:flex; align-items:center; gap:6px;">
                      ${hasClash ? '<span style="color:#dc2626; font-size:16px;">⚠️</span>' : ''}
                      <span style="${hasClash ? 'color:#991b1b; font-weight:800;' : ''}">${escapeHTML(e.name)}</span>
                    </div>
                    ${hasClash ? `<div style="font-size:11px; font-weight:700; color:#b91c1c; margin-top:2px;">⚡ Clashes with: "${escapeHTML(otherNames)}"</div>` : ''}
                  </td>
                  <td>${escapeHTML(e.club)}</td>
                  <td style="${hasClash ? 'color:#991b1b; font-weight:700;' : ''}">${escapeHTML(formatDate(e.date))}</td>
                  <td>${escapeHTML(formatTime(e.time))}</td>
                  <td style="${hasClash ? 'color:#991b1b; font-weight:700;' : ''}">📍 ${escapeHTML(e.venue)}</td>
                  <td>
                    ${hasClash
                      ? `<span class="badge" style="background:#fecaca; color:#991b1b; border:1px solid #ef4444; font-weight:800;">⚠️ CLASH</span>`
                      : `<span class="badge ${e.status==='approved'?'badge-green':'badge-amber'}">${escapeHTML(e.status)}</span>`
                    }
                  </td>
                </tr>
              `;
            }).join('')}
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
              return `<tr><td style="font-weight:600;">${escapeHTML(u.name)}</td><td>${escapeHTML(u.usn||'N/A')}</td><td>${escapeHTML(u.branch||'N/A')}</td><td>${badge}</td></tr>`;
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
              <td class="td-name">${escapeHTML(e.name)}</td>
              <td>${escapeHTML(e.club)}</td>
              <td>${escapeHTML(formatDate(e.date))}</td>
              <td>${escapeHTML(e.venue)}</td>
              <td style="cursor:pointer; color:#2563eb; text-decoration:underline;" onclick="showAuthStudents('${escapeHTML(e.id)}')" title="View Registered Students"><strong>${e.regCount||0}</strong></td>
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
   SHARED CLASH DETECTION CONTENT (Used by Authority Portal Tab 6)
───────────────────────────────────────────────────────────────*/
function deanClashContent(events) {
  const dateVal = document.getElementById('dean-clash-date-filter')?.value || '';
  let activeEvents = events.filter(e=>e.status==='approved'||e.status==='pending');
  if (dateVal) activeEvents = activeEvents.filter(e=>e.date===dateVal);

  const clashes=[];
  const clashingMap = new Map();
  for(let i=0;i<activeEvents.length;i++) {
    for(let j=i+1;j<activeEvents.length;j++) {
      const a = activeEvents[i], b = activeEvents[j];
      if(doEventSlotsOverlap(a, b)) {
        clashes.push([a, b]);
        if (!clashingMap.has(a.id)) clashingMap.set(a.id, []);
        if (!clashingMap.has(b.id)) clashingMap.set(b.id, []);
        clashingMap.get(a.id).push(b.name);
        clashingMap.get(b.id).push(a.name);
      }
    }
  }

  window.runDeanClashFilter = () => renderAuthorityPortal('clash');

  return `
    <div class="sec-head"><span class="sec-title">Venue Clash Detection</span><span class="badge ${clashes.length?'badge-red':'badge-green'}">${clashes.length} ${clashes.length === 1 ? 'clash' : 'clashes'}</span></div>
    
    <div style="background:rgba(255,255,255,0.8);padding:1rem;border-radius:10px;margin-bottom:1rem;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <label style="font-weight:700;font-size:13px;">Check specific date:</label>
      <input type="date" id="dean-clash-date-filter" class="auth-input" style="max-width:200px;margin-bottom:0;" value="${dateVal}" onchange="runDeanClashFilter()">
      <button class="btn-sm btn-outline" onclick="document.getElementById('dean-clash-date-filter').value='';runDeanClashFilter()">Show All Dates</button>
    </div>

    ${clashes.length
      ? clashes.map(([a,b])=>`
        <div class="clash-chip clash-error" style="border: 1.5px solid #ef4444; background: #fef2f2; box-shadow: 0 4px 12px rgba(239,68,68,0.12); margin-bottom: 12px; border-radius: 12px; padding: 14px;">
          <div style="font-weight:800;font-size:13.5px;color:#b91c1c;margin-bottom:8px;">⚡ Conflict at ${escapeHTML(a.venue)} on ${escapeHTML(formatDate(a.date))}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
            <div style="background:rgba(255,255,255,0.85);padding:10px;border-radius:8px;border:1px solid #fca5a5;">
              <strong style="color:#0f172a;">${escapeHTML(a.name)}</strong><br>
              <span style="color:#64748b;">${escapeHTML(a.club)} • ${escapeHTML(formatEventTimeSlot(a))}</span>
              <div style="margin-top:4px;"><span class="badge ${a.status==='approved'?'badge-green':'badge-amber'}">${escapeHTML(a.status.toUpperCase())}</span></div>
            </div>
            <div style="background:rgba(255,255,255,0.85);padding:10px;border-radius:8px;border:1px solid #fca5a5;">
              <strong style="color:#0f172a;">${escapeHTML(b.name)}</strong><br>
              <span style="color:#64748b;">${escapeHTML(b.club)} • ${escapeHTML(formatEventTimeSlot(b))}</span>
              <div style="margin-top:4px;"><span class="badge ${b.status==='approved'?'badge-green':'badge-amber'}">${escapeHTML(b.status.toUpperCase())}</span></div>
            </div>
          </div>
        </div>`).join('')
      : `<div class="clash-chip clash-ok" style="border:1.5px solid #86efac;background:#f0fdf4;border-radius:12px;padding:14px;"><strong style="color:#15803d;">✅ No venue clashes detected!</strong><br><span style="font-size:12px;color:#059669;">All scheduled events have unique time-venue combinations.</span></div>`
    }

    <!-- All events table with red clash highlight -->
    <div style="margin-top:1.5rem;">
      <div class="sec-head">
        <span class="sec-title">Scheduled Events Monitor</span>
        <span style="font-size:12px; color:#64748b;">(Conflicting events highlighted in red)</span>
      </div>
      <div class="table-wrap" style="border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; background:#fff;">
        <table class="data-table">
          <thead><tr><th>Event</th><th>Club</th><th>Date</th><th>Time</th><th>Venue</th><th>Status</th></tr></thead>
          <tbody>
            ${activeEvents.sort((a,b)=>a.date.localeCompare(b.date)).map(e=>{
              const hasClash = clashingMap.has(e.id);
              const otherNames = hasClash ? clashingMap.get(e.id).join(', ') : '';
              return `
                <tr style="${hasClash ? 'background:#fee2e2 !important; border-left:5px solid #dc2626;' : ''}">
                  <td class="td-name">
                    <div style="display:flex; align-items:center; gap:6px;">
                      ${hasClash ? '<span style="color:#dc2626; font-size:16px;">⚠️</span>' : ''}
                      <span style="${hasClash ? 'color:#991b1b; font-weight:800;' : ''}">${escapeHTML(e.name)}</span>
                    </div>
                    ${hasClash ? `<div style="font-size:11px; font-weight:700; color:#b91c1c; margin-top:2px;">⚡ Clashes with: "${escapeHTML(otherNames)}"</div>` : ''}
                  </td>
                  <td>${escapeHTML(e.club)}</td>
                  <td style="${hasClash ? 'color:#991b1b; font-weight:700;' : ''}">${escapeHTML(formatDate(e.date))}</td>
                  <td>${escapeHTML(formatTime(e.time))}</td>
                  <td style="${hasClash ? 'color:#991b1b; font-weight:700;' : ''}">📍 ${escapeHTML(e.venue)}</td>
                  <td>
                    ${hasClash
                      ? `<span class="badge" style="background:#fecaca; color:#991b1b; border:1px solid #ef4444; font-weight:800;">⚠️ CLASH</span>`
                      : `<span class="badge ${e.status==='approved'?'badge-green':'badge-amber'}">${escapeHTML(e.status)}</span>`
                    }
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}













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



/* ─── Module: js/pages/cpm-theme.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Dynamic CPM Configuration & Festival Themes
   Path: js/pages/cpm-theme.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   DYNAMIC CPM CONFIGURATION (Realtime Banners, Themes, Maintenance)
───────────────────────────────────────────────────────────────*/
async function initDynamicSiteConfig() {
  // Use the shared client (window.supabase is already initialized by bootApp)
  const sb = getSupabaseClient();

  if (!sb) return;

  function applyConfig(cfg) {
    if (!cfg) return;

    // 1. Maintenance Mode
    let maintEl = document.getElementById('cpm-maintenance-overlay');
    if (cfg.maintenance) {
      if (!maintEl) {
        maintEl = document.createElement('div');
        maintEl.id = 'cpm-maintenance-overlay';
        maintEl.style.cssText = 'position:fixed;inset:0;background:#090d16;z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:2rem;font-family:sans-serif;';
        maintEl.innerHTML = `
          <div style="font-size:64px;margin-bottom:1rem;">🛠️</div>
          <h1 style="font-size:2rem;font-family:Outfit,sans-serif;margin-bottom:0.75rem;">Under Scheduled Maintenance</h1>
          <p style="color:#94a3b8;max-width:480px;line-height:1.6;font-size:15px;">The VVCE Events portal is temporarily unavailable while our administrative team applies system updates. Please check back shortly.</p>
        `;
        document.body.appendChild(maintEl);
      }
      maintEl.style.display = 'flex';
    } else if (maintEl) {
      maintEl.style.display = 'none';
    }

    // 2. Dynamic Banner (with start & expiry date support)
    let bannerEl = document.getElementById('cpm-live-banner');
    const now = new Date();
    let showBanner = cfg.banner && cfg.banner.enabled && cfg.banner.text;
    if (showBanner && cfg.banner.start_date && new Date(cfg.banner.start_date) > now) showBanner = false;
    if (showBanner && cfg.banner.end_date && new Date(cfg.banner.end_date) < now) showBanner = false;

    if (showBanner) {
      if (!bannerEl) {
        bannerEl = document.createElement('div');
        bannerEl.id = 'cpm-live-banner';
        bannerEl.style.cssText = 'position:sticky;top:0;z-index:99998;padding:10px 16px;text-align:center;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 2px 8px rgba(0,0,0,0.15);';
        document.body.prepend(bannerEl);
      }
      const bgMap = {
        warning: 'linear-gradient(90deg, #d97706, #f59e0b)',
        danger: 'linear-gradient(90deg, #dc2626, #ef4444)',
        info: 'linear-gradient(90deg, #2563eb, #3b82f6)',
        success: 'linear-gradient(90deg, #059669, #10b981)'
      };
      bannerEl.style.background = bgMap[cfg.banner.type] || bgMap.warning;
      bannerEl.style.color = '#ffffff';
      bannerEl.innerHTML = `<span>${escapeHTML(cfg.banner.text)}</span>`;
      bannerEl.style.display = 'flex';
    } else if (bannerEl) {
      bannerEl.style.display = 'none';
    }

    // 4. Registration Lock
    STATE.registrationLocked = !!cfg.registrationLocked;

    // 5. Dynamic Media Assets
    if (cfg.media && cfg.media.signinBgUrl) {
      document.body.style.backgroundImage = `url("${sanitizeUrl(cfg.media.signinBgUrl)}")`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundAttachment = 'fixed';
      document.body.classList.add('has-theme-bg');
    } else if (cfg.media && cfg.media.bgUrl) {
      document.body.style.backgroundImage = `url("${sanitizeUrl(cfg.media.bgUrl)}")`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundAttachment = 'fixed';
      document.body.classList.add('has-theme-bg');
    } else {
      document.body.style.backgroundImage = '';
      document.body.classList.remove('has-theme-bg');
    }

    // 3. Dynamic Theme & Festival Celebrations
    if (cfg.theme) {
      applyCelebrationTheme(cfg.theme);
    }
  }

  try {
    const { data } = await sb.from('cpm_config').select('*').eq('id', 'global').maybeSingle();
    if (data && data.config) applyConfig(data.config);

    sb.channel('cpm_live_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cpm_config' }, payload => {
        if (payload.new && payload.new.config) applyConfig(payload.new.config);
      })
      .subscribe();
  } catch(e) {
    console.warn('CPM live config sync:', e);
  }
}

/* ─────────────────────────────────────────────────────────────
   FESTIVAL & NATIONAL CELEBRATION DYNAMIC THEME ENGINE
───────────────────────────────────────────────────────────────*/
function applyCelebrationTheme(theme) {
  if (!theme) return;

  // Handle legacy string values
  if (typeof theme === 'string') {
    if (theme === 'default') {
      theme = { primary: '#f59e0b', secondary: '#fbbf24', bgStyle: 'light', effect: 'none', showGreeting: false };
    } else if (theme === 'festive') {
      theme = { primary: '#dc2626', secondary: '#f59e0b', bgStyle: 'light', effect: 'sparkles', showGreeting: true, greeting: 'Festival Celebration! ✨' };
    } else if (theme === 'cyber') {
      theme = { primary: '#06b6d4', secondary: '#8b5cf6', bgStyle: 'dark', effect: 'sparkles', showGreeting: true, greeting: 'VVCE Tech Fest Live! ⚡' };
    }
  }

  const root = document.documentElement;
  const primary = theme.primary || '#f59e0b';
  const secondary = theme.secondary || '#fbbf24';

  // Apply CSS root variables dynamically across the entire website
  root.style.setProperty('--gold', primary);
  root.style.setProperty('--gold2', secondary);
  root.style.setProperty('--gold3', primary);
  root.style.setProperty('--gold-border', primary + '55');
  root.style.setProperty('--gold-bg', primary + '18');
  
  // Sidebar colour is never changed by themes — always stays dark (#111827)
  document.documentElement.style.removeProperty('--sb');

  // Background style
  if (theme.bgStyle === 'dark') {
    document.body.classList.add('dark');
    document.body.style.backgroundColor = '#0f172a';
  } else if (theme.bgStyle === 'warm') {
    document.body.classList.remove('dark');
    document.body.style.backgroundColor = '#fffdf7';
  } else {
    document.body.classList.remove('dark');
    document.body.style.backgroundColor = '';
  }

  // Set background image from theme.bannerUrl — apply to the main content area only (not the sidebar)
  const appMain = document.getElementById('app-main');
  if (theme.bannerUrl) {
    // Clear any old body background first
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundAttachment = '';
    const authScreen = document.getElementById('auth-screen');
    // Apply to the white content panel only
    if (appMain) {
      appMain.style.backgroundImage = `url("${theme.bannerUrl}")`;
      appMain.style.backgroundSize = 'cover';
      appMain.style.backgroundPosition = 'center';
      appMain.style.backgroundRepeat = 'no-repeat';
    }
    // Also apply to the auth/sign-in screen
    if (authScreen) {
      authScreen.style.backgroundImage = `url("${theme.bannerUrl}")`;
      authScreen.style.backgroundSize = 'cover';
      authScreen.style.backgroundPosition = 'center';
      authScreen.style.backgroundRepeat = 'no-repeat';
    }
    document.body.classList.add('has-theme-bg');
  } else {
    // Clear background from both body and app-main
    document.body.style.backgroundImage = '';
    const authScreen = document.getElementById('auth-screen');
    if (appMain) {
      appMain.style.backgroundImage = '';
      appMain.style.backgroundSize = '';
      appMain.style.backgroundPosition = '';
      appMain.style.backgroundAttachment = '';
    }
    if (authScreen) {
      authScreen.style.backgroundImage = '';
      authScreen.style.backgroundSize = '';
      authScreen.style.backgroundPosition = '';
      authScreen.style.backgroundAttachment = '';
    }
    document.body.classList.remove('has-theme-bg');
  }

  // Save theme globally so renderStudentDashboard can inject the greeting ribbon
  window.currentTheme = theme;
  if (typeof STATE !== 'undefined' && STATE.page === 'dashboard' && STATE.user && typeof renderStudentDashboard === 'function') {
    renderStudentDashboard();
  }

  // Auth Screen Festive Greeting Ribbon (configured in CPM Theme tab)
  let authRibbon = document.getElementById('auth-festive-ribbon');
  const authOuter = document.querySelector('.auth-outer');
  if (!authRibbon && authOuter) {
    authRibbon = document.createElement('div');
    authRibbon.id = 'auth-festive-ribbon';
    authRibbon.style.cssText = 'display:none; width:100%; padding:11px 18px; text-align:center; font-weight:800; font-size:14px; color:#ffffff; letter-spacing:0.02em; border-radius:12px; margin-bottom:18px; box-shadow:0 4px 14px rgba(0,0,0,0.18); align-items:center; justify-content:center; gap:8px; font-family:\'Outfit\',sans-serif; box-sizing:border-box;';
    authOuter.prepend(authRibbon);
  }

  if (authRibbon) {
    if (theme.showGreeting && theme.greeting) {
      authRibbon.style.background = `linear-gradient(90deg, ${primary}, ${secondary})`;
      authRibbon.style.color = '#ffffff';
      authRibbon.innerHTML = `<span>${escapeHTML(theme.greeting)}</span>`;
      authRibbon.style.display = 'flex';
    } else {
      authRibbon.style.display = 'none';
    }
  }


  // Floating Celebration Visual Particles
  applyFestiveParticles(theme.effect);
}

function applyFestiveParticles(effect) {
  let container = document.getElementById('cpm-particles-container');
  if (!effect || effect === 'none') {
    if (container) container.remove();
    return;
  }

  if (!container) {
    container = document.createElement('div');
    container.id = 'cpm-particles-container';
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99990;overflow:hidden;';
    document.body.appendChild(container);

    // Inject keyframes style once
    if (!document.getElementById('cpm-particle-styles')) {
      const st = document.createElement('style');
      st.id = 'cpm-particle-styles';
      st.textContent = '@keyframes cpmFloatUp { 0% { transform: translateY(105vh) rotate(0deg); opacity: 0; } 15% { opacity: 0.85; } 85% { opacity: 0.85; } 100% { transform: translateY(-10vh) rotate(360deg); opacity: 0; } }';
      document.head.appendChild(st);
    }
  }

  const emojiMap = {
    sparkles: ['✨', '⭐', '🌟', '💫'],
    rajyotsava: ['💛', '❤️', '🏵️', '💛', '❤️'],
    tricolor: ['🇮🇳', '🧡', '🤍', '💚'],
    diyas: ['🪔', '✨', '🪔', '🌟'],
    flowers: ['🌸', '🌺', '🌼', '💐'],
    confetti: ['🎉', '🎊', '✨', '🎈']
  };

  const symbols = emojiMap[effect] || emojiMap.sparkles;
  container.innerHTML = '';

  for (let i = 0; i < 12; i++) {
    const p = document.createElement('span');
    const sym = symbols[i % symbols.length];
    const left = Math.floor(Math.random() * 96) + 2;
    const dur = (Math.random() * 6 + 6).toFixed(1);
    const delay = (Math.random() * 5).toFixed(1);
    const size = Math.floor(Math.random() * 12 + 16);

    p.innerText = sym;
    p.style.cssText = 'position:absolute;bottom:-30px;left:' + left + '%;font-size:' + size + 'px;animation:cpmFloatUp ' + dur + 's ease-in-out ' + delay + 's infinite;opacity:0;';
    container.appendChild(p);
  }
}



/* ─── Module: js/main.js ─── */
/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Application Bootstrap & Life Cycle Listeners
   Path: js/main.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', function() {
  bootApp(true);
  selectRegRole('student');
  if (typeof google !== 'undefined') {
    initGoogleAuth();
  } else {
    window.addEventListener('load', initGoogleAuth);
  }
  setTimeout(initDynamicSiteConfig, 500);
});

// Lightweight foreground sync on bfcache restore / tab focus (avoids 6,000-row boot storms)
window.addEventListener('pageshow', function(e) {
  if (e.persisted && typeof refreshActivePortalState === 'function') {
    refreshActivePortalState();
  }
});

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible' && typeof refreshActivePortalState === 'function') {
    refreshActivePortalState();
  }
});
