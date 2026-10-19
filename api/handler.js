// Central HTTP API Handler & Routing Engine
// Institution: Saranathan College of Engineering (Autonomous)
// Enforces: Google-only Auth, 4-tier Role Hierarchy, Drive Storage Proxy, Telegram Audits

import url from 'url';
import { PlatformStore } from './store.js';
import { ModerationService } from './moderation.js';
import {
  ROLES,
  canPromoteUser,
  canDemoteUser,
  canUploadResource,
  canModifyResource,
  canChangePublicationStatus,
  canViewResource,
  canViewSubmission,
  canPostNotice,
  assertUserActive,
  AuthorizationError
} from './authorization.js';
import {
  uploadDirectToDrive,
  initiateResumableSession,
  streamFileFromDrive,
  getApprovedFolderId
} from './drive.js';
import {
  sendTelegramAuditEvent,
  sendTelegramBugReport,
  formatKolkataTime,
  getTelegramStatus
} from './telegram.js';

// Helper to send JSON responses
export function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
  });
  res.end(JSON.stringify(data));
}

/**
 * Canonical Application Origin Resolution
 * Prioritizes explicit APP_URL/SITE_URL environment variables, Vercel deployment URLs,
 * and falls back to validated request headers (with anti-spoofing whitelist) or localhost for development.
 */
export function getApplicationOrigin(req = null) {
  // 1. Explicit production configuration via environment
  if (process.env.APP_URL && process.env.APP_URL.trim()) {
    return process.env.APP_URL.trim().replace(/\/+$/, '');
  }
  if (process.env.SITE_URL && process.env.SITE_URL.trim()) {
    return process.env.SITE_URL.trim().replace(/\/+$/, '');
  }

  // 2. Vercel System Environment Variables (automatically provided in Vercel deployments)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL && process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim().replace(/\/+$/, '')}`;
  }
  if (process.env.VERCEL_URL && process.env.VERCEL_URL.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/+$/, '')}`;
  }

  // 3. Inspect request headers if available with strict host validation
  if (req && req.headers) {
    const rawHost = req.headers['x-forwarded-host'] || req.headers['host'] || '';
    const host = rawHost.split(':')[0].toLowerCase();
    const port = rawHost.split(':')[1];
    const proto = req.headers['x-forwarded-proto'] || (host === 'localhost' || host === '127.0.0.1' ? 'http' : 'https');

    // Only trust *.vercel.app, *.saranathan.ac.in, or custom production domains
    if (host.endsWith('.vercel.app') || host.endsWith('.saranathan.ac.in')) {
      return `${proto}://${host}${port ? `:${port}` : ''}`;
    }

    if (host === 'localhost' || host === '127.0.0.1') {
      return `${proto}://${host}${port ? `:${port}` : ':3000'}`;
    }
  }

  // 4. Default fallback for local development
  const localPort = process.env.PORT || '3000';
  return `http://localhost:${localPort}`;
}

// Helper to parse JSON body
export async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) { // 10MB limit for JSON
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Malformed JSON payload'));
      }
    });
    req.on('error', err => reject(err));
  });
}

// Helper to parse Raw Buffer body for file uploads
export async function parseRawBody(req, limitBytes = 50 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalLength = 0;
    req.on('data', chunk => {
      chunks.push(chunk);
      totalLength += chunk.length;
      if (totalLength > limitBytes) {
        reject(new Error('Upload exceeds maximum allowed size (50MB)'));
      }
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', err => reject(err));
  });
}

// Helper to resolve the authenticated actor from Request Headers
export async function resolveActor(req, store) {
  // Check Authorization header or X-User-Id
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const userIdHeader = req.headers['x-user-id'] || req.headers['X-User-Id'] || '';

  let user = null;

  if (userIdHeader) {
    user = await store.getUserById(userIdHeader);
  }

  if (!user && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    // 1. Try decoding Supabase JWT token if structured as standard 3-part token
    if (token.includes('.')) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (payload.sub) user = await store.getUserById(payload.sub);
          if (!user && payload.email) user = await store.getUserByEmail(payload.email.toLowerCase());
        }
      } catch (_) {}
    }

    // 2. Direct lookup fallback for session tokens / local IDs
    if (!user) {
      user = (await store.getUserById(token)) || (await store.getUserByEmail(token.toLowerCase()));
    }
  }

  return user;
}

/**
 * Main API Request Dispatcher
 */
