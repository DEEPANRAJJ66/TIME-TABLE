# College Learning Resource Platform — Final Delivery Handover

**Institution:** Saranathan College of Engineering (Autonomous), Tiruchirappalli  
**Department:** Computer Science and Engineering (CSE Class A, Room RV 402)  
**Academic Target:** First-Year Semester I & Continuous Multi-Semester Architecture  
**Active Branch:** `feature/learning-resource-platform`

---

## 1. Executive Summary & Verification

The **College Learning Resource Platform** has been fully implemented and seamlessly integrated alongside the existing **CSE Class A Live Timetable Planner**. 

### Absolute Invariant Compliance:
- **Zero Modifications to Protected Timetable Code:**
  - `app.js` SHA-256: `8690A4D8D368CFD10567DA26B1AFDA21E0DB9243999F79452FD4845269189118` (**100% Exact Match**)
  - `js/timeEngine.js` SHA-256: `A9F3A1CBBE83990762E914EE732216C2CDD8884D1A14A0BD2C541DF24F92DA98` (**100% Exact Match**)
  - `js/dayOrderEngine.js` SHA-256: `63E2D3585F395419A8190D0636311BDFC4980FC221D245326FB67559BC635A08` (**100% Exact Match**)
  - `data/timetableData.js` SHA-256: `1DE6766214FCAFD6551E88695CCE28801B64D27AAEE6127F1F8BF8A7BDBF8716` (**100% Exact Match**)
  - `data/calendarData.js` SHA-256: `07D0492866557B712590071310EEF288113BFAE9777804D7B84C34A330CCE819` (**100% Exact Match**)
  - `style.css` SHA-256: `F0A4DB3C15BA5585255F5AA3A2CED473B2B41F96EA0FAFC32E14A0E76FDB62CA` (**100% Exact Match**)
  - `sql/supabase_schema.sql` SHA-256: `6C530684A2FAF5FC8802956D2B281CED458B5306993C3B09413F91AB9FB86000` (**100% Exact Match**)
- **100% Test Pass Rate (116/116 Tests Passing across 5 Suites):**
  - Timetable Engine Baseline: **49/49 PASSED**
  - Learning Platform Core & Access Control: **26/26 PASSED**
  - Telegram Bot API PoC & Failure Recovery: **14/14 PASSED**
  - PostgreSQL RLS Security Policies: **8/8 PASSED**
  - Resource Lifecycle & State Machine: **19/19 PASSED**

---

## 2. Platform Architecture & Modules

```
├── learning.html                  # Standalone Learning Platform HTML Shell
├── learning.css                   # Scoped Modern Design System (--lr-* tokens)
├── api/
│   ├── handler.js                 # Unified Node & Serverless API Router
│   └── telegram.js                # Secure Server-Side Telegram Bot API Integration
├── js/learning/
│   ├── learningApp.js             # View Controller, Router, UI State Manager
│   ├── learningAuth.js            # Role-Based Authentication Service
│   ├── learningStore.js           # 3-Tier Resilient Store & State Machine
│   ├── telegramService.js         # Client-Side Telegram Upload Bridge & 50MB Guard
│   └── viewerModal.js             # In-App PDF, Image, Video & Drive Embed Modal
├── sql/
│   ├── learning_platform_schema.sql     # Namespaced Additive Tables & RLS Policies
│   ├── learning_platform_seed.sql       # Baseline Categories, Subjects & Samples
│   └── learning_platform_setup_all.sql  # Single-Execution Supabase Setup Script
└── test/
    ├── engine.test.js                   # Protected Timetable Engine Suite
    ├── learning_platform.test.js        # Core Store & Permissions Suite
    ├── telegram_poc.test.js             # Telegram Upload & Idempotency Suite
    ├── security_policies.test.js        # Row-Level Security Policy Suite
    └── lifecycle_and_recovery.test.js   # State Machine & Lifecycle Suite
```

---

## 3. Workspaces & User Roles

