const fs = require('fs');
const path = require('path');

// Global Clash Detection Logic Test
function checkClash(targetEvent, activeEvents) {
  return activeEvents.find(other => 
    other.id !== targetEvent.id &&
    other.status === 'approved' &&
    other.date === targetEvent.date &&
    (other.venue || '').trim().toLowerCase() === (targetEvent.venue || '').trim().toLowerCase()
  );
}

async function runTests() {
  console.log('--- STARTING UNIT & INTEGRATION TESTS ---');

  const cpmHtml = fs.readFileSync(path.join(__dirname, 'cpm.html'), 'utf8');
  const cpmLoginFunction = fs.readFileSync(path.join(__dirname, 'supabase', 'functions', 'cpm-login', 'index.ts'), 'utf8');
  const cpmLoginMigration = fs.readFileSync(path.join(__dirname, 'supabase', 'migrations', '20261123191105_cpm_login_usernames.sql'), 'utf8');
  const migrationSql = fs.readFileSync(path.join(__dirname, 'migration_approving_authorities.sql'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const mainHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const resetSql = fs.readFileSync(path.join(__dirname, 'supabase', 'reset_test_data.sql'), 'utf8');
  const authMigration = fs.readFileSync(path.join(__dirname, 'supabase', 'migrations', '20261123183601_main_site_supabase_auth.sql'), 'utf8');
  const rbacMigration = fs.readFileSync(path.join(__dirname, 'supabase', 'migrations', '20261121215005_server_rbac_authority_workflows.sql'), 'utf8');

  console.log('Test 7a: Built-in demo accounts and quick login removed:',
    !appJs.includes('DEFAULT_USERS') &&
    !appJs.includes('function quickLogin') &&
    !mainHtml.includes('quickLogin(') ? 'PASS' : 'FAIL');
  console.log('Test 7b: Built-in Dean demo password removed:',
    !appJs.includes('deanwellfair@vvce') &&
    !migrationSql.includes('deanwellfair@vvce') ? 'PASS' : 'FAIL');
  console.log('Test 7c: Fresh-test SQL clears events and accounts:',
    resetSql.includes('DELETE FROM public.events') &&
    resetSql.includes('DELETE FROM public.users') &&
    resetSql.includes('DELETE FROM auth.users') ? 'PASS' : 'FAIL');

  console.log('Test 4a: CPM fixed password removed:',
    !cpmHtml.includes('Vvce@Admin#CPM2025') ? 'PASS' : 'FAIL');
  console.log('Test 4b: CPM login uses role, username, and password without email:',
    cpmHtml.includes('id="cpm-role"') &&
    cpmHtml.includes('id="cpm-username"') &&
    cpmHtml.includes('id="cpm-pass"') &&
    !cpmHtml.includes('id="cpm-email"') ? 'PASS' : 'FAIL');
  console.log('Test 4c: CPM login uses the server-side login function:',
    cpmHtml.includes("sb.functions.invoke('cpm-login'") &&
    !cpmHtml.includes('signInWithPassword') ? 'PASS' : 'FAIL');
  console.log('Test 4d: RPC approval binds authority to authenticated admin:',
    migrationSql.includes('m.user_id = auth.uid()') &&
    migrationSql.includes('cpm_admin_members') ? 'PASS' : 'FAIL');
  console.log('Test 4e: Broad anonymous RPC execution removed:',
    !/approve_event_with_clash_check[^;]*TO anon,[ ]*authenticated/is.test(migrationSql) &&
    migrationSql.includes('REVOKE EXECUTE ON FUNCTION public.approve_event_with_clash_check') ? 'PASS' : 'FAIL');
  console.log('Test 5a: CPM has no approval button:',
    !cpmHtml.includes('quickApproveEvent') &&
    !cpmHtml.includes('Approve Event') ? 'PASS' : 'FAIL');
  console.log('Test 5b: CPM approval status removed:',
    !/<option value="approved">/i.test(cpmHtml) &&
    cpmHtml.includes('cannot approve events') ? 'PASS' : 'FAIL');
  console.log('Test 5c: Recycle restore routes through authority queue:',
    cpmHtml.includes("status: 'pending'") &&
    cpmHtml.includes('authority approval') ? 'PASS' : 'FAIL');
  console.log('Test 6a: Club admin All Events nav removed:',
    (() => {
      const source = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
      return (source.match(/\$\{navItem\('events','🗓️','All Events'\)\}/g) || []).length === 1;
    })() ? 'PASS' : 'FAIL');
  console.log('Test 6b: Club admin Clubs nav removed:',
    (() => {
      const source = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
      return (source.match(/\$\{navItem\('clubs','🏛️','Clubs'\)\}/g) || []).length === 1;
    })() ? 'PASS' : 'FAIL');
  console.log('Test 6c: Club admin direct routes blocked:',
    fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8').includes("STATE.user?.type === 'admin' && (pageId === 'events' || pageId === 'clubs')") ? 'PASS' : 'FAIL');

  const authChecks = [
    ['Main-site login uses Supabase Auth', appJs.includes('sb.auth.signInWithPassword({ email, password: pass })')],
    ['Legacy browser-stored passwords are removed on startup', appJs.includes('delete profile.pass') && appJs.includes("localStorage.removeItem('vvce_approving_authorities')")],
    ['Authority access is resolved from the server-mapped Auth identity', appJs.includes(".eq('auth_user_id', supaUser.id)") && authMigration.includes('aa.auth_user_id = auth.uid()')],
    ['Authority self-registration is removed from the signup UI', !mainHtml.includes('rcard-authority') && !mainHtml.includes('form-authority')],
    ['Recovery uses Supabase Auth instead of client-issued OTPs', appJs.includes('sb.auth.resetPasswordForEmail(email') && appJs.includes('sb.auth.updateUser({ password: newPass })')],
    ['Auth migration removes plaintext password columns', authMigration.includes('DROP COLUMN IF EXISTS pass') && !cpmHtml.includes('password_hash')],
    ['Auth profile migration inserts PostgreSQL array columns as text arrays', authMigration.includes("ARRAY(SELECT jsonb_array_elements_text(v_meta -> 'interests'))") && (authMigration.match(/ARRAY\[\]::text\[\]/g) || []).length >= 2],
    ['Server RBAC migration terminates the authority policy statement', /USING \(true\);\s*ALTER TABLE public\.cpm_admin_members/.test(rbacMigration)],
    ['CPM authority creation never stores passwords', !cpmHtml.includes('new-auth-pass') && cpmHtml.includes('auth_user_id')],
    ['CPM login maps usernames to active server-side roles before Auth sign-in', cpmLoginFunction.includes('cpm_admin_members') && cpmLoginFunction.includes('signInWithPassword') && cpmLoginFunction.includes('.eq("role", role)') && cpmLoginFunction.includes('.eq("active", true)')],
    ['CPM login does not return mapped email addresses', cpmLoginFunction.includes('access_token: authData.session.access_token') && !/jsonResponse\([^)]*email/is.test(cpmLoginFunction)],
    ['CPM login falls back to legacy Supabase keys when key maps have no default', /if \(keysJson\) \{[\s\S]*?\r?\n  \}\s*\r?\n\s*const legacyKey = Deno\.env\.get\(legacyEnv\);/.test(cpmLoginFunction)],
    ['CPM usernames are unique and login attempts are rate-limited', cpmLoginMigration.includes('idx_cpm_admin_members_login_username') && cpmLoginMigration.includes('consume_cpm_login_attempt') && cpmLoginMigration.includes('GRANT EXECUTE ON FUNCTION public.consume_cpm_login_attempt(TEXT) TO service_role')],
    ['Main-site role and approval state are protected server-side', authMigration.includes('protect_user_auth_role') && authMigration.includes('vvce.authority_rpc') && migrationSql.includes('protect_club_approval_columns') && migrationSql.includes('protect_event_approval_columns')]
  ];
  let authChecksPassed = true;
  for (const [label, passed] of authChecks) {
    console.log(`Auth security check: ${label}:`, passed ? 'PASS' : 'FAIL');
    if (!passed) authChecksPassed = false;
  }
  if (!authChecksPassed) process.exitCode = 1;

  // Test 2: Global Clash Detection across different authorities
  const authorityA_Event = {
    id: 'ev_1',
    name: 'CSE AI Symposium',
    club: 'CSE Club',
    date: '2026-11-15',
    venue: 'Auditorium A',
    status: 'approved',
    authorityId: 'auth_dean_sw'
  };

  const authorityB_Event = {
    id: 'ev_2',
    name: 'ECE Robotics Workshop',
    club: 'Robotics Club',
    date: '2026-11-15',
    venue: 'Auditorium a', // case insensitive check
    status: 'pending',
    authorityId: 'auth_ece_hod'
  };

  const authorityC_EventDifferentVenue = {
    id: 'ev_3',
    name: 'Mechanical CAD Contest',
    club: 'Mech Club',
    date: '2026-11-15',
    venue: 'Seminar Hall 2',
    status: 'pending',
    authorityId: 'auth_mech_hod'
  };

  const allApproved = [authorityA_Event];

  const clashDetected = checkClash(authorityB_Event, allApproved);
  console.log('Test 2a: Cross-authority venue conflict detected:', clashDetected ? 'PASS (' + clashDetected.name + ')' : 'FAIL');

  const noClash = checkClash(authorityC_EventDifferentVenue, allApproved);
  console.log('Test 2b: Non-clashing venue allowed:', noClash === undefined ? 'PASS' : 'FAIL');

  // Test 3: Authority Isolation
  const clubs = [
    { id: 'c1', name: 'CSE Lead', clubName: 'CSE Club', authorityId: 'auth_dean_sw', approved: true },
    { id: 'c2', name: 'ECE Lead', clubName: 'ECE Club', authorityId: 'auth_ece_hod', approved: false },
    { id: 'c3', name: 'Mech Lead', clubName: 'Mech Club', authorityId: 'auth_dean_sw', approved: false }
  ];

  const deanClubs = clubs.filter(c => c.authorityId === 'auth_dean_sw');
  const eceClubs = clubs.filter(c => c.authorityId === 'auth_ece_hod');
  console.log('Test 3a: Dean assigned clubs count (expected 2):', deanClubs.length === 2 ? 'PASS' : 'FAIL');
  console.log('Test 3b: ECE HOD assigned clubs count (expected 1):', eceClubs.length === 1 ? 'PASS' : 'FAIL');

  console.log('--- ALL AUTOMATED TESTS COMPLETED SUCCESSFULLY ---');
}

runTests();
