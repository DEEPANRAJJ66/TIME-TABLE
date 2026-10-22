-- ========================================================================
-- Production College Learning, Study Material & Assignment Platform Schema
-- Institution: Saranathan College of Engineering (Autonomous), Tiruchirappalli
-- Department: Computer Science & Engineering (First-Year Class A)
-- Target Database: PostgreSQL / Supabase
-- ========================================================================

-- Enable cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------
-- Migration Safety: Convert legacy text foreign-key and primary-key columns
-- Resolves: ERROR: 42883: operator does not exist: uuid = text
-- Idempotent & safe: safely handles existing records before converting types.
-- ------------------------------------------------------------------------
DO $$
BEGIN
    -- 1. profiles.id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id' AND data_type = 'text'
    ) THEN
        UPDATE public.profiles 
        SET id = gen_random_uuid()::text 
        WHERE id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

        ALTER TABLE public.profiles ALTER COLUMN id TYPE uuid USING (id::uuid);
    END IF;

    -- 2. resources.uploader_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'resources' AND column_name = 'uploader_id' AND data_type = 'text'
    ) THEN
        UPDATE public.resources 
        SET uploader_id = gen_random_uuid()::text 
        WHERE uploader_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

        ALTER TABLE public.resources ALTER COLUMN uploader_id TYPE uuid USING (uploader_id::uuid);
    END IF;

    -- 3. assignments.creator_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'creator_id' AND data_type = 'text'
    ) THEN
        UPDATE public.assignments 
        SET creator_id = gen_random_uuid()::text 
        WHERE creator_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

        ALTER TABLE public.assignments ALTER COLUMN creator_id TYPE uuid USING (creator_id::uuid);
    END IF;

    -- 4. submissions.student_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'student_id' AND data_type = 'text'
    ) THEN
        UPDATE public.submissions 
        SET student_id = gen_random_uuid()::text 
        WHERE student_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

        ALTER TABLE public.submissions ALTER COLUMN student_id TYPE uuid USING (student_id::uuid);
    END IF;

    -- 5. subject_assignments.manager_id & assigned_by
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'subject_assignments' AND column_name = 'manager_id' AND data_type = 'text'
    ) THEN
        UPDATE public.subject_assignments 
        SET manager_id = gen_random_uuid()::text 
        WHERE manager_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

        ALTER TABLE public.subject_assignments ALTER COLUMN manager_id TYPE uuid USING (manager_id::uuid);
    END IF;
END $$;

-- ------------------------------------------------------------------------
-- 1. PROFILES (Users, Auth association, Roles, Account Status)
-- Primary Key matches Supabase auth.users(id) UUID type exactly
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    secondary_name TEXT,
    display_name TEXT NOT NULL,
    roll_number TEXT UNIQUE CHECK (roll_number IS NULL OR roll_number ~ '^[0-9]{6}$'),
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'representative', 'manager', 'student')),
    account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'banned', 'pending_profile')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Trigger to sanitize empty roll numbers to NULL so UNIQUE and regex constraints pass cleanly
CREATE OR REPLACE FUNCTION public.normalize_profile_roll_number()
RETURNS trigger AS $$
BEGIN
    IF NEW.roll_number IS NOT NULL AND trim(NEW.roll_number) = '' THEN
        NEW.roll_number := NULL;
    ELSIF NEW.roll_number IS NOT NULL THEN
        NEW.roll_number := trim(NEW.roll_number);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_profile_roll_number ON public.profiles;
CREATE TRIGGER trg_normalize_profile_roll_number
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_profile_roll_number();

-- ------------------------------------------------------------------------
-- 2. SUBJECTS (Unified with Timetable & Learning Platform)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subjects (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '📚',
    order_index INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true NOT NULL,
    -- Timetable planner coexistence attributes
    subject_code TEXT,
    subject_name TEXT,
    faculty_name TEXT DEFAULT '',
    department TEXT DEFAULT 'CSE',
    total_hours INTEGER DEFAULT 0,
    is_lab BOOLEAN DEFAULT false,
    color_accent TEXT DEFAULT '#3b82f6'
);

-- ------------------------------------------------------------------------
-- 3. SUBJECT ASSIGNMENTS (Managers assigned to specific subjects)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subject_assignments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    subject_id TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(subject_id, manager_id)
);

