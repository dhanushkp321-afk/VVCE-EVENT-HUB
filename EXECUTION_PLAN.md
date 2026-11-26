# VVCE Events Hub — Master Execution Plan

> **Source Inputs:** [WEBSITE_AUDIT_AND_NOTES.md](WEBSITE_AUDIT_AND_NOTES.md) (Section A Bugs + Section B Updates 1–5)  
> **Global Constraints:**
> - **Do NOT alter** existing UI themes, color palettes, typography, card styling, or unrelated pages.
> - **Pre-step for every Phase:** Inspect the live Supabase schema (`users`, `registered_students`, `events`, `approving_authorities`, `vvce_certs`, `cpm_config`, `cpm_audit_logs`), Supabase Auth settings, Storage buckets, and Vercel/Resend/Brevo configuration before making changes.
> - **Verification Gate:** Each sub-phase ends with targeted syntax (`node -c`), unit/integration (`npm test`), and functional browser checks before starting the next sub-phase.

---

## Phase 1: Fix Section A Bugs & Remove AICTE Points (Update 4)

**Goal:** Stabilize broken handlers, runtime crashes, routing errors, and field-mapping mismatches from Section A, clean up dead/orphaned code, and cleanly remove all AICTE/Activity Points UI and validation across Student, Club/Faculty, Authority, and CPM portals without leaving layout gaps.

### Sub-step 1.1 — Core Routing, Dead Code & Asset Cleanup
- **`js/core/router.js`:** Remove duplicate `'dean-portal'` route key (`L122-L123`) so `'dean-portal'` cleanly delegates to `renderAuthorityPortal()`, and remove dead `'principal-portal'` references (`L90, L124`).
- **`js/pages/authority-views.js`:**
  - Remove obsolete `DEAN_PASS` / `PRINCIPAL_PASS`, `handleDeanPortalNav()`, `verifyDeanPassword()`, `renderDeanPortal()`, `approveEvent()`, `deanApproveClub()`, `deanRejectClub()`, `lockDeanPortal()`, and `renderPrincipalAvailability()`.
  - Unify `renderApprovals()` reject action so it uses `authorityRejectEventPrompt()` (or removes conflicting legacy `isDeanUser()` checks) cleanly.
- **`js/pages/auth.js`:**
  - Replace undefined `switchAuthTab('signin')` (`L669`) with `switchMainTab('signin')`.
  - Remove dead OCR scanning code (`L65-L451`, `bypassPrincipalScan` `L907`) referencing removed `#student-scanner-ui`, `#admin-scanner-ui`, `#auth-scanner-ui`, `parseNameFromOCRText`, and `ocrTextCombined`.
  - Remove orphaned `#modal-otp` (`index.html:749-787`) or replace its broken `handleOtpInput`/`verifyRegistrationOtp` handlers cleanly when wiring Phase 2A/2B.
- **`index.html` & `style.css`:**
  - Remove unused `@emailjs/browser@4` (`index.html:13`) and unused OCR `#reader-hidden` if no longer needed (note: keep `html5-qrcode` only if planned for future check-in, or remove until needed).
  - Fix `.authority-lock .portal-lock-icon` and `.btn-sm` / `.btn-success` styles in `style.css` and `cpm.html` so buttons/modals render properly.
  - Fix `#a-authority` and `#a-faculty` dark translucent input contrast on the white Club Admin registration card (`index.html:259, 268`).
  - Fix Club Admin notice (`index.html:105, 252`) and Create Event button/toast copy (`create-event.js:204, 290`) from "Dean Student Welfare" to the selected Approving Authority.
  - Archive or sync/delete stale `js/auth.js`, `js/data.js`, `js/student.js`, `js/supabaseClient.js`, `eng.traineddata`, `assets/eng.traineddata`, `dist/`, and stale `pages/*.html` mismatches (confirm with user before deleting legacy directories).

