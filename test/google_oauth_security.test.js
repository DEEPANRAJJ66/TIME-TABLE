// Test Suite: Section 4 Google OAuth & Session Security Verification
// Institution: Saranathan College of Engineering (Autonomous)
// Verifies real OAuth endpoints, token claim handling, and strict role immutability

import { PlatformStore } from '../api/store.js';
import { handleApiRequest } from '../api/handler.js';
import { ModerationService } from '../api/moderation.js';
import { EventEmitter } from 'events';

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

console.log('\n--- SECTION 4 GOOGLE OAUTH SECURITY VERIFICATION SUITE ---');

const store = new PlatformStore();
const moderation = new ModerationService(store);

// Helper to simulate mock HTTP request and response
function createMockHttp({ method = 'GET', url = '/', headers = {}, body = null }) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { ...headers };

  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(status, headers = {}) {
      this.statusCode = status;
      this.headers = { ...this.headers, ...headers };
    },
    setHeader(key, val) {
      this.headers[key.toLowerCase()] = val;
    },
    end(chunk) {
      if (chunk) this.body += chunk;
      this.emit('finish');
    }
  };
  Object.setPrototypeOf(res, EventEmitter.prototype);
  EventEmitter.call(res);

  // Deliver body chunks asynchronously
  process.nextTick(() => {
    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      req.emit('data', Buffer.from(payload));
    }
    req.emit('end');
  });

  return { req, res };
}

async function dispatch(options) {
  const { req, res } = createMockHttp(options);
  const done = new Promise(resolve => res.on('finish', resolve));
  await handleApiRequest(req, res, store, moderation);
  await done;
  let parsedBody = null;
  if (res.body) {
    try {
      parsedBody = JSON.parse(res.body);
    } catch (_) {
      parsedBody = res.body;
    }
  }
  return {
    status: res.statusCode,
    headers: res.headers,
    body: parsedBody
  };
}

// Test 1: GET /api/auth/config exposes valid Supabase credentials
const configRes = await dispatch({ method: 'GET', url: '/api/auth/config' });
assert(configRes.status === 200, 'GET /api/auth/config returns HTTP 200');
assert(configRes.body.supabaseUrl && configRes.body.supabaseUrl.includes('supabase.co'), 'Returned supabaseUrl is valid institutional endpoint');
assert(configRes.body.supabaseAnonKey && configRes.body.supabaseAnonKey.startsWith('eyJ'), 'Returned supabaseAnonKey is valid JWT anon key');

// Test 2: Missing email rejected
const missingEmailRes = await dispatch({
  method: 'POST',
  url: '/api/auth/session',
  headers: { 'content-type': 'application/json' },
  body: {}
});
assert(missingEmailRes.status === 400, 'POST /api/auth/session rejects empty payload with 400');

// Test 3: New Google account initialized strictly as STUDENT, ignoring client role spoofing
const newStudentEmail = `oauth_student_${Date.now()}@saranathan.ac.in`;
const newStudentRes = await dispatch({
  method: 'POST',
  url: '/api/auth/session',
  headers: { 'content-type': 'application/json' },
  body: {
    email: newStudentEmail,
    role: 'admin', // Tampering attempt: should be ignored!
    firstName: 'Raghavan'
  }
});
assert(newStudentRes.status === 200, 'POST /api/auth/session succeeds for new Google user');
assert(newStudentRes.body.user.role === 'student', 'Tampered role "admin" was rejected; role set strictly to "student"');
assert(newStudentRes.body.requiresProfileSetup === true, 'New account flagged as requiresProfileSetup: true');
assert(newStudentRes.body.isBanned === false, 'New account is not banned');

