-- ==============================================================================
-- SARANATHAN COLLEGE OF ENGINEERING (AUTONOMOUS) - FIRST-YEAR CSE CLASS A
-- COMPLETE 1-CLICK SUPABASE DATABASE SETUP (SCHEMA + SEED DATA)
-- Run this entire script in Supabase Dashboard -> SQL Editor -> Click 'Run'
-- ==============================================================================

-- Supabase SQL Schema for CSE Class A - First-Year Live Timetable Planner
-- Institution: Saranathan College of Engineering (Autonomous), Tiruchirappalli

-- 1. App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    college_name TEXT NOT NULL DEFAULT 'Saranathan College of Engineering (Autonomous)',
    department TEXT NOT NULL DEFAULT 'Computer Science and Engineering',
    semester TEXT NOT NULL DEFAULT 'I',
    section TEXT NOT NULL DEFAULT 'A',
    hall TEXT NOT NULL DEFAULT 'RV 402',
    class_coordinator TEXT DEFAULT 'Dr. R. Buvaneswari (Maths)',
    mentors TEXT DEFAULT 'Mr. L. Parthipan, Ms. A. Rachel Roselin Arul, Ms. G. Sathya',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    college_start_time TEXT NOT NULL DEFAULT '09:10',
    college_end_time TEXT NOT NULL DEFAULT '16:45',
    anchor_date DATE NOT NULL DEFAULT '2026-09-17',
    anchor_day_order INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Subjects Table
CREATE TABLE IF NOT EXISTS public.subjects (
    id TEXT PRIMARY KEY,
    subject_code TEXT NOT NULL UNIQUE,
    subject_name TEXT NOT NULL,
    faculty_name TEXT NOT NULL,
    department TEXT NOT NULL,
    total_hours INTEGER DEFAULT 0,
    is_lab BOOLEAN DEFAULT false,
    color_accent TEXT DEFAULT '#3b82f6'
);

-- 3. Timetable Periods Table
CREATE TABLE IF NOT EXISTS public.timetable_periods (
    id SERIAL PRIMARY KEY,
    day_order INTEGER NOT NULL CHECK (day_order BETWEEN 1 AND 5),
    period_number INTEGER NOT NULL, -- 1 to 8, or 0 for breaks
    period_label TEXT, -- e.g. 'Period 1', 'Morning Break', 'Lunch'
    start_time TEXT NOT NULL, -- '09:10'
    end_time TEXT NOT NULL,   -- '10:00'
    subject_id TEXT REFERENCES public.subjects(id) ON DELETE SET NULL,
    room TEXT DEFAULT 'RV 402',
    session_type TEXT NOT NULL DEFAULT 'lecture', -- 'lecture', 'lab', 'tutorial', 'break', 'lunch'
    span_periods INTEGER DEFAULT 1 -- periods spanned (e.g. 2 for 2-hour lab)
);

-- 4. Academic Calendar Table
CREATE TABLE IF NOT EXISTS public.academic_calendar (
    id SERIAL PRIMARY KEY,
    calendar_date DATE NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('working', 'holiday', 'sunday', 'leave', 'special_working', 'exam', 'event')),
    day_order INTEGER CHECK (day_order BETWEEN 1 AND 5),
    working_day_number INTEGER, -- 1 to 70
    event_name TEXT,
    holiday_reason TEXT,
    notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_timetable_day_order ON public.timetable_periods(day_order);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON public.academic_calendar(calendar_date);

-- Enable Row Level Security (RLS)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_calendar ENABLE ROW LEVEL SECURITY;

-- Security Policies: Public (anon & authenticated) can SELECT only
DROP POLICY IF EXISTS "Public can view app settings" ON public.app_settings;
CREATE POLICY "Public can view app settings" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view subjects" ON public.subjects;
CREATE POLICY "Public can view subjects" ON public.subjects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view timetable periods" ON public.timetable_periods;
CREATE POLICY "Public can view timetable periods" ON public.timetable_periods FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view academic calendar" ON public.academic_calendar;
CREATE POLICY "Public can view academic calendar" ON public.academic_calendar FOR SELECT USING (true);


-- ==============================================================================
-- SEED DATA (APP SETTINGS, SUBJECTS, 122 CALENDAR DAYS, DAY ORDERS 1 TO 5)
-- ==============================================================================