### A. Student Learning Portal (Open Access)
- **Authentication:** Any Google Account (no pre-authorization required) or Guest mode.
- **Access Level:** Read-only access to published materials only. Private drafts and unpublished resources are strictly invisible.
- **Key Features:**
  - **High-Priority Missed-Class Notes Finder:** Filter handwritten and daily discussion notes by Academic Date and Period (Periods 1–8).
  - **Multi-Term Debounced Search:** Real-time search across topics, tags, subject codes, and units.
  - **In-App Viewer Modal:** Direct viewing of PDFs, images, HTML5 video, and embedded Google Drive folders/previews without forcing external tab switches.

### B. Manager Dashboard (Authorized Upload Studio)
- **Authentication:** Verified Google Account pre-authorized by Administrator.
- **Initial Authorized Manager:** `manager.cse@saranathan.ac.in`
- **Access Level:** Upload and manage own learning materials.
- **Key Features:**
  - **5-Step Upload Studio:**
    - Step 1: Select Resource Type (Device File vs Google Drive link).
    - Step 2: Device File Drop Zone with 50MB boundary check OR validated Google Drive URL.
    - Step 3: Comprehensive Metadata (Title, Category, Subject, Academic Date, Period, Unit, Tags).
    - Step 4: Secure Upload to Telegram Channel (`https://t.me/+6dIBd-yKc75hZGY1`) with progress feedback.
    - Step 5: Draft Preview and Explicit Publishing.
  - **Draft Management:** Saved as private drafts until explicitly verified and published.
  - **Ownership Enforcement:** Managers can only edit, unpublish, or delete their own materials.

### C. Administrator Dashboard (Master Governance)
- **Authentication:** Admin Email & Password login (`admin@saranathan.ac.in`).
- **Initial Password:** `Admin@Saranathan2026`
- **Access Level:** Full system control across all resources and managers.
- **Key Features:**
  - **Manager Account Management:** Authorize new Google email addresses or revoke access with instant effect.
  - **Dynamic Category Management:** Create, edit, and archive resource categories. Deletion is protected if active resources reference the category.
  - **Academic Subject Management:** Manage subjects, codes, and faculty assignments.
  - **System-Wide Resource Moderation:** Search, review, publish, unpublish, or delete materials across all managers.
  - **Security Audit Logs:** Chronological immutable trail of all management, role assignments, and publishing actions.
  - **Telegram Diagnostics:** Live status badge, connectivity testing, private channel link, and configuration wizard.

---

## 4. Backend Deployment & Telegram Configuration

### Telegram Storage Rules:
- **Private Channel Link:** [https://t.me/+6dIBd-yKc75hZGY1](https://t.me/+6dIBd-yKc75hZGY1)
- **Channel ID:** `-1003185348943`
- **Bot Upload Limit:** 50 MB per file (Bot API standard). Files exceeding 50 MB must use Google Drive URLs.
- **Proxy Download Limit:** 20 MB per file via `getFile`. Files between 20 MB and 50 MB are directed to the private channel link.

### Setting Up Secrets (Local or Vercel):
Set the following environment variables on your hosting provider or in `.env`:
```env
TELEGRAM_BOT_TOKEN="your_bot_token_from_botfather"
TELEGRAM_CHANNEL_ID="-1003185348943"
```
*Note: If `TELEGRAM_BOT_TOKEN` is unset, the application gracefully reports this in the Admin diagnostics panel and allows Google Drive links without crashing or faking active status.*

### Applying Database Schema in Supabase:
1. Open your Supabase Dashboard: [https://supabase.com/dashboard/project/uryiomifyhcbvzeafizi](https://supabase.com/dashboard/project/uryiomifyhcbvzeafizi)
2. Navigate to **SQL Editor**.
3. Open `sql/learning_platform_setup_all.sql` from this repository, copy its contents, and click **Run**.
4. All tables, indexes, RLS policies, and seed data will be safely applied with zero impact on existing timetable tables.

---

## 5. Verification Commands

```bash
# Run all 5 test suites (116 tests)
npm test

# Build static web distribution
npm run build

# Synchronize with Android Capacitor
npx cap sync

# Start development server
node server.js
```
