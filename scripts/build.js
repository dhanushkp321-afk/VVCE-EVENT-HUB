/**
 * VVCE Events Hub — Build & Script Bundler / Validator
 * This script verifies all separated page modules and can bundle them into app.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

const moduleFiles = [
  // 1. Core Framework
  'js/core/config.js',
  'js/core/database.js',
  'js/core/utils.js',
  'js/core/router.js',

  // 2. Separated Pages & Dashboards
  'js/pages/auth.js',
  'js/pages/student-dashboard.js',
  'js/pages/events.js',
  'js/pages/clubs.js',
  'js/pages/calendar.js',
  'js/pages/registrations.js',
  'js/pages/certificates.js',
  'js/pages/profile.js',
  'js/pages/faculty-dashboard.js',
  'js/pages/create-event.js',
  'js/pages/manage-events.js',
  'js/pages/participants.js',
  'js/pages/authority-portal.js',
  'js/pages/authority-views.js',
  'js/pages/cpm-theme.js',

  // 3. Application Initializer
  'js/main.js'
];

console.log('--- VVCE Events Hub: Validating Modular Architecture ---');

let hasError = false;
moduleFiles.forEach(fileRel => {
  const fullPath = path.join(rootDir, fileRel);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing module file: ${fileRel}`);
    hasError = true;
    return;
  }
  try {
    execSync(`node -c "${fullPath}"`);
    console.log(`✅ ${fileRel} passed syntax validation.`);
  } catch (err) {
    console.error(`❌ Syntax error in ${fileRel}:`, err.message);
    hasError = true;
  }
});

if (hasError) {
  console.error('\nBuild failed with errors.');
  process.exit(1);
}

// Bundle into app.js for fallback/legacy compatibility
console.log('\n--- Bundling all modules into app.js ---');
const header = `/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Complete Application Logic (Bundled Distribution)
   Generated from separated modular architecture:
   - js/core/* (Configuration, Database layer, Utilities, Router)
   - js/pages/* (Auth, Student, Faculty, Authority, Events, Clubs, etc.)
   ═══════════════════════════════════════════════════════════════ */\n\n`;

const bundledContent = header + moduleFiles.map(fileRel => {
  const content = fs.readFileSync(path.join(rootDir, fileRel), 'utf8');
  return `/* ─── Module: ${fileRel} ─── */\n` + content;
}).join('\n\n');

fs.writeFileSync(path.join(rootDir, 'app.js'), bundledContent, 'utf8');
console.log(`✅ Successfully generated app.js (${bundledContent.split('\n').length} lines).`);
console.log('All modules validated and synchronized!');