-- Supabase Seed Data for Saranathan College of Engineering (Autonomous)
-- CSE Class A (First Year) - Academic Year 2026-27 ODD Semester

-- 1. App Settings
INSERT INTO public.app_settings (id, college_name, department, semester, section, hall, class_coordinator, mentors, timezone, college_start_time, college_end_time, anchor_date, anchor_day_order)
VALUES ('default', 'Saranathan College of Engineering (Autonomous)', 'Department of Computer Science and Engineering', 'I', 'A', 'RV 402', 'Dr. R. Buvaneswari (Maths)', 'Mr. L. Parthipan, Ms. A. Rachel Roselin Arul, Ms. G. Sathya', 'Asia/Kolkata', '09:10', '16:45', '2026-09-17', 1)
ON CONFLICT (id) DO UPDATE SET
    college_name = EXCLUDED.college_name,
    hall = EXCLUDED.hall,
    class_coordinator = EXCLUDED.class_coordinator;

-- 2. Subjects
INSERT INTO public.subjects (id, subject_code, subject_name, faculty_name, department, total_hours, is_lab, color_accent) VALUES
('24EN101A', '24EN101A', 'Professional English', 'Dr. A. Lakshmi (Eng)', 'English', 4, false, '#0284c7'),
('24MA101A', '24MA101A', 'Engineering Mathematics I', 'Dr. R. Buvaneswari (Mat)', 'Mathematics', 5, false, '#8b5cf6'),
('24PH101A', '24PH101A', 'Engineering Physics I', 'Dr. M. Murali (Phy)', 'Physics', 5, false, '#10b981'),
('24CH101A', '24CH101A', 'Engineering Chemistry I', 'Dr. G. Thulasi (Che)', 'Chemistry', 5, false, '#f59e0b'),
('24ES101A', '24ES101A', 'Problem Solving and Python Programming', 'Ms. P. Rohini (CSE)', 'CSE', 5, false, '#06b6d4'),
('24ES102A', '24ES102A', 'Engineering Graphics', 'Mr. P. Vigneshwar (Mech) & Dr. G. Mahesh (Mech)', 'Mechanical', 6, false, '#ec4899'),
('24TA101A', '24TA101A', 'Heritage of Tamils', 'Dr. M. Thangam (Tam)', 'Tamil', 1, false, '#d97706'),
('24PH111A', '24PH111A', 'Physics / Chemistry Laboratory', 'Dr. M. Murali (Phy), Dr. Nivetha G.F (Phy), Dr. R. Mariappan (Phy) / Dr. G. Thulasi (Che), Dr. L. Muruganandam (Che), Mr. A. Lakshmanan (Che)', 'Science Labs', 3, true, '#14b8a6'),
('24ES111A', '24ES111A', 'Python Programming Laboratory', 'Ms. P. Rohini (CSE), Mr. L. Parthipan (CSE)', 'CSE', 3, true, '#3b82f6'),
('24EM111A', '24EM111A', 'Communication Laboratory I', 'Dr. A. Lakshmi (Eng)', 'English', 2, true, '#6366f1'),
('24MA101A_T', '24MA101A(T)', 'Engineering Mathematics I (Tutorial)', 'Dr. R. Buvaneswari (Mat), Dr. N. Subashini (Mat)', 'Mathematics', 1, false, '#a855f7')
ON CONFLICT (subject_code) DO NOTHING;

