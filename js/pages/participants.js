/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Participants Management & QR Attendance Scanner
   Path: js/pages/participants.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   PARTICIPANTS PAGE (Admin)
───────────────────────────────────────────────────────────────*/
function renderParticipantsPage() {
  const myEvents = getDB('vvce_events').filter(e => e.adminId === STATE.user.id && e.status === 'approved');
  const allUsers = getDB('vvce_users');
  const el = document.getElementById('page-participants');

  if (!myEvents.length) {
    el.innerHTML = `<div class="empty-state"><div class="ei">👥</div><div class="et">No approved events</div></div>`;
    return;
  }

  let pendingHtml = '';
  let pendingCount = 0;

  myEvents.forEach(ev => {
    const queue = (ev.pendingPayments || []).filter(p => {
      const st = p.status || 'pending_approval';
      return st === 'pending_approval';
    });

    queue.forEach(p => {
      const student = allUsers.find(u => u.id === p.uid);
      const displayName = student?.name || p.userName || 'Student';
      const displayId = student?.usn || p.usn || student?.email || p.userEmail || p.uid;
      const team = p.teamId
        ? (ev.teams || []).find(t => String(t.id) === String(p.teamId))
        : (p.teamData?.teamId ? (ev.teams || []).find(t => String(t.id) === String(p.teamData.teamId)) : null);

      const isGroup = Boolean(p.isTeam || team);
      const memberIds = team ? (team.memberIds || []) : [p.uid];
      const rosterMembers = memberIds.map(mid => {
        const u = allUsers.find(usr => usr.id === mid);
        return u ? `${titleCase(u.name)}${u.usn ? ` (${u.usn})` : ''}` : (mid === p.uid ? titleCase(displayName) : mid);
      });

      pendingCount++;
      const screenshotKey = `${ev.id}::${p.uid}${team ? '::' + team.id : ''}`;
      PENDING_SCREENSHOTS[screenshotKey] = p.screenshot || '';
      const hasScreenshot = !!p.screenshot;
      const utrText = p.utrNumber || p.utr_number || '';
      const teamIdArg = team ? team.id : '';
      const submittedStr = p.submittedAt || p.date || new Date().toISOString();

      pendingHtml += `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;padding:14px 16px;
          background:linear-gradient(135deg,#1e1a2e,#2d1f3d);border-radius:12px;margin-bottom:10px;
          border:1px solid rgba(251,191,36,0.35);flex-wrap:wrap;gap:12px;">
          <div style="flex:1;min-width:220px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
              <span style="font-weight:800;color:#fbbf24;font-size:14px;">
                ${isGroup ? `👥 Team: ${team?.name || p.teamName || p.teamData?.teamName || 'Team'}` : `👤 ${titleCase(displayName)}`}
              </span>
              <span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:10px;background:${isGroup ? 'rgba(139,92,246,0.22)' : 'rgba(59,130,246,0.22)'};color:${isGroup ? '#ddd6fe' : '#bfdbfe'};">
                ${isGroup ? `Group (${rosterMembers.length} members)` : 'Solo'}
              </span>
              ${(ev.fee > 0 || ev.needsPayment)
                ? `<span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(245,158,11,0.2);color:#fde68a;">💳 ₹${ev.fee || 0}</span>`
                : `<span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(16,185,129,0.2);color:#a7f3d0;">🆓 Free Entry</span>`
              }
            </div>
            <div style="font-size:12px;color:#e2e8f0;margin-bottom:3px;">
              <strong>${ev.name}</strong> &bull; Lead / Registrant: ${titleCase(displayName)} (${displayId})
            </div>
            ${isGroup ? `
              <div style="font-size:11.5px;color:#cbd5e1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:6px 10px;margin:6px 0;">
                <strong style="color:#a5b4fc;">Confirmed Team Roster:</strong> ${rosterMembers.join(', ')}
              </div>` : ''}
            ${utrText ? `<div style="font-size:11.5px;color:#93c5fd;margin-top:3px;">🔢 <strong>UTR / Transaction ID:</strong> <code style="background:rgba(15,23,42,0.7);padding:2px 6px;border-radius:4px;color:#f8fafc;">${utrText}</code></div>` : ''}
            <div style="font-size:11px;color:#9ca3af;margin-top:3px;">Submitted: ${formatDate(submittedStr.split('T')[0])}</div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;align-self:center;">
            ${hasScreenshot
              ? `<button type="button" onclick="viewScreenshot('${screenshotKey}')" style="padding:8px 12px;background:#3b82f6;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:11.5px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                  📸 View Payment Proof
                 </button>`
              : ((ev.fee > 0 || ev.needsPayment) ? `<span style="padding:8px 12px;background:#374151;color:#9ca3af;border-radius:8px;font-size:11px;">No screenshot</span>` : '')
            }
            <button type="button" onclick="approvePayment('${ev.id}','${p.uid}','${teamIdArg}',this)" style="padding:8px 14px;background:#10b981;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:11.5px;cursor:pointer;">✅ Approve &amp; Confirm Registration</button>
            <button type="button" onclick="rejectPayment('${ev.id}','${p.uid}','${teamIdArg}',this)" style="padding:8px 12px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:11.5px;cursor:pointer;">✕ Reject</button>
          </div>
        </div>`;
    });
  });

  let html = `
    <div style="margin-bottom:18px; background:rgba(15,23,42,0.03); border:1px solid #e2e8f0; border-radius:14px; padding:14px 16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <div style="font-weight:800;color:#0f172a;font-size:15px;">⏳ Pending Registrations / Verify Payments (${pendingCount})</div>
        <span style="font-size:11.5px;color:#64748b;">Verify payment proofs &amp; team rosters before confirming seats</span>
      </div>
      ${pendingHtml || `<div style="font-size:12.5px;color:#64748b;padding:8px 0;">✅ No registrations or payment proofs waiting for verification right now.</div>`}
    </div>
    <div class="filter-row">
      <select class="filter-sel" id="part-ev-filter" onchange="renderParticipantTable()">
        ${myEvents.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
      </select>
      <input class="search-inp" id="part-search" placeholder="🔍 Search participant…" oninput="renderParticipantTable()">
    </div>
    <div id="part-table-wrap"></div>
  `;
  el.innerHTML = html;
  renderParticipantTable();
}

window.viewScreenshot = function(key) {
  const src = PENDING_SCREENSHOTS[key] || key;
  if (!src || src === 'undefined') {
    toast('No screenshot available for this submission.', 'error');
    return;
  }
  document.getElementById('screenshot-img-view').src = src;
  openModal('modal-screenshot');
};

window.approvePayment = async function(eventId, uid, teamId = '', btn = null) {
  if (!confirm('Approve and confirm this registration? Remaining seat capacity will be verified.')) return;

  const origText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Confirming... ⏳'; }

  try {
    const events = getDB('vvce_events');
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;

    const pmt = (ev.pendingPayments || []).find(p =>
      (p.uid === uid && (!teamId || !p.teamId || String(p.teamId) === String(teamId))) ||
      (teamId && String(p.teamId || p.teamData?.teamId) === String(teamId))
    );
    const resolvedTeamId = teamId || pmt?.teamId || pmt?.teamData?.teamId || null;
    const team = resolvedTeamId ? (ev.teams || []).find(t => String(t.id) === String(resolvedTeamId)) : null;

    const memberIdsToConfirm = team ? [...new Set(team.memberIds || [uid])] : [uid];
    const currentRegs = [...(ev.registrations || [])];
    const newSeatsNeeded = memberIdsToConfirm.filter(id => !currentRegs.includes(id)).length;
    const maxCap = ev.maxParticipants || ev.max_participants || 100;

    if (currentRegs.length + newSeatsNeeded > maxCap) {
      const seatsLeft = Math.max(0, maxCap - currentRegs.length);
      toast(`❌ Cannot approve: only ${seatsLeft} seat(s) left (needs ${newSeatsNeeded}).`, 'error', 5500);
      return;
    }

    const reviewerName = STATE.user?.name || 'Organizer';
    const reviewedAt = new Date().toISOString();
    const sb = getSupabaseClient();
    let rpcHandled = false;

    if (sb && typeof sb.rpc === 'function') {
      try {
        const { data: rpcData, error: rpcErr } = await sb.rpc('approve_registration_atomic', {
          p_event_id: eventId,
          p_user_id: uid,
          p_reviewer_name: reviewerName,
          p_team_id: resolvedTeamId
        });
        if (!rpcErr && rpcData) {
          if (!rpcData.success) {
            toast(`❌ ${rpcData.error || 'Approval blocked due to capacity limit.'}`, 'error', 5500);
            return;
          }
          rpcHandled = true;
        }
      } catch (e) {
        console.warn('approve_registration_atomic RPC fallback to direct update:', e);
      }
    }

    // Update local + event state cleanly
    memberIdsToConfirm.forEach(id => {
      if (!currentRegs.includes(id)) currentRegs.push(id);
    });
    ev.registrations = currentRegs;
    ev.regCount = currentRegs.length;

    if (team) {
      team.status = 'registered';
      team.paymentStatus = 'approved';
      team.rejectionReason = null;
      team.reviewedBy = reviewerName;
      team.reviewedAt = reviewedAt;
    }
    if (pmt) {
      pmt.status = 'registered';
      pmt.rejectionReason = null;
      pmt.reviewedBy = reviewerName;
      pmt.reviewedAt = reviewedAt;
    }

    if (!rpcHandled && sb && typeof sb.from === 'function') {
      await sb.from('events').update({
        registrations: ev.registrations,
        reg_count: ev.regCount,
        pending_payments: ev.pendingPayments,
        teams: ev.teams
      }).eq('id', eventId).catch(() => {});

      await sb.from('event_registrations').update({
        status: 'registered',
        rejection_reason: null,
        reviewed_by: reviewerName,
        reviewed_at: reviewedAt,
        updated_at: reviewedAt
      }).eq('event_id', eventId).eq('user_id', uid).catch(() => {});
    }

    await setDB('vvce_events', events);

    memberIdsToConfirm.forEach(memberId => {
      addNotifToUser(
        memberId,
        team
          ? `Registration CONFIRMED for "${ev.name}" (Team "${team.name}")! 🎉 Your spot is locked in.`
          : `Registration CONFIRMED for "${ev.name}"! 🎉 Your spot is locked in.`,
        '✅'
      );
    });

    toast('Registration approved and confirmed! 🎉', 'success');
    renderParticipantsPage();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
  }
};

window.rejectPayment = async function(eventId, uid, teamId = '', btn = null) {
  const reason = prompt('Enter reason for rejecting this registration / payment proof (e.g. blurred screenshot or mismatched UTR):');
  if (reason === null) return;
  const cleanReason = reason.trim() || 'Payment proof or registration details could not be verified. Please re-upload.';

  const origText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Rejecting...'; }

  try {
    const events = getDB('vvce_events');
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;

    const pmt = (ev.pendingPayments || []).find(p =>
      (p.uid === uid && (!teamId || !p.teamId || String(p.teamId) === String(teamId))) ||
      (teamId && String(p.teamId || p.teamData?.teamId) === String(teamId))
    );
    const resolvedTeamId = teamId || pmt?.teamId || pmt?.teamData?.teamId || null;
    const team = resolvedTeamId ? (ev.teams || []).find(t => String(t.id) === String(resolvedTeamId)) : null;

    const reviewerName = STATE.user?.name || 'Organizer';
    const reviewedAt = new Date().toISOString();

    if (pmt) {
      pmt.status = 'rejected';
      pmt.rejectionReason = cleanReason;
      pmt.reviewedBy = reviewerName;
      pmt.reviewedAt = reviewedAt;
    }
    if (team) {
      team.status = 'rejected';
      team.paymentStatus = 'rejected';
      team.rejectionReason = cleanReason;
      team.reviewedBy = reviewerName;
      team.reviewedAt = reviewedAt;
    }

    const sb = getSupabaseClient();
    if (sb && typeof sb.from === 'function') {
      await sb.from('events').update({
        pending_payments: ev.pendingPayments,
        teams: ev.teams
      }).eq('id', eventId).catch(() => {});

      await sb.from('event_registrations').update({
        status: 'rejected',
        rejection_reason: cleanReason,
        reviewed_by: reviewerName,
        reviewed_at: reviewedAt,
        updated_at: reviewedAt
      }).eq('event_id', eventId).eq('user_id', uid).catch(() => {});
    }

    await setDB('vvce_events', events);
    addNotifToUser(uid, `Registration/Payment for "${ev.name}" was rejected: ${cleanReason}. You can re-upload your proof from My Registrations.`, '❌');
    toast('Submission rejected with reason.', 'info');
    renderParticipantsPage();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
  }
};

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
        🎓 Marking <strong style="color:#a5b4fc;">Attended</strong> auto-awards<br>Participation Certificate
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
      toast('Marked as Not Attended — certificate revoked.', 'info');
    } else {
      ev.attendedStudents.push(userId);
      renderParticipantTable(); // Update instantly for UX
      await applyAttendanceRewards(eventId, userId, true, ev);  // issue/revoke certificate
      await setDB('vvce_events', events);                       // then save event state
      toast('Marked as Attended! 🎓 Participation certificate awarded.', 'success');
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
      type: 'participation',
      verified: true,
      autoGenerated: true,
      eventId
    });
  }
  await setDB('vvce_certs', certs); // Save cert changes
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
