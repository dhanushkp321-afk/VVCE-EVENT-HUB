/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Create & Edit Event Form
   Path: js/pages/create-event.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   CREATE EVENT PAGE
───────────────────────────────────────────────────────────────*/
function renderCreateEventPage() {
  const el = document.getElementById('page-create-event');
  el.innerHTML = `
    <div class="create-ev-wrap">
      <div class="create-ev-title">Create New Event</div>
      <div class="create-ev-sub">Fill in the details below. Event will be sent for authority approval.</div>
      <div class="create-ev-card">

        <div class="form-row">
          <div class="form-group"><label>Event Name *</label><input type="text" id="ev-name" placeholder="e.g. HackVVCE 2025"></div>
          <div class="form-group"><label>Club / Organizer Name *</label><input type="text" id="ev-club" value="${STATE.user.clubName||''}" placeholder="e.g. CSE Club"></div>
        </div>

        <div class="form-group" style="background:#fffbeb; border:1.5px solid #fde68a; border-radius:12px; padding:14px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label style="font-weight:700; color:#b45309; margin:0; display:flex; align-items:center; gap:6px;">
              📝 Event Description *
            </label>
            <span style="font-size:11px; background:#fef3c7; color:#b45309; border:1px solid #fcd34d; padding:2px 8px; border-radius:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">⚠️ Important</span>
          </div>
          <textarea id="ev-desc" rows="4" placeholder="Provide a detailed description of the event, itinerary, prizes, key takeaways, etc." style="width:100%; border:1.5px solid #fcd34d; border-radius:8px; padding:10px 12px; font-size:13.5px; background:#ffffff; outline:none; box-sizing:border-box; font-family:'Inter',sans-serif;"></textarea>
          <div style="font-size:11px; color:#92400e; margin-top:5px; font-weight:500;">💡 Detailed descriptions attract more students and help with authority approval.</div>
        </div>

        <div class="form-row" style="grid-template-columns:1fr 1fr 1fr;">
          <div class="form-group"><label>Event Date *</label><input type="date" id="ev-date"></div>
          <div class="form-group"><label>Start Time *</label><input type="time" id="ev-time"></div>
          <div class="form-group" id="ev-max-wrap">
            <label id="ev-max-label">Max Participants *</label>
            <input type="number" id="ev-max" value="100" min="5">
            <div id="ev-max-team-hint" style="display:none; font-size:11px; color:#7c3aed; margin-top:4px; font-weight:600;">
              Auto-calculated from Max Teams × Max Members
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Venue *</label>
            <select id="ev-venue">
              <option value="Seminar Hall A">Seminar Hall A</option>
              <option value="Seminar Hall B">Seminar Hall B</option>
              <option value="Main Auditorium">Main Auditorium</option>
              <option value="Mechanical Seminar Hall">Mechanical Seminar Hall</option>
              <option value="EC Seminar Hall">EC Seminar Hall</option>
              <option value="Computer Lab 1">Computer Lab 1</option>
              <option value="Computer Lab 2">Computer Lab 2</option>
              <option value="Sports Ground">Sports Ground</option>
              <option value="Conference Room B">Conference Room B</option>
            </select>
          </div>
          <div class="form-group">
            <label>Category *</label>
            <select id="ev-cat">
              <option>Technical</option><option>Cultural</option>
              <option>Sports</option><option>Workshop</option>
              <option>Management</option><option>Social</option>
            </select>
          </div>
        </div>

        <!-- Target Branches -->
        <div class="form-group" style="margin-bottom:18px;">
          <label style="display:flex;align-items:center;gap:8px;font-weight:700;color:#1e293b;margin-bottom:4px;">
            🎓 Target Branches (Select Multiple)
          </label>
          <div style="font-size:12px;color:#64748b;margin-bottom:10px;">
            Click to select one, multiple, or all eligible branches for this event:
          </div>
          <div id="branch-pills-wrap" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));gap:10px;">
            <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;cursor:pointer;user-select:none;">
              <input type="checkbox" name="target-branch" value="All" checked onchange="handleBranchCheckboxChange(this)" style="width:16px;height:16px;accent-color:#4f46e5;cursor:pointer;">
              <span style="font-size:13px;font-weight:700;color:#0f172a;">🏫 All Branches</span>
            </label>
            <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;cursor:pointer;user-select:none;">
              <input type="checkbox" name="target-branch" value="CSE" onchange="handleBranchCheckboxChange(this)" style="width:16px;height:16px;accent-color:#4f46e5;cursor:pointer;">
              <span style="font-size:13px;font-weight:600;color:#334155;">💻 CSE</span>
            </label>
            <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;cursor:pointer;user-select:none;">
              <input type="checkbox" name="target-branch" value="CSE/AIML" onchange="handleBranchCheckboxChange(this)" style="width:16px;height:16px;accent-color:#4f46e5;cursor:pointer;">
              <span style="font-size:13px;font-weight:600;color:#334155;">🤖 CSE / AI&amp;ML</span>
            </label>
            <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;cursor:pointer;user-select:none;">
              <input type="checkbox" name="target-branch" value="ISE" onchange="handleBranchCheckboxChange(this)" style="width:16px;height:16px;accent-color:#4f46e5;cursor:pointer;">
              <span style="font-size:13px;font-weight:600;color:#334155;">🖥️ ISE</span>
            </label>
            <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;cursor:pointer;user-select:none;">
              <input type="checkbox" name="target-branch" value="ECE" onchange="handleBranchCheckboxChange(this)" style="width:16px;height:16px;accent-color:#4f46e5;cursor:pointer;">
              <span style="font-size:13px;font-weight:600;color:#334155;">📡 ECE</span>
            </label>
            <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;cursor:pointer;user-select:none;">
              <input type="checkbox" name="target-branch" value="ME" onchange="handleBranchCheckboxChange(this)" style="width:16px;height:16px;accent-color:#4f46e5;cursor:pointer;">
              <span style="font-size:13px;font-weight:600;color:#334155;">⚙️ ME (Mech)</span>
            </label>
            <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;cursor:pointer;user-select:none;">
              <input type="checkbox" name="target-branch" value="EEE" onchange="handleBranchCheckboxChange(this)" style="width:16px;height:16px;accent-color:#4f46e5;cursor:pointer;">
              <span style="font-size:13px;font-weight:600;color:#334155;">⚡ EEE</span>
            </label>
            <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;cursor:pointer;user-select:none;">
              <input type="checkbox" name="target-branch" value="CV" onchange="handleBranchCheckboxChange(this)" style="width:16px;height:16px;accent-color:#4f46e5;cursor:pointer;">
              <span style="font-size:13px;font-weight:600;color:#334155;">🏗️ CV (Civil)</span>
            </label>
          </div>
        </div>

        <div class="form-divider">Additional Details</div>

        <div class="toggle-row">
          <label class="toggle-sw"><input type="checkbox" id="ev-gives-points" checked><span class="toggle-track"></span></label>
          <div class="toggle-info">
            <div class="toggle-lbl">This event provides AICTE Activity Points</div>
            <div class="toggle-desc">Toggle on to award points to participants</div>
          </div>
        </div>
        <div id="ev-points-wrap" class="form-group" style="margin-left:56px;">
          <label>AICTE Points Awarded</label>
          <input type="number" id="ev-points" value="10" min="0">
        </div>

        <!-- Team / Group Event Configuration Card -->
        <div id="team-event-card-wrap" style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:12px; padding:14px 16px; margin-bottom:14px; transition:all 0.2s;">
          <div style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;" onclick="const cb = document.getElementById('ev-is-team'); cb.checked = !cb.checked; toggleTeamFields();">
            <div style="display:flex; align-items:center; gap:12px;">
              <span style="font-size:24px;">👥</span>
              <div>
                <div style="font-weight:700; font-size:14px; color:#0f172a;" id="team-card-title">This is a Team / Group Event</div>
                <div style="font-size:12px; color:#64748b;" id="team-card-sub">Enable to allow students to form teams, set a team name, and invite teammates via email</div>
              </div>
            </div>
            <label class="toggle-sw" onclick="event.stopPropagation();">
              <input type="checkbox" id="ev-is-team" onchange="toggleTeamFields()">
              <span class="toggle-track"></span>
            </label>
          </div>
          
          <div id="ev-team-wrap" style="display:none; margin-top:14px; padding-top:12px; border-top:1px solid #e2e8f0;">
            <div style="font-size:12px; font-weight:700; color:#7c3aed; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:8px;">
              👥 Team Size Limits (Including Team Leader)
            </div>
            <div class="form-row" style="grid-template-columns:1fr 1fr 1fr; margin-bottom:0;">
              <div class="form-group" style="margin-bottom:0;">
                <label style="font-size:12px; font-weight:600; color:#374151;">Minimum Members *</label>
                <input type="number" id="ev-team-min" value="2" min="1" max="20" style="background:#ffffff; border:1.5px solid #c4b5fd;" onchange="updateMaxParticipantsFromTeam()">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label style="font-size:12px; font-weight:600; color:#374151;">Maximum Members *</label>
                <input type="number" id="ev-team-max" value="4" min="1" max="20" style="background:#ffffff; border:1.5px solid #c4b5fd;" onchange="updateMaxParticipantsFromTeam()">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label style="font-size:12px; font-weight:700; color:#6d28d9;">Max Teams *</label>
                <input type="number" id="ev-max-teams" value="20" min="1" style="background:#ffffff; border:1.5px solid #8b5cf6;" oninput="updateMaxParticipantsFromTeam()">
                <div style="font-size:10.5px; color:#6d28d9; margin-top:3px; font-weight:500;">Total = Teams × Max Members</div>
              </div>
            </div>
          </div>
        </div>

        <div class="toggle-row">
          <label class="toggle-sw"><input type="checkbox" id="ev-needs-payment"><span class="toggle-track"></span></label>
          <div class="toggle-info">
            <div class="toggle-lbl">Require Payment Proof</div>
            <div class="toggle-desc" style="color:#ef4444;">Future feature — no payment gateway active. Students will need to upload payment screenshot for registration.</div>
          </div>
        </div>

        <div class="form-row" style="margin-top:10px;">
          <div class="form-group"><label>Entry Fee (₹) — 0 = Free</label><input type="number" id="create-ev-fee" value="0" min="0"></div>
          <div class="form-group"><label>Club UPI ID (for payments)</label><input type="text" id="create-ev-upi" placeholder="e.g. clubname@upi"></div>
        </div>

        <div class="form-group"><label>Speakers / Resource Persons</label><input type="text" id="ev-speakers" placeholder="Dr. Ramesh Kumar, Prof. Meena S"></div>

        <div class="form-group" style="background:#fef2f2; border:1.5px solid #fecaca; border-radius:12px; padding:14px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label style="font-weight:700; color:#b91c1c; margin:0; display:flex; align-items:center; gap:6px;">
              ⚖️ Rules / Terms & Guidelines *
            </label>
            <span style="font-size:11px; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; padding:2px 8px; border-radius:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">⚠️ Crucial</span>
          </div>
          <textarea id="ev-rules" rows="3" placeholder="Specify team guidelines, eligibility criteria, submission rules, dress code, dos and don'ts..." style="width:100%; border:1.5px solid #fca5a5; border-radius:8px; padding:10px 12px; font-size:13.5px; background:#ffffff; outline:none; box-sizing:border-box; font-family:'Inter',sans-serif;"></textarea>
          <div style="font-size:11px; color:#991b1b; margin-top:5px; font-weight:500;">💡 Clearly stated rules prevent disputes and guide participants during the event.</div>
        </div>

        <div class="form-divider">Event Poster (optional)</div>
        <div class="upload-zone" onclick="document.getElementById('ev-poster-input').click()">
          <div class="upload-icon">🖼️</div>
          <p id="ev-poster-txt">Click to upload event poster</p>
          <span>PNG, JPG supported</span>
          <input type="file" id="ev-poster-input" accept="image/*" style="display:none;" onchange="handlePosterUpload(event)">
          <input type="hidden" id="ev-poster-data" value="">
        </div>
        <img id="ev-poster-preview" style="display:none;width:100%;max-height:180px;object-fit:cover;border-radius:10px;margin-top:8px;">

        <div class="create-form-btns">
          <button class="btn-create-draft" onclick="submitEvent('draft')">Save as Draft</button>
          <button class="btn-create-submit" onclick="submitEvent('pending')">Submit for Dean Approval →</button>
        </div>
      </div>
    </div>
  `;

  // Toggle points fields
  document.getElementById('ev-gives-points').addEventListener('change', function() {
    document.getElementById('ev-points-wrap').style.display = this.checked ? '' : 'none';
  });
}

