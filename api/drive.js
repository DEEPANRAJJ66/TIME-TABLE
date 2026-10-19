// Google Drive API v3 Storage Integration
// Dedicated Folder Boundary, Resumable Chunked Uploads & Secure Streaming Proxy
// Institution: Saranathan College of Engineering (Autonomous)

import https from 'https';

let cachedAccessToken = null;
let tokenExpiresAt = 0;

export function getApprovedFolderId() {
  return process.env.GOOGLE_DRIVE_APPROVED_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID || '1l-K5elNmYw_THQXCEvucT2BRzNtbKhYi';
}

/**
 * Obtains a valid Google OAuth access token using refresh token
 */
export async function getAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && tokenExpiresAt > now + 60000) {
    return cachedAccessToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Drive OAuth credentials missing in backend environment variables.');
  }

  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('refresh_token', refreshToken);
  params.append('grant_type', 'refresh_token');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Google Drive token refresh failed: ${data.error_description || data.error || 'Unknown error'}`);
  }

  cachedAccessToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in ? data.expires_in * 1000 : 3600000);
  return cachedAccessToken;
}

/**
 * Uploads a file directly (for files < 5MB) into the approved folder
 */
export async function uploadDirectToDrive({ filename, mimeType, buffer, metadata = {} }) {
  const folderId = getApprovedFolderId();
  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_APPROVED_FOLDER_ID is not configured in backend.');
  }

  const token = await getAccessToken();

  const fileMetadata = {
    name: filename,
    parents: [folderId],
    description: metadata.description || `Uploaded by ${metadata.uploaderName || 'CSE User'} (${metadata.uploaderEmail || ''})`
  };

  const boundary = '-------' + Math.random().toString(36).substring(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metaHeader = delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(fileMetadata);

  const fileHeader = delimiter +
    `Content-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`;

  const payload = Buffer.concat([
    Buffer.from(metaHeader, 'utf8'),
    Buffer.from(fileHeader, 'utf8'),
    buffer,
    Buffer.from(closeDelimiter, 'utf8')
  ]);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,mimeType,webContentLink,webViewLink', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(payload.length)
    },
    body: payload
  });

  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(`Google Drive upload failed: ${data.error?.message || 'Unknown Drive API error'}`);
  }

  return {
    fileId: data.id,
    filename: data.name,
    mimeType: data.mimeType,
    fileSize: Number(data.size || buffer.length),
    approvedFolderId: folderId,
    driveStatus: 'VERIFIED'
  };
}

/**
 * Initiates a resumable upload session for large files (supports up to 500 MB)
 */
export async function initiateResumableSession({ filename, mimeType, fileSize, metadata = {} }) {
  const folderId = getApprovedFolderId();
  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_APPROVED_FOLDER_ID is not configured in backend.');
  }

  const token = await getAccessToken();

  const fileMetadata = {
    name: filename,
    parents: [folderId],
    description: metadata.description || `Uploaded by ${metadata.uploaderName || 'CSE User'} (${metadata.uploaderEmail || ''})`
  };

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType || 'application/octet-stream',
      'X-Upload-Content-Length': String(fileSize)
    },
    body: JSON.stringify(fileMetadata)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to initiate resumable Drive session: ${res.statusText} (${errText})`);
  }

  const uploadUri = res.headers.get('location');
  if (!uploadUri) {
    throw new Error('Google Drive did not return a resumable session URI.');
  }

  return {
    uploadUri,
    approvedFolderId: folderId,
    filename,
    fileSize,
    mimeType
  };
}

/**
 * Streams file content from Google Drive for authorized student preview or download
 */
export async function streamFileFromDrive(driveFileId, rangeHeader, res) {
  const token = await getAccessToken();

  return new Promise((resolve, reject) => {
    const headers = {
      'Authorization': `Bearer ${token}`
    };
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const req = https.get(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`, { headers }, (driveRes) => {
      // Forward status code (200 or 206 for range)
      res.statusCode = driveRes.statusCode;

      // Forward relevant headers
      ['content-type', 'content-length', 'content-range', 'accept-ranges', 'content-disposition'].forEach(h => {
        if (driveRes.headers[h]) {
          res.setHeader(h, driveRes.headers[h]);
        }
      });

      driveRes.pipe(res);
      driveRes.on('end', () => resolve());
      driveRes.on('error', (err) => reject(err));
    });

    req.on('error', (err) => reject(err));
  });
}
