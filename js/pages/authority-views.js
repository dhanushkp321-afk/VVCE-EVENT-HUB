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
              <span style="font-size:36px;">${e.emoji||'🎓'}</span>
              <div>
                <div style="font-weight:800;font-size:16px;color:#111827;">${e.name}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:3px;">${e.club}</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:8px;font-size:12px;color:#374151;">
                  <span>📅 ${formatDate(e.date)}</span>
                  <span>🕐 ${formatTime(e.time)}</span>
                  <span>📍 ${e.venue}</span>
                  <span>👥 Max: ${e.maxParticipants}</span>
                  <span>💰 ${e.fee>0?`₹${e.fee}`:'Free'}</span>
                </div>
                ${e.desc?`<div style="font-size:12px;color:#374151;margin-top:8px;line-height:1.5;max-width:500px;">${e.desc}</div>`:''}
              </div>
            </div>
            ${canAct ? `
              <div style="display:flex;gap:8px;flex-shrink:0;">
                <button class="btn btn-green" onclick="authorityApproveEvent('${e.id}')">✓ Approve</button>
                <button class="btn btn-red" onclick="authorityRejectEventPrompt('${e.id}')">✕ Reject</button>
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
          <span class="ev-row-emoji">${e.emoji||'🎓'}</span>
          <div class="ev-row-info"><div class="ev-row-name">${e.name}</div><div class="ev-row-meta">${e.club} • ${formatDate(e.date)}</div></div>
          <span class="badge ${e.status==='approved'?'badge-green':'badge-red'}">${e.status}</span>
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
              <div style="font-weight:800;color:#0f172a;">${a.name}</div>
              <div style="color:#64748b;margin-top:2px;">🏛️ ${a.club} • ⏰ ${formatEventTimeSlot(a)}</div>
              <div style="margin-top:4px;"><span class="badge ${a.status==='approved'?'badge-green':'badge-amber'}">${a.status.toUpperCase()}</span></div>
            </div>
            <div style="background:#ffffff;border:1px solid #fca5a5;padding:10px;border-radius:8px;">
              <div style="font-weight:800;color:#0f172a;">${b.name}</div>
              <div style="color:#64748b;margin-top:2px;">🏛️ ${b.club} • ⏰ ${formatEventTimeSlot(b)}</div>
              <div style="margin-top:4px;"><span class="badge ${b.status==='approved'?'badge-green':'badge-amber'}">${b.status.toUpperCase()}</span></div>
            </div>
          </div>
          <div style="font-size:12px;font-weight:700;color:#991b1b;margin-top:8px;">📍 Venue: ${a.venue} &bull; 📅 Date: ${formatDate(a.date)}</div>
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
                      <span style="${hasClash ? 'color:#991b1b; font-weight:800;' : ''}">${e.name}</span>
                    </div>
                    ${hasClash ? `<div style="font-size:11px; font-weight:700; color:#b91c1c; margin-top:2px;">⚡ Clashes with: "${otherNames}"</div>` : ''}
                  </td>
                  <td>${e.club}</td>
                  <td style="${hasClash ? 'color:#991b1b; font-weight:700;' : ''}">${formatDate(e.date)}</td>
                  <td>${formatTime(e.time)}</td>
                  <td style="${hasClash ? 'color:#991b1b; font-weight:700;' : ''}">📍 ${e.venue}</td>
                  <td>
                    ${hasClash
                      ? `<span class="badge" style="background:#fecaca; color:#991b1b; border:1px solid #ef4444; font-weight:800;">⚠️ CLASH</span>`
                      : `<span class="badge ${e.status==='approved'?'badge-green':'badge-amber'}">${e.status}</span>`
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
          <div style="font-weight:800;font-size:13.5px;color:#b91c1c;margin-bottom:8px;">⚡ Conflict at ${a.venue} on ${formatDate(a.date)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
            <div style="background:rgba(255,255,255,0.85);padding:10px;border-radius:8px;border:1px solid #fca5a5;">
              <strong style="color:#0f172a;">${a.name}</strong><br>
              <span style="color:#64748b;">${a.club} • ${formatEventTimeSlot(a)}</span>
              <div style="margin-top:4px;"><span class="badge ${a.status==='approved'?'badge-green':'badge-amber'}">${a.status.toUpperCase()}</span></div>
            </div>
            <div style="background:rgba(255,255,255,0.85);padding:10px;border-radius:8px;border:1px solid #fca5a5;">
              <strong style="color:#0f172a;">${b.name}</strong><br>
              <span style="color:#64748b;">${b.club} • ${formatEventTimeSlot(b)}</span>
              <div style="margin-top:4px;"><span class="badge ${b.status==='approved'?'badge-green':'badge-amber'}">${b.status.toUpperCase()}</span></div>
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
                      <span style="${hasClash ? 'color:#991b1b; font-weight:800;' : ''}">${e.name}</span>
                    </div>
                    ${hasClash ? `<div style="font-size:11px; font-weight:700; color:#b91c1c; margin-top:2px;">⚡ Clashes with: "${otherNames}"</div>` : ''}
                  </td>
                  <td>${e.club}</td>
                  <td style="${hasClash ? 'color:#991b1b; font-weight:700;' : ''}">${formatDate(e.date)}</td>
                  <td>${formatTime(e.time)}</td>
                  <td style="${hasClash ? 'color:#991b1b; font-weight:700;' : ''}">📍 ${e.venue}</td>
                  <td>
                    ${hasClash
                      ? `<span class="badge" style="background:#fecaca; color:#991b1b; border:1px solid #ef4444; font-weight:800;">⚠️ CLASH</span>`
                      : `<span class="badge ${e.status==='approved'?'badge-green':'badge-amber'}">${e.status}</span>`
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

