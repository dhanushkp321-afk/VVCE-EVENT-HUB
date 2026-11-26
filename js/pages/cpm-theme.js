/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Dynamic CPM Configuration & Festival Themes
   Path: js/pages/cpm-theme.js
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   DYNAMIC CPM CONFIGURATION (Realtime Banners, Themes, Maintenance)
───────────────────────────────────────────────────────────────*/
async function initDynamicSiteConfig() {
  // Use the shared client (window.supabase is already initialized by bootApp)
  const sb = getSupabaseClient();

  if (!sb) return;

  function applyConfig(cfg) {
    if (!cfg) return;

    // 1. Maintenance Mode
    let maintEl = document.getElementById('cpm-maintenance-overlay');
    if (cfg.maintenance) {
      if (!maintEl) {
        maintEl = document.createElement('div');
        maintEl.id = 'cpm-maintenance-overlay';
        maintEl.style.cssText = 'position:fixed;inset:0;background:#090d16;z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:2rem;font-family:sans-serif;';
        maintEl.innerHTML = `
          <div style="font-size:64px;margin-bottom:1rem;">🛠️</div>
          <h1 style="font-size:2rem;font-family:Outfit,sans-serif;margin-bottom:0.75rem;">Under Scheduled Maintenance</h1>
          <p style="color:#94a3b8;max-width:480px;line-height:1.6;font-size:15px;">The VVCE Events portal is temporarily unavailable while our administrative team applies system updates. Please check back shortly.</p>
        `;
        document.body.appendChild(maintEl);
      }
      maintEl.style.display = 'flex';
    } else if (maintEl) {
      maintEl.style.display = 'none';
    }

    // 2. Dynamic Banner (with start & expiry date support)
    let bannerEl = document.getElementById('cpm-live-banner');
    const now = new Date();
    let showBanner = cfg.banner && cfg.banner.enabled && cfg.banner.text;
    if (showBanner && cfg.banner.start_date && new Date(cfg.banner.start_date) > now) showBanner = false;
    if (showBanner && cfg.banner.end_date && new Date(cfg.banner.end_date) < now) showBanner = false;

    if (showBanner) {
      if (!bannerEl) {
        bannerEl = document.createElement('div');
        bannerEl.id = 'cpm-live-banner';
        bannerEl.style.cssText = 'position:sticky;top:0;z-index:99998;padding:10px 16px;text-align:center;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 2px 8px rgba(0,0,0,0.15);';
        document.body.prepend(bannerEl);
      }
      const bgMap = {
        warning: 'linear-gradient(90deg, #d97706, #f59e0b)',
        danger: 'linear-gradient(90deg, #dc2626, #ef4444)',
        info: 'linear-gradient(90deg, #2563eb, #3b82f6)',
        success: 'linear-gradient(90deg, #059669, #10b981)'
      };
      bannerEl.style.background = bgMap[cfg.banner.type] || bgMap.warning;
      bannerEl.style.color = '#ffffff';
      bannerEl.innerHTML = `<span>${cfg.banner.text}</span>`;
      bannerEl.style.display = 'flex';
    } else if (bannerEl) {
      bannerEl.style.display = 'none';
    }

    // 4. Registration Lock
    STATE.registrationLocked = !!cfg.registrationLocked;

    // 5. Dynamic Media Assets
    if (cfg.media && cfg.media.signinBgUrl) {
      document.body.style.backgroundImage = `url("${cfg.media.signinBgUrl}")`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundAttachment = 'fixed';
      document.body.classList.add('has-theme-bg');
    } else if (cfg.media && cfg.media.bgUrl) {
      document.body.style.backgroundImage = `url("${cfg.media.bgUrl}")`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundAttachment = 'fixed';
      document.body.classList.add('has-theme-bg');
    } else {
      document.body.style.backgroundImage = '';
      document.body.classList.remove('has-theme-bg');
    }

    // 3. Dynamic Theme & Festival Celebrations
    if (cfg.theme) {
      applyCelebrationTheme(cfg.theme);
    }
  }

  try {
    const { data } = await sb.from('cpm_config').select('*').eq('id', 'global').maybeSingle();
    if (data && data.config) applyConfig(data.config);

    sb.channel('cpm_live_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cpm_config' }, payload => {
        if (payload.new && payload.new.config) applyConfig(payload.new.config);
      })
      .subscribe();
  } catch(e) {
    console.warn('CPM live config sync:', e);
  }
}