### Sub-step 1.2 — Fix Broken Page Bugs & Sync Mappings
- **`js/core/database.js`:**
  - Fix `mapEventForSupabase()` (`L148-L187`) to send snake_case keys matching SQL (`authority_id`, `authority_name`, `approved_by_authority_id`, `approved_by_authority_name`, `approved_at`, `decision_history`) and include `waitlist`, `waitlist_enabled`, and `publish_at`.
  - Fix `mapEvent()` (`L299-L310`) to map `authority_id`, `authority_name`, `approved_by_authority_id`, `approved_by_authority_name`, `approved_at`, and `decision_history` back from Supabase so events stop leaking across all authorities.
  - Fix `handleVerifiedSession()` (`js/pages/auth.js:721-731`) to include `authority_id`, `authority_name`, `approval_history` when inserting verified Club Admins.
- **`js/pages/events.js`, `student-dashboard.js`, `registrations.js`, `profile.js`:**
  - Fix same-day event UTC date comparison (`new Date(e.date) >= new Date()` → compare `YYYY-MM-DD` strings against local today string) so today's events do not turn into "Past/Completed" after 05:30 AM IST.
  - Fix `joinWaitlist()` (`events.js:1101`) using `getSupabaseClient()` instead of `window.sb`.
  - Move `registerEv()` from `clubs.js` to `events.js` (or shared utility), escape apostrophes in `clubs.js:46-47` (`switchClubTab`), and filter `clubs.js:59` by `u.approved` so unapproved clubs do not appear publicly.
  - Fix `calendar.js` (`L67, L133`) to use `isBranchMatch()` instead of strict `.includes()` and make its 2-column grid responsive on mobile (`style.css`).
  - Guard `certificates.js:147` (`downloadCertPDF`) against blocked popups (`if (!win)` toast fallback), and fix `profile.js:166-167, 185` (`https://` double-prefixing) + authority email validation.
  - Fix `create-event.js`: validate `#ev-desc` and `#ev-rules` (marked `*`), restore `submitBtn`/`draftBtn` state in `finally`, save `maxTeams`, and notify only the assigned `authorityId`.
  - Fix `manage-events.js:44`: exclude `archived` events from `freshCount` comparison.
- **`cpm.html` & `js/pages/cpm-theme.js`:**
  - Add missing `#media-signin-bg-url` input in `cpm.html` Tab 4 (`L254-256`) or guard `loadConfig()`/`saveMediaConfig()` cleanly so Media Assets no longer throws `TypeError`.
  - Include `change_history`, `publish_at`, and `waitlist_enabled` in `executeSaveEvent()` `dbPayload` (`cpm.html:1256-1267`).
  - Fix `loadAnalytics()` (`cpm.html:1702`) to select `club` so Active Clubs counts accurately, and remove hardcoded `45%` fake DAU in favor of real metric or explicit label.
  - Fix `applyRolePermissions()` (`cpm.html:920-965`) so `nav-authorities` and `nav-audit` are properly hidden for unauthorized roles and `'Deactivate'` buttons are hidden for `analytics_viewer`.
  - Fix `cpm-theme.js:192` (`renderDashboard()` → `renderStudentDashboard()`).

### Sub-step 1.3 — Remove All AICTE Points Across All Portals (Update 4)
- **Case-insensitive audit & removal** of `aicte`, `aictePoints`, `aicte_points`, `activity points`, `pts`:
  1. **Student Portal:**
     - `student-dashboard.js`: Remove "AICTE Points" stat card (`L74`) and adjust `.stats-row` to a balanced 3-card grid; remove the entire "AICTE Activity Points" progress bar & Semester 1–8 grid card (`L84-L98`).
     - `events.js`: Remove `⭐ ${ev.points} pts` chip from `eventCard()` (`L87`) and `detailChip('⭐','AICTE Points',...)` from `openEventModal()` (`L1391`).
     - `registrations.js`: Remove `⭐ ${e.points||0} pts` line (`L192`).
     - `certificates.js`: Remove `totalPts` banner & `100-pt` AICTE progress bar (`L12, L22-L37`) while keeping Achievements / Participation summary cleanly aligned; remove `⭐ ${c.points} AICTE Points` (`L55`), `#cert-points` input/reading (`index.html:656-657`, `certificates.js:70, 75`), and `.pts-badge` from `downloadCertPDF()` (`L116, L139`).
     - `profile.js`: Remove `AICTE Points` stat from `.prof-stats` (`L41`, adjust to 3-column stat bar) and remove the "AICTE Points — Semester Breakdown" card (`L91-L97`).
  2. **Club Admin / Organizer Portal:**
     - `create-event.js`: Remove `#ev-gives-points` toggle switch, `#ev-points-wrap` input (`L116-L126`), listener (`L211-L213`), and omit required points validation (default payload `points: 0` or omit if nullable in DB so historical rows remain intact).
     - `participants.js`: Update banner/toasts (`L210, L267, L273`) to say *"auto-awards Participation Certificate"* and remove `points` / `pointsBySem` mutation logic from `applyAttendanceRewards()` (`L302-L328`).
  3. **Authority & CPM Portals:**
     - `authority-portal.js` (`L331`) & `authority-views.js` (`L124, L690`): Remove `⭐ Points` metadata chips cleanly.
     - `cpm.html` (`L688-689, L1042, L1111, L1135, L1200, L1265`): Remove Activity Points input/badge from Edit Modal and Event Cards.
  4. **Database / Schema:** Keep `points` and `points_by_sem` columns nullable/optional in SQL & `database.js` mappers so existing records in Supabase never break.

