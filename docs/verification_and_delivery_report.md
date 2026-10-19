# PRODUCTION COLLEGE LEARNING, STUDY MATERIAL & COURSEWORK PLATFORM
## Final Engineering Verification & Architecture Delivery Report
**Institution:** Saranathan College of Engineering (Autonomous), Tiruchirappalli  
**Program:** First-Year B.E. Computer Science and Engineering — Class A (Room RV 402)  
**Security Standard:** WCAG 2.2 AA • Google-Only Auth • Role-Hierarchy Enforcement • IDOR Protection

---

## 1. Executive Implementation Summary

The production-grade College Learning, Study Material, and Assignment Platform has been successfully architected, developed, and integrated alongside the existing live Timetable Planner without disrupting any existing features.

### Key Milestones Completed:
1. **Google-Only Authentication & Profile Completion:**
   - Supabase Auth + Google OAuth provider integration.
   - All accounts initialize with the `STUDENT` role.
   - Mandatory 6-digit roll number validation (`/^[0-9]{6}$/`) with atomic uniqueness constraints.
2. **Strict 4-Tier Role Hierarchy & Authorization Engine:**
   - Hierarchy: `ADMIN` → `REPRESENTATIVE` → `MANAGER` → `STUDENT`.
   - Central server-side policy enforcement (`api/authorization.js`) covering all 22 required authorization invariants from Section 37.
3. **Official Subject Repository (7 Subjects):**
   - Engineering Graphics (`24ES102A`), Engineering Physics (`24PH101A`), Engineering Chemistry (`24CH101A`), Engineering Mathematics I (`24MA101A`), Heritage of Tamils (`24TA101A`), Professional English (`24EN101A`), Problem Solving and Python Programming (`24ES101A`).
   - Idempotently seeded in database and local storage backup.
4. **Google Drive V3 Storage & Streaming Proxy:**
   - Dedicated folder boundary: `saranathan cse materials` (`GOOGLE_DRIVE_APPROVED_FOLDER_ID`).
   - Direct chunked (<5MB) and resumable session transfers.
   - Authenticated streaming proxy (`GET /api/drive/stream/:id`) prevents exposing raw Drive URLs.
5. **Telegram Bot Audit & Bug Report Integration:**
   - Bot `@DeepanCollegeLearningBot` (`8968622105`) connected.
   - Private Audit Channel: `-1003598863042`.
   - Bug Report Channel: `-1004484073817`.
   - Real-time event notifications for uploads, role transitions, bans, unbans, and notices.
6. **Moderation & 7-Day Manager Re-Ban Restriction:**
   - Admin-only unbans: ONLY the Administrator can unban an account.
   - Automatic 7-day restriction prevents a Manager from immediately re-banning a Student unbanned by an Admin.
   - Formal Ban Request submission and decision workflow.
7. **Coursework Assignment Lifecycle & Receipts:**
   - Server-side UTC deadline enforcement and IST display.
   - Cryptographic immutable submission receipts (`RCPT-XXXX-XXXX`).
   - Strict IDOR isolation: Students can only view their own work.
8. **Official Notices with Letterhead:**
   - Server-verified IST date generation.
   - Strict college letterhead format matching Section 16.
9. **Unified Node.js Production Server:**
   - `server.js` serves both the Timetable Planner (`/index.html`) and the Learning Platform (`/learning.html`), plus all `/api/*` endpoints.
10. **Preservation & 100% Coexistence:**
    - Original timetable files (`index.html`, `app.js`, `style.css`, `js/timeEngine.js`, `js/dayOrderEngine.js`, `data/*.js`) remain completely untouched and pass all 49 tests.

---

## 2. File Manifest

| File Path | Description |
|---|---|
| [`api/authorization.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/api/authorization.js) | Central server-side Authorization Engine & Section 37 Permission Rules |
| [`api/moderation.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/api/moderation.js) | Moderation Service, Admin-only Unbans, 7-Day Restriction, Ban Requests |
| [`api/store.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/api/store.js) | Resilient memory-cache + atomic disk backup (`data/platform_store.json`) |
| [`api/drive.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/api/drive.js) | Google Drive API v3 OAuth token refresh, chunked uploads, streaming proxy |
| [`api/telegram.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/api/telegram.js) | Telegram Bot `@DeepanCollegeLearningBot` audit & bug report dispatcher |
| [`api/handler.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/api/handler.js) | Universal HTTP API router for all endpoints |
| [`server.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/server.js) | Node.js production server hosting Timetable & Learning Platform |
| [`learning.html`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/learning.html) | Modern SPA markup with 4 role dashboards, modals, & toast container |
| [`css/platform.css`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/css/platform.css) | WCAG 2.2 AA compliant design system, responsive styles, deep navy theme |
| [`js/platform.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/js/platform.js) | Frontend interactive client engine for Admin, Rep, Manager, Student |
| [`index.html`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/index.html) | Preserved Timetable Planner with top navigation link to Learning Platform |
| [`sql/production_learning_platform.sql`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/sql/production_learning_platform.sql) | Complete PostgreSQL/Supabase DDL with 14 tables and RLS security policies |
| [`docs/architecture_and_security.md`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/docs/architecture_and_security.md) | Technical architecture, permission matrix, and trust boundary documentation |

---

## 3. Test Suites

| Suite Name | Target Module | Scope |
|---|---|---|
| [`test/role_permissions.test.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/test/role_permissions.test.js) | `api/authorization.js` | 22 Section 37 Role-Permission Invariants |
| [`test/auth_and_profile.test.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/test/auth_and_profile.test.js) | `api/store.js`, `api/handler.js` | 6-digit Roll Validation & Duplicate Prevention |
| [`test/assignments_and_submissions.test.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/test/assignments_and_submissions.test.js) | `api/store.js`, `api/authorization.js` | Deadlines, Late Flags, Receipts, IDOR Isolation |
| [`test/moderation_and_restrictions.test.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/test/moderation_and_restrictions.test.js) | `api/moderation.js` | Admin Unbans, 7-Day Restriction Boundary Check |
| [`test/google_drive_storage.test.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/test/google_drive_storage.test.js) | `api/drive.js` | Folder Containment, Draft Protection, Audits |
| [`test/engine.test.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/test/engine.test.js) | `js/dayOrderEngine.js`, `js/timeEngine.js` | 49/49 Tests: Anchor, Rotation, Timetable Preservation |
| [`test/all_suites.test.js`](file:///c:/Users/DEEPANRAJ%20J/Desktop/college%20time%20planner/test/all_suites.test.js) | All Suites | Unified Production Test Runner |

---

## 4. How to Run Locally

### 1. Start the Production Server:
```bash
npm start
# or
node server.js
```
The server will start on port `3000` (or `process.env.PORT`):
- **Live Timetable Planner:** `http://localhost:3000/`
- **College Learning Platform:** `http://localhost:3000/learning.html`
- **Health / Status API:** `http://localhost:3000/api/status`

### 2. Run All Automated Test Suites:
```bash
npm test
# or
node test/all_suites.test.js
```
To run specific individual test suites:
```bash
npm run test:roles       # Section 37 Role-Permission Matrix (22 rules)
npm run test:auth        # Section 4 Auth & 6-Digit Profile Validation
npm run test:assignments # Section 15 & 39 Assignments & Submissions
npm run test:moderation  # Section 9 Moderation & 7-Day Restriction
npm run test:drive       # Section 12 & 38 Google Drive Storage
npm run test:timetable   # Timetable 49/49 Preservation Suite
```
