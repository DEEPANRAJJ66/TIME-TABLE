// Test Suite: API Client Resilience, Response Parsing, & Security Invariants
// Institution: Saranathan College of Engineering (Autonomous)
// Validates:
// 1. Client-side apiRequest() scope, undeclared variable prevention, and HTML error parsing
// 2. Strict Bearer token requirement & rejection of spoofed X-User-Id headers
// 3. Server-side Supabase token verification & role immutability
// 4. Prevention of fake success responses on failed HTTP statuses

import { apiRequest, ApiError, withButtonLoading } from '../js/platform.js';
import { resolveActor, verifySupabaseToken } from '../lib/handler.js';
import { PlatformStore } from '../lib/store.js';
import { ROLES } from '../lib/authorization.js';

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

console.log('\n--- API CLIENT RESILIENCE & RESPONSE PARSING SUITE ---');

// Mock browser globals for platform.js
globalThis.document = {
  addEventListener: () => {},
  getElementById: (id) => {
    return {
      style: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      value: '',
      innerHTML: '',
      textContent: '',
      disabled: false,
      addEventListener: () => {}
    };
  }
};
globalThis.window = {
  location: {
    origin: 'https://time-table-pi-seven.vercel.app',
    pathname: '/learning',
    href: 'https://time-table-pi-seven.vercel.app/learning',
    search: '',
    hash: ''
  },
  history: {
    replaceState: () => {}
  }
};

const originalFetch = globalThis.fetch;