/* ─────────────────────────────────────────────────────────────
   FESTIVAL & NATIONAL CELEBRATION DYNAMIC THEME ENGINE
───────────────────────────────────────────────────────────────*/
function applyCelebrationTheme(theme) {
  if (!theme) return;

  // Handle legacy string values
  if (typeof theme === 'string') {
    if (theme === 'default') {
      theme = { primary: '#f59e0b', secondary: '#fbbf24', bgStyle: 'light', effect: 'none', showGreeting: false };
    } else if (theme === 'festive') {
      theme = { primary: '#dc2626', secondary: '#f59e0b', bgStyle: 'light', effect: 'sparkles', showGreeting: true, greeting: 'Festival Celebration! ✨' };
    } else if (theme === 'cyber') {
      theme = { primary: '#06b6d4', secondary: '#8b5cf6', bgStyle: 'dark', effect: 'sparkles', showGreeting: true, greeting: 'VVCE Tech Fest Live! ⚡' };
    }
  }

  const root = document.documentElement;
  const primary = theme.primary || '#f59e0b';
  const secondary = theme.secondary || '#fbbf24';

  // Apply CSS root variables dynamically across the entire website
  root.style.setProperty('--gold', primary);
  root.style.setProperty('--gold2', secondary);
  root.style.setProperty('--gold3', primary);
  root.style.setProperty('--gold-border', primary + '55');
  root.style.setProperty('--gold-bg', primary + '18');
  
  // Sidebar colour is never changed by themes — always stays dark (#111827)
  document.documentElement.style.removeProperty('--sb');

  // Background style
  if (theme.bgStyle === 'dark') {
    document.body.classList.add('dark');
    document.body.style.backgroundColor = '#0f172a';
  } else if (theme.bgStyle === 'warm') {
    document.body.classList.remove('dark');
    document.body.style.backgroundColor = '#fffdf7';
  } else {
    document.body.classList.remove('dark');
    document.body.style.backgroundColor = '';
  }

  // Set background image from theme.bannerUrl — apply to the main content area only (not the sidebar)
  const appMain = document.getElementById('app-main');
  if (theme.bannerUrl) {
    // Clear any old body background first
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundAttachment = '';
    const authScreen = document.getElementById('auth-screen');
    // Apply to the white content panel only
    if (appMain) {
      appMain.style.backgroundImage = `url("${theme.bannerUrl}")`;
      appMain.style.backgroundSize = 'cover';
      appMain.style.backgroundPosition = 'center';
      appMain.style.backgroundRepeat = 'no-repeat';
    }
    // Also apply to the auth/sign-in screen
    if (authScreen) {
      authScreen.style.backgroundImage = `url("${theme.bannerUrl}")`;
      authScreen.style.backgroundSize = 'cover';
      authScreen.style.backgroundPosition = 'center';
      authScreen.style.backgroundRepeat = 'no-repeat';
    }
    document.body.classList.add('has-theme-bg');
  } else {
    // Clear background from both body and app-main
    document.body.style.backgroundImage = '';
    const authScreen = document.getElementById('auth-screen');
    if (appMain) {
      appMain.style.backgroundImage = '';
      appMain.style.backgroundSize = '';
      appMain.style.backgroundPosition = '';
      appMain.style.backgroundAttachment = '';
    }
    if (authScreen) {
      authScreen.style.backgroundImage = '';
      authScreen.style.backgroundSize = '';
      authScreen.style.backgroundPosition = '';
      authScreen.style.backgroundAttachment = '';
    }
    document.body.classList.remove('has-theme-bg');
  }

  // Save theme globally so renderStudentDashboard can inject the greeting ribbon
  window.currentTheme = theme;
  if (typeof STATE !== 'undefined' && STATE.page === 'dashboard' && STATE.user && typeof renderStudentDashboard === 'function') {
    renderStudentDashboard();
  }

  // Auth Screen Festive Greeting Ribbon (configured in CPM Theme tab)
  let authRibbon = document.getElementById('auth-festive-ribbon');
  const authOuter = document.querySelector('.auth-outer');
  if (!authRibbon && authOuter) {
    authRibbon = document.createElement('div');
    authRibbon.id = 'auth-festive-ribbon';
    authRibbon.style.cssText = 'display:none; width:100%; padding:11px 18px; text-align:center; font-weight:800; font-size:14px; color:#ffffff; letter-spacing:0.02em; border-radius:12px; margin-bottom:18px; box-shadow:0 4px 14px rgba(0,0,0,0.18); align-items:center; justify-content:center; gap:8px; font-family:\'Outfit\',sans-serif; box-sizing:border-box;';
    authOuter.prepend(authRibbon);
  }

  if (authRibbon) {
    if (theme.showGreeting && theme.greeting) {
      authRibbon.style.background = `linear-gradient(90deg, ${primary}, ${secondary})`;
      authRibbon.style.color = '#ffffff';
      authRibbon.innerHTML = `<span>${theme.greeting}</span>`;
      authRibbon.style.display = 'flex';
    } else {
      authRibbon.style.display = 'none';
    }
  }


  // Floating Celebration Visual Particles
  applyFestiveParticles(theme.effect);
}

