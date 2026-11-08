/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Events Feed, Search, Filters & Team Registration
   Path: js/pages/events.js
   ═══════════════════════════════════════════════════════════════ */

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
  const isReg = (ev.registrations||[]).includes(user?.id);
  const currentRegCount = (ev.registrations || []).length;
  const maxCap = ev.max_participants || ev.maxParticipants || 100;
  const isFull = currentRegCount >= maxCap;
  const isCancelled = ev.status === 'cancelled';
  const isRescheduled = ev.status === 'rescheduled';
  const catCls = { Technical:'cat-technical',Cultural:'cat-cultural',Sports:'cat-sports',Workshop:'cat-workshop',Management:'cat-management',Social:'cat-social' }[ev.category]||'cat-technical';

  return `
    <div class="event-card ${isCancelled ? 'ev-cancelled-card' : ''}" onclick="openEventModal('${ev.id}')">
      <div class="event-poster">
        ${ev.poster?`<img src="${ev.poster}">`:`<span style="position:relative;z-index:1;">${ev.emoji||'🎓'}</span>`}
        <span class="ev-cat-badge ${catCls}">${ev.category}</span>
        ${isCancelled ? `<span class="ev-cat-badge" style="top:10px;right:10px;left:auto;background:#ef4444;color:#fff;font-weight:800;">🚫 CANCELLED</span>` : ''}
        ${isRescheduled ? `<span class="ev-cat-badge" style="top:10px;right:10px;left:auto;background:#f59e0b;color:#fff;font-weight:800;">⚠️ RESCHEDULED</span>` : ''}
      </div>
      <div class="ev-body">
        <div class="ev-title">${ev.name}</div>
        <div class="ev-club">${ev.club}</div>
        ${isCancelled ? `<div style="background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; padding:6px 10px; border-radius:6px; font-size:12px; font-weight:600; margin:6px 0;">🚫 <strong>Event Cancelled:</strong> ${ev.rejReason || 'Due to administrative schedule changes.'}</div>` : ''}
        ${isRescheduled ? `<div style="background:#fffbeb; border:1px solid #fde68a; color:#b45309; padding:6px 10px; border-radius:6px; font-size:12px; font-weight:600; margin:6px 0;">⚠️ <strong>Rescheduled:</strong> Now on ${formatDate(ev.date)} @ ${formatTime(ev.time)}</div>` : ''}
        <div class="ev-metas">
          <div class="ev-meta">📅 ${formatDate(ev.date)}</div>
          <div class="ev-meta">🕐 ${formatTime(ev.time)} &nbsp;|&nbsp; 📍 ${ev.venue}</div>
          <div class="ev-meta">⭐ ${ev.points||0} pts &nbsp;|&nbsp; ${ev.fee>0?`<span style="color:#b45309;">₹${ev.fee}</span>`:`<span style="color:#15803d;">FREE</span>`}</div>
          <div class="ev-meta" style="color:#6366f1;font-weight:600;">🎓 Open to: ${(ev.branches && ev.branches.length > 0) ? (ev.branches.includes('All') ? 'All Branches' : ev.branches.join(', ')) : 'All Branches'}</div>
          ${ev.isTeamEvent ? `<div class="ev-meta" style="color:#7c3aed;font-weight:700;">👥 Team Event &nbsp;|&nbsp; ${ev.minTeamSize}–${ev.maxTeamSize} members</div>` : ''}
          ${ev.desc ? `
            <div style="background:#fffdf5;border-left:3px solid #f59e0b;padding:6px 9px;border-radius:6px;font-size:11.5px;color:#78350f;line-height:1.45;margin-top:7px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
              <strong style="color:#b45309;">📝 Description:</strong> ${ev.desc}
            </div>` : ''}
          ${ev.rules ? `
            <div style="background:#fef2f2;border-left:3px solid #ef4444;padding:6px 9px;border-radius:6px;font-size:11px;color:#7f1d1d;line-height:1.4;margin-top:5px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;">
              <strong style="color:#b91c1c;">⚖️ Rules:</strong> ${ev.rules}
            </div>` : ''}
        </div>
        <div class="ev-foot">
          <span class="ev-seats ${isFull?'full':''}">${
            isCancelled ? 'Cancelled' : 
            isFull ? '🔴 Full' : 
            ev.isTeamEvent ? `👥 ${(ev.teams||[]).length} team(s) (${currentRegCount}/${maxCap} people)` : 
            `${maxCap - currentRegCount} seats left`
          }</span>
          <div style="display:flex;gap:6px;align-items:center;">
            ${user?.type==='student'
              ? isCancelled
                ? `<button class="btn-reg" disabled style="background:#ef444420;color:#ef4444;border:1px solid #ef444440;cursor:not-allowed;">Cancelled</button>`
                : isReg
                  ? `<button class="btn-reg registered" onclick="event.stopPropagation();unregisterEv('${ev.id}')">✓ Registered</button>`
                  : (ev.pendingPayments && ev.pendingPayments.some(p => p.uid === STATE.user.id))
                    ? `<button class="btn-reg" style="background:#f59e0b;color:#fff;border:none;" disabled>⏳ Pending Approval</button>`
                    : STATE.registrationLocked
                      ? `<button class="btn-reg" disabled style="background:#64748b;color:#fff;border:none;cursor:not-allowed;">🔒 Paused</button>`
                      : isFull
                        ? (ev.waitlist_enabled
                            ? `<button class="btn-reg" style="background:#f59e0b;color:#fff;border:none;" onclick="event.stopPropagation();joinWaitlist('${ev.id}')">⏳ Waitlist</button>`
                            : `<button class="btn-reg" disabled style="opacity:.5;cursor:not-allowed;">Full</button>`)
                        : `<button class="btn-reg" onclick="event.stopPropagation();registerEv('${ev.id}')">Register</button>`
              : ''
            }
          </div>
        </div>
      </div>
    </div>`;
}

/* ─────────────────────────────────────────────────────────────
   TEAM REGISTRATION
───────────────────────────────────────────────────────────────*/
let _teamRegEventId = null;
let _teamRegTeamId = null;
let _teamMembers = []; // array of email strings added by leader

function toggleTeamFields() {
  const isChecked = document.getElementById('ev-is-team')?.checked || false;
  const wrap = document.getElementById('ev-team-wrap');
  const card = document.getElementById('team-event-card-wrap');
  const title = document.getElementById('team-card-title');

  // Show/hide team fields
  if (wrap) wrap.style.display = isChecked ? 'block' : 'none';
  if (card) {
    card.style.background = isChecked ? '#f5f3ff' : '#f8fafc';
    card.style.borderColor = isChecked ? '#8b5cf6' : '#e2e8f0';
    card.style.boxShadow = isChecked ? '0 2px 8px rgba(139,92,246,0.15)' : 'none';
  }
  if (title) title.style.color = isChecked ? '#6d28d9' : '#0f172a';

  // Disable Max Participants when team event is on (auto-computed)
  const maxInput = document.getElementById('ev-max');
  const hint = document.getElementById('ev-max-team-hint');
  if (maxInput) {
    maxInput.disabled = isChecked;
    maxInput.style.opacity = isChecked ? '0.45' : '1';
    maxInput.style.cursor = isChecked ? 'not-allowed' : '';
    maxInput.style.background = isChecked ? '#f1f0ff' : '';
  }
  if (hint) hint.style.display = isChecked ? 'block' : 'none';

  // If turning ON, compute initial value
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
    `ℹ️ This event requires teams of ${min}–${max} members (including yourself). Verification emails are sent immediately when you add each member.`;

  openModal('modal-team-register');
}

