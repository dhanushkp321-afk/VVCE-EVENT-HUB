/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — App Routing, Navigation, Sidebar & Topbar Notifications
   Path: js/core/router.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   APP LAUNCH & ROUTING
───────────────────────────────────────────────────────────────*/
function launchApp(user) {
  STATE.user = user;
  STATE.deanUnlocked = false;
  STATE.principalUnlocked = false;

  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.body.style.background = '#f1f5f9';

  renderSidebar();
  renderTopbarUser();
  checkTeamInviteUrl();
  if (typeof fetchUserOwnDetails === 'function') fetchUserOwnDetails(user.id);
  if (typeof setupRealtimeSync === 'function') setupRealtimeSync(true);

  if (user.type === 'student') {
    showPage('dashboard');
  } else if (user.type === 'admin') {
    showPage('admin-dashboard');
  } else if (user.type === 'authority') {
    // If authority is already unlocked, land directly on authority-portal
    if (STATE.authorityUnlocked && STATE.currentAuthorityId) {
      showPage('authority-portal');
    } else {
      showPage('authority-dashboard');
    }
  } else {
    showPage('dashboard');
  }
}

function logout() {
  if (!confirm('Sign out of VVCE Events Hub?')) return;
  try {
    sessionStorage.removeItem('vvce_oauth_flow');
    const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (sb && sb.auth) sb.auth.signOut().catch(() => {});
  } catch (e) {}
  STATE.user = null;
  STATE.deanUnlocked = false;
  STATE.principalUnlocked = false;
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  if (!window.currentTheme || !window.currentTheme.bannerUrl) {
    document.body.style.backgroundColor = '#1a2235';
  }
  // Reset login fields
  const le = document.getElementById('login-email'); if (le) le.value = '';
  const lp = document.getElementById('login-pass');  if (lp) lp.value = '';
  clearAuthMsg();
}

function showPage(pageId) {
  if (STATE.user?.type === 'admin' && pageId === 'authority-clash') { pageId = 'create-event'; }
  const prev = STATE.page;
  STATE.prevPage = prev;
  STATE.page = pageId;

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + pageId);
  if (el) { el.classList.add('active'); el.scrollTop = 0; }

  // Auto-close sidebar on mobile when navigating
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
  }

  // Update topbar title
  const titles = {
    'dashboard': 'Dashboard',
    'events': 'Events',
    'clubs': 'VVCE Clubs Directory',
    'calendar': 'Academic Calendar',
    'registrations': 'My Registrations',
    'certificates': 'Certificates',
    'profile': 'My Profile',
    'admin-dashboard': 'Admin Dashboard',
    'create-event': 'Create New Event',
    'manage-events': 'My Events',
    'participants': 'Participants',
    'authority-dashboard': 'Dashboard',
    'authority-approvals': 'Event Approvals',
    'authority-clubs': 'Club Monitor',
    'authority-clash': 'Clash Detection',
    'authority-attendance': 'Attendance',
    'authority-portal': 'Approving Authority Portal',
    'dean-portal': 'Approving Authority Portal',
  };
  document.getElementById('topbar-title').textContent = titles[pageId] || pageId;

  // Back button visibility
  const mainPages = ['dashboard','admin-dashboard','authority-dashboard'];
  document.getElementById('back-btn').style.display = mainPages.includes(pageId) ? 'none' : '';

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === pageId);
  });

  // Render page content
  const renders = {
    'dashboard':            renderStudentDashboard,
    'events':               renderEventsPage,
    'clubs':                () => renderClubsDirectoryPage(),
    'calendar':             renderCalendarPage,
    'registrations':        renderRegistrationsPage,
    'certificates':         renderCertificatesPage,
    'profile':              renderProfilePage,
    'admin-dashboard':      renderAdminDashboard,
    'create-event':         renderCreateEventPage,
    'manage-events':        renderManageEventsPage,
    'participants':         renderParticipantsPage,
    'authority-dashboard':  renderAuthorityDashboard,
    'authority-approvals':  renderApprovals,
    'authority-clubs':      renderClubMonitor,
    'authority-clash':      renderClashDetect,
    'authority-attendance': renderAttendancePage,
    'authority-portal':     () => renderAuthorityPortal(),
    'dean-portal':          () => renderAuthorityPortal(),
  };
  if (renders[pageId]) renders[pageId]();
}

function goBack() {
  if (STATE.prevPage) showPage(STATE.prevPage);
  else {
    const home = { student:'dashboard', admin:'admin-dashboard', authority:'authority-dashboard' };
    showPage(home[STATE.user?.type] || 'dashboard');
  }
}

