// ════════════════════════════════════════════════════════
// VVCE Events Hub — Data Store & State Management
// ════════════════════════════════════════════════════════

const STATE = {
  currentUser: null,
  currentPage: null,
  pageHistory: [],
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  selectedCalDate: null,
  deanUnlocked: false,
};

// ── LOCAL STORAGE DB ──────────────────────────────────────────────────────────
const DB = {
  get:    (k) => { try { return JSON.parse(localStorage.getItem('vvce_' + k)); } catch { return null; } },
  set:    (k, v) => localStorage.setItem('vvce_' + k, JSON.stringify(v)),
  getArr: (k) => { try { return JSON.parse(localStorage.getItem('vvce_' + k)) || []; } catch { return []; } },
  push:   (k, v) => { const a = DB.getArr(k); a.push(v); DB.set(k, a); },
  update: (k, id, updates) => {
    const arr = DB.getArr(k);
    const idx = arr.findIndex(x => x.id === id);
    if (idx !== -1) { arr[idx] = { ...arr[idx], ...updates }; DB.set(k, arr); return arr[idx]; }
    return null;
  },
  remove: (k, id) => DB.set(k, DB.getArr(k).filter(x => x.id !== id)),
};

// ── SEED DATA ─────────────────────────────────────────────────────────────────
function seedData() {
  if (DB.get('seeded') === true) return;

  DB.set('users', [
    {
      id:'u1', type:'student',
      name:'ARJUN SHARMA', usn:'1VV21CS001', year:'3rd Year', sem:'Sem 6',
      branch:'CS', section:'A', email:'student@vvce.ac.in', password:'password123',
      interests:['Technical','Management'], phone:'9876543210',
      linkedin:'linkedin.com/in/arjun-sharma', github:'github.com/arjun-sharma',
      skills:['Python','React','Node.js','Machine Learning'],
      bio:'Passionate full-stack developer and tech enthusiast. Love building products that solve real problems.',
      profilePhoto:null, resume:null,
      achievements:['Best Project Award — TechFest 2024','Runner-up — National Hackathon 2024','Google Developer Student Club Lead'],
      points:82,
      pointsBySem:{'Sem 1':12,'Sem 2':18,'Sem 3':22,'Sem 4':10,'Sem 5':20,'Sem 6':0,'Sem 7':0,'Sem 8':0}
    },
    {
      id:'u8', type:'student',
      name:'DIVYA KRISHNA', usn:'1VV21IS012', year:'3rd Year', sem:'Sem 6',
      branch:'IS', section:'B', email:'divya@vvce.ac.in', password:'password123',
      interests:['Cultural','Technical'], phone:'9876543214', linkedin:'', github:'',
      skills:['Java','Flutter','UI/UX Design'],
      bio:'Student developer, dancer, and design enthusiast.',
      profilePhoto:null, resume:null, achievements:['Classical Dance Gold Medal 2023'],
      points:45,
      pointsBySem:{'Sem 1':10,'Sem 2':15,'Sem 3':20,'Sem 4':0,'Sem 5':0,'Sem 6':0,'Sem 7':0,'Sem 8':0}
    },
    {
      id:'u2', type:'admin', clubName:'IEEE Student Chapter', domain:'Technical',
      dept:'Computer Science (CS)', adminName:'PRIYA PATEL',
      email:'ieee@vvce.ac.in', password:'admin123', status:'approved',
      facultyCoordinator:'Dr. Ramesh Kumar', phone:'9876543211',
      description:'IEEE Student Chapter at VVCE promotes technical excellence, professional networking, and innovation among engineering students.',
      approvedAt:'2024-08-01'
    },
    {
      id:'u6', type:'admin', clubName:'Cultural Club VVCE', domain:'Cultural',
      dept:'Cross-Departmental', adminName:'SNEHA REDDY',
      email:'cultural@vvce.ac.in', password:'cultural123', status:'approved',
      facultyCoordinator:'Dr. Kavitha M', phone:'9876543212',
      description:'Promoting arts, dance, music and cultural activities across VVCE campus.',
      approvedAt:'2024-08-05'
    },
    {
      id:'u7', type:'admin', clubName:'Sports Committee VVCE', domain:'Sports',
      dept:'Cross-Departmental', adminName:'RAHUL VERMA',
      email:'sports@vvce.ac.in', password:'sports123', status:'pending',
      facultyCoordinator:'Prof. Girish S', phone:'9876543213',
      description:'Organizing and managing all sports activities, tournaments, and inter-college competitions at VVCE.',
      submittedAt:'2025-06-01'
    },
    {
      id:'u9', type:'admin', clubName:'Robotics & AI Club', domain:'Technical',
      dept:'Electronics & Communication (EC)', adminName:'KIRAN PATIL',
      email:'robotics@vvce.ac.in', password:'robot123', status:'pending',
      facultyCoordinator:'Prof. Deepak R', phone:'9876543215',
      description:'Building intelligent machines and AI-powered systems. Open to all engineering branches.',
      submittedAt:'2025-06-03'
    },
    {
      id:'u3', type:'authority', name:'DR. SURESH KUMAR', designation:'dean',
      dept:'Administration', email:'dean@vvce.ac.in', password:'dean123'
    },
    {
      id:'u4', type:'authority', name:'DR. ANITHA RAO', designation:'principal',
      dept:'Administration', email:'principal@vvce.ac.in', password:'principal123'
    },
    {
      id:'u5', type:'authority', name:'PROF. MAHESH BABU', designation:'hod',
      dept:'Computer Science (CS)', email:'hod.cs@vvce.ac.in', password:'hod123'
    },
  ]);

  DB.set('events', [
    {
      id:'e1', name:'HACKATHON 2025', club:'IEEE Student Chapter', category:'Technical',
      description:'24-hour coding marathon — build innovative solutions to real-world problems. Teams of 2–4. Open to all branches. ₹0 entry, cloud credits provided.',
      date:'2025-06-15', time:'09:00', venue:'Seminar Hall A', maxParticipants:120,
      fee:0, points:20, emoji:'💻', status:'approved', adminId:'u2',
      registeredCount:87, registrations:['u1'], highlights:true
    },
    {
      id:'e2', name:'TECHVISION QUIZ', club:'IEEE Student Chapter', category:'Technical',
      description:'National-level technical quiz covering electronics, CS fundamentals, and current technology trends. Individual participation.',
      date:'2025-06-20', time:'11:00', venue:'Smart Classroom 101', maxParticipants:80,
      fee:50, points:10, emoji:'🧠', status:'approved', adminId:'u2',
      registeredCount:52, registrations:[]
    },
    {
      id:'e3', name:'CULTURAL FIESTA', club:'Cultural Club VVCE', category:'Cultural',
      description:'Annual cultural extravaganza featuring dance, music, drama, art and much more! Cash prizes for winners. Open to all students.',
      date:'2025-07-05', time:'10:00', venue:'Auditorium', maxParticipants:500,
      fee:0, points:15, emoji:'🎭', status:'approved', adminId:'u6',
      registeredCount:312, registrations:['u1'], highlights:true
    },
    {
      id:'e4', name:'PYTHON FOR DATA SCIENCE', club:'IEEE Student Chapter', category:'Workshop',
      description:'Hands-on 2-day workshop on Python for Data Science and Machine Learning with industry mentors. Certificate of completion provided.',
      date:'2025-06-28', time:'09:30', venue:'Computer Lab 2', maxParticipants:40,
      fee:100, points:12, emoji:'🐍', status:'approved', adminId:'u2',
      registeredCount:35, registrations:[]
    },
    {
      id:'e5', name:'INTER-COLLEGE CRICKET', club:'Sports Committee VVCE', category:'Sports',
      description:'Annual inter-college cricket tournament. Register your team and compete for the championship trophy!',
      date:'2025-07-12', time:'08:00', venue:'Sports Ground', maxParticipants:200,
      fee:0, points:20, emoji:'🏏', status:'pending', adminId:'u7',
      registeredCount:0, registrations:[]
    },
    {
      id:'e6', name:'MANAGEMENT CONCLAVE', club:'MBA Cell VVCE', category:'Management',
      description:'Business strategy case study competition and panel discussion with industry leaders and entrepreneurs.',
      date:'2025-06-25', time:'10:00', venue:'Conference Room B', maxParticipants:60,
      fee:200, points:15, emoji:'📊', status:'approved', adminId:'u2',
      registeredCount:28, registrations:[]
    },
    {
      id:'e7', name:'ROBOTICS EXPO', club:'IEEE Student Chapter', category:'Technical',
      description:'Showcase your robots and automation projects to industry experts and get live feedback. Open for all engineering branches.',
      date:'2025-07-18', time:'09:00', venue:'Engineering Lab Block', maxParticipants:100,
      fee:150, points:25, emoji:'🤖', status:'approved', adminId:'u2',
      registeredCount:45, registrations:[], highlights:true
    },
    {
      id:'e8', name:'DANCE COMPETITION', club:'Cultural Club VVCE', category:'Cultural',
      description:'Solo and group dance competition — classical, western, and folk. Cash prizes ₹5000 for first place. Register as solo or group.',
      date:'2025-07-05', time:'14:00', venue:'Auditorium', maxParticipants:200,
      fee:50, points:10, emoji:'💃', status:'approved', adminId:'u6',
      registeredCount:78, registrations:[]
    },
    {
      id:'e9', name:'CLOUD COMPUTING BOOTCAMP', club:'IEEE Student Chapter', category:'Workshop',
      description:'2-day intensive bootcamp on AWS, Azure, and GCP. Includes hands-on labs and industry certification prep. Certificate provided.',
      date:'2025-08-02', time:'09:00', venue:'Seminar Hall B', maxParticipants:50,
      fee:300, points:20, emoji:'☁️', status:'approved', adminId:'u2',
      registeredCount:22, registrations:[]
    },
  ]);

  DB.set('certificates', [
    { id:'c1', userId:'u1', eventName:'HACKATHON 2024', club:'IEEE Student Chapter', date:'2024-11-15', points:20, position:'Winner', type:'achievement', verified:true },
    { id:'c2', userId:'u1', eventName:'CULTURAL FIESTA 2024', club:'Cultural Club VVCE', date:'2024-12-05', points:15, position:'Participant', type:'participation', verified:true },
    { id:'c3', userId:'u1', eventName:'WEB DEV WORKSHOP', club:'CSE Department', date:'2025-01-20', points:12, position:'Participant', type:'participation', verified:false },
    { id:'c4', userId:'u1', eventName:'NATIONAL CODING CHAMPIONSHIP', club:'External — HackerEarth', date:'2025-02-14', points:25, position:'Runner-up', type:'achievement', verified:true },
  ]);

  DB.set('notifications', [
    { id:'n1', userId:'u1', message:'Your registration for HACKATHON 2025 is confirmed! 🎉', time:'2 hours ago', read:false, icon:'✅' },
    { id:'n2', userId:'u1', message:'CULTURAL FIESTA 2025 registrations now open. Don\'t miss out!', time:'1 day ago', read:false, icon:'🎭' },
    { id:'n3', userId:'u1', message:'You earned 20 AICTE activity points for HACKATHON 2024.', time:'2 days ago', read:true, icon:'⭐' },
    { id:'n4', userId:'u1', message:'New event: ROBOTICS EXPO 2025 — Registration opens soon!', time:'3 days ago', read:true, icon:'🤖' },
    { id:'n5', userId:'u2', message:'New student registered for HACKATHON 2025.', time:'1 hour ago', read:false, icon:'👤' },
    { id:'n6', userId:'u2', message:'TECHVISION QUIZ has 52 registrations — 28 slots remaining.', time:'5 hours ago', read:false, icon:'📊' },
    { id:'n7', userId:'u3', message:'New club registration pending: Sports Committee VVCE', time:'3 hours ago', read:false, icon:'🔔' },
    { id:'n8', userId:'u3', message:'New club registration pending: Robotics & AI Club', time:'1 day ago', read:false, icon:'🔔' },
    { id:'n9', userId:'u3', message:'Event approval requested: INTER-COLLEGE CRICKET by Sports Committee', time:'2 days ago', read:true, icon:'📋' },
  ]);

  DB.set('seeded', true);
}

