/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Application Bootstrap & Life Cycle Listeners
   Path: js/main.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', function() {
  bootApp(true);
  selectRegRole('student');
  if (typeof google !== 'undefined') {
    initGoogleAuth();
  } else {
    window.addEventListener('load', initGoogleAuth);
  }
  setTimeout(initDynamicSiteConfig, 500);
});

// Lightweight foreground sync on bfcache restore / tab focus (avoids 6,000-row boot storms)
window.addEventListener('pageshow', function(e) {
  if (e.persisted && typeof refreshActivePortalState === 'function') {
    refreshActivePortalState();
  }
});

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible' && typeof refreshActivePortalState === 'function') {
    refreshActivePortalState();
  }
});
