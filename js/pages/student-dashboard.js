/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Student Dashboard
   Path: js/pages/student-dashboard.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   STUDENT DASHBOARD
───────────────────────────────────────────────────────────────*/
function renderStudentDashboard() {
  const user   = STATE.user;
  const events = getDB('vvce_events');
  const certs  = getDB('vvce_certs').filter(c => c.userId === user.id);
  const regs   = events.filter(e => (e.registrations||[]).includes(user.id));
  const upcoming = regs.filter(e => new Date(e.date) >= new Date()).slice(0,4);
  const totalPts = user.points || 0;
  const pct = Math.min(100, Math.round(totalPts / 100 * 100));
  const approved = events.filter(e => {
    const s = (e.status || '').toLowerCase().trim();
    const isVisibleStatus = s === 'approved' || s === 'published' || s === 'rescheduled' || 
                            (s === 'scheduled' && (!e.publish_at || new Date(e.publish_at) <= new Date()));
    const isTargetBranch = isBranchMatch(e.branches, user.branch);
    return isVisibleStatus && isTargetBranch;
  });
  let recommended = approved.filter(e => {
    const evCat = e.category || 'Technical';
    const hasInterests = user.interests && user.interests.length > 0;
    const matchesInterest = hasInterests 
      ? user.interests.some(i => evCat.toLowerCase().includes(i.toLowerCase())) 
      : true;
    const isReg = (e.registrations||[]).includes(user.id);
    const isPending = (e.pendingPayments||[]).some(p => p.uid === user.id);
    return matchesInterest && !isReg && !isPending;
  });

  if (recommended.length === 0) {
    // Fallback: Show any events they are not registered for
    recommended = approved.filter(e => 
      !(e.registrations||[]).includes(user.id) && 
      !(e.pendingPayments||[]).some(p => p.uid === user.id)
    );
  }
  recommended = recommended.slice(0,6);

  const themeGreetingHTML = (window.currentTheme && window.currentTheme.showGreeting && window.currentTheme.greeting) 
    ? `<div class="dashboard-festive-ribbon" style="background: linear-gradient(90deg, ${window.currentTheme.primary || '#f59e0b'}, ${window.currentTheme.secondary || '#fbbf24'}); color: #ffffff; padding: 12px 20px; text-align: center; font-weight: 800; font-size: 14px; letter-spacing: 0.02em; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center; gap: 8px;">
         <span>${window.currentTheme.greeting}</span>
       </div>`
    : '';

  const el = document.getElementById('page-dashboard');
  el.innerHTML = `
    ${themeGreetingHTML}
    <!-- Welcome Banner -->
    <div class="welcome-banner">
      <div class="welcome-big-avatar" id="wb-avatar">
        ${user.profilePhoto ? `<img src="${user.profilePhoto}">` : avatar(user.name)}
      </div>
      <div class="welcome-info">
        <div class="welcome-greeting">Good ${getGreeting()},</div>
        <div class="welcome-name">${titleCase(user.name.split(' ')[0])} 👋</div>
        <div class="welcome-chips">
          <span class="welcome-chip">📍 ${user.branch||'—'} • ${computeStudentYearSem(user).sem}</span>
          <span class="welcome-chip">🏫 Sec ${user.section||'—'}</span>
          ${(user.interests||[]).map(i=>`<span class="welcome-chip">${i}</span>`).join('')}
        </div>
      </div>
      <div class="welcome-acts">
        <button class="welcome-act-btn gold" onclick="showPage('events')">Browse Events →</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      ${statCard('🎯','AICTE Points',totalPts,`${pct}% of 100-pt goal`,'stat-amber')}
      ${statCard('📅','Registered',regs.length,`${upcoming.length} upcoming`,'stat-blue')}
      ${statCard('🏆','Certificates',certs.length,`${certs.filter(c=>c.type==='achievement').length} achievements`,'stat-mint')}
      ${statCard('✅','Completed',regs.filter(e=>new Date(e.date)<new Date()).length,'Events attended','stat-pink')}
    </div>

    <!-- Two-col dashboard -->
    <div class="dash-grid">
      <!-- Left column -->
      <div>
        <!-- AICTE Points progress -->
        <div class="white-card" style="margin-bottom:1rem;">
          <div class="sec-head">
            <span class="sec-title">AICTE Activity Points</span>
            <span style="font-size:12px;color:#6b7280;">${totalPts}/100 target</span>
          </div>
          <div class="pts-bar-wrap"><div class="pts-bar" style="width:${pct}%"></div></div>
          <div class="sem-grid">
            ${Object.entries(user.pointsBySem||{}).slice(0,8).map(([s,p])=>`
              <div class="sem-cell">
                <div class="sem-val">${p}</div>
                <div class="sem-lbl">${s}</div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Recommended Events -->
        <div class="sec-head" style="margin-top:1.5rem;">
          <span class="sec-title">Recommended for You ✨</span>
          <button class="btn btn-outline" onclick="showPage('events')">View All →</button>
        </div>
        <div class="event-grid">
          ${recommended.length
            ? recommended.map(e => eventCard(e)).join('')
            : `<div class="empty-state" style="grid-column:1/-1">
                <div class="ei">🎯</div>
                <div class="et">No recommendations yet</div>
                <div class="es">Browse all events or update your interests.</div>
                <button class="btn btn-gold" style="margin-top:12px;" onclick="showPage('events')">Browse Events</button>
              </div>`
          }
        </div>
      </div>

      <!-- Right sidebar -->
      <div>
        

        <!-- Upcoming events -->
        <div class="sec-title" style="margin-bottom:10px;">📅 Upcoming Events</div>
        ${upcoming.length
          ? upcoming.map(e => {
              const userTeam = (e.teams || []).find(t => t.leaderId === user.id || (t.memberIds || []).includes(user.id));
              const hasPending = userTeam && (userTeam.pendingEmails || []).length > 0;
              return `
                <div class="sched-row" onclick="openEventModal('${e.id}')">
                  <span class="sched-emoji">${e.emoji||'🎓'}</span>
                  <div class="sched-info">
                    <div class="sched-name">${e.name}</div>
                    <div class="sched-meta">${formatDate(e.date)} • ${e.venue}${userTeam ? ` &bull; 👥 ${userTeam.name}` : ''}</div>
                  </div>
                  ${hasPending 
                    ? `<span class="att-tag" style="background:#fffbeb;color:#b45309;border:1px solid #fde68a;font-weight:700;">⏳ Team Pending</span>`
                    : `<span class="att-tag att-reg">✓ Reg.</span>`
                  }
                </div>`;
            }).join('')
          : `<div class="empty-state" style="padding:1.5rem;"><div class="ei">📅</div><div class="et">No upcoming events</div></div>`
        }

      </div>
    </div>
  `;
}

function statCard(icon, label, val, sub, cls='') {
  return `
    <div class="stat-card ${cls}">
      <div class="stat-top">
        <div>
          <div class="stat-label">${label}</div>
          <div class="stat-val">${val}</div>
        </div>
        <div class="stat-icon">${icon}</div>
      </div>
      <div class="stat-sub">${sub}</div>
    </div>`;
}