**Phase 1 Test Checklist:**
- `npm run test` + `node -c` on all JS files passes.
- Verify Sign In, Student Dashboard, Events, Clubs, Calendar, Registrations, Certificates, Profile, Create Event, Manage Events, Authority Portal, and CPM Media/Events tabs render with zero console errors and zero remaining references to "AICTE".

---

## Phase 2A: Two-Step Student Auth & Google Login Check (Update 1)

**Goal:** Enforce strict `@vvce.ac.in` two-step registration + Google Sign-In login flow without altering Auth UI styling.

1. **Inspect Live Supabase Auth & Schema:**
   - Verify Supabase Auth Google OAuth provider configuration, Authorized Redirect URLs, `users` / `registered_students` unique constraints on `email` and `usn`, and `GOOGLE_CLIENT_ID` configuration.
2. **Registration Page (First-Time Users):**
   - Confirm no "Continue with Google" button exists inside `#panel-register` (`index.html:118-389`).
   - Fix button text contrast on `#google-signin-btn` (`index.html:59-74`) on `#panel-signin` so it is clearly legible on the white `.auth-card` while preserving the overall theme.
   - Align password length validation messaging (`min 8 chars` vs `6` in `index.html:229` and `auth.js:789`), validate USN format, and ensure all student profile fields (`usn`, `name`, `branch`, `section`, `year`, `sem`, `admissionYear`, `dept`, `phone`, `interests`) persist cleanly to Supabase upon signup/verification.
   - Enforce `@vvce.ac.in` check both client-side and via database/SQL trigger or Edge/RLS check (`LOWER(email) LIKE '%@vvce.ac.in'`).
3. **Login Page (Returning Students — Google Sign-In):**
   - Remove the insecure `manualGoogleEmailEntry()` `prompt()` fallback (`auth.js:1350-1359`) that lets anyone impersonate any `@vvce.ac.in` account.
   - Configure real Google Identity Services / Supabase OAuth (`sb.auth.signInWithOAuth({ provider: 'google', options: { queryParams: { hd: 'vvce.ac.in' } } })` or GIS JWT with `GOOGLE_CLIENT_ID` configured).
   - Verify returned token/session email ends with `@vvce.ac.in` (reject and sign out if not).
4. **Pre-Registration Enforcement on Google Login:**
   - Look up the authenticated Google email directly in Supabase `users` / `registered_students` (do NOT auto-create student accounts in `googleLoginByEmail()` — remove `L1383-L1404` auto-creation!).
   - **If found:** Link/update `google_id` / `profile_photo` if needed and call `launchApp(user)`.
   - **If NOT found:** Immediately call `await sb.auth.signOut()`, clear any OAuth hash/session so no orphaned session remains, switch to `#panel-register` (`switchMainTab('register')` -> `selectRegRole('student')`), pre-fill `#s-email` (optional convenience) or leave editable, and show the exact error message:  
     *"Account not found. Please complete the registration form first using your @vvce.ac.in email."*

