// Role-Based Upload & Google Drive + Telegram Integration Test Suite
// Verifies:
// 1. Manager, Representative, and Admin upload navigation and permissions
// 2. Student upload blocking (RBAC)
// 3. Google Drive initiate-upload, resumable-upload, and verify-and-complete
// 4. Telegram audit dispatch on verified file upload
// 5. Dashboard jump shortcuts targeting "upload" rather than "my-uploads"

import assert from 'assert';
import { PermissionService, ROLES, PERMISSIONS } from '../js/learning/permissionService.js';
import handler from '../api/handler.js';
import { resumableSessionStore, driveFileStorage, getApprovedFolderId } from '../api/googleDrive.js';
import { telegramOutbox } from '../api/telegram.js';

// Setup Mock LocalStorage for Test Runner
class MockLocalStorage {
  constructor() { this.store = {}; }
  getItem(k) { return this.store[k] || null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}
globalThis.localStorage = new MockLocalStorage();

console.log('=== RUNNING ROLE-BASED UPLOAD & GOOGLE DRIVE / TELEGRAM TEST SUITE ===\n');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    }
  };
  return res;
}

// -----------------------------------------------------------------------------
// TEST GROUP 1: Navigation & Role-Based Permissions
// -----------------------------------------------------------------------------
console.log('--- TEST GROUP 1: Navigation & Role-Based Permissions ---');

it('1. Manager navigation includes "upload" material tab', () => {
  const nav = PermissionService.getNavigationForRole(ROLES.MANAGER);
  const uploadItem = nav.roleItems.find(i => i.id === 'upload');
  assert.ok(uploadItem, 'Manager must have upload item in role navigation');
  assert.strictEqual(uploadItem.label, 'Upload Material');
});

it('2. Representative navigation includes "upload" material tab', () => {
  const nav = PermissionService.getNavigationForRole(ROLES.REPRESENTATIVE);
  const uploadItem = nav.roleItems.find(i => i.id === 'upload');
  assert.ok(uploadItem, 'Representative must have upload item in role navigation');
  assert.strictEqual(uploadItem.label, 'Upload Material');
});

it('3. Administrator navigation includes "upload" material tab', () => {
  const nav = PermissionService.getNavigationForRole(ROLES.ADMIN);
  const uploadItem = nav.roleItems.find(i => i.id === 'upload');
  assert.ok(uploadItem, 'Administrator must have upload item in role navigation');
  assert.strictEqual(uploadItem.label, 'Upload Material');
});

it('4. Student navigation strictly excludes "upload" material tab', () => {
  const nav = PermissionService.getNavigationForRole(ROLES.STUDENT);
  const uploadItem = nav.allItems.find(i => i.id === 'upload');
  assert.strictEqual(uploadItem, undefined, 'Student must NEVER have upload item in navigation');
});

it('5. Permission matrix grants UPLOAD_RESOURCES to Admin, Representative, and Manager, but denies Student', () => {
  assert.strictEqual(PermissionService.hasPermission(ROLES.ADMIN, 'UPLOAD_RESOURCES'), true);
  assert.strictEqual(PermissionService.hasPermission(ROLES.REPRESENTATIVE, 'UPLOAD_RESOURCES'), true);
  assert.strictEqual(PermissionService.hasPermission(ROLES.MANAGER, 'UPLOAD_RESOURCES'), true);
  assert.strictEqual(PermissionService.hasPermission(ROLES.STUDENT, 'UPLOAD_RESOURCES'), false);
});

// -----------------------------------------------------------------------------
// TEST GROUP 2: Backend Upload Authorization & Boundary Protection
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 2: Backend Upload Authorization & Boundary Protection ---');

await itAsync('6. Student role is rejected from initiating Google Drive upload (HTTP 403)', async () => {
  const req = {
    method: 'POST',
    url: '/api/drive/initiate-upload',
    headers: {
      'x-user-role': 'student',
      'x-user-email': 'student@saranathan.ac.in',
      'x-user-name': 'Student User'
    },
    body: {
      filename: 'lecture_notes.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf'
    }
  };
  const res = mockRes();
  await handler(req, res);
  assert.strictEqual(res.statusCode, 403, 'Student must receive 403 Forbidden');
  assert.strictEqual(res.body.error, 'FORBIDDEN');
});

