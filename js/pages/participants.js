/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Participants Management & QR Attendance Scanner
   Path: js/pages/participants.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   PARTICIPANTS PAGE (Admin)
───────────────────────────────────────────────────────────────*/
function renderParticipantsPage() {
  const myEvents = getDB('vvce_events').filter(e=>e.adminId===STATE.user.id&&e.status==='approved');
  const allUsers = getDB('vvce_users');
  const el = document.getElementById('page-participants');

  if (!myEvents.length) { el.innerHTML=`<div class="empty-state"><div class="ei">👥</div><div class="et">No approved events</div></div>`; return; }

  let pendingHtml = '';
  let pendingCount = 0;
  myEvents.forEach(ev => {
    if (ev.pendingPayments && ev.pendingPayments.length) {
      ev.pendingPayments.forEach(p => {
        const student = allUsers.find(u=>u.id===p.uid);
        if (!student) return;
        pendingCount++;
        // Store screenshot in JS map to avoid embedding base64 in onclick attr (breaks HTML)
        const screenshotKey = `${ev.id}::${p.uid}`;
        PENDING_SCREENSHOTS[screenshotKey] = p.screenshot || '';
        const hasScreenshot = !!p.screenshot;
        pendingHtml += `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;
            background:linear-gradient(135deg,#1e1a2e,#2d1f3d);border-radius:10px;margin-bottom:8px;
            border:1px solid rgba(251,191,36,0.3);flex-wrap:wrap;gap:8px;">
            <div>
              <div style="font-weight:700;color:#fbbf24;font-size:13px;">💳 ${student.name}</div>
              <div style="font-size:11px;color:#9ca3af;">${ev.name} • ₹${ev.fee} • ${student.usn||student.email}</div>
              <div style="font-size:11px;color:#9ca3af;">Submitted: ${formatDate(p.date?.split('T')[0]||new Date().toISOString().split('T')[0])}</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${hasScreenshot
                ? `<button onclick="viewScreenshot('${screenshotKey}')" style="padding:8px 12px;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-weight:700;font-size:11px;cursor:pointer;">📸 View Screenshot</button>`
                : `<span style="padding:8px 12px;background:#374151;color:#9ca3af;border-radius:6px;font-size:11px;">No screenshot</span>`
              }
              <button onclick="approvePayment('${ev.id}','${p.uid}')" style="padding:8px 12px;background:#10b981;color:#fff;border:none;border-radius:6px;font-weight:700;font-size:11px;cursor:pointer;">✅ Approve</button>
              <button onclick="rejectPayment('${ev.id}','${p.uid}')" style="padding:8px 12px;background:#ef4444;color:#fff;border:none;border-radius:6px;font-weight:700;font-size:11px;cursor:pointer;">❌ Reject</button>
            </div>
          </div>`;
      });
    }
  });

  let html = `
    ${pendingHtml ? `
      <div style="margin-bottom:18px;">
        <div style="font-weight:700;color:#fbbf24;font-size:14px;margin-bottom:10px;">⏳ Pending Payment Verifications (${pendingCount})</div>
        ${pendingHtml}
      </div>
      <div style="border-top:1px solid rgba(255,255,255,0.08);margin-bottom:18px;"></div>` : ''}
    <div class="filter-row">
      <select class="filter-sel" id="part-ev-filter" onchange="renderParticipantTable()">
        ${myEvents.map(e=>`<option value="${e.id}">${e.name}</option>`).join('')}
      </select>
      <input class="search-inp" id="part-search" placeholder="🔍 Search participant…" oninput="renderParticipantTable()">
    </div>
    <div id="part-table-wrap"></div>
  `;
  el.innerHTML = html;
  renderParticipantTable();
}

window.viewScreenshot = function(key) {
  // key is either "eventId::uid" (from PENDING_SCREENSHOTS map) or a direct base64 string (legacy)
  const src = PENDING_SCREENSHOTS[key] || key;
  if (!src || src === 'undefined') {
    toast('No screenshot available for this payment.', 'error');
    return;
  }
  document.getElementById('screenshot-img-view').src = src;
  openModal('modal-screenshot');
};

