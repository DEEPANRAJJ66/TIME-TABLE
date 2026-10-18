// Server-Enforced Moderation & RBAC Security Engine
// College Timetable App - Backend Enforcement
// Enforces:
// 1. Exact Role Hierarchy: Admin (Level 1) -> Representative (Level 2) -> Manager (Level 3) -> Student (Level 4)
// 2. Rule A: Admin-issued bans can only be unbanned by Admin.
// 3. Rule B: Representatives can ban/unban Students & Managers. Admin can also unban them. Cannot ban Admin.
// 4. Rule C: Managers can ban/unban Students only. Cannot ban other Managers, Reps, or Admin.
// 5. Rule D: Seven-day restriction: If Manager bans Student and Admin unbans, ONLY that Manager is restricted on that Student for 7 days.
// 6. Rule E: Ban requests during restriction: creates reviewable request without auto-banning.
// 7. Standard Asia/Kolkata notice format and validation.
// 8. Resource ownership, folder organisation, and draft isolation.

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export function getISTTimestamp(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(d) + ' IST';
}

// In-Memory Server Registry (Durable for server lifetime, falls back gracefully)
export const serverRoleRegistry = new Map(); // email -> { role, displayName, appointedBy, appointedAt }
export const serverBanRegistry = new Map(); // banId -> banRecord
export const server7DayRestrictions = new Map(); // key (managerEmail_studentEmail) -> restrictionRecord
export const serverBanRequests = new Map(); // reqId -> requestRecord
export const serverNotices = new Map(); // noticeId -> noticeRecord
export const serverFolders = new Map(); // folderId -> folderRecord
export const serverNotifications = new Map(); // notificationId -> notificationRecord
export const serverBugReports = new Map(); // bugId -> bugRecord
export const bugRateLimitMap = new Map(); // key (email or ip) -> [timestamps]
export const serverAuditLogs = [];

// Initialize default known administrators
serverRoleRegistry.set('jeyaramandeeban@gmail.com', {
  email: 'jeyaramandeeban@gmail.com',
  displayName: 'Deepanraj J',
  role: 'admin',
  appointedBy: 'SYSTEM',
  appointedAt: '2026-09-15T00:00:00Z'
});

serverRoleRegistry.set('admin@saranathan.ac.in', {
  email: 'admin@saranathan.ac.in',
  displayName: 'System Administrator',
  role: 'admin',
  appointedBy: 'SYSTEM',
  appointedAt: '2026-09-15T00:00:00Z'
});

export function serverRegisterUser({ email, displayName, role, rollNumber }) {
  if (!email) return null;
  const clean = email.trim().toLowerCase();
  const existing = serverRoleRegistry.get(clean);
  const effectiveRole = existing ? existing.role : (role || 'student');
  const record = {
    email: clean,
    displayName: displayName || (existing ? existing.displayName : clean.split('@')[0]),
    role: effectiveRole,
    rollNumber: rollNumber || (existing ? existing.rollNumber : null),
    appointedBy: existing ? existing.appointedBy : 'GOOGLE_SIGN_IN',
    appointedAt: existing ? existing.appointedAt : new Date().toISOString()
  };
  serverRoleRegistry.set(clean, record);
  return record;
}

// Pre-seeded 7 Subject Separation Folders
export const SERVER_SUBJECT_FOLDERS = [
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
    isPublic: true,
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
    isPublic: true,
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
    isPublic: true,
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
    isPublic: true,
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
    isPublic: true,
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
    isPublic: true,
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
    isPublic: true,
    ownerRole: 'system',
    ownerEmail: 'system@saranathan.ac.in',
    createdAt: '2026-09-15T00:00:00Z'
  }
];

SERVER_SUBJECT_FOLDERS.forEach(fld => {
  serverFolders.set(fld.id, fld);
});

// Seed default Manager
serverRoleRegistry.set('manager.cse@saranathan.ac.in', {
  email: 'manager.cse@saranathan.ac.in',
  displayName: 'CSE Resource Manager',
  role: 'manager',
  appointedBy: 'jeyaramandeeban@gmail.com',
  appointedAt: '2026-09-15T00:00:00Z'
});

