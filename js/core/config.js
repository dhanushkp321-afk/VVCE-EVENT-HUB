/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Configuration, State & Supabase Setup
   Path: js/core/config.js
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   VVCE Events Hub — Complete Application Logic
   Author: Antigravity AI
   Version: 3.0
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   GOOGLE OAUTH CONFIGURATION
   To enable real Google Sign-In:
   1. Go to https://console.cloud.google.com/
   2. Create a project → APIs & Services → Credentials
   3. Create OAuth 2.0 Client ID (Web Application type)
   4. Add http://localhost:8000 to Authorized JavaScript Origins
   5. Paste the Client ID string below
───────────────────────────────────────────────────────────────*/
const GOOGLE_CLIENT_ID = ''; /* ← Paste your Google Client ID here */

/* ─────────────────────────────────────────────────────────────
   STATE & DATABASE LAYER
───────────────────────────────────────────────────────────────*/
const STATE = {
  user: null,
  page: null,
  prevPage: null,
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  selectedDate: null,
  deanUnlocked: false,
  principalUnlocked: false,
  regRole: 'student',
  rejectEventId: null,
};

const supabaseUrl = 'https://nkugbdencpvhhvgqybgi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rdWdiZGVuY3B2aGh2Z3F5YmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4OTY3MzMsImV4cCI6MjA5NjQ3MjczM30.YFFnsWBymu4R59aMHTEq6ogwI0xb4xjbavpto1FrVWY';

function getSupabaseClient() {
  if (window.supabase && typeof window.supabase.from === 'function') {
    return window.supabase;
  }
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    return window.supabase;
  }
  if (typeof createClient === 'function') {
    window.supabase = createClient(supabaseUrl, supabaseKey);
    return window.supabase;
  }
  return null;
}

const DEFAULT_USERS = [
  { id: 'u1', type: 'student', name: 'Akash Sharma', email: 'akash@vvce.ac.in', pass: 'demo1234', usn: '4VV21CS001', branch: 'CS', section: 'A', year: '4th Year', sem: 'Sem 8', admissionYear: 2021, dept: 'Computer Science', phone: '+91 98765 43210', interests: ['Technical', 'Workshop'], skills: [], bio: '', linkedin: '', github: '', achievements: [], profilePhoto: null, resume: null, points: 120, pointsBySem: { 'Sem 1': 20, 'Sem 2': 20, 'Sem 3': 20, 'Sem 4': 20, 'Sem 5': 20, 'Sem 6': 20, 'Sem 7': 0, 'Sem 8': 0 }, notifs: [] },
  { id: 'u2', type: 'admin', name: 'Harshill M Gowda', email: 'harshill@vvce.ac.in', pass: 'demo1234', clubName: 'CSE Club', clubEmail: 'cseclub@vvce.ac.in', domain: 'Technical', branch: 'CSE', usn: '4VV21CS045', faculty: 'Dr. Ramesh Kumar', phone: '+91 98765 43211', desc: 'Official Computer Science Club of VVCE', approved: true, notifs: [] },
  { id: 'u3', type: 'authority', name: 'Dr. Priya Nair', email: 'dean.sw@vvce.ac.in', pass: 'demo1234', designation: 'dean', dept: 'Student Welfare', phone: '+91 98765 43212', notifs: [] },
  { id: 'u4', type: 'authority', name: 'Prof. Vijay Rao', email: 'principal@vvce.ac.in', pass: 'demo1234', designation: 'principal', dept: 'Administration', phone: '+91 98765 43213', notifs: [] }
];

const SUPABASE_CACHE = {
  vvce_users: [],
  vvce_events: [],
  vvce_certs: [],
  vvce_academic: []
};
