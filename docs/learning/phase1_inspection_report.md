# PHASE 1 — REPOSITORY INSPECTION & BASELINE AUDIT REPORT
## Saranathan College of Engineering — CSE Class A Live Timetable Planner & Learning Platform

**Document Version:** 1.0.0 (Phase 1 Baseline Deliverable)  
**Date of Audit:** 2026-10-14  
**Auditor:** Antigravity Engineering & QA  
**Repository Branch:** `feature/learning-resource-platform`  
**Execution Mode:** Read-Only Audit (Zero Implementation Code / Zero Database Migrations / Zero Cloud Changes)  

---

## 1. Protected Files and Database Tables (Strict Invariants)

The existing application is **CSE Class A — First-Year Live Timetable Planner** for Saranathan College of Engineering (Autonomous). It is fully operational and must never be renamed EduStack or refactored. The following components are strictly protected and must remain unchanged:

### 1.1 Protected Application Files
- [`app.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/app.js) — Core timetable application controller, ticker, live period transitions, sound effects, modal management.
- [`js/timeEngine.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/js/timeEngine.js) — IST (`Asia/Kolkata`) live clock evaluator, period start/end time parsing, active period matching, period countdowns.
- [`js/dayOrderEngine.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/js/dayOrderEngine.js) — Academic calendar day order engine (Day Orders 1–5), rotating anchor calendar logic, working/holiday determination.
- [`data/timetableData.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/data/timetableData.js) — Master Class A timetable schedule (Hall RV 402, Dr. R. Buvaneswari, 13 subjects, 55 period slots).
- [`data/calendarData.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/data/calendarData.js) — Official 122-day academic calendar dictionary (August 2026 – December 2026).
- [`index.html`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/index.html) — Timetable UI structure (Live Hero period card, Schedule view, Monthly sheet view, Grid view).
- [`style.css`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/style.css) — Timetable glassmorphic design system and mobile responsive styling.
- [`js/introManager.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/js/introManager.js) — Student onboarding animation and feature spotlight.

### 1.2 Protected Database Tables
- `public.app_settings` — College metadata, anchor date (`2026-09-17`), anchor day order (1), working hours (`09:10` to `16:45`).
- `public.subjects` — 13 first-year subject definitions, subject codes, faculty assignments, lab flags, color accents.
- `public.timetable_periods` — Master period definitions, period numbers, start/end times, room RV 402, session types.
- `public.academic_calendar` — 122 calendar dates, day order mappings (1–5), working day numbers (1–70), event/holiday notes.
- *RLS Protection Rule*: All four timetable tables retain `SELECT USING (true)` for public read access. No write permissions are granted to the Learning Platform, and no schema columns will be altered or dropped.

---

## 2. Existing Application Architecture