/**
 * Format IST Date string: e.g. "16 October 2026"
 */
export function getISTDateString(date = new Date()) {
  const options = {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  };
  return new Intl.DateTimeFormat('en-GB', options).format(date);
}

/**
 * Format Standard Notice Template:
 * Date: [Automatically generated IST date]
 * Dear Friends,
 * [Notice message]
 * With regards,
 * [Sender's name]
 * [Sender's role]
 */
export function formatStandardNotice(message, senderName, senderRole, date = new Date()) {
  const istDate = getISTDateString(date);
  const roleTitle = senderRole === 'admin' ? 'Administrator' : 
                    senderRole === 'representative' ? 'Class Representative' : 
                    senderRole === 'manager' ? 'Resource Manager' : 'Student';
  return `Date: ${istDate}\n\nDear Friends,\n\n${message.trim()}\n\nWith regards,\n${senderName}\n${roleTitle}`;
}

/**
 * Resolve effective trusted role for an email address
 */
export function getTrustedUserRole(email) {
  if (!email) return 'student';
  const clean = email.trim().toLowerCase();
  if (clean === 'jeyaramandeeban@gmail.com' || clean === 'admin@saranathan.ac.in') {
    return 'admin';
  }
  const reg = serverRoleRegistry.get(clean);
  if (reg && reg.role) {
    return reg.role;
  }
  return 'student';
}

/**
 * Check if a user is currently banned
 */
export function isUserBanned(email) {
  if (!email) return null;
  const clean = email.trim().toLowerCase();
  const now = Date.now();
  for (const ban of serverBanRegistry.values()) {
    if (ban.targetEmail.toLowerCase() === clean && (ban.status === 'active' || ban.isActive)) {
      if (ban.expiresAt && new Date(ban.expiresAt).getTime() <= now) {
        ban.isActive = false;
        ban.status = 'expired';
        continue;
      }
      return ban;
    }
  }
  return null;
}

/**
 * Check Rule D: Seven-day restriction for a specific manager and student
 */
export function isManager7DayRestricted(managerEmail, studentEmail) {
  if (!managerEmail || !studentEmail) return false;
  const key = `${managerEmail.trim().toLowerCase()}__${studentEmail.trim().toLowerCase()}`;
  const restr = server7DayRestrictions.get(key);
  if (!restr || !restr.isActive) return false;

  const now = Date.now();
  if (new Date(restr.restrictionExpiresAt).getTime() <= now) {
    restr.isActive = false;
    return false;
  }
  return true;
}

/**
 * Log server audit entry
 */
export function logServerAudit(actorEmail, actorRole, action, target, metadata = {}) {
  const entry = {
    id: 'audit_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    actorEmail: actorEmail || 'system',
    actorRole: actorRole || 'system',
    action,
    target: target || null,
    metadata,
    timestamp: new Date().toISOString()
  };
  serverAuditLogs.unshift(entry);
  if (serverAuditLogs.length > 500) serverAuditLogs.pop();
  return entry;
}

/**
 * Server Moderation: Ban User with strict Rule A, B, C, D enforcement
 */
