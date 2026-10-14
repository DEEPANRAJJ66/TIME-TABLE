-- ==============================================================================
-- SARANATHAN COLLEGE OF ENGINEERING (AUTONOMOUS) — FIRST-YEAR CSE CLASS A
-- LEARNING PLATFORM MASTER ADDITIVE DATABASE MIGRATION
-- ==============================================================================
-- Namespace: learning_* (COMPLETELY ISOLATED from Timetable Schema)
-- INVARIANT: Strictly preserves app_settings, subjects, timetable_periods, academic_calendar.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Learning Platform User Profiles
CREATE TABLE IF NOT EXISTS public.learning_user_profiles (
    id TEXT PRIMARY KEY DEFAULT ('usr_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
    auth_provider_id TEXT UNIQUE, -- Supabase Auth UUID or Google Subject ID
    email TEXT NOT NULL UNIQUE,
    first_name TEXT,
    secondary_name TEXT,
    display_name TEXT,
    roll_number VARCHAR(6) UNIQUE CHECK (roll_number IS NULL OR roll_number ~ '^[0-9]{6}$'),
    avatar_url TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'student')) DEFAULT 'student',
    account_status TEXT NOT NULL CHECK (account_status IN ('active', 'banned', 'suspended', 'revoked')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist if table was already created
ALTER TABLE public.learning_user_profiles
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS secondary_name TEXT,
    ADD COLUMN IF NOT EXISTS roll_number VARCHAR(6);

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

-- 4. Learning Resources Registry (With Google Drive & Telegram Audit Fields)
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
    google_drive_file_id TEXT,
    google_drive_folder_id TEXT DEFAULT '1l-K5elNmYw_THQXCEvucT2BRzNtbKhYi',
    google_drive_status TEXT DEFAULT 'VERIFIED',
    telegram_audit_status TEXT DEFAULT 'pending',
    telegram_audit_message_id BIGINT,
    telegram_audit_retries INT DEFAULT 0,
    telegram_audit_error TEXT,
    publication_status TEXT NOT NULL CHECK (publication_status IN ('draft', 'published', 'unpublished', 'archived', 'trash')) DEFAULT 'draft',
    upload_status TEXT NOT NULL CHECK (upload_status IN ('pending', 'uploading', 'verified', 'telegram_success', 'upload_failed')) DEFAULT 'pending',
    restricted_by_admin BOOLEAN NOT NULL DEFAULT false,
    error_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE
);

-- Ensure additive columns exist on learning_resources
ALTER TABLE public.learning_resources
    ADD COLUMN IF NOT EXISTS google_drive_file_id TEXT,
    ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT DEFAULT '1l-K5elNmYw_THQXCEvucT2BRzNtbKhYi',
    ADD COLUMN IF NOT EXISTS google_drive_status TEXT DEFAULT 'VERIFIED',
    ADD COLUMN IF NOT EXISTS telegram_audit_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS telegram_audit_message_id BIGINT,
    ADD COLUMN IF NOT EXISTS telegram_audit_retries INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS telegram_audit_error TEXT,
    ADD COLUMN IF NOT EXISTS restricted_by_admin BOOLEAN NOT NULL DEFAULT false;

