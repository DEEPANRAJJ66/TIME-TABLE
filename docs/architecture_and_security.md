# Production College Learning, Study Material & Assignment Platform
## Architecture, Security & Engineering Specification

### 1. System Overview & Core Invariants
The College Learning Resource Platform is a secure, responsive, role-based educational web platform designed for First-Year Computer Science & Engineering (Class A) at Saranathan College of Engineering (Autonomous), Tiruchirappalli.

The platform coordinates learning materials across 7 primary academic subjects, tracks assignments and student submissions, provides authoritative college notices, enforces a strict 4-tier role hierarchy, uses Google OAuth as its sole interactive identity provider, stores files in a designated Google Drive repository, and logs immutable audit trails to a private Telegram channel.

#### Core Invariants:
1. **Protected Timetable Coexistence:** The existing live timetable planner (`index.html`, `app.js`, `style.css`, `js/timeEngine.js`, `js/dayOrderEngine.js`, `data/*.js`) is preserved intact and functional. The learning platform operates alongside it seamlessly.
2. **Strict Single Provider:** Google Sign-In via Supabase OAuth is the sole interactive authentication method. No public registration forms, email/password logins, or self-assigned roles.
3. **Default Role Principle:** Every new user authenticating via Google is registered as a `Student`. All role elevations require explicit promotion by an authorized administrator.
4. **Server-Enforced Authorization:** No privileged operation is trusted from client state. Every API request validates user identity, account status, role hierarchy, resource ownership, subject assignment, and moderation restrictions.
5. **Private Storage Boundary:** All uploaded files are routed to the designated Google Drive storage folder (`GOOGLE_DRIVE_APPROVED_FOLDER_ID`). Direct public file links are forbidden; authorized previews and downloads are mediated by authenticated backend proxy streams.
6. **Audit Durability:** All significant administrative and upload operations generate structured audit events recorded in database logs and dispatched to the Telegram audit channel with reliable background retry queues.

---

### 2. Role Hierarchy & Authority Matrix

```
┌────────────────────────────────────────────────────────┐
│                        ADMIN                           │
│  (Highest Authority: Full Governance, Role Management) │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    REPRESENTATIVE                      │
│      (Manager Promotion, Section & File Governance)    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                       MANAGER                          │
│     (Assigned Subject Uploads, Assignment Tracking)    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                       STUDENT                          │
│       (Read Published Materials, Submit Assignments)   │
└────────────────────────────────────────────────────────┘
```

#### Detailed Permission Matrix:

| Action / Capability | Admin | Representative | Manager | Student | Enforcement Rule |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Authenticate via Google OAuth** | ✓ | ✓ | ✓ | ✓ | Valid Google account required |
| **Complete Profile (Name, 6-digit Roll)** | ✓ | ✓ | ✓ | ✓ | Server validates 6 numeric digits & uniqueness |
| **Browse 7 Official Subjects** | ✓ | ✓ | ✓ | ✓ | Publicly visible to all active users |
| **View Published Resources** | ✓ | ✓ | ✓ | ✓ | All active roles can view |
| **View Resource Drafts** | ✓ | ✓ | Own only | ✗ | Students NEVER see drafts |
| **Upload Resources** | ✓ | ✓ | Assigned subjects | ✗ | Students cannot upload learning materials |
| **Edit / Move Resources** | ✓ | ✓ | Own drafts only | ✗ | Managers cannot edit others' files |
| **Delete Resources** | ✓ | ✓ | Own drafts only | ✗ | Audited soft-deletion with rollback |
| **Publish Resource Draft** | ✓ | ✓ | ✗ | ✗ | Requires Representative or Admin approval |
| **Return Resource to Draft** | ✓ | ✓ | ✗ | ✗ | Authoritative review workflow |
| **Create / Publish Assignment** | ✓ | ✓ | Assigned subjects | ✗ | Server records creator, subject, deadline |
| **Submit Assignment Work** | ✗ | ✗ | ✗ | ✓ | Students submit before deadline; receipt issued |
| **View Student Submissions** | ✓ | Permitted | Assigned subjects | Own only | Strict IDOR protection; private Drive access |
| **Post Global Notice (IST format)** | ✓ | ✓ | ✗ | ✗ | Strict template enforcement with IST timestamp |
| **Promote Student → Manager** | ✓ | ✓ | ✗ | ✗ | Assigns subject/section responsibilities |
| **Promote User → Representative** | ✓ | ✗ | ✗ | ✗ | Admin-only capability |
| **Demote Representative / Manager** | ✓ | Authorized | ✗ | ✗ | Role reduction audited |
| **Ban Student** | ✓ | ✓ | Scope only | ✗ | Recorded in moderation history |
| **Ban Manager** | ✓ | ✓ | ✗ | ✗ | Manager cannot ban peer Managers |
| **Ban Representative** | ✓ | ✗ | ✗ | ✗ | Admin-only capability |
| **Ban Admin** | ✗ | ✗ | ✗ | ✗ | STRICTLY FORBIDDEN (Protected account) |
| **Unban Any User** | ✓ | ✗ | ✗ | ✗ | Representative/Manager CANNOT unban |
| **7-Day Re-Ban Restriction** | N/A | N/A | Enforced | N/A | Blocks Manager from re-banning unbanned student |
| **Submit Ban Request to Admin** | N/A | N/A | ✓ | ✗ | Reviewable by Admin during 7-day restriction |
| **View System Audit Logs** | ✓ | Relevant | ✗ | ✗ | Immutable chronological audit trail |
| **Inspect Telegram Outbox** | ✓ | ✗ | ✗ | ✗ | System diagnostic health |