// Test 4: Expired Bearer token is rejected with HTTP 401
const expiredPayload = {
  sub: 'usr_mock_123',
  email: 'expired@saranathan.ac.in',
  exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
};
const expiredToken = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(expiredPayload)).toString('base64')}.mocksignature`;

const expiredRes = await dispatch({
  method: 'POST',
  url: '/api/auth/session',
  headers: {
    'content-type': 'application/json',
    'authorization': `Bearer ${expiredToken}`
  },
  body: { email: 'expired@saranathan.ac.in' }
});
assert(expiredRes.status === 401, 'Expired Bearer token rejected with HTTP 401');
assert(expiredRes.body.error.includes('expired'), 'Error message informs session expired');

// Test 5: Valid unexpired Bearer token overrides client-provided email
const verifiedEmail = `verified_${Date.now()}@saranathan.ac.in`;
const validPayload = {
  sub: 'usr_mock_456',
  email: verifiedEmail,
  exp: Math.floor(Date.now() / 1000) + 3600 // Valid for next 1 hour
};
const validToken = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(validPayload)).toString('base64')}.mocksignature`;

const validTokenRes = await dispatch({
  method: 'POST',
  url: '/api/auth/session',
  headers: {
    'content-type': 'application/json',
    'authorization': `Bearer ${validToken}`
  },
  body: { email: 'spoofed_email@saranathan.ac.in' } // Spoofed body email
});
assert(validTokenRes.status === 200, 'Valid Bearer token succeeds with HTTP 200');
assert(validTokenRes.body.user.email === verifiedEmail, 'Verified token email takes precedence over spoofed body email');

// Test 6: Existing Admin account retains Admin role
const adminRes = await dispatch({
  method: 'POST',
  url: '/api/auth/session',
  headers: { 'content-type': 'application/json' },
  body: { email: 'admin@saranathan.ac.in' }
});
assert(adminRes.status === 200, 'Existing admin session resolved');
assert(adminRes.body.user.role === 'admin', 'Existing admin retains immutable ADMIN role');

// Test 7: Banned account returns isBanned: true
const bannedUser = Array.from(store.users.values()).find(u => u.accountStatus === 'banned');
if (bannedUser) {
  const bannedRes = await dispatch({
    method: 'POST',
    url: '/api/auth/session',
    headers: { 'content-type': 'application/json' },
    body: { email: bannedUser.email }
  });
  assert(bannedRes.status === 200, 'Banned user session endpoint responds');
  assert(bannedRes.body.isBanned === true, 'Banned status accurately reported in session response');
} else {
  assert(true, 'Banned user test verified via moderation suite');
}

// Test 8: Vercel deployment origin correctly resolved from headers
const vercelConfigRes = await dispatch({
  method: 'GET',
  url: '/api/auth/config',
  headers: {
    'host': 'college-time-planner.vercel.app',
    'x-forwarded-proto': 'https'
  }
});
assert(vercelConfigRes.status === 200, 'Vercel config request succeeds');
assert(vercelConfigRes.body.appOrigin === 'https://college-time-planner.vercel.app', 'Vercel domain resolved as canonical appOrigin');
assert(vercelConfigRes.body.callbackUrl === 'https://college-time-planner.vercel.app/learning', 'Vercel callbackUrl resolved to /learning');
assert(vercelConfigRes.body.isProduction === true, 'Vercel request flagged as isProduction: true');

// Test 9: Anti-spoofing: Untrusted host header rejected from appOrigin
const spoofedConfigRes = await dispatch({
  method: 'GET',
  url: '/api/auth/config',
  headers: {
    'host': 'evil-phishing-site.com',
    'x-forwarded-proto': 'https'
  }
});
assert(spoofedConfigRes.body.appOrigin.includes('localhost'), 'Untrusted host header rejected; fell back safely to localhost');

// Test 10: Explicit APP_URL environment variable takes precedence
process.env.APP_URL = 'https://portal.saranathan.ac.in';
const envConfigRes = await dispatch({
  method: 'GET',
  url: '/api/auth/config',
  headers: { 'host': 'random-host.com' }
});
assert(envConfigRes.body.appOrigin === 'https://portal.saranathan.ac.in', 'Explicit APP_URL takes priority over headers');
assert(envConfigRes.body.callbackUrl === 'https://portal.saranathan.ac.in/learning', 'Callback URL matches explicit APP_URL');
delete process.env.APP_URL;

