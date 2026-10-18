// College Learning Resource Platform - Client Data Store & Cache Manager
// Provides 3-Tier Resilience: Remote Supabase/API -> LocalStorage Cache -> Seed Baseline

export const VALID_LIFECYCLE_STATES = ['uploading', 'uploaded', 'upload_failed', 'draft', 'published', 'unpublished', 'archived', 'trash'];

export const VALID_STATE_TRANSITIONS = {
  'uploading': ['upload_failed', 'uploaded', 'draft', 'published'],
  'uploaded': ['draft', 'published', 'archived', 'trash'],
  'upload_failed': ['uploading', 'draft'],
  'draft': ['published', 'archived', 'trash'],
  'published': ['unpublished', 'archived', 'trash'],
  'unpublished': ['published', 'archived', 'trash'],
  'archived': ['published', 'draft', 'trash'],
  'trash': ['draft', 'archived']
};

export function validateGoogleDriveUrl(url) {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'Google Drive URL is required' };
  }
  const trimmed = url.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (e) {
    return { isValid: false, error: 'Invalid URL format' };
  }

  const hostname = parsed.hostname.toLowerCase();
  const validHosts = ['drive.google.com', 'docs.google.com'];
  if (!validHosts.includes(hostname)) {
    return { isValid: false, error: 'URL must be hosted on drive.google.com or docs.google.com' };
  }

  let fileId = null;
  let isFolder = false;

  const fileMatch = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const docsMatch = parsed.pathname.match(/\/(?:document|presentation|spreadsheets|forms)\/d\/([a-zA-Z0-9_-]+)/);
  const folderMatch = parsed.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  const idParam = parsed.searchParams.get('id');

  if (folderMatch) {
    fileId = folderMatch[1];
    isFolder = true;
  } else if (fileMatch) {
    fileId = fileMatch[1];
  } else if (docsMatch) {
    fileId = docsMatch[1];
  } else if (idParam) {
    fileId = idParam;
  }

  if (!fileId && !parsed.pathname.includes('/drive/')) {
    return { isValid: false, error: 'Could not extract Google Drive file or folder ID' };
  }

  const previewUrl = fileId
    ? (isFolder
        ? `https://drive.google.com/embeddedfolderview?id=${fileId}#list`
        : `https://drive.google.com/file/d/${fileId}/preview`)
    : trimmed;

  return {
    isValid: true,
    fileId,
    isFolder,
    previewUrl,
    embedUrl: previewUrl,
    originalUrl: trimmed
  };
}

export const INITIAL_CATEGORIES = [
  {
    id: 'cat_class_notes',
    name: 'Regular Class Notes',
    description: 'Daily handwritten and classroom discussion notes indexed by date and period',
    icon: '📝',
    sort_order: 1,
    status: 'active'
  },
  {
    id: 'cat_lecture_notes',
    name: 'Lecture Notes & PDFs',
    description: 'Official faculty presentations, unit notes, and lecture courseware',
    icon: '📑',
    sort_order: 2,
    status: 'active'
  },
  {
    id: 'cat_recorded_lectures',
    name: 'Recorded Lectures',
    description: 'Class video recordings, tutorial explanations, and laboratory demos',
    icon: '🎥',
    sort_order: 3,
    status: 'active'
  },
  {
    id: 'cat_question_papers',
    name: 'Question Papers',
    description: 'Past semester exams, internal assessment tests (IAT), and model papers',
    icon: '📄',
    sort_order: 4,
    status: 'active'
  },
  {
    id: 'cat_assignments',
    name: 'Assignments',
    description: 'Coursework problem sets, assignment questions, and submission guides',
    icon: '📋',
    sort_order: 5,
    status: 'active'
  },
  {
    id: 'cat_lab_materials',
    name: 'Laboratory Materials',
    description: 'Lab manuals, experiment sheets, source code, and viva question banks',
    icon: '🔬',
    sort_order: 6,
    status: 'active'
  },
  {
    id: 'cat_important_questions',
    name: 'Important Questions',
    description: 'High-priority examination topics, 2-mark and 16-mark curated question banks',
    icon: '⭐',
    sort_order: 7,
    status: 'active'
  },
  {
    id: 'cat_reference_books',
    name: 'Reference Books & Resources',
    description: 'Recommended syllabus textbooks, author PDFs, and digital reference material',
    icon: '📚',
    sort_order: 8,
    status: 'active'
  },
  {
    id: 'cat_circulars',
    name: 'College Circulars & Notices',
    description: 'Academic schedules, hall ticket notices, club events, and holiday announcements',
    icon: '📢',
    sort_order: 9,
    status: 'active'
  }
];

export const INITIAL_SUBJECTS = [
  {
    id: 'sub_graphics',
    code: '24ES102A',
    name: 'Engineering Graphics',
    semester: 'I',
    department: 'Mechanical / CSE',
    faculty: 'Mr. P. Vigneshwar & Dr. G. Mahesh',
    color: '#f59e0b',
    status: 'active'
  },
  {
    id: 'sub_physics',
    code: '24PH101A',
    name: 'Engineering Physics I',
    semester: 'I',
    department: 'Physics',
    faculty: 'Dr. M. Murali',
    color: '#06b6d4',
    status: 'active'
  },
  {
    id: 'sub_chemistry',
    code: '24CH101A',
    name: 'Engineering Chemistry I',
    semester: 'I',
    department: 'Chemistry',
    faculty: 'Dr. G. Thulasi',
    color: '#10b981',
    status: 'active'
  },
  {
    id: 'sub_maths',
    code: '24MA101A',
    name: 'Engineering Mathematics I',
    semester: 'I',
    department: 'Mathematics',
    faculty: 'Dr. R. Buvaneswari',
    color: '#8b5cf6',
    status: 'active'
  },
  {
    id: 'sub_tamil',
    code: '24TA101A',
    name: 'Heritage of Tamils',
    semester: 'I',
    department: 'Humanities / Tamil',
    faculty: 'Dr. M. Thangam',
    color: '#ec4899',
    status: 'active'
  },
  {
    id: 'sub_english',
    code: '24EN101A',
    name: 'Professional English',
    semester: 'I',
    department: 'English',
    faculty: 'Dr. A. Lakshmi',
    color: '#3b82f6',
    status: 'active'
  },
  {
    id: 'sub_python',
    code: '24ES101A',
    name: 'Problem Solving and Python Programming',
    semester: 'I',
    department: 'Computer Science and Engineering',
    faculty: 'Ms. P. Rohini',
    color: '#14b8a6',
    status: 'active'
  }
];

// 7 Subject Separation Folders for Manager, Representative & Admin file organization
export const SYSTEM_SUBJECT_FOLDERS = [
  {
    id: 'fld_sub_graphics',
    name: 'Engineering Graphics (24ES102A)',
    subjectId: 'sub_graphics',
    subjectCode: '24ES102A',
    subjectName: 'Engineering Graphics',
    icon: '🎨',
    color: '#f59e0b',
    department: 'Mechanical / CSE',
    faculty: 'Mr. P. Vigneshwar & Dr. G. Mahesh',
    description: 'Manual drafting sheets, orthographic projections, isometric views & CAD assets',
    isSubjectFolder: true,
    isShared: true,
    ownerRole: 'system',
    ownerEmail: 'system@saranathan.ac.in',
    createdAt: '2026-09-15T00:00:00Z'
  },
  {
    id: 'fld_sub_physics',
    name: 'Engineering Physics I (24PH101A)',
    subjectId: 'sub_physics',
    subjectCode: '24PH101A',
    subjectName: 'Engineering Physics I',
    icon: '⚛️',
    color: '#06b6d4',
    department: 'Physics',
    faculty: 'Dr. M. Murali',
    description: 'Optics, laser physics, quantum mechanics, crystallography & laboratory guides',
    isSubjectFolder: true,
    isShared: true,
    ownerRole: 'system',
    ownerEmail: 'system@saranathan.ac.in',
    createdAt: '2026-09-15T00:00:00Z'
  },
  {
    id: 'fld_sub_chemistry',
    name: 'Engineering Chemistry I (24CH101A)',
    subjectId: 'sub_chemistry',
    subjectCode: '24CH101A',
    subjectName: 'Engineering Chemistry I',
    icon: '🧪',
    color: '#10b981',
    department: 'Chemistry',
    faculty: 'Dr. G. Thulasi',
    description: 'Water treatment, polymer chemistry, electrochemistry & corrosion engineering notes',
    isSubjectFolder: true,
    isShared: true,
    ownerRole: 'system',
    ownerEmail: 'system@saranathan.ac.in',
    createdAt: '2026-09-15T00:00:00Z'
  },
  {
    id: 'fld_sub_maths',
    name: 'Engineering Mathematics I (24MA101A)',
    subjectId: 'sub_maths',
    subjectCode: '24MA101A',
    subjectName: 'Engineering Mathematics I',
    icon: '📐',
    color: '#8b5cf6',
    department: 'Mathematics',
    faculty: 'Dr. R. Buvaneswari',
    description: 'Differential calculus, matrices, eigenvalues, multivariable calculus & tutorial sets',
    isSubjectFolder: true,
    isShared: true,
    ownerRole: 'system',
    ownerEmail: 'system@saranathan.ac.in',
    createdAt: '2026-09-15T00:00:00Z'
  },
  {
    id: 'fld_sub_tamil',
    name: 'Heritage of Tamils (24TA101A)',
    subjectId: 'sub_tamil',
    subjectCode: '24TA101A',
    subjectName: 'Heritage of Tamils',
    icon: '🏛️',
    color: '#ec4899',
    department: 'Humanities / Tamil',
    faculty: 'Dr. M. Thangam',
    description: 'Tamil history, architecture, metallurgy, folk arts, agriculture & cultural heritage',
    isSubjectFolder: true,
    isShared: true,
    ownerRole: 'system',
    ownerEmail: 'system@saranathan.ac.in',
    createdAt: '2026-09-15T00:00:00Z'
  },
  {
    id: 'fld_sub_english',
    name: 'Professional English (24EN101A)',
    subjectId: 'sub_english',
    subjectCode: '24EN101A',
    subjectName: 'Professional English',
    icon: '📖',
    color: '#3b82f6',
    department: 'English',
    faculty: 'Dr. A. Lakshmi',
    description: 'Grammar essentials, technical communication, email writing, presentation & listening drills',
    isSubjectFolder: true,
    isShared: true,
    ownerRole: 'system',
    ownerEmail: 'system@saranathan.ac.in',
    createdAt: '2026-09-15T00:00:00Z'
  },
  {
    id: 'fld_sub_python',
    name: 'Problem Solving and Python Programming (24ES101A)',
    subjectId: 'sub_python',
    subjectCode: '24ES101A',
    subjectName: 'Problem Solving and Python Programming',
    icon: '💻',
    color: '#14b8a6',
    department: 'Computer Science and Engineering',
    faculty: 'Ms. P. Rohini',
    description: 'Algorithms, control flow, functions, lists, tuples, dictionaries, files & lab exercises',
    isSubjectFolder: true,
    isShared: true,
    ownerRole: 'system',
    ownerEmail: 'system@saranathan.ac.in',
    createdAt: '2026-09-15T00:00:00Z'
  }
];

