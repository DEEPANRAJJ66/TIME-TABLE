-- ========================================================================
-- College Learning Resource Platform - Database Schema
-- Institution: Saranathan College of Engineering (Autonomous)
-- Namespace: learning_* (Completely isolated from timetable schema)
-- ========================================================================

-- Enable pgcrypto for UUIDs if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Learning Platform User Profiles
CREATE TABLE IF NOT EXISTS public.learning_user_profiles (
    id TEXT PRIMARY KEY DEFAULT ('usr_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    auth_provider_id TEXT UNIQUE, -- Supabase Auth UUID or Google Subject ID
    email TEXT NOT NULL UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'student')) DEFAULT 'student',
    account_status TEXT NOT NULL CHECK (account_status IN ('active', 'pending_approval', 'suspended', 'revoked')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Dynamic Learning Resource Categories
CREATE TABLE IF NOT EXISTS public.learning_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT DEFAULT '📚',
    sort_order INTEGER DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('active', 'archived', 'disabled')) DEFAULT 'active',
    created_by TEXT REFERENCES public.learning_user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Subjects & Semester Organization
CREATE TABLE IF NOT EXISTS public.learning_subjects (
    id TEXT PRIMARY KEY,
    subject_code TEXT NOT NULL UNIQUE,
    subject_name TEXT NOT NULL,
    semester TEXT NOT NULL DEFAULT 'I',
    department TEXT NOT NULL DEFAULT 'Computer Science and Engineering',
    faculty_name TEXT,
    color_accent TEXT DEFAULT '#3b82f6',
    status TEXT NOT NULL CHECK (status IN ('active', 'archived')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Learning Resources Registry
CREATE TABLE IF NOT EXISTS public.learning_resources (
    id TEXT PRIMARY KEY DEFAULT ('res_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    title TEXT NOT NULL,
    description TEXT,
    category_id TEXT NOT NULL REFERENCES public.learning_categories(id) ON DELETE RESTRICT,
    subject_id TEXT REFERENCES public.learning_subjects(id) ON DELETE SET NULL,
    semester TEXT DEFAULT 'I',
    academic_date DATE,
    period_number INTEGER CHECK (period_number BETWEEN 1 AND 8 OR period_number IS NULL),
    unit_or_topic TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    owner_id TEXT NOT NULL REFERENCES public.learning_user_profiles(id) ON DELETE RESTRICT,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('file', 'drive_link', 'video_link')) DEFAULT 'file',
    original_filename TEXT,
    mime_type TEXT,
    file_size BIGINT,
    telegram_chat_id TEXT,
    telegram_message_id BIGINT,
    telegram_file_id TEXT,
    telegram_file_unique_id TEXT,
    google_drive_url TEXT,
    publication_status TEXT NOT NULL CHECK (publication_status IN ('draft', 'published', 'unpublished', 'archived', 'trash')) DEFAULT 'draft',
    upload_status TEXT NOT NULL CHECK (upload_status IN ('pending', 'uploading', 'telegram_success', 'upload_failed')) DEFAULT 'pending',
    error_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE
);

-- 5. Multi-File Attachments (For resources with multiple files)
CREATE TABLE IF NOT EXISTS public.learning_resource_files (
    id TEXT PRIMARY KEY DEFAULT ('fil_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    resource_id TEXT NOT NULL REFERENCES public.learning_resources(id) ON DELETE CASCADE,
    original_filename TEXT NOT NULL,
    mime_type TEXT,
    file_size BIGINT,
    telegram_chat_id TEXT,
    telegram_message_id BIGINT,
    telegram_file_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Independent Learning Platform Academic Calendar
CREATE TABLE IF NOT EXISTS public.learning_academic_calendar (
    id SERIAL PRIMARY KEY,
    calendar_date DATE NOT NULL UNIQUE,
    event_title TEXT NOT NULL,
    event_type TEXT DEFAULT 'academic',
    notes TEXT,
    created_by TEXT REFERENCES public.learning_user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Audit Logs
CREATE TABLE IF NOT EXISTS public.learning_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id TEXT REFERENCES public.learning_user_profiles(id) ON DELETE SET NULL,
    actor_email TEXT,
    action TEXT NOT NULL,
    resource_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Platform Settings
CREATE TABLE IF NOT EXISTS public.learning_platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for high-performance filtering & date lookups
CREATE INDEX IF NOT EXISTS idx_lr_resources_status ON public.learning_resources(publication_status, upload_status);
CREATE INDEX IF NOT EXISTS idx_lr_resources_category ON public.learning_resources(category_id);
CREATE INDEX IF NOT EXISTS idx_lr_resources_subject ON public.learning_resources(subject_id);
CREATE INDEX IF NOT EXISTS idx_lr_resources_owner ON public.learning_resources(owner_id);
CREATE INDEX IF NOT EXISTS idx_lr_resources_academic_date ON public.learning_resources(academic_date);
CREATE INDEX IF NOT EXISTS idx_lr_resources_period ON public.learning_resources(period_number);
CREATE INDEX IF NOT EXISTS idx_lr_resource_files_res ON public.learning_resource_files(resource_id);
CREATE INDEX IF NOT EXISTS idx_lr_calendar_date ON public.learning_academic_calendar(calendar_date);
CREATE INDEX IF NOT EXISTS idx_lr_categories_status ON public.learning_categories(status, sort_order);
CREATE INDEX IF NOT EXISTS idx_lr_audit_created ON public.learning_audit_logs(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.learning_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_resource_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_academic_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_platform_settings ENABLE ROW LEVEL SECURITY;

-- Helper security function: Check current user role
CREATE OR REPLACE FUNCTION public.learning_get_user_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role 
    FROM public.learning_user_profiles 
    WHERE auth_provider_id = auth.uid()::text OR id = auth.uid()::text
    LIMIT 1;
    RETURN COALESCE(v_role, 'student');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS POLICIES

-- User Profiles:
DROP POLICY IF EXISTS "Public can view active profiles" ON public.learning_user_profiles;
CREATE POLICY "Public can view active profiles" ON public.learning_user_profiles
    FOR SELECT USING (account_status = 'active');

DROP POLICY IF EXISTS "Users can update their own profile name" ON public.learning_user_profiles;
CREATE POLICY "Users can update their own profile name" ON public.learning_user_profiles
    FOR UPDATE USING (auth_provider_id = auth.uid()::text OR id = auth.uid()::text);

-- Categories:
DROP POLICY IF EXISTS "Anyone can view active categories" ON public.learning_categories;
CREATE POLICY "Anyone can view active categories" ON public.learning_categories
    FOR SELECT USING (status = 'active' OR public.learning_get_user_role() = 'admin');

-- Subjects:
DROP POLICY IF EXISTS "Anyone can view active subjects" ON public.learning_subjects;
CREATE POLICY "Anyone can view active subjects" ON public.learning_subjects
    FOR SELECT USING (status = 'active' OR public.learning_get_user_role() = 'admin');

-- Resources:
-- 1. Students & Public: Can ONLY read published resources with successful telegram upload
DROP POLICY IF EXISTS "Students can view published resources" ON public.learning_resources;
CREATE POLICY "Students can view published resources" ON public.learning_resources
    FOR SELECT USING (
        publication_status = 'published' AND upload_status = 'telegram_success'
    );

-- 2. Managers: Can read, insert, update their OWN resources (drafts & published)
DROP POLICY IF EXISTS "Managers can manage own resources" ON public.learning_resources;
CREATE POLICY "Managers can manage own resources" ON public.learning_resources
    FOR ALL USING (
        owner_id IN (
            SELECT id FROM public.learning_user_profiles 
            WHERE (auth_provider_id = auth.uid()::text OR id = auth.uid()::text) 
              AND role IN ('manager', 'admin')
        )
    );

-- 3. Admins: Full management of all resources
DROP POLICY IF EXISTS "Admins can manage all resources" ON public.learning_resources;
CREATE POLICY "Admins can manage all resources" ON public.learning_resources
    FOR ALL USING (
        public.learning_get_user_role() = 'admin'
    );

-- Multi-file attachments RLS:
DROP POLICY IF EXISTS "Students view files of published resources" ON public.learning_resource_files;
CREATE POLICY "Students view files of published resources" ON public.learning_resource_files
    FOR SELECT USING (
        resource_id IN (SELECT id FROM public.learning_resources WHERE publication_status = 'published')
    );

-- Learning Calendar RLS:
DROP POLICY IF EXISTS "Anyone can view learning calendar" ON public.learning_academic_calendar;
CREATE POLICY "Anyone can view learning calendar" ON public.learning_academic_calendar
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage learning calendar" ON public.learning_academic_calendar;
CREATE POLICY "Admins can manage learning calendar" ON public.learning_academic_calendar
    FOR ALL USING (public.learning_get_user_role() = 'admin');

-- Audit Logs: Admin-only access
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.learning_audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.learning_audit_logs
    FOR SELECT USING (public.learning_get_user_role() = 'admin');

DROP POLICY IF EXISTS "System can insert audit logs" ON public.learning_audit_logs;
CREATE POLICY "System can insert audit logs" ON public.learning_audit_logs
    FOR INSERT WITH CHECK (true);

-- Settings: Anyone can read settings; only admin can update
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.learning_platform_settings;
CREATE POLICY "Anyone can read platform settings" ON public.learning_platform_settings
    FOR SELECT USING (true);