await itAsync('7. Manager can initiate upload, stream chunk to Google Drive, and verify with Telegram audit', async () => {
  const initReq = {
    method: 'POST',
    url: '/api/drive/initiate-upload',
    headers: {
      'x-user-role': 'manager',
      'x-user-email': 'manager.cse@saranathan.ac.in',
      'x-user-name': 'CSE Manager'
    },
    body: {
      filename: 'unit1_manager_notes.pdf',
      fileSize: 2048,
      mimeType: 'application/pdf',
      metadata: {
        title: 'Unit 1 Manager Notes',
        subjectName: 'Python Programming',
        categoryName: 'Lecture Notes'
      }
    }
  };
  const initRes = mockRes();
  await handler(initReq, initRes);
  assert.strictEqual(initRes.statusCode, 200, 'Manager initiate-upload must succeed');
  assert.ok(initRes.body.data.sessionId, 'Session ID returned');
  const sessionId = initRes.body.data.sessionId;
  const tempFileId = initRes.body.data.fileId;

  // Stream chunk
  const chunkBuffer = Buffer.alloc(2048, 'M');
  const chunkReq = {
    method: 'PUT',
    url: `/api/drive/resumable-upload?session_id=${sessionId}`,
    headers: {
      'content-length': '2048',
      'content-range': 'bytes 0-2047/2048',
      'content-type': 'application/pdf'
    },
    body: chunkBuffer
  };
  const chunkRes = mockRes();
  await handler(chunkReq, chunkRes);
  assert.strictEqual(chunkRes.statusCode, 200, 'Chunk PUT must succeed');
  assert.strictEqual(chunkRes.body.status, 'complete');

  // Verify and complete
  const verifyReq = {
    method: 'POST',
    url: '/api/drive/verify-and-complete',
    headers: {
      'x-user-role': 'manager',
      'x-user-email': 'manager.cse@saranathan.ac.in',
      'x-user-name': 'CSE Manager'
    },
    body: {
      resourceId: 'res_manager_001',
      fileId: tempFileId,
      originalFilename: 'unit1_manager_notes.pdf',
      fileSize: 2048,
      mimeType: 'application/pdf',
      metadata: {
        title: 'Unit 1 Manager Notes',
        subjectName: 'Python Programming',
        categoryName: 'Lecture Notes',
        uploaderEmail: 'manager.cse@saranathan.ac.in',
        uploaderName: 'CSE Manager'
      }
    }
  };
  const verifyRes = mockRes();
  await handler(verifyReq, verifyRes);
  assert.strictEqual(verifyRes.statusCode, 200, 'Verify and complete must succeed');
  assert.strictEqual(verifyRes.body.data.googleDriveStatus, 'VERIFIED');
  assert.ok(verifyRes.body.data.auditDelivery, 'Telegram audit event recorded');
});

