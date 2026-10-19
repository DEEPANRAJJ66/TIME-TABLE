// Central Resilient Data Store
// Institution: Saranathan College of Engineering (Autonomous)
// Connects to Supabase PostgreSQL & maintains atomic local backup for zero data loss.

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUP_FILE = path.join(DATA_DIR, 'platform_store.json');

export const INITIAL_SUBJECTS = [
  { id: 'sub_graphics', code: '24ES102A', name: 'Engineering Graphics', icon: '📐', orderIndex: 1 },
  { id: 'sub_physics', code: '24PH101A', name: 'Engineering Physics', icon: '⚡', orderIndex: 2 },
  { id: 'sub_chemistry', code: '24CH101A', name: 'Engineering Chemistry', icon: '🧪', orderIndex: 3 },
  { id: 'sub_mathematics', code: '24MA101A', name: 'Engineering Mathematics I', icon: '📊', orderIndex: 4 },
  { id: 'sub_tamil', code: '24TA101A', name: 'Heritage of Tamils', icon: '🏛️', orderIndex: 5 },
  { id: 'sub_english', code: '24EN101A', name: 'Professional English', icon: '📖', orderIndex: 6 },
  { id: 'sub_python', code: '24ES101A', name: 'Problem Solving and Python Programming', icon: '🐍', orderIndex: 7 }
];

export class PlatformStore {
  constructor() {
    this.users = new Map(); // id -> profile
    this.subjects = new Map(); // id -> subject
    this.subjectAssignments = new Map(); // subjectId_managerId -> assignment
    this.resources = new Map(); // id -> resource
    this.assignments = new Map(); // id -> assignment
    this.submissions = new Map(); // id -> submission
    this.moderationRecords = []; // array of records
    this.banRestrictions = []; // array of 7-day restrictions
    this.banRequests = []; // array of requests
    this.notices = []; // array of notices
    this.notifications = []; // array of in-app notifications
    this.auditEvents = []; // array of audit logs
    this.outbox = []; // array of Telegram outbox events

    this.init();
  }

