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
      <div class="sched-row" style="margin-bottom:10px;cursor:pointer;flex-direction:column;align-items:stretch;gap:8px;" onclick="openEventModal('${e.id}')">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span class="sched-emoji" style="font-size:32px;">${e.emoji||'🎓'}</span>
          <div class="sched-info" style="flex:1;min-width:200px;">
            <div class="sched-name" style="font-size:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              ${e.name}
              ${e.isTeamEvent && userTeam ? `
                <span style="font-size:11px;font-weight:700;background:#f5f3ff;color:#7c3aed;padding:2px 8px;border-radius:12px;border:1px solid #ddd6fe;">
                  👥 ${userTeam.name} ${isLeader ? '👑 (Leader)' : (isPendingInvite ? '⏳ (Invited)' : '👤 (Member)')}
                </span>
              ` : ''}
            </div>
            <div class="sched-meta">${e.club} &bull; ${formatDate(e.date)} • ${formatTime(e.time)} • ${e.venue}</div>
            ${status === 'rejected' && prog?.rejectionReason ? `
              <div style="font-size:11.5px;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;padding:4px 8px;border-radius:6px;margin-top:4px;font-weight:600;">
                ❌ Rejected: ${prog.rejectionReason}
              </div>` : ''}
            ${e.isTeamEvent && userTeam && pendingCount > 0 ? `
              <div style="font-size:11.5px;color:#d97706;font-weight:600;margin-top:3px;">
                ⚠️ Waiting for invite confirmation from: ${(userTeam.pendingEmails || []).map(email => {
                  const det = (userTeam.pendingMembers || userTeam.memberDetails || []).find(d => (typeof d === 'object' ? d.email : d).toLowerCase() === email.toLowerCase());
                  return det?.name ? `${det.name} (${email})` : email;
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