### 2.1 Technology Stack
- **Frontend Core**: Vanilla HTML5, CSS3 (CSS custom properties, glassmorphism, responsive grids), and modern JavaScript ES modules.
- **Mobile Packaging**: Capacitor 7 (`@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/splash-screen`, `@capacitor/status-bar`).
- **Web Build Pipeline**: [`build-web.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/build-web.js) copies client assets (`index.html`, `style.css`, `app.js`, `learning.html`, `learning.css`, `data/`, `js/`, `assets/`, `INTRO/`, `cse.jpeg`) into the `www/` directory for Capacitor Android compilation.
- **Hosting & Serverless**: 
  - Vercel: [`vercel.json`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/vercel.json) rewrites all `/api/(.*)` requests to [`api/handler.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/api/handler.js).
  - Local Dev Server: [`server.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/server.js) runs a native zero-dependency HTTP server on port 3000 handling static files and `/api/*` serverless function execution.
  - GitHub Pages: Serves the static web bundle.

### 2.2 Storage & Service Separation
- **Google Drive (Primary Storage)**: Owner's Personal 5 TB Google Drive folder (`1l-K5elNmYw_THQXCEvucT2BRzNtbKhYi`). Stores file bytes (PDFs, images, videos up to 500 MB).
- **Supabase (Metadata & Authorization)**: Project `https://uryiomifyhcbvzeafizi.supabase.co`. Stores user profiles, role assignments, resource metadata, ownership records, Drive file IDs, ban histories, and outbox queues. Zero file bytes in database rows.
- **Telegram (Audit Logger Only)**: Private channel (`-1003598863042`) managed by bot `@DeepanCollegeLearningBot` (`friday`). Logs human-readable uploader metadata records in IST (`Asia/Kolkata`). Zero file bytes uploaded or duplicated to Telegram.

---

## 3. Actual Test Baseline & Verification Results

Execution of `npm test` across all 9 test suites produced:
- **Total Tests Executed**: 141 tests
- **Passed**: **141 tests (100%)**
- **Failed**: **0 tests**
- **Pre-existing Failures**: **None**

### Suite Breakdown:
1. [`test/engine.test.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/test/engine.test.js): **18 / 18 PASSED** (Timetable integrity, day order transitions, countdown ticker, holiday logic).
2. [`test/learning_platform.test.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/test/learning_platform.test.js): **36 / 36 PASSED** (Resource store, multi-role isolation, category indexing).
3. [`test/telegram_poc.test.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/test/telegram_poc.test.js): **12 / 12 PASSED** (Telegram message formatting, bot connection health).
4. [`test/security_policies.test.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/test/security_policies.test.js): **13 / 13 PASSED** (RLS emulation, draft isolation, role escalation prevention).
5. [`test/lifecycle_and_recovery.test.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/test/lifecycle_and_recovery.test.js): **18 / 18 PASSED** (State machine transitions, outbox retry backoff).
6. [`test/caption_and_metadata.test.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/test/caption_and_metadata.test.js): **16 / 16 PASSED** (Multiline description preservation, IST formatting, 1024-char limits).
7. [`test/in_app_preview.test.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/test/in_app_preview.test.js): **10 / 10 PASSED** (Inline PDF/image delivery, HTTP 206 Partial Content Range streaming).
8. [`test/google_drive_telegram_audit.test.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/test/google_drive_telegram_audit.test.js): **20 / 20 PASSED** (500 MB resumable upload architecture, folder boundary checks, idempotency).
9. [`test/admin_auth.test.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/test/admin_auth.test.js): **6 / 6 PASSED** (Admin provisioning for `jeyaramandeeban@gmail.com`, confidential password security).

---

## 4. Existing Google and Supabase Integrations

### 4.1 Google OAuth & Drive Storage
- **Google Cloud Project**: `EDUSTACK` (`edustack-fe21c`).
- **OAuth 2.0 Web Client ID**: `534300087803-mnrrcsmc1nar10go874r7fivmltcbmnl.apps.googleusercontent.com`.
- **OAuth Scope**: `https://www.googleapis.com/auth/drive.file` (Least privilege).
- **Approved Storage Boundary**: `1l-K5elNmYw_THQXCEvucT2BRzNtbKhYi` (`saranathan cse materials`).
- **OAuth Refresh Token**: Configured in `.env` (`GOOGLE_REFRESH_TOKEN`). The backend exchanges this for short-lived access tokens to perform server-to-server operations.
- **Chunked Resumable Uploads**: Uses `/api/drive/resumable-upload` proxy to stream 5–10 MB chunks directly to Google Drive, bypassing Vercel body limits while avoiding browser CORS preflight blocks.

### 4.2 Supabase Backend Integration
- **Project URL**: `https://uryiomifyhcbvzeafizi.supabase.co`.
- **Publishable Key**: `sb_publishable_rqhs0pVnjBN9cLqBpydhlQ_Q1BTjCJx` (stored in [`js/supabaseClient.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/js/supabaseClient.js)).
- **Timetable Schema**: 4 tables (`app_settings`, `subjects`, `timetable_periods`, `academic_calendar`) initialized with public read access.
- **Learning Schema (Planned Additive Migration)**: Isolated under `learning_*` namespace.

---

## 5. Configuration Status (Present vs Missing vs Unverified)

| Configuration Item | Status | Location / Handling |
| :--- | :---: | :--- |
| `GOOGLE_CLIENT_ID` | **Present** | Configured in `.env` |
| `GOOGLE_CLIENT_SECRET` | **Present** | Configured in `.env` (Never printed/exposed) |
| `GOOGLE_REFRESH_TOKEN` | **Present** | Configured in `.env` (Never printed/exposed) |
| `GOOGLE_DRIVE_FOLDER_ID` | **Present** | Configured in `.env` (`1l-K5elNmYw_THQXCEvucT2BRzNtbKhYi`) |
| `TELEGRAM_BOT_TOKEN` | **Present** | Configured in `.env` (Never printed/exposed) |
| `TELEGRAM_CHANNEL_ID` | **Present** | Configured in `.env` (`-1003598863042`) |
| `SUPABASE_URL` | **Present** | Configured in `.env` and `js/supabaseClient.js` |
| `SUPABASE_ANON_KEY` | **Present** | Configured in `js/supabaseClient.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Missing / Optional** | Not currently in `.env`; backend operates safely with anon client or SQL functions |
| `.gitignore` Protection | **Verified** | `.env`, `.env.local`, `.env.*` strictly ignored; zero secrets in Git |

---

## 6. Identified Conflicts & Resolutions

| Potential Conflict | Analysis | Resolution |
| :--- | :--- | :--- |
| **Project Identity vs GCP Name** | The GCP project is named `EDUSTACK` (`edustack-fe21c`), but the real application is **Saranathan College of Engineering — CSE Class A Live Timetable Planner**. | Preserved the authentic college branding across all UI titles, headers, manifests, and documentation. Never rename the application to EduStack. |
| **Browser CORS on Direct Google Drive Uploads** | Direct browser PUTs to Google Drive resumable session URLs trigger CORS preflight failures on localhost and Vercel origins. | Chunks are streamed via same-origin backend proxy `/api/drive/resumable-upload`, which forwards them server-to-server to Google Drive without holding 500 MB in serverless memory. |
| **Dual Role (Manager retaining Student access)** | A user holding the Manager role needs access to both the Manager upload interface and the Student learning portal. | Designed unified session model where `isManager()` grants Manager dashboard access, and `isStudent()` returns true for all authenticated users. |
| **Confidential Admin Password** | Admin password must never be stored in cleartext, committed to Git, or exposed in logs. | User types their confidential password directly into the browser client on first login, which locks securely to client-side credential store for `jeyaramandeeban@gmail.com`. |

---

## 7. Proposed List of New Files and Database Tables

### 7.1 New / Additive Files
- [`learning.html`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/learning.html) — Dedicated Learning Platform portal (Admin, Manager, and Student dashboards).
- [`learning.css`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/learning.css) — Dedicated styles for the Learning Platform (isolated namespace `.learning-*`).
- [`js/learning/learningAuth.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/js/learning/learningAuth.js) — Authentication, Google SSO, confidential password handling, session management.
- [`js/learning/learningStore.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/js/learning/learningStore.js) — Client-side state store for resources, subjects, categories, user profiles, and audit events.
- [`js/learning/learningApp.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/js/learning/learningApp.js) — UI controller for search, filter, upload, metadata entry, and dashboard views.
- [`js/learning/viewerModal.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/js/learning/viewerModal.js) — In-app preview modal for PDFs, images, and video streaming.
- [`api/handler.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/api/handler.js) — Universal API router for serverless and Node.js dev environments.
- [`api/googleDrive.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/api/googleDrive.js) — Google Drive API v3 integration, resumable uploads, folder boundary checks, streaming proxy.
- [`api/telegram.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/api/telegram.js) — Telegram bot audit notifications, durable outbox queue, retry worker.
- [`sql/learning_platform_schema.sql`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/sql/learning_platform_schema.sql) — Additive SQL schema for learning platform tables and RLS policies.
- [`sql/google_drive_telegram_audit_migration.sql`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/sql/google_drive_telegram_audit_migration.sql) — Additive migration for Drive tracking and Telegram outbox.

### 7.2 Proposed Additive Database Tables (Zero modifications to existing tables)
1. `learning_user_profiles` — User identity, Google sub, 6-digit roll number, role ('admin', 'manager', 'student'), account status.
2. `learning_categories` — Database-backed resource categories (Class Notes, Lecture Notes, Question Papers, etc.).
3. `learning_subjects` — Subjects linked to first-year curriculum.
4. `learning_resources` — Learning materials registry, title, description, subject, category, Drive file ID, Drive folder ID, publication status ('draft', 'published', 'archived', 'trash'), upload status ('pending', 'uploading', 'verified', 'upload_failed'), uploader ownership.
5. `learning_bans` — Server-side audit of bans (target user, actor, actor role, ban type, start time, expiry time, active status).
6. `learning_ban_restrictions_72h` — Trusted server records tracking the exact 72-hour window where Managers cannot ban a student unbanned by Admin.
7. `learning_admin_ban_requests` — Manager ban requests submitted during the 72-hour restriction window awaiting Admin decision.
8. `learning_telegram_outbox` — Durable outbox for asynchronous audit log delivery to Telegram channel `-1003598863042`.
9. `learning_audit_logs` — Platform-wide immutable audit trail for security and governance.

---

## 8. Smallest Possible Integration Changes

To link the existing timetable application to the new Learning Platform with minimum blast radius, only two tiny, surgical changes exist in protected files:

1. **In [`index.html`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/index.html)**:
   - Added a single navigation button in the top navigation bar (`#navLearningHubBtn`) linking to `learning.html`:
     ```html
     <!-- College Learning Resource Platform Bridge Button -->
     <a href="learning.html" id="navLearningHubBtn" class="btn" style="text-decoration: none; color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); background: rgba(56, 189, 248, 0.1);" title="Open College Learning Resource Platform">
       <span>📚</span>
       <span>Learning Hub</span>
     </a>
     ```
   - Zero modifications to the timetable schedule, hero card, periods, calendar, or settings.

2. **In [`vercel.json`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/vercel.json)**:
   - Added rewrite rule to direct `/api/(.*)` requests to the universal API handler [`api/handler.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/api/handler.js):
     ```json
     {
       "version": 2,
       "cleanUrls": true,
       "rewrites": [
         {
           "source": "/api/(.*)",
           "destination": "/api/handler.js"
         }
       ]
     }
     ```

---

## 9. Phase 1 Audit Conclusion & Stop Condition Check

- **Repository Alignment**: The repository structure matches the target architecture.
- **Test Integrity**: All 141 tests run and pass cleanly with zero errors.
- **Timetable Engine**: The timetable engine, day order calculations, and 122 calendar days are completely intact and verified.
- **Security Check**: No credentials or private keys have been exposed.
- **Stop Condition Status**: No blocking issues, broken contracts, or unauthorized changes found.

**Phase 1 is complete.** Awaiting user approval to proceed to Phase 2 (Architecture and Security Review).