function renderTeamMembersList() {
  const list = document.getElementById('team-members-list');
  if (!list) return;

  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === _teamRegEventId);
  const team = (ev?.teams || []).find(t => t.id === _teamRegTeamId);
  const allUsers = getDB('vvce_users', []);

  list.innerHTML = _teamMembers.map((member, idx) => {
    const memEmail = typeof member === 'object' ? member.email : member;
    const memName = typeof member === 'object' ? member.name : '';

    // Check if teammate has already verified/accepted
    const isVerified = team && (team.memberIds || []).some(uid => {
      const u = allUsers.find(user => user.id === uid);
      return u && u.email.toLowerCase() === memEmail.toLowerCase();
    });

    return `
      <div style="display:flex; align-items:center; gap:8px; padding:8px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:6px; font-size:13px; flex-wrap:wrap;">
        <span style="font-size:15px;">👤</span>
        <div style="flex:1; min-width:140px; overflow:hidden; text-overflow:ellipsis;">
          ${memName ? `<strong style="color:#1e293b;">${memName}</strong> • ` : ''}
          <span style="color:#4b5563; font-weight:500;">${memEmail}</span>
        </div>
        ${isVerified ? `
          <span style="font-size:11px; color:#15803d; font-weight:700; background:#dcfce7; border:1px solid #86efac; padding:2px 8px; border-radius:12px; white-space:nowrap;">✓ Added</span>
        ` : `
          <span style="font-size:11px; color:#b45309; font-weight:700; background:#fef3c7; border:1px solid #fde68a; padding:2px 8px; border-radius:12px; white-space:nowrap;">⏳ Invite Pending</span>
          <button onclick="openMailtoVerification('${memEmail}','${escapeStr(memName)}','${escapeStr(document.getElementById('team-name-input')?.value || 'Team')}','${escapeStr(ev?.name || 'Event')}','${_teamRegTeamId}','${_teamRegEventId}')" style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; font-size:11px; font-weight:700; color:#2563eb; padding:2px 8px; cursor:pointer;" title="Send verification email to ${memEmail} via College Webmail / Gmail">📧 Email</button>
          <button onclick="copyTeamInviteLink('${_teamRegTeamId}','${_teamRegEventId}','${escapeStr(memName||memEmail)}')" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; font-size:11px; font-weight:700; color:#475569; padding:2px 8px; cursor:pointer;" title="Copy verification link">📋 Link</button>
        `}
        <button onclick="removeTeamMember(${idx})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:16px; padding:0 4px;" title="Remove">×</button>
      </div>
    `;
  }).join('');
}

async function addTeamMember() {
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
  if (!email) {
    errEl.textContent = '❌ Please enter teammate\'s @vvce.ac.in email.';
    errEl.style.display = 'block';
    emailInput?.focus();
    return;
  }
  if (!email.endsWith('@vvce.ac.in')) {
    errEl.textContent = '❌ Only @vvce.ac.in email addresses are allowed.';
    errEl.style.display = 'block';
    emailInput?.focus();
    return;
  }
  if (email === STATE.user.email.toLowerCase()) {
    errEl.textContent = '❌ You are already the team leader — no need to add yourself.';
    errEl.style.display = 'block'; return;
  }
  if (_teamMembers.some(m => (typeof m === 'object' ? m.email : m).toLowerCase() === email)) {
    errEl.textContent = '❌ This teammate email has already been added.';
    errEl.style.display = 'block'; return;
  }

  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === _teamRegEventId);
  if (!ev) return;

  const maxTeam = (ev.maxTeamSize || 4) - 1; // subtract leader
  if (_teamMembers.length >= maxTeam) {
    errEl.textContent = `❌ Maximum ${ev.maxTeamSize || 4} members per team (including you).`;
    errEl.style.display = 'block'; return;
  }

  _teamMembers.push({ name, email });
  if (nameInput) nameInput.value = '';
  if (emailInput) emailInput.value = '';

  const memberEmails = _teamMembers.map(m => typeof m === 'object' ? m.email : m);
  const pendingMembers = _teamMembers.map(m => typeof m === 'object' ? { name: m.name, email: m.email } : { name: '', email: m });

  // Ensure team draft exists in database immediately so invite links can be accepted right away
  if (!ev.teams) ev.teams = [];
  let team = ev.teams.find(t => t.id === _teamRegTeamId);
  const teamNameInput = document.getElementById('team-name-input')?.value.trim() || `Team ${STATE.user.name}`;
  if (!team) {
    team = {
      id: _teamRegTeamId,
      name: teamNameInput,
      leaderId: STATE.user.id,
      leaderName: STATE.user.name,
      leaderEmail: STATE.user.email,
      memberEmails: [...memberEmails],
      memberDetails: [...pendingMembers],
      memberIds: [STATE.user.id],
      pendingEmails: [...memberEmails],
      pendingMembers: [...pendingMembers],
      paymentStatus: ev.fee > 0 ? 'pending' : 'free',
      createdAt: new Date().toISOString()
    };
    ev.teams.push(team);
  } else {
    team.memberEmails = [...memberEmails];
    team.memberDetails = [...pendingMembers];
    team.pendingEmails = memberEmails.filter(em => !(team.memberIds || []).some(uid => {
      const u = getDB('vvce_users', []).find(usr => usr.id === uid);
      return u && u.email.toLowerCase() === em.toLowerCase();
    }));
    team.pendingMembers = pendingMembers.filter(pm => !(team.memberIds || []).some(uid => {
      const u = getDB('vvce_users', []).find(usr => usr.id === uid);
      return u && u.email.toLowerCase() === pm.email.toLowerCase();
    }));
  }

  // Register leader in event
  if (!ev.registrations) ev.registrations = [];
  if (!ev.registrations.includes(STATE.user.id)) {
    ev.registrations.push(STATE.user.id);
    ev.regCount = (ev.regCount || 0) + 1;
  }

  await setDB('vvce_events', events);

  // Send verification email immediately to the newly added member!
  const siteUrl = window.location.origin + window.location.pathname;
  const inviteBase = `${siteUrl}?teamInvite=${_teamRegTeamId}&event=${ev.id}`;
  const sb = getSupabaseClient();
  let emailDispatched = false;
  try {
    if (sb && sb.auth) {
      const res = await sb.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: inviteBase,
          data: { teamInvite: true, teamId: _teamRegTeamId, teamName: teamNameInput, eventId: ev.id, eventName: ev.name, inviterName: STATE.user.name, memberName: name }
        }
      });
      if (res && res.error) {
        console.warn('Supabase OTP email warning for', email, res.error);
        if (res.error.status === 429 || res.error.message?.includes('rate limit') || res.error.code === 'over_email_send_rate_limit') {
          toast(`⚠️ Notice: Supabase default email rate limit reached (3/hr). Verification link is ready! Click "📋 Link" below to copy and share it directly with ${name}.`, 'warning', 8000);
        } else {
          toast(`⚠️ Email delivery notice: ${res.error.message}. You can copy the verification link below.`, 'info', 6000);
        }
      } else {
        emailDispatched = true;
        toast(`✉️ Verification email sent immediately to ${name} (${email})!`, 'success', 5000);
      }
    }
  } catch(e) {
    console.warn('Invite error:', e);
  }

  if (!emailDispatched && (!sb || !sb.auth)) {
    toast(`Added ${name}! Click "📋 Link" to copy their verification link.`, 'success', 5000);
  }

  renderTeamMembersList();
}