// ── DATA ACCESSORS ────────────────────────────────────────────────────────────
const Data = {
  users:         () => DB.getArr('users'),
  events:        () => DB.getArr('events'),
  certs:         () => DB.getArr('certificates'),
  notifs:        () => DB.getArr('notifications'),
  userById:      (id) => DB.getArr('users').find(u => u.id === id),
  eventById:     (id) => DB.getArr('events').find(e => e.id === id),
  approvedEvents:() => DB.getArr('events').filter(e => e.status === 'approved'),
  pendingEvents: () => DB.getArr('events').filter(e => e.status === 'pending'),
  myNotifs:      (uid) => DB.getArr('notifications').filter(n => n.userId === uid),
  unreadCount:   (uid) => DB.getArr('notifications').filter(n => n.userId === uid && !n.read).length,
  pendingClubs:  () => DB.getArr('users').filter(u => u.type === 'admin' && u.status === 'pending'),
  approvedClubs: () => DB.getArr('users').filter(u => u.type === 'admin' && u.status === 'approved'),
  allClubs:      () => DB.getArr('users').filter(u => u.type === 'admin'),
  studentRegs:   (uid) => DB.getArr('events').filter(e => e.registrations && e.registrations.includes(uid)),
  studentCerts:  (uid) => DB.getArr('certificates').filter(c => c.userId === uid),
  adminEvents:   (aid) => DB.getArr('events').filter(e => e.adminId === aid),
};