// Baseline seed resources demonstrating multiple materials per period & date
export const INITIAL_RESOURCES = [
  {
    id: 'res_sample_py_p1',
    title: 'Python Period 1: Conditionals & Loops Class Notes',
    description: 'Detailed handwritten class notes on if-elif-else statements, while loops, and range() functions covered during Period 1.',
    categoryId: 'cat_class_notes',
    subjectId: 'sub_python',
    semester: 'I',
    academicDate: '2026-09-17',
    periodNumber: 1,
    unitOrTopic: 'Unit 2: Control Flow',
    tags: ['python', 'loops', 'notes', 'period-1'],
    ownerId: 'usr_manager_1',
    ownerEmail: 'manager.cse@saranathan.ac.in',
    ownerName: 'CSE Resource Manager',
    resourceType: 'file',
    originalFilename: 'python_unit2_control_flow_notes.pdf',
    mimeType: 'application/pdf',
    fileSize: 2450000,
    googleDriveFileId: '1aBcDeFg_sample_py_p1',
    googleDriveFolderId: '1_Approved_College_Learning_Resources_Root',
    googleDriveStatus: 'VERIFIED',
    telegramAuditStatus: 'sent',
    telegramChatId: '-1003598863042',
    telegramMessageId: 101,
    telegramFileId: 'BAACAgUAAxkBAAIBZ...',
    publicationStatus: 'published',
    uploadStatus: 'uploaded',
    createdAt: '2026-09-17T10:15:00Z',
    publishedAt: '2026-09-17T10:20:00Z'
  },
  {
    id: 'res_sample_py_p1_solved',
    title: 'Solved Loop Examples Sheet (Period 1 Supplementary)',
    description: 'Practice programming exercises on nested loops with trace tables discussed in Hall RV 402.',
    categoryId: 'cat_class_notes',
    subjectId: 'sub_python',
    semester: 'I',
    academicDate: '2026-09-17',
    periodNumber: 1,
    unitOrTopic: 'Unit 2: Trace Tables',
    tags: ['python', 'examples', 'trace-table'],
    ownerId: 'usr_manager_1',
    ownerEmail: 'manager.cse@saranathan.ac.in',
    ownerName: 'CSE Resource Manager',
    resourceType: 'file',
    originalFilename: 'python_nested_loops_trace.pdf',
    mimeType: 'application/pdf',
    fileSize: 1120000,
    googleDriveFileId: '1aBcDeFg_sample_py_p1_solved',
    googleDriveFolderId: '1_Approved_College_Learning_Resources_Root',
    googleDriveStatus: 'VERIFIED',
    telegramAuditStatus: 'sent',
    telegramChatId: '-1003598863042',
    telegramMessageId: 102,
    telegramFileId: 'BAACAgUAAxkBAAIBZa...',
    publicationStatus: 'published',
    uploadStatus: 'uploaded',
    createdAt: '2026-09-17T10:25:00Z',
    publishedAt: '2026-09-17T10:30:00Z'
  },
  {
    id: 'res_sample_phy_p2',
    title: 'Engineering Physics: Laser & Optics Unit 1 Notes',
    description: 'Class presentation slides and derivation notes on Einstein coefficients and population inversion.',
    categoryId: 'cat_lecture_notes',
    subjectId: 'sub_physics',
    semester: 'I',
    academicDate: '2026-09-17',
    periodNumber: 2,
    unitOrTopic: 'Unit 1: Lasers',
    tags: ['physics', 'lasers', 'einstein-coefficients'],
    ownerId: 'usr_manager_1',
    ownerEmail: 'manager.cse@saranathan.ac.in',
    ownerName: 'CSE Resource Manager',
    resourceType: 'file',
    originalFilename: 'physics_unit1_lasers.pdf',
    mimeType: 'application/pdf',
    fileSize: 3840000,
    googleDriveFileId: '1aBcDeFg_sample_phy_p2',
    googleDriveFolderId: '1_Approved_College_Learning_Resources_Root',
    googleDriveStatus: 'VERIFIED',
    telegramAuditStatus: 'sent',
    telegramChatId: '-1003598863042',
    telegramMessageId: 103,
    telegramFileId: 'BAACAgUAAxkBAAIBZb...',
    publicationStatus: 'published',
    uploadStatus: 'uploaded',
    createdAt: '2026-09-17T11:05:00Z',
    publishedAt: '2026-09-17T11:10:00Z'
  },
  {
    id: 'res_sample_maths_p3',
    title: 'Mathematics: Matrices Eigenvalues & Eigenvectors Notes',
    description: 'Dr. R. Buvaneswari lecture notes on Cayley-Hamilton theorem and diagonalisation.',
    categoryId: 'cat_class_notes',
    subjectId: 'sub_maths',
    semester: 'I',
    academicDate: '2026-09-17',
    periodNumber: 3,
    unitOrTopic: 'Unit 1: Matrices',
    tags: ['maths', 'matrices', 'eigenvalues'],
    ownerId: 'usr_manager_1',
    ownerEmail: 'manager.cse@saranathan.ac.in',
    ownerName: 'CSE Resource Manager',
    resourceType: 'file',
    originalFilename: 'matrices_eigenvalues_notes.pdf',
    mimeType: 'application/pdf',
    fileSize: 1980000,
    googleDriveFileId: '1aBcDeFg_sample_maths_p3',
    googleDriveFolderId: '1_Approved_College_Learning_Resources_Root',
    googleDriveStatus: 'VERIFIED',
    telegramAuditStatus: 'sent',
    telegramChatId: '-1003598863042',
    telegramMessageId: 104,
    telegramFileId: 'BAACAgUAAxkBAAIBZc...',
    publicationStatus: 'published',
    uploadStatus: 'uploaded',
    createdAt: '2026-09-17T12:00:00Z',
    publishedAt: '2026-09-17T12:05:00Z'
  },
  {
    id: 'res_sample_eg_drive',
    title: 'Engineering Graphics: Orthographic Projections Step-by-Step Drive',
    description: 'Full resolution drawing sheet templates and 3D projection video walkthroughs hosted on Google Drive.',
    categoryId: 'cat_lecture_notes',
    subjectId: 'sub_graphics',
    semester: 'I',
    academicDate: '2026-09-18',
    periodNumber: 5,
    unitOrTopic: 'Unit 2: Orthographic Projections',
    tags: ['graphics', 'projections', 'drive-link'],
    ownerId: 'usr_manager_1',
    ownerEmail: 'manager.cse@saranathan.ac.in',
    ownerName: 'CSE Resource Manager',
    resourceType: 'drive_link',
    googleDriveUrl: 'https://drive.google.com/drive/folders/sample-eg-folder',
    googleDriveFileId: 'sample-eg-folder',
    googleDriveFolderId: '1_Approved_College_Learning_Resources_Root',
    googleDriveStatus: 'VERIFIED',
    telegramAuditStatus: 'sent',
    publicationStatus: 'published',
    uploadStatus: 'uploaded',
    createdAt: '2026-09-18T14:30:00Z',
    publishedAt: '2026-09-18T14:35:00Z'
  },
  {
    id: 'res_sample_qp_iat1',
    title: 'Model Question Paper: Internal Assessment Test I (All Subjects)',
    description: 'Official model question paper set for IAT-1 covering Python, Physics, Chemistry, and Mathematics.',
    categoryId: 'cat_question_papers',
    subjectId: 'sub_maths',
    semester: 'I',
    academicDate: '2026-09-16',
    periodNumber: null,
    unitOrTopic: 'IAT 1 Model Papers',
    tags: ['exam', 'iat1', 'model-paper'],
    ownerId: 'usr_manager_1',
    ownerEmail: 'manager.cse@saranathan.ac.in',
    ownerName: 'CSE Resource Manager',
    resourceType: 'file',
    originalFilename: 'iat1_model_question_paper_set.pdf',
    mimeType: 'application/pdf',
    fileSize: 4200000,
    googleDriveFileId: '1aBcDeFg_sample_qp_iat1',
    googleDriveFolderId: '1_Approved_College_Learning_Resources_Root',
    googleDriveStatus: 'VERIFIED',
    telegramAuditStatus: 'sent',
    telegramChatId: '-1003598863042',
    telegramMessageId: 105,
    telegramFileId: 'BAACAgUAAxkBAAIBZd...',
    publicationStatus: 'published',
    uploadStatus: 'uploaded',
    createdAt: '2026-09-16T09:00:00Z',
    publishedAt: '2026-09-16T09:10:00Z'
  }
];

export function getISTDateString(date = new Date()) {
  let d = date;
  if (!d) d = new Date();
  if (typeof d === 'string' || typeof d === 'number') {
    d = new Date(d);
  }
  if (!(d instanceof Date) || isNaN(d.getTime())) {
    return 'Recently';
  }
  const options = {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  };
  return new Intl.DateTimeFormat('en-GB', options).format(d);
}

export function formatStandardNotice(message, senderName, senderRole, date = new Date()) {
  const istDate = getISTDateString(date);
  const roleTitle = senderRole === 'admin' ? 'Administrator' : 
                    senderRole === 'representative' ? 'Class Representative' : 
                    senderRole === 'manager' ? 'Resource Manager' : 'Student';
  return `Date: ${istDate}\n\nDear Friends,\n\n${(message || '').trim()}\n\nWith regards,\n${senderName || 'Authorized User'}\n${roleTitle}`;
}

export class LearningStore {
  constructor() {
    this.storageKeys = {
      categories: 'college_lr_cache_categories',
      subjects: 'college_lr_cache_subjects',
      resources: 'college_lr_cache_resources',
      auditLogs: 'college_lr_cache_audit_logs',
      managers: 'college_lr_cache_managers',
      representatives: 'college_lr_cache_representatives',
      settings: 'college_lr_cache_settings',
      profiles: 'college_lr_cache_student_profiles',
      bans: 'college_lr_cache_bans',
      banRestrictions72h: 'college_lr_cache_72h_restrictions',
      sevenDayRestrictions: 'college_lr_cache_7day_restrictions',
      adminBanRequests: 'college_lr_cache_admin_ban_requests',
      notices: 'college_lr_cache_notices',
      folders: 'college_lr_cache_folders',
      notifications: 'college_lr_cache_uploader_notifications',
      registeredUsers: 'college_lr_cache_registered_users',
      lastSync: 'college_lr_cache_last_sync'
    };

    this.categories = [];
    this.subjects = [];
    this.resources = [];
    this.auditLogs = [];
    this.authorizedManagers = [];
    this.representatives = [];
    this.settings = {};
    this.studentProfiles = [];
    this.registeredUsers = [];
    this.bans = [];
    this.banRestrictions72h = [];
    this.sevenDayRestrictions = [];
    this.adminBanRequests = [];
    this.notices = [];
    this.folders = [];
    this.notifications = [];

    this.initStore();
  }