async function removeTeamMember(idx) {
  const removedMember = _teamMembers[idx];
  const removedEmail = typeof removedMember === 'object' ? removedMember.email : removedMember;
  _teamMembers.splice(idx, 1);

  // Update DB team draft
  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === _teamRegEventId);
  if (ev && ev.teams) {
    const team = ev.teams.find(t => t.id === _teamRegTeamId);
    if (team) {
      team.memberEmails = (team.memberEmails || []).filter(e => e.toLowerCase() !== removedEmail.toLowerCase());
      team.pendingEmails = (team.pendingEmails || []).filter(e => e.toLowerCase() !== removedEmail.toLowerCase());
      if (team.pendingMembers) {
        team.pendingMembers = team.pendingMembers.filter(m => (typeof m === 'object' ? m.email : m).toLowerCase() !== removedEmail.toLowerCase());
      }
      if (team.memberDetails) {
        team.memberDetails = team.memberDetails.filter(m => (typeof m === 'object' ? m.email : m).toLowerCase() !== removedEmail.toLowerCase());
      }
      await setDB('vvce_events', events);
    }
  }

  renderTeamMembersList();
}

async function submitTeamRegistration() {
  const teamName = document.getElementById('team-name-input').value.trim();
  const errEl = document.getElementById('team-member-error');
  errEl.style.display = 'none';

  if (!teamName) {
    errEl.textContent = '❌ Please enter a team name.';
    errEl.style.display = 'block'; return;
  }

  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === _teamRegEventId);
  if (!ev) return;

  const totalMembers = 1 + _teamMembers.length; // leader + added members
  const minTeam = ev.minTeamSize || 2;
  const maxTeam = ev.maxTeamSize || 4;

  if (totalMembers < minTeam) {
    errEl.textContent = `❌ You need at least ${minTeam} members (including yourself). Add ${minTeam - totalMembers} more.`;
    errEl.style.display = 'block'; return;
  }
  if (totalMembers > maxTeam) {
    errEl.textContent = `❌ Maximum allowed team size is ${maxTeam} members (including yourself). Remove ${totalMembers - maxTeam} member(s).`;
    errEl.style.display = 'block'; return;
  }

  const currentRegCount = (ev.registrations || []).length;
  const maxCap = ev.max_participants || ev.maxParticipants || 100;
  if (currentRegCount + totalMembers > maxCap) {
    errEl.textContent = `❌ Adding this team (${totalMembers} members) exceeds the total event capacity (${maxCap} people). Only ${maxCap - currentRegCount} spot(s) remaining.`;
    errEl.style.display = 'block'; return;
  }

  const memberEmails = _teamMembers.map(m => typeof m === 'object' ? m.email : m);
  const memberDetails = _teamMembers.map(m => typeof m === 'object' ? { name: m.name, email: m.email } : { name: '', email: m });

  // Update or create team record
  if (!ev.teams) ev.teams = [];
  let team = ev.teams.find(t => t.id === _teamRegTeamId);
  if (!team) {
    team = {
      id: _teamRegTeamId,
      name: teamName,
      leaderId: STATE.user.id,
      leaderName: STATE.user.name,
      leaderEmail: STATE.user.email,
      memberEmails: [...memberEmails],
      memberDetails: [...memberDetails],
      memberIds: [STATE.user.id],
      pendingEmails: [...memberEmails],
      pendingMembers: [...memberDetails],
      paymentStatus: ev.fee > 0 ? 'pending' : 'free',
      createdAt: new Date().toISOString()
    };
    ev.teams.push(team);
  } else {
    team.name = teamName;
    team.memberEmails = [...memberEmails];
    team.memberDetails = [...memberDetails];
  }

  // Register leader
  if (!ev.registrations) ev.registrations = [];
  if (!ev.registrations.includes(STATE.user.id)) {
    ev.registrations.push(STATE.user.id);
    ev.regCount = (ev.regCount || 0) + 1;
  }

  await setDB('vvce_events', events);
  closeModal('modal-team-register');

  if (ev.fee > 0) {
    STATE.pendingTeamReg = { evId: ev.id, teamId: _teamRegTeamId, teamName };
    toast(`Team "${teamName}" registered! Please upload payment proof to complete.`, 'info', 5000);
    openPaymentModal(ev);
  } else {
    addNotif(`You registered your team "${teamName}" for "${ev.name}"! 🎉 Verification emails sent to all members.`, '👥');
    toast(`Team "${teamName}" registered! Teammates can verify from their email links. 🎉`, 'success', 5000);
  }

  if (STATE.page === 'events') filterEvents();
  if (STATE.page === 'dashboard') renderStudentDashboard();
  if (STATE.page === 'registrations') renderRegistrationsPage();
}

