# VVCE Events Hub — Separated Pages & Dashboards Directory

This directory contains individual HTML templates and architectural component layouts for every page, dashboard, and portal in **VVCE Events Hub**.

Each page is designed to be cleanly decoupled and maps directly to its dedicated JavaScript controller in `js/pages/`.

---

## 🗺️ Page-to-Controller Architecture Map

| Page / Dashboard | HTML Template | JavaScript Controller | Description & Capabilities |
|---|---|---|---|
| **1. Authentication & Registration** | [`auth-login-registration.html`](auth-login-registration.html) | [`js/pages/auth.js`](../js/pages/auth.js) | • Institutional Email Sign-In<br>• Google OAuth 2.0 (`@vvce.ac.in`)<br>• Student / Club Admin / Authority Registration<br>• Instant Password Reset (Method B OTP Modal) |
| **2. Student Dashboard** | [`student-dashboard.html`](student-dashboard.html) | [`js/pages/student-dashboard.js`](../js/pages/student-dashboard.js) | • Student welcome hero & USN badge<br>• Activity Points meter (VTU 100 points)<br>• Semester 1–8 breakdown meters<br>• Upcoming registered events feed & notices |
| **3. Events Feed & Search** | [`events-feed.html`](events-feed.html) | [`js/pages/events.js`](../js/pages/events.js) | • Live title/venue/club search<br>• Category chips (Technical, Cultural, Sports, etc.)<br>• Event detail popup modal<br>• Multi-member team registrations & invite links |
| **4. Clubs Directory** | [`clubs-directory.html`](clubs-directory.html) | [`js/pages/clubs.js`](../js/pages/clubs.js) | • Campus clubs & student chapters directory<br>• Domain filtering<br>• Club profile view with upcoming events & executive roster |
| **5. Calendar & Schedule** | [`calendar-schedule.html`](calendar-schedule.html) | [`js/pages/calendar.js`](../js/pages/calendar.js) | • Interactive monthly event calendar<br>• Date selection with event cards<br>• Semester academic timetable schedule |
| **6. My Registrations & Passes** | [`my-registrations.html`](my-registrations.html) | [`js/pages/registrations.js`](../js/pages/registrations.js) | • Upcoming & attended event passes<br>• Dynamic QR entry ticket modal<br>• Attendance & payment verification status<br>• Registration cancellation |
| **7. Certificates** | [`certificates.html`](certificates.html) | [`js/pages/certificates.js`](../js/pages/certificates.js) | • Verified event participation certificates<br>• Live certificate preview modal<br>• PDF generation & instant download<br>• External certificate uploads |
| **8. User Profile** | [`user-profile.html`](user-profile.html) | [`js/pages/profile.js`](../js/pages/profile.js) | • Student & Faculty profile details<br>• Academic year, semester, branch, USN<br>• Skills, interests, and activity points tally |
| **9. Faculty / Admin Dashboard** | [`faculty-dashboard.html`](faculty-dashboard.html) | [`js/pages/faculty-dashboard.js`](../js/pages/faculty-dashboard.js) | • Club metrics (Events hosted, registrations, revenue)<br>• Quick action cards (Create Event, Manage Events, Scanner) |
| **10. Create Event Form** | [`create-event.html`](create-event.html) | [`js/pages/create-event.js`](../js/pages/create-event.js) | • Event proposal form<br>• Automated venue clash validation<br>• Approving authority assignment<br>• Poster upload & UPI payment QR configuration |
| **11. Manage Events** | [`manage-events.html`](manage-events.html) | [`js/pages/manage-events.js`](../js/pages/manage-events.js) | • Club event management table<br>• Filter by status: Approved / Pending / Rejected<br>• Edit, delete, and view participants shortcuts |
| **12. Participants & Attendance** | [`participants-attendance.html`](participants-attendance.html) | [`js/pages/participants.js`](../js/pages/participants.js) | • Event attendee table with live search<br>• HTML5 camera QR barcode scanner<br>• Manual USN check-in<br>• Payment screenshot approval & CSV export |
| **13. Approving Authority Portal** | [`authority-portal.html`](authority-portal.html) | [`js/pages/authority-portal.js`](../js/pages/authority-portal.js) | **6-Tab Executive Portal**:<br>1. 📊 Overview & metrics<br>2. 👥 Club Registrations / Approvals<br>3. 📋 Event Approvals (with clash check)<br>4. 📅 Event Records repository<br>5. 🏛️ Assigned Clubs roster<br>6. ⚡ Global Clash Detection |

---

## 🛠️ How to Make Changes to a Page

1. **To modify HTML layout or structure**:
   - Open the corresponding template in `pages/` (or `index.html`).
2. **To modify logic, data handling, or actions**:
   - Open the corresponding JavaScript controller in `js/pages/`.
3. **To re-verify or bundle**:
   - Run `npm run build` or `npm test`. All modules will be validated and bundled automatically.