/* ─────────────────────────────────────────────────────────────
   SIDEBAR RENDERING
───────────────────────────────────────────────────────────────*/
function renderSidebar() {
  const user = STATE.user;

  // Avatar
  const sbAv = document.getElementById('sb-avatar');
  if (sbAv) {
    if (user.profilePhoto) {
      sbAv.innerHTML = `<img src="${sanitizeUrl(user.profilePhoto)}" alt="avatar">`;
    } else {
      sbAv.textContent = avatar(user.name);
    }
    sbAv.style.cursor = 'pointer';
    sbAv.onclick = () => showPage('profile');
  }

  // User info
  const sbName = document.getElementById('sb-username'); if (sbName) sbName.textContent = titleCase(user.name);
  const sbRole = document.getElementById('sb-userrole');
  if (sbRole) sbRole.textContent = {
    student: (() => { const cs = computeStudentYearSem(user); return `${user.branch || ''} • ${cs.sem}`; })(),
    admin: user.clubName || 'Club Admin',
    authority: STATE.authorityUnlocked && STATE.currentAuthorityName ? STATE.currentAuthorityName : (titleCase(user.designation) || 'Approving Authority'),
  }[user.type] || '';

  const sbBadge = document.getElementById('sb-rolebadge');
  if (sbBadge) {
    const labels = { student:'Student', admin:'Club Admin', authority:'Authority' };
    const classes = { student:'badge-student', admin:'badge-admin', authority:'badge-authority' };
    sbBadge.textContent = labels[user.type];
    sbBadge.className = `sb-badge-pill ${classes[user.type]}`;
  }

  // Nav items by role
  const nav = document.getElementById('sb-nav');
  if (!nav) return;

  let html = '';
  if (user.type === 'student') {
    html = `
      <div class="sb-section-label">Overview</div>
      ${navItem('dashboard','📊','Dashboard')}
      ${navItem('events','🗓️','All Events')}
      ${navItem('clubs','🏛️','Clubs')}
      ${navItem('registrations','📋','My Registrations')}
      ${navItem('certificates','🏆','Certificates')}
      ${navItem('calendar','📅','Academic Calendar')}
      <div class="sb-section-label">Account</div>
      ${navItem('profile','👤','My Profile')}
    `;
  } else if (user.type === 'admin') {
    html = `
      <div class="sb-section-label">Management</div>
      ${navItem('admin-dashboard','📊','Dashboard')}
      ${navItem('events','🗓️','All Events')}
      ${navItem('clubs','🏛️','Clubs')}
      ${navItem('create-event','➕','Create Event')}
      ${navItem('manage-events','📋','My Events')}
      ${navItem('participants','👥','Participants')}

      <div class="sb-section-label">Account</div>
      ${navItem('profile','👤','Profile')}
    `;
  } else { // authority (Faculty / Approving Authority)
    const isUnlocked = STATE.authorityUnlocked;
    const currentAuthName = STATE.currentAuthorityName || 'Select Authority';

    // Count pending events assigned to currently unlocked authority
    const allPending = getDB('vvce_events').filter(e => e.status === 'pending');
    const myPending = isUnlocked && STATE.currentAuthorityId
      ? allPending.filter(e => !e.authorityId || e.authorityId === STATE.currentAuthorityId)
      : allPending;
    const pendingBadge = myPending.length > 0 ? String(myPending.length) : '';

    html = `
      <div class="sb-section-label">Faculty Navigation</div>
      ${navItem('authority-dashboard','📊','Dashboard')}
      ${navItem('events','📅','All Events')}
      ${navItem('clubs','👥','Clubs Directory')}
      ${navItem('authority-clubs','🏛️','Club Activity Monitor')}
      ${navItem('authority-clash','⚡','Clash Detect')}
      ${navItem('authority-attendance','📋','Attendance')}

      <div class="sb-section-label">Approving Authority</div>
      <div class="nav-item dean-item ${STATE.page==='authority-portal'?'active':''}" data-page="authority-portal" onclick="handleAuthoritySectionNav()">
        <span class="nav-icon">🔐</span>
        <div style="display:flex; flex-direction:column; line-height:1.2; overflow:hidden;">
          <span class="nav-label" style="font-size:12.5px;">Approving Authority</span>
          <span style="font-size:10px; color:${isUnlocked?'#86efac':'#cbd5e1'}; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">
            ${isUnlocked ? '✓ ' + escapeHTML(currentAuthName) : 'Login Required'}
          </span>
        </div>
        ${isUnlocked && pendingBadge ? `<span class="portal-tab-badge" style="margin-left:auto;margin-right:6px;">${escapeHTML(pendingBadge)}</span>` : ''}
        <span class="portal-pill portal-pill-dean">${isUnlocked ? 'ACTIVE' : 'LOCK'}</span>
      </div>
    `;
  }

  nav.innerHTML = html;
}

