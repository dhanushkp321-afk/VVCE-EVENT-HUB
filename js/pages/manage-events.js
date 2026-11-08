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
        const clash = allScheduled.find(o => o.id !== e.id && o.date === e.date && (o.venue||'').toLowerCase().trim() === (e.venue||'').toLowerCase().trim());
        return `
        <div class="ev-row" style="${clash ? 'border-left: 4.5px solid #ef4444; background: #fff8f8; box-shadow: 0 2px 8px rgba(239,68,68,0.1);' : ''}">
          <span class="ev-row-emoji">${e.emoji||'🎓'}</span>
          <div class="ev-row-info">
            <div class="ev-row-name">
              ${clash ? '<span style="color:#ef4444; font-weight:800;">⚠️ </span>' : ''}${e.name}
            </div>
            <div class="ev-row-meta">${formatDate(e.date)} • ${e.venue} • ${e.isTeamEvent ? `👥 ${(e.teams||[]).length} teams (${e.regCount||0}/${e.maxParticipants})` : `👤 ${e.regCount||0}/${e.maxParticipants} registered`}</div>
            ${clash ? `<div style="font-size:11px;font-weight:700;color:#dc2626;background:#fee2e2;border:1px solid #fca5a5;padding:3px 8px;border-radius:6px;display:inline-block;margin-top:4px;">⚡ Venue Clash with "${clash.name}" (${clash.club}) on ${formatDate(e.date)} at ${e.venue}</div>` : ''}
            ${e.rejReason?`<div style="font-size:11px;color:#dc2626;margin-top:3px;">Rejected: ${e.rejReason}</div>`:''}
          </div>
          <span class="badge ${clash ? 'badge-red' : (e.status==='approved'?'badge-green':e.status==='pending'?'badge-amber':e.status==='draft'?'badge-gray':'badge-red')}">${clash ? '⚠️ CLASH' : e.status}</span>
          <div class="ev-row-acts">
            <button class="btn btn-outline" onclick="openEventModal('${e.id}')">View</button>
            ${e.status==='draft'?`<button class="btn btn-gold" onclick="submitDraftEvent('${e.id}')">Submit</button>`:''}
          </div>
        </div>`;
      }).join('')
      : `<div class="empty-state"><div class="ei">📅</div><div class="et">No events yet</div><div class="es">Create your first event to get started.</div><button class="btn btn-gold" style="margin-top:12px;" onclick="showPage('create-event')">Create Event</button></div>`
    }
  `;
  syncEventsFromSupabase().then(fresh => {
    const freshCount = fresh.filter(e => e.adminId === STATE.user.id).length;
    if (freshCount !== events.length && STATE.page === 'manage-events') {
      renderManageEventsPage();
    }
  });
}

function submitDraftEvent(id) {
  const events=getDB('vvce_events'); const ev=events.find(e=>e.id===id);
  if(ev){
    ev.status='pending';
    setDB('vvce_events',events);
    toast(`Event "${ev.name}" submitted to Dean for approval! ✅`,'success');
    showPage('admin-dashboard');
  }
}