// Called on page load & after auth/event sync — checks if URL or session has a teamInvite param
function checkTeamInviteUrl() {
  const params = new URLSearchParams(window.location.search);
  let teamId = params.get('teamInvite');
  let eventId = params.get('event');

  if (teamId && eventId) {
    try {
      sessionStorage.setItem('vvce_pending_invite', JSON.stringify({ teamId, eventId }));
    } catch(e) {}
    try { window.history.replaceState({}, '', window.location.pathname); } catch(e){}
  } else {
    try {
      const saved = sessionStorage.getItem('vvce_pending_invite');
      if (saved) {
        const parsed = JSON.parse(saved);
        teamId = parsed.teamId;
        eventId = parsed.eventId;
      }
    } catch(e) {}
  }

  if (!teamId || !eventId) return;

  const events = getDB('vvce_events');
  const ev = events.find(e => String(e.id) === String(eventId));
  if (!ev) return; // Keep in sessionStorage until events are loaded from Supabase

  const team = (ev.teams || []).find(t => String(t.id) === String(teamId));
  if (!team) return;

  window._pendingTeamInvite = { teamId, eventId };

  // If user is already registered for this event, auto-dismiss
  if (STATE.user && (ev.registrations || []).includes(STATE.user.id)) {
    const banner = document.getElementById('team-invite-banner');
    if (banner) banner.style.display = 'none';
    try { sessionStorage.removeItem('vvce_pending_invite'); } catch(e){}
    return;
  }

  // If user is logged in and was invited to this team, auto-accept immediately upon email verification click!
  if (STATE.user) {
    const userEmail = (STATE.user.email || '').toLowerCase();
    const isPendingInvite = (team.pendingEmails || []).some(e => e.toLowerCase() === userEmail);
    if (isPendingInvite) {
      acceptTeamInvite();
      return;
    }
  }

  // Show invite banner
  const banner = document.getElementById('team-invite-banner');
  const msgEl = document.getElementById('invite-banner-msg');
  const subEl = document.getElementById('invite-banner-sub');
  const btnEl = document.getElementById('invite-banner-btn');
  if (banner && msgEl) {
    msgEl.textContent = `You've been invited to join "${team.name}" for ${ev.name}!`;
    if (STATE.user) {
      const userEmail = (STATE.user.email || '').toLowerCase();
      const isTarget = (team.pendingEmails || []).some(e => e.toLowerCase() === userEmail) || (team.memberEmails || []).some(e => e.toLowerCase() === userEmail);
      if (isTarget) {
        subEl.textContent = `Invited by ${team.leaderName}. Click Accept to verify and join this team!`;
      } else {
        subEl.textContent = `Invited by ${team.leaderName} for (${team.memberEmails.join(', ')}). Currently signed in as ${STATE.user.email}.`;
      }
      if (btnEl) btnEl.textContent = '✅ Accept & Join Team';
    } else {
      subEl.textContent = `Invited by ${team.leaderName}. Please sign in to verify and be added to the team.`;
      if (btnEl) btnEl.textContent = '🔑 Sign In to Accept';
    }
    banner.style.display = 'block';
  }
}

window.dismissTeamInviteBanner = function() {
  const banner = document.getElementById('team-invite-banner');
  if (banner) banner.style.display = 'none';
  try { sessionStorage.removeItem('vvce_pending_invite'); } catch(e){}
  window._pendingTeamInvite = null;
};