-- 3. Academic Calendar Entries (Sep - Dec 2026)
INSERT INTO public.academic_calendar (calendar_date, status, day_order, working_day_number, event_name, holiday_reason) VALUES
('2026-09-01', 'event', NULL, NULL, 'Pre-Semester Preparation', NULL),
('2026-09-02', 'event', NULL, NULL, 'Pre-Semester Preparation', NULL),
('2026-09-03', 'event', NULL, NULL, 'Pre-Semester Preparation', NULL),
('2026-09-04', 'holiday', NULL, NULL, NULL, 'Krishna Jayanthi - Holiday'),
('2026-09-05', 'holiday', NULL, NULL, NULL, 'Teacher''s Day - Holiday'),
('2026-09-06', 'sunday', NULL, NULL, NULL, 'Sunday Holiday'),
('2026-09-07', 'event', NULL, NULL, 'Induction Programme', NULL),
('2026-09-08', 'event', NULL, NULL, 'Induction Programme', NULL),
('2026-09-09', 'event', NULL, NULL, 'Induction Programme', NULL),
('2026-09-10', 'event', NULL, NULL, 'Induction Programme', NULL),
('2026-09-11', 'event', NULL, NULL, 'Induction Programme', NULL),
('2026-09-12', 'event', NULL, NULL, 'Induction Programme', NULL),
('2026-09-13', 'sunday', NULL, NULL, NULL, 'Sunday Holiday'),
('2026-09-14', 'holiday', NULL, NULL, NULL, 'Vinayagar Chaturthi - Holiday'),
('2026-09-15', 'special_working', 4, 1, 'First Year Classes Commence (Engineers'' Day)', NULL),
('2026-09-16', 'working', 5, 2, NULL, NULL),
('2026-09-17', 'working', 1, 3, 'Day Order 1 Anchor', NULL),
('2026-09-18', 'working', 2, 4, NULL, NULL),
('2026-09-19', 'leave', NULL, NULL, NULL, 'Saturday Holiday'),
('2026-09-20', 'sunday', NULL, NULL, NULL, 'Sunday Holiday'),
('2026-09-21', 'working', 3, 5, NULL, NULL),
('2026-09-22', 'working', 4, 6, NULL, NULL),
('2026-09-23', 'working', 5, 7, NULL, NULL),
('2026-09-24', 'working', 1, 8, NULL, NULL),
('2026-09-25', 'working', 2, 9, NULL, NULL),
('2026-09-26', 'working', 3, 10, 'Working Saturday', NULL),
('2026-09-27', 'sunday', NULL, NULL, NULL, 'Sunday Holiday'),
('2026-09-28', 'working', 4, 11, NULL, NULL),
('2026-09-29', 'working', 5, 12, NULL, NULL),
('2026-09-30', 'working', 1, 13, NULL, NULL),
('2026-10-01', 'working', 2, 14, NULL, NULL),
('2026-10-02', 'holiday', NULL, NULL, NULL, 'Gandhi Jayanthi - Holiday'),
('2026-10-03', 'leave', NULL, NULL, NULL, 'Saturday Holiday'),
('2026-10-04', 'sunday', NULL, NULL, NULL, 'Sunday Holiday'),
('2026-10-05', 'working', 3, 15, NULL, NULL),
('2026-10-06', 'working', 4, 16, 'Syllabus Completion for CIA-1', NULL),
('2026-10-07', 'exam', 5, 17, 'CIA Test - 1', NULL),
('2026-10-08', 'exam', 1, 18, 'CIA Test - 1', NULL),
('2026-10-09', 'exam', 2, 19, 'CIA Test - 1', NULL),
('2026-10-10', 'exam', 3, 20, 'CIA Test - 1 (Working Saturday)', NULL),
('2026-10-11', 'sunday', NULL, NULL, NULL, 'Sunday Holiday'),
('2026-10-12', 'exam', 4, 21, 'CIA Test - 1', NULL),
('2026-10-13', 'exam', 5, 22, 'CIA Test - 1', NULL),
('2026-10-14', 'exam', 1, 23, 'CIA Test - 1', NULL),
('2026-10-15', 'working', 2, 24, NULL, NULL),
('2026-10-16', 'working', 3, 25, NULL, NULL),
('2026-10-17', 'leave', NULL, NULL, NULL, 'Saturday Holiday'),
('2026-10-18', 'sunday', NULL, NULL, NULL, 'Sunday Holiday'),
('2026-10-19', 'holiday', NULL, NULL, NULL, 'Ayudha Pooja - Holiday'),
('2026-10-20', 'holiday', NULL, NULL, NULL, 'Vijayadhasami - Holiday'),
('2026-10-21', 'working', 4, 26, NULL, NULL),
('2026-10-22', 'working', 5, 27, NULL, NULL),
('2026-10-23', 'working', 1, 28, NULL, NULL),
('2026-10-24', 'working', 2, 29, 'Working Saturday', NULL),
('2026-10-25', 'sunday', NULL, NULL, NULL, 'Sunday Holiday'),
('2026-10-26', 'working', 3, 30, NULL, NULL),
('2026-10-27', 'working', 4, 31, NULL, NULL),
('2026-10-28', 'working', 5, 32, NULL, NULL),
('2026-10-29', 'working', 1, 33, NULL, NULL),
('2026-10-30', 'working', 2, 34, NULL, NULL),
('2026-10-31', 'working', 3, 35, 'Working Saturday', NULL),
('2026-11-01', 'sunday', NULL, NULL, NULL, 'Sunday Holiday'),
('2026-11-02', 'working', 4, 36, NULL, NULL),
('2026-11-03', 'working', 5, 37, NULL, NULL),
('2026-11-04', 'working', 1, 38, NULL, NULL),
('2026-11-05', 'working', 2, 39, NULL, NULL),
('2026-11-06', 'leave', NULL, NULL, NULL, 'College Holiday'),
('2026-11-07', 'leave', NULL, NULL, NULL, 'Saturday Holiday'),
('2026-11-08', 'holiday', NULL, NULL, NULL, 'Deepavali - Holiday'),
('2026-11-09', 'leave', NULL, NULL, NULL, 'Deepavali Holiday'),
('2026-11-10', 'working', 3, 40, 'Syllabus Completion for CIA-2', NULL),
('2026-11-11', 'exam', 4, 41, 'CIA Test - 2', NULL),
('2026-11-12', 'exam', 5, 42, 'CIA Test - 2', NULL),
('2026-11-13', 'exam', 1, 43, 'CIA Test - 2', NULL),
('2026-11-14', 'exam', 2, 44, 'CIA Test - 2 (Children''s Day, Working Saturday)', NULL),
('2026-11-15', 'sunday', NULL, NULL, NULL, 'Sunday Holiday'),
('2026-11-16', 'exam', 3, 45, 'CIA Test - 2', NULL),
('2026-11-17', 'exam', 4, 46, 'CIA Test - 2', NULL),
('2026-11-18', 'exam', 5, 47, 'CIA Test - 2', NULL),
('2026-11-19', 'working', 1, 48, NULL, NULL),
('2026-11-20', 'working', 2, 49, NULL, NULL),
('2026-11-21', 'leave', NULL, NULL, NULL, 'Saturday Holiday'),
('2026-11-22', 'sunday', NULL, NULL, NULL, 'Sunday Holiday'),
('2026-11-23', 'working', 3, 50, NULL, NULL),
('2026-11-24', 'working', 4, 51, NULL, NULL),
('2026-11-25', 'working', 5, 52, NULL, NULL),
('2026-11-26', 'working', 1, 53, NULL, NULL),
('2026-11-27', 'working', 2, 54, NULL, NULL),
('2026-11-28', 'leave', NULL, NULL, NULL, 'Saturday Holiday'),
('2026-11-29', 'sunday', NULL, NULL, NULL, 'Sunday Holiday'),
('2026-11-30', 'working', 3, 55, NULL, NULL),
('2026-12-01', 'working', 4, 56, NULL, NULL),
('2026-12-02', 'working', 5, 57, NULL, NULL),
('2026-12-03', 'working', 1, 58, NULL, NULL),
('2026-12-04', 'working', 2, 59, 'Syllabus Completion for CIA-3', NULL),
('2026-12-05', 'leave', NULL, NULL, NULL, 'Saturday Holiday'),
('2026-12-06', 'sunday', NULL, NULL, NULL, 'Sunday Holiday'),
('2026-12-07', 'exam', 3, 60, 'CIA Test - 3', NULL),
('2026-12-08', 'exam', 4, 61, 'CIA Test - 3', NULL),
('2026-12-09', 'exam', 5, 62, 'CIA Test - 3', NULL),
('2026-12-10', 'exam', 1, 63, 'CIA Test - 3', NULL),
('2026-12-11', 'exam', 2, 64, 'CIA Test - 3', NULL),
('2026-12-12', 'leave', NULL, NULL, NULL, 'Saturday Holiday'),
('2026-12-13', 'sunday', NULL, NULL, NULL, 'Sunday Holiday'),
('2026-12-14', 'exam', 3, 65, 'CIA Test - 3', NULL),
('2026-12-15', 'exam', 4, 66, 'CIA Test - 3', NULL),
('2026-12-16', 'working', 5, 67, NULL, NULL),
('2026-12-17', 'working', 1, 68, NULL, NULL),
('2026-12-18', 'working', 2, 69, NULL, NULL),
('2026-12-19', 'working', 3, 70, 'Syllabus Completion (Working Saturday)', NULL),
('2026-12-20', 'holiday', NULL, NULL, NULL, 'Vaikunda Ekadesi - Holiday'),
('2026-12-21', 'exam', NULL, NULL, 'End Semester Practical Examinations Begin', NULL),
('2026-12-22', 'exam', NULL, NULL, 'End Semester Practical Examinations', NULL),
('2026-12-23', 'exam', NULL, NULL, 'End Semester Practical Examinations', NULL),
('2026-12-24', 'exam', NULL, NULL, 'End Semester Practical Examinations', NULL),
('2026-12-25', 'holiday', NULL, NULL, NULL, 'Christmas - Holiday'),
('2026-12-26', 'leave', NULL, NULL, NULL, 'Saturday Holiday'),
('2026-12-27', 'sunday', NULL, NULL, NULL, 'Sunday Holiday'),
('2026-12-28', 'event', NULL, NULL, 'Preparation / Study Period', NULL),
('2026-12-29', 'event', NULL, NULL, 'Preparation / Study Period', NULL),
('2026-12-30', 'event', NULL, NULL, 'Preparation / Study Period', NULL),
('2026-12-31', 'exam', NULL, NULL, 'End Semester Theory Examinations Begin', NULL)
ON CONFLICT (calendar_date) DO UPDATE SET
    status = EXCLUDED.status,
    day_order = EXCLUDED.day_order,
    working_day_number = EXCLUDED.working_day_number,
    event_name = EXCLUDED.event_name,
    holiday_reason = EXCLUDED.holiday_reason;

