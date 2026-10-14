-- ========================================================================
-- College Learning Resource Platform - Seed Data
-- Institution: Saranathan College of Engineering (Autonomous)
-- Semester I CSE Class A Subjects & Dynamic Categories
-- ========================================================================

-- 1. Insert Initial Dynamic Categories
INSERT INTO public.learning_categories (id, name, description, icon, sort_order, status)
VALUES
    ('cat_class_notes', 'Regular Class Notes', 'Daily handwritten and classroom discussion notes indexed by date and period', '📝', 1, 'active'),
    ('cat_lecture_notes', 'Lecture Notes & PDFs', 'Official faculty presentations, unit notes, and lecture courseware', '📑', 2, 'active'),
    ('cat_recorded_lectures', 'Recorded Lectures', 'Class video recordings, tutorial explanations, and laboratory demos', '🎥', 3, 'active'),
    ('cat_question_papers', 'Question Papers', 'Past semester exams, internal assessment tests (IAT), and model papers', '📄', 4, 'active'),
    ('cat_assignments', 'Assignments', 'Coursework problem sets, assignment questions, and submission guides', '📋', 5, 'active'),
    ('cat_lab_materials', 'Laboratory Materials', 'Lab manuals, experiment sheets, source code, and viva question banks', '🔬', 6, 'active'),
    ('cat_important_questions', 'Important Questions', 'High-priority examination topics, 2-mark and 16-mark curated question banks', '⭐', 7, 'active'),
    ('cat_reference_books', 'Reference Books & Resources', 'Recommended syllabus textbooks, author PDFs, and digital reference material', '📚', 8, 'active'),
    ('cat_circulars', 'College Circulars & Notices', 'Academic schedules, hall ticket notices, club events, and holiday announcements', '📢', 9, 'active')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status;

-- 2. Insert Initial Semester 1 Subjects (Saranathan College of Engineering)
INSERT INTO public.learning_subjects (id, subject_code, subject_name, semester, department, faculty_name, color_accent, status)
VALUES
    ('sub_graphics', '24ES102A', 'Engineering Graphics', 'I', 'Mechanical Engineering / CSE', 'Mr. P. Vigneshwar & Dr. G. Mahesh', '#f59e0b', 'active'),
    ('sub_physics', '24PH101A', 'Engineering Physics I', 'I', 'Physics', 'Dr. M. Murali', '#06b6d4', 'active'),
    ('sub_chemistry', '24CH101A', 'Engineering Chemistry I', 'I', 'Chemistry', 'Dr. G. Thulasi', '#10b981', 'active'),
    ('sub_maths', '24MA101A', 'Engineering Mathematics I', 'I', 'Mathematics', 'Dr. R. Buvaneswari', '#8b5cf6', 'active'),
    ('sub_tamil', '24TA101A', 'Heritage of Tamils', 'I', 'Humanities / Tamil', 'Dr. M. Thangam', '#ec4899', 'active'),
    ('sub_english', '24EN101A', 'Professional English', 'I', 'English', 'Dr. A. Lakshmi', '#3b82f6', 'active'),
    ('sub_python', '24ES101A', 'Problem Solving and Python Programming', 'I', 'Computer Science and Engineering', 'Ms. P. Rohini', '#14b8a6', 'active'),
    ('sub_physics_lab', '24PH111A', 'Physics / Chemistry Laboratory', 'I', 'Science & Humanities', 'Science Faculty Team', '#0284c7', 'active'),
    ('sub_python_lab', '24ES111A', 'Python Programming Laboratory', 'I', 'Computer Science and Engineering', 'Ms. P. Rohini & Mr. L. Parthipan', '#0d9488', 'active'),
    ('sub_comm_lab', '24EM111A', 'Communication Laboratory I', 'I', 'English', 'Dr. A. Lakshmi', '#6366f1', 'active')
ON CONFLICT (id) DO UPDATE SET
    subject_code = EXCLUDED.subject_code,
    subject_name = EXCLUDED.subject_name,
    faculty_name = EXCLUDED.faculty_name,
    color_accent = EXCLUDED.color_accent,
    status = EXCLUDED.status;

-- 3. Initial Platform Settings
INSERT INTO public.learning_platform_settings (key, value, description)
VALUES
    ('telegram_config', '{"channel_id": "-1003598863042", "channel_invite_link": "https://t.me/+6dIBd-yKc75hZGY1", "max_upload_size_mb": 500, "bot_configured": true}'::jsonb, 'Telegram Bot Channel Configuration'),
    ('platform_info', '{"platform_name": "CSE Class A Learning Hub", "institution": "Saranathan College of Engineering", "department": "CSE", "semester": "I", "allow_student_download": true}'::jsonb, 'General Platform Configuration'),
    ('retention_policy', '{"trash_retention_days": 30, "auto_archive_old_semesters": false}'::jsonb, 'Resource Retention and Archiving Policy')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description;

-- 4. Initial Provisioned Administrator & Manager Accounts
INSERT INTO public.learning_user_profiles (email, display_name, role, account_status)
VALUES
    ('jeyaramandeeban@gmail.com', 'Deepanraj J (Administrator)', 'admin', 'active'),
    ('manager.cse@saranathan.ac.in', 'CSE Resource Manager', 'manager', 'active')
ON CONFLICT (email) DO UPDATE SET
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name,
    account_status = EXCLUDED.account_status,
    updated_at = now();

