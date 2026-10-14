// Client-Side Resource Storage & Telegram Audit Service
// Integrates Google Drive Resumable Storage (supporting up to 500MB files)
// and Telegram Private Channel Human-Readable Audit Logging.

export class TelegramService {
  constructor() {
    this.apiBase = this.resolveApiBase();
    this.maxUploadBytes = 500 * 1024 * 1024; // 500MB allowed in Google Drive
    this.channelInviteLink = 'https://t.me/+6dIBd-yKc75hZGY1';
  }

  resolveApiBase() {
    if (typeof window !== 'undefined') {
      if (window.APP_CONFIG?.API_BASE) return window.APP_CONFIG.API_BASE;
      if (typeof localStorage !== 'undefined' && localStorage.getItem('API_BASE_URL')) {
        return localStorage.getItem('API_BASE_URL');
      }
      if (window.location && window.location.hostname && window.location.hostname.endsWith('github.io')) {
        return 'https://college-time-planner.vercel.app/api';
      }
    }
    return '/api';
  }

  /**
   * Checks the health and connection status of backend Telegram Bot and Google Drive integrations
   */
  async checkStatus() {
    try {
      const res = await fetch(`${this.apiBase}/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        telegram: data.telegram || { configured: false, ready: false },
        googleDrive: data.googleDrive || { configured: false, ready: false }
      };
    } catch (err) {
      return {
        telegram: {
          configured: false,
          ready: false,
          error: 'API_UNREACHABLE',
          message: 'Backend API is currently unreachable. If running locally, ensure "npm start" is active.'
        },
        googleDrive: {
          configured: false,
          ready: false,
          error: 'API_UNREACHABLE'
        }
      };
    }
  }

  /**
   * Validates a file before uploading
   */
  validateFile(file) {
    if (!file) throw new Error('No file selected');

    if (file.size > this.maxUploadBytes) {
      throw new Error(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed storage limit of 500 MB.`
      );
    }

    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'mkv', 'webm', 'mov', 'zip', 'py', 'c', 'cpp', 'java'];
    
    if (!allowed.includes(ext)) {
      throw new Error(`File extension ".${ext}" is not supported. Supported extensions: ${allowed.join(', ')}`);
    }

    return true;
  }

  /**
   * Uploads file to Google Drive via Resumable Upload Session (up to 500MB)
   * and dispatches human-readable audit record to Telegram private channel.
   * @param {File|Blob} file
   * @param {Object} metadata
   * @param {Function} onProgress
   */
  async uploadFile(file, metadata = {}, onProgress = null) {
    this.validateFile(file);

    try {
      // Step 1: Initiate Resumable Upload Session on Backend
      if (onProgress) onProgress(10, 'Initiating Google Drive storage session...');

      const headers = { 'Content-Type': 'application/json' };
      if (metadata.userRole) headers['X-User-Role'] = metadata.userRole;
      if (metadata.uploaderEmail) headers['X-User-Email'] = metadata.uploaderEmail;
      if (metadata.uploaderName) headers['X-User-Name'] = metadata.uploaderName;

      const initRes = await fetch(`${this.apiBase}/drive/initiate-upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
          metadata
        })
      });

      const initData = await initRes.json();
      if (!initRes.ok || !initData.success) {
        throw new Error(initData.message || initData.error || 'Failed to initiate Google Drive upload session');
      }

      const { uploadUrl, fileId, sessionId, approvedFolderId } = initData.data;
      const resolvedUploadUrl = uploadUrl.startsWith('http')
        ? uploadUrl
        : `${this.apiBase.replace(/\/api$/, '')}${uploadUrl}`;

      // Step 2: Stream File Chunks to Google Drive (Resumable Upload)
      if (onProgress) onProgress(25, 'Streaming file to approved Google Drive folder...');

      const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks
      const totalBytes = file.size;
      let startByte = 0;
      let activeFileId = null;

      while (startByte < totalBytes) {
        const endByte = Math.min(startByte + CHUNK_SIZE, totalBytes);
        const chunk = file.slice(startByte, endByte);
        const chunkBuffer = await chunk.arrayBuffer();

        const putHeaders = {
          'Content-Type': file.type || 'application/octet-stream',
          'Content-Range': `bytes ${startByte}-${endByte - 1}/${totalBytes}`
        };

        const putRes = await fetch(resolvedUploadUrl, {
          method: 'PUT',
          headers: putHeaders,
          body: chunkBuffer
        });

        if (!putRes.ok && putRes.status !== 308) {
          const errText = await putRes.text();
          throw new Error(`Google Drive upload chunk failed (HTTP ${putRes.status}): ${errText}`);
        }

        let completedFileId = null;
        try {
          const putJson = await putRes.clone().json();
          if (putJson && (putJson.fileId || putJson.id || putJson.googleDriveFileId)) {
            completedFileId = putJson.fileId || putJson.id || putJson.googleDriveFileId;
          }
        } catch (_) {}

        startByte = endByte;
        if (completedFileId) {
          activeFileId = completedFileId;
        }

        const progressPct = Math.min(90, 25 + Math.round((startByte / totalBytes) * 65));
        const uploadedMb = (startByte / (1024 * 1024)).toFixed(1);
        const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
        if (onProgress) onProgress(progressPct, `Uploading to Google Drive (${uploadedMb} / ${totalMb} MB)...`);
      }

      const finalFileId = activeFileId || fileId;

      // Step 3: Verify in Google Drive and Trigger Telegram Audit Outbox Log
      if (onProgress) onProgress(92, 'Verifying file integrity in Google Drive & logging audit...');

      const verifyRes = await fetch(`${this.apiBase}/drive/verify-and-complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          resourceId: metadata.resourceId || finalFileId,
          fileId: finalFileId,
          originalFilename: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          metadata
        })
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.message || verifyData.error || 'Google Drive file verification failed');
      }

      if (onProgress) onProgress(100, 'Upload verified & audit trail recorded!');

      return {
        success: true,
        data: {
          fileId: finalFileId,
          googleDriveFileId: finalFileId,
          googleDriveFolderId: verifyData.data?.googleDriveFolderId || approvedFolderId,
          googleDriveStatus: 'VERIFIED',
          googleDriveUrl: `https://drive.google.com/file/d/${finalFileId}/view`,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          resourceId: metadata.resourceId || finalFileId,
          auditDelivery: verifyData.data?.auditDelivery
        }
      };
    } catch (err) {
      console.warn('Google Drive resumable upload failed:', err);
      throw err;
    }
  }

  /**
   * Generates secure viewing or download link for a resource
   */
  getFileViewerUrl(resource, currentUser = { role: 'student' }) {
    if (!resource) return null;

    if (resource.resourceType === 'drive_link' && resource.googleDriveUrl) {
      return resource.googleDriveUrl;
    }

    const fileId = resource.googleDriveFileId || resource.telegramFileId;
    if (fileId) {
      const params = new URLSearchParams({
        file_id: fileId,
        resource_id: resource.id || '',
        filename: resource.originalFilename || 'document',
        mime: resource.mimeType || 'application/pdf',
        publication_status: resource.publicationStatus || 'published',
        owner_id: resource.ownerId || '',
        role: currentUser.role || 'student',
        user_id: currentUser.id || '',
        user_email: currentUser.email || ''
      });
      return `${this.apiBase}/drive/stream?${params.toString()}`;
    }

    return null;
  }
}
