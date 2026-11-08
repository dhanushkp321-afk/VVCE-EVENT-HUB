# 🎓 VVCE Events Hub

> **Centralized Event Management, Club Administration & Approving Authority Platform**  
> Vidyavardhaka College of Engineering (VVCE), Mysuru.

---

## 🏛️ Project Overview

**VVCE Events Hub** is a full-featured campus web platform designed for students, clubs, faculty coordinators, and institutional authorities (Dean Student Welfare, Principals, HODs). It provides automated venue clash detection, VTU AICTE activity points tracking, QR ticket check-ins, multi-member team registrations, and a multi-tab executive approval portal.

---

## 🗂️ Repository Directory Structure

The repository is organized into distinct, modular directories so that every page, portal, dashboard, database migration, and script can be easily maintained and updated independently:

```
vvce-events-hub/
│
├── 📄 index.html                       # Main Single-Page Application (SPA) entry point
├── 📄 cpm.html                         # Central Portal Management (Super Admin & System Configuration)
├── 🎨 style.css                        # Complete design system & responsive styling
├── ⚙️ package.json                     # Project scripts and configuration
├── 🚀 vercel.json                      # Vercel deployment and routing rules
│
├── 📂 pages/                           # 📄 Modular HTML Page Views & Components
│   ├── auth-login-registration.html   # Login, Student/Admin/Authority Registration & Password Reset
│   ├── student-dashboard.html         # Student Dashboard (Points, metrics, upcoming events)
│   ├── events-feed.html               # Events Feed, category filters & search
│   ├── clubs-directory.html           # Clubs Directory & Club Detail profiles
│   ├── calendar-schedule.html         # Interactive Monthly Calendar & Academic Timetable
│   ├── my-registrations.html          # My Registrations & QR Passes
│   ├── certificates.html              # Event Certificates & PDF Generator
│   ├── user-profile.html              # User Profile & Academic Credentials
│   ├── faculty-dashboard.html         # Faculty / Club Admin Dashboard
│   ├── create-event.html              # Event Creation Form (with venue clash check)
│   ├── manage-events.html             # Manage Organized Club Events
│   ├── participants-attendance.html   # Participant Management & QR Camera Scanner
│   ├── authority-portal.html          # 6-Tab Approving Authority Portal
│   └── README.md                      # Detailed guide to all pages and templates
│
├── 📂 js/                              # 💻 Modular JavaScript Application Architecture
│   ├── 📂 core/                        # Core Foundation & Infrastructure
│   │   ├── config.js                  # Supabase config, OAuth, seed users & state
│   │   ├── database.js                # Supabase REST sync, local cache & PBKDF2 cryptography
│   │   ├── utils.js                   # Modals, toasts, date/time formatters & clash logic
│   │   └── router.js                  # Routing table (showPage), sidebar, topbar & notifications
│   │
│   ├── 📂 pages/                       # 🧩 Separated Page & Dashboard Controllers
│   │   ├── auth.js                    # Login, Registration (Student/Admin/Authority), Forgot Password, GIS
│   │   ├── student-dashboard.js       # Student Dashboard metrics & activity points breakdown
│   │   ├── events.js                  # Events Feed, filters, search & team registrations
│   │   ├── clubs.js                   # Clubs directory, club details & team rosters
│   │   ├── calendar.js                # Calendar view & academic schedules
│   │   ├── registrations.js           # Student registrations, QR passes & cancellations
│   │   ├── certificates.js            # Certificates & client-side PDF export
│   │   ├── profile.js                 # User profile management
│   │   ├── faculty-dashboard.js       # Faculty / Club Admin dashboard & analytics
│   │   ├── create-event.js            # Event creation & editing with authority assignment
│   │   ├── manage-events.js           # Club event management & status filters
│   │   ├── participants.js            # Attendee rosters, CSV export & QR camera check-in
│   │   ├── authority-portal.js        # 6-Tab Approving Authority Portal (Overview, Clubs, Events, Clash)
│   │   ├── authority-views.js         # Authority monitor views (Dean & Principal portals)
│   │   └── cpm-theme.js               # Dynamic CPM Configuration & Festival Theme Engine
│   │
│   └── 🚀 main.js                     # Application bootstrapper & lifecycle event listeners
│
├── 📂 database/                        # 🗄️ SQL Database Migrations & Schemas
│   ├── migration_approving_authorities.sql # Approving authorities table, audit logs & atomic clash RPC
│   ├── add_team_columns.sql           # Team registration schema migration
│   └── README.md                      # Step-by-step database setup instructions for Supabase
│
├── 📂 docs/                            # 📚 System Documentation & Specifications
│   ├── VVCE_Events_Hub_Server_Requirements.pdf # Official server and system requirements
│   └── requirements_clean.html        # Interactive requirements document
│
├── 📂 scripts/                         # 🛠️ Build, Testing & Automation Tools
│   ├── build.js                       # Modular architecture validator & app.js bundler
│   ├── rebuild_cpm.js                 # CPM portal generator
│   └── test_suite.js                  # Automated test suite (PBKDF2 hashing, clash detection)
│
└── 📂 assets/                          # 🖼️ Static Brand Assets & Data
    ├── vvce-logo-header.png           # VVCE official header emblem
    └── eng.traineddata                # OCR trained data model for ID cards
```