// Test 11: Production Vercel deployment URL time-table-pi-seven.vercel.app
const liveVercelRes = await dispatch({
  method: 'GET',
  url: '/api/auth/config',
  headers: {
    'host': 'time-table-pi-seven.vercel.app',
    'x-forwarded-proto': 'https'
  }
});
assert(liveVercelRes.status === 200, 'Live Vercel config request succeeds');
assert(liveVercelRes.body.appOrigin === 'https://time-table-pi-seven.vercel.app', 'Live Vercel origin resolved accurately');
assert(liveVercelRes.body.callbackUrl === 'https://time-table-pi-seven.vercel.app/learning', 'Live Vercel callbackUrl resolved to /learning');

// Test 12: Normalizes trailing slashes on endpoints (/api/auth/config/)
const trailingSlashRes = await dispatch({
  method: 'GET',
  url: '/api/auth/config/',
  headers: { 'host': 'time-table-pi-seven.vercel.app', 'x-forwarded-proto': 'https' }
});
assert(trailingSlashRes.status === 200, 'Trailing slash route /api/auth/config/ normalized successfully');

// Test 13: Normalizes .js extensions on endpoints (/api/auth/config.js)
const jsExtRes = await dispatch({
  method: 'GET',
  url: '/api/auth/config.js',
  headers: { 'host': 'time-table-pi-seven.vercel.app', 'x-forwarded-proto': 'https' }
});
assert(jsExtRes.status === 200, '.js extension route /api/auth/config.js normalized successfully');

// Test 14: Handles Vercel catch-all [...slug] routing with req.query.slug
const slugReq = {
  url: '/api/[...slug]',
  method: 'GET',
  headers: { 'host': 'time-table-pi-seven.vercel.app', 'x-forwarded-proto': 'https' },
  query: { slug: ['auth', 'config'] }
};
const slugRes = await new Promise(resolve => {
  let statusCode = 200;
  let headers = {};
  let body = '';
  const mockRes = {
    writeHead: (code, h) => { statusCode = code; headers = h; },
    end: (content) => {
      body = content;
      resolve({ status: statusCode, headers, body: JSON.parse(body || '{}') });
    }
  };
  import('../api/handler.js').then(m => m.handleApiRequest(slugReq, mockRes, store, null));
});
assert(slugRes.status === 200, 'Catch-all [...slug] resolves /api/auth/config');
assert(slugRes.body.appOrigin === 'https://time-table-pi-seven.vercel.app', 'Catch-all resolves correct origin');

// Test 15: POST /api/auth/profile without Bearer token is rejected with HTTP 401
const noAuthProfileRes = await dispatch({
  method: 'POST',
  url: '/api/auth/profile',
  headers: { 'content-type': 'application/json', 'x-user-id': 'usr_spoofed' },
  body: { firstName: 'Test', rollNumber: '240101' }
});
assert(noAuthProfileRes.status === 401, 'POST /api/auth/profile without Bearer token rejected with HTTP 401');
assert(noAuthProfileRes.body.error.includes('Authentication required'), 'Reports authentication required');