**Phase 2A Test Checklist:**
- Unregistered `@vvce.ac.in` Google login is blocked, signed out of Supabase Auth, redirected to Register tab with the exact prompt message, and zero rows are inserted into `users`.
- Registered `@vvce.ac.in` Google login signs directly into the user's dashboard.
- Non-`@vvce.ac.in` emails are rejected on both frontend and database levels.

---

## Phase 2B: Fix Forgot Password Flow (Update 2)

**Goal:** Replace the insecure client-side-displayed OTP reset modal with a secure, real email-based password reset flow while keeping Login page styling intact.

1. **Diagnose & Audit Current Failure Points:**
   - Why current flow fails/is unsafe: `sendResetVerificationCode()` prints the OTP directly in `#reset-code-banner` (`auth.js:1108`), `api/send-otp.js` fakes `200 OK` without `RESEND_API_KEY` / `BREVO_API_KEY`, regular users do not authenticate via Supabase Auth on login (only `users.pass`), and `executePasswordReset()` tries updating a non-existent `pass` column on `approving_authorities`.
2. **Choose & Implement Secure Reset Architecture (preserving Login UI):**
   - **Option 1 (Supabase Auth `resetPasswordForEmail` + `PASSWORD_RECOVERY` handler — Recommended) OR Option 2 (Server-side HMAC/DB-backed OTP via `/api/send-otp` + `/api/verify-reset-otp` with `SUPABASE_SERVICE_ROLE_KEY`):**
     - Ensure `handleForgotPassword()` validates non-empty `@vvce.ac.in` email and verifies the account exists in `users` or `approving_authorities` (returning clear error messages for non-`@vvce.ac.in` or unregistered emails).
     - Dispatch real reset email (via Supabase `resetPasswordForEmail` with `redirectTo: window.location.origin` OR configured Resend/Brevo endpoint with server-side secret verification — **never render the OTP code in the UI**).
     - Display confirmation message: *"Check your VVCE inbox for the reset link"* (or code notice).
     - Handle the return recovery route/event (`onAuthStateChange('PASSWORD_RECOVERY')` or `?mode=reset` URL parameter) to open `#modal-forgot-password` Step 2 ("Reset Password" view) with New Password & Confirm Password inputs, validate matching passwords & strength, update password securely (updating Supabase Auth + PBKDF2 hash in `approving_authorities` or `users`), handle expired/invalid token errors cleanly, clear URL hash, and redirect back to Sign In.
3. **Document Auth Redirect Whitelists:**
   - Provide exact Redirect URLs to whitelist in **Supabase Dashboard → Authentication → URL Configuration** (`http://localhost:*`, Vercel production domain `https://<your-domain>.vercel.app`, and `https://<your-domain>.vercel.app/*`).

**Phase 2B Test Checklist:**
- Unregistered email & non-`@vvce.ac.in` email show clear error messages and send no email.
- Registered student/club/authority email receives a real reset link/code and shows *"Check your VVCE inbox for the reset link"*.
- Clicking reset link opens the Reset Password view, saves new password, handles expired links cleanly, and allows immediate login with the new password.

---

## Phase 2C: Real-Time Venue & Schedule Clash Detection (Update 5)

**Goal:** Remove the standalone Clash Detection tab/button/modal from the Club Admin Portal and add automatic, debounced (300ms) overlapping time-slot conflict detection inside the Create/Edit Event form plus a final pre-insert DB guard.

1. **Remove Standalone Clash UI from Club Admin Portal:**
   - `js/core/router.js` (`L198`): Remove `navItem('authority-clash', '⚡', 'Clash Detect')` from the `admin` sidebar menu.
   - `js/pages/faculty-dashboard.js` (`L75`): Remove the `"Clash Detect"` Quick Action card from the Club Admin dashboard (adjust `.qa-grid` layout cleanly if 3 items remain or replace with `"All Events"`/`"Clubs"` so no empty grid slot remains).
   - Keep `authority-clash` only for Approving Authority if needed, or isolate unused helper code.
2. **Add Start & End Time Fields in Create/Edit Event (`js/pages/create-event.js`):**
   - Ensure the Create/Edit Event form captures `Event Date` (`#ev-date`), `Start Time` (`#ev-time`), `End Time` (`#ev-end-time`), and `Venue` (`#ev-venue`), validating `endTime > startTime` (with a sensible default duration if end time is initially empty).
   - Store `end_time` cleanly in `events` via `mapEventForSupabase()` and `mapEvent()`.