-- 4. Timetable Periods (Day Orders 1 to 5)
INSERT INTO public.timetable_periods (day_order, period_number, period_label, start_time, end_time, subject_id, room, session_type, span_periods) VALUES
(1, 1, 'Period 1', '09:10', '10:00', '24ES101A', 'RV 402', 'lecture', 1),
(1, 2, 'Period 2', '10:00', '10:50', '24PH101A', 'RV 402', 'lecture', 1),
(1, 0, 'Morning Break', '10:50', '11:05', NULL, 'Campus', 'break', 1),
(1, 3, 'Period 3', '11:05', '11:55', '24CH101A', 'RV 402', 'lecture', 1),
(1, 4, 'Period 4', '11:55', '12:45', '24MA101A', 'RV 402', 'lecture', 1),
(1, 0, 'Lunch Break', '12:45', '13:30', NULL, 'Food Court', 'lunch', 1),
(1, 5, 'Period 5', '13:30', '14:15', '24ES101A', 'RV 402', 'lecture', 1),
(1, 6, 'Period 6', '14:15', '15:00', '24MA101A_T', 'RV 402', 'tutorial', 1),
(1, 0, 'Afternoon Break', '15:00', '15:15', NULL, 'Campus', 'break', 1),
(1, 7, 'Period 7', '15:15', '16:00', '24EM111A', 'Communication Lab', 'lab', 1),
(1, 8, 'Period 8', '16:00', '16:45', '24EM111A', 'Communication Lab', 'lab', 1),
(2, 1, 'Period 1', '09:10', '10:00', '24MA101A', 'RV 402', 'lecture', 1),
(2, 2, 'Period 2', '10:00', '10:50', '24EN101A', 'RV 402', 'lecture', 1),
(2, 0, 'Morning Break', '10:50', '11:05', NULL, 'Campus', 'break', 1),
(2, 3, 'Period 3', '11:05', '11:55', '24PH101A', 'RV 402', 'lecture', 1),
(2, 4, 'Period 4', '11:55', '12:45', '24CH101A', 'RV 402', 'lecture', 1),
(2, 0, 'Lunch Break', '12:45', '13:30', NULL, 'Food Court', 'lunch', 1),
(2, 5, 'Period 5', '13:30', '14:15', '24TA101A', 'RV 402', 'lecture', 1),
(2, 6, 'Period 6', '14:15', '15:00', '24ES102A', 'Graphics Hall', 'practical', 1),
(2, 0, 'Afternoon Break', '15:00', '15:15', NULL, 'Campus', 'break', 1),
(2, 7, 'Period 7', '15:15', '16:00', '24ES102A', 'Graphics Hall', 'practical', 1),
(2, 8, 'Period 8', '16:00', '16:45', '24ES102A', 'Graphics Hall', 'practical', 1),
(3, 1, 'Period 1', '09:10', '10:00', '24CH101A', 'RV 402', 'lecture', 1),
(3, 2, 'Period 2', '10:00', '10:50', '24PH101A', 'RV 402', 'lecture', 1),
(3, 0, 'Morning Break', '10:50', '11:05', NULL, 'Campus', 'break', 1),
(3, 3, 'Period 3', '11:05', '11:55', '24ES101A', 'RV 402', 'lecture', 1),
(3, 4, 'Period 4', '11:55', '12:45', '24EN101A', 'RV 402', 'lecture', 1),
(3, 0, 'Lunch Break', '12:45', '13:30', NULL, 'Food Court', 'lunch', 1),
(3, 5, 'Period 5', '13:30', '14:15', '24CH101A', 'RV 402', 'lecture', 1),
(3, 6, 'Period 6', '14:15', '15:00', '24PH111A', 'Physics / Chemistry Lab', 'lab', 1),
(3, 0, 'Afternoon Break', '15:00', '15:15', NULL, 'Campus', 'break', 1),
(3, 7, 'Period 7', '15:15', '16:00', '24PH111A', 'Physics / Chemistry Lab', 'lab', 1),
(3, 8, 'Period 8', '16:00', '16:45', '24PH111A', 'Physics / Chemistry Lab', 'lab', 1),
(4, 1, 'Period 1', '09:10', '10:00', '24MA101A', 'RV 402', 'lecture', 1),
(4, 2, 'Period 2', '10:00', '10:50', '24ES111A', 'Python Lab', 'lab', 1),
(4, 0, 'Morning Break', '10:50', '11:05', NULL, 'Campus', 'break', 1),
(4, 3, 'Period 3', '11:05', '11:55', '24ES111A', 'Python Lab', 'lab', 1),
(4, 4, 'Period 4', '11:55', '12:45', '24ES111A', 'Python Lab', 'lab', 1),
(4, 0, 'Lunch Break', '12:45', '13:30', NULL, 'Food Court', 'lunch', 1),
(4, 5, 'Period 5', '13:30', '14:15', '24ES101A', 'RV 402', 'lecture', 1),
(4, 6, 'Period 6', '14:15', '15:00', '24MA101A', 'RV 402', 'lecture', 1),
(4, 0, 'Afternoon Break', '15:00', '15:15', NULL, 'Campus', 'break', 1),
(4, 7, 'Period 7', '15:15', '16:00', '24EN101A', 'RV 402', 'lecture', 1),
(4, 8, 'Period 8', '16:00', '16:45', '24PH101A', 'RV 402', 'lecture', 1),
(5, 1, 'Period 1', '09:10', '10:00', '24PH101A', 'RV 402', 'lecture', 1),
(5, 2, 'Period 2', '10:00', '10:50', '24ES102A', 'Graphics Hall', 'practical', 1),
(5, 0, 'Morning Break', '10:50', '11:05', NULL, 'Campus', 'break', 1),
(5, 3, 'Period 3', '11:05', '11:55', '24ES102A', 'Graphics Hall', 'practical', 1),
(5, 4, 'Period 4', '11:55', '12:45', '24ES102A', 'Graphics Hall', 'practical', 1),
(5, 0, 'Lunch Break', '12:45', '13:30', NULL, 'Food Court', 'lunch', 1),
(5, 5, 'Period 5', '13:30', '14:15', '24EN101A', 'RV 402', 'lecture', 1),
(5, 6, 'Period 6', '14:15', '15:00', '24MA101A', 'RV 402', 'lecture', 1),
(5, 0, 'Afternoon Break', '15:00', '15:15', NULL, 'Campus', 'break', 1),
(5, 7, 'Period 7', '15:15', '16:00', '24CH101A', 'RV 402', 'lecture', 1),
(5, 8, 'Period 8', '16:00', '16:45', '24ES101A', 'RV 402', 'lecture', 1);

