-- ========================================================================
-- College Learning Resource Platform - Complete Setup Script
-- Institution: Saranathan College of Engineering (Autonomous)
-- Namespace: learning_* (Safely coexists with timetable schema)
-- Run this script in the Supabase SQL Editor to provision all tables.
-- ========================================================================

\ir learning_platform_schema.sql
\ir learning_platform_seed.sql

-- Helper function: Secure Admin Account Provisioning
CREATE OR REPLACE FUNCTION public.learning_provision_admin_account(
    p_email TEXT,
    p_display_name TEXT DEFAULT 'System Administrator'
)
RETURNS TEXT AS $$
DECLARE
    v_user_id TEXT;
BEGIN
    INSERT INTO public.learning_user_profiles (email, display_name, role, account_status)
    VALUES (LOWER(TRIM(p_email)), p_display_name, 'admin', 'active')
    ON CONFLICT (email) DO UPDATE SET
        role = 'admin',
        account_status = 'active',
        updated_at = now()
    RETURNING id INTO v_user_id;

    -- Log admin provisioning in audit log
    INSERT INTO public.learning_audit_logs (actor_email, action, metadata)
    VALUES (p_email, 'ASSIGN_ADMIN_ROLE', jsonb_build_object('user_id', v_user_id, 'email', p_email));

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification query
SELECT 'Learning Platform successfully provisioned!' AS status,
       (SELECT COUNT(*) FROM public.learning_categories) AS active_categories,
       (SELECT COUNT(*) FROM public.learning_subjects) AS active_subjects;