function escapeStr(s) {
  if (!s) return '';
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

window.copyTeamInviteLink = function(teamId, eventId, memberName) {
  const siteUrl = window.location.origin + window.location.pathname;
  const url = `${siteUrl}?teamInvite=${teamId}&event=${eventId}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      toast(`📋 Verification link for ${memberName || 'teammate'} copied to clipboard! Share it with them directly.`, 'success', 5000);
    }).catch(() => {
      prompt('Copy verification link:', url);
    });
  } else {
    prompt('Copy verification link:', url);
  }
};

window.openMailtoVerification = function(memberEmail, memberName, teamName, eventName, teamId, eventId) {
  const siteUrl = window.location.origin + window.location.pathname;
  const inviteLink = `${siteUrl}?teamInvite=${teamId}&event=${eventId}`;
  const inviterName = STATE.user ? STATE.user.name : 'Your Team Leader';

  const subject = encodeURIComponent(`Invitation to join Team "${teamName}" for ${eventName} - VVCE Events Hub`);
  const body = encodeURIComponent(
`Hi ${memberName || 'there'},

You have been invited by ${inviterName} to join Team "${teamName}" for the upcoming event "${eventName}" at VVCE Events Hub.

Please click the verification link below to verify your college email and confirm your team spot:
${inviteLink}

Regards,
VVCE Events Hub — Vidyavardhaka College of Engineering`
  );

  window.open(`mailto:${memberEmail}?subject=${subject}&body=${body}`, '_blank');
  toast(`Opening email composer for ${memberEmail}... 📧`, 'info', 4000);
};

async function acceptTeamInvite() {
  let invite = window._pendingTeamInvite;
  if (!invite) {
    try {
      const saved = sessionStorage.getItem('vvce_pending_invite');
      if (saved) invite = JSON.parse(saved);
    } catch(e) {}
  }
  if (!invite) return;
  const { teamId, eventId } = invite;

  if (!STATE.user) {
    toast('Please sign in with your @vvce.ac.in account to accept the team invite.', 'info');
    if (document.getElementById('auth-screen')?.style.display !== 'none') {
      const emailInput = document.getElementById('login-email');
      if (emailInput) {
        emailInput.focus();
        showAuthMsg('Please sign in to join your team.', 'info');
      }
    }
    return;
  }

  const events = getDB('vvce_events');
  const ev = events.find(e => String(e.id) === String(eventId));
  if (!ev) {
    toast('Event not found or no longer active.', 'error');
    return;
  }
  const team = (ev.teams || []).find(t => String(t.id) === String(teamId));
  if (!team) {
    toast('Team not found or registration was removed.', 'error');
    return;
  }

  if ((ev.registrations || []).includes(STATE.user.id)) {
    toast('You are already registered for this event!', 'info');
    dismissTeamInviteBanner();
    return;
  }

  // Check email matches an invite
  const userEmail = (STATE.user.email || '').toLowerCase();
  const allowed = (team.pendingEmails || []).some(e => e.toLowerCase() === userEmail) || (team.memberEmails || []).some(e => e.toLowerCase() === userEmail);
  if (!allowed) {
    toast(`This invite was sent to team members (${team.memberEmails.join(', ')}). Your signed-in email is ${STATE.user.email}.`, 'error');
    return;
  }

  // Accept: register user, move from pending to memberIds
  if (!ev.registrations) ev.registrations = [];
  if (!ev.registrations.includes(STATE.user.id)) {
    ev.registrations.push(STATE.user.id);
    ev.regCount = (ev.regCount || 0) + 1;
  }
  if (!team.memberIds) team.memberIds = [];
  if (!team.memberIds.includes(STATE.user.id)) {
    team.memberIds.push(STATE.user.id);
  }
  if (team.pendingEmails) {
    team.pendingEmails = team.pendingEmails.filter(e => e.toLowerCase() !== userEmail);
  }

  await setDB('vvce_events', events);

  dismissTeamInviteBanner();

  addNotif(`You joined team "${team.name}" for "${ev.name}"! 🎉`, '👥');
  if (team.leaderId) {
    addNotifToUser(team.leaderId, `${STATE.user.name} accepted the invite and joined your team "${team.name}"! 🎉`, '👥');
  }
  toast(`Welcome to team "${team.name}"! You are now officially registered for ${ev.name}. 🎉`, 'success', 5000);

  if (STATE.page === 'events') filterEvents();
  if (STATE.page === 'dashboard') renderStudentDashboard();
  if (STATE.page === 'registrations') renderRegistrationsPage();
}

/* ─────────────────────────────────────────────────────────────
   TEAM MANAGEMENT & MEMBER ALTERATION
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

  const titleEl = document.getElementById('manage-team-title');
  const subEl = document.getElementById('manage-team-sub');
  if (titleEl) titleEl.textContent = `👥 Manage Team: ${team.name}`;
  if (subEl) subEl.textContent = `Event: ${ev.name} • Required: ${minTeam}–${maxTeam} members`;

  // Leader box
  const lName = document.getElementById('manage-team-leader-name');
  const lEmail = document.getElementById('manage-team-leader-email');
  if (lName) lName.textContent = team.leaderName || 'Team Leader';
  if (lEmail) lEmail.textContent = team.leaderEmail || '';

  // Status banner
  const statusBanner = document.getElementById('manage-team-status-banner');
  const pendingCount = (team.pendingEmails || []).length;
  const confirmedMembers = allUsers.filter(u => (team.memberIds || []).includes(u.id) && u.id !== team.leaderId);
  const totalEnrolled = (team.memberIds || []).length + pendingCount;

  if (statusBanner) {
    if (pendingCount > 0) {
      statusBanner.style.background = '#fffbeb';
      statusBanner.style.border = '1px solid #fde68a';
      statusBanner.style.color = '#b45309';
      statusBanner.innerHTML = `<strong>⏳ Registration Pending Teammate Verification:</strong> ${pendingCount} member(s) have not verified/joined yet. Registration remains pending until all invited members click their email invite links.`;
    } else {
      statusBanner.style.background = '#f0fdf4';
      statusBanner.style.border = '1px solid #bbf7d0';
      statusBanner.style.color = '#15803d';
      statusBanner.innerHTML = `<strong>✅ Team Ready & Confirmed:</strong> All ${totalEnrolled} team members have verified and joined!`;
    }
  }

  // Counts
  const cCount = document.getElementById('manage-team-confirmed-count');
  const pCount = document.getElementById('manage-team-pending-count');
  if (cCount) cCount.textContent = (team.memberIds || []).length;
  if (pCount) pCount.textContent = pendingCount;

  // Confirmed List
  const confirmedListEl = document.getElementById('manage-team-confirmed-list');
  if (confirmedListEl) {
    if (confirmedMembers.length === 0) {
      confirmedListEl.innerHTML = `<div style="font-size:12px; color:#9ca3af; font-style:italic; padding:6px 0;">No other members have joined yet.</div>`;
    } else {
      confirmedListEl.innerHTML = confirmedMembers.map(m => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:6px; font-size:13px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>👤</span>
            <div>
              <div style="font-weight:700; color:#1e293b;">${m.name}</div>
              <div style="font-size:11px; color:#64748b;">${m.email} ${m.usn ? `• ${m.usn}` : ''}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:11px; font-weight:700; color:#15803d; background:#dcfce7; border:1px solid #86efac; padding:3px 10px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;">✓ Added</span>
            ${isLeader ? `<button onclick="removeConfirmedTeamMember('${m.id}')" style="padding:4px 8px; background:#fee2e2; color:#ef4444; border:1px solid #fca5a5; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">Remove</button>` : ''}
          </div>
        </div>
      `).join('');
    }
  }

  // Pending List
  const pendingListEl = document.getElementById('manage-team-pending-list');
  if (pendingListEl) {
    if ((team.pendingEmails || []).length === 0) {
      pendingListEl.innerHTML = `<div style="font-size:12px; color:#15803d; font-weight:600; padding:6px 0;">🎉 All invited teammates have verified their emails and are Added!</div>`;
    } else {
      pendingListEl.innerHTML = (team.pendingEmails || []).map((email, idx) => {
        const memDetail = (team.pendingMembers || team.memberDetails || []).find(m => (typeof m === 'object' ? m.email : m).toLowerCase() === email.toLowerCase());
        const memName = memDetail?.name || '';
        return `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:#fffdf5; border:1px solid #fef08a; border-radius:8px; margin-bottom:6px; font-size:13px; flex-wrap:wrap; gap:6px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>✉️</span>
            <div>
              <div style="font-weight:600; color:#374151;">
                ${memName ? `<span style="color:#1e293b; font-weight:700;">${memName}</span> • ` : ''}<span>${email}</span>
              </div>
              <div style="font-size:11px; color:#b45309;">⏳ Awaiting Email Link Click</div>
            </div>
          </div>
          ${isLeader ? `
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="font-size:10.5px; font-weight:700; color:#b45309; background:#fef3c7; border:1px solid #fde68a; padding:2px 8px; border-radius:10px;">⏳ Pending</span>
              <button onclick="openMailtoVerification('${email}','${escapeStr(memName)}','${escapeStr(team.name)}','${escapeStr(ev.name)}','${team.id}','${ev.id}')" title="Send verification email to ${email} via College Webmail / Gmail" style="padding:4px 8px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">📧 Email</button>
              <button onclick="copyTeamInviteLink('${team.id}','${ev.id}','${escapeStr(memName||email)}')" title="Copy Direct Verification Link" style="padding:4px 8px; background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">📋 Copy Link</button>
              <button onclick="resendTeamInviteEmail('${email}')" title="Resend Magic Link Email" style="padding:4px 8px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">🔁 Resend</button>
              <button onclick="replaceTeamInvitePrompt('${email}')" title="Change to another teammate" style="padding:4px 8px; background:#f5f3ff; color:#7c3aed; border:1px solid #ddd6fe; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">✏️ Replace</button>
              <button onclick="removePendingTeamInvite('${email}')" title="Remove this invite" style="padding:4px 8px; background:#fee2e2; color:#ef4444; border:1px solid #fca5a5; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">🗑️</button>
            </div>
          ` : `
            <span style="font-size:10.5px; font-weight:700; color:#b45309; background:#fef3c7; border:1px solid #fde68a; padding:2px 8px; border-radius:10px;">⏳ Pending</span>
          `}
        </div>
      `;
      }).join('');
    }
  }

  // Add Member Section visibility & input reset
  const addSection = document.getElementById('manage-team-add-section');
  const errEl = document.getElementById('manage-team-err');
  const nameInput = document.getElementById('manage-team-new-name');
  const emailInput = document.getElementById('manage-team-new-email');
  if (nameInput) nameInput.value = '';
  if (emailInput) emailInput.value = '';
  if (errEl) errEl.style.display = 'none';
  if (addSection) {
    if (isLeader && totalEnrolled < maxTeam) {
      addSection.style.display = 'block';
    } else {
      addSection.style.display = 'none';
    }
  }

  openModal('modal-manage-team');
}