export function serverBanUser({ targetEmail, actorEmail, actorRole, banType = 'temporary', reason, durationHours = 24 }) {
  if (!targetEmail || !reason) {
    throw new Error('targetEmail and reason are required');
  }

  const cleanTarget = targetEmail.trim().toLowerCase();
  const cleanActor = actorEmail.trim().toLowerCase();
  const targetRole = getTrustedUserRole(cleanTarget);

  // Authority checks
  if (targetRole === 'admin') {
    throw new Error('SECURITY VIOLATION: An Administrator account cannot be banned.');
  }

  if (actorRole === 'manager') {
    if (targetRole !== 'student') {
      throw new Error(`Permission denied: Managers can only ban Students. Target is a ${targetRole}.`);
    }
    // Rule D: Check Seven-day restriction
    if (isManager7DayRestricted(cleanActor, cleanTarget)) {
      const err = new Error('ADMIN_7DAY_RESTRICTION_ACTIVE: This student was unbanned by an Administrator. A 7-day restriction is active for you. Please submit a "Request Admin to Ban".');
      err.code = 'ADMIN_7DAY_RESTRICTION_ACTIVE';
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
      throw new Error(`Permission denied: Representatives can only ban Students and Managers.`);
    }
  } else if (actorRole !== 'admin') {
    throw new Error('Permission denied: Unauthorized role to ban accounts.');
  }

  const startsAt = new Date().toISOString();
  const expiresAt = banType === 'temporary'
    ? new Date(Date.now() + (durationHours || 24) * 60 * 60 * 1000).toISOString()
    : null;

  const banId = 'ban_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
  const banRecord = {
    id: banId,
    targetEmail: cleanTarget,
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

  serverBanRegistry.set(banId, banRecord);
  const audit = logServerAudit(cleanActor, actorRole, 'BAN_USER', cleanTarget, { banType, reason, durationHours });
  banRecord.auditLogId = audit.id;

  return banRecord;
}

/**
 * Server Moderation: Unban User with strict Rule A, B, C, D enforcement
 */
export function serverUnbanUser({ targetEmail, actorEmail, actorRole }) {
  if (!targetEmail) throw new Error('targetEmail is required');
  const cleanTarget = targetEmail.trim().toLowerCase();
  const cleanActor = actorEmail.trim().toLowerCase();

  // Find active ban
  let activeBan = null;
  for (const ban of serverBanRegistry.values()) {
    if (ban.targetEmail.toLowerCase() === cleanTarget && (ban.status === 'active' || ban.isActive)) {
      activeBan = ban;
      break;
    }
  }

  if (!activeBan) {
    throw new Error('No active ban record found for this account.');
  }

  // Rule A — Admin-issued bans:
  // If the Admin bans an account, only an Admin can unban that account.
  if (activeBan.actorRole === 'admin' && actorRole !== 'admin') {
    throw new Error('Permission denied: Only an Administrator can lift an Admin-issued ban.');
  }

  // Rule B — Representative-issued bans:
  // Representatives and Admins can unban. Managers CANNOT unban.
  if (activeBan.actorRole === 'representative' && actorRole !== 'admin' && actorRole !== 'representative') {
    throw new Error('Permission denied: Managers cannot lift a Representative-issued ban.');
  }

  // Rule C — Manager-issued bans:
  // Managers, Representatives, and Admins can unban.

  activeBan.isActive = false;
  activeBan.status = 'unbanned';
  activeBan.unbannedAt = new Date().toISOString();
  activeBan.unbannedBy = cleanActor;
  activeBan.unbannedByRole = actorRole;

  // Rule D — Seven-day restriction:
  // If a Manager bans a Student and an Admin subsequently unbans that Student,
  // the Manager who issued the original ban cannot ban that same Student again for seven days
  // from the Admin's unban timestamp.
  if (actorRole === 'admin' && activeBan.actorRole === 'manager') {
    const restrictionStartsAt = new Date().toISOString();
    const restrictionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const key = `${activeBan.actorEmail.toLowerCase()}__${cleanTarget}`;

    server7DayRestrictions.set(key, {
      id: 'restr7d_' + Date.now().toString(36),
      managerEmail: activeBan.actorEmail.toLowerCase(),
      studentEmail: cleanTarget,
      unbannedByAdmin: cleanActor,
      originalBanId: activeBan.id,
      restrictionStartsAt,
      restrictionExpiresAt,
      isActive: true
    });

    logServerAudit(cleanActor, actorRole, 'ADMIN_SEVEN_DAY_RESTRICTION_STARTED', cleanTarget, {
      managerEmail: activeBan.actorEmail,
      expiresAt: restrictionExpiresAt
    });
  }

  logServerAudit(cleanActor, actorRole, 'UNBAN_USER', cleanTarget, { originalBanId: activeBan.id });
  return activeBan;
}

/**
 * Server Moderation: Submit Ban Request (Rule E)
 */
export function serverSubmitBanRequest({ managerEmail, studentEmail, reason }) {
  if (!managerEmail || !studentEmail || !reason) {
    throw new Error('managerEmail, studentEmail, and reason are required');
  }

  const reqId = 'req_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');
  const request = {
    id: reqId,
    managerEmail: managerEmail.trim().toLowerCase(),
    studentEmail: studentEmail.trim().toLowerCase(),
    reason: reason.trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
    notes: null
  };

  serverBanRequests.set(reqId, request);
  logServerAudit(managerEmail, 'manager', 'SUBMIT_BAN_REQUEST', studentEmail, { reason });
  return request;
}

