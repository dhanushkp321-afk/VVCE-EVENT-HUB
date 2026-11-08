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
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning'; if (h < 17) return 'afternoon'; return 'evening';
}
function avatar(name) { return name ? name.trim()[0].toUpperCase() : '?'; }

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