function navItem(page, icon, label, badge = '') {
  const isActive = STATE.page === page ? 'active' : '';
  const bdg = badge ? `<span class="nav-count">${escapeHTML(badge)}</span>` : '';
  return `<div class="nav-item ${isActive}" data-page="${escapeHTML(page)}" onclick="showPage('${escapeHTML(page)}')">
    <span class="nav-icon">${escapeHTML(icon)}</span>
    <span class="nav-label">${escapeHTML(label)}</span>${bdg}
  </div>`;
}

function renderTopbarUser() {
  const user = STATE.user;
  const av = document.getElementById('topbar-avatar');
  if (!av) return;
  if (user.profilePhoto) { av.innerHTML = `<img src="${sanitizeUrl(user.profilePhoto)}">`; }
  else { av.textContent = avatar(user.name); }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

/* ─────────────────────────────────────────────────────────────
   NOTIFICATION PANEL
───────────────────────────────────────────────────────────────*/
function toggleNotifPanel() {
  const panel = document.getElementById('notif-dropdown');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) renderNotifs();
}

function getRelativeTime(timestamp, fallback) {
  if (!timestamp) return fallback || 'Just now';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderNotifs() {
  const user = STATE.user;
  const notifs = user.notifs || [];
  const list = document.getElementById('notif-list');
  if (!list) return;

  const unread = notifs.filter(n => !n.read).length;
  const badge  = document.getElementById('notif-badge');
  if (badge) { badge.style.display = unread > 0 ? '' : 'none'; badge.textContent = unread; }

  if (!notifs.length) { list.innerHTML = `<div style="padding:2rem;text-align:center;color:#9ca3af;font-size:13px;">No notifications</div>`; return; }
  list.innerHTML = notifs.slice().reverse().map(n => `
    <div class="notif-item ${n.read?'':'unread'}" onclick="readNotif('${escapeHTML(n.id)}')">
      <span class="notif-item-icon">${escapeHTML(n.icon || '🔔')}</span>
        <div style="flex:1">
          <div class="notif-item-text">${escapeHTML(n.msg)}</div>
          <div class="notif-item-time">${escapeHTML(getRelativeTime(n.timestamp, n.time))}</div>
        </div>
      ${!n.read ? '<span class="notif-item-dot"></span>' : ''}
    </div>
  `).join('');
}

async function readNotif(id) {
  if (!STATE.user) return;
  const users = getDB('vvce_users');
  const u = users.find(x => x.id === STATE.user.id);
  const notifs = (u?.notifs || STATE.user.notifs || []).map(n => n.id === id ? { ...n, read: true } : n);
  if (u) u.notifs = notifs;
  STATE.user.notifs = notifs;
  renderNotifs();
  if (typeof markUserNotifsReadAtomic === 'function') {
    await markUserNotifsReadAtomic(STATE.user.id, id);
  }
}

async function markAllRead() {
  if (!STATE.user) return;
  const users = getDB('vvce_users');
  const u = users.find(x => x.id === STATE.user.id);
  const notifs = (u?.notifs || STATE.user.notifs || []).map(n => ({ ...n, read: true }));
  if (u) u.notifs = notifs;
  STATE.user.notifs = notifs;
  renderNotifs();
  if (typeof markUserNotifsReadAtomic === 'function') {
    await markUserNotifsReadAtomic(STATE.user.id, null);
  }
}

function addNotif(msg, icon = '🔔') {
  if (!STATE.user) return;
  addNotifToUser(STATE.user.id, msg, icon);
}

function addNotifToUser(userId, msg, icon = '🔔') {
  const notifObj = { id: genId('n'), msg, icon, time: 'Just now', timestamp: Date.now(), read: false };
  if (typeof pushUserNotifAtomic === 'function') {
    pushUserNotifAtomic(userId, notifObj);
  }
  if (STATE.user && STATE.user.id === userId) {
    const badge = document.getElementById('notif-badge');
    if (badge) { badge.style.display = ''; }
  }
}

// Close notif panel and sidebar on outside click
document.addEventListener('click', (e) => {
  const notifPanel = document.getElementById('notif-dropdown');
  const notifBtn   = document.getElementById('notif-btn');
  if (notifPanel && notifBtn && !notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
    notifPanel.classList.remove('open');
  }

  const sidebar = document.getElementById('sidebar');
  const hamBtn = document.querySelector('.hamburger-btn');
  // If clicking outside sidebar AND not clicking the hamburger button, close it
  if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(e.target)) {
    if (!hamBtn || !hamBtn.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  }
});