function applyFestiveParticles(effect) {
  let container = document.getElementById('cpm-particles-container');
  if (!effect || effect === 'none') {
    if (container) container.remove();
    return;
  }

  if (!container) {
    container = document.createElement('div');
    container.id = 'cpm-particles-container';
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99990;overflow:hidden;';
    document.body.appendChild(container);

    // Inject keyframes style once
    if (!document.getElementById('cpm-particle-styles')) {
      const st = document.createElement('style');
      st.id = 'cpm-particle-styles';
      st.textContent = '@keyframes cpmFloatUp { 0% { transform: translateY(105vh) rotate(0deg); opacity: 0; } 15% { opacity: 0.85; } 85% { opacity: 0.85; } 100% { transform: translateY(-10vh) rotate(360deg); opacity: 0; } }';
      document.head.appendChild(st);
    }
  }

  const emojiMap = {
    sparkles: ['✨', '⭐', '🌟', '💫'],
    rajyotsava: ['💛', '❤️', '🏵️', '💛', '❤️'],
    tricolor: ['🇮🇳', '🧡', '🤍', '💚'],
    diyas: ['🪔', '✨', '🪔', '🌟'],
    flowers: ['🌸', '🌺', '🌼', '💐'],
    confetti: ['🎉', '🎊', '✨', '🎈']
  };

  const symbols = emojiMap[effect] || emojiMap.sparkles;
  container.innerHTML = '';

  for (let i = 0; i < 12; i++) {
    const p = document.createElement('span');
    const sym = symbols[i % symbols.length];
    const left = Math.floor(Math.random() * 96) + 2;
    const dur = (Math.random() * 6 + 6).toFixed(1);
    const delay = (Math.random() * 5).toFixed(1);
    const size = Math.floor(Math.random() * 12 + 16);

    p.innerText = sym;
    p.style.cssText = 'position:absolute;bottom:-30px;left:' + left + '%;font-size:' + size + 'px;animation:cpmFloatUp ' + dur + 's ease-in-out ' + delay + 's infinite;opacity:0;';
    container.appendChild(p);
  }
}