  initStore() {
    // 1. Categories
    const cachedCats = localStorage.getItem(this.storageKeys.categories);
    this.categories = cachedCats ? JSON.parse(cachedCats) : [...INITIAL_CATEGORIES];

    // 2. Subjects
    const cachedSubs = localStorage.getItem(this.storageKeys.subjects);
    this.subjects = cachedSubs ? JSON.parse(cachedSubs) : [...INITIAL_SUBJECTS];

    // 3. Resources
    const cachedRes = localStorage.getItem(this.storageKeys.resources);
    this.resources = cachedRes ? JSON.parse(cachedRes) : [...INITIAL_RESOURCES];

    // 4. Authorized Managers Registry (Admin managed)
    const cachedManagers = localStorage.getItem(this.storageKeys.managers);
    this.authorizedManagers = cachedManagers ? JSON.parse(cachedManagers) : [
      {
        id: 'usr_admin_deepan',
        email: 'jeyaramandeeban@gmail.com',
        displayName: 'Deepanraj J (Administrator)',
        role: 'admin',
        status: 'active',
        assignedAt: '2026-09-15T00:00:00Z',
        assignedBy: 'System'
      },
      {
        id: 'usr_manager_1',
        email: 'manager.cse@saranathan.ac.in',
        displayName: 'CSE Resource Manager',
        role: 'manager',
        status: 'active',
        assignedAt: '2026-09-15T00:00:00Z',
        assignedBy: 'admin'
      }
    ];

    // 4b. Representatives Registry (Admin appointed)
    const cachedReps = localStorage.getItem(this.storageKeys.representatives);
    this.representatives = cachedReps ? JSON.parse(cachedReps) : [
      {
        id: 'usr_rep_1',
        email: 'representative.cse@saranathan.ac.in',
        displayName: 'Class Representative (Class A)',
        role: 'representative',
        status: 'active',
        appointedAt: '2026-09-15T00:00:00Z',
        appointedBy: 'jeyaramandeeban@gmail.com'
      }
    ];

    // 5. Audit Logs
    const cachedLogs = localStorage.getItem(this.storageKeys.auditLogs);
    this.auditLogs = cachedLogs ? JSON.parse(cachedLogs) : [
      {
        id: 1,
        actorEmail: 'admin@saranathan.ac.in',
        action: 'PLATFORM_INITIALIZATION',
        resourceId: null,
        metadata: { info: 'College Learning Resource Platform initialized with Role-Based Dashboard' },
        createdAt: '2026-09-15T09:00:00Z'
      }
    ];

    // 6. Platform Settings
    const cachedSettings = localStorage.getItem(this.storageKeys.settings);
    this.settings = cachedSettings ? JSON.parse(cachedSettings) : {
      telegramChannelId: '-1003598863042',
      telegramInviteLink: 'https://t.me/+6dIBd-yKc75hZGY1',
      maxUploadSizeMb: 50,
      retentionDays: 30
    };

    // 7. Student Profiles, Bans & Moderation Restrictions
    try {
      const cachedProfiles = localStorage.getItem(this.storageKeys.profiles);
      this.studentProfiles = cachedProfiles ? JSON.parse(cachedProfiles) : [];
      const cachedBans = localStorage.getItem(this.storageKeys.bans);
      this.bans = cachedBans ? JSON.parse(cachedBans) : [];
      const cachedRestr = localStorage.getItem(this.storageKeys.banRestrictions72h);
      this.banRestrictions72h = cachedRestr ? JSON.parse(cachedRestr) : [];
      const cached7d = localStorage.getItem(this.storageKeys.sevenDayRestrictions);
      this.sevenDayRestrictions = cached7d ? JSON.parse(cached7d) : [];
      const cachedReqs = localStorage.getItem(this.storageKeys.adminBanRequests);
      this.adminBanRequests = cachedReqs ? JSON.parse(cachedReqs) : [];
      const cachedNotices = localStorage.getItem(this.storageKeys.notices);
      this.notices = cachedNotices ? JSON.parse(cachedNotices) : [
        {
          id: 'notice_seed_welcome',
          title: 'Welcome to Odd Semester 2026-27 Learning Hub',
          message: 'All students are requested to review daily handwritten notes and lecture materials after period 8.',
          formattedNotice: formatStandardNotice(
            'All students are requested to review daily handwritten notes and lecture materials after period 8.',
            'Deepanraj J',
            'admin',
            new Date('2026-09-16T10:00:00Z')
          ),
          istDate: '16 September 2026',
          authorName: 'Deepanraj J',
          authorEmail: 'jeyaramandeeban@gmail.com',
          authorRole: 'admin',
          isPinned: true,
          isPublished: true,
          createdAt: '2026-09-16T10:00:00Z',
          publishedAt: '2026-09-16T10:00:00Z',
          updatedAt: '2026-09-16T10:00:00Z',
          editHistory: []
        }
      ];
      const cachedFolders = localStorage.getItem(this.storageKeys.folders);
      const parsedFolders = cachedFolders ? JSON.parse(cachedFolders) : [
        {
          id: 'fld_unit1_notes',
          name: 'Unit 1 Courseware & Handwritten Notes',
          ownerEmail: 'manager.cse@saranathan.ac.in',
          ownerRole: 'manager',
          parentFolderId: 'root',
          createdAt: '2026-09-16T09:00:00Z'
        }
      ];
      // Always ensure the 7 system subject separation folders are present and up to date
      const combinedFolders = [...parsedFolders];
      SYSTEM_SUBJECT_FOLDERS.forEach(sysFld => {
        const existingIdx = combinedFolders.findIndex(f => f.id === sysFld.id);
        if (existingIdx === -1) {
          combinedFolders.push(sysFld);
        } else {
          combinedFolders[existingIdx] = { ...sysFld, ...combinedFolders[existingIdx], isSubjectFolder: true, isShared: true };
        }
      });
      this.folders = combinedFolders;
      const cachedNotifs = localStorage.getItem(this.storageKeys.notifications);
      this.notifications = cachedNotifs ? JSON.parse(cachedNotifs) : [];
      const cachedUsers = localStorage.getItem(this.storageKeys.registeredUsers);
      this.registeredUsers = cachedUsers ? JSON.parse(cachedUsers) : [];
    } catch (_) {
      this.studentProfiles = [];
      this.registeredUsers = [];
      this.bans = [];
      this.banRestrictions72h = [];
      this.sevenDayRestrictions = [];
      this.adminBanRequests = [];
      this.notices = [];
      this.folders = [...SYSTEM_SUBJECT_FOLDERS];
      this.notifications = [];
    }

    // Auto-migrate placeholder channel IDs from previous sessions
    if (this.settings.telegramChannelId === '-1003185348943') {
      this.settings.telegramChannelId = '-1003598863042';
    }
    this.resources.forEach(r => {
      if (r.telegramChatId === '-1003185348943') {
        r.telegramChatId = '-1003598863042';
      }
    });

    this.persistAll();
  }

