# CSE Class A — First-Year Live Timetable Planner

A real-time, responsive college timetable web application for **First-Year Computer Science and Engineering (Class A)** at **Saranathan College of Engineering (Autonomous), Tiruchirappalli**.

The app calculates the continuous Day Order from the official academic calendar, provides a real-time period countdown, differentiates completed periods, and features remote synchronization via Supabase.

---

## 🌟 Key Features

* **Real-Time Period Indicator (09:10 AM – 04:45 PM IST)**:
  * Automatically detects current period and displays remaining time countdown (`MM:SS`).
  * Smooth animated progress bar for the active period.
  * Before 09:10 AM: Displays *"College starts at 9:10 AM"* with countdown to Period 1.
  * After 04:45 PM: Displays *"Today's college hours have ended"* while keeping the full timetable available.
  * Completed periods are visually muted with strikethrough styling and a `✓ Completed` badge.

* **Continuous Day Order Calculation Engine**:
  * **Anchor Point:** `17 September 2026 = Day Order 1`.
  * Continuous working-day loop: `Day 1 → Day 2 → Day 3 → Day 4 → Day 5 → Day 1`.
  * Only working days advance the Day Order; holidays and leave Saturdays do not.
  * Handles working Saturdays (e.g. 26 Sep = Day 3, 10 Oct, 24 Oct, 31 Oct, 14 Nov, 19 Dec).

* **Official Academic Planner Sheet**:
  * Complete 4-month calendar (`SEP'26`, `OCT'26`, `NOV'26`, `DEC'26`) covering all 122 calendar days and 70 working days.
  * Matches the official college academic calendar layout with Day Order, Cumulative Working Day count, and color-coded event markers (Exams, Holidays, Commencement).
  * Also includes a switchable **7-day Monthly Calendar Grid View**.

* **Supabase Cloud Database Integration**:
  * Connected to Supabase for remote updates to timetable, calendar, and settings.
  * 3-tier resilient architecture: **Supabase Live → Offline Cache (`localStorage`) → Verified Local Baseline**.
  * Public read-only access protected by Row Level Security (RLS).

---

## 🏫 Class Details

* **Institution:** Saranathan College of Engineering (Autonomous), Tiruchirappalli
* **Department:** Computer Science and Engineering
* **Semester / Branch:** Semester I / CSE - A
* **Classroom / Hall:** RV 402
* **Class Coordinator:** Dr. R. Buvaneswari (Maths)
* **Mentors:** Mr. L. Parthipan, Ms. A. Rachel Roselin Arul, Ms. G. Sathya

---

## ⏱ College Period Schedule

| Period | Time | Duration | Description |
| :--- | :--- | :--- | :--- |
| **Period 1** | 09:10 AM – 10:00 AM | 50 mins | Regular Session |
| **Period 2** | 10:00 AM – 10:50 AM | 50 mins | Regular Session |
| **Break** | 10:50 AM – 11:05 AM | 15 mins | Morning Refreshment Break |
| **Period 3** | 11:05 AM – 11:55 AM | 50 mins | Regular Session |
| **Period 4** | 11:55 AM – 12:45 PM | 50 mins | Regular Session |
| **Lunch** | 12:45 PM – 01:30 PM | 45 mins | Lunch Break |
| **Period 5** | 01:30 PM – 02:15 PM | 45 mins | Regular Session |
| **Period 6** | 02:15 PM – 03:00 PM | 45 mins | Regular Session / Tutorial |
| **Break** | 03:00 PM – 03:15 PM | 15 mins | Afternoon Tea Break |
| **Period 7** | 03:15 PM – 04:00 PM | 45 mins | Regular Session / Lab |
| **Period 8** | 04:00 PM – 04:45 PM | 45 mins | Regular Session / Lab |

---

## 📚 Subject Registry

* `24EN101A` — Professional English (Dr. A. Lakshmi)
* `24MA101A` — Engineering Mathematics I (Dr. R. Buvaneswari)
* `24PH101A` — Engineering Physics I (Dr. M. Murali)
* `24CH101A` — Engineering Chemistry I (Dr. G. Thulasi)
* `24ES101A` — Problem Solving and Python Programming (Ms. P. Rohini)
* `24ES102A` — Engineering Graphics (Mr. P. Vigneshwar & Dr. G. Mahesh)
* `24TA101A` — Heritage of Tamils (Dr. M. Thangam)
* `24PH111A` — Physics / Chemistry Laboratory
* `24ES111A` — Python Programming Laboratory (Ms. P. Rohini, Mr. L. Parthipan)
* `24EM111A` — Communication Laboratory I (Dr. A. Lakshmi)
* `24MA101A(T)` — Engineering Mathematics I Tutorial (Dr. R. Buvaneswari, Dr. N. Subashini)

---

## 🚀 Running the Project Locally

No build tools required! Simply serve the directory with any static server:

```bash
# Using Python
python -m http.server 8080

# Or using Node http-server
npx serve .
```

Open `http://localhost:8080` in your web browser.

---

## 🗄 Supabase Setup

To initialize the remote database:
1. Open your Supabase Dashboard -> **SQL Editor**.
2. Run the complete setup script located at [`sql/supabase_setup_all.sql`](sql/supabase_setup_all.sql).
3. All tables (`app_settings`, `subjects`, `timetable_periods`, `academic_calendar`), RLS policies, and seed data will be automatically provisioned.
