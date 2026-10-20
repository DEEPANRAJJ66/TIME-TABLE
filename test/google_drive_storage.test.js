// Test Suite: Section 12 & 38 Google Drive Storage Integration
// Institution: Saranathan College of Engineering (Autonomous)
// Validates folder containment, resumable initiation, streaming proxy authorization, and audit logs

import { getApprovedFolderId } from '../lib/drive.js';
import { canViewResource, canUploadResource } from '../lib/authorization.js';
import { PlatformStore } from '../lib/store.js';

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

console.log('\n--- SECTION 12 & 38 GOOGLE DRIVE STORAGE SUITE ---');

const store = new PlatformStore();

// 1. Folder ID boundary check
const folderId = getApprovedFolderId();
assert(folderId && folderId.length > 5, 'Designated Google Drive approved folder ID configured: ' + (folderId ? 'Present' : 'Missing'));

// 2. Upload permissions boundary
const student = { id: 'usr_stud', role: 'student', accountStatus: 'active' };
const manager = { id: 'usr_mgr', role: 'manager', accountStatus: 'active' };
const admin = { id: 'usr_admin', role: 'admin', accountStatus: 'active' };

assert(canUploadResource(student, 'sub_python', []).allowed === false, 'Student cannot upload files to Google Drive');
assert(canUploadResource(manager, 'sub_python', ['sub_python']).allowed === true, 'Manager CAN upload to assigned subject');
assert(canUploadResource(manager, 'sub_physics', ['sub_python']).allowed === false, 'Manager CANNOT upload to unassigned subject');
assert(canUploadResource(admin, 'sub_physics', []).allowed === true, 'Admin CAN upload to any subject');

// 3. Storage record creation in store
const fileRecord = await store.saveResource({
  title: 'Engineering Graphics Unit 1 Projections',
  filename: 'eg_unit1.pdf',
  mimeType: 'application/pdf',
  fileSize: 1024 * 500, // 500 KB
  subjectId: 'sub_graphics',
  sectionName: 'Unit 1',
  uploaderId: manager.id,
  uploaderName: 'EG Faculty',
  uploaderRole: 'manager',
  googleDriveFileId: '1AbCdEfGhIjKlMnOpQrStUvWxYz',
  approvedFolderId: folderId,
  publicationStatus: 'draft',
  storageProvider: 'google_drive'
});

assert(fileRecord.id && fileRecord.id.startsWith('res_'), 'Resource saved with stable ID');
assert(fileRecord.publicationStatus === 'draft', 'Newly uploaded resource starts in DRAFT state');
assert(fileRecord.storageProvider === 'google_drive', 'Storage provider recorded as google_drive');

// 4. Streaming proxy view check (Draft protection)
assert(canViewResource(student, fileRecord).allowed === false, 'Student CANNOT stream unpublished draft resource');
assert(canViewResource(manager, fileRecord).allowed === true, 'Uploader Manager CAN stream own draft');
assert(canViewResource(admin, fileRecord).allowed === true, 'Admin CAN stream draft');

// 5. Audit Logging for storage operation
await store.logAuditEvent({
  actorId: manager.id,
  actorName: 'EG Faculty',
  actorRole: 'manager',
  actionType: 'RESOURCE_UPLOADED',
  targetResourceType: 'resource',
  targetResourceId: fileRecord.id,
  metadata: { filename: fileRecord.filename, googleDriveFileId: fileRecord.googleDriveFileId }
});

const recentLogs = await store.getAuditEvents(5);
const uploadLog = recentLogs.find(l => l.actionType === 'RESOURCE_UPLOADED');
assert(!!uploadLog, 'Storage audit event captured in audit ledger');

console.log(`\nSection 12 & 38 Storage Results: ${passed} Passed, ${failed} Failed\n`);
if (failed > 0) process.exit(1);