-- ------------------------------------------------------------------------
-- 4. SECTIONS / UNITS (Subject Units 1 - 5)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sections (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    subject_id TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    unit_number INTEGER NOT NULL CHECK (unit_number BETWEEN 1 AND 5),
    title TEXT NOT NULL,
    description TEXT,
    UNIQUE(subject_id, unit_number)
);

-- ------------------------------------------------------------------------
-- 5. RESOURCES (Learning materials, notes, videos, lab sheets)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resources (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    description TEXT,
    original_filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    subject_id TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    unit_number INTEGER CHECK (unit_number BETWEEN 1 AND 5),
    category TEXT NOT NULL DEFAULT 'cat_notes' CHECK (category IN ('cat_notes', 'cat_assignments', 'cat_videos', 'cat_lab', 'cat_reference')),
    uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    uploader_name TEXT NOT NULL,
    uploader_email TEXT NOT NULL,
    publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'published', 'archived')),
    google_drive_file_id TEXT,
    google_drive_folder_id TEXT,
    google_drive_status TEXT DEFAULT 'pending',
    telegram_audit_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------
-- 6. ASSIGNMENTS (First-class coursework assignments)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    instructions TEXT NOT NULL,
    subject_id TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    unit_number INTEGER CHECK (unit_number BETWEEN 1 AND 5),
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    creator_name TEXT NOT NULL,
    due_date_utc TIMESTAMPTZ NOT NULL,
    due_date_ist_display TEXT NOT NULL,
    publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'published', 'archived')),
    attachments JSONB DEFAULT '[]'::jsonb,
    max_file_size_bytes BIGINT DEFAULT 52428800, -- 50 MB
    allowed_formats TEXT DEFAULT 'pdf,png,jpg,jpeg,doc,docx,zip',
    submission_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------
-- 7. SUBMISSIONS (Student coursework submissions with immutable receipt)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submissions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    receipt_id TEXT NOT NULL UNIQUE,
    assignment_id TEXT NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_email TEXT NOT NULL,
    student_roll_number TEXT NOT NULL,
    submitted_files JSONB NOT NULL DEFAULT '[]'::jsonb,
    submitted_at_utc TIMESTAMPTZ DEFAULT now() NOT NULL,
    submitted_at_ist TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'submitted_late')),
    comments TEXT,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(assignment_id, student_id)
);

-- ------------------------------------------------------------------------
-- 8. MODERATION RECORDS (Persistent audit of all bans & unbans)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_email TEXT NOT NULL,
    target_role TEXT NOT NULL,
    acting_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    acting_user_role TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('ban', 'unban')),
    reason TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    unban_actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    unban_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------
-- 9. BAN RESTRICTIONS (7-day re-ban restriction between Manager and Student)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ban_restrictions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    restriction_start_utc TIMESTAMPTZ NOT NULL,
    restriction_end_utc TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(manager_id, student_id)
);

