/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Application Bootstrap & Life Cycle Listeners
   Path: js/main.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', function() {
  bootApp();
  // Set default register role (student form visible)
  selectRegRole('student');
  // Init Google Sign-In after GIS script finishes loading
  if (typeof google !== 'undefined') {
    initGoogleAuth();
  } else {
    window.addEventListener('load', initGoogleAuth);
  }
  // Init live CPM config sync (banners, themes, maintenance)
  // Small delay to ensure Supabase client is ready after bootApp
  setTimeout(initDynamicSiteConfig, 500);
});

// Auto-sync when navigating back via browser Back button (bfcache) or switching tabs
window.addEventListener('pageshow', function(e) {
  bootApp();
});

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    bootApp();
  }
});

// Expose all functions to window for inline onclick handlers in HTML