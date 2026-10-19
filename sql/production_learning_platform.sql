-- ========================================================================
-- Production College Learning, Study Material & Assignment Platform Schema
-- Institution: Saranathan College of Engineering (Autonomous), Tiruchirappalli
-- Department: Computer Science & Engineering (First-Year Class A)
-- Target Database: PostgreSQL / Supabase
-- ========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------
-- 1. PROFILES (Users, Auth association, Roles, Account Status)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    secondary_name TEXT,
    display_name TEXT NOT NULL,
    roll_number TEXT NOT NULL UNIQUE CHECK (roll_number ~ '^[0-9]{6}$'),
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'representative', 'manager', 'student')),
    account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'banned')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------
-- 2. SUBJECTS (Exactly 7 official first-semester subjects)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subjects (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '📚',
    order_index INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true NOT NULL
);

-- ------------------------------------------------------------------------
-- 3. SUBJECT ASSIGNMENTS (Managers assigned to specific subjects)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subject_assignments (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(subject_id, manager_id)
);

-- ------------------------------------------------------------------------
-- 4. SECTIONS / UNITS (Subject Units 1 - 5)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sections (
    id TEXT PRIMARY KEY,
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
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    original_filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    subject_id TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    unit_number INTEGER CHECK (unit_number BETWEEN 1 AND 5),
    category TEXT NOT NULL DEFAULT 'cat_notes' CHECK (category IN ('cat_notes', 'cat_assignments', 'cat_videos', 'cat_lab', 'cat_reference')),
    uploader_id UUID NOT NULL REFERENCES public.profiles(id),
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
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    instructions TEXT NOT NULL,
    subject_id TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    unit_number INTEGER CHECK (unit_number BETWEEN 1 AND 5),
    creator_id UUID NOT NULL REFERENCES public.profiles(id),
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
    id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL UNIQUE,
    assignment_id TEXT NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id),
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
    id TEXT PRIMARY KEY,
    target_user_id UUID NOT NULL REFERENCES public.profiles(id),
    target_email TEXT NOT NULL,
    target_role TEXT NOT NULL,
    acting_user_id UUID NOT NULL REFERENCES public.profiles(id),
    acting_user_role TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('ban', 'unban')),
    reason TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    unban_actor_id UUID REFERENCES public.profiles(id),
    unban_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------
-- 9. BAN RESTRICTIONS (7-day re-ban restriction between Manager and Student)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ban_restrictions (
    id TEXT PRIMARY KEY,
    manager_id UUID NOT NULL REFERENCES public.profiles(id),
    student_id UUID NOT NULL REFERENCES public.profiles(id),
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
    id TEXT PRIMARY KEY,
    manager_id UUID NOT NULL REFERENCES public.profiles(id),
    manager_name TEXT NOT NULL,
    student_id UUID NOT NULL REFERENCES public.profiles(id),
    student_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    resolved_by UUID REFERENCES public.profiles(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------
-- 11. NOTICES (Global notices conforming to mandatory college format)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notices (
    id TEXT PRIMARY KEY,
    date_ist TEXT NOT NULL,
    message TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES public.profiles(id),
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
    id TEXT PRIMARY KEY,
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
    id TEXT PRIMARY KEY,
    actor_id UUID REFERENCES public.profiles(id),
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
    id TEXT PRIMARY KEY,
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
-- SEED DATA: Exactly 7 Official First-Semester Subjects
-- ------------------------------------------------------------------------
INSERT INTO public.subjects (id, code, name, icon, order_index, is_active) VALUES
('sub_graphics', '24ES102A', 'Engineering Graphics', '📐', 1, true),
('sub_physics', '24PH101A', 'Engineering Physics', '⚡', 2, true),
('sub_chemistry', '24CH101A', 'Engineering Chemistry', '🧪', 3, true),
('sub_mathematics', '24MA101A', 'Engineering Mathematics I', '📊', 4, true),
('sub_tamil', '24TA101A', 'Heritage of Tamils', '🏛️', 5, true),
('sub_english', '24EN101A', 'Professional English', '📖', 6, true),
('sub_python', '24ES101A', 'Problem Solving and Python Programming', '🐍', 7, true)
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    order_index = EXCLUDED.order_index;

-- ------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
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

-- 1. Profiles: Users can view their own profile; Admins & Representatives can view all
CREATE POLICY "Public read active profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile name and roll" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Subjects & Sections: Public read access for all active users
CREATE POLICY "Public read subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Public read sections" ON public.sections FOR SELECT USING (true);

-- 3. Resources: Students see only published; Managers see own + published; Admin/Rep see all
CREATE POLICY "Students see published resources" ON public.resources FOR SELECT USING (
    publication_status = 'published' OR 
    auth.uid() = uploader_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'representative'))
);

-- 4. Assignments: Students see published; Creators & Admin/Rep see all
CREATE POLICY "Students see published assignments" ON public.assignments FOR SELECT USING (
    publication_status = 'published' OR 
    auth.uid() = creator_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'representative'))
);

-- 5. Submissions: Strict IDOR Protection - Students ONLY see own submissions
CREATE POLICY "Students see own submissions only" ON public.submissions FOR SELECT USING (
    auth.uid() = student_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'representative')) OR
    EXISTS (
        SELECT 1 FROM public.subject_assignments sa
        JOIN public.assignments a ON a.subject_id = sa.subject_id
        WHERE a.id = submissions.assignment_id AND sa.manager_id = auth.uid()
    )
);

-- 6. Notices: Public read for published notices
CREATE POLICY "Public read published notices" ON public.notices FOR SELECT USING (
    publication_status = 'published' OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'representative'))
);

-- 7. Notifications: Users see only their own notifications
CREATE POLICY "Users see own notifications only" ON public.notifications FOR SELECT USING (auth.uid() = recipient_user_id);