async function resendTeamInviteEmail(email) {
  if (!_currentManageEventId || !_currentManageTeamId) return;
  const events = getDB('vvce_events');
  const ev = events.find(e => String(e.id) === String(_currentManageEventId));
  if (!ev) return;
  const team = (ev.teams || []).find(t => String(t.id) === String(_currentManageTeamId));
  if (!team) return;

  const memDetail = (team.pendingMembers || team.memberDetails || []).find(m => (typeof m === 'object' ? m.email : m).toLowerCase() === email.toLowerCase());
  const memName = memDetail?.name || '';

  const siteUrl = window.location.origin + window.location.pathname;
  const inviteBase = `${siteUrl}?teamInvite=${team.id}&event=${ev.id}`;

  const sb = getSupabaseClient();
  try {
    if (sb && sb.auth) {
      await sb.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: inviteBase,
          data: { teamInvite: true, teamId: team.id, teamName: team.name, eventId: ev.id, eventName: ev.name, inviterName: STATE.user.name, memberName: memName }
        }
      });
    }
    toast(`Invite email resent to ${memName ? memName + ' (' + email + ')' : email}! 🚀`, 'success');
  } catch (err) {
    toast(`Could not resend email: ${err.message}`, 'error');
  }
}

async function replaceTeamInvitePrompt(oldEmail) {
  const events = getDB('vvce_events');
  const ev = events.find(e => String(e.id) === String(_currentManageEventId));
  if (!ev) return;
  const team = (ev.teams || []).find(t => String(t.id) === String(_currentManageTeamId));
  if (!team) return;

  const oldDetail = (team.pendingMembers || team.memberDetails || []).find(m => (typeof m === 'object' ? m.email : m).toLowerCase() === oldEmail.toLowerCase());
  const defaultOldName = oldDetail?.name || '';

  const newNameRaw = prompt(`Enter new teammate's name to replace ${defaultOldName ? defaultOldName + ' (' + oldEmail + ')' : oldEmail}:`, defaultOldName);
  if (!newNameRaw || !newNameRaw.trim()) return;
  const newName = newNameRaw.trim();

  const newEmailRaw = prompt(`Enter new @vvce.ac.in email for ${newName}:`);
  if (!newEmailRaw) return;
  const newEmail = newEmailRaw.trim().toLowerCase();

  if (!newEmail.endsWith('@vvce.ac.in')) {
    toast('Only @vvce.ac.in email addresses are allowed.', 'error');
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

  // Replace email in pendingEmails & memberEmails
  team.pendingEmails = (team.pendingEmails || []).map(e => e.toLowerCase() === oldEmail.toLowerCase() ? newEmail : e);
  team.memberEmails = (team.memberEmails || []).map(e => e.toLowerCase() === oldEmail.toLowerCase() ? newEmail : e);

  if (!team.pendingMembers) team.pendingMembers = [];
  const pIdx = team.pendingMembers.findIndex(m => (typeof m === 'object' ? m.email : m).toLowerCase() === oldEmail.toLowerCase());
  if (pIdx >= 0) {
    team.pendingMembers[pIdx] = { name: newName, email: newEmail };
  } else {
    team.pendingMembers.push({ name: newName, email: newEmail });
  }

  if (!team.memberDetails) team.memberDetails = [];
  const dIdx = team.memberDetails.findIndex(m => (typeof m === 'object' ? m.email : m).toLowerCase() === oldEmail.toLowerCase());
  if (dIdx >= 0) {
    team.memberDetails[dIdx] = { name: newName, email: newEmail };
  } else {
    team.memberDetails.push({ name: newName, email: newEmail });
  }

  await setDB('vvce_events', events);

  // Dispatch invite email to new member
  const siteUrl = window.location.origin + window.location.pathname;
  const inviteBase = `${siteUrl}?teamInvite=${team.id}&event=${ev.id}`;
  const sb = getSupabaseClient();
  try {
    if (sb && sb.auth) {
      sb.auth.signInWithOtp({
        email: newEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: inviteBase,
          data: { teamInvite: true, teamId: team.id, teamName: team.name, eventId: ev.id, eventName: ev.name, inviterName: STATE.user.name, memberName: newName }
        }
      }).catch(e => console.warn('Invite email failed for', newEmail, e));
    }
  } catch(e) {}

  toast(`Replaced with ${newName} (${newEmail}) and sent verification invite! 🎉`, 'success');
  openManageTeamModal(_currentManageEventId, _currentManageTeamId);
  if (STATE.page === 'registrations') renderRegistrationsPage();
  if (STATE.page === 'dashboard') renderStudentDashboard();
}

async function removePendingTeamInvite(email) {
  if (!confirm(`Remove invite for ${email}?`)) return;
  const events = getDB('vvce_events');
  const ev = events.find(e => String(e.id) === String(_currentManageEventId));
  if (!ev) return;
  const team = (ev.teams || []).find(t => String(t.id) === String(_currentManageTeamId));
  if (!team) return;

  team.pendingEmails = (team.pendingEmails || []).filter(e => e.toLowerCase() !== email.toLowerCase());
  team.memberEmails = (team.memberEmails || []).filter(e => e.toLowerCase() !== email.toLowerCase());
  if (team.pendingMembers) {
    team.pendingMembers = team.pendingMembers.filter(m => (typeof m === 'object' ? m.email : m).toLowerCase() !== email.toLowerCase());
  }
  if (team.memberDetails) {
    team.memberDetails = team.memberDetails.filter(m => (typeof m === 'object' ? m.email : m).toLowerCase() !== email.toLowerCase());
  }

  await setDB('vvce_events', events);
  toast(`Invite for ${email} removed.`, 'info');
  openManageTeamModal(_currentManageEventId, _currentManageTeamId);
  if (STATE.page === 'registrations') renderRegistrationsPage();
  if (STATE.page === 'dashboard') renderStudentDashboard();
}

async function removeConfirmedTeamMember(memberId) {
  if (!confirm('Are you sure you want to remove this member from your team?')) return;
  const events = getDB('vvce_events');
  const ev = events.find(e => String(e.id) === String(_currentManageEventId));
  if (!ev) return;
  const team = (ev.teams || []).find(t => String(t.id) === String(_currentManageTeamId));
  if (!team) return;

  const allUsers = getDB('vvce_users', []);
  const removedUser = allUsers.find(u => u.id === memberId);

  team.memberIds = (team.memberIds || []).filter(id => id !== memberId);
  if (removedUser) {
    team.memberEmails = (team.memberEmails || []).filter(e => e.toLowerCase() !== removedUser.email.toLowerCase());
    if (team.memberDetails) {
      team.memberDetails = team.memberDetails.filter(m => (typeof m === 'object' ? m.email : m).toLowerCase() !== removedUser.email.toLowerCase());
    }
  }
  ev.registrations = (ev.registrations || []).filter(id => id !== memberId);
  ev.regCount = Math.max(0, (ev.regCount || 1) - 1);

  await setDB('vvce_events', events);
  if (removedUser) {
    addNotifToUser(memberId, `You were removed from team "${team.name}" for "${ev.name}" by the team leader.`, '👥');
  }
  toast('Member removed from team.', 'info');
  openManageTeamModal(_currentManageEventId, _currentManageTeamId);
  if (STATE.page === 'registrations') renderRegistrationsPage();
  if (STATE.page === 'dashboard') renderStudentDashboard();
}