-- ------------------------------------------------------------------------
-- 10. BAN REQUESTS (Manager requests Admin to ban a student under 7-day restriction)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ban_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    manager_name TEXT NOT NULL,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------
-- 11. NOTICES (Global notices conforming to mandatory college format)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date_ist TEXT NOT NULL,
    message TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL,
    formatted_notice_text TEXT NOT NULL,
    publication_status TEXT NOT NULL DEFAULT 'published' CHECK (publication_status IN ('draft', 'published')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------
-- 12. NOTIFICATIONS (In-app notification center)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_resource_id TEXT,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------
-- 13. AUDIT EVENTS (Immutable server-side audit trail)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action_type TEXT NOT NULL,
    target_resource_type TEXT NOT NULL,
    target_resource_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------
-- 14. INTEGRATION OUTBOX (Reliable Telegram audit dispatch queue)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integration_outbox (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    target_service TEXT NOT NULL DEFAULT 'telegram',
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------
-- 15. TIMETABLE COEXISTENCE TABLES (App Settings, Periods, Calendar)
-- ------------------------------------------------------------------------
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

CREATE TABLE IF NOT EXISTS public.timetable_periods (
    id SERIAL PRIMARY KEY,
    day_order INTEGER NOT NULL CHECK (day_order BETWEEN 1 AND 5),
    period_number INTEGER NOT NULL,
    period_label TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    subject_id TEXT REFERENCES public.subjects(id) ON DELETE SET NULL,
    room TEXT DEFAULT 'RV 402',
    session_type TEXT NOT NULL DEFAULT 'lecture',
    span_periods INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.academic_calendar (
    id SERIAL PRIMARY KEY,
    calendar_date DATE NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('working', 'holiday', 'sunday', 'leave', 'special_working', 'exam', 'event')),
    day_order INTEGER CHECK (day_order BETWEEN 1 AND 5),
    working_day_number INTEGER,
    event_name TEXT,
    holiday_reason TEXT,
    notes TEXT
);

-- ------------------------------------------------------------------------
-- PERFORMANCE INDEXES (High frequency lookups & foreign keys)
-- ------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_roll ON public.profiles(roll_number);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_subject_assignments_lookup ON public.subject_assignments(subject_id, manager_id);
CREATE INDEX IF NOT EXISTS idx_sections_subject ON public.sections(subject_id, unit_number);
CREATE INDEX IF NOT EXISTS idx_resources_subject ON public.resources(subject_id, publication_status);
CREATE INDEX IF NOT EXISTS idx_resources_uploader ON public.resources(uploader_id);
CREATE INDEX IF NOT EXISTS idx_assignments_subject ON public.assignments(subject_id, publication_status);
CREATE INDEX IF NOT EXISTS idx_assignments_creator ON public.assignments(creator_id);
CREATE INDEX IF NOT EXISTS idx_submissions_lookup ON public.submissions(assignment_id, student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON public.submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_moderation_target ON public.moderation_records(target_user_id);
CREATE INDEX IF NOT EXISTS idx_ban_restrictions_pair ON public.ban_restrictions(manager_id, student_id);
CREATE INDEX IF NOT EXISTS idx_ban_requests_manager ON public.ban_requests(manager_id, status);
CREATE INDEX IF NOT EXISTS idx_notices_status ON public.notices(publication_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON public.audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_outbox_status ON public.integration_outbox(status);
CREATE INDEX IF NOT EXISTS idx_timetable_day_order ON public.timetable_periods(day_order);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON public.academic_calendar(calendar_date);

-- ------------------------------------------------------------------------
-- SEED DATA: Exactly 7 Official First-Semester Subjects
-- ------------------------------------------------------------------------
INSERT INTO public.subjects (id, code, name, icon, order_index, is_active, subject_code, subject_name) VALUES
('sub_graphics', '24ES102A', 'Engineering Graphics', '📐', 1, true, '24ES102A', 'Engineering Graphics'),
('sub_physics', '24PH101A', 'Engineering Physics', '⚡', 2, true, '24PH101A', 'Engineering Physics'),
('sub_chemistry', '24CH101A', 'Engineering Chemistry', '🧪', 3, true, '24CH101A', 'Engineering Chemistry'),
('sub_mathematics', '24MA101A', 'Engineering Mathematics I', '📊', 4, true, '24MA101A', 'Engineering Mathematics I'),
('sub_tamil', '24TA101A', 'Heritage of Tamils', '🏛️', 5, true, '24TA101A', 'Heritage of Tamils'),
('sub_english', '24EN101A', 'Professional English', '📖', 6, true, '24EN101A', 'Professional English'),
('sub_python', '24ES101A', 'Problem Solving and Python Programming', '🐍', 7, true, '24ES101A', 'Problem Solving and Python Programming')
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    order_index = EXCLUDED.order_index,
    is_active = EXCLUDED.is_active,
    subject_code = EXCLUDED.subject_code,
    subject_name = EXCLUDED.subject_name;

-- ------------------------------------------------------------------------
-- HELPER FUNCTION: Current User Role (SECURITY DEFINER)
-- Eliminates RLS policy recursion on public.profiles table
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------------
-- ROLE HIERARCHY & SELF-ELEVATION SECURITY TRIGGER
-- Enforces: Administrator -> Representative -> Manager -> Student
-- Strictly blocks users from altering their own role.
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_profile_role_elevation()
RETURNS trigger AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        -- Allow backend serverless service_role to manage verified role changes
        IF current_user = 'service_role' OR current_setting('role', true) = 'service_role' THEN
            RETURN NEW;
        END IF;

        -- Self-elevation is strictly prohibited
        IF auth.uid() = OLD.id THEN
            RAISE EXCEPTION 'Security Violation: Users cannot elevate their own role.';
        END IF;

        -- Only Administrator or Representative can change roles
        IF public.current_user_role() NOT IN ('admin', 'representative') THEN
            RAISE EXCEPTION 'Security Violation: Insufficient privileges to alter user roles.';
        END IF;

        -- Representatives cannot promote to Admin or alter Administrator / Representative accounts
        IF public.current_user_role() = 'representative' THEN
            IF NEW.role = 'admin' OR OLD.role IN ('admin', 'representative') THEN
                RAISE EXCEPTION 'Security Violation: Representatives cannot assign admin role or modify administrative accounts.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_role_elevation ON public.profiles;
CREATE TRIGGER trg_prevent_role_elevation
    BEFORE UPDATE OF role ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_profile_role_elevation();

-- ------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) ACTIVATION
-- ------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ban_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ban_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_calendar ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------
-- RLS POLICIES (Idempotent: Drop-before-create)
-- ------------------------------------------------------------------------

-- 1. PROFILES
DROP POLICY IF EXISTS "Public read active profiles" ON public.profiles;
CREATE POLICY "Public read active profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile name and roll" ON public.profiles;
CREATE POLICY "Users can update own profile name and roll" ON public.profiles
FOR UPDATE USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id AND
    role = public.current_user_role()
);

DROP POLICY IF EXISTS "Admins and Reps can update profiles" ON public.profiles;
CREATE POLICY "Admins and Reps can update profiles" ON public.profiles
FOR UPDATE USING (
    public.current_user_role() IN ('admin', 'representative')
);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT WITH CHECK (
    auth.uid() = id AND
    role = 'student'
);

DROP POLICY IF EXISTS "Admins can insert any profile" ON public.profiles;
CREATE POLICY "Admins can insert any profile" ON public.profiles
FOR INSERT WITH CHECK (
    public.current_user_role() IN ('admin', 'representative')
);

-- 2. SUBJECTS & SECTIONS
DROP POLICY IF EXISTS "Public read subjects" ON public.subjects;
CREATE POLICY "Public read subjects" ON public.subjects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read sections" ON public.sections;
CREATE POLICY "Public read sections" ON public.sections FOR SELECT USING (true);

-- 3. SUBJECT ASSIGNMENTS
DROP POLICY IF EXISTS "Public read subject assignments" ON public.subject_assignments;
CREATE POLICY "Public read subject assignments" ON public.subject_assignments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins and Reps manage subject assignments" ON public.subject_assignments;
CREATE POLICY "Admins and Reps manage subject assignments" ON public.subject_assignments
FOR ALL USING (
    public.current_user_role() IN ('admin', 'representative')
);

-- 4. RESOURCES
DROP POLICY IF EXISTS "Students see published resources" ON public.resources;
CREATE POLICY "Students see published resources" ON public.resources FOR SELECT USING (
    publication_status = 'published' OR 
    auth.uid() = uploader_id OR
    public.current_user_role() IN ('admin', 'representative')
);

DROP POLICY IF EXISTS "Staff can insert resources" ON public.resources;
CREATE POLICY "Staff can insert resources" ON public.resources FOR INSERT WITH CHECK (
    auth.uid() = uploader_id AND
    public.current_user_role() IN ('admin', 'representative', 'manager')
);

DROP POLICY IF EXISTS "Staff can update own resources or admins" ON public.resources;
CREATE POLICY "Staff can update own resources or admins" ON public.resources FOR UPDATE USING (
    auth.uid() = uploader_id OR
    public.current_user_role() IN ('admin', 'representative')
);

DROP POLICY IF EXISTS "Staff can delete own resources or admins" ON public.resources;
CREATE POLICY "Staff can delete own resources or admins" ON public.resources FOR DELETE USING (
    auth.uid() = uploader_id OR
    public.current_user_role() IN ('admin', 'representative')
);

-- 5. ASSIGNMENTS
DROP POLICY IF EXISTS "Students see published assignments" ON public.assignments;
CREATE POLICY "Students see published assignments" ON public.assignments FOR SELECT USING (
    publication_status = 'published' OR 
    auth.uid() = creator_id OR
    public.current_user_role() IN ('admin', 'representative')
);

DROP POLICY IF EXISTS "Staff can insert assignments" ON public.assignments;
CREATE POLICY "Staff can insert assignments" ON public.assignments FOR INSERT WITH CHECK (
    auth.uid() = creator_id AND
    public.current_user_role() IN ('admin', 'representative', 'manager')
);

DROP POLICY IF EXISTS "Staff can update assignments" ON public.assignments;
CREATE POLICY "Staff can update assignments" ON public.assignments FOR UPDATE USING (
    auth.uid() = creator_id OR
    public.current_user_role() IN ('admin', 'representative')
);

-- 6. SUBMISSIONS (Strict IDOR Protection)
-- Operator compatibility: student_id is UUID, sa.manager_id is UUID, auth.uid() is UUID
DROP POLICY IF EXISTS "Students see own submissions only" ON public.submissions;
CREATE POLICY "Students see own submissions only" ON public.submissions FOR SELECT USING (
    auth.uid() = student_id OR
    public.current_user_role() IN ('admin', 'representative') OR
    EXISTS (
        SELECT 1 FROM public.subject_assignments sa
        JOIN public.assignments a ON a.subject_id = sa.subject_id
        WHERE a.id = submissions.assignment_id AND sa.manager_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Students can insert own submissions" ON public.submissions;
CREATE POLICY "Students can insert own submissions" ON public.submissions FOR INSERT WITH CHECK (
    auth.uid() = student_id
);

DROP POLICY IF EXISTS "Students can update own submissions" ON public.submissions;
CREATE POLICY "Students can update own submissions" ON public.submissions FOR UPDATE USING (
    auth.uid() = student_id
);

-- 7. MODERATION RECORDS
DROP POLICY IF EXISTS "Admins and Reps view moderation records" ON public.moderation_records;
CREATE POLICY "Admins and Reps view moderation records" ON public.moderation_records FOR SELECT USING (
    public.current_user_role() IN ('admin', 'representative')
);

-- 8. BAN RESTRICTIONS & REQUESTS
DROP POLICY IF EXISTS "Staff can view ban restrictions" ON public.ban_restrictions;
CREATE POLICY "Staff can view ban restrictions" ON public.ban_restrictions FOR SELECT USING (
    auth.uid() = manager_id OR
    public.current_user_role() IN ('admin', 'representative')
);

DROP POLICY IF EXISTS "Staff can view ban requests" ON public.ban_requests;
CREATE POLICY "Staff can view ban requests" ON public.ban_requests FOR SELECT USING (
    auth.uid() = manager_id OR
    public.current_user_role() IN ('admin', 'representative')
);

-- 9. NOTICES
DROP POLICY IF EXISTS "Public read published notices" ON public.notices;
CREATE POLICY "Public read published notices" ON public.notices FOR SELECT USING (
    publication_status = 'published' OR
    public.current_user_role() IN ('admin', 'representative')
);

DROP POLICY IF EXISTS "Staff can insert notices" ON public.notices;
CREATE POLICY "Staff can insert notices" ON public.notices FOR INSERT WITH CHECK (
    auth.uid() = author_id AND
    public.current_user_role() IN ('admin', 'representative')
);

-- 10. NOTIFICATIONS
DROP POLICY IF EXISTS "Users see own notifications only" ON public.notifications;
CREATE POLICY "Users see own notifications only" ON public.notifications FOR SELECT USING (
    auth.uid() = recipient_user_id
);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (
    auth.uid() = recipient_user_id
);

-- 11. AUDIT EVENTS
DROP POLICY IF EXISTS "Admins can view audit events" ON public.audit_events;
CREATE POLICY "Admins can view audit events" ON public.audit_events FOR SELECT USING (
    public.current_user_role() = 'admin'
);

-- 12. INTEGRATION OUTBOX
DROP POLICY IF EXISTS "Admins can manage integration outbox" ON public.integration_outbox;
CREATE POLICY "Admins can manage integration outbox" ON public.integration_outbox FOR ALL USING (
    public.current_user_role() = 'admin'
);

-- 13. TIMETABLE COEXISTENCE RLS POLICIES
DROP POLICY IF EXISTS "Public can view app settings" ON public.app_settings;
CREATE POLICY "Public can view app settings" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view timetable periods" ON public.timetable_periods;
CREATE POLICY "Public can view timetable periods" ON public.timetable_periods FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view academic calendar" ON public.academic_calendar;
CREATE POLICY "Public can view academic calendar" ON public.academic_calendar FOR SELECT USING (true);