---

## 🎯 Separated Portals & Roles

| Role / Portal | Main Pages | Key Capabilities |
|---|---|---|
| **🎓 Student** | `student-dashboard.html`, `events-feed.html`, `calendar-schedule.html`, `my-registrations.html`, `certificates.html`, `user-profile.html` | • Discover & register for events (Solo or Team)<br>• Download QR entry passes<br>• Track VTU AICTE activity points across Sem 1–8<br>• Access verified event participation certificates |
| **🏛️ Club Admin / Faculty** | `faculty-dashboard.html`, `create-event.html`, `manage-events.html`, `participants-attendance.html` | • Propose events with automated venue clash prevention<br>• Assign events to specific Approving Authorities<br>• Scan attendee QR passes at venue gates with camera<br>• Export participant lists to CSV & verify UPI payments |
| **👔 Approving Authority** | `authority-portal.html` | **6-Tab Executive Portal**:<br>1. 📊 **Overview**: Assigned clubs, event volume & clash alerts<br>2. 👥 **Club Registrations**: Approve or reject club affiliations<br>3. 📋 **Event Approvals**: Concurrent clash verification & atomic approval<br>4. 📅 **Event Records**: Complete event repository & filters<br>5. 🏛️ **Assigned Clubs**: Club rosters and faculty leads<br>6. ⚡ **Global Clash Detection**: Cross-department venue clash checker |
| **⚙️ Super Admin (CPM)** | `cpm.html` | • Manage Approving Authorities (Add, activate/deactivate, set passwords)<br>• Manage users, clubs, and platform settings<br>• Broadcast dynamic banners, maintenance mode & celebration themes |

---

## 🚀 Getting Started

### 1. Prerequisites
- Modern web browser (Chrome, Edge, Firefox, Safari)
- Node.js (v18 or higher recommended)

### 2. Local Setup
Clone the repository and run locally:
```bash
git clone https://github.com/dhanushkp/vvce-events-hub.git
cd vvce-events-hub
```

Run tests to verify the setup:
```bash
npm test
```

Validate and bundle the modular pages:
```bash
npm run build
```

Start a local HTTP server:
```bash
npx serve .
# or
python -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

---

## 🗄️ Database Migrations

Before deploying, ensure the Supabase migrations in `database/` have been executed:
1. Open your **Supabase Dashboard** → **SQL Editor**.
2. Run `database/migration_approving_authorities.sql`.
3. Run `database/add_team_columns.sql`.
See [`database/README.md`](database/README.md) for full instructions.

---

## 🛠️ How to Edit or Add Pages

Every page is cleanly isolated:
- To update a page's **HTML layout**, edit the template in [`pages/`](pages/) or the corresponding section in [`index.html`](index.html).
- To update a page's **logic or behavior**, edit its dedicated controller in [`js/pages/`](js/pages/).
- Run `npm run build` after making changes to automatically validate and synchronize all modules.
