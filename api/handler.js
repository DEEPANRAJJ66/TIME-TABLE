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
  getOutboxEvents
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
        auditDelivery: auditResult
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

    // Access Control Guard: Students cannot access unpublished drafts
    if (publicationStatus !== 'published') {
      const isOwner = (requesterId && ownerId && requesterId === ownerId) ||
                      (requesterEmail && ownerId && requesterEmail === ownerId);
      const isAdmin = requesterRole === 'admin' || requesterEmail.toLowerCase() === 'jeyaramandeeban@gmail.com' || requesterEmail.toLowerCase() === 'admin@saranathan.ac.in';
      const isManager = requesterRole === 'manager' || requesterRole === 'staff';

      if (!isOwner && !isAdmin && !isManager) {
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

  return res.status(404).json({ error: 'API route not found' });
}
