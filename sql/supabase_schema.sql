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
