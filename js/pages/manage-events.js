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
