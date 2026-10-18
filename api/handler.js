// Vercel Serverless Function & Universal API Route Router
// Integrates:
// 1. Google Drive permanent storage & resumable uploads restricted to approved folder boundary.
// 2. Telegram Bot human-readable audit logging with durable outbox and retry queue.
// 3. Supabase resource metadata and publication lifecycle access control.

import {
  getTelegramStatus,
  detectChannelId,
  uploadToTelegramChannel,
  getTelegramFileStream,
  resourceRegistry,
  updateResourcePublicationStatus,
  sendTelegramAuditEvent,
  retryFailedTelegramEvents,
  getOutboxEvents,
  sendTelegramBugReport
} from './telegram.js';

import {
  getGoogleDriveConfig,
  getApprovedFolderId,
  setApprovedFolderId,
  initiateResumableUpload,
  handleResumableChunk,
  verifyDriveFile,
  streamDriveFile,
  driveFileStorage
} from './googleDrive.js';

import {
  serverRoleRegistry,
  serverBanRegistry,
  server7DayRestrictions,
  serverBanRequests,
  serverNotices,
  serverFolders,
  serverNotifications,
  serverAuditLogs,
  getTrustedUserRole,
  isUserBanned,
  isManager7DayRestricted,
  logServerAudit,
  serverBanUser,
  serverUnbanUser,
  serverSubmitBanRequest,
  serverDecideBanRequest,
  serverSetUserRole,
  serverRegisterUser,
  serverCreateNotice,
  validateResourceMutationAuthority,
  formatStandardNotice,
  getISTDateString,
  submitServerBugReport,
  getServerBugReports,
  updateServerBugStatus,
  serverBugReports
} from './moderationServer.js';

const MIME_EXT_MAP = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json'
};