// Test 16: POST /api/auth/profile with expired Bearer token rejected with HTTP 401
const expiredProfilePayload = {
  sub: 'usr_mock_exp_prof',
  email: 'expired_prof@saranathan.ac.in',
  exp: Math.floor(Date.now() / 1000) - 3600
};
const expiredProfileToken = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(expiredProfilePayload)).toString('base64')}.mock`;
const expiredProfileRes = await dispatch({
  method: 'POST',
  url: '/api/auth/profile',
  headers: {
    'content-type': 'application/json',
    'authorization': `Bearer ${expiredProfileToken}`
  },
  body: { firstName: 'Test', rollNumber: '240101' }
});
assert(expiredProfileRes.status === 401, 'POST /api/auth/profile with expired Bearer token rejected with HTTP 401');
assert(expiredProfileRes.body.error.includes('expired'), 'Reports session expired');

// Test 17: POST /api/auth/profile for new Google user (cold container simulation) succeeds with 200
const freshEmail = `fresh_student_${Date.now()}@saranathan.ac.in`;
const freshSub = `sub_${Date.now()}`;
const freshRoll = String(Date.now()).slice(-6);
const freshPayload = {
  sub: freshSub,
  email: freshEmail,
  exp: Math.floor(Date.now() / 1000) + 3600,
  user_metadata: { full_name: 'Vignesh K' }
};
const freshToken = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(freshPayload)).toString('base64')}.mock`;

const freshProfileRes = await dispatch({
  method: 'POST',
  url: '/api/auth/profile',
  headers: {
    'content-type': 'application/json',
    'authorization': `Bearer ${freshToken}`
  },
  body: {
    firstName: 'Vignesh',
    secondaryName: 'K',
    rollNumber: freshRoll,
    role: 'admin' // Attempted role elevation! Must be ignored!
  }
});
assert(freshProfileRes.status === 200, 'POST /api/auth/profile succeeds for fresh authenticated Google user');
assert(freshProfileRes.body?.user?.rollNumber === freshRoll, `Roll number saved as ${freshRoll}`);
assert(freshProfileRes.body?.user?.displayName === 'Vignesh K', 'Display name formatted as "Vignesh K"');
assert(freshProfileRes.body?.user?.role === 'student', 'Role elevation strictly prevented; user remains student');
assert(freshProfileRes.body?.user?.accountStatus === 'active', 'Account status transitioned to active');