3. **Debounced (300ms) Real-Time Overlap Query:**
   - Attach `input`/`change` listeners on `#ev-date`, `#ev-venue`, `#ev-time`, `#ev-end-time`.
   - Debounce 300ms and query Supabase `events` (filtered by `date = selectedDate`, case-insensitive `venue`, `status IN ('approved', 'pending', 'scheduled', 'rescheduled')`, excluding `rejected`, `cancelled`, `archived`, and `id != editingEventId`).
   - Check time-slot overlap using `startA < endB && endA > startB` (converting `HH:MM` to minutes; if legacy records lack `end_time`, treat as a 2-hour block or full-slot fallback so legacy events still trigger warnings).
4. **Inline Conflict Banner & Submit Guard:**
   - Show a loading state while checking and disable Submit (`btn-create-submit`) during the check or whenever a conflict exists.
   - Render an inline conflict banner below the Venue/Date/Time section showing:
     - **Conflicting Event Name**
     - **Organizing Club Name**
     - **Booked Date, Venue, and Time Slot**
5. **Final Server/DB Concurrency Check Before Insert:**
   - Create a Postgres RPC (`create_event_with_clash_check` / `update_event_with_clash_check`) or atomic server-side check right before `INSERT`/`UPDATE` so two club admins submitting at the exact same millisecond cannot book overlapping time slots at the same venue.
   - Also update `authority-views.js` and `authority-portal.js` clash logic (and `approve_event_with_clash_check` SQL RPC) to check `startA < endB && endA > startB` instead of blocking non-overlapping times on the same day.

**Phase 2C Test Checklist:**
- Club Admin sidebar and dashboard no longer show standalone "Clash Detect" navigation.
- Selecting the same venue + date with overlapping times displays the inline conflict banner (Event Name, Club Name, Date, Venue, Time Slot) and disables Submit.
- Selecting non-overlapping times (e.g., 09:00–11:00 vs 14:00–16:00) on the same venue/date succeeds cleanly.
- Editing an event does not conflict with itself; rejected/cancelled events do not block slots.

---

## Phase 2D: Dynamic Solo/Group Registration, Team Confirmation & Payment Approval (Update 3)

**Goal:** Rebuild event registration into a strict state-machine workflow supporting Solo (`max_team_size === 1`) and Group (`max_team_size > 1`) events, working team invitations, payment proof submission, and organizer verification before granting final `registered` status.

1. **Schema & Data Model Alignment (`database/` migration + `js/core/database.js`):**
   - Standardize registration states in `events` / dedicated `event_registrations` table:
     `pending_team` → `pending_payment` → `pending_approval` → `registered` | `rejected`.
   - Store payment metadata per registration/team: `utr_number` / `transaction_id`, `screenshot_url` (uploaded to a dedicated Supabase Storage bucket, e.g., `payment-proofs`, instead of base64 in JSON), `rejection_reason`, `submitted_at`, `reviewed_by`, `reviewed_at`.
   - Unify `is_team_event`, `min_team_size`, `max_team_size`, `max_teams`, `needs_payment` columns cleanly in SQL and JS mappers.
   - Wire `#ev-needs-payment` in `create-event.js` so organizers can explicitly mark paid/proof-required events (`fee > 0` or proof required).
2. **Dynamic Solo vs. Group Registration Modal & Progress Stepper (`js/pages/events.js` + `index.html`):**
   - Branch immediately inside `registerEv(id)` based on `maxTeamSize === 1` vs `maxTeamSize > 1`:
     - **Solo (`maxTeamSize === 1`):** Skip "Add Team Members" and "Team Confirmation". Move straight to Step: Payment Proof (if paid) or directly submit as `pending_approval` (or `registered` if free & auto-approved per organizer setting—strictly matching Update 3: *"move straight to payment proof (if paid) or organizer approval"*).
     - **Group (`maxTeamSize > 1`):** Enforce `minTeamSize` and `maxTeamSize`. Do **not** register the leader in `ev.registrations` until the team submits and passes required stages! Keep team in `pending_team` until all invited members accept/confirm.
   - Render a clear horizontal **Progress Stepper** below the registration card/modal showing current step (`1. Team Setup` → `2. Team Confirmation` → `3. Payment Proof` → `4. Organizer Approval` → `5. Registered`).