-- 5. Ban Management & Audit
CREATE TABLE IF NOT EXISTS public.learning_bans (
    id BIGSERIAL PRIMARY KEY,
    target_user_id TEXT NOT NULL REFERENCES public.learning_user_profiles(id) ON DELETE CASCADE,
    banned_by_id TEXT NOT NULL REFERENCES public.learning_user_profiles(id) ON DELETE CASCADE,
    actor_role TEXT NOT NULL CHECK (actor_role IN ('admin', 'manager')),
    ban_type TEXT NOT NULL CHECK (ban_type IN ('temporary', 'permanent')),
    reason TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    unbanned_at TIMESTAMP WITH TIME ZONE,
    unbanned_by_id TEXT REFERENCES public.learning_user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Special 72-Hour Restriction Table
CREATE TABLE IF NOT EXISTS public.learning_ban_restrictions_72h (
    id BIGSERIAL PRIMARY KEY,
    student_user_id TEXT NOT NULL REFERENCES public.learning_user_profiles(id) ON DELETE CASCADE,
    unbanned_by_admin_id TEXT NOT NULL REFERENCES public.learning_user_profiles(id) ON DELETE CASCADE,
    original_manager_ban_id BIGINT REFERENCES public.learning_bans(id) ON DELETE SET NULL,
    restriction_starts_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    restriction_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Admin Ban Requests (Submitted by Managers during 72h window)
CREATE TABLE IF NOT EXISTS public.learning_admin_ban_requests (
    id BIGSERIAL PRIMARY KEY,
    manager_id TEXT NOT NULL REFERENCES public.learning_user_profiles(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES public.learning_user_profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    admin_decision_notes TEXT,
    decided_by_id TEXT REFERENCES public.learning_user_profiles(id) ON DELETE SET NULL,
    decided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Durable Telegram Outbox Queue
CREATE TABLE IF NOT EXISTS public.learning_telegram_outbox (
    id BIGSERIAL PRIMARY KEY,
    resource_id TEXT REFERENCES public.learning_resources(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'retrying')) DEFAULT 'pending',
    retry_count INT NOT NULL DEFAULT 0,
    telegram_message_id BIGINT,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE
);

-- 9. Platform-wide Immutable Audit Logs
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

-- 10. Platform Settings
CREATE TABLE IF NOT EXISTS public.learning_platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed initial settings
INSERT INTO public.learning_platform_settings (key, value, description)
VALUES 
    ('google_drive_approved_folder_id', '"1l-K5elNmYw_THQXCEvucT2BRzNtbKhYi"'::jsonb, 'Approved root folder in owner personal 5TB Google Drive'),
    ('google_drive_oauth_scope', '"https://www.googleapis.com/auth/drive.file"'::jsonb, 'Least-privilege OAuth scope for Google Drive'),
    ('max_upload_size_bytes', '524288000'::jsonb, 'Maximum upload size: 500 MB in bytes'),
    ('publishing_policy', '"immediate"'::jsonb, 'Option A: Managers publish immediately upon Drive verification')
ON CONFLICT (key) DO UPDATE
SET updated_at = timezone('utc'::text, now());

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_lr_resources_status ON public.learning_resources(publication_status, upload_status);
CREATE INDEX IF NOT EXISTS idx_lr_resources_category ON public.learning_resources(category_id);
CREATE INDEX IF NOT EXISTS idx_lr_resources_subject ON public.learning_resources(subject_id);
CREATE INDEX IF NOT EXISTS idx_lr_resources_owner ON public.learning_resources(owner_id);
CREATE INDEX IF NOT EXISTS idx_lr_resources_academic_date ON public.learning_resources(academic_date);
CREATE INDEX IF NOT EXISTS idx_lr_gdrv_file ON public.learning_resources(google_drive_file_id);
CREATE INDEX IF NOT EXISTS idx_lr_bans_target ON public.learning_bans(target_user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_lr_bans_72h ON public.learning_ban_restrictions_72h(student_user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_lr_outbox_status ON public.learning_telegram_outbox(status);
CREATE INDEX IF NOT EXISTS idx_lr_audit_created ON public.learning_audit_logs(created_at DESC);

-- Enable Row Level Security (RLS) on all learning tables
ALTER TABLE public.learning_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_ban_restrictions_72h ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_admin_ban_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_telegram_outbox ENABLE ROW LEVEL SECURITY;
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

-- User Profiles: Anyone authenticated can see active user profiles
DROP POLICY IF EXISTS "Active profiles visible" ON public.learning_user_profiles;
CREATE POLICY "Active profiles visible" ON public.learning_user_profiles
    FOR SELECT TO authenticated USING (account_status = 'active');

DROP POLICY IF EXISTS "Users can update own profile" ON public.learning_user_profiles;
CREATE POLICY "Users can update own profile" ON public.learning_user_profiles
    FOR UPDATE TO authenticated USING (auth_provider_id = auth.uid()::text OR id = auth.uid()::text);

-- Categories & Subjects: Public read
DROP POLICY IF EXISTS "Active categories visible" ON public.learning_categories;
CREATE POLICY "Active categories visible" ON public.learning_categories
    FOR SELECT USING (status = 'active' OR public.learning_get_user_role() = 'admin');

DROP POLICY IF EXISTS "Active subjects visible" ON public.learning_subjects;
CREATE POLICY "Active subjects visible" ON public.learning_subjects
    FOR SELECT USING (status = 'active' OR public.learning_get_user_role() = 'admin');

-- Resources:
-- Students: View published and verified only
DROP POLICY IF EXISTS "Students view published resources" ON public.learning_resources;
CREATE POLICY "Students view published resources" ON public.learning_resources
    FOR SELECT TO authenticated
    USING (publication_status = 'published' AND upload_status IN ('verified', 'telegram_success'));

-- Managers: View published OR own resources (Privacy-preserving Option A: own drafts only)
DROP POLICY IF EXISTS "Managers view own and published resources" ON public.learning_resources;
CREATE POLICY "Managers view own and published resources" ON public.learning_resources
    FOR SELECT TO authenticated
    USING (
        (publication_status = 'published' AND upload_status IN ('verified', 'telegram_success'))
        OR (owner_id IN (
            SELECT id FROM public.learning_user_profiles 
            WHERE (auth_provider_id = auth.uid()::text OR id = auth.uid()::text) 
              AND role IN ('manager', 'admin')
        ))
    );

-- Managers: Update own non-restricted resources
DROP POLICY IF EXISTS "Managers update own non-restricted resources" ON public.learning_resources;
CREATE POLICY "Managers update own non-restricted resources" ON public.learning_resources
    FOR UPDATE TO authenticated
    USING (
        owner_id IN (
            SELECT id FROM public.learning_user_profiles 
            WHERE (auth_provider_id = auth.uid()::text OR id = auth.uid()::text) 
              AND role IN ('manager', 'admin')
        )
        AND restricted_by_admin = false
    );

-- Admins: Full management across all resources
DROP POLICY IF EXISTS "Admins full access to resources" ON public.learning_resources;
CREATE POLICY "Admins full access to resources" ON public.learning_resources
    FOR ALL TO authenticated
    USING (public.learning_get_user_role() = 'admin')
    WITH CHECK (public.learning_get_user_role() = 'admin');

-- Bans: Managers & Admins view bans
DROP POLICY IF EXISTS "Bans visibility" ON public.learning_bans;
CREATE POLICY "Bans visibility" ON public.learning_bans
    FOR SELECT TO authenticated
    USING (
        public.learning_get_user_role() IN ('admin', 'manager')
        OR target_user_id IN (SELECT id FROM public.learning_user_profiles WHERE auth_provider_id = auth.uid()::text)
    );

-- 72h Restrictions: Visible to Managers & Admins
DROP POLICY IF EXISTS "Restrictions 72h visibility" ON public.learning_ban_restrictions_72h;
CREATE POLICY "Restrictions 72h visibility" ON public.learning_ban_restrictions_72h
    FOR SELECT TO authenticated
    USING (public.learning_get_user_role() IN ('admin', 'manager'));

-- Ban Requests: Managers view own requests; Admins view all
DROP POLICY IF EXISTS "Ban requests visibility" ON public.learning_admin_ban_requests;
CREATE POLICY "Ban requests visibility" ON public.learning_admin_ban_requests
    FOR SELECT TO authenticated
    USING (
        public.learning_get_user_role() = 'admin'
        OR manager_id IN (SELECT id FROM public.learning_user_profiles WHERE auth_provider_id = auth.uid()::text)
    );

-- Telegram Outbox: Admin-only
DROP POLICY IF EXISTS "Admins view telegram outbox" ON public.learning_telegram_outbox;
CREATE POLICY "Admins view telegram outbox" ON public.learning_telegram_outbox
    FOR ALL TO authenticated
    USING (public.learning_get_user_role() = 'admin')
    WITH CHECK (public.learning_get_user_role() = 'admin');

-- Audit Logs: Admin-only
DROP POLICY IF EXISTS "Admins view audit logs" ON public.learning_audit_logs;
CREATE POLICY "Admins view audit logs" ON public.learning_audit_logs
    FOR SELECT TO authenticated
    USING (public.learning_get_user_role() = 'admin');

-- Provision Authorized Administrator Account
INSERT INTO public.learning_user_profiles (email, display_name, role, account_status)
VALUES
    ('jeyaramandeeban@gmail.com', 'Deepanraj J (Administrator)', 'admin', 'active')
ON CONFLICT (email) DO UPDATE SET
    role = 'admin',
    account_status = 'active',
    updated_at = now();