/**
 * Server Moderation: Decide Ban Request (Admin / Representative)
 */
export function serverDecideBanRequest({ requestId, reviewerEmail, reviewerRole, decision, notes = '' }) {
  if (reviewerRole !== 'admin' && reviewerRole !== 'representative') {
    throw new Error('Permission denied: Only Admins and Representatives can decide ban requests.');
  }

  const req = serverBanRequests.get(requestId);
  if (!req) throw new Error('Ban request not found');

  req.status = decision; // 'approved' | 'rejected'
  req.decidedAt = new Date().toISOString();
  req.decidedBy = reviewerEmail;
  req.notes = notes;

  if (decision === 'approved') {
    serverBanUser({
      targetEmail: req.studentEmail,
      actorEmail: reviewerEmail,
      actorRole: reviewerRole,
      banType: reviewerRole === 'admin' ? 'permanent' : 'temporary',
      reason: `Approved Ban Request from ${req.managerEmail}: ${req.reason}`
    });
  }

  logServerAudit(reviewerEmail, reviewerRole, 'DECIDE_BAN_REQUEST', req.studentEmail, { requestId, decision, notes });
  return req;
}

/**
 * Server Role Management: Promote / Demote with exact hierarchy checks
 */
export function serverSetUserRole({ targetEmail, newRole, actorEmail, actorRole, displayName }) {
  if (actorRole !== 'admin') {
    throw new Error('Permission denied: Only Administrators can promote or demote users.');
  }

  const cleanTarget = (targetEmail || '').trim().toLowerCase();
  if (!cleanTarget) throw new Error('targetEmail is required');

  if (cleanTarget === 'jeyaramandeeban@gmail.com' || cleanTarget === 'admin@saranathan.ac.in') {
    throw new Error('SECURITY VIOLATION: System Administrator account cannot be modified.');
  }

  if (newRole === 'admin') {
    throw new Error('Permission denied: Direct creation of secondary Administrators is restricted.');
  }

  const validRoles = ['representative', 'manager', 'student'];
  if (!validRoles.includes(newRole)) {
    throw new Error(`Invalid role: ${newRole}. Must be representative, manager, or student.`);
  }

  const currentRole = getTrustedUserRole(cleanTarget);

  const record = {
    email: cleanTarget,
    displayName: displayName || cleanTarget.split('@')[0],
    role: newRole,
    appointedBy: actorEmail,
    appointedAt: new Date().toISOString()
  };

  serverRoleRegistry.set(cleanTarget, record);
  logServerAudit(actorEmail, actorRole, 'USER_ROLE_CHANGED', cleanTarget, {
    previousRole: currentRole,
    newRole
  });

  return { targetEmail: cleanTarget, previousRole: currentRole, newRole, record };
}

/**
 * Server Notice Management: Standard academic notice creation
 */
export function serverCreateNotice({ title, message, authorName, authorEmail, authorRole, isPinned = false }) {
  if (authorRole !== 'admin' && authorRole !== 'representative') {
    throw new Error('Permission denied: Only Administrators and Representatives can publish notices.');
  }
  if (!message || !message.trim()) {
    throw new Error('Notice message is required');
  }

  const noticeId = 'notif_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');
  const istDate = getISTDateString();
  const formattedNotice = formatStandardNotice(message, authorName, authorRole);

  const notice = {
    id: noticeId,
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

  serverNotices.set(noticeId, notice);
  logServerAudit(authorEmail, authorRole, 'NOTICE_PUBLISHED', noticeId, { title: notice.title, isPinned });
  return notice;
}

