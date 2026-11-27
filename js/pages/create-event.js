/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Create & Edit Event Form
   Path: js/pages/create-event.js
   ═══════════════════════════════════════════════════════════════ */

let _clashDebounceTimer = null;
let _clashCheckSeq = 0;
let _isCheckingClash = false;
let _hasVenueClash = false;
let _hasInvalidTimeRange = false;
let _isSubmittingEvent = false;

/* ─────────────────────────────────────────────────────────────
   CREATE / EDIT EVENT PAGE
───────────────────────────────────────────────────────────────*/
window.editClubEvent = function(eventId) {
  window._pendingEditEventId = eventId;
  showPage('create-event');
};

function renderCreateEventPage(explicitEditId = null) {
  const editId = explicitEditId || window._pendingEditEventId || null;
  window._pendingEditEventId = null;
  window._editingEventId = editId;

  const events = getDB('vvce_events');
  const existingEv = editId ? events.find(e => String(e.id) === String(editId)) : null;
  if (editId && !existingEv) {
    window._editingEventId = null;
  }

  // Reset clash & submit states on fresh page render
  clearTimeout(_clashDebounceTimer);
  _clashCheckSeq++;
  _isCheckingClash = false;
  _hasVenueClash = false;
  _hasInvalidTimeRange = false;
  _isSubmittingEvent = false;

  const selectedBranches = existingEv?.branches?.length ? existingEv.branches : ['All'];
  const isAllBranches = selectedBranches.includes('All');
  const isTeam = !!existingEv?.isTeamEvent;
  const venueOptions = [
    'Seminar Hall A',
    'Seminar Hall B',
    'Main Auditorium',
    'Mechanical Seminar Hall',
    'EC Seminar Hall',
    'Computer Lab 1',
    'Computer Lab 2',
    'Sports Ground',
    'Conference Room B'
  ];
  const existingVenue = existingEv?.venue || 'Seminar Hall A';
  if (existingEv?.venue && !venueOptions.includes(existingEv.venue)) {
    venueOptions.unshift(existingEv.venue);
  }
  const catOptions = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Management', 'Social'];
  const branchChoices = [
    { val: 'All', label: '🏫 All Branches', bold: true },
    { val: 'CSE', label: '💻 CSE' },
    { val: 'CSE/AIML', label: '🤖 CSE / AI&amp;ML' },
    { val: 'ISE', label: '🖥️ ISE' },
    { val: 'ECE', label: '📡 ECE' },
    { val: 'ME', label: '⚙️ ME (Mech)' },
    { val: 'EEE', label: '⚡ EEE' },
    { val: 'CV', label: '🏗️ CV (Civil)' }
  ];

  const el = document.getElementById('page-create-event');
  el.innerHTML = `
    <div class="create-ev-wrap">
      <div class="create-ev-title">${existingEv ? 'Edit Event' : 'Create New Event'}</div>
      <div class="create-ev-sub">${existingEv ? 'Update your event details below. Changes will be validated against active venue bookings.' : 'Fill in the details below. Event will be sent for authority approval.'}</div>
      <div class="create-ev-card">

        <div class="form-row">
          <div class="form-group"><label>Event Name *</label><input type="text" id="ev-name" placeholder="e.g. HackVVCE 2025"></div>
          <div class="form-group"><label>Club / Organizer Name *</label><input type="text" id="ev-club" placeholder="e.g. CSE Club"></div>
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

        <div class="form-row" style="grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));">
          <div class="form-group"><label>Event Date *</label><input type="date" id="ev-date"></div>
          <div class="form-group"><label>Start Time *</label><input type="time" id="ev-time"></div>
          <div class="form-group"><label>End Time *</label><input type="time" id="ev-end-time"></div>
        </div>

        <div class="form-row" style="grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));">
          <div class="form-group">
            <label>Venue *</label>
            <select id="ev-venue">
              ${venueOptions.map(v => `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Category *</label>
            <select id="ev-cat">
              ${catOptions.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" id="ev-max-wrap">
            <label id="ev-max-label">Max Participants *</label>
            <input type="number" id="ev-max" value="${existingEv?.maxParticipants || 100}" min="5">
            <div id="ev-max-team-hint" style="display:none; font-size:11px; color:#7c3aed; margin-top:4px; font-weight:600;">
              Auto-calculated from Max Teams × Max Members
            </div>
          </div>
        </div>

        <!-- Inline Real-Time Venue & Schedule Clash Banner -->
        <div id="ev-clash-banner" style="display:none; margin-bottom:16px;"></div>

        <!-- Target Branches -->
        <div class="form-group" style="margin-bottom:18px;">
          <label style="display:flex;align-items:center;gap:8px;font-weight:700;color:#1e293b;margin-bottom:4px;">
            🎓 Target Branches (Select Multiple)
          </label>
          <div style="font-size:12px;color:#64748b;margin-bottom:10px;">
            Click to select one, multiple, or all eligible branches for this event:
          </div>
          <div id="branch-pills-wrap" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));gap:10px;">
            ${branchChoices.map(b => {
              const checked = b.val === 'All' ? isAllBranches : (!isAllBranches && selectedBranches.includes(b.val));
              return `
                <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;cursor:pointer;user-select:none;">
                  <input type="checkbox" name="target-branch" value="${b.val}" ${checked ? 'checked' : ''} onchange="handleBranchCheckboxChange(this)" style="width:16px;height:16px;accent-color:#4f46e5;cursor:pointer;">
                  <span style="font-size:13px;font-weight:${b.bold ? '700' : '600'};color:${b.bold ? '#0f172a' : '#334155'};">${b.label}</span>
                </label>`;
            }).join('')}
          </div>
        </div>

        <div class="form-divider">Additional Details</div>

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
              <input type="checkbox" id="ev-is-team" ${isTeam ? 'checked' : ''} onchange="toggleTeamFields()">
              <span class="toggle-track"></span>
            </label>
          </div>
          
          <div id="ev-team-wrap" style="display:${isTeam ? 'block' : 'none'}; margin-top:14px; padding-top:12px; border-top:1px solid #e2e8f0;">
            <div style="font-size:12px; font-weight:700; color:#7c3aed; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:8px;">
              👥 Team Size Limits (Including Team Leader)
            </div>
            <div class="form-row" style="grid-template-columns:1fr 1fr 1fr; margin-bottom:0;">
              <div class="form-group" style="margin-bottom:0;">
                <label style="font-size:12px; font-weight:600; color:#374151;">Minimum Members *</label>
                <input type="number" id="ev-team-min" value="${existingEv?.minTeamSize || 2}" min="1" max="20" style="background:#ffffff; border:1.5px solid #c4b5fd;" onchange="updateMaxParticipantsFromTeam()">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label style="font-size:12px; font-weight:600; color:#374151;">Maximum Members *</label>
                <input type="number" id="ev-team-max" value="${existingEv?.maxTeamSize || 4}" min="1" max="20" style="background:#ffffff; border:1.5px solid #c4b5fd;" onchange="updateMaxParticipantsFromTeam()">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label style="font-size:12px; font-weight:700; color:#6d28d9;">Max Teams *</label>
                <input type="number" id="ev-max-teams" value="${existingEv?.maxTeams || 20}" min="1" style="background:#ffffff; border:1.5px solid #8b5cf6;" oninput="updateMaxParticipantsFromTeam()">
                <div style="font-size:10.5px; color:#6d28d9; margin-top:3px; font-weight:500;">Total = Teams × Max Members</div>
              </div>
            </div>
          </div>
        </div>

        <div class="toggle-row">
          <label class="toggle-sw"><input type="checkbox" id="ev-needs-payment" ${(existingEv?.needsPayment || existingEv?.fee > 0) ? 'checked' : ''}><span class="toggle-track"></span></label>
          <div class="toggle-info">
            <div class="toggle-lbl">Require Payment Proof</div>
            <div class="toggle-desc" style="color:#64748b;">Students must submit a Transaction ID / UTR and payment screenshot for organizer approval.</div>
          </div>
        </div>

        <div class="form-row" style="margin-top:10px;">
          <div class="form-group"><label>Entry Fee (₹) — 0 = Free</label><input type="number" id="create-ev-fee" value="${existingEv?.fee || 0}" min="0"></div>
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
          <p id="ev-poster-txt">${existingEv?.poster ? 'Poster loaded — click to replace' : 'Click to upload event poster'}</p>
          <span>PNG, JPG supported</span>
          <input type="file" id="ev-poster-input" accept="image/*" style="display:none;" onchange="handlePosterUpload(event)">
          <input type="hidden" id="ev-poster-data" value="">
        </div>
        <img id="ev-poster-preview" style="${existingEv?.poster ? 'display:block;' : 'display:none;'}width:100%;max-height:180px;object-fit:cover;border-radius:10px;margin-top:8px;">

        <div class="create-form-btns">
          <button type="button" class="btn-create-draft" onclick="submitEvent('draft')">Save as Draft</button>
          <button type="button" class="btn-create-submit" onclick="submitEvent('pending')">${existingEv ? 'Save & Resubmit for Approval →' : 'Submit for Approval →'}</button>
        </div>
      </div>
    </div>
  `;

  // Populate field values safely via DOM properties (preserves quotes/special chars)
  document.getElementById('ev-name').value = existingEv?.name || '';
  document.getElementById('ev-club').value = existingEv?.club || STATE.user?.clubName || '';
  document.getElementById('ev-desc').value = existingEv?.desc || '';
  document.getElementById('ev-date').value = existingEv?.date || '';
  document.getElementById('ev-time').value = normalizeTimeForInput(existingEv?.time || '');
  document.getElementById('ev-end-time').value = normalizeTimeForInput(existingEv?.endTime || '');
  document.getElementById('ev-venue').value = existingVenue;
  document.getElementById('ev-cat').value = existingEv?.category || 'Technical';
  document.getElementById('create-ev-upi').value = existingEv?.adminUpiId || '';
  document.getElementById('ev-speakers').value = existingEv?.speakers || '';
  document.getElementById('ev-rules').value = existingEv?.rules || '';
  if (existingEv?.poster) {
    document.getElementById('ev-poster-data').value = existingEv.poster;
    document.getElementById('ev-poster-preview').src = existingEv.poster;
  }

  if (typeof toggleTeamFields === 'function' && isTeam) {
    toggleTeamFields();
  }

  attachCreateEventClashListeners();
  if (existingEv && existingEv.date && existingEv.time && existingEv.venue) {
    runRealtimeVenueClashCheck(++_clashCheckSeq);
  }
}

function normalizeTimeForInput(t) {
  const mins = parseTimeToMinutes(t);
  if (mins === null) return '';
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function autoFillEndTimeIfEmpty() {
  const startVal = document.getElementById('ev-time')?.value || '';
  const endInp = document.getElementById('ev-end-time');
  if (!startVal || !endInp || endInp.value) return;
  const startMin = parseTimeToMinutes(startVal);
  if (startMin === null) return;
  const endMin = Math.min(23 * 60 + 59, startMin + 120);
  const hh = String(Math.floor(endMin / 60)).padStart(2, '0');
  const mm = String(endMin % 60).padStart(2, '0');
  endInp.value = `${hh}:${mm}`;
}

function attachCreateEventClashListeners() {
  const dateEl = document.getElementById('ev-date');
  const timeEl = document.getElementById('ev-time');
  const endEl  = document.getElementById('ev-end-time');
  const venueEl = document.getElementById('ev-venue');

  if (timeEl) {
    timeEl.addEventListener('change', autoFillEndTimeIfEmpty);
    timeEl.addEventListener('input', scheduleVenueClashCheck);
    timeEl.addEventListener('change', scheduleVenueClashCheck);
  }
  [dateEl, endEl, venueEl].forEach(inp => {
    if (!inp) return;
    inp.addEventListener('input', scheduleVenueClashCheck);
    inp.addEventListener('change', scheduleVenueClashCheck);
  });
}

function syncCreateSubmitButtonState() {
  if (_isSubmittingEvent) return;
  const submitBtn = document.querySelector('.btn-create-submit');
  if (!submitBtn) return;

  const blocked = _isCheckingClash || _hasVenueClash || _hasInvalidTimeRange;
  submitBtn.disabled = blocked;
  submitBtn.style.opacity = blocked ? '0.55' : '1';
  submitBtn.style.cursor = blocked ? 'not-allowed' : 'pointer';

  if (_isCheckingClash) {
    submitBtn.title = 'Checking venue & schedule availability...';
  } else if (_hasInvalidTimeRange) {
    submitBtn.title = 'End Time must be later than Start Time.';
  } else if (_hasVenueClash) {
    submitBtn.title = 'Resolve the venue/time conflict before submitting.';
  } else {
    submitBtn.title = '';
  }
}

function renderClashBannerState(state, payload = null) {
  const banner = document.getElementById('ev-clash-banner');
  if (!banner) return;

  if (state === 'hidden') {
    banner.style.display = 'none';
    banner.innerHTML = '';
    return;
  }

  if (state === 'checking') {
    banner.style.display = 'block';
    banner.innerHTML = `
      <div style="background:#eff6ff; border:1.5px solid #bfdbfe; color:#1e40af; padding:11px 14px; border-radius:10px; font-size:13px; font-weight:600; display:flex; align-items:center; gap:8px;">
        <span>⏳</span>
        <span>Checking real-time venue & schedule availability...</span>
      </div>`;
    return;
  }

  if (state === 'invalid_time') {
    banner.style.display = 'block';
    banner.innerHTML = `
      <div style="background:#fef2f2; border:1.5px solid #fecaca; color:#b91c1c; padding:12px 14px; border-radius:10px; font-size:13px; font-weight:700; display:flex; align-items:center; gap:8px;">
        <span>⚠️</span>
        <span>End Time must be later than Start Time.</span>
      </div>`;
    return;
  }

  if (state === 'conflict' && Array.isArray(payload) && payload.length > 0) {
    banner.style.display = 'block';
    banner.innerHTML = `
      <div style="background:#fef2f2; border:1.5px solid #f87171; border-radius:12px; padding:14px 16px; box-shadow:0 4px 12px rgba(239,68,68,0.1);">
        <div style="display:flex; align-items:center; gap:8px; font-weight:800; font-size:13.5px; color:#991b1b; margin-bottom:10px;">
          <span style="font-size:18px;">⚠️</span>
          <span>VENUE &amp; SCHEDULE CLASH DETECTED — Submission Blocked</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${payload.map(c => `
            <div style="background:#ffffff; border:1px solid #fca5a5; border-radius:8px; padding:10px 12px; font-size:12.5px; color:#1e293b;">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                <strong style="font-size:13.5px; color:#991b1b;">${escapeHTML(c.name || 'Untitled Event')}</strong>
                <span class="badge ${c.status === 'approved' ? 'badge-green' : 'badge-amber'}">${escapeHTML(String(c.status || 'pending').toUpperCase())}</span>
              </div>
              <div style="color:#475569; margin-bottom:3px;">🏛️ <strong>Organizing Club:</strong> ${escapeHTML(c.club || 'Unknown Club')}</div>
              <div style="color:#475569;">📅 <strong>Booked Slot:</strong> ${escapeHTML(formatDate(c.date))} &bull; 📍 ${escapeHTML(c.venue)} &bull; 🕐 ${escapeHTML(formatEventTimeSlot(c))}</div>
            </div>
          `).join('')}
        </div>
        <div style="font-size:11.5px; color:#b91c1c; font-weight:600; margin-top:10px;">
          Please pick a different Venue, Event Date, or non-overlapping Start/End Time to enable submission.
        </div>
      </div>`;
    return;
  }

  if (state === 'available') {
    banner.style.display = 'block';
    banner.innerHTML = `
      <div style="background:#f0fdf4; border:1.5px solid #86efac; color:#15803d; padding:10px 14px; border-radius:10px; font-size:12.5px; font-weight:700; display:flex; align-items:center; gap:8px;">
        <span>✅</span>
        <span>Venue slot is available (${escapeHTML(formatDate(payload.date))} • ${escapeHTML(payload.venue)} • ${escapeHTML(formatTime(payload.time))} – ${escapeHTML(formatTime(payload.endTime))}).</span>
      </div>`;
  }
}

async function fetchConflictingVenueEvents({ date, time, endTime, venue, excludeEventId = null }) {
  const draftEv = {
    id: excludeEventId || '__new_event__',
    date,
    time,
    endTime,
    venue
  };

  let candidateEvents = [];
  const sb = getSupabaseClient();

  if (sb && typeof sb.from === 'function') {
    try {
      let query = sb
        .from('events')
        .select('id, name, club, date, time, end_time, venue, status')
        .eq('date', date)
        .ilike('venue', venue)
        .in('status', SLOT_BLOCKING_STATUSES);

      if (excludeEventId) {
        query = query.neq('id', excludeEventId);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        candidateEvents = data.map(r => ({
          id: r.id,
          name: r.name,
          club: r.club,
          date: r.date,
          time: r.time,
          endTime: r.end_time || '',
          venue: r.venue,
          status: r.status
        }));
      }
    } catch (e) {
      console.warn('Supabase real-time clash query fallback to cache:', e);
    }
  }

  // Merge local cached active events to ensure offline/pending cache hits are never missed
  const cached = getDB('vvce_events');
  cached.forEach(ev => {
    if (!candidateEvents.some(c => String(c.id) === String(ev.id))) {
      candidateEvents.push(ev);
    }
  });

  return candidateEvents.filter(other => {
    if (excludeEventId && String(other.id) === String(excludeEventId)) return false;
    return doEventSlotsOverlap(draftEv, other);
  });
}

function scheduleVenueClashCheck() {
  clearTimeout(_clashDebounceTimer);
  const seqId = ++_clashCheckSeq;

  const date    = document.getElementById('ev-date')?.value || '';
  const time    = document.getElementById('ev-time')?.value || '';
  const endTime = document.getElementById('ev-end-time')?.value || '';
  const venue   = document.getElementById('ev-venue')?.value || '';

  if (!date || !time || !endTime || !venue) {
    _isCheckingClash = false;
    _hasVenueClash = false;
    _hasInvalidTimeRange = false;
    renderClashBannerState('hidden');
    syncCreateSubmitButtonState();
    return;
  }

  const startMin = parseTimeToMinutes(time);
  const endMin = parseTimeToMinutes(endTime);
  if (startMin === null || endMin === null || endMin <= startMin) {
    _isCheckingClash = false;
    _hasInvalidTimeRange = true;
    _hasVenueClash = false;
    renderClashBannerState('invalid_time');
    syncCreateSubmitButtonState();
    return;
  }

  _hasInvalidTimeRange = false;
  _isCheckingClash = true;
  renderClashBannerState('checking');
  syncCreateSubmitButtonState();

  _clashDebounceTimer = setTimeout(() => {
    runRealtimeVenueClashCheck(seqId);
  }, 300);
}

async function runRealtimeVenueClashCheck(seqId) {
  const date    = document.getElementById('ev-date')?.value || '';
  const time    = document.getElementById('ev-time')?.value || '';
  const endTime = document.getElementById('ev-end-time')?.value || '';
  const venue   = document.getElementById('ev-venue')?.value || '';

  if (!date || !time || !endTime || !venue) {
    if (seqId === _clashCheckSeq) {
      _isCheckingClash = false;
      _hasVenueClash = false;
      renderClashBannerState('hidden');
      syncCreateSubmitButtonState();
    }
    return;
  }

  const startMin = parseTimeToMinutes(time);
  const endMin = parseTimeToMinutes(endTime);
  if (startMin === null || endMin === null || endMin <= startMin) {
    if (seqId === _clashCheckSeq) {
      _isCheckingClash = false;
      _hasInvalidTimeRange = true;
      _hasVenueClash = false;
      renderClashBannerState('invalid_time');
      syncCreateSubmitButtonState();
    }
    return;
  }

  const conflicts = await fetchConflictingVenueEvents({
    date,
    time,
    endTime,
    venue,
    excludeEventId: window._editingEventId || null
  });

  if (seqId !== _clashCheckSeq) return; // Stale response

  _isCheckingClash = false;
  _hasInvalidTimeRange = false;
  _hasVenueClash = conflicts.length > 0;

  if (_hasVenueClash) {
    renderClashBannerState('conflict', conflicts);
  } else {
    renderClashBannerState('available', { date, time, endTime, venue });
  }
  syncCreateSubmitButtonState();
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

async function submitEvent(status='pending') {
  if (_isSubmittingEvent) return;

  const name    = document.getElementById('ev-name').value.trim();
  const club    = document.getElementById('ev-club').value.trim();
  const date    = document.getElementById('ev-date').value;
  const time    = document.getElementById('ev-time').value;
  const endTime = document.getElementById('ev-end-time')?.value || '';
  const max     = parseInt(document.getElementById('ev-max').value||'100');
  const venue   = document.getElementById('ev-venue').value;
  const cat     = document.getElementById('ev-cat').value;
  const checkedBranchEls = [...document.querySelectorAll('input[name="target-branch"]:checked')];
  let branches = checkedBranchEls.map(cb => cb.value);
  if (!branches.length || branches.includes('All')) {
    branches = ['All'];
  }

  const desc  = document.getElementById('ev-desc').value.trim();
  const rules = document.getElementById('ev-rules').value.trim();
  if (!name||!club||!date||!time||!endTime||!venue||!desc||!rules) {
    toast('Please fill all required fields (marked with *, including End Time).','error');
    return;
  }

  const startMin = parseTimeToMinutes(time);
  const endMin = parseTimeToMinutes(endTime);
  if (startMin === null || endMin === null || endMin <= startMin) {
    _hasInvalidTimeRange = true;
    renderClashBannerState('invalid_time');
    syncCreateSubmitButtonState();
    toast('⚠️ End Time must be later than Start Time.', 'error');
    return;
  }

  const userClub = STATE.user;
  const authorityId = userClub.authorityId || null;
  const authorityName = userClub.authorityName || 'Approving Authority';
  const fee = parseInt(document.getElementById('create-ev-fee').value||'0');
  const needsPayment = Boolean(document.getElementById('ev-needs-payment')?.checked || fee > 0);
  const upiId = document.getElementById('create-ev-upi')?.value.trim() || '';
  if ((fee > 0 || needsPayment) && !upiId) {
    toast('⚠️ Payment proof is required — please add a Club UPI ID (or disable Require Payment Proof & set fee to 0).', 'error');
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

  const editingId = window._editingEventId || null;

  // Lock submit buttons during pre-submit validation & persistence
  _isSubmittingEvent = true;
  const submitBtn = document.querySelector('.btn-create-submit');
  const draftBtn  = document.querySelector('.btn-create-draft');
  const origSubmitLabel = submitBtn ? submitBtn.textContent : 'Submit for Approval →';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = status === 'pending' ? `Checking & Sending to ${authorityName}... ⏳` : 'Saving Draft... ⏳';
    submitBtn.style.opacity = '0.65';
    submitBtn.style.cursor = 'not-allowed';
  }
  if (draftBtn) {
    draftBtn.disabled = true;
    draftBtn.style.opacity = '0.65';
    draftBtn.style.cursor = 'not-allowed';
  }

  try {
    // 1. Final client + direct Supabase overlap check right before saving
    if (status !== 'draft') {
      const conflicts = await fetchConflictingVenueEvents({
        date,
        time,
        endTime,
        venue,
        excludeEventId: editingId
      });
      if (conflicts.length > 0) {
        _hasVenueClash = true;
        renderClashBannerState('conflict', conflicts);
        const first = conflicts[0];
        toast(`⚠️ Venue conflict with "${first.name}" (${first.club}) on ${formatDate(first.date)} (${formatEventTimeSlot(first)}).`, 'error', 5500);
        return;
      }
    }

    const computedMax = isTeamEvent ? (maxTeams * maxTeamSize) : max;
    const events = getDB('vvce_events');
    const prevEv = editingId ? events.find(e => String(e.id) === String(editingId)) : null;

    const ev = {
      ...(prevEv || {}),
      id: prevEv ? prevEv.id : genId('ev'),
      name,
      club,
      adminId: prevEv?.adminId || STATE.user.id,
      emoji: prevEv?.emoji || '🎓',
      category: cat,
      date,
      time,
      endDate: date,
      endTime,
      venue,
      maxParticipants: computedMax,
      regCount: prevEv?.regCount || 0,
      fee,
      needsPayment,
      adminUpiId: upiId,
      desc,
      speakers: document.getElementById('ev-speakers').value.trim(),
      rules,
      poster: document.getElementById('ev-poster-data').value || null,
      branches: branches.length ? branches : ['All'],
      isTeamEvent,
      minTeamSize,
      maxTeamSize,
      maxTeams,
      teams: prevEv?.teams || [],
      status,
      rejReason: null,
      registrations: prevEv?.registrations || [],
      pendingPayments: prevEv?.pendingPayments || [],
      authorityId: prevEv?.authorityId || authorityId,
      authorityName: prevEv?.authorityName || authorityName,
      decisionHistory: [
        ...(prevEv?.decisionHistory || []),
        {
          action: prevEv ? 'resubmitted' : 'submitted',
          authorityId: prevEv?.authorityId || authorityId,
          authorityName: prevEv?.authorityName || authorityName,
          timestamp: new Date().toISOString()
        }
      ]
    };

    // 2. Atomic DB concurrency guard via Postgres RPC (with safe direct-upsert fallback)
    const sb = getSupabaseClient();
    let savedAtomically = false;
    const dbRow = mapEventForSupabase(ev);

    if (sb) {
      try {
        const rpcName = prevEv ? 'update_event_with_clash_check' : 'create_event_with_clash_check';
        const rpcArgs = prevEv ? { p_event_id: ev.id, p_event: dbRow } : { p_event: dbRow };
        const { data: rpcData, error: rpcErr } = await sb.rpc(rpcName, rpcArgs);

        if (!rpcErr && rpcData) {
          if (!rpcData.success) {
            if (rpcData.clash && rpcData.conflict) {
              _hasVenueClash = true;
              renderClashBannerState('conflict', [rpcData.conflict]);
            }
            toast(`⚠️ ${rpcData.error || 'Slot already booked by another event.'}`, 'error', 6000);
            return;
          }
          savedAtomically = true;
        }
      } catch (rpcException) {
        console.warn('Atomic clash-check RPC unavailable, falling back to direct upsert:', rpcException);
      }

      if (!savedAtomically) {
        if (status !== 'draft') {
          const freshConflicts = await fetchConflictingVenueEvents({
            date,
            time,
            endTime,
            venue,
            excludeEventId: editingId
          });
          if (freshConflicts.length > 0) {
            _hasVenueClash = true;
            renderClashBannerState('conflict', freshConflicts);
            toast(`⚠️ Venue conflict detected just before saving.`, 'error', 5500);
            return;
          }
        }
        const { error: upsertErr } = await sb.from('events').upsert([dbRow]);
        if (upsertErr) {
          throw new Error(upsertErr.message);
        }
      }

      await syncEventsFromSupabase();
      await syncApprovingAuthoritiesFromSupabase();
    } else {
      if (prevEv) {
        const idx = events.findIndex(e => String(e.id) === String(ev.id));
        if (idx > -1) events[idx] = ev;
        else events.push(ev);
      } else {
        events.push(ev);
      }
      await setDB('vvce_events', events);
    }

    // Ensure local cache has latest event immediately
    const cachedAfter = getDB('vvce_events');
    const cIdx = cachedAfter.findIndex(e => String(e.id) === String(ev.id));
    if (cIdx > -1) cachedAfter[cIdx] = ev;
    else cachedAfter.push(ev);
    SUPABASE_CACHE.vvce_events = cachedAfter;
    try { localStorage.setItem('vvce_events', JSON.stringify(cachedAfter)); } catch (e) {}

    window._editingEventId = null;

    if (status === 'pending') {
      toast(`Event request "${name}" sent to ${authorityName} for approval! ⏳`, 'success');
      const users = getDB('vvce_users');
      const authRecord = getActiveApprovingAuthorities().find(a => a.id === authorityId);
      const authEmail = authRecord?.email ? authRecord.email.toLowerCase() : null;
      const targets = users.filter(u => u.type === 'authority' && (
        !authorityId || u.id === authorityId || (authEmail && (u.email || '').toLowerCase() === authEmail)
      ));
      targets.forEach(u => {
        if (!u.notifs) u.notifs = [];
        u.notifs.push({ id: genId('n'), msg: `New event "${name}" by ${club} needs your approval.`, icon: '📋', time: 'Just now', timestamp: Date.now(), read: false });
      });
      await setDB('vvce_users', users);
      showPage('admin-dashboard');
    } else {
      toast(`Event saved as draft.`, 'info');
      showPage('manage-events');
    }
  } catch (err) {
    console.error('Error submitting event:', err);
    toast('Error submitting event: ' + err.message, 'error');
  } finally {
    _isSubmittingEvent = false;
    if (submitBtn) {
      submitBtn.textContent = origSubmitLabel;
    }
    if (draftBtn) {
      draftBtn.disabled = false;
      draftBtn.style.opacity = '1';
      draftBtn.style.cursor = 'pointer';
    }
    syncCreateSubmitButtonState();
  }
}