---

### 3. Subject Library & Structure
Exactly seven official first-semester subjects:
1. `sub_graphics` — **Engineering Graphics** (`24ES102A`)
2. `sub_physics` — **Engineering Physics** (`24PH101A`)
3. `sub_chemistry` — **Engineering Chemistry** (`24CH101A`)
4. `sub_mathematics` — **Engineering Mathematics I** (`24MA101A`)
5. `sub_tamil` — **Heritage of Tamils** (`24TA101A`)
6. `sub_english` — **Professional English** (`24EN101A`)
7. `sub_python` — **Problem Solving and Python Programming** (`24ES101A`)

**Resource Hierarchy:**
`Subject` → `Unit (1 to 5) or Topic` → `Category` → `Resource File`

Categories:
- `cat_notes`: Regular Class Notes & Lecture Materials
- `cat_assignments`: Problem Sets, Lab Sheets & Exercises
- `cat_videos`: Educational Videos & Demonstrations
- `cat_lab`: Laboratory Programs, Procedures & Manuals
- `cat_reference`: Textbooks, Syllabus & Reference Guides

---

### 4. Google Drive Storage Architecture
- **Dedicated Folder Boundary:** All files are written inside the folder designated by `GOOGLE_DRIVE_APPROVED_FOLDER_ID`.
- **Server-Side Token Exchange:** The backend securely exchanges `GOOGLE_REFRESH_TOKEN` for short-lived access tokens. Credentials never reach the browser.
- **Resumable Chunked Uploads:**
  - Files < 5 MB: Uploaded directly via multipart upload to Google Drive API v3.
  - Files >= 5 MB: Uses Google Drive Resumable Upload protocol with 256 KB chunking, progress tracking, and session resumption.
- **Secure File Streaming:** When a student previews or downloads a file, the backend verifies authorization and streams the content via range headers. No raw public Drive links are exposed.

---

### 5. Telegram Bot Audit Architecture
- **Bot Identity:** `@DeepanCollegeLearningBot` (ID: `8968622105`).
- **Channel Target:** Private channel `-1003598863042`.
- **Audit Messages:** HTML-formatted messages with IST timestamps (`Asia/Kolkata`), actor name, email, role, action type, resource metadata, and Drive file reference.
- **Durable Outbox Queue:** If Telegram API encounters network throttling or temporary unavailability, events are stored in `integration_outbox` and retried with exponential backoff without failing the primary database operation.

---

### 6. Timezone & Authoritative Clock
- All stored database timestamps use UTC (`ISO-8601`, e.g., `2026-10-19T10:00:00.000Z`).
- All displayed timestamps, calendar dates, and notice dates use `Asia/Kolkata` (IST, UTC+05:30).
- Deadline evaluations and the 7-day re-ban restriction calculations compare UTC server timestamps. Browser device clocks are never trusted.