3. **Fix Team Confirmation, Invites & Management Buttons (`js/pages/events.js`, `registrations.js`):**
   - Fix `?teamInvite=<teamId>&event=<eventId>&token=<inviteToken>` deep-link handling across login/reload (`checkTeamInviteUrl()` + `acceptTeamInvite()`): clicking "Confirm Attendance / Accept Invite" validates the logged-in user's email, updates member status to `confirmed`, immediately refreshes the leader's roster tracker, and transitions team status from `pending_team` → `pending_payment` (if paid) or `pending_approval` (if free) once all required members confirm.
   - Wire **"Resend Invite"** (both real email dispatch via Supabase/API and copyable invite link fallback), **"Edit / Replace Member"**, and **"Remove Member"** with button loading spinners and toast notifications.
   - Clean up abandoned draft teams so clicking Cancel in the modal does not leave partial registrations behind.
4. **Payment Proof Upload & Organizer Verification Panel (`events.js`, `participants.js`, `index.html`):**
   - In the Payment Proof step, require **Transaction ID / UTR** + **Payment Screenshot image** (compressed & uploaded to Supabase Storage), transitioning status to `pending_approval`.
   - If status is `rejected`, show the rejection reason on My Registrations / Event Card and provide a **"Re-upload Payment Proof"** action.
   - Enhance the Club/Event Creator dashboard (`js/pages/participants.js`) with a dedicated **"Pending Registrations / Verify Payments"** queue displaying:
     - Solo student details OR full Group Team name + confirmed roster.
     - Transaction ID/UTR + expandable Payment Proof screenshot.
     - **"Approve & Confirm Registration"** (atomically checks remaining seat capacity, sets status to `registered`, sends confirmation notification/email, updates attendee count) and **"Reject"** (prompts for reason, sets status to `rejected` so student can re-upload).

**Phase 2D Test Checklist:**
- Solo free event skips team UI and moves cleanly through approval → `registered`.
- Solo paid event collects UTR + screenshot → `pending_approval` → organizer approves → `registered` (and test `rejected` → student re-upload).
- Group event blocks proceeding past `pending_team` until teammates confirm via invite link; leader's Resend/Replace/Remove controls show loading states and update counts accurately; organizer sees full team roster + payment proof before confirming.

---

## Phase 3: Database Speed & Role Security Hardening (5,000–6,000 Students)

**Goal:** Eliminate the 1,000-row truncation cliff, full-table write amplification, base64 bloat, and client-side security holes identified in Section A Sections 7–8.

1. **Normalized Database Schema, Indexes & Storage Migration (`database/` SQL):**
   - Add explicit PostgreSQL migrations & indexes on `users(email)`, `users(usn)`, `users(type)`, `events(status)`, `events(date, venue)`, `events(authority_id)`, `events(admin_id)`, `event_registrations(event_id, user_id)`, and `certificates(user_id)`.
   - Migrate file storage (event posters, club logos, profile photos, resumes, payment screenshots) from inline base64 strings to **Supabase Storage buckets** (`posters`, `avatars`, `resumes`, `payment-proofs`).
