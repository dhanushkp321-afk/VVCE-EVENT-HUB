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
