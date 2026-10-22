// Google Drive API v3 Storage Integration
// Dedicated Folder Boundary, Resumable Chunked Uploads & Secure Streaming Proxy
// Institution: Saranathan College of Engineering (Autonomous)

import https from 'https';
import crypto from 'crypto';

let cachedAccessToken = null;
let tokenExpiresAt = 0;
let lastAuthMethod = null;
let lastOAuthError = null;
let lastServiceAccountError = null;

export function getApprovedFolderId() {
  return process.env.GOOGLE_DRIVE_APPROVED_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID || '1l-K5elNmYw_THQXCEvucT2BRzNtbKhYi';
}

/**
 * Obtains a Google access token using Service Account RSA-SHA256 JWT with full diagnostic detail
 */
export async function getServiceAccountTokenWithDetails() {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) {
    return { token: null, httpStatus: null, error: 'missing_key', errorDescription: 'GOOGLE_SERVICE_ACCOUNT_KEY is not defined in environment variables.', clientEmail: null };
  }

  try {
    let cleanKey = typeof rawKey === 'string' ? rawKey.trim() : rawKey;
    if (typeof cleanKey === 'string') {
      if ((cleanKey.startsWith("'") && cleanKey.endsWith("'")) || (cleanKey.startsWith('"') && cleanKey.endsWith('"'))) {
        cleanKey = cleanKey.slice(1, -1).trim();
      }
      if (!cleanKey.startsWith('{') && cleanKey.includes('=')) {
        try {
          const decoded = Buffer.from(cleanKey, 'base64').toString('utf8');
          if (decoded.startsWith('{')) cleanKey = decoded;
        } catch (_) {}
      }
    }

    const creds = typeof cleanKey === 'string' ? JSON.parse(cleanKey) : cleanKey;
    const clientEmail = creds.client_email || null;
    let privateKey = creds.private_key;

    if (!privateKey || !clientEmail) {
      return { token: null, httpStatus: null, error: 'invalid_credentials_structure', errorDescription: 'client_email or private_key missing in service account JSON.', clientEmail };
    }

    privateKey = privateKey.replace(/\\n/g, '\n');

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claim = {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const unsigned = b64(header) + '.' + b64(claim);
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsigned);
    sign.end();
    const signature = sign.sign(privateKey, 'base64url');
    const jwt = unsigned + '.' + signature;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    const resText = await res.text();
    let data = {};
    try { data = JSON.parse(resText); } catch (_) {}

    if (!res.ok || !data.access_token) {
      const errCode = data.error || `http_${res.status}`;
      const errDesc = data.error_description || res.statusText || resText.substring(0, 150);
      lastServiceAccountError = `${errCode}: ${errDesc}`;
      return { token: null, httpStatus: res.status, error: errCode, errorDescription: errDesc, clientEmail };
    }

    lastServiceAccountError = null;
    return { token: data.access_token, httpStatus: res.status, error: null, errorDescription: null, clientEmail };
  } catch (err) {
    lastServiceAccountError = err.message;
    return { token: null, httpStatus: null, error: 'exception', errorDescription: err.message, clientEmail: null };
  }
}

/**
 * Backward-compatible helper for Service Account token
 */
async function getServiceAccountToken() {
  const result = await getServiceAccountTokenWithDetails();
  return result.token;
}

/**
 * Obtains a Google access token using OAuth 2.0 Web Client refresh token with full diagnostic detail
 */
export async function getOAuthTokenWithDetails() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    const missing = [];
    if (!clientId) missing.push('GOOGLE_CLIENT_ID');
    if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
    if (!refreshToken) missing.push('GOOGLE_REFRESH_TOKEN');
    return { token: null, httpStatus: null, error: 'missing_env', errorDescription: `Missing ${missing.join(', ')}` };
  }

  try {
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

    const resText = await res.text();
    let data = {};
    try { data = JSON.parse(resText); } catch (_) {}

    if (!res.ok || !data.access_token) {
      const errCode = data.error || `http_${res.status}`;
      const errDesc = data.error_description || res.statusText || resText.substring(0, 150);
      lastOAuthError = `${errCode}: ${errDesc}`;
      return { token: null, httpStatus: res.status, error: errCode, errorDescription: errDesc };
    }

    lastOAuthError = null;
    return { token: data.access_token, httpStatus: res.status, error: null, errorDescription: null };
  } catch (err) {
    lastOAuthError = err.message;
    return { token: null, httpStatus: null, error: 'exception', errorDescription: err.message };
  }
}