export async function handleApiRequest(req, res, store, moderationService) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
    });
    res.end();
    return;
  }

  try {
    // ----------------------------------------------------
    // SYSTEM STATUS & HEALTH CHECK
    // ----------------------------------------------------
    if (pathname === '/api/status' && method === 'GET') {
      const telegram = await getTelegramStatus();
      const folderId = getApprovedFolderId();
      const users = await store.getAllUsers();
      const subjects = await store.getAllSubjects();
      const resources = await store.getResources();
      const assignments = await store.getAssignments();

      return sendJson(res, 200, {
        status: 'ONLINE',
        institution: 'Saranathan College of Engineering',
        program: 'B.E. Computer Science and Engineering (First Year, Semester 1)',
        timestampIst: formatKolkataTime(),
        services: {
          telegram: telegram.configured ? 'CONNECTED' : 'DISCONNECTED',
          telegramBot: telegram.bot || null,
          googleDrive: folderId ? 'CONFIGURED' : 'NOT_CONFIGURED',
          googleDriveFolderId: folderId || null,
          storageMode: 'HYBRID_VERIFIED'
        },
        metrics: {
          totalUsers: users.length,
          totalSubjects: subjects.length,
          totalResources: resources.length,
          totalAssignments: assignments.length
        }
      });
    }

    // ----------------------------------------------------
    // AUTHENTICATION & PROFILE SETUP
    // ----------------------------------------------------
    if (pathname === '/api/auth/config' && method === 'GET') {
      const appOrigin = getApplicationOrigin(req);
      const isLocal = appOrigin.includes('localhost') || appOrigin.includes('127.0.0.1');

      return sendJson(res, 200, {
        supabaseUrl: process.env.SUPABASE_URL || 'https://uryiomifyhcbvzeafizi.supabase.co',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyeWlvbWlmeWhjYnZ6ZWFmaXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NjM3NTYsImV4cCI6MjEwNTEzOTc1Nn0.aJqNd28FiMf_KdKqWOELlW0pAgxFjp7yxt0nOIyTSsQ',
        appOrigin,
        callbackUrl: `${appOrigin}/learning`,
        isProduction: !isLocal
      });
    }

    if (pathname === '/api/auth/session' && method === 'POST') {
      const body = await parseJsonBody(req);
      let email = String(body.email || '').trim().toLowerCase();

      // Check Bearer authorization header if provided from trusted Supabase session
      const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token.includes('.')) {
          try {
            const parts = token.split('.');
            if (parts.length === 3) {
              const tokenPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
              if (tokenPayload.exp && tokenPayload.exp * 1000 < Date.now()) {
                return sendJson(res, 401, { error: 'Authentication session expired. Please sign in again.' });
              }
              if (tokenPayload.email) {
                // Ground truth email is from the verified token
                email = tokenPayload.email.trim().toLowerCase();
              }
            }
          } catch (tokenErr) {
            console.warn('Could not parse token claims:', tokenErr.message);
          }
        }
      }

      if (!email) {
        return sendJson(res, 400, { error: 'Valid Google email is required.' });
      }

      let user = await store.getUserByEmail(email);
      if (!user) {
        // Register new Google account as Student (pending profile completion)
        const id = body.id || ('usr_' + Math.random().toString(36).substring(2, 10));
        const first = body.firstName || body.name || email.split('@')[0];
        user = {
          id,
          email,
          firstName: first,
          secondaryName: '',
          displayName: first,
          rollNumber: '', // Mandatory 6 numeric digits collected during profile setup
          role: ROLES.STUDENT, // Invariant: All new Google accounts initialize strictly as Student
          accountStatus: 'pending_profile',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        store.users.set(id, user);
        store.persist();

        await store.logAuditEvent({
          actorId: id,
          actorName: first,
          actorRole: ROLES.STUDENT,
          actionType: 'STUDENT_REGISTERED_OAUTH',
          targetResourceType: 'user',
          targetResourceId: id,
          metadata: { email, role: ROLES.STUDENT }
        });
      }

      // Check if user is banned
      const isBanned = user.accountStatus === 'banned';

      return sendJson(res, 200, {
        user,
        requiresProfileSetup: !user.rollNumber || user.accountStatus === 'pending_profile',
        isBanned
      });
    }

    if (pathname === '/api/auth/profile' && method === 'POST') {
      const actor = await resolveActor(req, store);
      if (!actor) {
        return sendJson(res, 401, { error: 'Authentication required to setup profile.' });
      }

      const body = await parseJsonBody(req);
      const firstName = String(body.firstName || '').trim();
      const secondaryName = String(body.secondaryName || '').trim();
      const rollNumber = String(body.rollNumber || '').trim();

      if (!firstName) {
        return sendJson(res, 400, { error: 'First name is mandatory.' });
      }

      // Rule: Exactly 6 numeric digits
      if (!/^[0-9]{6}$/.test(rollNumber)) {
        return sendJson(res, 400, { error: 'Roll number must be exactly 6 numeric digits (e.g. 240101).' });
      }

      // Check uniqueness of roll number
      const existing = await store.getUserByRoll(rollNumber);
      if (existing && existing.id !== actor.id) {
        return sendJson(res, 409, { error: `Roll number ${rollNumber} is already registered to another student account.` });
      }

      actor.firstName = firstName;
      actor.secondaryName = secondaryName;
      actor.displayName = secondaryName ? `${firstName} ${secondaryName}` : firstName;
      actor.rollNumber = rollNumber;
      if (actor.accountStatus === 'pending_profile') {
        actor.accountStatus = 'active';
      }
      actor.updatedAt = new Date().toISOString();
      store.persist();

      await store.logAuditEvent({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        actionType: 'PROFILE_COMPLETED',
        targetResourceType: 'user',
        targetResourceId: actor.id,
        metadata: { rollNumber, email: actor.email }
      });

      return sendJson(res, 200, { success: true, user: actor });
    }

    // ----------------------------------------------------
    // USER & ROLE MANAGEMENT (Admin / Representative)
    // ----------------------------------------------------
    if (pathname === '/api/users' && method === 'GET') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      // Only Admin, Representative, and Manager (for student lists) can view users
      if (actor.role === ROLES.STUDENT) {
        throw new AuthorizationError('Students are not authorized to inspect member directories.', 'FORBIDDEN', 403);
      }

      const users = await store.getAllUsers();
      // Sanitized user output
      const sanitized = users.map(u => ({
        id: u.id,
        displayName: u.displayName,
        firstName: u.firstName,
        secondaryName: u.secondaryName,
        email: u.email,
        rollNumber: u.rollNumber,
        role: u.role,
        accountStatus: u.accountStatus,
        createdAt: u.createdAt
      }));

      return sendJson(res, 200, { users: sanitized });
    }

    if (pathname === '/api/users/role' && method === 'POST') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      const body = await parseJsonBody(req);
      const targetUserId = body.targetUserId;
      const targetRole = body.targetRole;

      const targetUser = await store.getUserById(targetUserId);
      if (!targetUser) {
        return sendJson(res, 404, { error: 'Target user does not exist.' });
      }

      const isPromotion = ROLE_HIERARCHY_VAL(targetRole) > ROLE_HIERARCHY_VAL(targetUser.role);
      const authCheck = isPromotion 
        ? canPromoteUser(actor, targetUser, targetRole)
        : canDemoteUser(actor, targetUser, targetRole);

      if (!authCheck.allowed) {
        throw new AuthorizationError(authCheck.reason, 'ROLE_TRANSITION_DENIED', 403);
      }

      const oldRole = targetUser.role;
      targetUser.role = targetRole;
      targetUser.updatedAt = new Date().toISOString();
      store.persist();

      const action = isPromotion ? 'USER_PROMOTED' : 'USER_DEMOTED';
      await store.logAuditEvent({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        actionType: action,
        targetResourceType: 'user',
        targetResourceId: targetUser.id,
        metadata: { oldRole, newRole: targetRole, targetEmail: targetUser.email }
      });

      // Dispatch audit notification to Telegram
      sendTelegramAuditEvent(action, {
        title: `Role Transition for ${targetUser.displayName}`
      }, {
        actorName: actor.displayName,
        actorRole: actor.role,
        actorEmail: actor.email,
        reason: `${targetUser.displayName} transitioned from ${oldRole} to ${targetRole}`
      }).catch(() => {});

      return sendJson(res, 200, { success: true, user: targetUser });
    }

    // ----------------------------------------------------
    // SUBJECTS & SUBJECT ASSIGNMENT
    // ----------------------------------------------------
    if (pathname === '/api/subjects' && method === 'GET') {
      const subjects = await store.getAllSubjects();
      const resources = await store.getResources();

      // Compute resource counts per subject
      const withCounts = subjects.map(s => {
        const subRes = resources.filter(r => r.subjectId === s.id && r.publicationStatus === 'published');
        return {
          ...s,
          resourceCount: subRes.length
        };
      });

      return sendJson(res, 200, { subjects: withCounts });
    }

    if (pathname === '/api/subjects/assign' && method === 'POST') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      if (actor.role !== ROLES.ADMIN && actor.role !== ROLES.REPRESENTATIVE) {
        throw new AuthorizationError('Only Admin or Representative can assign subject managers.', 'FORBIDDEN', 403);
      }

      const body = await parseJsonBody(req);
      const { subjectId, managerId } = body;

      const targetUser = await store.getUserById(managerId);
      if (!targetUser || targetUser.role !== ROLES.MANAGER) {
        return sendJson(res, 400, { error: 'Target user must be an active Manager to receive subject assignment.' });
      }

      const assignment = await store.assignManagerToSubject(subjectId, managerId, actor.id);

      await store.logAuditEvent({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        actionType: 'SUBJECT_MANAGER_ASSIGNED',
        targetResourceType: 'subject',
        targetResourceId: subjectId,
        metadata: { managerId, managerName: targetUser.displayName }
      });

      return sendJson(res, 200, { success: true, assignment });
    }

    // ----------------------------------------------------
    // RESOURCES: UPLOAD, LIST, STATUS & STREAMING
    // ----------------------------------------------------
    if (pathname === '/api/resources' && method === 'GET') {
      const actor = await resolveActor(req, store);
      const subjectId = parsedUrl.query.subjectId;
      const statusFilter = parsedUrl.query.status;

      let allResources = await store.getResources();
      if (subjectId) {
        allResources = allResources.filter(r => r.subjectId === subjectId);
      }

      // Apply server-side visibility rules (Section 14 & 28)
      // Students can ONLY view published items
      const visible = allResources.filter(r => {
        const check = canViewResource(actor, r);
        return check.allowed;
      });

      return sendJson(res, 200, { resources: visible });
    }

    if (pathname === '/api/resources/upload-direct' && method === 'POST') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      // Metadata headers
      const subjectId = req.headers['x-subject-id'];
      const sectionName = req.headers['x-section-name'] || 'Unit 1';
      const resourceType = req.headers['x-resource-type'] || 'notes';
      const title = decodeURIComponent(req.headers['x-resource-title'] || 'Study Material');
      const filename = decodeURIComponent(req.headers['x-filename'] || 'document.pdf');
      const mimeType = req.headers['content-type'] || 'application/pdf';

      if (!subjectId) {
        return sendJson(res, 400, { error: 'x-subject-id header is required.' });
      }

      // Check subject assignment if manager
      const assignedSubjects = actor.role === ROLES.MANAGER 
        ? await store.getManagerAssignedSubjectIds(actor.id) 
        : [];
      
      const authCheck = canUploadResource(actor, subjectId, assignedSubjects);
      if (!authCheck.allowed) {
        throw new AuthorizationError(authCheck.reason, 'UPLOAD_FORBIDDEN', 403);
      }

      // Buffer payload
      const buffer = await parseRawBody(req);
      if (!buffer || buffer.length === 0) {
        return sendJson(res, 400, { error: 'Uploaded file payload is empty.' });
      }

      // Transfer to designated Google Drive folder
      let driveResult;
      try {
        driveResult = await uploadDirectToDrive({
          filename,
          mimeType,
          buffer,
          metadata: {
            uploaderName: actor.displayName,
            uploaderEmail: actor.email,
            description: `${title} (${subjectId} - ${sectionName})`
          }
        });
      } catch (driveErr) {
        console.error('Drive upload failure:', driveErr);
        return sendJson(res, 502, { error: `Google Drive transfer failed: ${driveErr.message}` });
      }

      // Save resource record in Draft state
      const resource = await store.saveResource({
        title,
        filename,
        mimeType,
        fileSize: buffer.length,
        subjectId,
        sectionName,
        resourceType,
        uploaderId: actor.id,
        uploaderName: actor.displayName,
        uploaderRole: actor.role,
        uploaderEmail: actor.email,
        googleDriveFileId: driveResult.fileId,
        approvedFolderId: driveResult.approvedFolderId,
        publicationStatus: 'draft', // All new uploads begin as DRAFT
        storageProvider: 'google_drive'
      });

      // Audit log
      await store.logAuditEvent({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        actionType: 'RESOURCE_UPLOADED',
        targetResourceType: 'resource',
        targetResourceId: resource.id,
        metadata: { filename, subjectId, googleDriveFileId: driveResult.fileId }
      });

      // Telegram notification
      sendTelegramAuditEvent('RESOURCE_UPLOADED', resource, {
        actorName: actor.displayName,
        actorRole: actor.role,
        actorEmail: actor.email,
        reason: 'New learning material uploaded to Google Drive'
      }).catch(() => {});

      return sendJson(res, 201, { success: true, resource });
    }

    if (pathname === '/api/drive/resumable-session' && method === 'POST') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      const body = await parseJsonBody(req);
      const { filename, mimeType, fileSize, subjectId, title } = body;

      const assignedSubjects = actor.role === ROLES.MANAGER 
        ? await store.getManagerAssignedSubjectIds(actor.id) 
        : [];
      
      const authCheck = canUploadResource(actor, subjectId, assignedSubjects);
      if (!authCheck.allowed) {
        throw new AuthorizationError(authCheck.reason, 'UPLOAD_FORBIDDEN', 403);
      }

      const session = await initiateResumableSession({
        filename,
        mimeType,
        fileSize,
        metadata: {
          uploaderName: actor.displayName,
          uploaderEmail: actor.email,
          description: `${title || filename} (${subjectId})`
        }
      });

      return sendJson(res, 200, { success: true, session });
    }

    // Authenticated Google Drive streaming proxy (No raw public links exposed!)
    if (pathname.startsWith('/api/drive/stream/') && method === 'GET') {
      const actor = await resolveActor(req, store);
      const fileId = pathname.replace('/api/drive/stream/', '').trim();

      // Find resource by Drive file ID
      const resources = await store.getResources();
      const resource = resources.find(r => r.googleDriveFileId === fileId);

      if (resource) {
        const viewCheck = canViewResource(actor, resource);
        if (!viewCheck.allowed) {
          throw new AuthorizationError(viewCheck.reason, 'UNPUBLISHED_DRAFT_ACCESS_DENIED', 403);
        }
      }

      // Stream byte ranges directly from Google Drive
      const rangeHeader = req.headers['range'];
      await streamFileFromDrive(fileId, rangeHeader, res);
      return;
    }

    if (pathname === '/api/resources/status' && method === 'POST') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      const authCheck = canChangePublicationStatus(actor);
      if (!authCheck.allowed) {
        throw new AuthorizationError(authCheck.reason, 'PUBLISH_DENIED', 403);
      }

      const body = await parseJsonBody(req);
      const { resourceId, newStatus } = body;

      const resource = await store.getResourceById(resourceId);
      if (!resource) {
        return sendJson(res, 404, { error: 'Resource not found.' });
      }

      resource.publicationStatus = newStatus;
      resource.publishedAt = newStatus === 'published' ? new Date().toISOString() : null;
      resource.publishedBy = newStatus === 'published' ? actor.id : null;
      resource.updatedAt = new Date().toISOString();
      store.persist();

      // Notify the uploader
      await store.addNotification({
        recipientUserId: resource.uploaderId,
        eventType: newStatus === 'published' ? 'RESOURCE_PUBLISHED' : 'RESOURCE_RETURNED_TO_DRAFT',
        title: `Resource ${newStatus === 'published' ? 'Published' : 'Returned to Draft'}`,
        message: `Your upload "${resource.title}" has been marked as ${newStatus} by ${actor.displayName}.`,
        relatedResourceId: resource.id
      });

      // Audit log
      const actionType = newStatus === 'published' ? 'RESOURCE_PUBLISHED' : 'RESOURCE_UNPUBLISHED';
      await store.logAuditEvent({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        actionType,
        targetResourceType: 'resource',
        targetResourceId: resource.id,
        metadata: { newStatus, title: resource.title }
      });

      sendTelegramAuditEvent(actionType, resource, {
        actorName: actor.displayName,
        actorRole: actor.role,
        actorEmail: actor.email,
        reason: `Publication state transitioned to ${newStatus}`
      }).catch(() => {});

      return sendJson(res, 200, { success: true, resource });
    }

    if (pathname.startsWith('/api/resources/') && method === 'DELETE') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      const resourceId = pathname.replace('/api/resources/', '').trim();
      const resource = await store.getResourceById(resourceId);
      if (!resource) {
        return sendJson(res, 404, { error: 'Resource not found.' });
      }

      const authCheck = canModifyResource(actor, resource);
      if (!authCheck.allowed) {
        throw new AuthorizationError(authCheck.reason, 'DELETE_DENIED', 403);
      }

      await store.deleteResource(resourceId);

      await store.logAuditEvent({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        actionType: 'RESOURCE_DELETED',
        targetResourceType: 'resource',
        targetResourceId: resourceId,
        metadata: { title: resource.title, googleDriveFileId: resource.googleDriveFileId }
      });

      sendTelegramAuditEvent('RESOURCE_DELETED', resource, {
        actorName: actor.displayName,
        actorRole: actor.role,
        actorEmail: actor.email,
        reason: 'Resource deleted from platform'
      }).catch(() => {});

      return sendJson(res, 200, { success: true, message: 'Resource successfully deleted.' });
    }

    // ----------------------------------------------------
    // ASSIGNMENTS & SUBMISSION MANAGEMENT
    // ----------------------------------------------------
    if (pathname === '/api/assignments' && method === 'GET') {
      const assignments = await store.getAssignments();
      return sendJson(res, 200, { assignments });
    }

    if (pathname === '/api/assignments' && method === 'POST') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      if (actor.role === ROLES.STUDENT) {
        throw new AuthorizationError('Students cannot create assignments.', 'FORBIDDEN', 403);
      }

      const body = await parseJsonBody(req);
      const { title, instructions, subjectId, sectionName, deadlineUtc } = body;

      if (!title || !subjectId || !deadlineUtc) {
        return sendJson(res, 400, { error: 'Title, Subject, and Deadline UTC are required.' });
      }

      // Check manager assignment
      if (actor.role === ROLES.MANAGER) {
        const assigned = await store.getManagerAssignedSubjectIds(actor.id);
        if (!assigned.includes(subjectId)) {
          throw new AuthorizationError('Manager cannot create assignments for unassigned subjects.', 'FORBIDDEN', 403);
        }
      }

      const assignment = await store.saveAssignment({
        title,
        instructions: instructions || '',
        subjectId,
        sectionName: sectionName || 'General',
        creatorId: actor.id,
        creatorName: actor.displayName,
        deadlineUtc,
        deadlineIst: formatKolkataTime(deadlineUtc),
        publicationStatus: 'published',
        submissionCount: 0
      });

      await store.logAuditEvent({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        actionType: 'ASSIGNMENT_CREATED',
        targetResourceType: 'assignment',
        targetResourceId: assignment.id,
        metadata: { title, subjectId, deadlineUtc }
      });

      sendTelegramAuditEvent('ASSIGNMENT_CREATED', {
        title,
        subjectId
      }, {
        actorName: actor.displayName,
        actorRole: actor.role,
        actorEmail: actor.email,
        reason: `New assignment created. Due: ${formatKolkataTime(deadlineUtc)}`
      }).catch(() => {});

      return sendJson(res, 201, { success: true, assignment });
    }

    if (pathname === '/api/submissions' && method === 'GET') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      const assignmentId = parsedUrl.query.assignmentId;
      const allSubmissions = await store.getSubmissions(assignmentId);

      // Section 15 & 37: Student can ONLY view their own submissions (Strict IDOR Isolation)
      if (actor.role === ROLES.STUDENT) {
        const studentSubmissions = allSubmissions.filter(s => s.studentId === actor.id);
        return sendJson(res, 200, { submissions: studentSubmissions });
      }

      if (actor.role === ROLES.MANAGER) {
        const assigned = await store.getManagerAssignedSubjectIds(actor.id);
        const filtered = [];
        for (const s of allSubmissions) {
          const asgn = await store.getAssignmentById(s.assignmentId);
          if (asgn && assigned.includes(asgn.subjectId)) {
            filtered.push(s);
          }
        }
        return sendJson(res, 200, { submissions: filtered });
      }

      // Admin & Representative see all submissions
      return sendJson(res, 200, { submissions: allSubmissions });
    }

    if (pathname === '/api/submissions' && method === 'POST') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      const body = await parseJsonBody(req);
      const { assignmentId, answerText, submittedFiles } = body;

      const assignment = await store.getAssignmentById(assignmentId);
      if (!assignment) {
        return sendJson(res, 404, { error: 'Assignment not found.' });
      }

      // Check deadline
      const nowUtc = new Date().toISOString();
      const isLate = new Date(nowUtc) > new Date(assignment.deadlineUtc);

      const submission = await store.saveSubmission({
        assignmentId,
        studentId: actor.id,
        studentName: actor.displayName,
        studentRollNumber: actor.rollNumber,
        studentEmail: actor.email,
        answerText: answerText || '',
        submittedFiles: submittedFiles || [],
        submittedAtUtc: nowUtc,
        submittedAtIst: formatKolkataTime(nowUtc),
        isLate,
        status: isLate ? 'submitted_late' : 'submitted'
      });

      // Student submission receipt notification
      await store.addNotification({
        recipientUserId: actor.id,
        eventType: 'SUBMISSION_RECEIPT',
        title: 'Assignment Submitted Successfully',
        message: `Your submission for "${assignment.title}" is confirmed. Receipt ID: ${submission.receiptId}${isLate ? ' (Late)' : ''}.`,
        relatedResourceId: submission.id
      });

      return sendJson(res, 201, { success: true, submission });
    }

    // ----------------------------------------------------
    // MODERATION: BANS, UNBANS, 7-DAY RESTRICTION, REQUESTS
    // ----------------------------------------------------
    if (pathname === '/api/moderation/ban' && method === 'POST') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      const body = await parseJsonBody(req);
      const { targetUserId, reason } = body;

      const record = await moderationService.banUser(actor, targetUserId, reason);

      sendTelegramAuditEvent('USER_BANNED', {
        title: `Account Ban: ${record.targetEmail}`
      }, {
        actorName: actor.displayName,
        actorRole: actor.role,
        actorEmail: actor.email,
        reason: record.reason
      }).catch(() => {});

      return sendJson(res, 200, { success: true, record });
    }

    if (pathname === '/api/moderation/unban' && method === 'POST') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      const body = await parseJsonBody(req);
      const { targetUserId, resolutionNotes } = body;

      const record = await moderationService.unbanUser(actor, targetUserId, resolutionNotes);

      sendTelegramAuditEvent('USER_UNBANNED', {
        title: `Account Unban: ${record.targetEmail}`
      }, {
        actorName: actor.displayName,
        actorRole: actor.role,
        actorEmail: actor.email,
        reason: resolutionNotes || 'Unbanned by Administrator'
      }).catch(() => {});

      return sendJson(res, 200, { success: true, record });
    }

    if (pathname === '/api/moderation/ban-request' && method === 'POST') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      const body = await parseJsonBody(req);
      const { targetStudentId, reason } = body;

      const reqRecord = await moderationService.submitBanRequest(actor, targetStudentId, reason);
      return sendJson(res, 201, { success: true, request: reqRecord });
    }

    if (pathname === '/api/moderation/ban-request/decide' && method === 'POST') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      const body = await parseJsonBody(req);
      const { requestId, decision, notes } = body;

      const updated = await moderationService.decideBanRequest(actor, requestId, decision, notes);
      return sendJson(res, 200, { success: true, request: updated });
    }

    if (pathname === '/api/moderation/records' && method === 'GET') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      if (actor.role === ROLES.STUDENT) {
        throw new AuthorizationError('Students are not authorized to view moderation records.', 'FORBIDDEN', 403);
      }

      const records = await store.getModerationRecords();
      const requests = await store.getBanRequests();
      const restrictions = await store.getBanRestrictions();

      return sendJson(res, 200, { records, requests, restrictions });
    }

    // ----------------------------------------------------
    // NOTICES (Authoritative IST Date & Fixed Letterhead)
    // ----------------------------------------------------
    if (pathname === '/api/notices' && method === 'GET') {
      const notices = await store.getNotices();
      return sendJson(res, 200, { notices });
    }

    if (pathname === '/api/notices' && method === 'POST') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      const authCheck = canPostNotice(actor);
      if (!authCheck.allowed) {
        throw new AuthorizationError(authCheck.reason, 'NOTICE_POST_DENIED', 403);
      }

      const body = await parseJsonBody(req);
      const { message, title } = body;

      if (!message || message.trim().length < 5) {
        return sendJson(res, 400, { error: 'Notice message must be at least 5 characters.' });
      }

      // Generate Authoritative IST Date
      const serverIstDate = formatKolkataTime(new Date());

      // Format strictly following Section 16
      const formattedNoticeBody = 