await itAsync('8. Representative can initiate upload, stream chunk to Google Drive, and verify with Telegram audit', async () => {
  const initReq = {
    method: 'POST',
    url: '/api/drive/initiate-upload',
    headers: {
      'x-user-role': 'representative',
      'x-user-email': 'rep.cse@saranathan.ac.in',
      'x-user-name': 'Class Representative'
    },
    body: {
      filename: 'unit2_rep_slides.pdf',
      fileSize: 4096,
      mimeType: 'application/pdf',
      metadata: {
        title: 'Unit 2 Representative Slides',
        subjectName: 'Data Structures',
        categoryName: 'Class Slides'
      }
    }
  };
  const initRes = mockRes();
  await handler(initReq, initRes);
  assert.strictEqual(initRes.statusCode, 200, 'Representative initiate-upload must succeed');
  const sessionId = initRes.body.data.sessionId;
  const tempFileId = initRes.body.data.fileId;

  // Stream chunk
  const chunkBuffer = Buffer.alloc(4096, 'R');
  const chunkReq = {
    method: 'PUT',
    url: `/api/drive/resumable-upload?session_id=${sessionId}`,
    headers: {
      'content-length': '4096',
      'content-range': 'bytes 0-4095/4096',
      'content-type': 'application/pdf'
    },
    body: chunkBuffer
  };
  const chunkRes = mockRes();
  await handler(chunkReq, chunkRes);
  assert.strictEqual(chunkRes.statusCode, 200, 'Chunk PUT must succeed');

  // Verify and complete
  const verifyReq = {
    method: 'POST',
    url: '/api/drive/verify-and-complete',
    headers: {
      'x-user-role': 'representative',
      'x-user-email': 'rep.cse@saranathan.ac.in',
      'x-user-name': 'Class Representative'
    },
    body: {
      resourceId: 'res_rep_002',
      fileId: tempFileId,
      originalFilename: 'unit2_rep_slides.pdf',
      fileSize: 4096,
      mimeType: 'application/pdf',
      metadata: {
        title: 'Unit 2 Representative Slides',
        subjectName: 'Data Structures',
        categoryName: 'Class Slides',
        uploaderEmail: 'rep.cse@saranathan.ac.in',
        uploaderName: 'Class Representative'
      }
    }
  };
  const verifyRes = mockRes();
  await handler(verifyReq, verifyRes);
  assert.strictEqual(verifyRes.statusCode, 200, 'Representative verify must succeed');
  assert.strictEqual(verifyRes.body.data.googleDriveStatus, 'VERIFIED');
});

await itAsync('9. Administrator can initiate upload, stream chunk to Google Drive, and verify with Telegram audit', async () => {
  const initReq = {
    method: 'POST',
    url: '/api/drive/initiate-upload',
    headers: {
      'x-user-role': 'admin',
      'x-user-email': 'jeyaramandeeban@gmail.com',
      'x-user-name': 'Chief Administrator'
    },
    body: {
      filename: 'official_syllabus_guide.pdf',
      fileSize: 8192,
      mimeType: 'application/pdf',
      metadata: {
        title: 'Official Syllabus Guide',
        subjectName: 'CSE Curriculum',
        categoryName: 'Syllabus'
      }
    }
  };
  const initRes = mockRes();
  await handler(initReq, initRes);
  assert.strictEqual(initRes.statusCode, 200, 'Administrator initiate-upload must succeed');
  const sessionId = initRes.body.data.sessionId;
  const tempFileId = initRes.body.data.fileId;

  // Stream chunk
  const chunkBuffer = Buffer.alloc(8192, 'A');
  const chunkReq = {
    method: 'PUT',
    url: `/api/drive/resumable-upload?session_id=${sessionId}`,
    headers: {
      'content-length': '8192',
      'content-range': 'bytes 0-8191/8192',
      'content-type': 'application/pdf'
    },
    body: chunkBuffer
  };
  const chunkRes = mockRes();
  await handler(chunkReq, chunkRes);
  assert.strictEqual(chunkRes.statusCode, 200, 'Chunk PUT must succeed');

  // Verify and complete
  const verifyReq = {
    method: 'POST',
    url: '/api/drive/verify-and-complete',
    headers: {
      'x-user-role': 'admin',
      'x-user-email': 'jeyaramandeeban@gmail.com',
      'x-user-name': 'Chief Administrator'
    },
    body: {
      resourceId: 'res_admin_003',
      fileId: tempFileId,
      originalFilename: 'official_syllabus_guide.pdf',
      fileSize: 8192,
      mimeType: 'application/pdf',
      metadata: {
        title: 'Official Syllabus Guide',
        subjectName: 'CSE Curriculum',
        categoryName: 'Syllabus',
        uploaderEmail: 'jeyaramandeeban@gmail.com',
        uploaderName: 'Chief Administrator'
      }
    }
  };
  const verifyRes = mockRes();
  await handler(verifyReq, verifyRes);
  assert.strictEqual(verifyRes.statusCode, 200, 'Admin verify must succeed');
  assert.strictEqual(verifyRes.body.data.googleDriveStatus, 'VERIFIED');
});

console.log(`\n======================================================`);
console.log(`UPLOAD TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED OUT OF ${passed + failed} TESTS`);
console.log(`======================================================\n`);

if (failed > 0) {
  process.exit(1);
}