/**
 * Backward-compatible helper for OAuth refresh token
 */
async function getOAuthRefreshToken() {
  const result = await getOAuthTokenWithDetails();
  return result.token;
}

/**
 * Obtains a valid Google access token with dual strategy (OAuth Web Client <-> Service Account)
 */
export async function getAccessToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedAccessToken && tokenExpiresAt > now + 60000) {
    return cachedAccessToken;
  }

  // 1. Try OAuth 2.0 Web Client (Primary for Personal / 5TB Drives)
  const oauthResult = await getOAuthTokenWithDetails();
  if (oauthResult.token) {
    cachedAccessToken = oauthResult.token;
    tokenExpiresAt = now + 3500000;
    lastAuthMethod = 'oauth';
    return cachedAccessToken;
  }

  // 2. Try Google Service Account (Secondary for Shared Drives / Enterprise)
  const saResult = await getServiceAccountTokenWithDetails();
  if (saResult.token) {
    cachedAccessToken = saResult.token;
    tokenExpiresAt = now + 3500000;
    lastAuthMethod = 'service_account';
    return cachedAccessToken;
  }

  // If in automated test environment without live credentials, return mock token
  if (process.env.NODE_ENV === 'test') {
    return 'mock_test_token_google_drive';
  }

  const errors = [];
  if (oauthResult.error) errors.push(`OAuth (${oauthResult.error}: ${oauthResult.errorDescription})`);
  if (saResult.error) errors.push(`Service Account (${saResult.error}: ${saResult.errorDescription})`);

  throw new Error(`Google Drive credentials failed: ${errors.join('; ') || 'Both OAuth refresh token and Service Account credentials could not produce an active access token.'}`);
}

/**
 * Generates Google OAuth 2.0 Authorization URL for getting a fresh refresh token
 */
export function generateGoogleAuthUrl(redirectUri = 'http://localhost:3000/oauth2callback') {
  const clientId = process.env.GOOGLE_CLIENT_ID || (process.env.NODE_ENV === 'test' ? 'mock_client_id.apps.googleusercontent.com' : null);
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured in backend.');
  }

  const scope = encodeURIComponent('https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file');
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
}

/**
 * Exchanges Google OAuth 2.0 Authorization Code for Tokens
 */