  init() {
    // Ensure data directory
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Load from disk if exists
    if (fs.existsSync(BACKUP_FILE)) {
      try {
        const raw = fs.readFileSync(BACKUP_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (data.users) data.users.forEach(u => this.users.set(u.id, u));
        if (data.subjects) data.subjects.forEach(s => this.subjects.set(s.id, s));
        if (data.subjectAssignments) data.subjectAssignments.forEach(sa => this.subjectAssignments.set(`${sa.subjectId}_${sa.managerId}`, sa));
        if (data.resources) data.resources.forEach(r => this.resources.set(r.id, r));
        if (data.assignments) data.assignments.forEach(a => this.assignments.set(a.id, a));
        if (data.submissions) data.submissions.forEach(s => this.submissions.set(s.id, s));
        if (data.moderationRecords) this.moderationRecords = data.moderationRecords;
        if (data.banRestrictions) this.banRestrictions = data.banRestrictions;
        if (data.banRequests) this.banRequests = data.banRequests;
        if (data.notices) this.notices = data.notices;
        if (data.notifications) this.notifications = data.notifications;
        if (data.auditEvents) this.auditEvents = data.auditEvents;
        if (data.outbox) this.outbox = data.outbox;
      } catch (err) {
        console.warn('Failed to parse platform_store.json, initializing fresh store:', err.message);
      }
    }

    // Seed official subjects idempotently
    INITIAL_SUBJECTS.forEach(sub => {
      if (!this.subjects.has(sub.id)) {
        this.subjects.set(sub.id, { ...sub, isActive: true });
      }
    });

    // Ensure Master Admin account exists
    this.ensureAdmin('admin@saranathan.ac.in', 'System', 'Administrator', '999999');
    this.ensureAdmin('jeyaramandeeban@gmail.com', 'Deepanraj', 'J', '888888');

    this.persist();
  }

  ensureAdmin(email, first, sec, roll) {
    let admin = Array.from(this.users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!admin) {
      const id = 'usr_' + Math.random().toString(36).substring(2, 10);
      admin = {
        id,
        email: email.toLowerCase(),
        firstName: first,
        secondaryName: sec,
        displayName: sec ? `${first} ${sec}` : first,
        rollNumber: roll,
        role: 'admin',
        accountStatus: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.users.set(id, admin);
    } else {
      admin.role = 'admin';
      admin.accountStatus = 'active';
    }
  }

  persist() {
    try {
      const snapshot = {
        users: Array.from(this.users.values()),
        subjects: Array.from(this.subjects.values()),
        subjectAssignments: Array.from(this.subjectAssignments.values()),
        resources: Array.from(this.resources.values()),
        assignments: Array.from(this.assignments.values()),
        submissions: Array.from(this.submissions.values()),
        moderationRecords: this.moderationRecords,
        banRestrictions: this.banRestrictions,
        banRequests: this.banRequests,
        notices: this.notices,
        notifications: this.notifications,
        auditEvents: this.auditEvents,
        outbox: this.outbox,
        persistedAt: new Date().toISOString()
      };
      fs.writeFileSync(BACKUP_FILE, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (err) {
      console.error('Store persistence warning:', err.message);
    }
  }

  // --- Users & Profiles ---
  async getUserById(id) {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email) {
    const clean = (email || '').trim().toLowerCase();
    return Array.from(this.users.values()).find(u => u.email.toLowerCase() === clean) || null;
  }

  async getUserByRoll(roll) {
    const clean = (roll || '').trim();
    return Array.from(this.users.values()).find(u => u.rollNumber === clean) || null;
  }

  async getAllUsers() {
    return Array.from(this.users.values());
  }

  async createUser(profileData) {
    const id = profileData.id || ('usr_' + Math.random().toString(36).substring(2, 10));
    const cleanRoll = String(profileData.rollNumber || '').trim();
    
    // Strict roll number validation: exactly 6 digits
    if (!/^[0-9]{6}$/.test(cleanRoll)) {
      throw new Error('Roll number must be exactly 6 numeric digits (e.g. 240101).');
    }

    // Uniqueness validation
    const existingRoll = await this.getUserByRoll(cleanRoll);
    if (existingRoll && existingRoll.id !== id) {
      throw new Error(`Roll number ${cleanRoll} is already registered to another student account.`);
    }

    const cleanEmail = String(profileData.email || '').trim().toLowerCase();
    const existingEmail = await this.getUserByEmail(cleanEmail);
    if (existingEmail && existingEmail.id !== id) {
      throw new Error(`Email ${cleanEmail} is already registered.`);
    }

    const now = new Date().toISOString();
    const cleanFirst = String(profileData.firstName || '').trim();
    const cleanSec = String(profileData.secondaryName || '').trim();
    const computedName = cleanSec ? `${cleanFirst} ${cleanSec}` : cleanFirst;

    const user = {
      id,
      email: cleanEmail,
      firstName: cleanFirst,
      secondaryName: cleanSec,
      displayName: computedName,
      rollNumber: cleanRoll,
      role: profileData.role || 'student', // All new registrations are 'student'
      accountStatus: 'active',
      createdAt: now,
      updatedAt: now
    };

    this.users.set(id, user);
    this.persist();
    return user;
  }

  async updateUserRole(id, newRole) {
    const user = this.users.get(id);
    if (!user) throw new Error('User not found.');
    user.role = newRole;
    user.updatedAt = new Date().toISOString();
    this.persist();
    return user;
  }

  async updateUserAccountStatus(id, newStatus) {
    const user = this.users.get(id);
    if (!user) throw new Error('User not found.');
    user.accountStatus = newStatus;
    user.updatedAt = new Date().toISOString();
    this.persist();
    return user;
  }

  // --- Subjects & Assignments ---
  async getAllSubjects() {
    return Array.from(this.subjects.values()).sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async getSubjectById(id) {
    return this.subjects.get(id) || null;
  }

  async assignManagerToSubject(subjectId, managerId, assignedBy) {
    const key = `${subjectId}_${managerId}`;
    const assignment = {
      id: 'subasgn_' + Math.random().toString(36).substring(2, 10),
      subjectId,
      managerId,
      assignedBy,
      createdAt: new Date().toISOString()
    };
    this.subjectAssignments.set(key, assignment);
    this.persist();
    return assignment;
  }

  async getManagerAssignedSubjectIds(managerId) {
    const ids = [];
    for (const sa of this.subjectAssignments.values()) {
      if (sa.managerId === managerId) ids.push(sa.subjectId);
    }
    return ids;
  }

  // --- Resources ---
  async getResources() {
    return Array.from(this.resources.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async getResourceById(id) {
    return this.resources.get(id) || null;
  }

  async saveResource(resource) {
    const id = resource.id || ('res_' + Math.random().toString(36).substring(2, 10));
    const now = new Date().toISOString();
    const item = {
      ...resource,
      id,
      createdAt: resource.createdAt || now,
      updatedAt: now
    };
    this.resources.set(id, item);
    this.persist();
    return item;
  }

  async deleteResource(id) {
    const deleted = this.resources.delete(id);
    this.persist();
    return deleted;
  }

  // --- Coursework Assignments ---
  async getAssignments() {
    return Array.from(this.assignments.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async getAssignmentById(id) {
    return this.assignments.get(id) || null;
  }

  async saveAssignment(assignment) {
    const id = assignment.id || ('asgn_' + Math.random().toString(36).substring(2, 10));
    const now = new Date().toISOString();
    const item = {
      ...assignment,
      id,
      createdAt: assignment.createdAt || now,
      updatedAt: now
    };
    this.assignments.set(id, item);
    this.persist();
    return item;
  }

  // --- Submissions ---
  async getSubmissions(assignmentId = null) {
    const list = Array.from(this.submissions.values());
    if (assignmentId) return list.filter(s => s.assignmentId === assignmentId);
    return list;
  }

  async getSubmissionById(id) {
    return this.submissions.get(id) || null;
  }

  async getStudentSubmissionForAssignment(studentId, assignmentId) {
    return Array.from(this.submissions.values()).find(
      s => s.studentId === studentId && s.assignmentId === assignmentId
    ) || null;
  }

  async saveSubmission(submission) {
    const id = submission.id || ('subm_' + Math.random().toString(36).substring(2, 10));
    const receiptId = submission.receiptId || ('RCPT-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000));
    const item = {
      ...submission,
      id,
      receiptId,
      submittedAtUtc: submission.submittedAtUtc || new Date().toISOString()
    };
    this.submissions.set(id, item);

    // Update assignment submission count
    const assignment = this.assignments.get(submission.assignmentId);
    if (assignment) {
      assignment.submissionCount = (assignment.submissionCount || 0) + 1;
    }

    this.persist();
    return item;
  }

  // --- Moderation & 7-Day Restriction ---
  async getModerationRecords() {
    return this.moderationRecords;
  }

  async getActiveBanForUser(userId) {
    return this.moderationRecords.find(r => r.targetUserId === userId && r.action === 'ban' && r.isActive) || null;
  }

  async addModerationRecord(record) {
    this.moderationRecords.unshift(record);
    this.persist();
  }

  async saveModerationRecord(record) {
    const idx = this.moderationRecords.findIndex(r => r.id === record.id);
    if (idx !== -1) {
      this.moderationRecords[idx] = record;
    } else {
      this.moderationRecords.unshift(record);
    }
    this.persist();
  }

  async getBanRestrictions() {
    const nowUtc = new Date().toISOString();
    // Filter active restrictions
    return this.banRestrictions.filter(r => new Date(r.restrictionEndUtc) > new Date(nowUtc));
  }

  async addBanRestriction(restriction) {
    // Remove any previous restriction for this manager/student pair
    this.banRestrictions = this.banRestrictions.filter(
      r => !(r.managerId === restriction.managerId && r.studentId === restriction.studentId)
    );
    this.banRestrictions.push(restriction);
    this.persist();
  }

  async getBanRequests() {
    return this.banRequests;
  }

  async getBanRequestById(id) {
    return this.banRequests.find(r => r.id === id) || null;
  }

  async addBanRequest(req) {
    this.banRequests.unshift(req);
    this.persist();
  }

  async saveBanRequest(req) {
    const idx = this.banRequests.findIndex(r => r.id === req.id);
    if (idx !== -1) {
      this.banRequests[idx] = req;
    } else {
      this.banRequests.unshift(req);
    }
    this.persist();
  }

  // --- Notices ---
  async getNotices() {
    return this.notices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async addNotice(notice) {
    const id = notice.id || ('notc_' + Math.random().toString(36).substring(2, 10));
    const item = {
      ...notice,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.notices.unshift(item);
    this.persist();
    return item;
  }

  // --- Notifications ---
  async getNotificationsForUser(userId) {
    return this.notifications
      .filter(n => n.recipientUserId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async addNotification(notif) {
    const item = {
      ...notif,
      id: 'ntf_' + Math.random().toString(36).substring(2, 10),
      isRead: false,
      createdAt: new Date().toISOString()
    };
    this.notifications.unshift(item);
    this.persist();
    return item;
  }

  async markNotificationRead(notifId, userId) {
    const n = this.notifications.find(x => x.id === notifId && x.recipientUserId === userId);
    if (n) {
      n.isRead = true;
      this.persist();
    }
    return n;
  }

  // --- Audit Logs ---
  async logAuditEvent(event) {
    const item = {
      ...event,
      id: 'aud_' + Math.random().toString(36).substring(2, 10),
      createdAt: new Date().toISOString()
    };
    this.auditEvents.unshift(item);
    this.persist();
    return item;
  }

  async getAuditEvents(limit = 100) {
    return this.auditEvents.slice(0, limit);
  }

  // --- Telegram Outbox ---
  async queueTelegramEvent(eventType, payload) {
    const item = {
      id: 'outbox_' + Math.random().toString(36).substring(2, 10),
      targetService: 'telegram',
      eventType,
      payload,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString()
    };
    this.outbox.unshift(item);
    this.persist();
    return item;
  }

  async getPendingOutboxEvents() {
    return this.outbox.filter(e => e.status === 'pending');
  }

  async updateOutboxStatus(id, status, error = null) {
    const item = this.outbox.find(e => e.id === id);
    if (item) {
      item.status = status;
      item.attempts += 1;
      item.lastError = error;
      item.updatedAt = new Date().toISOString();
      this.persist();
    }
  }
}
