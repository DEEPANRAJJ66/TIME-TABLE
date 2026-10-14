-- ========================================================================
-- Additive Database Migration: Resource Metadata & Telegram Captions
-- Institution: Saranathan College of Engineering (Autonomous)
-- Namespace: learning_resources
-- IMPORTANT: Purely additive. Preserves all existing tables and data.
-- Does NOT modify timetable tables or existing schema constraints.
-- ========================================================================

-- 1. Add specific unit, topic, owner details and caption persistence columns
ALTER TABLE public.learning_resources
    ADD COLUMN IF NOT EXISTS unit TEXT,
    ADD COLUMN IF NOT EXISTS topic TEXT,
    ADD COLUMN IF NOT EXISTS owner_name TEXT,
    ADD COLUMN IF NOT EXISTS owner_email TEXT,
    ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS telegram_caption TEXT;

-- 2. Performance indexes for metadata lookups
CREATE INDEX IF NOT EXISTS idx_lr_owner_email ON public.learning_resources(owner_email);
CREATE INDEX IF NOT EXISTS idx_lr_uploaded_at ON public.learning_resources(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_lr_unit ON public.learning_resources(unit);
CREATE INDEX IF NOT EXISTS idx_lr_topic ON public.learning_resources(topic);

-- 3. Comments explaining columns
COMMENT ON COLUMN public.learning_resources.unit IS 'Unit or chapter number and name (e.g. Unit 2: Control Flow)';
COMMENT ON COLUMN public.learning_resources.topic IS 'Specific lecture or discussion topic (e.g. Nested Loops & Trace Tables)';
COMMENT ON COLUMN public.learning_resources.owner_name IS 'Full display name of authenticated uploader/manager';
COMMENT ON COLUMN public.learning_resources.owner_email IS 'Authenticated Gmail/email address of the manager';
COMMENT ON COLUMN public.learning_resources.uploaded_at IS 'Explicit timestamp of file transmission to Telegram repository';
COMMENT ON COLUMN public.learning_resources.telegram_caption IS 'Complete formatted caption dispatched with the Telegram document';