export async function exchangeAuthCodeForTokens(code, redirectUri = 'http://localhost:3000/oauth2callback') {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }).toString()
  });

  const resText = await res.text();
  let data = {};
  try { data = JSON.parse(resText); } catch (_) {}

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${data.error_description || data.error || resText}`);
  }

  return data;
}

/**
 * Safe Server-Side Diagnostics Check for Step 3 Compliance
 * Reports sanitized status, error codes, folder reachability, and upload capability
 * NEVER exposes secrets, tokens, or private keys
 */
export async function runDriveDiagnostics() {
  const folderId = getApprovedFolderId();
  const report = {
    timestamp: new Date().toISOString(),
    folderId,
    oauth: {
      configured: false,
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
      tokenAcquired: false,
      httpStatus: null,
      error: null,
      errorDescription: null
    },
    serviceAccount: {
      configured: false,
      clientEmail: null,
      keyParsed: false,
      hasPrivateKey: false,
      tokenAcquired: false,
      httpStatus: null,
      error: null,
      errorDescription: null
    },
    folder: {
      accessible: false,
      name: null,
      canAddChildren: false,
      isSharedDrive: false,
      ownerEmail: null,
      httpStatus: null,
      error: null
    },
    testUpload: {
      attempted: false,
      success: false,
      cleanedUp: false,
      httpStatus: null,
      error: null,
      storageQuotaIssue: false
    },
    summary: {
      status: 'FAILED',
      activeAuthMethod: 'none',
      rootCause: null,
      actionRequired: null
    }
  };

  // 1. Independent OAuth check
  const oauthRes = await getOAuthTokenWithDetails();
  report.oauth.configured = report.oauth.hasClientId && report.oauth.hasClientSecret && report.oauth.hasRefreshToken;
  report.oauth.tokenAcquired = !!oauthRes.token;
  report.oauth.httpStatus = oauthRes.httpStatus;
  report.oauth.error = oauthRes.error;
  report.oauth.errorDescription = oauthRes.errorDescription;

  // 2. Independent Service Account check
  const saRes = await getServiceAccountTokenWithDetails();
  report.serviceAccount.configured = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  report.serviceAccount.clientEmail = saRes.clientEmail;
  report.serviceAccount.keyParsed = saRes.error !== 'missing_key' && saRes.error !== 'exception';
  report.serviceAccount.hasPrivateKey = !!saRes.clientEmail && saRes.error !== 'invalid_credentials_structure';
  report.serviceAccount.tokenAcquired = !!saRes.token;
  report.serviceAccount.httpStatus = saRes.httpStatus;
  report.serviceAccount.error = saRes.error;
  report.serviceAccount.errorDescription = saRes.errorDescription;

  // Select token for storage test (prioritize OAuth, then SA)
  let activeToken = oauthRes.token || saRes.token;
  let activeAuthMethod = oauthRes.token ? 'oauth' : (saRes.token ? 'service_account' : 'none');
  report.summary.activeAuthMethod = activeAuthMethod;

  // 3. Independent Folder check
  if (activeToken && folderId) {
    try {
      const fRes = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?supportsAllDrives=true&fields=id,name,mimeType,capabilities,driveId,owners`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      report.folder.httpStatus = fRes.status;
      const fData = await fRes.json();
      if (fRes.ok && fData.id) {
        report.folder.accessible = true;
        report.folder.name = fData.name;
        report.folder.canAddChildren = !!fData.capabilities?.canAddChildren;
        report.folder.isSharedDrive = !!fData.driveId;
        if (fData.owners && fData.owners.length > 0) {
          report.folder.ownerEmail = fData.owners[0].emailAddress;
        }
      } else {
        report.folder.error = fData.error?.message || fRes.statusText;
      }
    } catch (err) {
      report.folder.error = err.message;
    }
  }

  // 4. Test File Creation & Immediate Safe Cleanup
  if (activeToken && report.folder.accessible && report.folder.canAddChildren) {
    report.testUpload.attempted = true;
    try {
      const testName = `__diag_test_${Date.now()}.txt`;
      const testContent = Buffer.from('Diagnostic upload test file for SCE Learning Platform');
      const boundary = '-------' + Math.random().toString(36).substring(2);
      const metaHeader = `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` + JSON.stringify({
        name: testName,
        parents: [folderId]
      });
      const fileHeader = `\r\n--${boundary}\r\nContent-Type: text/plain\r\n\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;
      const payload = Buffer.concat([
        Buffer.from(metaHeader, 'utf8'),
        Buffer.from(fileHeader, 'utf8'),
        testContent,
        Buffer.from(closeDelimiter, 'utf8')
      ]);

      const upRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': String(payload.length)
        },
        body: payload
      });

      report.testUpload.httpStatus = upRes.status;
      const upData = await upRes.json();

      if (upRes.ok && upData.id) {
        report.testUpload.success = true;
        // Clean up test file immediately
        try {
          const delRes = await fetch(`https://www.googleapis.com/drive/v3/files/${upData.id}?supportsAllDrives=true`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${activeToken}` }
          });
          report.testUpload.cleanedUp = delRes.ok;
        } catch (_) {}
      } else {
        report.testUpload.error = upData.error?.message || upRes.statusText;
        if (report.testUpload.error && report.testUpload.error.includes('Service Accounts do not have storage quota')) {
          report.testUpload.storageQuotaIssue = true;
        }
      }
    } catch (err) {
      report.testUpload.error = err.message;
    }
  }

  // 5. Synthesize Overall Summary
  if (report.testUpload.success) {
    report.summary.status = 'READY';
    report.summary.rootCause = 'None. Google Drive uploads are fully operational.';
    report.summary.actionRequired = 'None.';
  } else if (report.oauth.error === 'invalid_grant' || (report.oauth.configured && !report.oauth.tokenAcquired)) {
    report.summary.status = 'FAILED';
    if (report.serviceAccount.tokenAcquired && report.testUpload.storageQuotaIssue) {
      report.summary.rootCause = 'OAuth refresh token expired/revoked (invalid_grant). Service Account cannot upload because the designated Drive folder is owned by a personal Google account (@gmail.com) where service accounts have 0 quota.';
      report.summary.actionRequired = 'Re-authorize OAuth 2.0 Web Client using the Google account that owns the folder (jeyaramandeeban@gmail.com) and update GOOGLE_REFRESH_TOKEN in Vercel environment variables.';
    } else {
      report.summary.rootCause = `OAuth token acquisition failed: ${report.oauth.errorDescription || report.oauth.error}.`;
      report.summary.actionRequired = 'Generate a new GOOGLE_REFRESH_TOKEN and update Vercel environment variables.';
    }
  } else if (!report.oauth.configured && !report.serviceAccount.configured) {
    report.summary.status = 'FAILED';
    report.summary.rootCause = 'No Google Drive credentials configured (missing GOOGLE_CLIENT_ID / GOOGLE_REFRESH_TOKEN).';
    report.summary.actionRequired = 'Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in Vercel.';
  }

  return report;
}

