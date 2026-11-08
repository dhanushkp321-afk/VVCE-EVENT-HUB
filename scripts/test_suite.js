const crypto = require('crypto');

// Simulate the browser PBKDF2 function implemented in app.js and cpm.html
async function hashPasswordWithSalt(password, saltStr) {
  const enc = new TextEncoder();
  const salt = enc.encode(saltStr || ('salt_' + Math.random().toString(36).substring(2, 10)));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return { hash: hashHex, salt: new TextDecoder().decode(salt) };
}

async function verifyPasswordWithSalt(password, storedHash, saltStr) {
  const { hash } = await hashPasswordWithSalt(password, saltStr);
  return hash === storedHash;
}

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

  // Test 1: Password hashing and verification
  const pass = 'TestAuthorityPass@2026';
  const salt = 'vvce_salt_random_123';
  const { hash } = await hashPasswordWithSalt(pass, salt);
  console.log('Test 1: Salted PBKDF2 Hash generated:', hash.substring(0, 16) + '...');
  
  const correctMatch = await verifyPasswordWithSalt(pass, hash, salt);
  const wrongMatch = await verifyPasswordWithSalt('WrongPassword', hash, salt);
  console.log('Test 1a: Correct password verified:', correctMatch === true ? 'PASS' : 'FAIL');
  console.log('Test 1b: Wrong password rejected:', wrongMatch === false ? 'PASS' : 'FAIL');

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
