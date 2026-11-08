/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Database Layer, Supabase Sync & Cryptography
   Path: js/core/database.js
   ═══════════════════════════════════════════════════════════════ */

/* ============================================================================
   APPROVING AUTHORITIES & SECURITY HELPERS
   ============================================================================ */
let APPROVING_AUTHORITIES_CACHE = [];

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
        localStorage.setItem('vvce_approving_authorities', JSON.stringify(data));
        populateClubRegistrationAuthoritiesDropdown();
        return data;
      }
    }
  } catch (err) {
    console.warn('syncApprovingAuthoritiesFromSupabase warning:', err);
  }

  // Fallback to localStorage or default Dean authority
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
    localStorage.setItem('vvce_approving_authorities', JSON.stringify(APPROVING_AUTHORITIES_CACHE));
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
  sel.innerHTML = '<option value="">-- Select Approving Authority --</option>' +
    active.map(a => `<option value="${a.id}">${a.name} (${a.designation || 'Approving Authority'})</option>`).join('');
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
    try { localStorage.setItem('vvce_users', JSON.stringify(SUPABASE_CACHE['vvce_users'])); } catch(e){}
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
    end_time: e.endTime || e.end_time || '',
    venue: e.venue,
    max_participants: e.maxParticipants ?? e.max_participants ?? 100,
    reg_count: e.regCount ?? e.reg_count ?? 0,
    fee: e.fee ?? 0,
    admin_upi_id: e.adminUpiId || e.admin_upi_id || '',
    points: e.points ?? 0,
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
    authorityId: e.authority_id || e.authorityId || null,
    authorityName: e.authority_name || e.authorityName || null,
    approvedByAuthorityId: e.approved_by_authority_id || e.approvedByAuthorityId || null,
    approvedByAuthorityName: e.approved_by_authority_name || e.approvedByAuthorityName || null,
    approvedAt: e.approved_at || e.approvedAt || null,
    decisionHistory: e.decision_history || e.decisionHistory || []
  };
}

async function syncEventsFromSupabase() {
  const sb = getSupabaseClient();
  if (!sb) return getDB('vvce_events');
  try {
    const { data, error } = await sb.from('events').select('*');
    if (!error && Array.isArray(data)) {
      const mapped = data.map(mapEvent);
      SUPABASE_CACHE.vvce_events = mapped;
      try { localStorage.setItem('vvce_events', JSON.stringify(mapped)); } catch(e){}
      return mapped;
    }
  } catch(e) {
    console.warn('syncEventsFromSupabase failed:', e);
  }
  return getDB('vvce_events');
}