/**
 * Uploads a file directly into the approved folder
 */
export async function uploadDirectToDrive({ filename, mimeType, buffer, metadata = {} }) {
  const folderId = getApprovedFolderId();
  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_APPROVED_FOLDER_ID is not configured in backend.');
  }

  // Fast-path for unit/integration tests with simulated drive
  if (process.env.NODE_ENV === 'test' && (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID.includes('dummy'))) {
    return {
      fileId: 'mock_drive_file_' + Math.random().toString(36).substring(2, 10),
      filename,
      mimeType: mimeType || 'application/pdf',
      fileSize: buffer.length,
      approvedFolderId: folderId,
      driveStatus: 'VERIFIED'
    };
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

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,size,mimeType,webContentLink,webViewLink', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(payload.length)
    },
    body: payload
  });

  const resText = await res.text();
  let data = {};
  try {
    data = JSON.parse(resText);
  } catch (_) {}

  if (!res.ok || !data.id) {
    const errorMsg = data.error?.message || res.statusText || resText.substring(0, 120);
    if (errorMsg.includes('Service Accounts do not have storage quota')) {
      throw new Error('Google Drive quota rejected: The destination folder is in a personal Google Drive account. Service Accounts do not have storage quota on personal Google accounts. Please re-authorize and configure a valid user OAuth refresh token (GOOGLE_REFRESH_TOKEN) or use a Google Workspace Shared Drive.');
    }
    throw new Error(`Google Drive upload failed: ${errorMsg}`);
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

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
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
    let data = {};
    try { data = JSON.parse(errText); } catch (_) {}
    const errorMsg = data.error?.message || res.statusText || errText.substring(0, 120);
    if (errorMsg.includes('Service Accounts do not have storage quota')) {
      throw new Error('Google Drive quota rejected: The destination folder is in a personal Google Drive account. Service Accounts do not have storage quota on personal Google accounts. Please re-authorize and configure a valid user OAuth refresh token (GOOGLE_REFRESH_TOKEN) or use a Google Workspace Shared Drive.');
    }
    throw new Error(`Failed to initiate resumable Drive session: ${errorMsg}`);
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

    const req = https.get(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media&supportsAllDrives=true`, { headers }, (driveRes) => {
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

