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

export class LearningStore {
  constructor() {
    this.storageKeys = {
      categories: 'college_lr_cache_categories',
      subjects: 'college_lr_cache_subjects',
      resources: 'college_lr_cache_resources',
      auditLogs: 'college_lr_cache_audit_logs',
      managers: 'college_lr_cache_managers',
      settings: 'college_lr_cache_settings',
      profiles: 'college_lr_cache_student_profiles',
      bans: 'college_lr_cache_bans',
      banRestrictions72h: 'college_lr_cache_72h_restrictions',
      adminBanRequests: 'college_lr_cache_admin_ban_requests',
      lastSync: 'college_lr_cache_last_sync'
    };

    this.categories = [];
    this.subjects = [];
    this.resources = [];
    this.auditLogs = [];
    this.authorizedManagers = [];
    this.settings = {};
    this.studentProfiles = [];
    this.bans = [];
    this.banRestrictions72h = [];
    this.adminBanRequests = [];

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

    // 5. Audit Logs
    const cachedLogs = localStorage.getItem(this.storageKeys.auditLogs);
    this.auditLogs = cachedLogs ? JSON.parse(cachedLogs) : [
      {
        id: 1,
        actorEmail: 'admin@saranathan.ac.in',
        action: 'PLATFORM_INITIALIZATION',
        resourceId: null,
        metadata: { info: 'College Learning Resource Platform initialized' },
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

    // 7. Student Profiles, Bans & 72h Restrictions
    try {
      const cachedProfiles = localStorage.getItem(this.storageKeys.profiles);
      this.studentProfiles = cachedProfiles ? JSON.parse(cachedProfiles) : [];
      const cachedBans = localStorage.getItem(this.storageKeys.bans);
      this.bans = cachedBans ? JSON.parse(cachedBans) : [];
      const cachedRestr = localStorage.getItem(this.storageKeys.banRestrictions72h);
      this.banRestrictions72h = cachedRestr ? JSON.parse(cachedRestr) : [];
      const cachedReqs = localStorage.getItem(this.storageKeys.adminBanRequests);
      this.adminBanRequests = cachedReqs ? JSON.parse(cachedReqs) : [];
    } catch (_) {
      this.studentProfiles = [];
      this.bans = [];
      this.banRestrictions72h = [];
      this.adminBanRequests = [];
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
      localStorage.setItem(this.storageKeys.auditLogs, JSON.stringify(this.auditLogs));
      localStorage.setItem(this.storageKeys.settings, JSON.stringify(this.settings));
      localStorage.setItem(this.storageKeys.profiles, JSON.stringify(this.studentProfiles));
      localStorage.setItem(this.storageKeys.bans, JSON.stringify(this.bans));
      localStorage.setItem(this.storageKeys.banRestrictions72h, JSON.stringify(this.banRestrictions72h));
      localStorage.setItem(this.storageKeys.adminBanRequests, JSON.stringify(this.adminBanRequests));
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

    this.logAction(cleanEmail, 'STUDENT_PROFILE_SAVED', null, { rollNumber: cleanRoll });
    this.persistAll();
    return profile;
  }

  // --- Ban System & 72-Hour Restriction (Decision 4 & 5) ---
  isStudentBanned(email) {
    if (!email) return false;
    const clean = email.trim().toLowerCase();
    const now = Date.now();
    const activeBan = this.bans.find(b => b.targetEmail.toLowerCase() === clean && b.isActive);
    if (!activeBan) return false;
    if (activeBan.expiresAt && new Date(activeBan.expiresAt).getTime() <= now) {
      activeBan.isActive = false;
      this.persistAll();
      return false;
    }
    return activeBan;
  }

  is72hRestricted(email) {
    if (!email) return false;
    const clean = email.trim().toLowerCase();
    const now = Date.now();
    const activeRestriction = this.banRestrictions72h.find(r => r.studentEmail.toLowerCase() === clean && r.isActive);
    if (!activeRestriction) return false;
    if (new Date(activeRestriction.restrictionExpiresAt).getTime() <= now) {
      activeRestriction.isActive = false;
      this.persistAll();
      return false;
    }
    return true;
  }

  getBanDetails(email) {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    return this.bans.find(b => b.targetEmail.toLowerCase() === clean && b.isActive) || null;
  }

  banStudent({ studentEmail, actorEmail, actorRole, banType = 'temporary', reason, durationHours = 24 }) {
    if (!studentEmail || !reason) throw new Error('Student email and reason are required');
    const cleanStudent = studentEmail.trim().toLowerCase();
    const cleanActor = actorEmail.trim().toLowerCase();

    // Check 72h rule: Managers cannot ban if restricted
    if (actorRole === 'manager' && this.is72hRestricted(cleanStudent)) {
      const err = new Error('ADMIN_72H_RESTRICTION_ACTIVE: This student was unbanned by the Administrator. A 72-hour platform restriction is active. You cannot ban them directly; please use "Request Admin to Ban".');
      err.code = 'ADMIN_72H_RESTRICTION_ACTIVE';
      throw err;
    }

    // Decision 4: Managers can only impose temporary bans (e.g. 24h or 7d)
    if (actorRole === 'manager' && banType === 'permanent') {
      throw new Error('Permission denied: Managers can only issue temporary bans. Permanent bans require Admin action.');
    }

    const startsAt = new Date().toISOString();
    const expiresAt = banType === 'temporary' 
      ? new Date(Date.now() + (durationHours || 24) * 60 * 60 * 1000).toISOString()
      : null;

    const banRecord = {
      id: 'ban_' + Date.now().toString(36),
      targetEmail: cleanStudent,
      actorEmail: cleanActor,
      actorRole,
      banType,
      reason: reason.trim(),
      isActive: true,
      startsAt,
      expiresAt,
      createdAt: startsAt
    };

    this.bans.push(banRecord);
    this.logAction(cleanActor, 'BAN_STUDENT', null, { targetEmail: cleanStudent, banType, reason });
    this.persistAll();
    return banRecord;
  }

  unbanStudent({ studentEmail, actorEmail, actorRole }) {
    if (!studentEmail) throw new Error('Student email is required');
    const cleanStudent = studentEmail.trim().toLowerCase();
    const cleanActor = actorEmail.trim().toLowerCase();

    const ban = this.bans.find(b => b.targetEmail.toLowerCase() === cleanStudent && b.isActive);
    if (!ban) throw new Error('No active ban found for this student');

    // Only Admin can lift Admin ban
    if (ban.actorRole === 'admin' && actorRole !== 'admin') {
      throw new Error('Permission denied: Only an Administrator can lift an Admin-imposed ban.');
    }

    ban.isActive = false;
    ban.unbannedAt = new Date().toISOString();
    ban.unbannedBy = cleanActor;

    // Special 72-Hour Rule:
    // If Admin unbans a Student whose ban was imposed by a Manager:
    if (actorRole === 'admin' && ban.actorRole === 'manager') {
      const restrictionStartsAt = new Date().toISOString();
      const restrictionExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

      // Deactivate any existing 72h restrictions for this student and insert new one
      this.banRestrictions72h.forEach(r => {
        if (r.studentEmail.toLowerCase() === cleanStudent) r.isActive = false;
      });

      this.banRestrictions72h.push({
        id: 'restr_' + Date.now().toString(36),
        studentEmail: cleanStudent,
        unbannedByAdmin: cleanActor,
        originalManagerBanId: ban.id,
        restrictionStartsAt,
        restrictionExpiresAt,
        isActive: true
      });

      this.logAction(cleanActor, 'ADMIN_72H_RESTRICTION_STARTED', null, { studentEmail: cleanStudent, expiresAt: restrictionExpiresAt });
    }

    this.logAction(cleanActor, 'UNBAN_STUDENT', null, { targetEmail: cleanStudent });
    this.persistAll();
    return true;
  }

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

  // --- Manager Account Management (Admin) ---
  getManagers() {
    return [...this.authorizedManagers];
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
  }

  getAuditLogs() {
    return [...this.auditLogs];
  }
}
