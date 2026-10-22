// Test Suite: Google Drive Diagnostics & Credential Recovery
// Institution: Saranathan College of Engineering (Autonomous)
// Validates safe server diagnostics, sanitized reporting, error taxonomy, and OAuth helpers

import { 
  getApprovedFolderId, 
  generateGoogleAuthUrl, 
  runDriveDiagnostics,
  getOAuthTokenWithDetails,
  getServiceAccountTokenWithDetails
} from '../lib/drive.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

console.log('\n--- GOOGLE DRIVE DIAGNOSTICS & OAUTH SUITE ---');

// 1. Folder boundary
const folderId = getApprovedFolderId();
assert(folderId === '1l-K5elNmYw_THQXCEvucT2BRzNtbKhYi', 'Approved folder ID matches Saranathan CSE Materials folder boundary');

// 2. Auth URL generation
const authUrl = generateGoogleAuthUrl('http://localhost:3000/oauth2callback');
assert(authUrl.startsWith('https://accounts.google.com/o/oauth2/v2/auth'), 'Auth URL targets Google OAuth 2.0 authorization endpoint');
assert(authUrl.includes('response_type=code'), 'Auth URL requests authorization code');
assert(authUrl.includes('access_type=offline'), 'Auth URL specifies offline access for refresh token generation');
assert(authUrl.includes('prompt=consent'), 'Auth URL forces consent prompt to guarantee refresh token is returned');
assert(authUrl.includes('drive.file'), 'Auth URL requests drive.file scope');

// 3. Independent token diagnostics structure
const oauthDetails = await getOAuthTokenWithDetails();
assert(oauthDetails && typeof oauthDetails === 'object', 'getOAuthTokenWithDetails returns structured result');
assert(!('token' in oauthDetails && oauthDetails.token && oauthDetails.token.includes('secret')), 'Tokens do not leak client secrets');

const saDetails = await getServiceAccountTokenWithDetails();
assert(saDetails && typeof saDetails === 'object', 'getServiceAccountTokenWithDetails returns structured result');
assert(!('privateKey' in saDetails), 'Service Account private key is strictly withheld from diagnostic return');

// 4. Safe Diagnostic Report
const diagReport = await runDriveDiagnostics();
assert(diagReport && typeof diagReport === 'object', 'runDriveDiagnostics returns structured report');
assert('timestamp' in diagReport, 'Diagnostic report includes ISO timestamp');
assert('oauth' in diagReport, 'Diagnostic report includes OAuth status');
assert('serviceAccount' in diagReport, 'Diagnostic report includes Service Account status');
assert('folder' in diagReport, 'Diagnostic report includes Folder reachability status');
assert('testUpload' in diagReport, 'Diagnostic report includes Test Upload status');
assert('summary' in diagReport, 'Diagnostic report includes Executive Summary');

// 5. Verification of Secret Sanitization (Zero credential leakage)
const reportString = JSON.stringify(diagReport);
assert(!reportString.includes('-----BEGIN PRIVATE KEY-----'), 'Diagnostic report strictly excludes private keys');
assert(!reportString.includes('GOCSPX-'), 'Diagnostic report strictly excludes OAuth client secrets');
assert(!reportString.includes('1//0'), 'Diagnostic report strictly excludes raw refresh tokens');

console.log(`\nDiagnostics Results: ${passed} Passed, ${failed} Failed\n`);
if (failed > 0) process.exit(1);
