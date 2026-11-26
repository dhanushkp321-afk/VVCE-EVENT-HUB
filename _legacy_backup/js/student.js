// ════════════════════════════════════════════════════════
// VVCE Events Hub — Student Dashboard & Pages
// ════════════════════════════════════════════════════════

function renderStudentDashboard() {
  const user       = STATE.currentUser;
  const myRegs     = Data.studentRegs(user.id);
  const myCerts    = Data.studentCerts(user.id);
  const upcoming   = myRegs.filter(e => new Date(e.date) >= new Date()).slice(0, 3);
  const allEvents  = Data.approvedEvents();
  const recommended= allEvents.filter(e =>
    (user.interests || []).some(i => e.category.toLowerCase().includes(i.toLowerCase())) &&
    !(e.registrations || []).includes(user.id)
  ).slice(0, 3);
  const certPts    = myCerts.reduce((s, c) => s + (c.points || 0), 0);
  const totalPts   = certPts + (user.points || 0);
  const pct        = Math.min(100, Math.round(totalPts / 100 * 100));

  const page = document.getElementById('page-dashboard');
  page.innerHTML = `
    <!-- Welcome Banner -->
    <div class="welcome-banner">
      <div>
        <div class="welcome-greeting">Good ${getGreeting()}, ${titleCase(user.name.split(' ')[0])} 👋</div>
        <div class="welcome-sub">${user.branch} • ${user.year} • ${user.sem} • Section ${user.section}</div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
          ${(user.interests||[]).map(i=>`<span style="padding:3px 10px;background:rgba(108,99,255,0.15);border-radius:20px;font-size:11px;color:var(--accent);font-weight:600;">${i}</span>`).join('')}
        </div>
      </div>
      <div class="welcome-stats">
        <div class="welcome-stat"><div class="welcome-stat-val" style="color:var(--accent)">${totalPts}</div><div class="welcome-stat-lbl">AICTE Points</div></div>
        <div class="welcome-stat"><div class="welcome-stat-val" style="color:var(--accent2)">${myRegs.length}</div><div class="welcome-stat-lbl">Registered</div></div>
        <div class="welcome-stat"><div class="welcome-stat-val" style="color:var(--gold2)">${myCerts.length}</div><div class="welcome-stat-lbl">Certificates</div></div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      ${statCard('🎯','AICTE Points',totalPts,`${pct}% of 100-pt target`,'var(--accent)')}
      ${statCard('📅','Events Registered',myRegs.length,`${upcoming.length} upcoming`,'var(--accent2)')}
      ${statCard('🏆','Certificates',myCerts.length,`${myCerts.filter(c=>c.type==='achievement').length} achievements`,'var(--gold)')}
      ${statCard('📋','Completed Events',myRegs.filter(e=>new Date(e.date)<new Date()).length,'With attendance','#a89eff')}
    </div>

    <div class="dash-grid">
      <div>
        <!-- AICTE Progress -->
        <div class="section-card">
          <div class="section-header">
            <div class="section-title">AICTE Activity Points</div>
            <span style="font-size:12px;color:var(--text3);">${totalPts}/100 target</span>
          </div>
          <div class="points-bar-wrap" style="margin-bottom:14px;height:10px;">
            <div class="points-bar" style="width:${pct}%;"></div>
          </div>
          <div class="sem-points-grid">
            ${Object.entries(user.pointsBySem||{}).slice(0,8).map(([sem,pts])=>`
              <div class="sem-card">
                <div style="font-family:'Outfit',sans-serif;font-size:22px;font-weight:800;color:var(--accent);">${pts}</div>
                <div style="font-size:10px;color:var(--text3);margin-top:2px;">${sem}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Recommended Events -->
        <div class="section-header" style="margin-top:1.5rem;">
          <div class="section-title">Recommended for You ✨</div>
          <button class="btn-sm btn-outline" onclick="showPage('events')">View All →</button>
        </div>
        <div class="event-feed" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr));">
          ${recommended.length
            ? recommended.map(e => renderEventCard(e)).join('')
            : `<div style="grid-column:1/-1;text-align:center;padding:2.5rem;color:var(--text3);background:rgba(255,255,255,0.02);border-radius:12px;border:1px dashed var(--border2);">
                <div style="font-size:32px;margin-bottom:8px;">🎯</div>
                <div>No new recommendations based on your interests.</div>
                <button class="btn-sm btn-accent" style="margin-top:12px;" onclick="showPage('events')">Browse All Events</button>
              </div>`
          }
        </div>
      </div>

      <div class="dash-side">
        <!-- Upcoming events -->
        <div class="section-title" style="margin-bottom:10px;">My Upcoming Events</div>
        ${upcoming.length
          ? upcoming.map(e=>`
            <div class="schedule-row" onclick="openEventModal('${e.id}')">
              <div style="font-size:26px;">${e.emoji}</div>
              <div class="schedule-info">
                <div class="schedule-event">${e.name}</div>
                <div class="schedule-venue">${formatDate(e.date)} • ${e.venue}</div>
              </div>
              <span class="attendance-tag att-present" style="white-space:nowrap;">✓ Reg.</span>
            </div>
          `).join('')
          : `<div class="empty-state-sm">📅<br>No upcoming events</div>`
        }

        <!-- Quick profile -->
        <div style="margin-top:1.5rem;">
          <div class="section-title" style="margin-bottom:10px;">My Profile</div>
          <div class="profile-quick-card">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
              ${renderAvatarEl(user, 48)}
              <div>
                <div style="font-weight:700;font-size:14px;color:var(--text1);">${titleCase(user.name)}</div>
                <div style="font-size:12px;color:var(--text3);">${user.usn}</div>
              </div>
            </div>
            ${user.bio ? `<div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:8px;">"${user.bio}"</div>` : ''}
            ${(user.skills||[]).length ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;">${user.skills.slice(0,4).map(s=>`<span class="skill-chip">${s}</span>`).join('')}</div>` : ''}
            <div style="display:flex;gap:6px;">
              ${user.linkedin?`<a href="https://${user.linkedin}" target="_blank" class="social-link">in</a>`:''}
              ${user.github?`<a href="https://${user.github}" target="_blank" class="social-link">gh</a>`:''}
            </div>
            <button class="btn-sm btn-outline" style="width:100%;margin-top:10px;" onclick="showPage('profile')">Full Profile →</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── EVENTS PAGE ───────────────────────────────────────────────────────────────
function renderEventsPage() {
  const page = document.getElementById('page-events');
  page.innerHTML = `
    <div class="filter-row">
      <input type="text" placeholder="🔍  Search events by name, club, description..." id="event-search" class="search-input" oninput="filterAndRenderEvents()">
      <select id="cat-filter" class="filter-select" onchange="filterAndRenderEvents()">
        <option value="">All Categories</option>
        <option value="Technical">Technical</option>
        <option value="Cultural">Cultural</option>
        <option value="Sports">Sports</option>
        <option value="Workshop">Workshop</option>
        <option value="Management">Management</option>
      </select>
      <select id="fee-filter" class="filter-select" onchange="filterAndRenderEvents()">
        <option value="">Any Fee</option>
        <option value="free">Free Events</option>
        <option value="paid">Paid Events</option>
      </select>
    </div>
    <div id="event-feed" class="event-feed"></div>
  `;
  filterAndRenderEvents();
}

function filterAndRenderEvents() {
  const search = (document.getElementById('event-search')?.value || '').toLowerCase();
  const cat    = document.getElementById('cat-filter')?.value  || '';
  const fee    = document.getElementById('fee-filter')?.value  || '';

  let events = Data.approvedEvents();
  if (search) events = events.filter(e =>
    e.name.toLowerCase().includes(search) ||
    e.club.toLowerCase().includes(search) ||
    e.description.toLowerCase().includes(search)
  );
  if (cat) events = events.filter(e => e.category === cat);
  if (fee === 'free') events = events.filter(e => e.fee === 0);
  if (fee === 'paid') events = events.filter(e => e.fee > 0);

  const feed = document.getElementById('event-feed');
  if (!feed) return;
  feed.innerHTML = events.length
    ? events.map(e => renderEventCard(e)).join('')
    : `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text3);">
        <div style="font-size:40px;margin-bottom:10px;">🔍</div>
        <div style="font-size:14px;">No events found. Try a different search.</div>
      </div>`;
}

function renderEventCard(event) {
  const user  = STATE.currentUser;
  const isReg = (event.registrations || []).includes(user?.id);
  const isFull= event.registeredCount >= event.maxParticipants;
  const catClass = { Technical:'cat-tech', Cultural:'cat-cultural', Sports:'cat-sports', Workshop:'cat-workshop', Management:'cat-management' }[event.category] || 'cat-tech';
  const gradients= { Technical:'linear-gradient(135deg,#0f1a3d,#0d2240)', Cultural:'linear-gradient(135deg,#3d1635,#1f0b28)', Sports:'linear-gradient(135deg,#0a2640,#091828)', Workshop:'linear-gradient(135deg,#3a2208,#221508)', Management:'linear-gradient(135deg,#251535,#150e25)' };
  return `
    <div class="event-card ${event.highlights?'highlighted-event':''}">
      <div class="event-poster" style="background:${gradients[event.category]||gradients.Technical};">
        <span style="font-size:54px;z-index:1;position:relative;">${event.emoji}</span>
        <span class="event-category-badge ${catClass}">${event.category}</span>
        ${event.highlights?`<span class="rec-badge">★ Recommended</span>`:''}
      </div>
      <div class="event-body">
        <div class="event-title">${event.name}</div>
        <div class="event-club">${event.club}</div>
        <div class="event-meta">
          <div class="event-meta-row">📅 ${formatDate(event.date)}</div>
          <div class="event-meta-row">🕐 ${formatTime(event.time)} &nbsp;|&nbsp; 📍 ${event.venue}</div>
          <div class="event-meta-row">⭐ ${event.points} AICTE pts &nbsp;|&nbsp; ${event.fee>0?`<span style="color:var(--gold2);">₹${event.fee}</span>`:`<span style="color:var(--accent2);">FREE</span>`}</div>
        </div>
        <div class="event-footer">
          <div class="seats ${isFull?'seats-full':''}">${isFull?'🔴 Event Full':`${event.maxParticipants-event.registeredCount} seats left`}</div>
          <div class="event-actions">
            <div class="action-icon" title="Details" onclick="openEventModal('${event.id}')">👁</div>
            ${user?.type==='student'
              ? isReg
                ? `<button class="btn-registered" onclick="unregisterEvent('${event.id}')">✓ Registered</button>`
                : isFull
                  ? `<button class="btn-register" style="opacity:.4;cursor:not-allowed;" disabled>Full</button>`
                  : `<button class="btn-register" onclick="doRegister('${event.id}')">Register</button>`
              : ''
            }
          </div>
        </div>
      </div>
    </div>`;
}

function doRegister(eventId) {
  const ok = Mutate.registerForEvent(STATE.currentUser.id, eventId);
  if (ok) {
    const ev = Data.eventById(eventId);
    Mutate.addNotif({ id:genId('n'), userId:STATE.currentUser.id, message:`Registration confirmed for ${ev.name}! 🎉`, time:'Just now', read:false, icon:'✅' });
    showToast('Successfully registered! 🎉', 'success');
    refreshCurrentPage();
  } else { showToast('Already registered for this event.', 'info'); }
}

function unregisterEvent(eventId) {
  Mutate.unregisterFromEvent(STATE.currentUser.id, eventId);
  showToast('Unregistered from event.', 'info');
  refreshCurrentPage();
}

function openEventModal(eventId) {
  const event = Data.eventById(eventId); if (!event) return;
  const user  = STATE.currentUser;
  const isReg = (event.registrations||[]).includes(user?.id);
  const isFull= event.registeredCount >= event.maxParticipants;
  const catClass={ Technical:'cat-tech', Cultural:'cat-cultural', Sports:'cat-sports', Workshop:'cat-workshop', Management:'cat-management' }[event.category]||'cat-tech';

  document.getElementById('modal-event-title').textContent = event.name;
  document.getElementById('modal-event-content').innerHTML = `
    <div style="background:linear-gradient(135deg,#0f1a3d,#0d2240);border-radius:14px;padding:2rem;text-align:center;margin-bottom:1.5rem;position:relative;">
      <div style="font-size:72px;">${event.emoji}</div>
      <span class="event-category-badge ${catClass}" style="position:absolute;top:12px;right:12px;">${event.category}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1rem;">
      ${detailChip('📅','Date',formatDate(event.date))}
      ${detailChip('🕐','Time',formatTime(event.time))}
      ${detailChip('📍','Venue',event.venue)}
      ${detailChip('👥','Seats',`${event.registeredCount}/${event.maxParticipants}`)}
      ${detailChip('⭐','AICTE Points',event.points+' pts')}
      ${detailChip('💰','Entry Fee',event.fee>0?'₹'+event.fee:'FREE')}
    </div>
    <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:14px;margin-bottom:1rem;">
      <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px;">About</div>
      <p style="font-size:13px;color:var(--text2);line-height:1.7;">${event.description}</p>
    </div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:1rem;">Organized by: <strong style="color:var(--text1);">${event.club}</strong></div>
    ${user?.type==='student'?`
      <div style="display:flex;gap:10px;">
        ${isReg
          ? `<button onclick="unregisterEvent('${event.id}');closeModal('event-modal')" class="btn-danger-outline">Unregister</button>
             <div class="btn-success-static">✓ You're Registered</div>`
          : isFull
            ? `<div class="btn-full-static">Event is Full</div>`
            : `<button onclick="doRegister('${event.id}');closeModal('event-modal')" class="btn-primary" style="flex:1;">Register Now →</button>`
        }
      </div>`:''
    }
  `;
  openModal('event-modal');
}

function detailChip(icon, label, value) {
  return `<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border2);border-radius:10px;padding:12px;"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:700;margin-bottom:4px;">${icon} ${label}</div><div style="font-size:14px;color:var(--text1);font-weight:600;">${value}</div></div>`;
}

// ── CALENDAR PAGE ─────────────────────────────────────────────────────────────
function renderCalendarPage() {
  document.getElementById('page-calendar').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 300px;gap:1.5rem;">
      <div>
        <div class="calendar-wrapper">
          <div class="cal-header">
            <div class="section-title" id="cal-month-title"></div>
            <div class="cal-nav">
              <button onclick="changeCalMonth(-1)">‹</button>
              <button onclick="changeCalMonth(1)">›</button>
            </div>
          </div>
          <div class="cal-grid" id="calendar-grid"></div>
          <div class="cal-legend">
            <div class="legend-item"><div class="legend-dot" style="background:linear-gradient(135deg,var(--accent),#9b5de5)"></div>Today</div>
            <div class="legend-item"><div class="legend-dot" style="background:var(--accent2)"></div>Event</div>
            <div class="legend-item"><div class="legend-dot" style="background:var(--accent3)"></div>Holiday</div>
            <div class="legend-item"><div class="legend-dot" style="background:var(--accent4)"></div>Exam</div>
          </div>
        </div>
      </div>
      <div>
        <div class="section-header"><div class="section-title">Events on Date</div></div>
        <div id="date-events"><p style="color:var(--text3);font-size:13px;padding:12px;background:rgba(255,255,255,0.02);border-radius:10px;">Click a date to view events</p></div>
        <div style="margin-top:1.5rem;">
          <div class="section-header"><div class="section-title">Academic Schedule</div></div>
          <div id="academic-schedule"></div>
        </div>
      </div>
    </div>
  `;
  renderCalendar();
  renderAcademicSchedule();
}

// ── CERTIFICATES PAGE ─────────────────────────────────────────────────────────
function renderCertificatesPage() {
  const user  = STATE.currentUser;
  const certs = Data.studentCerts(user.id);
  const certPts = certs.reduce((s,c)=>s+(c.points||0),0);
  const total   = certPts + (user.points||0);

  document.getElementById('page-certificates').innerHTML = `
    <div class="section-header">
      <div class="section-title">My Certificates (${certs.length})</div>
      <button class="btn-sm btn-outline" onclick="openModal('upload-cert-modal')">+ Upload Certificate</button>
    </div>
    <div style="background:linear-gradient(135deg,rgba(108,99,255,0.1),rgba(0,212,170,0.06));border:1px solid rgba(108,99,255,0.2);border-radius:16px;padding:1.5rem;margin-bottom:1.5rem;display:flex;align-items:center;gap:2rem;flex-wrap:wrap;">
      <div style="text-align:center;">
        <div style="font-family:'Outfit',sans-serif;font-size:42px;font-weight:900;color:var(--accent);">${total}</div>
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;font-weight:700;">Total AICTE Points</div>
      </div>
      <div style="width:1px;height:60px;background:var(--border2);"></div>
      <div style="flex:1;min-width:180px;">
        <div style="font-size:13px;color:var(--text2);margin-bottom:6px;">Progress to AICTE Target (100 pts)</div>
        <div class="points-bar-wrap"><div class="points-bar" style="width:${Math.min(100,total)}%;"></div></div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;">${total}/100 points</div>
      </div>
      <div style="display:flex;gap:20px;">
        <div style="text-align:center;"><div style="font-size:24px;font-weight:800;font-family:'Outfit',sans-serif;color:var(--gold2);">${certs.filter(c=>c.type==='achievement').length}</div><div style="font-size:11px;color:var(--text3);">Achievements</div></div>
        <div style="text-align:center;"><div style="font-size:24px;font-weight:800;font-family:'Outfit',sans-serif;color:var(--accent2);">${certs.filter(c=>c.type==='participation').length}</div><div style="font-size:11px;color:var(--text3);">Participation</div></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
      ${certs.length
        ? certs.map(c=>`
          <div class="certificate-card">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px;">
              <span class="cert-type-badge" style="color:${c.type==='achievement'?'var(--gold2)':'var(--accent)'};">${c.type==='achievement'?'🏆 Achievement':'🎖 Participation'}</span>
              ${c.verified?`<span class="verified-badge">✓ Verified</span>`:`<span class="pending-badge">⏳ Pending</span>`}
            </div>
            <div class="cert-event">${c.eventName}</div>
            <div class="cert-student">${c.club}</div>
            <div style="font-size:12px;color:var(--text3);margin-bottom:12px;">${formatDate(c.date)} &nbsp;•&nbsp; ${c.position}</div>
            <div class="cert-points"><span>⭐ ${c.points} AICTE Points</span></div>
            <div class="cert-footer">
              <span style="font-size:12px;color:var(--text3);">${c.position}</span>
              <button class="cert-btn" onclick="showToast('PDF download coming soon!','info')">Download PDF</button>
            </div>
          </div>
        `).join('')
        : `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text3);">
            <div style="font-size:40px;margin-bottom:10px;">📜</div>
            <div>No certificates yet. Participate in events to earn them!</div>
            <button class="btn-sm btn-accent" style="margin-top:1rem;" onclick="showPage('events')">Browse Events →</button>
          </div>`
      }
    </div>
  `;
}

// ── REGISTRATIONS PAGE ────────────────────────────────────────────────────────
function renderRegistrationsPage() {
  const user  = STATE.currentUser;
  const all   = Data.studentRegs(user.id);
  const now   = new Date();
  const upcoming  = all.filter(e => new Date(e.date) >= now);
  const completed = all.filter(e => new Date(e.date) < now);

  document.getElementById('page-registrations').innerHTML = `
    <div class="tabs" id="reg-tabs">
      <button class="tab active" onclick="switchRegTab(this,'upcoming-regs')">Upcoming (${upcoming.length})</button>
      <button class="tab" onclick="switchRegTab(this,'completed-regs')">Past Events (${completed.length})</button>
    </div>
    <div id="upcoming-regs">${renderRegList(upcoming, false)}</div>
    <div id="completed-regs" style="display:none;">${renderRegList(completed, true)}</div>
  `;
}

function renderRegList(events, past) {
  if (!events.length) return `
    <div style="text-align:center;padding:3rem;color:var(--text3);">
      <div style="font-size:40px;margin-bottom:10px;">📋</div>
      <div>${past?'No past events.':'No upcoming registered events.'}</div>
      ${!past?`<button class="btn-sm btn-accent" style="margin-top:1rem;" onclick="showPage('events')">Browse Events →</button>`:''}
    </div>`;
  return events.map(e=>`
    <div class="schedule-row">
      <div style="font-size:36px;">${e.emoji}</div>
      <div class="schedule-info">
        <div class="schedule-event">${e.name}</div>
        <div class="schedule-venue">${e.club}</div>
        <div class="schedule-venue">${formatDate(e.date)} &nbsp;•&nbsp; ${formatTime(e.time)} &nbsp;•&nbsp; ${e.venue}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <span class="attendance-tag ${past?'att-present':'att-reg'}">${past?'✓ Attended':'Registered'}</span>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;">⭐ ${e.points} pts</div>
      </div>
    </div>`).join('');
}

function switchRegTab(btn, id) {
  document.querySelectorAll('#reg-tabs .tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  ['upcoming-regs','completed-regs'].forEach(k=>{
    document.getElementById(k).style.display = k===id?'block':'none';
  });
}

// ── PROFILE PAGE ──────────────────────────────────────────────────────────────
function renderProfilePage() {
  const user  = STATE.currentUser;
  const certs = Data.studentCerts(user.id);
  const regs  = Data.studentRegs(user.id);
  const total = certs.reduce((s,c)=>s+(c.points||0),0) + (user.points||0);

  document.getElementById('page-profile').innerHTML = `
    <div class="profile-card">
      <div class="profile-header">
        <div style="position:relative;cursor:pointer;flex-shrink:0;" onclick="triggerPhotoUpload()">
          ${user.profilePhoto
            ? `<img src="${user.profilePhoto}" style="width:90px;height:90px;border-radius:20px;object-fit:cover;border:3px solid var(--accent);">`
            : `<div class="profile-avatar">${user.name?user.name[0]:'?'}</div>`
          }
          <div class="photo-edit-btn">📷</div>
          <input type="file" id="photo-upload" style="display:none;" accept="image/*" onchange="handlePhotoUpload(this)">
        </div>
        <div class="profile-info">
          <h2>${titleCase(user.name)}</h2>
          <p style="color:var(--text3);">${user.usn} &nbsp;•&nbsp; ${user.branch} &nbsp;•&nbsp; ${user.year} &nbsp;•&nbsp; Section ${user.section}</p>
          <p style="font-size:13px;color:var(--text3);margin-top:2px;">${user.email}</p>
          ${user.bio?`<p style="font-size:13px;color:var(--text2);margin-top:8px;line-height:1.6;font-style:italic;">"${user.bio}"</p>`:''}
          <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;">
            ${(user.interests||[]).map(i=>`<span class="interest-chip selected" style="cursor:default;">${i}</span>`).join('')}
          </div>
        </div>
        <button class="btn-sm btn-accent" onclick="openProfileEdit()" style="margin-left:auto;white-space:nowrap;align-self:flex-start;">✏️ Edit Profile</button>
      </div>
      <div class="profile-stats">
        <div class="profile-stat"><div class="val">${total}</div><div class="lbl">AICTE Points</div></div>
        <div class="profile-stat"><div class="val">${regs.length}</div><div class="lbl">Registered</div></div>
        <div class="profile-stat"><div class="val">${certs.length}</div><div class="lbl">Certificates</div></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem;">
      <div class="profile-card" style="margin-bottom:0;">
        <div class="section-title" style="margin-bottom:1rem;">Academic Details</div>
        <div class="profile-grid">
          ${pField('USN',user.usn)} ${pField('Branch',user.branch)}
          ${pField('Year',user.year)} ${pField('Semester',user.sem)}
          ${pField('Section',user.section)} ${pField('Email',user.email)}
        </div>
      </div>
      <div class="profile-card" style="margin-bottom:0;">
        <div class="section-title" style="margin-bottom:1rem;">Contact & Links</div>
        <div class="profile-grid">
          ${pField('Phone',user.phone||'—')}
          ${pFieldLink('LinkedIn',user.linkedin)}
          ${pFieldLink('GitHub',user.github)}
        </div>
        <div style="margin-top:1rem;">
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px;">Skills</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${(user.skills||[]).length
              ? user.skills.map(s=>`<span class="skill-chip">${s}</span>`).join('')
              : `<span style="color:var(--text3);font-size:13px;">No skills added yet.</span>`
            }
          </div>
        </div>
        ${user.resume?`<div style="margin-top:12px;"><a href="${user.resume}" download style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:rgba(108,99,255,0.12);border:1px solid rgba(108,99,255,0.3);border-radius:8px;color:var(--accent);font-size:13px;font-weight:600;text-decoration:none;">📄 Download Resume</a></div>`:''}
      </div>
    </div>

    <div class="profile-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <div class="section-title">Achievements & Awards</div>
        <button class="btn-sm btn-outline" onclick="openProfileEdit()">+ Add</button>
      </div>
      ${(user.achievements||[]).length
        ? user.achievements.map(a=>`
          <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border2);">
            <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,var(--gold),var(--gold2));display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">🏆</div>
            <div style="font-size:14px;color:var(--text1);">${a}</div>
          </div>`).join('')
        : `<div style="color:var(--text3);font-size:13px;">No achievements added. <span style="color:var(--accent);cursor:pointer;" onclick="openProfileEdit()">Add achievements →</span></div>`
      }
    </div>

    <div class="profile-card" style="margin-top:1.5rem;">
      <div class="section-title" style="margin-bottom:1rem;">AICTE Points — Semester Breakdown</div>
      <div class="sem-points-grid">
        ${Object.entries(user.pointsBySem||{}).map(([sem,pts])=>`
          <div class="sem-card">
            <div style="font-family:'Outfit',sans-serif;font-size:26px;font-weight:900;color:var(--accent);">${pts}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px;">${sem}</div>
          </div>`).join('')}
      </div>
    </div>
  `;
}

function pField(label, val) {
  return `<div class="profile-field"><label>${label}</label><span>${val||'—'}</span></div>`;
}
function pFieldLink(label, val) {
  if (!val) return pField(label, '—');
  return `<div class="profile-field"><label>${label}</label><a href="https://${val}" target="_blank" style="font-size:13px;color:var(--accent);text-decoration:none;">${val}</a></div>`;
}

// ── PROFILE EDIT ──────────────────────────────────────────────────────────────
function openProfileEdit() {
  const user = STATE.currentUser;
  document.getElementById('profile-edit-content').innerHTML = `
    <div class="form-row">
      <div class="form-group"><label>Phone Number</label><input type="text" id="pe-phone" value="${user.phone||''}" placeholder="9876543210"></div>
      <div class="form-group"><label>LinkedIn URL</label><input type="text" id="pe-linkedin" value="${user.linkedin||''}" placeholder="linkedin.com/in/yourname"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>GitHub URL</label><input type="text" id="pe-github" value="${user.github||''}" placeholder="github.com/yourname"></div>
      <div class="form-group"><label>Skills (comma separated)</label><input type="text" id="pe-skills" value="${(user.skills||[]).join(', ')}" placeholder="Python, React, Node.js"></div>
    </div>
    <div class="form-group"><label>Bio / About Me</label>
      <textarea id="pe-bio" rows="3" style="width:100%;padding:11px 14px;border:1px solid rgba(255,255,255,0.08);border-radius:9px;font-family:'Space Grotesk',sans-serif;font-size:13px;resize:vertical;outline:none;background:rgba(255,255,255,0.04);color:var(--text1);" placeholder="Write a short bio...">${user.bio||''}</textarea>
    </div>
    <div class="form-group"><label>Achievements (one per line)</label>
      <textarea id="pe-achievements" rows="4" style="width:100%;padding:11px 14px;border:1px solid rgba(255,255,255,0.08);border-radius:9px;font-family:'Space Grotesk',sans-serif;font-size:13px;resize:vertical;outline:none;background:rgba(255,255,255,0.04);color:var(--text1);" placeholder="e.g. Hackathon Winner 2024&#10;Google DSC Lead">${(user.achievements||[]).join('\n')}</textarea>
    </div>
    <div class="form-group"><label>Interests</label>
      <div class="interest-grid" id="pe-interests">
        ${['Technical','Cultural','Sports','Management','Workshop','Other'].map(i=>
          `<span class="interest-chip ${(user.interests||[]).includes(i)?'selected':''}" onclick="toggleInterest(this)">${i}</span>`
        ).join('')}
      </div>
    </div>
    <div class="form-group">
      <label>Resume Upload</label>
      <div class="upload-zone" onclick="document.getElementById('resume-upload').click()">
        <div class="upload-icon">📄</div>
        <p>${user.resume?'Resume uploaded — click to replace':'Click to upload your resume (PDF)'}</p>
        <input type="file" id="resume-upload" style="display:none;" accept=".pdf,.doc,.docx" onchange="handleResumeUpload(this)">
      </div>
    </div>
    <button class="btn-primary" onclick="saveProfileEdit()">Save Changes</button>
  `;
  openModal('profile-edit-modal');
}

function saveProfileEdit() {
  const updates = {
    phone:        document.getElementById('pe-phone').value.trim(),
    linkedin:     document.getElementById('pe-linkedin').value.trim(),
    github:       document.getElementById('pe-github').value.trim(),
    bio:          document.getElementById('pe-bio').value.trim(),
    skills:       document.getElementById('pe-skills').value.split(',').map(s=>s.trim()).filter(Boolean),
    achievements: document.getElementById('pe-achievements').value.split('\n').map(s=>s.trim()).filter(Boolean),
    interests:    [...document.querySelectorAll('#pe-interests .interest-chip.selected')].map(c=>c.textContent),
  };
  Mutate.updateUser(STATE.currentUser.id, updates);
  closeModal('profile-edit-modal');
  showToast('Profile updated! ✅', 'success');
  renderProfilePage();
  renderSidebarUser();
}

function triggerPhotoUpload() { document.getElementById('photo-upload')?.click(); }

function handlePhotoUpload(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    Mutate.updateUser(STATE.currentUser.id, { profilePhoto: e.target.result });
    showToast('Profile photo updated! 📷', 'success');
    renderProfilePage(); renderSidebarUser();
  };
  reader.readAsDataURL(file);
}

function handleResumeUpload(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    Mutate.updateUser(STATE.currentUser.id, { resume: e.target.result });
    showToast('Resume uploaded! 📄', 'success');
  };
  reader.readAsDataURL(file);
}

// ── CERTIFICATE UPLOAD ────────────────────────────────────────────────────────
function handleCertUpload(input) {
  const file = input.files[0]; if (!file) return;
  const el = document.getElementById('cert-file-name');
  if (el) { el.textContent = '📎 ' + file.name; el.style.display = 'block'; }
}

function submitCertificate() {
  const eventName = document.getElementById('cert-event-name').value.trim();
  const club      = document.getElementById('cert-club').value.trim();
  const date      = document.getElementById('cert-date').value;
  const position  = document.getElementById('cert-position').value;
  const points    = parseInt(document.getElementById('cert-points').value||'0');

  if (!eventName || !club || !date) { showToast('Fill in all required fields.','error'); return; }

  Mutate.addCertificate({
    id: genId('c'), userId: STATE.currentUser.id,
    eventName, club, date, position, points,
    type: ['Winner','Runner-up'].includes(position) ? 'achievement' : 'participation',
    verified: false
  });
  closeModal('upload-cert-modal');
  showToast('Certificate submitted for verification! ⏳', 'success');
  if (STATE.currentPage === 'certificates') renderCertificatesPage();
}