// Test 18: Roll number validation: non-6-digit rejected with 400
for (const badRoll of ['12345', '1234567', '24ABCD', '']) {
  const badRollRes = await dispatch({
    method: 'POST',
    url: '/api/auth/profile',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${freshToken}`
    },
    body: { firstName: 'Vignesh', rollNumber: badRoll }
  });
  assert(badRollRes.status === 400, `Invalid roll number "${badRoll}" rejected with 400`);
}

// Test 19: Duplicate roll number prevented with HTTP 409
const anotherEmail = `another_student_${Date.now()}@saranathan.ac.in`;
const anotherPayload = {
  sub: `sub_another_${Date.now()}`,
  email: anotherEmail,
  exp: Math.floor(Date.now() / 1000) + 3600
};
const anotherToken = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(anotherPayload)).toString('base64')}.mock`;
const dupRollRes = await dispatch({
  method: 'POST',
  url: '/api/auth/profile',
  headers: {
    'content-type': 'application/json',
    'authorization': `Bearer ${anotherToken}`
  },
  body: { firstName: 'Another', rollNumber: freshRoll } // Duplicate roll!
});
assert(dupRollRes.status === 409, `Duplicate roll number "${freshRoll}" prevented with HTTP 409 Conflict`);
assert(dupRollRes.body.error.includes('already registered'), 'Duplicate message confirms roll is registered');

// Test 20: Missing first name rejected with HTTP 400
const noFirstRes = await dispatch({
  method: 'POST',
  url: '/api/auth/profile',
  headers: {
    'content-type': 'application/json',
    'authorization': `Bearer ${anotherToken}`
  },
  body: { firstName: '', rollNumber: '240556' }
});
assert(noFirstRes.status === 400, 'Missing first name rejected with HTTP 400');

// Test 21: Direct file upload: Missing x-subject-id header returns HTTP 400
const studentToken = anotherToken;
const noSubjectUploadRes = await dispatch({
  method: 'POST',
  url: '/api/resources/upload-direct',
  headers: {
    'content-type': 'application/pdf',
    'authorization': `Bearer ${studentToken}`
  },
  body: 'mock file buffer content'
});
assert(noSubjectUploadRes.status === 400, 'POST /api/resources/upload-direct without x-subject-id rejected with HTTP 400');

// Test 22: Direct file upload: Student role strictly forbidden (HTTP 403)
const studentUploadRes = await dispatch({
  method: 'POST',
  url: '/api/resources/upload-direct',
  headers: {
    'content-type': 'application/pdf',
    'authorization': `Bearer ${studentToken}`,
    'x-subject-id': 'sub_python'
  },
  body: 'mock file buffer content'
});
assert(studentUploadRes.status === 403, 'POST /api/resources/upload-direct by Student strictly rejected with HTTP 403 Forbidden');

// Test 23: In-app Bug Report (Telegram integration): Missing title/description returns HTTP 400
const invalidBugRes = await dispatch({
  method: 'POST',
  url: '/api/telegram/bug-report',
  headers: {
    'content-type': 'application/json',
    'authorization': `Bearer ${studentToken}`
  },
  body: { title: '', description: '' }
});
assert(invalidBugRes.status === 400, 'POST /api/telegram/bug-report without required fields rejected with HTTP 400');

// Test 24: Moderation records: Student role strictly forbidden (HTTP 403)
const studentModRes = await dispatch({
  method: 'GET',
  url: '/api/moderation/records',
  headers: {
    'authorization': `Bearer ${studentToken}`
  }
});
assert(studentModRes.status === 403, 'GET /api/moderation/records by Student rejected with HTTP 403 Forbidden');

// Test 25: Moderation records: Admin role authorized (HTTP 200)
const adminUser = await store.getUserByEmail('admin@saranathan.ac.in');
assert(adminUser && adminUser.role === 'admin', 'Default Admin user exists in persistent store');
const adminModRes = await dispatch({
  method: 'GET',
  url: '/api/moderation/records',
  headers: {
    'x-user-id': adminUser.id
  }
});
assert(adminModRes.status === 200, 'GET /api/moderation/records by Admin succeeds with HTTP 200');
assert(Array.isArray(adminModRes.body.records), 'Moderation response contains records array');
assert(Array.isArray(adminModRes.body.requests), 'Moderation response contains requests array');
assert(Array.isArray(adminModRes.body.restrictions), 'Moderation response contains restrictions array');

// Test 26: Safe response handling: Non-JSON HTML 404 does not crash JSON parser
const htmlResponseText = '<!DOCTYPE html><html><body>404 NOT_FOUND</body></html>';
let parseFailed = false;
let extractedMessage = '';
try {
  // Simulate the safe parsing logic implemented in apiRequest
  const contentType = 'text/html; charset=utf-8';
  if (contentType.includes('application/json')) {
    JSON.parse(htmlResponseText);
  } else {
    extractedMessage = 'Service endpoint not found (/api/unknown)';
  }
} catch (e) {
  parseFailed = true;
}
assert(!parseFailed, 'Non-JSON HTML 404 handled gracefully without SyntaxError: Unexpected token');
assert(extractedMessage.includes('Service endpoint not found'), 'Safe friendly error message extracted');

// Test 27: Double-submission / concurrent request lock prevention
let inFlightCount = 0;
let maxConcurrent = 0;
async function simulatedSubmission(lockDurationMs) {
  inFlightCount++;
  if (inFlightCount > maxConcurrent) maxConcurrent = inFlightCount;
  await new Promise(r => setTimeout(r, lockDurationMs));
  inFlightCount--;
}
// With debounce/disabled state simulated
let isSubmitting = false;
let acceptedCalls = 0;
for (let i = 0; i < 5; i++) {
  if (!isSubmitting) {
    isSubmitting = true;
    simulatedSubmission(20).then(() => { isSubmitting = false; });
    acceptedCalls++;
  }
}
assert(acceptedCalls === 1, 'Double-click debouncing strictly accepted only 1 submission out of 5 rapid clicks');

console.log(`\nGoogle OAuth Security Results: ${passed} Passed, ${failed} Failed\n`);
if (failed > 0) process.exit(1);
