/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Calendar Page & Academic Timetable
   Path: js/pages/calendar.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   CALENDAR PAGE
───────────────────────────────────────────────────────────────*/
function renderCalendarPage() {
  const el = document.getElementById('page-calendar');
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 300px;gap:1.5rem;">
      <div>
        <div class="cal-wrap">
          <div class="cal-head">
            <span class="sec-title" id="cal-month-title"></span>
            <div class="cal-nav">
              <button onclick="changeMonth(-1)">‹</button>
              <button onclick="changeMonth(1)">›</button>
            </div>
          </div>
          <div class="cal-grid" id="cal-grid"></div>
          <div class="cal-legend">
            <div class="legend-item"><div class="legend-dot" style="background:linear-gradient(135deg,#f59e0b,#fbbf24)"></div>Today</div>
            <div class="legend-item"><div class="legend-dot" style="background:#3b82f6"></div>Event Day</div>
            <div class="legend-item"><div class="legend-dot" style="background:#ef4444"></div>Holiday</div>
            <div class="legend-item"><div class="legend-dot" style="background:#f59e0b"></div>Exam</div>
          </div>
        </div>
      </div>
      <div>
        <div class="sec-head"><span class="sec-title">Events on Date</span></div>
        <div id="cal-events-panel"><p style="color:#9ca3af;font-size:13px;padding:12px;background:#f8fafc;border-radius:8px;">Click a date to view events</p></div>
        <div style="margin-top:1.5rem;">
          <div class="sec-head"><span class="sec-title">Academic Schedule</span></div>
          <div id="acad-schedule"></div>
        </div>
      </div>
    </div>
  `;
  drawCalendar();
  renderAcadSchedule();
}

function changeMonth(d) { STATE.calMonth += d; if(STATE.calMonth<0){STATE.calMonth=11;STATE.calYear--;}else if(STATE.calMonth>11){STATE.calMonth=0;STATE.calYear++;} drawCalendar(); }

function drawCalendar() {
  const year=STATE.calYear, month=STATE.calMonth;
  const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const now=new Date();

  const titleEl = document.getElementById('cal-month-title');
  if (titleEl) titleEl.textContent = `${monthNames[month]} ${year}`;

  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Day headers
  dayNames.forEach(d => { const el=document.createElement('div'); el.className='cal-day-lbl'; el.textContent=d; grid.appendChild(el); });

  const firstDay = new Date(year,month,1).getDay();
  const totalDays = new Date(year,month+1,0).getDate();
  let events = getDB('vvce_events').filter(e=>e.status==='approved' || e.status==='rescheduled' || e.status==='completed');
  if (STATE.user && STATE.user.type === 'student') {
    events = events.filter(e => !e.branches || e.branches.length === 0 || e.branches.includes('All') || e.branches.includes(STATE.user.branch));
  }
  const acad   = getDB('vvce_academic');

  for(let i=0;i<firstDay;i++){const c=document.createElement('div');c.className='cal-day other';grid.appendChild(c);}

  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  let selectedDateToLoad = STATE.selectedDate || todayStr;
  let defaultSelectedCell = null;

  for(let d=1;d<=totalDays;d++){
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell=document.createElement('div');
    cell.className='cal-day';

    const isToday=now.getFullYear()===year&&now.getMonth()===month&&now.getDate()===d;
    const dayEvents = events.filter(e=>e.date===ds);
    const sched = acad.find(s=>s.date===ds);

    if(isToday) cell.classList.add('today');
    if(dayEvents.length > 0) cell.classList.add('has-ev');
    if(sched?.type==='holiday') cell.classList.add('holiday');
    else if(sched?.type==='exam') cell.classList.add('exam');

    let dotsHtml = '';
    if (dayEvents.length > 0) {
      dotsHtml += `<span style="width:5px; height:5px; border-radius:50%; background:#2563eb; display:inline-block; margin:0 1px;"></span>`;
    }
    if (sched?.type==='holiday') {
      dotsHtml += `<span style="width:5px; height:5px; border-radius:50%; background:#ef4444; display:inline-block; margin:0 1px;"></span>`;
    } else if (sched?.type==='exam') {
      dotsHtml += `<span style="width:5px; height:5px; border-radius:50%; background:#f59e0b; display:inline-block; margin:0 1px;"></span>`;
    }

    cell.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%;">
        <span>${d}</span>
        ${dotsHtml ? `<div style="display:flex; gap:2px; margin-top:2px;">${dotsHtml}</div>` : ''}
      </div>
    `;

    cell.dataset.date = ds;
    cell.onclick = function() {
      const calGrid = document.getElementById('cal-grid');
      if (calGrid) calGrid.querySelectorAll('.cal-day.selected').forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');
      STATE.selectedDate = this.dataset.date;
      showCalDateEvents(this.dataset.date);
    };

    if (ds === selectedDateToLoad || (isToday && !STATE.selectedDate)) {
      cell.classList.add('selected');
      defaultSelectedCell = cell;
      selectedDateToLoad = ds;
    }

    grid.appendChild(cell);
  }

  // Pre-load events for selected date on initial view
  showCalDateEvents(selectedDateToLoad);
}

