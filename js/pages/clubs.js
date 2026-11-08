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
            ${clubUser?.clubLogo ? `<img src="${clubUser.clubLogo}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">` : '🏛️'}
          </div>
          <div style="flex:1;">
            <h2 style="font-family:'Outfit',sans-serif; font-size:1.5rem; color:#1e293b; margin-bottom:4px;">${selectedClubName}</h2>
            <div style="display:flex; gap:12px; flex-wrap:wrap; font-size:13px; color:#64748b;">
              <span><strong>Domain:</strong> ${clubUser?.domain || 'Multi-disciplinary'}</span>
              <span>•</span>
              <span><strong>Faculty Coordinator:</strong> ${clubUser?.faculty || 'Faculty in Charge'}</span>
              <span>•</span>
              <span><strong>Total Events:</strong> ${clubEvents.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-bottom:1rem; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
        <button id="tab-club-up" class="btn" style="background:#4f46e5; color:#fff; padding:6px 14px; font-size:13px;" onclick="switchClubTab('upcoming', '${selectedClubName}')">Upcoming Events (${upcoming.length})</button>
        <button id="tab-club-past" class="btn" style="background:#f1f5f9; color:#475569; padding:6px 14px; font-size:13px;" onclick="switchClubTab('past', '${selectedClubName}')">Past & Completed (${past.length})</button>
      </div>

      <div class="event-grid" id="club-events-grid">
        ${upcoming.length > 0 ? upcoming.map(e => eventCard(e)).join('') : `<div class="empty-state" style="grid-column:1/-1; padding:3rem; text-align:center;"><div style="font-size:32px;">🗓️</div><p style="color:#64748b; margin-top:8px;">No upcoming events scheduled for ${selectedClubName}.</p></div>`}
      </div>
    `;
    return;
  }

  // Otherwise, render full Clubs Directory grid
  // Gather registered clubs
  const clubAdmins = users.filter(u => u.type === 'admin' && u.clubName);
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
          <div class="event-card" style="cursor:pointer;" onclick="renderClubsDirectoryPage('${c.clubName.replace(/'/g, "\\'")}')">
            <div style="padding:1.5rem; display:flex; flex-direction:column; justify-content:space-between; height:100%;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                  <div style="width:48px; height:48px; border-radius:10px; background:linear-gradient(135deg,#e0e7ff,#c7d2fe); color:#4338ca; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:700;">
                    ${c.clubLogo ? `<img src="${c.clubLogo}" style="width:100%; height:100%; object-fit:cover; border-radius:10px;">` : '🏛️'}
                  </div>
                  <span class="badge" style="background:#eef2ff; color:#4f46e5; border:1px solid #c7d2fe; font-size:11px; padding:3px 8px; border-radius:6px; font-weight:600;">${c.domain || 'Club'}</span>
                </div>
                <h3 style="font-family:'Outfit',sans-serif; font-size:1.15rem; color:#0f172a; margin-bottom:6px;">${c.clubName}</h3>
                <p style="font-size:12px; color:#64748b; margin-bottom:12px;">${c.desc ? c.desc.slice(0, 95) + '...' : 'Official student chapter at Vidyavardhaka College of Engineering.'}</p>
                <div style="font-size:12px; color:#475569; display:flex; flex-direction:column; gap:4px; margin-bottom:14px;">
                  <span>👤 <strong>Coordinator:</strong> ${c.faculty || 'Faculty in Charge'}</span>
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

function registerEv(id) {
  if (STATE.registrationLocked) {
    toast('Event registrations are temporarily paused by administration.', 'warning');
    return;
  }
  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  if ((ev.registrations||[]).includes(STATE.user.id)) { toast('Already registered!','info'); return; }

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

  // Team event → open team registration modal
  if (ev.isTeamEvent) {
    openTeamRegisterModal(ev);
    return;
  }

  if (ev.fee > 0) {
    openPaymentModal(ev);
  } else {
    completeRegistration(ev);
  }
}