async function manageTeamAddMember() {
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
  if (!email) {
    if (errEl) { errEl.textContent = '❌ Please enter teammate\'s @vvce.ac.in email.'; errEl.style.display = 'block'; }
    emailInput?.focus();
    return;
  }
  if (!email.endsWith('@vvce.ac.in')) {
    if (errEl) { errEl.textContent = '❌ Only @vvce.ac.in email addresses are allowed.'; errEl.style.display = 'block'; }
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

  if (!team.pendingEmails) team.pendingEmails = [];
  if (!team.memberEmails) team.memberEmails = [];
  if (!team.pendingMembers) team.pendingMembers = [];
  if (!team.memberDetails) team.memberDetails = [];

  team.pendingEmails.push(email);
  team.memberEmails.push(email);
  team.pendingMembers.push({ name, email });
  team.memberDetails.push({ name, email });

  await setDB('vvce_events', events);

  // Send invite
  const siteUrl = window.location.origin + window.location.pathname;
  const inviteBase = `${siteUrl}?teamInvite=${team.id}&event=${ev.id}`;
  const sb = getSupabaseClient();
  let emailDispatched = false;
  try {
    if (sb && sb.auth) {
      const res = await sb.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: inviteBase,
          data: { teamInvite: true, teamId: team.id, teamName: team.name, eventId: ev.id, eventName: ev.name, inviterName: STATE.user.name, memberName: name }
        }
      });
      if (res && res.error) {
        console.warn('Supabase OTP invite email warning for', email, res.error);
        if (res.error.status === 429 || res.error.message?.includes('rate limit') || res.error.code === 'over_email_send_rate_limit') {
          toast(`⚠️ Notice: Supabase default email rate limit reached (3/hr). Verification link created! Share it via the "📋 Copy Link" button.`, 'warning', 8000);
        } else {
          toast(`⚠️ Email delivery notice: ${res.error.message}. You can copy the invite link directly.`, 'info', 6000);
        }
      } else {
        emailDispatched = true;
        toast(`Invite email sent to ${name} (${email})! 🎉`, 'success');
      }
    }
  } catch(e) {
    console.warn('Invite error:', e);
  }

  if (!emailDispatched && (!sb || !sb.auth)) {
    toast(`Added ${name}! Use "📋 Copy Link" to share their verification link.`, 'success');
  }

  if (nameInput) nameInput.value = '';
  if (emailInput) emailInput.value = '';
  openManageTeamModal(_currentManageEventId, _currentManageTeamId);
  if (STATE.page === 'registrations') renderRegistrationsPage();
  if (STATE.page === 'dashboard') renderStudentDashboard();
}

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
  if (window.sb) {
    window.sb.from('events').update({ waitlist: ev.waitlist }).eq('id', id);
  }
  addNotif(`You have been added to the waitlist for ${ev.name}. You will be notified if a slot opens up.`, '⏳');
  toast('Added to waitlist! You will be notified if a seat opens up.', 'success');
  if (STATE.page === 'events') renderEventsPage();
  else if (STATE.page === 'clubs') renderClubsDirectoryPage();
}

let currentPaymentEvent = null;

function openPaymentModal(ev) {
  currentPaymentEvent = ev;
  document.getElementById('pmt-ev-name').textContent = ev.name;
  document.getElementById('pmt-amount').textContent = `₹${ev.fee}`;
  
  const upiEl = document.getElementById('pmt-upi-id');
  if (ev.adminUpiId) {
    upiEl.textContent = ev.adminUpiId;
    upiEl.style.color = '#10b981';
  } else {
    upiEl.textContent = 'Not configured — contact the club directly';
    upiEl.style.color = '#ef4444';
  }
  
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
  
  const paymentObj = {
    uid: STATE.user.id,
    screenshot: b64,
    date: new Date().toISOString()
  };

  if (STATE.pendingTeamReg && STATE.pendingTeamReg.evId === ev.id) {
    paymentObj.teamData = STATE.pendingTeamReg;
    STATE.pendingTeamReg = null;
  }

  dbEv.pendingPayments.push(paymentObj);
  
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
  
  if (ev.isTeamEvent && ev.teams) {
    ev.teams.forEach(t => {
      if (t.memberIds && t.memberIds.includes(STATE.user.id)) {
        t.memberIds = t.memberIds.filter(uid => uid !== STATE.user.id);
        if (STATE.user.email && t.pendingEmails && !t.pendingEmails.includes(STATE.user.email.toLowerCase())) {
          t.pendingEmails.push(STATE.user.email.toLowerCase());
        }
      }
    });
  }

  setDB('vvce_events', events);
  toast('Unregistered from event.','info');
  if (STATE.page==='events') filterEvents();
  if (STATE.page==='dashboard') renderStudentDashboard();
  if (STATE.page==='registrations') renderRegistrationsPage();
}