  persistAll() {
    try {
      localStorage.setItem(this.storageKeys.categories, JSON.stringify(this.categories));
      localStorage.setItem(this.storageKeys.subjects, JSON.stringify(this.subjects));
      localStorage.setItem(this.storageKeys.resources, JSON.stringify(this.resources));
      localStorage.setItem(this.storageKeys.managers, JSON.stringify(this.authorizedManagers));
      localStorage.setItem(this.storageKeys.representatives, JSON.stringify(this.representatives));
      localStorage.setItem(this.storageKeys.auditLogs, JSON.stringify(this.auditLogs));
      localStorage.setItem(this.storageKeys.settings, JSON.stringify(this.settings));
      localStorage.setItem(this.storageKeys.profiles, JSON.stringify(this.studentProfiles));
      localStorage.setItem(this.storageKeys.registeredUsers, JSON.stringify(this.registeredUsers));
      localStorage.setItem(this.storageKeys.bans, JSON.stringify(this.bans));
      localStorage.setItem(this.storageKeys.banRestrictions72h, JSON.stringify(this.banRestrictions72h));
      localStorage.setItem(this.storageKeys.sevenDayRestrictions, JSON.stringify(this.sevenDayRestrictions));
      localStorage.setItem(this.storageKeys.adminBanRequests, JSON.stringify(this.adminBanRequests));
      localStorage.setItem(this.storageKeys.notices, JSON.stringify(this.notices));
      localStorage.setItem(this.storageKeys.folders, JSON.stringify(this.folders));
      localStorage.setItem(this.storageKeys.notifications, JSON.stringify(this.notifications));
      localStorage.setItem(this.storageKeys.lastSync, new Date().toISOString());
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  // --- Category Operations (Admin) ---
  getCategories(includeAll = false) {
    if (includeAll) return [...this.categories].sort((a, b) => a.sort_order - b.sort_order);
    return this.categories
      .filter(c => c.status === 'active')
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  getCategoryName(categoryId) {
    if (!categoryId) return 'Regular Class Notes';
    const cat = this.categories.find(c => c.id === categoryId);
    if (cat && cat.name) return cat.name;
    const fallbackMap = {
      cat_class_notes: 'Regular Class Notes',
      cat_lecture_notes: 'Faculty Lecture Notes',
      cat_question_papers: 'Question Papers & Model Exams',
      cat_lab_manuals: 'Laboratory Manuals & Programs',
      cat_assignments: 'Assignments & Case Studies',
      cat_recorded_lectures: 'Recorded Lectures & Videos',
      cat_reference_books: 'Reference Books & Textbooks',
      cat_syllabus_curriculum: 'Syllabus & Course Plans',
      cat_study_materials: 'Study Materials & Guides'
    };
    return fallbackMap[categoryId] || categoryId;
  }

  getSubjectName(subjectId) {
    if (!subjectId) return 'General CSE';
    const sub = this.subjects.find(s => s.id === subjectId || s.code === subjectId);
    if (sub) {
      return sub.code ? `${sub.code} — ${sub.name}` : sub.name;
    }
    const fallbackMap = {
      sub_python: '24ES101A — Problem Solving and Python Programming',
      sub_graphics: '24ES102A — Engineering Graphics',
      sub_maths: '24MA101A — Matrices and Calculus',
      sub_physics: '24PH101A — Engineering Physics',
      sub_english: '24EN101A — Heritage of Tamils / English',
      sub_workshop: '24ME101A — Engineering Workshop Practice',
      sub_python_lab: '24ES103A — Python Programming Laboratory'
    };
    return fallbackMap[subjectId] || subjectId;
  }

  addCategory(category, actorEmail) {
    const id = 'cat_' + category.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) + '_' + Date.now().toString(36);
    const newCat = {
      id,
      name: category.name.trim(),
      description: (category.description || '').trim(),
      icon: category.icon || '📁',
      sort_order: Number(category.sort_order) || (this.categories.length + 1),
      status: 'active'
    };
    this.categories.push(newCat);
    this.logAction(actorEmail, 'CREATE_CATEGORY', id, { categoryName: newCat.name });
    this.persistAll();
    return newCat;
  }

  updateCategory(id, updates, actorEmail) {
    const cat = this.categories.find(c => c.id === id);
    if (!cat) throw new Error('Category not found');
    Object.assign(cat, updates);
    this.logAction(actorEmail, 'UPDATE_CATEGORY', id, updates);
    this.persistAll();
    return cat;
  }

  archiveCategory(id, actorEmail) {
    const cat = this.categories.find(c => c.id === id);
    if (!cat) throw new Error('Category not found');
    cat.status = 'archived';
    this.logAction(actorEmail, 'ARCHIVE_CATEGORY', id, { name: cat.name });
    this.persistAll();
    return cat;
  }

  deleteCategory(id, actorEmail) {
    const catIndex = this.categories.findIndex(c => c.id === id);
    if (catIndex === -1) throw new Error('Category not found');
    const referencedCount = this.resources.filter(r => r.categoryId === id).length;
    if (referencedCount > 0) {
      throw new Error(`Cannot delete category: Referenced by ${referencedCount} existing resource(s). Archive it instead or reassign resources.`);
    }
    const removed = this.categories.splice(catIndex, 1)[0];
    this.logAction(actorEmail, 'DELETE_CATEGORY', id, { categoryName: removed.name });
    this.persistAll();
    return removed;
  }

  // --- Subject Operations (Admin) ---
  getSubjects(includeAll = false) {
    if (includeAll) return [...this.subjects];
    return this.subjects.filter(s => s.status === 'active');
  }

  addSubject(subject, actorEmail) {
    const id = 'sub_' + subject.code.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newSub = {
      id,
      code: subject.code.trim().toUpperCase(),
      name: subject.name.trim(),
      semester: subject.semester || 'I',
      department: subject.department || 'Computer Science and Engineering',
      faculty: subject.faculty || '-',
      color: subject.color || '#3b82f6',
      status: 'active'
    };
    this.subjects.push(newSub);
    this.logAction(actorEmail, 'CREATE_SUBJECT', id, { subjectName: newSub.name, code: newSub.code });
    this.persistAll();
    return newSub;
  }

  deleteSubject(id, actorEmail) {
    const subIndex = this.subjects.findIndex(s => s.id === id);
    if (subIndex === -1) throw new Error('Subject not found');
    const referencedCount = this.resources.filter(r => r.subjectId === id).length;
    if (referencedCount > 0) {
      throw new Error(`Cannot delete subject: Referenced by ${referencedCount} existing resource(s). Archive it instead or reassign resources.`);
    }
    const removed = this.subjects.splice(subIndex, 1)[0];
    this.logAction(actorEmail, 'DELETE_SUBJECT', id, { subjectName: removed.name, code: removed.code });
    this.persistAll();
    return removed;
  }

  // --- Resource Operations ---
  getAllResources() {
    return [...this.resources];
  }

  getPublishedResources() {
    return this.resources.filter(r => {
      if (r.publicationStatus !== 'published') return false;
      if (r.resourceType === 'drive_link') {
        return !!r.googleDriveUrl;
      }
      return r.uploadStatus === 'telegram_success' || r.uploadStatus === 'uploaded' || !!r.googleDriveFileId;
    });
  }

  // --- Decision 3: Privacy-Preserving Role-Based Resource Query ---
  getResources(filters = {}, user = null) {
    let list = [...this.resources];

    // Privacy-preserving draft visibility:
    if (!user || user.role === 'student') {
      // Students see only published, verified resources
      list = list.filter(r => r.publicationStatus === 'published' && (r.uploadStatus === 'uploaded' || r.uploadStatus === 'telegram_success' || !!r.googleDriveFileId));
    } else if (user.role === 'manager') {
      // Option A: Managers see published resources PLUS their own resources (other managers' drafts hidden)
      list = list.filter(r => 
        (r.publicationStatus === 'published' && (r.uploadStatus === 'uploaded' || r.uploadStatus === 'telegram_success' || !!r.googleDriveFileId)) ||
        r.ownerId === user.id ||
        (user.email && r.ownerEmail === user.email)
      );
    }
    // Admin sees all

    // Subject filter
    if (filters.subjectId && filters.subjectId !== 'all') {
      list = list.filter(r => r.subjectId === filters.subjectId);
    }
    // Category filter
    if (filters.categoryId && filters.categoryId !== 'all') {
      list = list.filter(r => r.categoryId === filters.categoryId);
    }
    // Academic date filter
    if (filters.academicDate) {
      list = list.filter(r => r.academicDate === filters.academicDate);
    }
    // Period number filter
    if (filters.periodNumber !== undefined && filters.periodNumber !== null && filters.periodNumber !== 'all') {
      list = list.filter(r => r.periodNumber === Number(filters.periodNumber));
    }
    // Search query filter
    if (filters.query && filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      list = list.filter(r => 
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.unitOrTopic && r.unitOrTopic.toLowerCase().includes(q)) ||
        (Array.isArray(r.tags) && r.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    return list;
  }

  getResourcesByOwner(ownerId) {
    return this.resources.filter(r => r.ownerId === ownerId);
  }

  getResourceById(id) {
    return this.resources.find(r => r.id === id);
  }

  saveDraftResource(resourceData, actorUser) {
    const id = resourceData.id || ('res_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36));
    const isNew = !resourceData.id;

    const existing = isNew ? null : this.resources.find(r => r.id === id);
    if (existing && existing.ownerId !== actorUser.id && actorUser.role !== 'admin') {
      throw new Error('Permission denied: You do not own this resource');
    }

    const unit = (resourceData.unit || '').trim();
    const topic = (resourceData.topic || '').trim();
    let unitOrTopic = (resourceData.unitOrTopic || '').trim();
    if (!unitOrTopic && (unit || topic)) {
      unitOrTopic = [unit, topic].filter(Boolean).join(' — ');
    }

    const categoryId = resourceData.categoryId || 'cat_class_notes';
    const subjectId = resourceData.subjectId || null;

    const resRecord = {
      id,
      title: (resourceData.title || 'Untitled Resource').trim(),
      description: (resourceData.description || '').trim(),
      categoryId,
      categoryName: resourceData.categoryName || this.getCategoryName(categoryId),
      subjectId,
      subjectName: resourceData.subjectName || this.getSubjectName(subjectId),
      parentFolderId: resourceData.parentFolderId || (existing ? existing.parentFolderId : (subjectId ? ('fld_' + subjectId) : 'root')),
      semester: resourceData.semester || 'I',
      academicDate: resourceData.academicDate || null,
      periodNumber: resourceData.periodNumber ? Number(resourceData.periodNumber) : null,
      unit: unit || null,
      topic: topic || null,
      unitOrTopic,
      tags: Array.isArray(resourceData.tags) ? resourceData.tags : [],
      ownerId: actorUser.id,
      ownerEmail: actorUser.email,
      ownerName: (resourceData.ownerName || actorUser.displayName || 'CSE Resource Manager').trim(),
      resourceType: resourceData.resourceType || 'file',
      originalFilename: resourceData.originalFilename || null,
      mimeType: resourceData.mimeType || 'application/octet-stream',
      fileSize: resourceData.fileSize || 0,
      googleDriveFileId: resourceData.googleDriveFileId || (existing ? existing.googleDriveFileId : null),
      googleDriveFolderId: resourceData.googleDriveFolderId || (existing ? existing.googleDriveFolderId : null),
      googleDriveStatus: resourceData.googleDriveStatus || (existing ? existing.googleDriveStatus : (resourceData.googleDriveFileId ? 'VERIFIED' : 'PENDING')),
      telegramAuditStatus: resourceData.telegramAuditStatus || (existing ? existing.telegramAuditStatus : 'pending'),
      telegramAuditMessageId: resourceData.telegramAuditMessageId || (existing ? existing.telegramAuditMessageId : null),
      telegramChatId: resourceData.telegramChatId || '-1003598863042',
      telegramMessageId: resourceData.telegramMessageId || null,
      telegramFileId: resourceData.telegramFileId || null,
      googleDriveUrl: resourceData.googleDriveUrl || null,
      publicationStatus: resourceData.publicationStatus || 'draft',
      uploadStatus: resourceData.uploadStatus || (existing ? existing.uploadStatus : (resourceData.googleDriveFileId ? 'uploaded' : 'telegram_success')),
      errorDetails: resourceData.errorDetails || null,
      uploadedAt: resourceData.uploadedAt || (existing ? existing.uploadedAt : new Date().toISOString()),
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: existing ? existing.publishedAt : null
    };

    if (existing) {
      Object.assign(existing, resRecord);
    } else {
      this.resources.unshift(resRecord);
    }

    this.logAction(actorUser.email, isNew ? 'CREATE_DRAFT' : 'UPDATE_DRAFT', id, { title: resRecord.title });
    this.persistAll();
    return resRecord;
  }

  updateResource(id, updates, actorUser) {
    const res = this.resources.find(r => r.id === id);
    if (!res) throw new Error('Resource not found');
    if (res.ownerId !== actorUser.id && actorUser.role !== 'admin') {
      throw new Error('Permission denied: You do not own this resource');
    }
    Object.assign(res, updates, { updatedAt: new Date().toISOString() });
    this.logAction(actorUser.email, 'UPDATE_RESOURCE', id, updates);
    this.persistAll();
    return res;
  }

  transitionResourceState(id, nextState, actorUser) {
    if (!VALID_LIFECYCLE_STATES.includes(nextState)) {
      throw new Error(`Invalid lifecycle state: ${nextState}`);
    }

    const res = this.resources.find(r => r.id === id);
    if (!res) throw new Error('Resource not found');

    if (res.ownerId !== actorUser.id && actorUser.role !== 'admin') {
      throw new Error('Permission denied: You can only alter status of your own materials');
    }

    const currentState = res.publicationStatus || 'draft';
    const allowedNext = VALID_STATE_TRANSITIONS[currentState] || [];

    if (!allowedNext.includes(nextState)) {
      throw new Error(`Invalid state transition from "${currentState}" to "${nextState}"`);
    }

    // Admin draft restriction guard (Decision 1)
    if (res.restrictedByAdmin && actorUser.role !== 'admin') {
      throw new Error('Permission denied: This resource has been restricted by the Administrator and cannot be republished by a Manager.');
    }

    // Validation when transitioning to published
    if (nextState === 'published') {
      if (!res.title || !res.title.trim()) {
        throw new Error('Cannot publish resource: Title is required');
      }
      if (res.resourceType === 'drive_link') {
        const driveValidation = validateGoogleDriveUrl(res.googleDriveUrl);
        if (!driveValidation.isValid) {
          throw new Error(`Cannot publish Google Drive resource: ${driveValidation.error}`);
        }
      } else {
        if (res.uploadStatus !== 'telegram_success' && res.uploadStatus !== 'uploaded' && !res.googleDriveFileId) {
          throw new Error('Cannot publish resource: File has not been successfully uploaded to Google Drive');
        }
      }
      res.publishedAt = new Date().toISOString();
    }

    res.publicationStatus = nextState;
    res.updatedAt = new Date().toISOString();

    if (res.ownerEmail && (!actorUser.email || res.ownerEmail.toLowerCase() !== actorUser.email.toLowerCase())) {
      this.notifyUploader(res.ownerEmail, {
        title: `Resource Status Changed: ${res.title}`,
        message: `Your resource was changed to "${nextState}" by ${actorUser.displayName || actorUser.email || 'Admin'}.`,
        resourceId: id,
        statusChange: nextState,
        actorEmail: actorUser.email
      });
    }

    const actionName = nextState === 'published' ? 'PUBLISH_RESOURCE' : (nextState === 'archived' ? 'ARCHIVE_RESOURCE' : 'TRANSITION_STATE');
    this.logAction(actorUser.email, actionName, id, { from: currentState, to: nextState, title: res.title });
    this.persistAll();

    if (typeof fetch !== 'undefined') {
      try {
        fetch('/api/sync-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resourceId: id,
            publicationStatus: nextState,
            title: res.title,
            googleDriveFileId: res.googleDriveFileId,
            actorEmail: actorUser.email,
            actorName: actorUser.displayName || 'Manager'
          })
        }).catch(() => {});
      } catch (_) {}
    }

    return res;
  }

  publishResource(id, actorUser) {
    return this.transitionResourceState(id, 'published', actorUser);
  }

  unpublishResource(id, actorUser) {
    return this.transitionResourceState(id, 'unpublished', actorUser);
  }

  archiveResource(id, actorUser) {
    return this.transitionResourceState(id, 'archived', actorUser);
  }

  deleteResource(id, actorUser) {
    const index = this.resources.findIndex(r => r.id === id);
    if (index === -1) throw new Error('Resource not found');
    const res = this.resources[index];
    if (res.ownerId !== actorUser.id && actorUser.role !== 'admin') {
      throw new Error('Permission denied');
    }

    this.resources.splice(index, 1);
    this.logAction(actorUser.email, 'DELETE_RESOURCE', id, { title: res.title });
    this.persistAll();
    return true;
  }

  // --- Admin Draft Override & Republishing Lock (Decision 1) ---
  adminRestrictResource(id, actorUser) {
    if (actorUser.role !== 'admin') {
      throw new Error('Permission denied: Only an Administrator can restrict resources');
    }
    const res = this.resources.find(r => r.id === id);
    if (!res) throw new Error('Resource not found');
    res.publicationStatus = 'draft';
    res.restrictedByAdmin = true;
    res.updatedAt = new Date().toISOString();
    this.logAction(actorUser.email, 'ADMIN_RESTRICT_RESOURCE', id, { title: res.title });
    this.persistAll();
    return res;
  }

  adminLiftResourceRestriction(id, actorUser) {
    if (actorUser.role !== 'admin') {
      throw new Error('Permission denied: Only an Administrator can lift resource restrictions');
    }
    const res = this.resources.find(r => r.id === id);
    if (!res) throw new Error('Resource not found');
    res.restrictedByAdmin = false;
    res.updatedAt = new Date().toISOString();
    this.logAction(actorUser.email, 'ADMIN_LIFT_RESTRICTION', id, { title: res.title });
    this.persistAll();
    return res;
  }

  // --- Student Profile Management (6-Digit Roll Number - Decision 2) ---
  getStudentProfile(email) {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    return this.studentProfiles.find(p => p.email.toLowerCase() === clean) || null;
  }

  getAllStudentProfiles() {
    return [...this.studentProfiles];
  }

  saveStudentProfile({ email, firstName, secondaryName = '', rollNumber }) {
    if (!email) throw new Error('Email is required');
    const cleanEmail = email.trim().toLowerCase();
    
    const cleanFirst = (firstName || '').trim();
    if (!cleanFirst || cleanFirst.length < 2) {
      throw new Error('First name must be at least 2 characters long');
    }

    const cleanRoll = (rollNumber || '').trim();
    if (!/^[0-9]{6}$/.test(cleanRoll)) {
      throw new Error('Roll number must be exactly 6 digits (e.g. 260101).');
    }

    // Check uniqueness across other students
    const duplicate = this.studentProfiles.find(p => p.rollNumber === cleanRoll && p.email.toLowerCase() !== cleanEmail);
    if (duplicate) {
      throw new Error(`Roll number ${cleanRoll} is already registered to another account.`);
    }

    let profile = this.studentProfiles.find(p => p.email.toLowerCase() === cleanEmail);
    if (profile) {
      profile.firstName = cleanFirst;
      profile.secondaryName = (secondaryName || '').trim();
      profile.displayName = `${cleanFirst} ${secondaryName || ''}`.trim();
      profile.rollNumber = cleanRoll;
      profile.updatedAt = new Date().toISOString();
    } else {
      profile = {
        id: 'usr_std_' + Math.random().toString(36).substring(2, 10),
        email: cleanEmail,
        firstName: cleanFirst,
        secondaryName: (secondaryName || '').trim(),
        displayName: `${cleanFirst} ${secondaryName || ''}`.trim(),
        rollNumber: cleanRoll,
        role: 'student',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.studentProfiles.push(profile);
    }

    let regUser = this.registeredUsers.find(u => u.email.toLowerCase() === cleanEmail);
    if (regUser) {
      regUser.displayName = profile.displayName;
      regUser.rollNumber = cleanRoll;
      regUser.lastSeen = new Date().toISOString();
      regUser.updatedAt = new Date().toISOString();
    }

    this.logAction(cleanEmail, 'STUDENT_PROFILE_SAVED', null, { rollNumber: cleanRoll });
    this.persistAll();
    return profile;
  }

  // --- Ban System & Central Moderation (Rules A, B, C, D, E) ---
  isUserBanned(email) {
    if (!email) return false;
    const clean = email.trim().toLowerCase();
    const now = Date.now();
    const activeBan = this.bans.find(b => b.targetEmail.toLowerCase() === clean && (b.status === 'active' || b.isActive));
    if (!activeBan) return false;
    if (activeBan.expiresAt && new Date(activeBan.expiresAt).getTime() <= now) {
      activeBan.isActive = false;
      activeBan.status = 'expired';
      this.persistAll();
      return false;
    }
    return activeBan;
  }

  isStudentBanned(email) {
    return this.isUserBanned(email);
  }

  isManagerRestricted(managerEmail, studentEmail) {
    if (!managerEmail || !studentEmail) return false;
    const cleanM = managerEmail.trim().toLowerCase();
    const cleanS = studentEmail.trim().toLowerCase();
    const now = Date.now();

    const active = this.sevenDayRestrictions.find(r =>
      r.managerEmail.toLowerCase() === cleanM &&
      r.studentEmail.toLowerCase() === cleanS &&
      r.isActive &&
      new Date(r.restrictionExpiresAt).getTime() > now
    );
    return !!active;
  }

  is72hRestricted(studentEmail, managerEmail = null) {
    if (managerEmail) {
      return this.isManagerRestricted(managerEmail, studentEmail);
    }
    const cleanS = (studentEmail || '').trim().toLowerCase();
    const now = Date.now();
    return this.sevenDayRestrictions.some(r =>
      r.studentEmail.toLowerCase() === cleanS &&
      r.isActive &&
      new Date(r.restrictionExpiresAt).getTime() > now
    ) || this.banRestrictions72h.some(r =>
      r.studentEmail.toLowerCase() === cleanS &&
      r.isActive &&
      new Date(r.restrictionExpiresAt).getTime() > now
    );
  }

  getBanDetails(email) {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    return this.bans.find(b => b.targetEmail.toLowerCase() === clean && (b.status === 'active' || b.isActive)) || null;
  }

  banStudent({ studentEmail, actorEmail, actorRole, banType = 'temporary', reason, durationHours = 24 }) {
    if (!studentEmail || !reason) throw new Error('Student email and reason are required');
    const cleanStudent = studentEmail.trim().toLowerCase();
    const cleanActor = actorEmail.trim().toLowerCase();
    const targetRole = this.getUserRole(cleanStudent);

    // Rule: No non-Admin user can ban or unban an Admin account
    if (targetRole === 'admin') {
      throw new Error('SECURITY VIOLATION: An Administrator account cannot be banned.');
    }

    if (actorRole === 'manager') {
      if (targetRole !== 'student') {
        throw new Error(`Permission denied: Managers can only ban Students. Target is a ${targetRole}.`);
      }
      // Rule D — Seven-day restriction:
      // If a Manager bans a Student and an Admin subsequently unbans that Student,
      // the Manager who issued the original ban cannot ban that same Student again for seven days
      if (this.isManagerRestricted(cleanActor, cleanStudent)) {
        const err = new Error('ADMIN_72H_RESTRICTION_ACTIVE: This student was unbanned by the Administrator. A 7-day restriction is active for you (72-hour platform restriction is active). You cannot ban them directly; please use "Request Admin to Ban".');
        err.code = 'ADMIN_72H_RESTRICTION_ACTIVE';
        throw err;
      }
      // Check legacy 72h list if present
      if (this.banRestrictions72h.some(r => (r.managerEmail ? r.managerEmail.toLowerCase() === cleanActor : true) && r.studentEmail.toLowerCase() === cleanStudent && r.isActive && new Date(r.restrictionExpiresAt).getTime() > Date.now())) {
        const err = new Error('ADMIN_72H_RESTRICTION_ACTIVE: This student was unbanned by the Administrator. A 7-day restriction is active for you (72-hour platform restriction is active). You cannot ban them directly; please use "Request Admin to Ban".');
        err.code = 'ADMIN_72H_RESTRICTION_ACTIVE';
        throw err;
      }
      if (banType === 'permanent') {
        throw new Error('Permission denied: Managers can only issue temporary bans. Permanent bans require Admin action.');
      }
    } else if (actorRole === 'representative') {
      if (targetRole === 'representative') {
        throw new Error('Permission denied: Representatives cannot ban other Representatives.');
      }
      if (targetRole !== 'student' && targetRole !== 'manager') {
        throw new Error('Permission denied: Representatives can only ban Students and Managers.');
      }
    } else if (actorRole !== 'admin') {
      throw new Error('Permission denied: Unauthorized role to ban accounts.');
    }

    const startsAt = new Date().toISOString();
    const expiresAt = banType === 'temporary'
      ? new Date(Date.now() + (durationHours || 24) * 60 * 60 * 1000).toISOString()
      : null;

    const banRecord = {
      id: 'ban_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      targetEmail: cleanStudent,
      targetRole,
      actorEmail: cleanActor,
      actorRole,
      banTimestamp: startsAt,
      reason: reason.trim(),
      banType,
      status: 'active',
      isActive: true,
      startsAt,
      expiresAt,
      unbannedAt: null,
      unbannedBy: null,
      unbannedByRole: null,
      createdAt: startsAt
    };

    this.bans.push(banRecord);
    const audit = this.logAction(cleanActor, 'BAN_STUDENT', null, { targetEmail: cleanStudent, targetRole, banType, reason });
    banRecord.auditLogId = audit ? audit.id : null;
    this.persistAll();
    return banRecord;
  }

  unbanStudent({ studentEmail, actorEmail, actorRole }) {
    if (!studentEmail) throw new Error('Student email is required');
    const cleanStudent = studentEmail.trim().toLowerCase();
    const cleanActor = actorEmail.trim().toLowerCase();

    const ban = this.bans.find(b => b.targetEmail.toLowerCase() === cleanStudent && (b.status === 'active' || b.isActive));
    if (!ban) throw new Error('No active ban found for this student');

    // Rule A — Admin-issued bans:
    // If the Admin bans an account, only an Admin can unban that account.
    if (ban.actorRole === 'admin' && actorRole !== 'admin') {
      throw new Error('Permission denied: Only an Administrator can lift an Admin-imposed ban.');
    }

    // Rule B — Representative-issued bans:
    // Representatives and Admins can unban. Managers cannot.
    if (ban.actorRole === 'representative' && actorRole !== 'admin' && actorRole !== 'representative') {
      throw new Error('Permission denied: Managers cannot lift a Representative-issued ban.');
    }

    ban.isActive = false;
    ban.status = 'unbanned';
    ban.unbannedAt = new Date().toISOString();
    ban.unbannedBy = cleanActor;
    ban.unbannedByRole = actorRole;

    // Rule D — Seven-day restriction:
    // If a Manager bans a Student and an Admin subsequently unbans that Student,
    // the Manager who issued the original ban cannot ban that same Student again for seven days
    // from the Admin's unban timestamp.
    if (actorRole === 'admin' && ban.actorRole === 'manager') {
      const restrictionStartsAt = new Date().toISOString();
      const restrictionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      this.sevenDayRestrictions.push({
        id: 'restr7d_' + Date.now().toString(36),
        studentEmail: cleanStudent,
        managerEmail: ban.actorEmail.toLowerCase(),
        unbannedByAdmin: cleanActor,
        originalBanId: ban.id,
        restrictionStartsAt,
        restrictionExpiresAt,
        isActive: true
      });

      // Also record in 72h legacy collection for backwards-compatible test assertions
      this.banRestrictions72h.push({
        id: 'restr_' + Date.now().toString(36),
        studentEmail: cleanStudent,
        managerEmail: ban.actorEmail.toLowerCase(),
        unbannedByAdmin: cleanActor,
        originalManagerBanId: ban.id,
        restrictionStartsAt,
        restrictionExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        isActive: true
      });

      this.logAction(cleanActor, 'ADMIN_SEVEN_DAY_RESTRICTION_STARTED', null, {
        studentEmail: cleanStudent,
        managerEmail: ban.actorEmail,
        expiresAt: restrictionExpiresAt
      });
    }

    this.logAction(cleanActor, 'UNBAN_STUDENT', null, { targetEmail: cleanStudent });
    this.persistAll();
    return true;
  }

  // Rule E: Ban requests
  submitAdminBanRequest({ managerEmail, studentEmail, reason }) {
    if (!managerEmail || !studentEmail || !reason) throw new Error('All fields are required');
    const request = {
      id: 'req_' + Date.now().toString(36),
      managerEmail: managerEmail.trim().toLowerCase(),
      studentEmail: studentEmail.trim().toLowerCase(),
      reason: reason.trim(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    this.adminBanRequests.push(request);
    this.logAction(managerEmail, 'SUBMIT_ADMIN_BAN_REQUEST', null, { studentEmail: request.studentEmail });
    this.persistAll();
    return request;
  }

  decideAdminBanRequest({ requestId, adminEmail, decision, notes = '' }) {
    if (!requestId || !adminEmail || !decision) throw new Error('Request ID, admin email, and decision are required');
    const req = this.adminBanRequests.find(r => r.id === requestId);
    if (!req) throw new Error('Ban request not found');

    req.status = decision; // 'approved' | 'rejected'
    req.adminDecisionNotes = notes;
    req.decidedBy = adminEmail;
    req.decidedAt = new Date().toISOString();

    if (decision === 'approved') {
      // Impose the ban as Admin
      this.banStudent({
        studentEmail: req.studentEmail,
        actorEmail: adminEmail,
        actorRole: 'admin',
        banType: 'permanent',
        reason: `Approved Manager Ban Request: ${req.reason}`
      });
    }

    this.logAction(adminEmail, 'DECIDE_ADMIN_BAN_REQUEST', null, { requestId, decision, studentEmail: req.studentEmail });
    this.persistAll();
    return req;
  }

  getAdminBanRequests() {
    return [...this.adminBanRequests];
  }

  // --- Trusted Role & Hierarchy Management ---
  getUserRole(email) {
    if (!email) return 'student';
    const clean = email.trim().toLowerCase();
    if (clean === 'jeyaramandeeban@gmail.com' || clean === 'admin@saranathan.ac.in') {
      return 'admin';
    }
    const rep = this.representatives.find(r => r.email.toLowerCase() === clean && r.status === 'active');
    if (rep) return 'representative';
    const mgr = this.authorizedManagers.find(m => m.email.toLowerCase() === clean && m.status === 'active');
    if (mgr) return 'manager';
    return 'student';
  }

  setUserRole(targetEmail, newRole, actorEmail, actorRole) {
    if (actorRole !== 'admin') {
      throw new Error('Permission denied: Only an Administrator can change user roles.');
    }
    const cleanTarget = (targetEmail || '').trim().toLowerCase();
    if (!cleanTarget) throw new Error('Target email is required');

    if (cleanTarget === 'jeyaramandeeban@gmail.com' || cleanTarget === 'admin@saranathan.ac.in') {
      throw new Error('Permission denied: System Administrator role cannot be modified.');
    }
    if (newRole === 'admin') {
      throw new Error('Permission denied: Cannot promote account to Administrator via this interface.');
    }

    const currentRole = this.getUserRole(cleanTarget);

    // Revoke previous elevation
    this.representatives.forEach(r => {
      if (r.email.toLowerCase() === cleanTarget) r.status = 'revoked';
    });
    this.authorizedManagers.forEach(m => {
      if (m.email.toLowerCase() === cleanTarget) m.status = 'revoked';
    });

    const profile = this.getStudentProfile(cleanTarget);
    const displayName = profile ? profile.displayName : cleanTarget.split('@')[0];

    if (newRole === 'representative') {
      const existingRep = this.representatives.find(r => r.email.toLowerCase() === cleanTarget);
      if (existingRep) {
        existingRep.status = 'active';
        existingRep.displayName = displayName;
        existingRep.updatedAt = new Date().toISOString();
      } else {
        this.representatives.push({
          id: 'usr_rep_' + Math.random().toString(36).substring(2, 10),
          email: cleanTarget,
          displayName,
          role: 'representative',
          status: 'active',
          appointedBy: actorEmail,
          appointedAt: new Date().toISOString()
        });
      }
    } else if (newRole === 'manager') {
      const existingMgr = this.authorizedManagers.find(m => m.email.toLowerCase() === cleanTarget);
      if (existingMgr) {
        existingMgr.status = 'active';
        existingMgr.displayName = displayName;
        existingMgr.updatedAt = new Date().toISOString();
      } else {
        this.authorizedManagers.push({
          id: 'usr_mgr_' + Math.random().toString(36).substring(2, 10),
          email: cleanTarget,
          displayName,
          role: 'manager',
          status: 'active',
          assignedBy: actorEmail,
          assignedAt: new Date().toISOString()
        });
      }
    }

    this.logAction(actorEmail, 'USER_ROLE_CHANGED', null, {
      targetEmail: cleanTarget,
      previousRole: currentRole,
      newRole
    });
    this.persistAll();
    return { email: cleanTarget, previousRole: currentRole, newRole };
  }

  getUsers() {
    const userMap = new Map();

    // 1. System Admins
    userMap.set('jeyaramandeeban@gmail.com', {
      email: 'jeyaramandeeban@gmail.com',
      firstName: 'Deepanraj',
      secondaryName: 'J',
      displayName: 'Deepanraj J',
      rollNumber: '260001',
      role: 'admin',
      status: 'active',
      joinDate: '2026-09-15',
      lastSeen: new Date().toISOString(),
      updatedAt: '2026-09-15T00:00:00Z',
      isBanned: false
    });
    userMap.set('admin@saranathan.ac.in', {
      email: 'admin@saranathan.ac.in',
      firstName: 'System',
      secondaryName: 'Administrator',
      displayName: 'System Administrator',
      rollNumber: null,
      role: 'admin',
      status: 'active',
      joinDate: '2026-09-15',
      lastSeen: new Date().toISOString(),
      updatedAt: '2026-09-15T00:00:00Z',
      isBanned: false
    });

    // 2. Representatives
    this.representatives.forEach(r => {
      const clean = r.email.toLowerCase();
      userMap.set(clean, {
        email: r.email,
        firstName: (r.displayName || '').split(' ')[0] || 'Representative',
        secondaryName: (r.displayName || '').split(' ').slice(1).join(' ') || '',
        displayName: r.displayName,
        rollNumber: r.rollNumber || null,
        role: 'representative',
        status: r.status || 'active',
        joinDate: r.appointedAt ? r.appointedAt.split('T')[0] : '2026-09-15',
        lastSeen: r.lastSeen || r.appointedAt || null,
        updatedAt: r.appointedAt || null,
        isBanned: !!this.isStudentBanned(r.email)
      });
    });

    // 3. Managers
    this.authorizedManagers.forEach(m => {
      const clean = m.email.toLowerCase();
      if (!userMap.has(clean)) {
        userMap.set(clean, {
          email: m.email,
          firstName: (m.displayName || '').split(' ')[0] || 'Manager',
          secondaryName: (m.displayName || '').split(' ').slice(1).join(' ') || '',
          displayName: m.displayName,
          rollNumber: m.rollNumber || null,
          role: 'manager',
          status: m.status || 'active',
          joinDate: m.assignedAt ? m.assignedAt.split('T')[0] : '2026-09-15',
          lastSeen: m.lastSeen || m.assignedAt || null,
          updatedAt: m.assignedAt || null,
          isBanned: !!this.isStudentBanned(m.email)
        });
      }
    });

    // 4. Registered Users (includes all Google sign-in accounts)
    this.registeredUsers.forEach(u => {
      const clean = u.email.toLowerCase();
      if (!userMap.has(clean)) {
        userMap.set(clean, {
          email: u.email,
          firstName: (u.displayName || clean.split('@')[0]).split(' ')[0],
          secondaryName: (u.displayName || '').split(' ').slice(1).join(' '),
          displayName: u.displayName || clean.split('@')[0],
          rollNumber: u.rollNumber || null,
          role: u.role || 'student',
          status: u.status || 'active',
          joinDate: u.createdAt ? u.createdAt.split('T')[0] : '2026-09-16',
          lastSeen: u.lastSeen || u.createdAt || null,
          updatedAt: u.updatedAt || u.createdAt || null,
          isBanned: !!this.isStudentBanned(u.email)
        });
      } else {
        const existing = userMap.get(clean);
        if (u.rollNumber && !existing.rollNumber) existing.rollNumber = u.rollNumber;
        if (u.displayName && existing.displayName === clean.split('@')[0]) existing.displayName = u.displayName;
        if (u.lastSeen) existing.lastSeen = u.lastSeen;
      }
    });

    // 5. Students Profiles
    this.studentProfiles.forEach(p => {
      const clean = p.email.toLowerCase();
      if (!userMap.has(clean)) {
        userMap.set(clean, {
          email: p.email,
          firstName: p.firstName || (p.displayName || clean.split('@')[0]).split(' ')[0],
          secondaryName: p.secondaryName || '',
          displayName: p.displayName || `${p.firstName || ''} ${p.secondaryName || ''}`.trim(),
          rollNumber: p.rollNumber || null,
          role: 'student',
          status: p.status || 'active',
          joinDate: p.createdAt ? p.createdAt.split('T')[0] : '2026-09-16',
          lastSeen: p.updatedAt || p.createdAt || null,
          updatedAt: p.updatedAt || p.createdAt || null,
          isBanned: !!this.isStudentBanned(p.email)
        });
      } else {
        const existing = userMap.get(clean);
        if (p.firstName) existing.firstName = p.firstName;
        if (p.secondaryName) existing.secondaryName = p.secondaryName;
        if (p.rollNumber) existing.rollNumber = p.rollNumber;
        if (p.displayName && (!existing.displayName || existing.displayName === clean.split('@')[0])) {
          existing.displayName = p.displayName;
        }
        if (p.updatedAt) existing.updatedAt = p.updatedAt;
      }
    });

    return Array.from(userMap.values());
  }

  registerUser({ email, displayName, role, rollNumber, avatar, status }) {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    let user = this.registeredUsers.find(u => u.email.toLowerCase() === clean);

    // Determine authoritative role:
    let effectiveRole = null;
    if (clean === 'jeyaramandeeban@gmail.com' || clean === 'admin@saranathan.ac.in') {
      effectiveRole = 'admin';
    } else if (role && role !== 'student') {
      effectiveRole = role;
    } else if (user && user.role) {
      effectiveRole = user.role;
    } else if (this.representatives && this.representatives.some(r => r.email.toLowerCase() === clean && r.status === 'active')) {
      effectiveRole = 'representative';
    } else if (this.isAuthorizedManager(clean)) {
      effectiveRole = 'manager';
    } else {
      effectiveRole = role || 'student';
    }

    const cleanName = displayName || clean.split('@')[0];

    if (user) {
      if (displayName) user.displayName = displayName;
      if (rollNumber) user.rollNumber = rollNumber;
      if (avatar) user.avatar = avatar;
      if (effectiveRole) user.role = effectiveRole;
      user.lastSeen = new Date().toISOString();
    } else {
      user = {
        id: 'usr_' + effectiveRole.slice(0, 3) + '_' + btoa(clean).replace(/=/g, '').slice(0, 10),
        email: clean,
        displayName: cleanName,
        role: effectiveRole,
        rollNumber: rollNumber || null,
        avatar: avatar || (effectiveRole === 'admin' ? '🛡️' : effectiveRole === 'representative' ? '📢' : effectiveRole === 'manager' ? '👨‍🏫' : '🎓'),
        status: status || 'active',
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };
      this.registeredUsers.push(user);
    }

    if (effectiveRole === 'student') {
      const existingProfile = this.getStudentProfile(clean);
      if (!existingProfile) {
        this.studentProfiles.push({
          id: 'usr_std_' + Math.random().toString(36).substring(2, 10),
          email: clean,
          firstName: cleanName.split(' ')[0] || 'Student',
          secondaryName: cleanName.split(' ').slice(1).join(' ') || '',
          displayName: cleanName,
          rollNumber: rollNumber || null,
          role: 'student',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } else if (rollNumber && !existingProfile.rollNumber) {
        existingProfile.rollNumber = rollNumber;
      }
    }

    this.persistAll();

    // Async sync to server
    if (typeof fetch === 'function') {
      fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean, displayName: cleanName, role: effectiveRole, rollNumber })
      }).catch(() => {});
    }

    return user;
  }

  async syncWithServer() {
    if (typeof fetch !== 'function') return;
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.users)) {
          let updated = false;
          data.users.forEach(srvUser => {
            if (!srvUser.email) return;
            const clean = srvUser.email.toLowerCase();
            const existing = this.registeredUsers.find(u => u.email.toLowerCase() === clean);
            if (!existing) {
              this.registeredUsers.push({
                id: 'usr_' + (srvUser.role || 'student').slice(0, 3) + '_' + btoa(clean).replace(/=/g, '').slice(0, 10),
                email: clean,
                displayName: srvUser.displayName || clean.split('@')[0],
                role: srvUser.role || 'student',
                rollNumber: srvUser.rollNumber || null,
                status: srvUser.status || 'active',
                createdAt: srvUser.appointedAt || new Date().toISOString()
              });
              updated = true;
            }

            if (srvUser.role === 'student') {
              const prof = this.getStudentProfile(clean);
              if (!prof) {
                this.studentProfiles.push({
                  id: 'usr_std_' + Math.random().toString(36).substring(2, 10),
                  email: clean,
                  firstName: (srvUser.displayName || clean.split('@')[0]).split(' ')[0],
                  secondaryName: '',
                  displayName: srvUser.displayName || clean.split('@')[0],
                  rollNumber: srvUser.rollNumber || null,
                  role: 'student',
                  status: srvUser.status || 'active',
                  createdAt: srvUser.appointedAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                });
                updated = true;
              }
            }
          });

          if (updated) {
            this.persistAll();
          }
        }
      }
    } catch (_) {}
  }

  // --- Manager Account Management (Admin) ---
  getManagers() {
    return [...this.authorizedManagers];
  }

  getRepresentatives() {
    return [...this.representatives];
  }

  getUserRole(email) {
    if (!email) return 'student';
    const clean = email.trim().toLowerCase();
    if (clean === 'jeyaramandeeban@gmail.com' || clean === 'admin@saranathan.ac.in') return 'admin';
    const regUser = this.registeredUsers.find(u => u.email.toLowerCase() === clean);
    if (regUser && regUser.role) return regUser.role;
    if (this.representatives && this.representatives.some(r => r.email.toLowerCase() === clean && r.status === 'active')) return 'representative';
    if (this.isAuthorizedManager(clean)) return 'manager';
    return 'student';
  }

  isAuthorizedManager(email) {
    if (!email) return false;
    const clean = email.trim().toLowerCase();
    if (clean === 'jeyaramandeeban@gmail.com' || clean === 'admin@saranathan.ac.in') return true;
    return this.authorizedManagers.some(m => m.email.toLowerCase() === clean && m.status === 'active');
  }

  assignManager(email, displayName, actorEmail) {
    const clean = email.trim().toLowerCase();
    const existing = this.authorizedManagers.find(m => m.email.toLowerCase() === clean);
    if (existing) {
      existing.status = 'active';
      existing.displayName = displayName || existing.displayName;
    } else {
      const newManager = {
        id: 'usr_' + Math.random().toString(36).substring(2, 10),
        email: clean,
        displayName: displayName || clean.split('@')[0],
        role: 'manager',
        status: 'active',
        assignedAt: new Date().toISOString(),
        assignedBy: actorEmail
      };
      this.authorizedManagers.push(newManager);
    }
    this.logAction(actorEmail, 'ASSIGN_MANAGER', null, { managerEmail: clean });
    this.persistAll();
    return true;
  }

  revokeManager(email, actorEmail) {
    const clean = email.trim().toLowerCase();
    const existing = this.authorizedManagers.find(m => m.email.toLowerCase() === clean);
    if (existing) {
      existing.status = 'revoked';
      this.logAction(actorEmail, 'REVOKE_MANAGER', null, { managerEmail: clean });
      this.persistAll();
      return true;
    }
    return false;
  }

  // --- Folders & Resource Organization (7 Subject Separation & Custom Folders) ---
  getFolders(ownerEmail = null, actorRole = null) {
    if (actorRole === 'admin') return [...this.folders];
    const clean = (ownerEmail || '').toLowerCase();
    // Managers, Representatives, and Admins can see all 7 subject folders (isSubjectFolder / isShared / system)
    // plus any custom folders owned by the current user
    return this.folders.filter(f => 
      f.isSubjectFolder || 
      f.isShared || 
      f.ownerRole === 'system' || 
      (clean && f.ownerEmail && f.ownerEmail.toLowerCase() === clean)
    );
  }

  getFolderById(folderId) {
    if (!folderId) return null;
    return this.folders.find(f => f.id === folderId) || SYSTEM_SUBJECT_FOLDERS.find(f => f.id === folderId) || null;
  }

  getResourcesInFolder(folderId, actorUser = null) {
    const folder = this.getFolderById(folderId);
    if (!folder) return [];

    return this.resources.filter(r => {
      if (r.publicationStatus === 'trash') return false;

      // Belongs to this folder if explicit parentFolderId matches
      // OR if it's a subject folder and resource has matching subjectId and no other custom parentFolderId
      const isDirectMatch = r.parentFolderId === folderId;
      const isSubjectMatch = Boolean(
        folder.isSubjectFolder && 
        folder.subjectId && 
        r.subjectId === folder.subjectId &&
        (!r.parentFolderId || r.parentFolderId === 'root' || r.parentFolderId === folderId)
      );

      if (!isDirectMatch && !isSubjectMatch) return false;

      // Draft isolation & visibility checks
      if (r.publicationStatus === 'published') return true;
      if (!actorUser) return false;
      if (actorUser.role === 'admin' || actorUser.role === 'representative') return true;
      if (actorUser.role === 'manager') {
        return (r.ownerEmail && r.ownerEmail.toLowerCase() === (actorUser.email || '').toLowerCase()) ||
               (r.ownerId && r.ownerId === actorUser.id);
      }
      return false;
    });
  }

  createFolder({ name, ownerEmail, ownerRole, parentFolderId = 'root' }) {
    if (ownerRole === 'student') throw new Error('Permission denied: Students cannot create folders.');
    if (!name || !name.trim()) throw new Error('Folder name is required');
    const folder = {
      id: 'fld_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      ownerEmail: ownerEmail.toLowerCase(),
      ownerRole,
      parentFolderId,
      createdAt: new Date().toISOString()
    };
    this.folders.push(folder);
    this.logAction(ownerEmail, 'CREATE_FOLDER', null, { folderId: folder.id, name: folder.name });
    this.persistAll();
    return folder;
  }

  moveResource(resourceId, targetFolderId, actorUser) {
    const res = this.resources.find(r => r.id === resourceId);
    if (!res) throw new Error('Resource not found');
    const isOwner = (res.ownerId === actorUser.id) || (res.ownerEmail && res.ownerEmail.toLowerCase() === (actorUser.email || '').toLowerCase());
    if (!isOwner && actorUser.role !== 'admin' && actorUser.role !== 'representative') {
      throw new Error('Permission denied: You can only move your own resources.');
    }
    const targetFolder = this.getFolderById(targetFolderId);
    res.parentFolderId = targetFolderId;
    if (targetFolder && targetFolder.subjectId) {
      res.subjectId = targetFolder.subjectId;
    }
    res.updatedAt = new Date().toISOString();
    this.logAction(actorUser.email, 'MOVE_RESOURCE_FOLDER', resourceId, { 
      targetFolderId, 
      folderName: targetFolder ? targetFolder.name : targetFolderId 
    });
    this.persistAll();
    return res;
  }

  renameResource(resourceId, newTitle, actorUser) {
    const res = this.resources.find(r => r.id === resourceId);
    if (!res) throw new Error('Resource not found');
    const isOwner = (res.ownerId === actorUser.id) || (res.ownerEmail && res.ownerEmail.toLowerCase() === actorUser.email.toLowerCase());
    if (!isOwner && actorUser.role !== 'admin') {
      throw new Error('Permission denied: You can only rename your own resources.');
    }
    const oldTitle = res.title;
    res.title = newTitle.trim();
    res.updatedAt = new Date().toISOString();
    this.logAction(actorUser.email, 'RENAME_RESOURCE', resourceId, { oldTitle, newTitle: res.title });
    this.persistAll();
    return res;
  }

  deleteResource(id, actorUser, permanent = false) {
    const index = this.resources.findIndex(r => r.id === id);
    if (index === -1) throw new Error('Resource not found');
    const res = this.resources[index];
    const isOwner = (res.ownerId === actorUser.id) || (res.ownerEmail && res.ownerEmail.toLowerCase() === actorUser.email.toLowerCase());
    if (!isOwner && actorUser.role !== 'admin') {
      throw new Error('Permission denied: You can only delete your own resources.');
    }

    if (permanent) {
      if (actorUser.role !== 'admin' && !isOwner) {
        throw new Error('Permission denied: Permanent deletion restricted.');
      }
      this.resources.splice(index, 1);
      this.logAction(actorUser.email, 'PERMANENT_DELETE_RESOURCE', id, { title: res.title });
    } else {
      res.publicationStatus = 'trash';
      res.trashedAt = new Date().toISOString();
      res.trashedBy = actorUser.email;
      this.logAction(actorUser.email, 'MOVE_RESOURCE_TO_TRASH', id, { title: res.title });
    }
    this.persistAll();
    return true;
  }

  restoreResource(id, actorUser) {
    const res = this.resources.find(r => r.id === id);
    if (!res) throw new Error('Resource not found');
    const isOwner = (res.ownerId === actorUser.id) || (res.ownerEmail && res.ownerEmail.toLowerCase() === actorUser.email.toLowerCase());
    if (!isOwner && actorUser.role !== 'admin') {
      throw new Error('Permission denied');
    }
    res.publicationStatus = 'draft';
    res.trashedAt = null;
    res.trashedBy = null;
    res.updatedAt = new Date().toISOString();
    this.logAction(actorUser.email, 'RESTORE_RESOURCE_FROM_TRASH', id, { title: res.title });
    this.persistAll();
    return res;
  }

  // --- Notice Management (Standard IST Format) ---
  createNotice({ title, message, authorName, authorEmail, authorRole, isPinned = false }) {
    if (authorRole !== 'admin' && authorRole !== 'representative') {
      throw new Error('Permission denied: Only Administrators and Representatives can publish notices.');
    }
    if (!message || !message.trim()) {
      throw new Error('Notice message is required');
    }

    const istDate = getISTDateString();
    const formattedNotice = formatStandardNotice(message, authorName, authorRole);

    const notice = {
      id: 'notice_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      title: (title || 'Official Academic Notice').trim(),
      message: message.trim(),
      formattedNotice,
      istDate,
      authorName: authorName || 'Class Representative',
      authorEmail: authorEmail.toLowerCase(),
      authorRole,
      isPinned: !!isPinned,
      isPublished: true,
      createdAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      editHistory: []
    };

    this.notices.unshift(notice);
    this.logAction(authorEmail, 'CREATE_NOTICE', null, { noticeId: notice.id, title: notice.title });
    this.persistAll();
    return notice;
  }

  editNotice(noticeId, { title, message, isPinned }, actorEmail, actorRole) {
    if (actorRole !== 'admin' && actorRole !== 'representative') {
      throw new Error('Permission denied: Only Administrators and Representatives can edit notices.');
    }
    const notice = this.notices.find(n => n.id === noticeId);
    if (!notice) throw new Error('Notice not found');

    notice.editHistory.push({
      editedBy: actorEmail,
      editedAt: new Date().toISOString(),
      previousMessage: notice.message
    });

    if (title) notice.title = title.trim();
    if (message) {
      notice.message = message.trim();
      notice.formattedNotice = formatStandardNotice(notice.message, notice.authorName, notice.authorRole);
    }
    if (isPinned !== undefined) notice.isPinned = !!isPinned;
    notice.updatedAt = new Date().toISOString();

    this.logAction(actorEmail, 'EDIT_NOTICE', null, { noticeId });
    this.persistAll();
    return notice;
  }

  togglePinNotice(noticeId, actorEmail, actorRole) {
    if (actorRole !== 'admin' && actorRole !== 'representative') {
      throw new Error('Permission denied: Only Admins and Representatives can pin notices.');
    }
    const notice = this.notices.find(n => n.id === noticeId);
    if (!notice) throw new Error('Notice not found');
    notice.isPinned = !notice.isPinned;
    notice.updatedAt = new Date().toISOString();
    this.logAction(actorEmail, notice.isPinned ? 'PIN_NOTICE' : 'UNPIN_NOTICE', null, { noticeId });
    this.persistAll();
    return notice;
  }

  getPublishedNotices() {
    const published = this.notices.filter(n => n.isPublished);
    published.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return published;
  }

  getAllNotices(actorRole) {
    if (actorRole !== 'admin' && actorRole !== 'representative') {
      return this.getPublishedNotices();
    }
    const all = [...this.notices];
    all.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return all;
  }

  getNotices(actorRole = null) {
    return this.getAllNotices(actorRole || 'student');
  }

  deleteNotice(noticeId, actorEmail, actorRole) {
    if (actorRole !== 'admin' && actorRole !== 'representative') {
      throw new Error('Permission denied: Only Admins and Representatives can delete notices.');
    }
    const index = this.notices.findIndex(n => n.id === noticeId);
    if (index === -1) throw new Error('Notice not found');
    const notice = this.notices[index];
    this.notices.splice(index, 1);
    this.logAction(actorEmail, 'DELETE_NOTICE', null, { noticeId, title: notice.title });
    this.persistAll();
    return true;
  }

  getBans() {
    return [...this.bans];
  }

  isManagerAuthorized(email) {
    return this.isAuthorizedManager(email);
  }

  // --- Uploader Notifications ---
  notifyUploader(recipientEmail, data) {
    if (!recipientEmail) return;
    const notif = {
      id: 'notif_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      recipientEmail: recipientEmail.toLowerCase(),
      title: data.title,
      message: data.message,
      resourceId: data.resourceId,
      statusChange: data.statusChange,
      actorEmail: data.actorEmail,
      timestamp: new Date().toISOString(),
      read: false
    };
    this.notifications.unshift(notif);
    if (this.notifications.length > 100) this.notifications.pop();
    this.persistAll();
    return notif;
  }

  getNotifications(recipientEmail) {
    if (!recipientEmail) return [];
    const clean = recipientEmail.toLowerCase();
    return this.notifications.filter(n => n.recipientEmail.toLowerCase() === clean);
  }

  // --- Audit Logging ---
  logAction(actorEmail, action, resourceId = null, metadata = {}) {
    const entry = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      actorEmail: actorEmail || 'system',
      action,
      resourceId,
      metadata,
      createdAt: new Date().toISOString()
    };
    this.auditLogs.unshift(entry);
    // Keep max 200 logs locally
    if (this.auditLogs.length > 200) this.auditLogs.pop();
    this.persistAll();
    return entry;
  }

  getAuditLogs() {
    return [...this.auditLogs];
  }

  // --- Bug Reports Management (Telegram Admin Alerts & Persistence) ---
  async submitBugReport(reportData) {
    let result = null;

    try {
      const resp = await fetch('/api/bugs/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': reportData.reporterRole || 'student',
          'x-user-email': reportData.reporterEmail || ''
        },
        body: JSON.stringify(reportData)
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to submit bug report');
      }
      result = data.report;
    } catch (err) {
      console.warn('Backend /api/bugs/report request failed, using local offline fallback:', err);
      // Fallback local report creation if offline or dev server without API endpoint
      if (!result) {
        result = {
          id: 'BUG-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 900000) + 100000),
          title: reportData.title,
          category: reportData.category || 'Other',
          severity: reportData.severity || 'Medium',
          description: reportData.description,
          affectedPage: reportData.affectedPage || 'Dashboard',
          reporterName: reportData.reporterName || 'Anonymous',
          reporterEmail: reportData.reporterEmail || '',
          reporterRole: reportData.reporterRole || 'student',
          rollNumber: reportData.rollNumber || 'Not Set',
          submittedAt: new Date().toISOString(),
          istTimestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
          appVersion: '2.5.0-production',
          status: 'open',
          telegramDelivery: { sent: false, note: err.message }
        };
      }
    }

    // Cache locally for fast offline access
    try {
      const stored = JSON.parse(localStorage.getItem('sce_learning_bug_reports') || '[]');
      stored.unshift(result);
      if (stored.length > 50) stored.pop();
      localStorage.setItem('sce_learning_bug_reports', JSON.stringify(stored));
    } catch (e) {
      console.warn('Failed to cache bug report locally:', e);
    }

    return result;
  }

  async getBugReports(role = 'admin', email = '') {
    try {
      const resp = await fetch(`/api/bugs?role=${encodeURIComponent(role)}`, {
        headers: {
          'x-user-role': role,
          'x-user-email': email
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && Array.isArray(data.reports)) {
          return data.reports;
        }
      }
    } catch (err) {
      console.warn('Could not fetch server bug reports, using local fallback:', err);
    }

    // Local fallback
    try {
      return JSON.parse(localStorage.getItem('sce_learning_bug_reports') || '[]');
    } catch (e) {
      return [];
    }
  }

  async updateBugStatus(bugId, status, actorEmail, actorRole, resolutionNotes = '') {
    try {
      const resp = await fetch('/api/bugs/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': actorRole,
          'x-user-email': actorEmail
        },
        body: JSON.stringify({ bugId, status, actorEmail, actorRole, resolutionNotes })
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to update bug report status');
      }
      return data.report;
    } catch (err) {
      console.warn('Server status update failed, updating local copy:', err);
      try {
        const stored = JSON.parse(localStorage.getItem('sce_learning_bug_reports') || '[]');
        const idx = stored.findIndex(b => b.id === bugId);
        if (idx !== -1) {
          stored[idx].status = status;
          stored[idx].updatedAt = new Date().toISOString();
          if (resolutionNotes) stored[idx].resolutionNotes = resolutionNotes;
          localStorage.setItem('sce_learning_bug_reports', JSON.stringify(stored));
          return stored[idx];
        }
      } catch (e) {}
      throw err;
    }
  }
}

