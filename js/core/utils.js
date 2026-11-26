/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Utility Functions, Modals, Toasts & Clash Detectors
   Path: js/core/utils.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   UTILITY FUNCTIONS
───────────────────────────────────────────────────────────────*/
function genId(prefix = 'id') { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }
function titleCase(str) { if (!str) return ''; return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()); }
function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(t) {
  if (!t) return '';
  const mins = parseTimeToMinutes(t); if (mins === null) return String(t); const h = Math.floor(mins / 60), m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning'; if (h < 17) return 'afternoon'; return 'evening';
}
function avatar(name) { return name ? name.trim()[0].toUpperCase() : '?'; }

/* Parse "HH:MM", "HH:MM:SS", or "10:00 AM" into minutes from midnight (0..1439) */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const raw = String(timeStr).trim();
  if (!raw) return null;

  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const meridiem = ampmMatch[3].toUpperCase();
    if (h < 1 || h > 12 || m < 0 || m > 59) return null;
    if (meridiem === 'AM' && h === 12) h = 0;
    else if (meridiem === 'PM' && h !== 12) h += 12;
    return h * 60 + m;
  }

  const h24Match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (h24Match) {
    const h = parseInt(h24Match[1], 10);
    const m = parseInt(h24Match[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  return null;
}

/* Compute [start, end) minute interval; legacy events without end_time default to +2h block */
function getEventTimeRangeMinutes(ev) {
  const start = parseTimeToMinutes(ev?.time || ev?.startTime || ev?.start_time);
  if (start === null) {
    return { start: 0, end: 1440, estimated: true };
  }
  const parsedEnd = parseTimeToMinutes(ev?.endTime || ev?.end_time);
  if (parsedEnd !== null && parsedEnd > start) {
    return { start, end: parsedEnd, estimated: false };
  }
  return { start, end: Math.min(1440, start + 120), estimated: true };
}

function formatEventTimeSlot(ev) {
  const startStr = ev?.time || ev?.startTime || ev?.start_time;
  const endStr = ev?.endTime || ev?.end_time;
  if (!startStr) return 'Time TBA';
  if (endStr && parseTimeToMinutes(endStr) !== null) {
    return `${formatTime(startStr)} – ${formatTime(endStr)}`;
  }
  const range = getEventTimeRangeMinutes(ev);
  const estH = String(Math.floor(range.end / 60)).padStart(2, '0');
  const estM = String(range.end % 60).padStart(2, '0');
  return `${formatTime(startStr)} – ${formatTime(`${estH}:${estM}`)} (est.)`;
}

const SLOT_BLOCKING_STATUSES = ['approved', 'pending', 'scheduled', 'rescheduled'];

function isSlotBlockingEvent(ev, allowedStatuses = SLOT_BLOCKING_STATUSES) {
  const st = String(ev?.status || '').trim().toLowerCase();
  return allowedStatuses.includes(st);
}

/* True iff two events share Date + Venue and have overlapping [start, end) time intervals */
function doEventSlotsOverlap(eventA, eventB, opts = {}) {
  if (!eventA || !eventB) return false;
  if (eventA.id && eventB.id && String(eventA.id) === String(eventB.id)) return false;

  const allowed = opts.allowedStatuses || SLOT_BLOCKING_STATUSES;
  if (!isSlotBlockingEvent(eventB, allowed)) return false;

  const dateA = String(eventA.date || '').trim();
  const dateB = String(eventB.date || '').trim();
  if (!dateA || !dateB || dateA !== dateB) return false;

  const venueA = String(eventA.venue || '').trim().toLowerCase();
  const venueB = String(eventB.venue || '').trim().toLowerCase();
  if (!venueA || !venueB || venueA !== venueB) return false;

  const rA = getEventTimeRangeMinutes(eventA);
  const rB = getEventTimeRangeMinutes(eventB);
  return rA.start < rB.end && rA.end > rB.start;
}

/**
 * Computes the student's current Year and Semester automatically
 * based on their admission year (stored as admissionYear).
 * Academic year starts in September each year.
 * Sept–Feb = Odd sem, Mar–Aug = Even sem.
 */
function computeStudentYearSem(user, dateStr = null) {
  if (!user.admissionYear) {
    // Fallback if no admissionYear stored (legacy data)
    return { year: user.year || '—', sem: user.sem || '—' };
  }
  const now = dateStr ? new Date(dateStr) : new Date();
  const currentMonth = now.getMonth() + 1; // 1–12
  const currentYear  = now.getFullYear();

  // Academic year starts in September (month 9).
  // Sept–Feb = Odd semester (1st half), Mar–Aug = Even semester (2nd half).
  const academicYear = currentMonth >= 9 ? currentYear : currentYear - 1;
  const yearsElapsed = academicYear - user.admissionYear;
  
  // Constrain to 1st-4th year. If date is earlier than admission, fallback to 1.
  const studyYear = Math.max(1, Math.min(yearsElapsed + 1, 4)); // 1–4

  // Sept(9)–Feb(2) = odd sem, Mar(3)–Aug(8) = even sem
  let semInYear;
  if (currentMonth >= 9 || currentMonth <= 2) {
    semInYear = 1; // Sept–Feb → Odd semester
  } else {
    semInYear = 2; // Mar–Aug → Even semester
  }
  const semNumber = Math.min((studyYear - 1) * 2 + semInYear, 8);

  const yearLabels = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  return {
    year: yearLabels[studyYear - 1] || '4th Year',
    sem: `Sem ${semNumber}`
  };
}

/* Toast notifications */
function toast(msg, type = 'success', dur = 3200) {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(60px)'; t.style.transition = 'all 0.3s'; setTimeout(() => t.remove(), 300); }, dur);
}

/* Modal helpers */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('open');
    el.style.display = 'flex';
  }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
    el.style.display = 'none';
  }
}