window.approvePayment = function(eventId, uid) {
  if (!confirm('Approve this payment and confirm registration?')) return;
  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const pmt = (ev.pendingPayments || []).find(p => p.uid === uid);
  ev.pendingPayments = (ev.pendingPayments || []).filter(p => p.uid !== uid);
  
  if (pmt && pmt.teamData && pmt.teamData.teamId) {
    const team = (ev.teams || []).find(t => t.id === pmt.teamData.teamId);
    if (team) {
      team.paymentStatus = 'approved';
    }
  }

  if (!ev.registrations) ev.registrations = [];
  if (!ev.registrations.includes(uid)) {
    ev.registrations.push(uid);
    ev.regCount = (ev.regCount||0) + 1;
  }
  
  setDB('vvce_events', events);
  addNotifToUser(uid, `Your payment for "${ev.name}" was approved! 🎉 Your registration is officially confirmed.`, '✅');
  toast('Payment approved and registration confirmed.', 'success');
  renderParticipantsPage();
};

window.rejectPayment = function(eventId, uid) {
  if (!confirm('Reject this payment? The student will need to register again.')) return;
  const events = getDB('vvce_events');
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  
  ev.pendingPayments = ev.pendingPayments.filter(p => p.uid !== uid);
  setDB('vvce_events', events);
  
  addNotifToUser(uid, `Your payment screenshot for "${ev.name}" was rejected. Please contact the club or register again.`, '❌');
  toast('Payment rejected.', 'info');
  renderParticipantsPage();
}