try {
  // Test 1: apiRequest handles valid JSON API responses
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Map([['content-type', 'application/json; charset=utf-8']]),
    text: async () => JSON.stringify({ success: true, app: 'Saranathan Learning' })
  });
  const validRes = await apiRequest('/api/status');
  assert(validRes && validRes.success === true && validRes.app === 'Saranathan Learning', 'apiRequest parses valid JSON successfully');

  // Test 2: Regression Test - Server returns HTML 404 page ("The page could not be found...")
  // MUST NOT throw "ReferenceError: parsedData is not defined" or "SyntaxError: Unexpected token 'T'"
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    statusText: 'Not Found',
    headers: new Map([['content-type', 'text/html; charset=utf-8']]),
    text: async () => '<!DOCTYPE html><html><body>The page could not be found</body></html>'
  });
  let html404Caught = null;
  try {
    await apiRequest('/api/auth/config');
  } catch (err) {
    html404Caught = err;
  }
  assert(html404Caught instanceof ApiError, 'HTML 404 throws an instance of ApiError');
  assert(html404Caught && html404Caught.status === 404, 'HTML 404 preserves accurate HTTP status 404');
  assert(html404Caught && !html404Caught.message.includes('parsedData'), 'HTML 404 does NOT throw ReferenceError: parsedData is not defined');
  assert(html404Caught && !html404Caught.message.includes('Unexpected token'), 'HTML 404 does NOT throw SyntaxError: Unexpected token');
  assert(html404Caught && html404Caught.message.includes('Service endpoint not found'), 'HTML 404 reports clear human-readable error');

  // Test 3: Server returns plain-text 500 error
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    headers: new Map([['content-type', 'text/plain; charset=utf-8']]),
    text: async () => 'Database connection failed'
  });
  let plain500Caught = null;
  try {
    await apiRequest('/api/auth/session');
  } catch (err) {
    plain500Caught = err;
  }
  assert(plain500Caught && plain500Caught.status === 500, 'Plain-text 500 preserves HTTP 500');
  assert(plain500Caught && plain500Caught.code === 'INTERNAL_ERROR', 'Plain-text 500 categorized as INTERNAL_ERROR');

  // Test 4: Server returns HTTP 204 No Content
  globalThis.fetch = async () => ({
    ok: true,
    status: 204,
    headers: new Map(),
    text: async () => ''
  });
  const noContentRes = await apiRequest('/api/notifications/read');
  assert(noContentRes && noContentRes.success === true, 'HTTP 204 No Content cleanly handled with success: true');

  // Test 5: Server returns empty HTTP 200
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Map([['content-type', 'application/json']]),
    text: async () => ''
  });
  const emptyRes = await apiRequest('/api/ping');
  assert(emptyRes && emptyRes.success === true, 'Empty HTTP 200 response handled gracefully without crashing');

  // Test 6: Server returns malformed JSON on HTTP 200
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Map([['content-type', 'application/json']]),
    text: async () => '{"unclosed_json: true'
  });
  let malformedCaught = null;
  try {
    await apiRequest('/api/corrupted');
  } catch (err) {
    malformedCaught = err;
  }
  assert(malformedCaught && malformedCaught.code === 'INVALID_JSON', 'Malformed JSON on 200 OK caught and reported as INVALID_JSON');

  // Test 7: Network failure handling
  globalThis.fetch = async () => {
    throw new Error('Failed to fetch');
  };
  let networkErrCaught = null;
  try {
    await apiRequest('/api/test-network');
  } catch (err) {
    networkErrCaught = err;
  }
  assert(networkErrCaught && networkErrCaught.code === 'NETWORK_ERROR', 'Network failure throws ApiError with NETWORK_ERROR code');

  // Test 8: withButtonLoading prevents double-click race conditions
  let executionCount = 0;
  const mockBtn = { disabled: false, innerHTML: 'Submit' };
  const action = async () => {
    executionCount++;
    await new Promise(r => setTimeout(r, 50));
  };
  // Simulate rapid simultaneous clicks
  const p1 = withButtonLoading(mockBtn, 'Loading...', action);
  const p2 = withButtonLoading(mockBtn, 'Loading...', action);
  const p3 = withButtonLoading(mockBtn, 'Loading...', action);
  await Promise.all([p1, p2, p3]);
  assert(executionCount === 1, 'withButtonLoading strictly executed only 1 request out of 3 rapid clicks');
  assert(mockBtn.disabled === false, 'Button disabled state restored after execution');

  // ----------------------------------------------------
  // SERVER-SIDE SECURITY & TOKEN VERIFICATION
  // ----------------------------------------------------
  console.log('\n--- SERVER-SIDE SECURITY & ANTI-SPOOFING SUITE ---');

  const store = new PlatformStore();

  // Test 9: Spoofed X-User-Id header without Bearer token is strictly rejected
  const spoofedReq = {
    headers: {
      'x-user-id': 'usr_admin',
      'user-agent': 'curl/7.68.0'
    }
  };
  const resolvedSpoofed = await resolveActor(spoofedReq, store);
  assert(resolvedSpoofed === null, 'resolveActor strictly returns null for request with spoofed X-User-Id and no Bearer token');

  // Test 10: Missing Authorization header returns null
  const emptyReq = { headers: {} };
  const resolvedEmpty = await resolveActor(emptyReq, store);
  assert(resolvedEmpty === null, 'resolveActor returns null for request with no Authorization header');

  // Test 11: Expired Bearer token returns null and sets _tokenExpired
  const expiredPayload = {
    sub: 'usr_student_test',
    email: 'expired_student@saranathan.ac.in',
    exp: Math.floor(Date.now() / 1000) - 100 // expired 100s ago
  };
  const expiredToken = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(expiredPayload)).toString('base64')}.mocksignature`;
  const expiredReq = {
    headers: {
      'authorization': `Bearer ${expiredToken}`
    }
  };
  const resolvedExpired = await resolveActor(expiredReq, store);
  assert(resolvedExpired === null, 'Expired Bearer token resolves to null');
  assert(expiredReq._tokenExpired === true, 'Expired Bearer token flags req._tokenExpired = true');

  // Test 12: Valid Bearer token resolves authenticated user
  const validPayload = {
    sub: 'usr_valid_stu',
    email: 'valid_student@saranathan.ac.in',
    exp: Math.floor(Date.now() / 1000) + 3600
  };
  const validToken = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(validPayload)).toString('base64')}.mocksignature`;
  const validReq = {
    headers: {
      'authorization': `Bearer ${validToken}`
    }
  };
  const resolvedValid = await resolveActor(validReq, store);
  assert(resolvedValid && resolvedValid.email === 'valid_student@saranathan.ac.in', 'Valid Bearer token resolves user by verified email');
  assert(resolvedValid.role === ROLES.STUDENT, 'Newly resolved Google user initialized strictly as Student');

  // Test 13: Spoofed X-User-Id in presence of valid token does not elevate role
  const spoofAttemptReq = {
    headers: {
      'authorization': `Bearer ${validToken}`,
      'x-user-id': 'usr_admin' // Attempting to claim admin ID
    }
  };
  const resolvedAttempt = await resolveActor(spoofAttemptReq, store);
  assert(resolvedAttempt && resolvedAttempt.role === ROLES.STUDENT, 'User retains Student role; spoofed X-User-Id ignored');

  // ----------------------------------------------------
  // MULTI-INVOCATION SERVERLESS PERSISTENCE VERIFICATION
  // ----------------------------------------------------
  console.log('\n--- SERVERLESS MULTI-INVOCATION PERSISTENCE SUITE ---');

  // Invocation 1: Container A saves records
  const containerAStore = new PlatformStore();
  const testResId = 'res_persist_test_' + Date.now();
  const savedRes = await containerAStore.saveResource({
    id: testResId,
    title: 'Distributed Systems Lecture 1',
    filename: 'dist_sys_1.pdf',
    mimeType: 'application/pdf',
    fileSize: 1048576,
    subjectId: 'sub_python',
    sectionName: 'Unit 1',
    resourceType: 'notes',
    uploaderId: 'usr_manager_1',
    uploaderName: 'Faculty Manager',
    uploaderRole: 'manager',
    uploaderEmail: 'manager@saranathan.ac.in',
    googleDriveFileId: 'gdrive_mock_file_123',
    approvedFolderId: '1l-K5elNmYw_THQXCEvucT2BRzNtbKhYi',
    publicationStatus: 'published',
    storageProvider: 'google_drive'
  });
  assert(savedRes && savedRes.id === testResId, 'Container A saved resource successfully');

  const testNoticeId = 'notc_persist_' + Date.now();
  await containerAStore.addNotice({
    id: testNoticeId,
    title: 'Midterm Examination Schedule',
    message: 'Examinations begin next Monday.',
    formattedLetterhead: 'Dear Students, Examinations begin next Monday.',
    authorId: 'usr_admin',
    authorName: 'Admin',
    authorRole: 'admin',
    publishedAtIst: '20 Oct 2026, 11:30 AM IST',
    publicationStatus: 'published'
  });

  // Invocation 2: Completely fresh container instance simulating cold start / separate Vercel function invocation
  const containerBStore = new PlatformStore();
  const retrievedRes = await containerBStore.getResourceById(testResId);
  assert(retrievedRes !== null, 'Container B (cold start) successfully retrieved resource from shared persistent store');
  assert(retrievedRes && retrievedRes.title === 'Distributed Systems Lecture 1', 'Persistent resource metadata matches accurately');
  assert(retrievedRes && retrievedRes.googleDriveFileId === 'gdrive_mock_file_123', 'Drive file ID preserved across invocations');

  const retrievedNotices = await containerBStore.getNotices();
  const foundNotice = retrievedNotices.find(n => n.id === testNoticeId);
  assert(foundNotice !== undefined, 'Container B successfully restored global notice across serverless invocations');

  // Cleanup test artifacts from memory
  await containerBStore.deleteResource(testResId);

  // ----------------------------------------------------
  // INDIVIDUAL API ROUTE DISPATCHER VERIFICATION
  // ----------------------------------------------------
  console.log('\n--- INDIVIDUAL API ROUTE DISPATCHER SUITE ---');

  const { handleApiRequest } = await import('../lib/handler.js');
  const { ModerationService } = await import('../lib/moderation.js');
  const routeStore = new PlatformStore();
  const routeModeration = new ModerationService(routeStore);

  function createMockHttp(method, path, headers = {}, body = null) {
    const req = {
      method,
      url: path,
      headers: { ...headers },
      query: {},
      on: (evt, cb) => {
        if (evt === 'data' && body) {
          cb(typeof body === 'string' ? Buffer.from(body) : Buffer.from(JSON.stringify(body)));
        }
        if (evt === 'end') cb();
      }
    };
    let statusCode = 200;
    let responseData = '';
    const res = {
      writeHead: (code) => { statusCode = code; },
      end: (chunk) => { if (chunk) responseData += chunk; },
      setHeader: () => {}
    };
    return {
      req,
      res,
      getStatus: () => statusCode,
      getBody: () => {
        try { return JSON.parse(responseData); } catch (_) { return responseData; }
      }
    };
  }

  // 1. GET /api/status -> 200
  const statusMock = createMockHttp('GET', '/api/status');
  await handleApiRequest(statusMock.req, statusMock.res, routeStore, routeModeration);
  assert(statusMock.getStatus() === 200, 'GET /api/status returns HTTP 200 OK');
  assert(statusMock.getBody().institution === 'Saranathan College of Engineering', 'GET /api/status returns correct institution metadata');

  // 2. GET /api/auth/config -> 200
  const authConfigMock = createMockHttp('GET', '/api/auth/config');
  await handleApiRequest(authConfigMock.req, authConfigMock.res, routeStore, routeModeration);
  assert(authConfigMock.getStatus() === 200, 'GET /api/auth/config returns HTTP 200 OK');
  assert(Boolean(authConfigMock.getBody().supabaseUrl), 'GET /api/auth/config provides Supabase configuration');

  // 3. POST /api/auth/profile without token -> 401
  const unauthProfileMock = createMockHttp('POST', '/api/auth/profile', {}, { firstName: 'Test' });
  await handleApiRequest(unauthProfileMock.req, unauthProfileMock.res, routeStore, routeModeration);
  assert(unauthProfileMock.getStatus() === 401, 'POST /api/auth/profile without Bearer token returns HTTP 401 Unauthorized');

  // 4. GET /api/unknown-route -> 404 JSON
  const unknownRouteMock = createMockHttp('GET', '/api/unknown-route');
  await handleApiRequest(unknownRouteMock.req, unknownRouteMock.res, routeStore, routeModeration);
  assert(unknownRouteMock.getStatus() === 404, 'Unknown API route returns HTTP 404');
  assert(unknownRouteMock.getBody().error.includes('API route not found'), 'Unknown API route returns structured JSON error (never HTML)');

  // 5. POST /api/telegram/bug-report -> 200
  const bugReportMock = createMockHttp('POST', '/api/telegram/bug-report', {}, {
    title: 'Mobile layout alignment issue',
    description: 'The navbar hamburger menu closes unexpectedly on Android Chrome.',
    category: 'Mobile UI',
    severity: 'Low'
  });
  await handleApiRequest(bugReportMock.req, bugReportMock.res, routeStore, routeModeration);
  assert(bugReportMock.getStatus() === 200, 'POST /api/telegram/bug-report returns HTTP 200 OK');
  assert(bugReportMock.getBody().success === true, 'Bug report returned success: true');
  assert(Boolean(bugReportMock.getBody().reportId), 'Bug report generated persistent reportId');

} finally {
  globalThis.fetch = originalFetch;
}

console.log(`\nAPI Client, Persistence & Route Results: ${passed} Passed, ${failed} Failed\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