function showCalDateEvents(ds) {
  let events = getDB('vvce_events').filter(e=>(e.status==='approved'||e.status==='rescheduled'||e.status==='completed')&&e.date===ds);
  if (STATE.user && STATE.user.type === 'student') {
    events = events.filter(e => !e.branches || e.branches.length === 0 || e.branches.includes('All') || e.branches.includes(STATE.user.branch));
  }
  const acad = getDB('vvce_academic').filter(a => a.date === ds);
  const panel  = document.getElementById('cal-events-panel');
  if (!panel) return;

  if (!events.length && !acad.length) {
    panel.innerHTML=`<p style="color:#64748b;font-size:13px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">No scheduled events on <strong>${formatDate(ds)}</strong></p>`;
    return;
  }

  let html = `<div style="font-size:12px; font-weight:700; color:#64748b; margin-bottom:8px;">📅 Schedule for ${formatDate(ds)}:</div>`;

  if (acad.length) {
    html += acad.map(a => `
      <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:${a.type==='holiday'?'#fef2f2':'#fffbeb'};border:1px solid ${a.type==='holiday'?'#fecaca':'#fde68a'};border-radius:8px;margin-bottom:8px;font-size:13px;font-weight:700;color:${a.type==='holiday'?'#dc2626':'#b45309'};">
        <span>${a.type==='holiday'?'🏖️ Holiday:':'📝 Exam:'}</span>
        <span>${a.desc || a.type}</span>
      </div>
    `).join('');
  }

  if (events.length) {
    html += events.map(e=>`
      <div class="sched-row" onclick="openEventModal('${e.id}')" style="cursor:pointer; margin-bottom:8px;">
        <span class="sched-emoji">${e.emoji||'🎓'}</span>
        <div class="sched-info">
          <div class="sched-name">${e.name}</div>
          <div class="sched-meta">${formatTime(e.time)} • ${e.venue} • ${e.club}</div>
        </div>
        <span class="badge ${e.status==='approved'?'badge-green':'badge-amber'}">${e.status}</span>
      </div>`).join('');
  }

  panel.innerHTML = html;
}

function renderAcadSchedule() {
  const acad   = getDB('vvce_academic');
  const events = getDB('vvce_events').filter(e=>e.status==='approved'||e.status==='rescheduled');
  const panel  = document.getElementById('acad-schedule');
  if (!panel) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const upcoming = [
    ...acad.map(a => ({ date: a.date, type: a.type, label: a.desc || a.type })),
    ...events.map(e => ({ date: e.date, type: 'event', label: e.name }))
  ].filter(s => s.date >= todayStr).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6);

  if (!upcoming.length) { panel.innerHTML=`<p style="color:#9ca3af;font-size:13px;">No upcoming events</p>`; return; }
  panel.innerHTML = upcoming.map(s=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;">
      <div style="font-size:18px;">${s.type==='holiday'?'🏖️':s.type==='exam'?'📝':'🎓'}</div>
      <div style="flex:1;font-size:13px;font-weight:700;color:#111827;">${s.label}</div>
      <div style="font-size:11px;color:#6b7280;">${formatDate(s.date)}</div>
    </div>`).join('');
}

