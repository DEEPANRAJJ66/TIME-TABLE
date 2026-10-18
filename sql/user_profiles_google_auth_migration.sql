-- ==============================================================================
-- Migration: Google Authentication, First-Time Registration & Persistent Profiles
-- Target Table: public.learning_user_profiles
-- ==============================================================================

-- 1. Add additive columns to support first/secondary name, roll number, and last login
ALTER TABLE public.learning_user_profiles 
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS secondary_name TEXT,
    ADD COLUMN IF NOT EXISTS roll_number VARCHAR(6),
    ADD COLUMN IF NOT EXISTS google_sub TEXT,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- 2. Validate roll_number constraint (must be exactly 6 digits if provided)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_learning_user_profiles_roll_number_format'
    ) THEN
        ALTER TABLE public.learning_user_profiles
            ADD CONSTRAINT chk_learning_user_profiles_roll_number_format 
            CHECK (roll_number IS NULL OR roll_number ~ '^[0-9]{6}$');
    END IF;
END $$;

-- 3. Enforce roll_number uniqueness across registered students
CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_user_profiles_roll_number_unique
    ON public.learning_user_profiles (roll_number)
    WHERE roll_number IS NOT NULL AND roll_number != '';

-- 4. Unique index on auth_provider_id / google_sub
CREATE INDEX IF NOT EXISTS idx_learning_user_profiles_auth_provider_id
    ON public.learning_user_profiles (auth_provider_id);

CREATE INDEX IF NOT EXISTS idx_learning_user_profiles_google_sub
    ON public.learning_user_profiles (google_sub);

-- 5. Helper function & trigger to keep display_name synchronized
CREATE OR REPLACE FUNCTION public.fn_sync_learning_user_display_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.first_name IS NOT NULL AND NEW.first_name != '' THEN
        IF NEW.secondary_name IS NOT NULL AND NEW.secondary_name != '' THEN
            NEW.display_name := TRIM(NEW.first_name) || ' ' || TRIM(NEW.secondary_name);
        ELSE
            NEW.display_name := TRIM(NEW.first_name);
        END IF;
    END IF;
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_learning_user_display_name ON public.learning_user_profiles;
CREATE TRIGGER trg_sync_learning_user_display_name
    BEFORE INSERT OR UPDATE OF first_name, secondary_name ON public.learning_user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_learning_user_display_name();

-- 6. Row-Level Security (RLS) Policies
ALTER TABLE public.learning_user_profiles ENABLE ROW LEVEL SECURITY;

-- 6a. Authenticated user can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON public.learning_user_profiles;
CREATE POLICY "Users can read own profile"
    ON public.learning_user_profiles
    FOR SELECT
    USING (
        auth.uid()::text = auth_provider_id 
        OR auth.jwt() ->> 'email' = email
    );

-- 6b. Administrators can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.learning_user_profiles;
CREATE POLICY "Admins can view all profiles"
    ON public.learning_user_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.learning_user_profiles admin_p
            WHERE (admin_p.auth_provider_id = auth.uid()::text OR admin_p.email = auth.jwt() ->> 'email')
              AND admin_p.role = 'admin'
              AND admin_p.account_status = 'active'
        )
    );

-- 6c. Users can update only their own name and roll_number (cannot escalate role or status)
DROP POLICY IF EXISTS "Users can update own name and roll_number" ON public.learning_user_profiles;
CREATE POLICY "Users can update own name and roll_number"
    ON public.learning_user_profiles
    FOR UPDATE
    USING (
        auth.uid()::text = auth_provider_id 
        OR auth.jwt() ->> 'email' = email
    )
    WITH CHECK (
        (auth.uid()::text = auth_provider_id OR auth.jwt() ->> 'email' = email)
        AND role = (SELECT p.role FROM public.learning_user_profiles p WHERE p.id = learning_user_profiles.id)
        AND account_status = (SELECT p.account_status FROM public.learning_user_profiles p WHERE p.id = learning_user_profiles.id)
    );

-- 6d. Administrators can update any profile (e.g. role, account_status)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.learning_user_profiles;
CREATE POLICY "Admins can update any profile"
    ON public.learning_user_profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.learning_user_profiles admin_p
            WHERE (admin_p.auth_provider_id = auth.uid()::text OR admin_p.email = auth.jwt() ->> 'email')
              AND admin_p.role = 'admin'
              AND admin_p.account_status = 'active'
        )
    );