/**
 * Server Resource Ownership & Organization Validation
 */
export function validateResourceMutationAuthority(actorRole, actorEmail, resourceOwnerEmail) {
  if (actorRole === 'admin') return true;
  if (!actorEmail || !resourceOwnerEmail) return false;

  const isOwner = actorEmail.toLowerCase() === resourceOwnerEmail.toLowerCase();
  if (actorRole === 'representative') {
    // Representatives can manage resources within authority or their own
    return true;
  }
  if (actorRole === 'manager') {
    // Managers can ONLY modify their own files!
    return isOwner;
  }
  return false;
}

// ============================================================================
// IN-APP BUG REPORTING ENGINE & REPOSITORY
// Stores reports, rate limits submissions, deduplicates, and manages status
// ============================================================================

const BUG_REPORTS_FILE = path.resolve('data/bug_reports.json');

// Initialize store from local json if exists
try {
  if (fs.existsSync(BUG_REPORTS_FILE)) {
    const raw = fs.readFileSync(BUG_REPORTS_FILE, 'utf8');
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      list.forEach(item => {
        if (item && item.id) {
          serverBugReports.set(item.id, item);
        }
      });
    }
  }
} catch (e) {
  console.warn('Could not load bug_reports.json:', e.message);
}

function persistBugReports() {
  try {
    const list = Array.from(serverBugReports.values());
    const dir = path.dirname(BUG_REPORTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BUG_REPORTS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.warn('Could not persist bug reports:', e.message);
  }
}

export function checkBugRateLimit(key) {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const maxRequests = 5;

  const timestamps = (bugRateLimitMap.get(key) || []).filter(t => (now - t) < windowMs);
  if (timestamps.length >= maxRequests) {
    return false;
  }
  timestamps.push(now);
  bugRateLimitMap.set(key, timestamps);
  return true;
}

export function submitServerBugReport(reportInput = {}) {
  const title = (reportInput.title || '').trim();
  const category = (reportInput.category || '').trim();
  const severity = (reportInput.severity || '').trim();
  const description = (reportInput.description || '').trim();
  const affectedPage = (reportInput.affectedPage || 'Dashboard').trim();

  // 1. Validation
  if (!title || title.length < 3) {
    throw new Error('Bug title is required and must be at least 3 characters.');
  }
  if (title.length > 150) {
    throw new Error('Bug title cannot exceed 150 characters.');
  }
  if (!category) {
    throw new Error('Bug category is required.');
  }
  if (!severity || !['Low', 'Medium', 'High', 'Critical'].includes(severity)) {
    throw new Error('Severity must be Low, Medium, High, or Critical.');
  }
  if (!description || description.length < 10) {
    throw new Error('Description and reproduction steps must be at least 10 characters.');
  }
  if (description.length > 2000) {
    throw new Error('Description cannot exceed 2000 characters.');
  }

  // 2. Rate limiting check
  const rateLimitKey = (reportInput.reporterEmail || reportInput.clientIp || 'anonymous').toLowerCase();
  if (!checkBugRateLimit(rateLimitKey)) {
    throw new Error('Too many bug reports submitted in a short period. Please wait 5 minutes before submitting again.');
  }

  // 3. Duplicate submission prevention (same title & description from same user in last 15 seconds)
  const now = Date.now();
  for (const existing of serverBugReports.values()) {
    if (
      existing.reporterEmail?.toLowerCase() === rateLimitKey &&
      existing.title === title &&
      existing.description === description &&
      (now - new Date(existing.createdAt).getTime()) < 15000
    ) {
      return existing; // Return existing report to prevent duplicate Telegram notification
    }
  }

  // 4. Validate screenshot if present
  let screenshotMeta = null;
  if (reportInput.screenshot) {
    let mime = 'image/png';
    let size = 0;
    let dataUrl = '';

    if (typeof reportInput.screenshot === 'string') {
      dataUrl = reportInput.screenshot;
      const match = dataUrl.match(/^data:([^;]+);base64,/);
      if (match) {
        mime = match[1].toLowerCase();
      }
      const base64Content = dataUrl.replace(/^data:[^;]+;base64,/, '');
      size = Math.round((base64Content.length * 3) / 4);
    } else {
      const sc = reportInput.screenshot;
      mime = (sc.mimeType || sc.type || 'image/png').toLowerCase();
      size = sc.size || (sc.buffer ? sc.buffer.length : 0);
      dataUrl = sc.url || sc.dataUrl || '';
    }

    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (mime && !allowedMimes.includes(mime)) {
      throw new Error('Invalid screenshot type. Only PNG, JPEG, and WebP images are allowed.');
    }
    if (size > 5 * 1024 * 1024) {
      throw new Error('Screenshot file size exceeds 5MB limit.');
    }
    screenshotMeta = {
      filename: 'screenshot.' + (mime.split('/')[1] || 'png'),
      mimeType: mime,
      size,
      dataUrl
    };
  }

  // 5. Generate human-readable sequence ID BUG-YYYY-XXX
  const year = new Date().getFullYear();
  const count = serverBugReports.size + 1;
  const reportId = `BUG-${year}-${String(count).padStart(3, '0')}`;

  const istTimestamp = getISTTimestamp();
  const reporterRole = reportInput.reporterRole || 'student';
  const reporterEmail = (reportInput.reporterEmail || 'guest@student').toLowerCase();
  const reporterName = reportInput.reporterName || reportInput.displayName || 'Student User';
  const reporterRollNumber = reportInput.reporterRollNumber || reportInput.rollNumber || 'Not Set';

  const bugRecord = {
    id: reportId,
    title,
    category,
    severity,
    description,
    affectedPage,
    reporterName,
    reporterRole,
    reporterEmail,
    reporterRollNumber,
    rollNumber: reporterRollNumber,
    appVersion: reportInput.appVersion || 'v2.5.0-production',
    route: reportInput.route || '/learning.html',
    userAgent: reportInput.userAgent || 'Web Browser',
    submittedAt: istTimestamp,
    istTimestamp,
    createdAt: new Date().toISOString(),
    screenshot: screenshotMeta,
    screenshotUrl: screenshotMeta?.dataUrl || null,
    telegramDelivery: { sent: false, note: 'Pending dispatcher run' },
    telegramStatus: 'pending',
    telegramMessageId: null,
    status: 'open', // open | in_progress | resolved | closed
    resolutionNotes: null,
    resolvedAt: null,
    resolvedBy: null
  };

  serverBugReports.set(reportId, bugRecord);
  persistBugReports();

  logServerAudit(reporterEmail, reporterRole, 'BUG_REPORTED', reportId, {
    title,
    severity,
    category
  });

  return bugRecord;
}

export function getServerBugReports(actorRole) {
  if (actorRole !== 'admin') {
    throw new Error('Forbidden: Only Administrators can review confidential bug reports.');
  }
  return Array.from(serverBugReports.values()).reverse();
}

export function updateServerBugStatus(bugId, status, actorEmail, actorRole, resolutionNotes = '') {
  if (actorRole !== 'admin') {
    throw new Error('Forbidden: Only Administrators can modify bug report status.');
  }
  const bug = serverBugReports.get(bugId);
  if (!bug) {
    throw new Error(`Bug report ${bugId} not found.`);
  }

  const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}. Must be one of ${validStatuses.join(', ')}`);
  }

  bug.status = status;
  bug.updatedAt = new Date().toISOString();
  if (resolutionNotes) {
    bug.resolutionNotes = resolutionNotes;
  }
  if (status === 'resolved' || status === 'closed') {
    bug.resolvedAt = new Date().toISOString();
    bug.resolvedBy = actorEmail;
  }

  persistBugReports();
  logServerAudit(actorEmail, actorRole, 'BUG_STATUS_UPDATED', bugId, { status });
  return bug;
}