window.handleBranchCheckboxChange = function(cb) {
  const allCb = document.querySelector('input[name="target-branch"][value="All"]');
  const others = [...document.querySelectorAll('input[name="target-branch"]:not([value="All"])')];
  
  if (cb.value === 'All') {
    if (cb.checked) {
      others.forEach(o => o.checked = false);
    }
  } else {
    if (cb.checked && allCb) {
      allCb.checked = false;
    }
    if (!others.some(o => o.checked) && allCb) {
      allCb.checked = true;
    }
  }
};

function handlePosterUpload(e) {
  const file=e.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=ev=>{
    document.getElementById('ev-poster-data').value=ev.target.result;
    document.getElementById('ev-poster-txt').textContent='📎 '+file.name;
    const prev=document.getElementById('ev-poster-preview'); prev.src=ev.target.result; prev.style.display='';
  };
  r.readAsDataURL(file);
}

let _isSubmittingEvent = false;

async function submitEvent(status='pending') {
  if (_isSubmittingEvent) return;

  const name  = document.getElementById('ev-name').value.trim();
  const club  = document.getElementById('ev-club').value.trim();
  const date  = document.getElementById('ev-date').value;
  const time  = document.getElementById('ev-time').value;
  const max   = parseInt(document.getElementById('ev-max').value||'100');
  const venue    = document.getElementById('ev-venue').value;
  const cat      = document.getElementById('ev-cat').value;
  const checkedBranchEls = [...document.querySelectorAll('input[name="target-branch"]:checked')];
  let branches = checkedBranchEls.map(cb => cb.value);
  if (!branches.length || branches.includes('All')) {
    branches = ['All'];
  }

  if (!name||!club||!date||!time||!venue) { toast('Please fill all required fields (marked with *).','error'); return; }
  const userClub = STATE.user;
  const authorityId = userClub.authorityId || null;
  const authorityName = userClub.authorityName || 'Approving Authority';
  const fee = parseInt(document.getElementById('create-ev-fee').value||'0');
  const upiId = document.getElementById('create-ev-upi')?.value.trim() || '';
  if (fee > 0 && !upiId) {
    toast('⚠️ You set a registration fee but no UPI ID. Students won\'t be able to pay. Add a UPI ID or set fee to 0.', 'error');
    return;
  }

  const isTeamEvent = document.getElementById('ev-is-team')?.checked || false;
  const minTeamSize = isTeamEvent ? parseInt(document.getElementById('ev-team-min')?.value || '2') : 1;
  const maxTeamSize = isTeamEvent ? parseInt(document.getElementById('ev-team-max')?.value || '4') : 1;
  const maxTeams    = isTeamEvent ? parseInt(document.getElementById('ev-max-teams')?.value || '20') : 0;

  if (isTeamEvent && (!maxTeams || maxTeams < 1)) {
    toast('⚠️ Please enter the maximum number of teams allowed.', 'error');
    return;
  }

  // Prevent duplicate requests and lock submit buttons
  _isSubmittingEvent = true;
  const submitBtn = document.querySelector('.btn-create-submit');
  const draftBtn  = document.querySelector('.btn-create-draft');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = status === 'pending' ? 'Sending Request to Dean... ⏳' : 'Saving Draft... ⏳';
    submitBtn.style.opacity = '0.65';
    submitBtn.style.cursor = 'not-allowed';
  }
  if (draftBtn) {
    draftBtn.disabled = true;
    draftBtn.style.opacity = '0.65';
    draftBtn.style.cursor = 'not-allowed';
  }

  try {
    // For team events: capacity = maxTeams × maxTeamSize (auto-computed)
    // For solo events: use the manually entered Max Participants
    const computedMax = isTeamEvent ? (maxTeams * maxTeamSize) : max;

    const events = getDB('vvce_events');
    const ev = {
      id: genId('ev'), name, club, adminId: STATE.user.id,
      emoji: '🎓', category: cat, date, time,
      endDate: date, endTime: '',
      venue, maxParticipants: computedMax, regCount: 0,
      fee,
      adminUpiId: upiId,
      points: document.getElementById('ev-gives-points').checked ? parseInt(document.getElementById('ev-points').value||'0') : 0,
      desc: document.getElementById('ev-desc').value.trim(),
      speakers: document.getElementById('ev-speakers').value.trim(),
      rules: document.getElementById('ev-rules').value.trim(),
      poster: document.getElementById('ev-poster-data').value||null,
      branches: branches.length ? branches : ['All'],
      isTeamEvent, minTeamSize, maxTeamSize,
      teams: [],
      status, rejReason: null, registrations: [], pendingPayments: [],
      authorityId: authorityId,
      authorityName: authorityName,
      decisionHistory: [{
        action: 'submitted',
        authorityId: authorityId,
        authorityName: authorityName,
        timestamp: new Date().toISOString()
      }]
    };
    events.push(ev);
    await setDB('vvce_events', events);

    // Directly upsert single event to Supabase to guarantee reflection across devices
    const sb = getSupabaseClient();
    if (sb) {
      try {
        await sb.from('events').upsert([mapEventForSupabase(ev)]);
        await syncEventsFromSupabase();
  syncApprovingAuthoritiesFromSupabase();
      } catch(e) { console.warn('Supabase direct event upsert:', e); }
    }

    if (status==='pending') {
      toast(`Event request "${name}" sent to ${authorityName} for approval! ⏳`, 'success');
      // Notify authority
      const users=getDB('vvce_users');
      users.filter(u=>u.type==='authority').forEach(u=>{
        if(!u.notifs) u.notifs=[];
        u.notifs.push({id:genId('n'),msg:`New event "${name}" by ${club} needs your approval.`,icon:'📋',time:'Just now',timestamp:Date.now(),read:false});
      });
      await setDB('vvce_users',users);
      // Go back to home menu as requested
      showPage('admin-dashboard');
    } else {
      toast(`Event saved as draft.`,'info');
      showPage('manage-events');
    }
  } catch (err) {
    console.error('Error submitting event:', err);
    toast('Error submitting event: ' + err.message, 'error');
  } finally {
    _isSubmittingEvent = false;
  }
}