function openEventModal(id) {
  const ev   = getDB('vvce_events').find(e => e.id === id);
  if (!ev) return;
  const user  = STATE.user;
  const isReg = (ev.registrations||[]).includes(user?.id);
  const isFull= ev.regCount >= ev.maxParticipants;

  let teamInfoHtml = '';
  if (ev.isTeamEvent && (ev.teams || []).length > 0 && user) {
    const myTeam = (ev.teams || []).find(t => t.leaderId === user.id || (t.memberIds || []).includes(user.id) || (t.pendingEmails || []).includes((user.email||'').toLowerCase()));
    if (myTeam) {
      const isLeader = myTeam.leaderId === user.id;
      const isConfirmed = isLeader || (myTeam.memberIds || []).includes(user.id);
      const pendingCount = (myTeam.pendingEmails || []).length;
      const confirmedCount = (myTeam.memberIds || []).length;
      const totalTeam = confirmedCount + pendingCount;

      const allUsers = getDB('vvce_users', []);
      const confirmedUsers = allUsers.filter(u => (myTeam.memberIds || []).includes(u.id));

      teamInfoHtml = `
        <div style="background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:12px;padding:14px 16px;margin-bottom:1rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span style="font-weight:800;color:#6d28d9;font-size:14px;">👥 Team: ${myTeam.name}</span>
            <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px;background:${isLeader ? '#7c3aed;color:#fff;' : '#ede9fe;color:#6d28d9;'}">${isLeader ? '👑 Team Leader' : (isConfirmed ? '👤 Verified Member' : '⏳ Invited Member')}</span>
          </div>

          <div style="font-size:12px;color:#4b5563;margin-bottom:10px;">
            Leader: <strong>${myTeam.leaderName}</strong> &bull; Roster Status: <span style="font-weight:700;color:${pendingCount === 0 ? '#10b981' : '#f59e0b'}">${pendingCount === 0 ? '✅ All ' + totalTeam + ' Members Added & Confirmed' : '⏳ ' + confirmedCount + '/' + totalTeam + ' Members Added (' + pendingCount + ' Pending Verification)'}</span>
          </div>

          <!-- Team Roster Badges -->
          <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;">
            <!-- Leader -->
            <div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #e2e8f0;padding:6px 10px;border-radius:8px;font-size:12px;">
              <span style="font-weight:600;color:#1e293b;">👑 ${myTeam.leaderName} <span style="font-size:11px;color:#64748b;">(${myTeam.leaderEmail})</span></span>
              <span style="font-size:10.5px;font-weight:700;color:#15803d;background:#dcfce7;border:1px solid #86efac;padding:2px 8px;border-radius:10px;">✓ Leader (Added)</span>
            </div>

            <!-- Confirmed Members -->
            ${confirmedUsers.filter(u => u.id !== myTeam.leaderId).map(u => `
              <div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #e2e8f0;padding:6px 10px;border-radius:8px;font-size:12px;">
                <span style="font-weight:600;color:#1e293b;">👤 ${u.name} <span style="font-size:11px;color:#64748b;">(${u.email})</span></span>
                <span style="font-size:10.5px;font-weight:700;color:#15803d;background:#dcfce7;border:1px solid #86efac;padding:2px 8px;border-radius:10px;">✓ Added</span>
              </div>
            `).join('')}

            <!-- Pending Members -->
            ${(myTeam.pendingEmails || []).map(email => {
              const det = (myTeam.pendingMembers || myTeam.memberDetails || []).find(d => (typeof d === 'object' ? d.email : d).toLowerCase() === email.toLowerCase());
              const name = det?.name || '';
              return `
                <div style="display:flex;align-items:center;justify-content:space-between;background:#fffdf5;border:1px solid #fef08a;padding:6px 10px;border-radius:8px;font-size:12px;">
                  <span style="font-weight:500;color:#78350f;">✉️ ${name ? `<strong style="color:#1e293b;">${name}</strong> • ` : ''}${email}</span>
                  <span style="font-size:10.5px;font-weight:700;color:#b45309;background:#fef3c7;border:1px solid #fde68a;padding:2px 8px;border-radius:10px;">⏳ Invite Pending</span>
                </div>
              `;
            }).join('')}
          </div>

          ${pendingCount === 0 ? `
            <div style="font-size:11.5px;font-weight:700;color:#15803d;background:#f0fdf4;border:1px solid #bbf7d0;padding:6px 10px;border-radius:6px;margin-top:6px;">
              ✅ All team members have verified via email and are confirmed as added!
            </div>
          ` : `
            <div style="font-size:11.5px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;padding:6px 10px;border-radius:6px;margin-top:6px;">
              ⏳ <strong>Pending Verification:</strong> When invited members click their email links, their status turns green as <strong>Added</strong>.
            </div>
          `}

          ${isLeader ? `
            <div style="margin-top:10px;">
              <button onclick="closeModal('modal-event-detail');openManageTeamModal('${ev.id}','${myTeam.id}')" style="padding:6px 12px;background:#7c3aed;color:#fff;border:none;border-radius:6px;font-weight:700;font-size:11.5px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;">
                ✏️ Alter / Manage Team Members
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }
  }

  document.getElementById('modal-event-title').textContent = ev.name;
  document.getElementById('modal-event-body').innerHTML = `
    <div style="background:linear-gradient(135deg,#1e2a3d,#0f172a);border-radius:12px;height:160px;display:flex;align-items:center;justify-content:center;font-size:80px;margin-bottom:1.25rem;position:relative;overflow:hidden;">
      ${ev.poster?`<img src="${ev.poster}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;">`:`<span>${ev.emoji||'🎓'}</span>`}
    </div>
    ${teamInfoHtml}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1rem;">
      ${detailChip('📅','Date',formatDate(ev.date))}
      ${detailChip('🕐','Time',formatTime(ev.time))}
      ${detailChip('📍','Venue',ev.venue)}
      ${detailChip('👥','Capacity', ev.isTeamEvent ? `${(ev.teams||[]).length} teams (${ev.regCount}/${ev.maxParticipants} people)` : `${ev.regCount}/${ev.maxParticipants} seats`)}
      ${ev.isTeamEvent ? detailChip('👥','Team Size', `${ev.minTeamSize || 2}–${ev.maxTeamSize || 4} members`) : detailChip('👤','Event Type', 'Solo Event')}
      ${detailChip('⭐','AICTE Points',`${ev.points||0} pts`)}
      ${detailChip('🎓','Target Branches',(ev.branches && ev.branches.length > 0) ? (ev.branches.includes('All') ? 'All Branches' : ev.branches.join(', ')) : 'All Branches')}
      <div style="grid-column:1/-1;">${detailChip('💰','Fee',ev.fee>0?`₹${ev.fee}`:'FREE')}</div>
    </div>
    ${ev.desc?`
      <div style="background:#fffdf5;border:1.5px solid #fef08a;border-left:5px solid #f59e0b;border-radius:10px;padding:14px 16px;margin-bottom:1rem;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div style="font-size:11.5px;font-weight:800;color:#b45309;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
          📝 Event Description
        </div>
        <p style="font-size:13.5px;color:#1e293b;line-height:1.75;white-space:pre-line;margin:0;font-weight:500;">${ev.desc}</p>
      </div>`:''}
    ${ev.speakers?`<div style="font-size:12px;color:#6b7280;margin-bottom:10px;background:#f8fafc;padding:8px 12px;border-radius:6px;border:1px solid #e2e8f0;">🎙️ Speakers: <strong style="color:#111827;">${ev.speakers}</strong></div>`:''}
    ${ev.rules?`
      <div style="background:#fef2f2;border:1.5px solid #fecaca;border-left:5px solid #ef4444;border-radius:10px;padding:14px 16px;margin-bottom:1rem;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div style="font-size:11.5px;font-weight:800;color:#b91c1c;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
          ⚖️ Important Rules &amp; Guidelines
        </div>
        <p style="font-size:13.5px;color:#1e293b;line-height:1.75;white-space:pre-line;margin:0;font-weight:500;">${ev.rules}</p>
      </div>`:''}
    <div style="font-size:12px;color:#6b7280;margin-bottom:1rem;">Organized by: <strong style="color:#111827;">${ev.club}</strong></div>
    ${user?.type==='student' ? `
      <div style="display:flex;gap:10px;margin-top:6px;">
        ${isReg
          ? `<button onclick="unregisterEv('${ev.id}');closeModal('modal-event-detail')" class="btn btn-outline" style="flex:1;">Unregister</button>
             <div style="flex:2;padding:11px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;text-align:center;font-weight:700;font-size:14px;color:#15803d;">✓ You're Registered</div>`
          : STATE.registrationLocked
            ? `<div style="flex:1;padding:11px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;text-align:center;font-weight:700;color:#64748b;">🔒 Registrations Paused by Admin</div>`
            : isFull
              ? (ev.waitlist_enabled
                  ? `<button onclick="joinWaitlist('${ev.id}');closeModal('modal-event-detail')" style="flex:1;padding:11px;background:#f59e0b;border:none;border-radius:8px;font-weight:700;color:#fff;cursor:pointer;">⏳ Join Waitlist</button>`
                  : `<div style="flex:1;padding:11px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;text-align:center;font-weight:700;color:#991b1b;">Event Full</div>`)
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