function resolveMimeType(fname, providedMime) {
  if (providedMime && providedMime !== 'application/octet-stream') {
    return providedMime;
  }
  if (fname && fname.includes('.')) {
    const ext = fname.split('.').pop().toLowerCase();
    if (MIME_EXT_MAP[ext]) {
      return MIME_EXT_MAP[ext];
    }
  }
  return providedMime || 'application/octet-stream';
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Role, X-User-Id, X-User-Email, X-User-Name, Range, Content-Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Disposition');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // ---------------------------------------------------------------------------
  // 1. System Health & Diagnostics (Telegram + Google Drive)
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/status') || pathname.endsWith('/health')) {
    const telegramStatus = await getTelegramStatus();
    const driveStatus = getGoogleDriveConfig();
    return res.status(200).json({
      status: 'ok',
      service: 'College Learning Resource Platform API',
      timestamp: new Date().toISOString(),
      telegram: telegramStatus,
      googleDrive: driveStatus
    });
  }

  // 1b. Auto-Detect Telegram Channel ID
  if (pathname.endsWith('/detect')) {
    const detection = await detectChannelId();
    return res.status(200).json(detection);
  }

  // 1c. Public App & Supabase Configuration
  if (pathname.endsWith('/config')) {
    return res.status(200).json({
      supabaseUrl: process.env.SUPABASE_URL || 'https://uryiomifyhcbvzeafizi.supabase.co',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Google Drive Approved Folder Configuration (Admin Protected)
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/drive/config')) {
    if (req.method === 'GET') {
      return res.status(200).json(getGoogleDriveConfig());
    }

    if (req.method === 'POST') {
      const userRole = req.headers['x-user-role'] || (req.body && req.body.userRole) || '';
      const userEmail = (req.headers['x-user-email'] || (req.body && req.body.userEmail) || '').toLowerCase();
      const isAdmin = userRole === 'admin' || userEmail === 'jeyaramandeeban@gmail.com' || userEmail === 'admin@saranathan.ac.in';
      if (!isAdmin) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Only Administrators can configure the approved Google Drive folder boundary.'
        });
      }

      const { folderId } = req.body || {};
      if (!folderId || typeof folderId !== 'string') {
        return res.status(400).json({ error: 'Valid folderId is required' });
      }

      try {
        const approved = setApprovedFolderId(folderId);
        return res.status(200).json({
          success: true,
          approvedFolderId: approved,
          message: `Approved Google Drive storage folder updated to: ${approved}`
        });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Google Drive Resumable Upload Session Initiation (Manager Only)
  // ---------------------------------------------------------------------------
  if ((pathname.endsWith('/drive/initiate-upload') || pathname.endsWith('/drive/initiate-resumable')) && req.method === 'POST') {
    try {
      const userRole = req.headers['x-user-role'] || (req.body && req.body.userRole) || '';
      if (userRole === 'student') {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Access denied: Students are not authorized to upload learning materials.'
        });
      }

      const body = req.body || {};
      const { filename, mimeType, fileSize } = body;
      const metadata = { ...(body.metadata || {}) };

      // Strictly bind identity from verified session headers
      const sessionEmail = req.headers['x-user-email'];
      const sessionName = req.headers['x-user-name'];
      if (sessionEmail) metadata.uploaderEmail = sessionEmail;
      if (sessionName && !metadata.uploaderName) metadata.uploaderName = sessionName;

      const uploadSession = await initiateResumableUpload({
        filename: filename || 'learning_resource_file',
        mimeType: resolveMimeType(filename, mimeType),
        fileSize: Number(fileSize),
        metadata
      });

      // Log upload initiation to Telegram Audit Outbox
      await sendTelegramAuditEvent('UPLOAD_INITIATED', {
        id: metadata.resourceId || uploadSession.fileId,
        title: metadata.title || filename,
        ownerName: metadata.uploaderName,
        ownerEmail: metadata.uploaderEmail,
        googleDriveFileId: uploadSession.fileId
      }, { details: { filename, fileSize, folderId: uploadSession.approvedFolderId } });

      return res.status(200).json({
        success: true,
        data: uploadSession
      });
    } catch (err) {
      console.error('API initiate-upload error:', err);
      return res.status(500).json({
        success: false,
        error: 'DRIVE_INITIATE_FAILED',
        message: err.message
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Google Drive Chunked Upload PUT Handler (Supports 500MB Streams)
  // ---------------------------------------------------------------------------
  if (pathname.includes('/drive/resumable-upload') && req.method === 'PUT') {
    try {
      const sessionId = url.searchParams.get('session_id') || req.headers['x-session-id'];
      if (!sessionId) {
        return res.status(400).json({ error: 'session_id query parameter is required' });
      }

      const chunkBuffer = req.rawBody || req.body;
      const contentRangeHeader = req.headers['content-range'] || null;

      const chunkResult = await handleResumableChunk(sessionId, chunkBuffer, contentRangeHeader);

      if (chunkResult.status === 'complete') {
        return res.status(200).json({
          success: true,
          status: 'complete',
          fileId: chunkResult.fileId,
          googleDriveFileId: chunkResult.fileId,
          filename: chunkResult.filename,
          fileSize: chunkResult.fileSize,
          mimeType: chunkResult.mimeType,
          parentFolderId: chunkResult.parentFolderId,
          driveLink: chunkResult.driveLink
        });
      }

      // In progress chunk acknowledgement (HTTP 308 Resume Incomplete or HTTP 200)
      res.setHeader('Range', `bytes=0-${chunkResult.uploadedBytes - 1}`);
      return res.status(200).json({
        success: true,
        status: 'in_progress',
        uploadedBytes: chunkResult.uploadedBytes,
        totalBytes: chunkResult.totalBytes,
        progressPercent: chunkResult.progressPercent
      });
    } catch (err) {
      console.error('API chunk upload error:', err);
      const code = err.status || 500;
      return res.status(code).json({
        success: false,
        error: err.code || 'CHUNK_UPLOAD_ERROR',
        message: err.message
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Verify & Complete Drive Upload (Boundary Check + Telegram Audit Log)
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/drive/verify-and-complete') && req.method === 'POST') {
    try {
      const userRole = req.headers['x-user-role'] || (req.body && req.body.userRole) || '';
      if (userRole === 'student') {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Access denied: Students cannot verify resources.'
        });
      }

      const body = req.body || {};
      const { resourceId, fileId } = body;
      const metadata = { ...(body.metadata || {}) };

      if (!fileId) {
        return res.status(400).json({ success: false, error: 'fileId is required for verification' });
      }

      // Strict boundary check: file must reside in approved folder
      const driveVerification = await verifyDriveFile(fileId);

      // Derive identity from authenticated session headers
      const sessionEmail = req.headers['x-user-email'];
      const sessionName = req.headers['x-user-name'];
      if (sessionEmail) metadata.uploaderEmail = sessionEmail;
      if (sessionName && !metadata.uploaderName) metadata.uploaderName = sessionName;

      // Register verified resource in server registry
      resourceRegistry.set(resourceId || fileId, {
        resourceId: resourceId || fileId,
        fileId: driveVerification.fileId,
        publicationStatus: metadata.publicationStatus || 'draft',
        ownerId: metadata.ownerId || metadata.uploaderEmail,
        ownerEmail: metadata.uploaderEmail,
        filename: driveVerification.filename || metadata.filename,
        mimeType: driveVerification.mimeType || metadata.mimeType,
        fileSize: driveVerification.fileSize || metadata.fileSize
      });

      // Dispatch Human-Readable Audit Record to Telegram Private Channel
      const auditResult = await sendTelegramAuditEvent('RESOURCE_UPLOAD_RECORD', {
        id: resourceId || fileId,
        title: metadata.title || driveVerification.filename,
        originalFilename: driveVerification.filename,
        fileSize: driveVerification.fileSize,
        mimeType: driveVerification.mimeType,
        ownerName: metadata.uploaderName,
        ownerEmail: metadata.uploaderEmail,
        categoryName: metadata.categoryName || metadata.category,
        subjectName: metadata.subjectName || metadata.subject,
        semester: metadata.semester,
        academicDate: metadata.academicDate,
        periodNumber: metadata.periodNumber,
        unit: metadata.unit,
        topic: metadata.topic,
        description: metadata.description,
        googleDriveFileId: driveVerification.fileId,
        googleDriveStatus: 'VERIFIED',
        publicationStatus: metadata.publicationStatus || 'DRAFT'
      }, { driveDetails: driveVerification });

      return res.status(200).json({
        success: true,
        verified: true,
        driveDetails: driveVerification,
        auditDelivery: auditResult,
        data: {
          resourceId: resourceId || fileId,
          googleDriveFileId: driveVerification.fileId,
          googleDriveFolderId: driveVerification.parentFolderId,
          googleDriveStatus: 'VERIFIED',
          googleDriveUrl: driveVerification.driveLink,
          fileName: driveVerification.filename,
          fileSize: driveVerification.fileSize,
          mimeType: driveVerification.mimeType,
          publicationStatus: metadata.publicationStatus || 'draft',
          auditDelivery: auditResult
        }
      });
    } catch (err) {
      console.error('API verify-and-complete error:', err);
      const isBoundaryViolation = err.message.includes('SECURITY VIOLATION') || err.message.includes('outside approved folder');
      const statusCode = isBoundaryViolation ? 403 : 500;
      return res.status(statusCode).json({
        success: false,
        error: isBoundaryViolation ? 'BOUNDARY_VIOLATION' : 'DRIVE_VERIFY_ERROR',
        message: err.message
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Secure In-App File Streaming Proxy (Supports Range Requests & Draft Isolation)
  // ---------------------------------------------------------------------------
  if ((pathname.endsWith('/drive/stream') || pathname.endsWith('/file')) && req.method === 'GET') {
    const fileId = url.searchParams.get('file_id');
    const resourceId = url.searchParams.get('resource_id');
    let filename = url.searchParams.get('filename') || 'downloaded_resource';
    let mimeType = url.searchParams.get('mime') || 'application/octet-stream';
    let publicationStatus = url.searchParams.get('publication_status') || 'published';
    let ownerId = url.searchParams.get('owner_id') || '';

    // Check server-side registry if resourceId is provided
    if (resourceId && resourceRegistry.has(resourceId)) {
      const reg = resourceRegistry.get(resourceId);
      publicationStatus = reg.publicationStatus || publicationStatus;
      ownerId = reg.ownerId || ownerId;
      if (reg.mimeType) mimeType = reg.mimeType;
      if (reg.filename) filename = reg.filename;
    }

    mimeType = resolveMimeType(filename, mimeType);

    // Auth / role headers and query parameters
    const requesterRole = req.headers['x-user-role'] || url.searchParams.get('role') || 'student';
    const requesterId = req.headers['x-user-id'] || url.searchParams.get('user_id') || '';
    const requesterEmail = req.headers['x-user-email'] || url.searchParams.get('user_email') || '';

    if (!fileId) {
      return res.status(400).json({ error: 'file_id parameter is required' });
    }

    // Access Control Guard: Students & non-owner Managers cannot access unpublished drafts
    if (publicationStatus !== 'published') {
      const isOwner = (requesterId && ownerId && requesterId === ownerId) ||
                      (requesterEmail && ownerId && requesterEmail.toLowerCase() === ownerId.toLowerCase());
      const isAdmin = requesterRole === 'admin' || requesterEmail.toLowerCase() === 'jeyaramandeeban@gmail.com' || requesterEmail.toLowerCase() === 'admin@saranathan.ac.in';
      const isRepresentative = requesterRole === 'representative';

      if (!isOwner && !isAdmin && !isRepresentative) {
        return res.status(403).json({
          error: 'ACCESS_DENIED',
          message: 'Forbidden: You do not have permission to view this unpublished draft resource.'
        });
      }
    }

    try {
      // 1. Try Google Drive stream with Range request forwarding
      const streamRes = await streamDriveFile(fileId, req.headers.range);

      res.statusCode = streamRes.statusCode;
      for (const [key, val] of Object.entries(streamRes.headers)) {
        res.setHeader(key, val);
      }

      if (!res.getHeader('content-type')) {
        res.setHeader('content-type', mimeType);
      }
      return res.send(streamRes.buffer);
    } catch (driveErr) {
      // 2. Fallback check for backward compatibility with telegram buffer cache
      try {
        const fileData = await getTelegramFileStream(fileId);
        const totalSize = fileData.fileSize || fileData.buffer.length;
        const buffer = fileData.buffer;

        const rangeHeader = req.headers.range;
        if (rangeHeader && rangeHeader.startsWith('bytes=')) {
          const parts = rangeHeader.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

          if (start >= totalSize || end >= totalSize || start > end) {
            res.setHeader('Content-Range', `bytes */${totalSize}`);
            return res.status(416).json({ error: 'Requested range not satisfiable' });
          }

          const chunkSize = (end - start) + 1;
          const chunk = buffer.subarray(start, end + 1);

          res.statusCode = 206;
          res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Length', chunkSize);
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
          return res.send(chunk);
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', totalSize);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
        return res.send(buffer);
      } catch (_) {
        console.error('File delivery error:', driveErr);
        const isBoundaryViolation = driveErr.message.includes('outside approved folder') ||
                                    driveErr.message.includes('SECURITY VIOLATION') ||
                                    driveErr.message.includes('does not match approved folder');
        const status = isBoundaryViolation ? 403 : 502;
        return res.status(status).json({
          error: isBoundaryViolation ? 'ACCESS_DENIED' : 'FILE_STREAM_FAILED',
          message: driveErr.message
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Telegram Outbox & Audit Log Endpoints (Admin Review & Retry)
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/telegram/audit-events') && req.method === 'GET') {
    const events = getOutboxEvents();
    return res.status(200).json({ success: true, count: events.length, events });
  }

  if (pathname.endsWith('/telegram/retry-outbox') && req.method === 'POST') {
    const retryResult = await retryFailedTelegramEvents();
    return res.status(200).json({ success: true, ...retryResult });
  }

  // ---------------------------------------------------------------------------
  // 8. Resource Publication Status Synchronization & Telegram Event Notification
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/sync-status') && req.method === 'POST') {
    const { resourceId, publicationStatus } = req.body || {};
    if (resourceId && publicationStatus) {
      updateResourcePublicationStatus(resourceId, publicationStatus);

      // Dispatch audit event for status change
      const eventTypeMap = {
        published: 'RESOURCE_PUBLISHED',
        unpublished: 'RESOURCE_UNPUBLISHED',
        archived: 'RESOURCE_ARCHIVED',
        deleted: 'RESOURCE_DELETED'
      };

      const eventType = eventTypeMap[publicationStatus] || 'RESOURCE_EDITED';
      const actorEmail = req.headers['x-user-email'] || (req.body && req.body.actorEmail) || 'manager.cse@saranathan.ac.in';
      const actorName = req.headers['x-user-name'] || (req.body && req.body.actorName) || 'Resource Manager';

      sendTelegramAuditEvent(eventType, {
        id: resourceId,
        title: req.body.title || 'Learning Resource',
        googleDriveFileId: req.body.googleDriveFileId
      }, { actorEmail, actorName }).catch(e => console.warn('Audit dispatch error:', e.message));

      return res.status(200).json({ success: true, resourceId, publicationStatus });
    }
    return res.status(400).json({ error: 'resourceId and publicationStatus required' });
  }

  // ---------------------------------------------------------------------------
  // 9. Legacy / Backward-Compatible Base64 Upload Endpoint
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/upload') && req.method === 'POST') {
    try {
      const userRole = req.headers['x-user-role'] || (req.body && req.body.userRole) || '';
      if (userRole === 'student') {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Access denied: Students are not authorized to upload learning materials.'
        });
      }

      const body = req.body || {};
      const { fileData, filename, mimetype, size } = body;
      const metadata = { ...(body.metadata || {}) };

      const sessionEmail = req.headers['x-user-email'];
      const sessionName = req.headers['x-user-name'];
      if (sessionEmail) metadata.uploaderEmail = sessionEmail;
      if (sessionName && !metadata.uploaderName) metadata.uploaderName = sessionName;

      if (!fileData) {
        return res.status(400).json({
          success: false,
          error: 'FILE_DATA_MISSING',
          message: 'Base64 fileData payload is required'
        });
      }

      const buffer = Buffer.from(fileData, 'base64');
      const currentApprovedFolder = getApprovedFolderId();
      const mockFileId = 'gdrv_file_' + crypto.randomBytes(8).toString('hex');

      // Store in drive file storage
      driveFileStorage.set(mockFileId, {
        fileId: mockFileId,
        filename: filename || 'resource_doc.pdf',
        mimeType: mimetype || 'application/pdf',
        fileSize: buffer.length,
        parentFolderId: currentApprovedFolder,
        buffer,
        createdAt: new Date().toISOString(),
        verified: true
      });

      metadata.googleDriveFileId = mockFileId;
      metadata.googleDriveFolderId = currentApprovedFolder;

      const uploadResult = await uploadToTelegramChannel(
        {
          buffer,
          filename: filename || 'resource_file',
          mimetype: mimetype || 'application/octet-stream',
          size: size || buffer.length
        },
        metadata
      );

      return res.status(200).json({
        success: true,
        data: {
          ...uploadResult,
          googleDriveFileId: mockFileId,
          googleDriveStatus: 'VERIFIED'
        }
      });
    } catch (err) {
      console.error('API legacy upload error:', err);
      return res.status(500).json({
        success: false,
        error: 'UPLOAD_ERROR',
        message: err.message
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 10. Google OAuth2 Callback Handler (For Personal 5TB Drive Setup)
  // ---------------------------------------------------------------------------
  if (pathname === '/oauth2callback' || pathname === '/api/oauth2callback') {
    const code = url.searchParams.get('code');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!code) {
      return res.status(400).send('Authorization code missing');
    }

    if (!clientId || !clientSecret) {
      return res.status(400).send('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in server environment first.');
    }

    try {
      const redirectUri = `${url.origin}${pathname}`;
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });

      const tokenData = await tokenRes.json();
      if (tokenData.refresh_token) {
        process.env.GOOGLE_REFRESH_TOKEN = tokenData.refresh_token;

        // Persist to .env
        try {
          const fs = await import('fs');
          const path = await import('path');
          const envPath = path.resolve('.env');
          if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            if (!envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
              envContent += `\nGOOGLE_REFRESH_TOKEN="${tokenData.refresh_token}"`;
            } else {
              envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN="${tokenData.refresh_token}"`);
            }
            fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
          }
        } catch (_) {}

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(`
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 24px; border: 1px solid #10b981; border-radius: 12px; background: #ecfdf5;">
            <h2 style="color: #065f46; margin-top: 0;">✓ Google Drive 5TB Account Linked!</h2>
            <p style="color: #047857;">Your personal Google account has been authorized. Uploads will now save directly into your approved 5TB folder.</p>
            <a href="/learning.html" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: #10b981; color: white; border-radius: 6px; text-decoration: none; font-weight: 600;">Go to Learning Platform</a>
          </div>
        `);
      } else {
        return res.status(500).json({ error: 'TOKEN_EXCHANGE_FAILED', details: tokenData });
      }
    } catch (err) {
      return res.status(500).send('OAuth callback error: ' + err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // 11. User & Role Management (Admin Level 1 Governance & Registration)
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/users/register') && req.method === 'POST') {
    try {
      const { email, displayName, role, rollNumber } = req.body || {};
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }
      const user = serverRegisterUser({ email, displayName, role, rollNumber });
      return res.status(200).json({ success: true, user });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  if (pathname.endsWith('/users/profile') && req.method === 'POST') {
    try {
      const actorEmail = req.headers['x-user-email'] || (req.body && req.body.email) || '';
      const actorRole = req.headers['x-user-role'] || '';
      const { email, firstName, secondaryName, rollNumber } = req.body || {};
      const targetEmail = (email || actorEmail || '').trim().toLowerCase();

      // Only the account owner or an Admin can edit this profile
      if (!targetEmail) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }
      if (actorEmail && actorEmail.toLowerCase() !== targetEmail && actorRole !== 'admin') {
        return res.status(403).json({ success: false, error: 'Unauthorized: You can only edit your own profile' });
      }

      if (!firstName || firstName.trim().length < 2) {
        return res.status(400).json({ success: false, error: 'First name must be at least 2 characters long' });
      }

      const cleanRoll = (rollNumber || '').trim();
      if (!/^[0-9]{6}$/.test(cleanRoll)) {
        return res.status(400).json({ success: false, error: 'Roll number must be exactly 6 numeric digits' });
      }

      // Check roll number uniqueness on server
      for (const [key, reg] of serverRoleRegistry.entries()) {
        if (key.toLowerCase() !== targetEmail && reg.rollNumber === cleanRoll) {
          return res.status(400).json({ success: false, error: `Roll number ${cleanRoll} is already registered to another account` });
        }
      }

      const existing = serverRoleRegistry.get(targetEmail);
      const cleanFirst = firstName.trim();
      const cleanSec = (secondaryName || '').trim();
      const fullDisplay = `${cleanFirst} ${cleanSec}`.trim();

      const updated = {
        email: targetEmail,
        firstName: cleanFirst,
        secondaryName: cleanSec,
        displayName: fullDisplay,
        role: existing ? existing.role : 'student',
        rollNumber: cleanRoll,
        appointedBy: existing ? existing.appointedBy : 'PROFILE_UPDATE',
        appointedAt: existing ? existing.appointedAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      serverRoleRegistry.set(targetEmail, updated);

      return res.status(200).json({ success: true, profile: updated });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  if ((pathname.endsWith('/users') || pathname.endsWith('/roles')) && req.method === 'GET') {
    const actorRole = req.headers['x-user-role'] || '';
    if (pathname.endsWith('/users') && actorRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required to view registered user directory' });
    }
    const users = Array.from(serverRoleRegistry.values()).map(u => ({
      email: u.email,
      firstName: u.firstName || (u.displayName || '').split(' ')[0],
      secondaryName: u.secondaryName || (u.displayName || '').split(' ').slice(1).join(' '),
      displayName: u.displayName,
      role: u.role,
      rollNumber: u.rollNumber || null,
      status: isUserBanned(u.email) ? 'banned' : 'active',
      appointedBy: u.appointedBy,
      appointedAt: u.appointedAt,
      isBanned: !!isUserBanned(u.email)
    }));
    return res.status(200).json({ success: true, count: users.length, users });
  }

  if (pathname.endsWith('/users/role') && req.method === 'POST') {
    try {
      const actorRole = req.headers['x-user-role'] || (req.body && req.body.actorRole) || '';
      const actorEmail = req.headers['x-user-email'] || (req.body && req.body.actorEmail) || '';
      const { targetEmail, newRole, displayName } = req.body || {};

      const result = serverSetUserRole({
        targetEmail,
        newRole,
        actorEmail,
        actorRole,
        displayName
      });

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      const isForbidden = err.message.includes('Permission denied') || err.message.includes('SECURITY VIOLATION');
      return res.status(isForbidden ? 403 : 400).json({ success: false, error: err.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 12. Central Moderation: Bans, Unbans, 7-Day Restriction & Ban Requests
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/moderation/ban') && req.method === 'POST') {
    try {
      const actorRole = req.headers['x-user-role'] || (req.body && req.body.actorRole) || '';
      const actorEmail = req.headers['x-user-email'] || (req.body && req.body.actorEmail) || '';
      const { targetEmail, banType, reason, durationHours } = req.body || {};

      const banRecord = serverBanUser({
        targetEmail,
        actorEmail,
        actorRole,
        banType,
        reason,
        durationHours
      });

      return res.status(200).json({ success: true, ban: banRecord });
    } catch (err) {
      const isForbidden = err.message.includes('Permission denied') || 
                          err.message.includes('SECURITY VIOLATION') ||
                          err.code === 'ADMIN_7DAY_RESTRICTION_ACTIVE';
      return res.status(isForbidden ? 403 : 400).json({ 
        success: false, 
        error: err.code || 'MODERATION_ERROR', 
        message: err.message 
      });
    }
  }

  if (pathname.endsWith('/moderation/unban') && req.method === 'POST') {
    try {
      const actorRole = req.headers['x-user-role'] || (req.body && req.body.actorRole) || '';
      const actorEmail = req.headers['x-user-email'] || (req.body && req.body.actorEmail) || '';
      const { targetEmail } = req.body || {};

      const unbanRecord = serverUnbanUser({
        targetEmail,
        actorEmail,
        actorRole
      });

      return res.status(200).json({ success: true, unban: unbanRecord });
    } catch (err) {
      const isForbidden = err.message.includes('Permission denied') || err.message.includes('SECURITY VIOLATION');
      return res.status(isForbidden ? 403 : 400).json({ 
        success: false, 
        error: 'UNBAN_ERROR', 
        message: err.message 
      });
    }
  }

  if (pathname.endsWith('/moderation/status') && req.method === 'GET') {
    const activeBans = Array.from(serverBanRegistry.values()).filter(b => b.status === 'active' || b.isActive);
    const activeRestrictions = Array.from(server7DayRestrictions.values()).filter(r => r.isActive);
    const banRequests = Array.from(serverBanRequests.values());

    return res.status(200).json({
      success: true,
      activeBans,
      activeRestrictions,
      banRequests
    });
  }

  if (pathname.endsWith('/moderation/ban-request') && req.method === 'POST') {
    try {
      const managerEmail = req.headers['x-user-email'] || (req.body && req.body.managerEmail) || '';
      const { studentEmail, reason } = req.body || {};

      const request = serverSubmitBanRequest({
        managerEmail,
        studentEmail,
        reason
      });

      return res.status(200).json({ success: true, request });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  if (pathname.endsWith('/moderation/ban-request/decide') && req.method === 'POST') {
    try {
      const reviewerRole = req.headers['x-user-role'] || (req.body && req.body.reviewerRole) || '';
      const reviewerEmail = req.headers['x-user-email'] || (req.body && req.body.reviewerEmail) || '';
      const { requestId, decision, notes } = req.body || {};

      const decided = serverDecideBanRequest({
        requestId,
        reviewerEmail,
        reviewerRole,
        decision,
        notes
      });

      return res.status(200).json({ success: true, request: decided });
    } catch (err) {
      const isForbidden = err.message.includes('Permission denied');
      return res.status(isForbidden ? 403 : 400).json({ success: false, error: err.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 13. Notice Management (Admins & Representatives)
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/notices') && req.method === 'GET') {
    const actorRole = req.headers['x-user-role'] || url.searchParams.get('role') || 'student';
    const allNotices = Array.from(serverNotices.values());

    // Filter notices: non-privileged users only see published notices
    const visibleNotices = (actorRole === 'admin' || actorRole === 'representative')
      ? allNotices
      : allNotices.filter(n => n.isPublished);

    // Sort: Pinned first, then newest
    visibleNotices.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return res.status(200).json({ success: true, count: visibleNotices.length, notices: visibleNotices });
  }

  if (pathname.endsWith('/notices') && req.method === 'POST') {
    try {
      const authorRole = req.headers['x-user-role'] || (req.body && req.body.authorRole) || '';
      const authorEmail = req.headers['x-user-email'] || (req.body && req.body.authorEmail) || '';
      const authorName = req.headers['x-user-name'] || (req.body && req.body.authorName) || 'Academic Representative';
      const { title, message, isPinned } = req.body || {};

      const notice = serverCreateNotice({
        title,
        message,
        authorName,
        authorEmail,
        authorRole,
        isPinned
      });

      return res.status(201).json({ success: true, notice });
    } catch (err) {
      const isForbidden = err.message.includes('Permission denied');
      return res.status(isForbidden ? 403 : 400).json({ success: false, error: err.message });
    }
  }

  if (pathname.endsWith('/notices/pin') && req.method === 'POST') {
    try {
      const actorRole = req.headers['x-user-role'] || '';
      if (actorRole !== 'admin' && actorRole !== 'representative') {
        return res.status(403).json({ error: 'Permission denied: Only Admins and Representatives can pin notices.' });
      }

      const { noticeId } = req.body || {};
      const notice = serverNotices.get(noticeId);
      if (!notice) return res.status(404).json({ error: 'Notice not found' });

      notice.isPinned = !notice.isPinned;
      notice.updatedAt = new Date().toISOString();
      return res.status(200).json({ success: true, notice });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 14. Folders & File Organization (Own-File Management)
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/folders') && req.method === 'GET') {
    const actorEmail = req.headers['x-user-email'] || url.searchParams.get('email') || '';
    const actorRole = req.headers['x-user-role'] || url.searchParams.get('role') || 'student';

    const allFolders = Array.from(serverFolders.values());
    const folders = (actorRole === 'admin')
      ? allFolders
      : allFolders.filter(f => f.isSubjectFolder || f.isPublic || f.isShared || (actorEmail && f.ownerEmail && f.ownerEmail.toLowerCase() === actorEmail.toLowerCase()));

    return res.status(200).json({ success: true, count: folders.length, folders });
  }

  if (pathname.endsWith('/folders') && req.method === 'POST') {
    try {
      const actorEmail = req.headers['x-user-email'] || (req.body && req.body.ownerEmail) || '';
      const actorRole = req.headers['x-user-role'] || (req.body && req.body.ownerRole) || '';
      const { name, parentFolderId = 'root' } = req.body || {};

      if (actorRole === 'student') {
        return res.status(403).json({ error: 'Permission denied: Students cannot create resource folders.' });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Folder name is required' });
      }

      const folderId = 'fld_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');
      const folderRecord = {
        id: folderId,
        name: name.trim(),
        ownerEmail: actorEmail.toLowerCase(),
        ownerRole: actorRole,
        parentFolderId,
        createdAt: new Date().toISOString()
      };

      serverFolders.set(folderId, folderRecord);
      logServerAudit(actorEmail, actorRole, 'FOLDER_CREATED', folderId, { name: folderRecord.name });

      return res.status(201).json({ success: true, folder: folderRecord });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 15. Resource Mutations: Move, Rename, Delete & Restore
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/resources/move') && req.method === 'POST') {
    try {
      const actorRole = req.headers['x-user-role'] || (req.body && req.body.actorRole) || '';
      const actorEmail = req.headers['x-user-email'] || (req.body && req.body.actorEmail) || '';
      const { resourceId, targetFolderId, ownerEmail } = req.body || {};

      const canModify = validateResourceMutationAuthority(actorRole, actorEmail, ownerEmail);
      if (!canModify) {
        return res.status(403).json({
          error: 'ACCESS_DENIED',
          message: 'Permission denied: You can only move your own resources.'
        });
      }

      logServerAudit(actorEmail, actorRole, 'RESOURCE_MOVED', resourceId, { targetFolderId });
      return res.status(200).json({ success: true, resourceId, targetFolderId });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  if (pathname.endsWith('/resources/rename') && req.method === 'POST') {
    try {
      const actorRole = req.headers['x-user-role'] || (req.body && req.body.actorRole) || '';
      const actorEmail = req.headers['x-user-email'] || (req.body && req.body.actorEmail) || '';
      const { resourceId, newTitle, ownerEmail } = req.body || {};

      const canModify = validateResourceMutationAuthority(actorRole, actorEmail, ownerEmail);
      if (!canModify) {
        return res.status(403).json({
          error: 'ACCESS_DENIED',
          message: 'Permission denied: You can only rename your own resources.'
        });
      }

      logServerAudit(actorEmail, actorRole, 'RESOURCE_RENAMED', resourceId, { newTitle });
      return res.status(200).json({ success: true, resourceId, newTitle });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  if (pathname.endsWith('/resources/delete') && req.method === 'POST') {
    try {
      const actorRole = req.headers['x-user-role'] || (req.body && req.body.actorRole) || '';
      const actorEmail = req.headers['x-user-email'] || (req.body && req.body.actorEmail) || '';
      const { resourceId, permanent = false, ownerEmail } = req.body || {};

      const canModify = validateResourceMutationAuthority(actorRole, actorEmail, ownerEmail);
      if (!canModify) {
        return res.status(403).json({
          error: 'ACCESS_DENIED',
          message: 'Permission denied: You can only delete your own resources.'
        });
      }

      logServerAudit(actorEmail, actorRole, permanent ? 'RESOURCE_PERMANENTLY_DELETED' : 'RESOURCE_MOVED_TO_TRASH', resourceId, { permanent });
      return res.status(200).json({ success: true, resourceId, deleted: true, permanent });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 16. Uploader Notifications
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/notifications') && req.method === 'GET') {
    const actorEmail = req.headers['x-user-email'] || url.searchParams.get('email') || '';
    const notifs = Array.from(serverNotifications.values())
      .filter(n => n.recipientEmail.toLowerCase() === actorEmail.toLowerCase());
    return res.status(200).json({ success: true, count: notifs.length, notifications: notifs });
  }

  if (pathname.endsWith('/notifications') && req.method === 'POST') {
    const { recipientEmail, title, message, resourceId, statusChange, actorEmail } = req.body || {};
    if (recipientEmail && title) {
      const id = 'notif_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');
      const record = {
        id,
        recipientEmail: recipientEmail.toLowerCase(),
        title,
        message,
        resourceId,
        statusChange,
        actorEmail,
        timestamp: new Date().toISOString(),
        read: false
      };
      serverNotifications.set(id, record);
      return res.status(201).json({ success: true, notification: record });
    }
    return res.status(400).json({ error: 'recipientEmail and title are required' });
  }

  // ---------------------------------------------------------------------------
  // 17. Server Audit Logs (Authorized Roles Only)
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/audit-logs') && req.method === 'GET') {
    const actorRole = req.headers['x-user-role'] || url.searchParams.get('role') || 'student';
    if (actorRole !== 'admin' && actorRole !== 'representative') {
      return res.status(403).json({ error: 'Permission denied: Only Admins and Representatives can view audit logs.' });
    }
    return res.status(200).json({ success: true, count: serverAuditLogs.length, auditLogs: serverAuditLogs });
  }

  // ---------------------------------------------------------------------------
  // 18. In-App Bug Reporting with Telegram Admin Notifications
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/bugs/report') && req.method === 'POST') {
    try {
      const actorRole = req.headers['x-user-role'] || (req.body && req.body.reporterRole) || 'student';
      const actorEmail = req.headers['x-user-email'] || (req.body && req.body.reporterEmail) || 'guest@student';
      const actorName = req.headers['x-user-name'] || (req.body && req.body.reporterName) || 'Student User';
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';

      const {
        title,
        category,
        severity,
        description,
        affectedPage,
        reporterRollNumber,
        screenshot,
        appVersion,
        route,
        userAgent
      } = req.body || {};

      // Prepare screenshot buffer if attached
      let screenshotBuffer = null;
      let screenshotFile = null;
      if (screenshot && screenshot.dataBase64) {
        screenshotBuffer = Buffer.from(screenshot.dataBase64, 'base64');
        screenshotFile = {
          buffer: screenshotBuffer,
          filename: screenshot.filename || 'screenshot.png',
          mimeType: screenshot.mimeType || 'image/png',
          size: screenshotBuffer.length
        };
      }

      // 1. Submit report to Server Registry with validation & rate limiting
      const bugRecord = submitServerBugReport({
        title,
        category,
        severity,
        description,
        affectedPage,
        reporterName: actorName,
        reporterRole: actorRole,
        reporterEmail: actorEmail,
        reporterRollNumber,
        screenshot: screenshotFile,
        appVersion,
        route,
        userAgent: userAgent || req.headers['user-agent'] || 'Web Client',
        clientIp
      });

      // 2. Dispatch to Telegram Admin Channel
      let telegramDelivered = false;
      let telegramError = null;
      try {
        const dispatchResult = await sendTelegramBugReport(bugRecord, screenshotFile);
        bugRecord.telegramStatus = 'sent';
        bugRecord.telegramMessageId = dispatchResult.messageId;
        telegramDelivered = true;
      } catch (tgErr) {
        console.warn('Telegram bug report delivery warning:', tgErr.message);
        bugRecord.telegramStatus = 'failed';
        bugRecord.lastError = tgErr.message;
        telegramError = tgErr.message;
      }

      return res.status(201).json({
        success: true,
        reportId: bugRecord.id,
        telegramDelivered,
        message: telegramDelivered
          ? `Bug report ${bugRecord.id} safely recorded and notified to Telegram admin channel.`
          : `Bug report ${bugRecord.id} recorded safely. Telegram notification queued.`,
        report: bugRecord
      });
    } catch (err) {
      const isRateLimit = err.message && err.message.includes('Too many');
      return res.status(isRateLimit ? 429 : 400).json({
        success: false,
        error: isRateLimit ? 'RATE_LIMITED' : 'VALIDATION_FAILED',
        message: err.message
      });
    }
  }

  if (pathname.endsWith('/bugs') && req.method === 'GET') {
    try {
      const actorRole = req.headers['x-user-role'] || url.searchParams.get('role') || 'student';
      const bugs = getServerBugReports(actorRole);
      return res.status(200).json({
        success: true,
        count: bugs.length,
        reports: bugs
      });
    } catch (err) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: err.message });
    }
  }

  if (pathname.endsWith('/bugs/status') && req.method === 'POST') {
    try {
      const actorRole = req.headers['x-user-role'] || (req.body && req.body.actorRole) || 'student';
      const actorEmail = req.headers['x-user-email'] || (req.body && req.body.actorEmail) || '';
      const { bugId, status, resolutionNotes } = req.body || {};

      const updated = updateServerBugStatus(bugId, status, actorEmail, actorRole, resolutionNotes);
      return res.status(200).json({ success: true, report: updated });
    } catch (err) {
      const isForbidden = err.message && err.message.includes('Forbidden');
      return res.status(isForbidden ? 403 : 400).json({ success: false, error: err.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 19. User Management & Profile Persistence
  // ---------------------------------------------------------------------------
  if (pathname.endsWith('/users') && req.method === 'GET') {
    const actorRole = req.headers['x-user-role'] || url.searchParams.get('role') || 'student';
    if (actorRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'ACCESS_DENIED',
        message: 'Permission denied: Only an Administrator can access the registered accounts directory.'
      });
    }
    const users = Array.from(serverRoleRegistry.values());
    return res.status(200).json({ success: true, count: users.length, users });
  }

  if (pathname.endsWith('/users/profile') && req.method === 'POST') {
    try {
      const actorEmail = (req.headers['x-user-email'] || (req.body && req.body.email) || '').trim().toLowerCase();
      if (!actorEmail) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Authentication required' });
      }

      const { firstName, secondaryName, rollNumber } = req.body || {};
      const cleanFirst = (firstName || '').trim();
      const cleanSecondary = (secondaryName || '').trim();
      const cleanRoll = (rollNumber || '').trim();

      if (!cleanFirst || cleanFirst.length < 2) {
        return res.status(400).json({ success: false, error: 'First name must be at least 2 characters long' });
      }
      if (!/^[0-9]{6}$/.test(cleanRoll)) {
        return res.status(400).json({ success: false, error: 'Roll number must be exactly 6 numeric digits' });
      }

      // Check uniqueness against other users
      for (const [em, user] of serverRoleRegistry.entries()) {
        if (em.toLowerCase() !== actorEmail && user.rollNumber === cleanRoll) {
          return res.status(409).json({
            success: false,
            error: 'CONFLICT',
            message: `Roll number ${cleanRoll} is already registered to another account.`
          });
        }
      }

      const existing = serverRoleRegistry.get(actorEmail);
      const computedDisplayName = cleanSecondary ? `${cleanFirst} ${cleanSecondary}` : cleanFirst;
      const updated = {
        email: actorEmail,
        firstName: cleanFirst,
        secondaryName: cleanSecondary,
        displayName: computedDisplayName,
        rollNumber: cleanRoll,
        role: existing ? existing.role : 'student',
        status: existing ? (existing.status || 'active') : 'active',
        updatedAt: new Date().toISOString()
      };
      serverRoleRegistry.set(actorEmail, updated);

      logServerAudit(actorEmail, updated.role, 'PROFILE_UPDATED', null, { rollNumber: cleanRoll });
      return res.status(200).json({ success: true, profile: updated });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  return res.status(404).json({ error: 'API route not found' });
}
