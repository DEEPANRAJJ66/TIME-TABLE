-- ========================================================================
-- Additive Database Migration: Google Drive Storage + Telegram Audit Outbox
-- Institution: Saranathan College of Engineering (Autonomous)
-- Namespace: learning_* (Completely isolated from timetable schema)
-- IMPORTANT: Purely additive. Preserves all existing tables, views, and data.
-- Does NOT touch app_settings, subjects, timetable_periods, or academic_calendar.
-- ========================================================================

-- 1. Add Google Drive & Telegram Audit tracking columns to learning_resources
ALTER TABLE public.learning_resources
    ADD COLUMN IF NOT EXISTS google_drive_file_id TEXT,
    ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT,
    ADD COLUMN IF NOT EXISTS google_drive_status TEXT DEFAULT 'VERIFIED',
    ADD COLUMN IF NOT EXISTS telegram_audit_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS telegram_audit_message_id BIGINT,
    ADD COLUMN IF NOT EXISTS telegram_audit_retries INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS telegram_audit_error TEXT;

-- 2. Indexes for fast lookups on Google Drive and Telegram audit fields
CREATE INDEX IF NOT EXISTS idx_lr_google_drive_file_id ON public.learning_resources(google_drive_file_id);
CREATE INDEX IF NOT EXISTS idx_lr_google_drive_folder ON public.learning_resources(google_drive_folder_id);
CREATE INDEX IF NOT EXISTS idx_lr_telegram_audit_status ON public.learning_resources(telegram_audit_status);

-- 3. Create Durable Telegram Audit Outbox Table for Asynchronous Delivery & Retries
CREATE TABLE IF NOT EXISTS public.learning_telegram_outbox (
    id BIGSERIAL PRIMARY KEY,
    resource_id TEXT REFERENCES public.learning_resources(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'UPLOAD_INITIATED',
        'UPLOAD_SUCCEEDED',
        'UPLOAD_FAILED',
        'RESOURCE_UPLOAD_RECORD',
        'RESOURCE_PUBLISHED',
        'RESOURCE_UNPUBLISHED',
        'RESOURCE_EDITED',
        'RESOURCE_ARCHIVED',
        'RESOURCE_DELETED'
    )),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'retrying')) DEFAULT 'pending',
    retry_count INT NOT NULL DEFAULT 0,
    telegram_message_id BIGINT,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_lr_outbox_status ON public.learning_telegram_outbox(status);
CREATE INDEX IF NOT EXISTS idx_lr_outbox_resource_id ON public.learning_telegram_outbox(resource_id);
CREATE INDEX IF NOT EXISTS idx_lr_outbox_created_at ON public.learning_telegram_outbox(created_at DESC);

-- Enable RLS on outbox table
ALTER TABLE public.learning_telegram_outbox ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Telegram Outbox
-- Only Admins and server-side service role can inspect and manage the outbox
DROP POLICY IF EXISTS "Admins can view all telegram outbox events" ON public.learning_telegram_outbox;
CREATE POLICY "Admins can view all telegram outbox events"
    ON public.learning_telegram_outbox
    FOR ALL
    TO authenticated
    USING (public.learning_get_user_role() = 'admin')
    WITH CHECK (public.learning_get_user_role() = 'admin');

-- 5. Seed default Google Drive Approved Folder ID in learning_platform_settings
INSERT INTO public.learning_platform_settings (key, value, description)
VALUES 
    ('google_drive_approved_folder_id', '"1_Approved_College_Learning_Resources_Root"'::jsonb, 'Approved Google Drive root folder ID for learning resources'),
    ('google_drive_oauth_scope', '"https://www.googleapis.com/auth/drive.file"'::jsonb, 'Least-privilege Google Drive OAuth scope')
ON CONFLICT (key) DO UPDATE
SET updated_at = timezone('utc'::text, now());

-- 6. Comments explaining architectural design
COMMENT ON COLUMN public.learning_resources.google_drive_file_id IS 'Authoritative Google Drive file ID holding the physical file bytes';
COMMENT ON COLUMN public.learning_resources.google_drive_folder_id IS 'ID of the approved dedicated folder in Google Drive';
COMMENT ON COLUMN public.learning_resources.google_drive_status IS 'Drive file verification status (VERIFIED, PENDING, REJECTED)';
COMMENT ON COLUMN public.learning_resources.telegram_audit_status IS 'Status of the human-readable audit record in Telegram (pending, sent, failed, retrying)';
COMMENT ON TABLE public.learning_telegram_outbox IS 'Durable outbox for Telegram audit notifications; survives temporary Telegram API outages';

-- 7. Provision Authorized Administrator Account
INSERT INTO public.learning_user_profiles (email, display_name, role, account_status)
VALUES
    ('jeyaramandeeban@gmail.com', 'Deepanraj J (Administrator)', 'admin', 'active')
ON CONFLICT (email) DO UPDATE SET
    role = 'admin',
    account_status = 'active',
    updated_at = now();