2. **Eliminate Full-Table Fetches & `O(N)` `setDB` Writes (`js/core/database.js`, `js/main.js`):**
   - Replace `bootApp()`'s 8 unpaginated `select('*')` calls with **role-scoped, paginated, column-selected queries** (never fetch `pass`, `notifs`, or other students' private phone/resume rows to student clients).
   - Remove blind full-boot on every `visibilitychange` / `pageshow` (`js/main.js:25-33`); instead use lightweight targeted refreshes with a cooldown/timestamp check.
   - Replace `setDB('vvce_users', allUsers)` and `setDB('vvce_events', allEvents)` with **single-row targeted mutations / Postgres RPCs** (`mark_notif_read`, `push_user_notif`, `update_profile`, `register_event_atomic`, `toggle_attendance_atomic`) — eliminating lost-update race conditions and `414 URI Too Long` `DELETE NOT IN` errors on `vvce_certs`.
   - Scope Supabase Realtime subscriptions (`setupRealtimeSync`) to relevant channels/filters (e.g., `events` updates and current user's own notifications) instead of subscribing 5,000+ browsers to all `users` table changes.
3. **Role Security, Authentication & XSS Hardening:**
   - Remove hardcoded plaintext passwords (`DEFAULT_USERS` demo passwords in production, `DEAN_PASS`, `PRINCIPAL_PASS`, `Vvce@Admin#CPM2025`) and stop storing/sending plaintext `pass` in `users`.
   - Move CPM authentication, Authority creation/password management, and OTP/email dispatch behind **Supabase Auth + tight RLS policies** (no `USING (true) WITH CHECK (true)` for `anon` writes on `approving_authorities`, `users`, `events`, or `cpm_config`).
   - Add a shared `escapeHTML()` utility in `js/core/utils.js` and sanitize all user-supplied strings (`name`, `clubName`, `desc`, `rules`, `team.name`, `rejReason`, `banner.text`) before interpolating into `innerHTML`.
   - Replace `cpm.html` client-only `sessionStorage` role checks with server/RLS-enforced role verification and batch notification updates (`notifyRegisteredUsers`) via a single RPC instead of an `N+1` loop.

**Phase 3 Test Checklist:**
- Simulate >1,500 user rows / >200 event rows: pagination & targeted queries load cleanly without hitting Supabase's 1,000-row cutoff or `localStorage` 5 MB quota.
- Simultaneous registrations at last available seat allow exactly 1 winner and reject/waitlist the rest atomically.
- RLS verification: an `anon` or student JWT cannot modify `approving_authorities`, `cpm_config`, other users' profiles, or approve events.

---

## Phase 4: Final End-to-End Testing & Server Prep

**Goal:** Validate the complete system across all 4 roles, rebuild synchronized distribution artifacts, and prepare environment/deployment checklists for Vercel & Supabase.

1. **Automated Test Suite Expansion (`scripts/test_suite.js` & `scripts/build.js`):**
   - Update `scripts/test_suite.js` to test: `@vvce.ac.in` validation, Google pre-registration gate, time-slot overlap clash logic (`startA < endB && endA > startB`), solo vs. group state progression, and PBKDF2 / Auth helpers.
   - Run `npm run build` (`scripts/build.js`) to verify syntax across every module in `js/core/*` and `js/pages/*` and synchronize `app.js` if retained.
2. **Full Role-by-Role End-to-End Walkthrough:**
   - **Student Flow:** Register (`@vvce.ac.in`) → Verify email → Login with Google (verified registered vs unregistered block) → Forgot Password reset → Solo Free & Paid Registration → Group Team Invite, Member Confirm, Resend/Remove, Payment Proof, Rejection Re-upload, Final Approval → Calendar & Certificates PDF.
   - **Club Admin Flow:** Login → Create Event (verify AICTE removed, real-time 300ms clash banner & submit block, `#ev-needs-payment` toggle) → Edit/Manage Events → Verify Payments (`Approve & Confirm` / `Reject`) → Mark Attendance & Auto-Certificate.
   - **Approving Authority Flow:** Login → Review Club Registrations → Approve/Reject Events (with time-overlap clash guard) → Tab 6 Global Clash Date Filter.
   - **CPM Portal Flow:** Login → Edit Event (verify `change_history`, `publish_at`, `waitlist_enabled` persist) → Media Assets (verify no crash) → Themes & Banners → Authorities Management.
3. **Production Server & Deployment Checklist (Vercel + Supabase):**
   - Set environment variables in Vercel (`RESEND_API_KEY` or `BREVO_API_KEY`, Supabase keys, `GOOGLE_CLIENT_ID`).
   - Run all pending SQL migrations in Supabase SQL Editor and create required Storage buckets + policies.
   - Configure Supabase Auth URL Configuration (Site URL + Redirect URLs) and Google OAuth credentials (`hd: 'vvce.ac.in'`).
   - Run Lighthouse / mobile responsive viewport checks (`375px` mobile + `1280px` desktop) and final `git status` / clean deploy verification.

---

> **Next Step:** Review this plan and reply with your approval (or any adjustments) to begin **Phase 1**.