function renderParticipantTable() {
  const evId = document.getElementById('part-ev-filter')?.value;
  const q    = (document.getElementById('part-search')?.value||'').toLowerCase();
  const ev   = getDB('vvce_events').find(e=>e.id===evId);
  const allUsers = getDB('vvce_users');
  const wrap = document.getElementById('part-table-wrap'); if (!wrap) return;

  const partIds  = ev?.registrations||[];
  const attended = ev?.attendedStudents||[];
  let parts = allUsers.filter(u=>partIds.includes(u.id));
  if (q) parts = parts.filter(u=>u.name.toLowerCase().includes(q)||u.usn?.toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q));

  if (!parts.length) { wrap.innerHTML=`<div class="empty-state"><div class="ei">👥</div><div class="et">No participants yet</div></div>`; return; }

  // If team event, prepend a team groupings section
  let teamHtml = '';
  if (ev?.isTeamEvent && (ev.teams||[]).length > 0) {
    teamHtml = `
      <div style="margin-bottom:20px;">
        <div style="font-size:13px; font-weight:700; color:#a5b4fc; text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px;">👥 Teams (${ev.teams.length})</div>
        ${ev.teams.map((team, ti) => {
          const members = allUsers.filter(u => team.memberIds.includes(u.id));
          return `
          <div style="background:linear-gradient(135deg,#0f172a,#1a2744); border:1px solid rgba(99,102,241,0.2); border-radius:12px; padding:14px 16px; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
              <span style="font-size:20px;">🏆</span>
              <div style="flex:1;">
                <div style="font-weight:800; color:#e2e8f0; font-size:15px;">${team.name}</div>
                <div style="font-size:11px; color:#6b7280;">Lead: ${team.leaderName} &bull; ${members.length} confirmed, ${team.pendingEmails.length} pending</div>
              </div>
              <span style="font-size:11px; font-weight:600; color:#10b981; background:rgba(16,185,129,0.1); padding:3px 10px; border-radius:20px;">Team ${ti+1}</span>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${members.map(m => `
                <div style="display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:5px 10px; font-size:12px; color:#cbd5e1;">
                  ${m.id === team.leaderId ? '⭐' : '👤'} <span>${titleCase(m.name)}</span>
                  <span style="color:#6b7280; font-size:11px;">${m.usn||m.email}</span>
                  <span style="font-size:10px; font-weight:700; color:#10b981; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); padding:1px 6px; border-radius:10px;">✓ Added</span>
                </div>`).join('')}
              ${team.pendingEmails.map(email => {
                const det = (team.pendingMembers || team.memberDetails || []).find(d => (typeof d === 'object' ? d.email : d).toLowerCase() === email.toLowerCase());
                const name = det?.name || '';
                return `
                <div style="display:flex; align-items:center; gap:6px; background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.2); border-radius:8px; padding:5px 10px; font-size:12px; color:#fbbf24;">
                  ✉️ <span>${name ? `<strong>${name}</strong> • ` : ''}${email}</span>
                  <span style="font-size:10px; font-weight:700; color:#f59e0b; background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.3); padding:1px 6px; border-radius:10px;">⏳ Pending</span>
                </div>`;
              }).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  const attendedCount = parts.filter(p=>attended.includes(p.id)).length;
  const absentCount   = parts.length - attendedCount;
  const attendPct     = parts.length ? Math.round(attendedCount/parts.length*100) : 0;

  wrap.innerHTML=`
    ${teamHtml}
    <!-- Attendance Summary Bar -->
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:16px;padding:14px 18px;
      background:linear-gradient(135deg,#0f172a,#1a2744);border-radius:12px;
      border:1px solid rgba(99,102,241,0.2);flex-wrap:wrap;">
      <div style="text-align:center;">
        <div style="font-size:24px;font-weight:900;color:#10b981;font-family:'Outfit',sans-serif;">${attendedCount}</div>
        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Attended</div>
      </div>
      <div style="width:1px;height:36px;background:rgba(255,255,255,0.08);"></div>
      <div style="text-align:center;">
        <div style="font-size:24px;font-weight:900;color:#ef4444;font-family:'Outfit',sans-serif;">${absentCount}</div>
        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Absent</div>
      </div>
      <div style="width:1px;height:36px;background:rgba(255,255,255,0.08);"></div>
      <div style="text-align:center;">
        <div style="font-size:24px;font-weight:900;color:#e2e8f0;font-family:'Outfit',sans-serif;">${parts.length}</div>
        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Total</div>
      </div>
      <div style="flex:1;min-width:140px;margin-left:4px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:12px;color:#9ca3af;">Attendance Rate</span>
          <span style="font-size:12px;font-weight:700;color:#10b981;">${attendPct}%</span>
        </div>
        <div style="height:7px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${attendPct}%;background:linear-gradient(90deg,#10b981,#34d399);border-radius:4px;transition:width 0.5s ease;"></div>
        </div>
      </div>
      <div style="font-size:11px;color:#6b7280;border-left:1px solid rgba(255,255,255,0.06);padding-left:14px;">
        🎓 Marking <strong style="color:#a5b4fc;">Attended</strong> auto-awards<br>AICTE points &amp; certificate
      </div>
    </div>

    <!-- Participants Table -->
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>#</th><th>Name</th><th>USN</th><th>Branch / Sem</th><th>Phone</th><th>Email</th><th>Attendance</th></tr></thead>
        <tbody>
          ${parts.map((p,i)=>{
            const isAtt = attended.includes(p.id);
            return `
            <tr>
              <td>${i+1}</td>
              <td><div class="td-name">${titleCase(p.name)}</div></td>
              <td>${p.usn||'—'}</td>
              <td>${p.branch||'—'} • ${p.sem||'—'}</td>
              <td>${p.phone||'—'}</td>
              <td>${p.email}</td>
              <td>
                <button
                  onclick="toggleAttendance('${evId}','${p.id}')"
                  style="padding:5px 14px;border-radius:20px;border:1px solid ${isAtt?'rgba(16,185,129,0.35)':'rgba(239,68,68,0.3)'};
                  background:${isAtt?'rgba(16,185,129,0.12)':'rgba(239,68,68,0.1)'};
                  color:${isAtt?'#10b981':'#ef4444'};cursor:pointer;font-size:12px;font-weight:700;
                  transition:all 0.2s;white-space:nowrap;">
                  ${isAtt?'✅ Attended':'❌ Not Attended'}
                </button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:10px;font-size:12px;color:#9ca3af;">
      Total: ${parts.length} registered &nbsp;|&nbsp; ${attendedCount} attended &nbsp;|&nbsp; ${absentCount} absent
    </div>
  `;
}

/* Toggle attendance and award / revoke rewards */
window.toggleAttendance = async function(eventId, userId) {
  if (window._isTogglingAttendance) return;
  window._isTogglingAttendance = true;

  try {
    const events = getDB('vvce_events');
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;
    if (!ev.attendedStudents) ev.attendedStudents = [];

    const isAtt = ev.attendedStudents.includes(userId);
    if (isAtt) {
      ev.attendedStudents = ev.attendedStudents.filter(id => id !== userId);
      renderParticipantTable(); // Update instantly for UX
      await applyAttendanceRewards(eventId, userId, false, ev); // revoke certs + points first
      await setDB('vvce_events', events);                       // then save event state
      toast('Marked as Not Attended — AICTE points & certificate revoked.', 'info');
    } else {
      ev.attendedStudents.push(userId);
      renderParticipantTable(); // Update instantly for UX
      await applyAttendanceRewards(eventId, userId, true, ev);  // award certs + points first
      await setDB('vvce_events', events);                       // then save event state
      toast('Marked as Attended! 🎓 AICTE points & certificate awarded.', 'success');
    }
  } finally {
    window._isTogglingAttendance = false;
  }
};

async function applyAttendanceRewards(eventId, userId, attended, ev) {
  let certs = getDB('vvce_certs');
  /* Remove any existing auto-cert for this user + event first (deduplication) */
  const targetCertId = `ac_${eventId}_${userId}`;
  certs = certs.filter(c => c.id !== targetCertId);
  if (attended) {
    certs.push({
      id: `ac_${eventId}_${userId}`,  // Deterministic ID prevents duplicates on re-award
      userId,
      title: ev.name,
      issuer: ev.club || 'VVCE',
      date: ev.date,
      position: 'Participant',
      points: ev.points || 0,
      type: 'participation',
      verified: true,
      autoGenerated: true,
      eventId
    });
  }
  await setDB('vvce_certs', certs); // Save cert changes first

  // Update user's points and pointsBySem
  const pts = ev.points || 0;
  if (pts > 0) {
    const allUsers = getDB('vvce_users');
    const student = allUsers.find(u => u.id === userId);
    if (student) {
      if (!student.pointsBySem) student.pointsBySem = {};
      
      // Determine exactly which semester the student was in when the event happened!
      const computed = computeStudentYearSem(student, ev.date);
      const sem = computed.sem !== '—' ? computed.sem : (student.sem || 'Sem 1');
      
      if (attended) {
        student.points = (student.points || 0) + pts;
        student.pointsBySem[sem] = (student.pointsBySem[sem] || 0) + pts;
      } else {
        student.points = Math.max(0, (student.points || 0) - pts);
        student.pointsBySem[sem] = Math.max(0, (student.pointsBySem[sem] || 0) - pts);
      }
      // Update STATE.user if this is the currently logged-in user
      if (STATE.user && STATE.user.id === userId) {
        STATE.user.points = student.points;
        STATE.user.pointsBySem = student.pointsBySem;
      }
      await setDB('vvce_users', allUsers); // Save user points after cert
    }
  }
}


/* Helper to verify if current user is the Dean of Student Welfare */
function isDeanUser(user = STATE.user) {
  if (!user) return false;
  return user.type === 'authority' && (
    user.designation === 'dean' ||
    (user.email && user.email.toLowerCase() === 'dean.sw@vvce.ac.in') ||
    (user.email && user.email.toLowerCase().startsWith('dean'))
  );
}
