/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Faculty / Club Admin Dashboard
   Path: js/pages/faculty-dashboard.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   ADMIN DASHBOARD
───────────────────────────────────────────────────────────────*/
function renderAdminDashboard() {
  const user   = STATE.user;
  const events = getDB('vvce_events').filter(e=>e.adminId===user.id);
  const approved = events.filter(e=>e.status==='approved');
  const pending  = events.filter(e=>e.status==='pending');
  const totalRegs= approved.reduce((s,e)=>s+(e.regCount||0),0);
  const el       = document.getElementById('page-admin-dashboard');

  // Recent 6-month chart data based on actual registrations
  const d = new Date();
  const months = [];
  const chartData = [0, 0, 0, 0, 0, 0];
  
  for (let i = 5; i >= 0; i--) {
    const temp = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(temp.toLocaleString('default', { month: 'short' }));
  }

  approved.forEach(e => {
    if (e.regCount > 0 && e.date) {
      const evDate = new Date(e.date);
      const diffMonths = (d.getFullYear() - evDate.getFullYear()) * 12 + (d.getMonth() - evDate.getMonth());
      if (diffMonths >= 0 && diffMonths <= 5) {
        chartData[5 - diffMonths] += e.regCount;
      }
    }
  });

  const max=Math.max(...chartData,1);

  el.innerHTML=`
    <!-- Stats row -->
    <div class="stats-row">
      ${statCard('📅','Total Events',events.length,'All time','stat-blue')}
      ${statCard('✅','Approved',approved.length,'Active events','stat-mint')}
      ${statCard('⏳','Pending Approval',pending.length,'Awaiting Dean review','stat-amber')}
      ${statCard('👥','Total Registrations',totalRegs,'Across all events','stat-purple')}
    </div>



    <div class="admin-main-grid">
      <!-- Left: chart -->
      <div class="white-card">
        <div class="sec-head"><span class="sec-title">Registrations (Last 6 Months)</span></div>
        <div class="analytics-chart" id="admin-chart">
          ${chartData.some(v=>v>0)
            ? chartData.map((v,i)=>`
              <div class="chart-bar-row">
                <span class="chart-lbl">${months[i]}</span>
                <div class="chart-track"><div class="chart-fill" style="width:${Math.round(v/max*100)}%">${v>0?v:''}</div></div>
              </div>`).join('')
            : `<div class="chart-empty">No registrations yet. The progress graph will appear here once students start registering for your events.</div>`
          }
        </div>
      </div>

      <!-- Right: quick actions & principal availability -->
      <div>
        

        <div class="sec-title" style="margin-bottom:10px;">Quick Actions</div>
        <div class="qa-grid">
          <div class="qa-card" onclick="showPage('create-event')"><span class="qa-icon">➕</span><div class="qa-label">Create Event</div></div>
          <div class="qa-card" onclick="showPage('manage-events')"><span class="qa-icon">📋</span><div class="qa-label">Manage Events</div></div>
          <div class="qa-card" onclick="showPage('participants')"><span class="qa-icon">👥</span><div class="qa-label">View Participants</div></div>
          <div class="qa-card" onclick="showPage('events')"><span class="qa-icon">🗓️</span><div class="qa-label">All Events</div></div>
        </div>

        <!-- Recent events -->
        <div class="sec-title" style="margin:1rem 0 10px;">Recent Events</div>
        ${events.slice(0,3).map(e=>`
          <div class="ev-row" onclick="showPage('manage-events')">
            <span class="ev-row-emoji">${e.emoji||'🎓'}</span>
            <div class="ev-row-info">
              <div class="ev-row-name">${e.name}</div>
              <div class="ev-row-meta">${formatDate(e.date)} • ${e.venue}</div>
            </div>
            <span class="badge ${e.status==='approved'?'badge-green':e.status==='pending'?'badge-amber':'badge-red'}">${e.status}</span>
          </div>`).join('') || `<div class="empty-state" style="padding:1.5rem;"><div class="ei">📅</div><div class="et">No events yet</div></div>`}
      </div>
    </div>
  `;
}