// ── DATA MUTATIONS ────────────────────────────────────────────────────────────
const Mutate = {
  registerForEvent(uid, eid) {
    const events = DB.getArr('events');
    const ev = events.find(e => e.id === eid);
    if (!ev || ev.registrations.includes(uid)) return false;
    ev.registrations.push(uid);
    ev.registeredCount = (ev.registeredCount || 0) + 1;
    DB.set('events', events);
    return true;
  },
  unregisterFromEvent(uid, eid) {
    const events = DB.getArr('events');
    const ev = events.find(e => e.id === eid);
    if (!ev) return false;
    ev.registrations = ev.registrations.filter(id => id !== uid);
    ev.registeredCount = Math.max(0, (ev.registeredCount || 1) - 1);
    DB.set('events', events);
    return true;
  },
  approveClub:  (id) => DB.update('users', id, { status:'approved', approvedAt: new Date().toISOString().split('T')[0] }),
  rejectClub:   (id) => DB.update('users', id, { status:'rejected' }),
  approveEvent: (id) => DB.update('events', id, { status:'approved' }),
  rejectEvent:  (id) => DB.update('events', id, { status:'rejected' }),
  updateUser(id, updates) {
    const result = DB.update('users', id, updates);
    if (STATE.currentUser && STATE.currentUser.id === id) {
      STATE.currentUser = { ...STATE.currentUser, ...updates };
    }
    return result;
  },
  addEvent:      (e) => DB.push('events', e),
  addCertificate:(c) => DB.push('certificates', c),
  addNotif:      (n) => DB.push('notifications', n),
  markNotifRead: (id) => DB.update('notifications', id, { read:true }),
  markAllNotifsRead(uid) {
    const notifs = DB.getArr('notifications').map(n => n.userId === uid ? { ...n, read:true } : n);
    DB.set('notifications', notifs);
  },
};

function genId(prefix = 'id') {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}
