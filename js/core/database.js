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