async function setDB(key, val) {
  SUPABASE_CACHE[key] = val;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {}

  const sb = getSupabaseClient();
  if (!sb || typeof sb.from !== 'function') return;

  try {
    if (key === 'vvce_events') {
      const mapped = val.map(mapEventForSupabase);
      const { error } = await sb.from('events').upsert(mapped);
      if (error) {
        console.warn('Events upsert warning:', error.message);
      }
    } else if (key === 'vvce_users') {
      const mapped = val.map(u => ({
        id: u.id, type: u.type, name: u.name, email: u.email, pass: u.pass, usn: u.usn, branch: u.branch, section: u.section, year: u.year, sem: u.sem, admission_year: u.admissionYear, dept: u.dept, phone: u.phone, interests: u.interests, skills: u.skills, bio: u.bio, linkedin: u.linkedin, github: u.github, achievements: u.achievements, profile_photo: u.profilePhoto, resume: u.resume, points: u.points, points_by_sem: u.pointsBySem, notifs: u.notifs, club_name: u.clubName, club_email: u.clubEmail, domain: u.domain, faculty: u.faculty, approved: u.approved, "desc": u.desc, designation: u.designation, authority_id: u.authorityId || u.authority_id || null, authority_name: u.authorityName || u.authority_name || null, approval_history: u.approvalHistory || u.approval_history || []
      }));
      await sb.from('users').upsert(mapped);
      // Also sync fresh/real student registrations to the dedicated registered_students table
      const studentMapped = mapped.filter(u => u.type === 'student' && !['u1','u2','u3','u4'].includes(u.id));
      if (studentMapped.length > 0) {
        sb.from('registered_students').upsert(studentMapped).then(() => {}).catch(() => {});
      }
    } else if (key === 'vvce_certs') {
      const mapped = val.map(c => ({
        id: c.id, "userId": c.userId, title: c.title, issuer: c.issuer, date: c.date, position: c.position, points: c.points, type: c.type, verified: c.verified, auto_generated: c.autoGenerated || false, event_id: c.eventId || null
      }));
      const activeIds = mapped.map(c => c.id);
      if (activeIds.length > 0) {
        await sb.from('vvce_certs').delete().not('id', 'in', `(${activeIds.join(',')})`);
      } else {
        await sb.from('vvce_certs').delete().neq('id', '_none_');
      }
      await sb.from('vvce_certs').upsert(mapped);
    } else if (key === 'vvce_academic') {
      const mapped = val.map(a => ({
        id: a.id, date: a.date, type: a.type, "desc": a.desc
      }));
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

/* Realtime Sync Helpers */
function mapUser(u) {
  return {
    id: u.id, type: u.type, name: u.name, email: u.email, pass: u.pass, usn: u.usn, branch: u.branch, section: u.section, year: u.year, sem: u.sem, admissionYear: u.admission_year, dept: u.dept, phone: u.phone, interests: u.interests, skills: u.skills, bio: u.bio, linkedin: u.linkedin, github: u.github, achievements: u.achievements, profilePhoto: u.profile_photo, resume: u.resume, points: u.points, pointsBySem: u.points_by_sem, notifs: u.notifs, clubName: u.club_name, clubEmail: u.club_email, domain: u.domain, faculty: u.faculty, approved: u.approved, desc: u.desc, designation: u.designation, authorityId: u.authority_id || u.authorityId || null, authorityName: u.authority_name || u.authorityName || null, approvalHistory: u.approval_history || u.approvalHistory || []
  };
}

function mapEvent(e) {
  return {
    id: e.id, name: e.name, club: e.club, adminId: e.admin_id, emoji: e.emoji, category: e.category, date: e.date, time: e.time, endDate: e.end_date, endTime: e.end_time, venue: e.venue, maxParticipants: e.max_participants, regCount: e.reg_count, fee: e.fee, adminUpiId: e.admin_upi_id || '', points: e.points, desc: e.desc, speakers: e.speakers || '', rules: e.rules || '', branches: e.branches, status: e.status, rejReason: e.rej_reason, poster: e.poster, registrations: e.registrations || [], pendingPayments: e.pending_payments || [], attendedStudents: e.attended_students || [],
    isTeamEvent: e.isTeamEvent ?? e.is_team_event ?? false,
    minTeamSize: e.minTeamSize ?? e.min_team_size ?? 1,
    maxTeamSize: e.maxTeamSize ?? e.max_team_size ?? 1,
    teams: e.teams || [],
    waitlist: e.waitlist || [],
    waitlist_enabled: e.waitlist_enabled ?? e.waitlistEnabled ?? false,
    publish_at: e.publish_at || e.publishAt || null
  };
}

function mapCert(c) {
  return {
    id: c.id, userId: c.userId, title: c.title, issuer: c.issuer, date: c.date, position: c.position, points: c.points, type: c.type, verified: c.verified, autoGenerated: c.auto_generated || false, eventId: c.event_id || null
  };
}

function mapAcademic(a) {
  return {
    id: a.id, date: a.date, type: a.type, desc: a.desc
  };
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
  return {
    id: s.id, date: s.date, startTime: s.start_time, endTime: s.end_time, title: s.title, desc: s.desc
  };
}

function handleRealtimeUpdate(key, payload) {
  const { eventType, new: newRecord, old: oldRecord } = payload;
  const cache = SUPABASE_CACHE[key];

  if (key === 'vvce_principal_status') {
    if (eventType === 'DELETE') {
      SUPABASE_CACHE.vvce_principal_status = { text: "Available", note: "", updated: "Just now", color: "#48bb78", icon: "✅" };
    } else {
      SUPABASE_CACHE.vvce_principal_status = mapPrincipalStatus(newRecord);
    }
    try { localStorage.setItem('vvce_principal_status', JSON.stringify(SUPABASE_CACHE.vvce_principal_status)); } catch(e){}
    if (['dashboard','admin-dashboard','authority-dashboard','principal-portal'].includes(STATE.page)) {
      showPage(STATE.page);
    }
  } else if (key === 'vvce_princ_attend') {
    if (eventType === 'INSERT') {
      if (!SUPABASE_CACHE.vvce_princ_attend.includes(newRecord.event_id)) {
        SUPABASE_CACHE.vvce_princ_attend.push(newRecord.event_id);
      }
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
      const exists = cache.some(item => item.id === newRecord.id);
      if (!exists && mapper) {
        cache.push(mapper(newRecord));
      }
    } else if (eventType === 'UPDATE') {
      // If event was archived by CPM, remove it from visible cache entirely
      if (key === 'vvce_events' && newRecord.status === 'archived') {
        SUPABASE_CACHE[key] = cache.filter(item => item.id !== newRecord.id);
      } else {
        const idx = cache.findIndex(item => item.id === newRecord.id);
        if (idx !== -1 && mapper) {
          cache[idx] = mapper(newRecord);
        } else if (mapper) {
          cache.push(mapper(newRecord));
        }
      }
    }
    // Always persist realtime changes to localStorage!
    try { localStorage.setItem(key, JSON.stringify(SUPABASE_CACHE[key])); } catch(e){}
  }

  // Handle active session changes (e.g. current user updated, approved state changed, points changed)
  if (STATE.user) {
    const updatedUser = (SUPABASE_CACHE.vvce_users || []).find(u => u.id === STATE.user.id);
    if (updatedUser) {
      if (STATE.user.type === 'admin' && STATE.user.approved && !updatedUser.approved) {
        // Force logout if revoked
        STATE.user = null;
        STATE.deanUnlocked = false;
        STATE.principalUnlocked = false;
        document.getElementById('app').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
        document.body.style.background = '#1a2235';
        toast('Your club access has been revoked by Dean Student Welfare.', 'warning');
        return;
      }
      STATE.user = updatedUser;
    }
  }

  // Smart re-render current page (only if not typing in inputs/textareas to avoid loss of focus)
  const activeTag = document.activeElement ? document.activeElement.tagName : '';
  const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';
  if (!isTyping && STATE.page) {
    if (STATE.page === 'participants') {
      if (typeof renderParticipantTable === 'function') renderParticipantTable();
    } else if (STATE.page === 'dean-portal' && STATE.deanUnlocked) {
      const curTab = document.querySelector('.portal-tab.active')?.textContent.includes('Monitor') ? 'events' : 'event-approvals';
      renderDeanPortal(curTab);
    } else {
      showPage(STATE.page);
    }
  }
}

let realtimeChannel = null;
function setupRealtimeSync() {
  const sb = getSupabaseClient();
  if (!sb || typeof sb.channel !== 'function') return;
  if (realtimeChannel) return; // already setup

  realtimeChannel = sb.channel('db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, payload => {
      handleRealtimeUpdate('vvce_users', payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'registered_students' }, payload => {
      handleRealtimeUpdate('vvce_users', payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, payload => {
      handleRealtimeUpdate('vvce_events', payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vvce_certs' }, payload => {
      handleRealtimeUpdate('vvce_certs', payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'academic' }, payload => {
      handleRealtimeUpdate('vvce_academic', payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'principal_status' }, payload => {
      handleRealtimeUpdate('vvce_principal_status', payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'principal_schedules' }, payload => {
      handleRealtimeUpdate('vvce_principal_schedule', payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'princ_attend' }, payload => {
      handleRealtimeUpdate('vvce_princ_attend', payload);
    })
    .subscribe();
}

async function bootApp() {
  const sb = getSupabaseClient();
  if (!sb || typeof sb.from !== 'function') {
    console.warn('Supabase client not ready yet, working in persistent local mode.');
    return;
  }
  
  await checkSupabaseEmailVerification();
  checkTeamInviteUrl();

  try {
    const [uRes, regRes, eRes, cRes, aRes, psRes, pscRes, paRes] = await Promise.all([
      sb.from('users').select('*'),
      sb.from('registered_students').select('*').catch(() => ({ data: [] })),
      sb.from('events').select('*'),
      sb.from('vvce_certs').select('*'),
      sb.from('academic').select('*'),
      sb.from('principal_status').select('*'),
      sb.from('principal_schedules').select('*'),
      sb.from('princ_attend').select('*')
    ]);

    const combinedRawUsers = [...(uRes?.data || [])];
    if (regRes && regRes.data && Array.isArray(regRes.data)) {
      regRes.data.forEach(ru => {
        if (!combinedRawUsers.some(u => u.id === ru.id || (u.email && ru.email && u.email.toLowerCase() === ru.email.toLowerCase()))) {
          combinedRawUsers.push(ru);
        }
      });
    }

    if (combinedRawUsers.length > 0 || (uRes && uRes.data)) {
      // ── Supabase is the single source of truth ──
      // Remote users completely replace local cache.
      // Only the 4 built-in demo accounts (never stored in Supabase)
      // are appended locally so demo login always works.
      const DEMO_IDS = ['u1', 'u2', 'u3', 'u4'];
      const remoteUsers = combinedRawUsers.map(mapUser);
      const remoteEmails = remoteUsers.map(u => u.email.toLowerCase());

      // Keep demo accounts locally only (never push them to Supabase)
      const demoUsers = DEFAULT_USERS.filter(
        du => DEMO_IDS.includes(du.id) && !remoteEmails.includes(du.email.toLowerCase())
      );

      const finalUsers = [...remoteUsers, ...demoUsers];
      SUPABASE_CACHE.vvce_users = finalUsers;
      try { localStorage.setItem('vvce_users', JSON.stringify(finalUsers)); } catch(e){}
    }
    if (eRes && eRes.data) {
      // Events: Supabase is always the source of truth (even if empty — clear means clear)
      SUPABASE_CACHE.vvce_events = eRes.data.map(mapEvent);
      try { localStorage.setItem('vvce_events', JSON.stringify(SUPABASE_CACHE.vvce_events)); } catch(e){}
    }
    if (cRes && cRes.data && cRes.data.length > 0) {
      SUPABASE_CACHE.vvce_certs = cRes.data.map(mapCert);
      try { localStorage.setItem('vvce_certs', JSON.stringify(SUPABASE_CACHE.vvce_certs)); } catch(e){}
    }
    if (aRes && aRes.data && aRes.data.length > 0) {
      SUPABASE_CACHE.vvce_academic = aRes.data.map(a => ({
        id: a.id, date: a.date, type: a.type, desc: a.desc
      }));
      try { localStorage.setItem('vvce_academic', JSON.stringify(SUPABASE_CACHE.vvce_academic)); } catch(e){}
    }
    if (psRes && psRes.data && psRes.data.length > 0) {
      SUPABASE_CACHE.vvce_principal_status = mapPrincipalStatus(psRes.data[0]);
      try { localStorage.setItem('vvce_principal_status', JSON.stringify(SUPABASE_CACHE.vvce_principal_status)); } catch(e){}
    } else {
      SUPABASE_CACHE.vvce_principal_status = {"text":"Available","note":"","updated":"Just now","color":"#48bb78","icon":"✅"};
    }
    if (pscRes && pscRes.data) {
      SUPABASE_CACHE.vvce_principal_schedule = pscRes.data.map(s => ({
        id: s.id, date: s.date, startTime: s.start_time, endTime: s.end_time, title: s.title, desc: s.desc
      }));
    } else {
      SUPABASE_CACHE.vvce_principal_schedule = [];
    }
    if (paRes && paRes.data) {
      SUPABASE_CACHE.vvce_princ_attend = paRes.data.map(r => r.event_id);
    } else {
      SUPABASE_CACHE.vvce_princ_attend = [];
    }
    setupRealtimeSync();
    checkTeamInviteUrl();
    
    // Refresh UI to display the freshly loaded data from Supabase
    if (STATE.page && !document.activeElement.tagName.match(/INPUT|TEXTAREA|SELECT/)) {
      if (STATE.page === 'participants' && typeof renderParticipantTable === 'function') {
        renderParticipantTable();
      } else {
        showPage(STATE.page);
      }
    }
  } catch (err) {
    console.error('Failed to load from Supabase:', err);
  }
}