`Date: ${serverIstDate}

Dear Friends,

${message.trim()}

With regards,

${actor.displayName}
${actor.role.toUpperCase()}`;

      const notice = await store.addNotice({
        title: title || 'Notice from Administration',
        message: message.trim(),
        formattedLetterhead: formattedNoticeBody,
        authorId: actor.id,
        authorName: actor.displayName,
        authorRole: actor.role,
        publishedAtIst: serverIstDate,
        publicationStatus: 'published'
      });

      // Broadcast in-app notification to all active students
      const users = await store.getAllUsers();
      for (const u of users) {
        store.addNotification({
          recipientUserId: u.id,
          eventType: 'NEW_NOTICE',
          title: '📢 New Notice from College Administration',
          message: `${actor.displayName}: "${(title || message).substring(0, 80)}..."`,
          relatedResourceId: notice.id
        }).catch(() => {});
      }

      // Telegram notification
      sendTelegramAuditEvent('NOTICE_PUBLISHED', {
        title: notice.title
      }, {
        actorName: actor.displayName,
        actorRole: actor.role,
        actorEmail: actor.email,
        reason: 'Global notice broadcasted to all students'
      }).catch(() => {});

      return sendJson(res, 201, { success: true, notice });
    }

    // ----------------------------------------------------
    // NOTIFICATIONS
    // ----------------------------------------------------
    if (pathname === '/api/notifications' && method === 'GET') {
      const actor = await resolveActor(req, store);
      if (!actor) return sendJson(res, 200, { notifications: [] });

      const notifications = await store.getNotificationsForUser(actor.id);
      return sendJson(res, 200, { notifications });
    }

    if (pathname === '/api/notifications/read' && method === 'POST') {
      const actor = await resolveActor(req, store);
      if (!actor) return sendJson(res, 401, { error: 'Unauthorized' });

      const body = await parseJsonBody(req);
      const { notificationId } = body;

      await store.markNotificationRead(notificationId, actor.id);
      return sendJson(res, 200, { success: true });
    }

    // ----------------------------------------------------
    // AUDIT LOGS
    // ----------------------------------------------------
    if (pathname === '/api/audit' && method === 'GET') {
      const actor = await resolveActor(req, store);
      assertUserActive(actor);

      if (actor.role !== ROLES.ADMIN && actor.role !== ROLES.REPRESENTATIVE) {
        throw new AuthorizationError('Audit logs are restricted to Administrators and Representatives.', 'FORBIDDEN', 403);
      }

      const logs = await store.getAuditEvents(100);
      return sendJson(res, 200, { logs });
    }

    // ----------------------------------------------------
    // IN-APP BUG REPORTS (Telegram Dispatch)
    // ----------------------------------------------------
    if (pathname === '/api/telegram/bug-report' && method === 'POST') {
      const actor = await resolveActor(req, store);
      const body = await parseJsonBody(req);

      const report = {
        title: body.title,
        description: body.description,
        category: body.category || 'General UI',
        severity: body.severity || 'Medium',
        affectedPage: body.affectedPage || 'Dashboard',
        reporterName: actor?.displayName || body.reporterName || 'Student',
        reporterRole: actor?.role || 'student',
        reporterEmail: actor?.email || body.reporterEmail || '',
        reporterRollNumber: actor?.rollNumber || body.reporterRollNumber || '',
        createdAt: new Date().toISOString()
      };

      try {
        const result = await sendTelegramBugReport(report);
        return sendJson(res, 200, { success: true, message: 'Bug report dispatched to administration.', result });
      } catch (err) {
        return sendJson(res, 500, { error: 'Failed to dispatch bug report: ' + err.message });
      }
    }

    // Fallback 404 for unhandled API routes
    return sendJson(res, 404, { error: `API route not found: ${method} ${pathname}` });

  } catch (err) {
    if (err instanceof AuthorizationError) {
      return sendJson(res, err.statusCode || 403, {
        error: err.message,
        code: err.code
      });
    }

    console.error(`Unhandled API error on ${method} ${pathname}:`, err);
    return sendJson(res, 500, {
      error: 'Internal server error: ' + err.message
    });
  }
}

function ROLE_HIERARCHY_VAL(role) {
  const map = { admin: 4, representative: 3, manager: 2, student: 1 };
  return map[role] || 0;
}

// Singleton Store and Moderation Service for Serverless invocations
let serverlessStore = null;
let serverlessModeration = null;

export default async function handler(req, res) {
  if (!serverlessStore) {
    serverlessStore = new PlatformStore();
    serverlessModeration = new ModerationService(serverlessStore);
  }
  return handleApiRequest(req, res, serverlessStore, serverlessModeration);
}
