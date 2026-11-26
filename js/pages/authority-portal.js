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
        active.map(a => `<option value="${a.id}">${a.name} (${a.designation || 'Approving Authority'})</option>`).join('');
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
  // If target has stored salt and password_hash
  if (target.password_hash && target.salt) {
    isValid = await verifyPasswordWithSalt(pass, target.password_hash, target.salt);
  } else if (target.pass) {
    // Backward compatibility for raw test records
    isValid = (pass === target.pass);
  } else if (target.id === 'auth_dean_sw' && pass === 'deanwellfair@vvce') {
    isValid = true;
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
            <div class="cpcard-name" style="font-size:18px;">${c.clubName || c.name}</div>
            <div class="cpcard-domain">${c.domain || 'General'} • ${c.branch || 'VVCE'} • ${c.email}</div>
          </div>
          <span class="badge badge-amber">Pending Registration</span>
        </div>
        <div class="cpcard-info" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:8px; font-size:13px; color:#374151; margin:12px 0;">
          <span>👤 <strong>Lead Rep:</strong> ${titleCase(c.name)} (${c.usn || '-'})</span>
          <span>👩‍🏫 <strong>Faculty Coord:</strong> ${c.faculty || '-'}</span>
          <span>📧 <strong>Club Email:</strong> ${c.clubEmail || '-'}</span>
          <span>📞 <strong>Contact Phone:</strong> ${c.phone || '-'}</span>
        </div>
        ${c.desc ? `<div style="font-size:13px; color:#334155; background:#f8fafc; padding:10px 14px; border-radius:8px; margin-bottom:12px; border:1px solid #e2e8f0;">${c.desc}</div>` : ''}
        
        <!-- Decision Actions -->
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <button class="btn btn-green" onclick="authorityApproveClub('${c.id}')">✓ Approve Club Registration</button>
          <button class="btn btn-red" onclick="authorityRejectClubPrompt('${c.id}')">✕ Reject with Reason</button>
          <button class="btn btn-outline" onclick="viewClubDetail('${c.id}')">View Full Dossier</button>
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
              <div class="ev-row-name">${c.clubName || c.name}</div>
              <div class="ev-row-meta">${c.domain || 'General'} • Rep: ${titleCase(c.name)} • Coord: ${c.faculty || '-'}</div>
            </div>
            <span class="badge badge-green">Active</span>
            <button class="btn btn-outline btn-sm" onclick="viewClubDetail('${c.id}')">Dossier</button>
            <button class="btn btn-red btn-sm" onclick="authorityRevokeClub('${c.id}')">Revoke Access</button>
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
                GLOBAL VENUE CLASH WARNING: Conflicting approved event "${conflict.name}" (${conflict.club}) is already booked at ${e.venue} on ${formatDate(e.date)} (${formatEventTimeSlot(conflict)}). Approval is blocked.
              </div>
            </div>
          ` : ''}

          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
            <div style="display:flex; gap:14px; align-items:flex-start;">
              <span style="font-size:40px;">${e.emoji || '🎓'}</span>
              <div>
                <div style="font-weight:800; font-size:18px; color:#0f172a;">${e.name}</div>
                <div style="font-size:13px; color:#64748b; margin-top:2px;">Organized by <strong>${e.club}</strong></div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:6px 16px; margin-top:10px; font-size:12.5px; color:#334155;">
                  <span>📅 <strong>Date:</strong> ${formatDate(e.date)}</span>
                  <span>🕐 <strong>Time:</strong> ${formatTime(e.time)}</span>
                  <span>📍 <strong>Venue:</strong> ${e.venue}</span>
                  <span>👥 <strong>Max Part:</strong> ${e.maxParticipants}</span>
                  <span>💰 <strong>Fee:</strong> ${e.fee > 0 ? '₹' + e.fee : 'Free'}</span>
                </div>
                ${e.desc ? `<div style="font-size:13px; color:#475569; margin-top:10px; line-height:1.5; background:#f8fafc; padding:10px 12px; border-radius:8px;">${e.desc}</div>` : ''}
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
      <span class="ev-row-emoji">${e.emoji || '🎓'}</span>
      <div class="ev-row-info">
        <div class="ev-row-name" style="font-weight:700;">${e.name}</div>
        <div class="ev-row-meta">${e.club} • ${formatDate(e.date)} • 📍 ${e.venue}</div>
        ${e.rejReason ? `<div style="font-size:11px; color:#dc2626; margin-top:2px;">Rejection Note: ${e.rejReason}</div>` : ''}
      </div>
      <span class="badge ${e.status==='approved'?'badge-green':e.status==='pending'?'badge-amber':'badge-red'}">
        ${e.status.toUpperCase()}
      </span>
      ${e.status==='pending' ? `
        <button class="btn btn-green btn-sm" onclick="authorityApproveEvent('${e.id}')">Approve</button>
        <button class="btn btn-red btn-sm" onclick="authorityRejectEventPrompt('${e.id}')">Reject</button>
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
                <h4 style="font-size:16px; font-weight:800; margin:0; color:#0f172a;">${c.clubName || c.name}</h4>
                <div style="font-size:12px; color:#64748b;">${c.domain || 'Technical'} • Coord: ${c.faculty || '-'}</div>
              </div>
              <span class="badge ${c.approved ? 'badge-green' : 'badge-amber'}">${c.approved ? 'Approved' : 'Pending'}</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; background:#f8fafc; padding:8px 10px; border-radius:8px; margin:10px 0; text-align:center; font-size:11px;">
              <div><strong style="color:#10b981; font-size:14px;">${appCount}</strong><br>Approved</div>
              <div><strong style="color:#f59e0b; font-size:14px;">${pendCount}</strong><br>Pending</div>
              <div><strong style="color:#ef4444; font-size:14px;">${rejCount}</strong><br>Rejected</div>
            </div>
            <div style="font-size:12px; color:#475569; margin-bottom:10px;">
              <div>👤 <strong>Representative:</strong> ${titleCase(c.name)} (${c.usn || '-'})</div>
              <div>📧 <strong>Contact:</strong> ${c.clubEmail || c.email}</div>
            </div>
            <button class="btn btn-outline btn-sm" style="width:100%;" onclick="viewClubDetail('${c.id}')">View Club Details & History</button>
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

  await setDB('vvce_users', users);

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

  await setDB('vvce_users', users);
  toast('Club registration rejected.', 'warning');
  renderAuthorityPortal('club-approvals');
};

window.authorityRevokeClub = async function(id) {
  if (!confirm('Are you sure you want to revoke this club\'s active status?')) return;
  const users = getDB('vvce_users');
  const club = users.find(u => u.id === id);
  if (!club) return;

  club.approved = false;
  await setDB('vvce_users', users);
  toast('Club access revoked.', 'warning');
  renderAuthorityPortal('club-approvals');
};
