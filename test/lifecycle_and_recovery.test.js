// Phase 3: Resource Lifecycle State Machine & Failure Recovery Tests
import { LearningStore, validateGoogleDriveUrl, VALID_STATE_TRANSITIONS } from '../js/learning/learningStore.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('=== RUNNING PHASE 3 RESOURCE LIFECYCLE & STATE MACHINE TESTS ===\n');

// Mock localStorage
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

const store = new LearningStore();
const mgr = { id: 'usr_mgr_test', email: 'manager.cse@saranathan.ac.in', role: 'manager', displayName: 'Test Manager' };
const admin = { id: 'usr_admin', email: 'admin@saranathan.ac.in', role: 'admin', displayName: 'Administrator' };

// --- 1. Google Drive URL Validation Tests ---
console.log('--- TEST 1: Google Drive URL Validator ---');
const validFile = validateGoogleDriveUrl('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view?usp=sharing');
assert(validFile.isValid === true && validFile.fileId === '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs', 'Valid Google Drive file URL parsed and extracted file ID');
assert(validFile.previewUrl.includes('/preview'), 'Constructed preview embed URL for in-app viewer');

const validFolder = validateGoogleDriveUrl('https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs?usp=drive_link');
assert(validFolder.isValid === true && validFolder.isFolder === true, 'Valid Google Drive folder identified');

const validDoc = validateGoogleDriveUrl('https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/edit');
assert(validDoc.isValid === true && validDoc.fileId === '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs', 'Valid Google Docs document recognized');

const invalidHost = validateGoogleDriveUrl('https://malicious-site.com/file/d/12345');
assert(invalidHost.isValid === false, 'Blocked non-Google Drive external host');

const emptyUrl = validateGoogleDriveUrl('');
assert(emptyUrl.isValid === false, 'Blocked empty URL');

// --- 2. State Machine Transition Rules ---
console.log('\n--- TEST 2: State Machine Transition Enforcement ---');
const draftRes = store.saveDraftResource({
  title: 'Engineering Mathematics Unit 1 Matrices',
  categoryId: 'cat_class_notes',
  subjectId: 'sub_maths',
  academicDate: '2026-09-17',
  periodNumber: 2,
  resourceType: 'file',
  originalFilename: 'matrices.pdf',
  uploadStatus: 'telegram_success'
}, mgr);

assert(draftRes.publicationStatus === 'draft', 'Resource starts in "draft" state');

// Valid transition: draft -> published
const publishedRes = store.transitionResourceState(draftRes.id, 'published', mgr);
assert(publishedRes.publicationStatus === 'published', 'Legal transition: draft -> published');

// Valid transition: published -> unpublished
const unpubRes = store.transitionResourceState(draftRes.id, 'unpublished', mgr);
assert(unpubRes.publicationStatus === 'unpublished', 'Legal transition: published -> unpublished');

// Valid transition: unpublished -> published
const repubRes = store.transitionResourceState(draftRes.id, 'published', mgr);
assert(repubRes.publicationStatus === 'published', 'Legal transition: unpublished -> published');

// Valid transition: published -> archived
const archRes = store.transitionResourceState(draftRes.id, 'archived', mgr);
assert(archRes.publicationStatus === 'archived', 'Legal transition: published -> archived');

// Illegal transition test: upload_failed -> published directly
const failedRes = store.saveDraftResource({
  title: 'Corrupted upload resource',
  categoryId: 'cat_class_notes',
  uploadStatus: 'telegram_failed'
}, mgr);
failedRes.publicationStatus = 'upload_failed';

let illegalTransitionCaught = false;
try {
  store.transitionResourceState(failedRes.id, 'published', mgr);
} catch (e) {
  illegalTransitionCaught = true;
}
assert(illegalTransitionCaught === true, 'Blocked illegal direct transition from "upload_failed" to "published"');

// --- 3. Publishing Prerequisite Validation ---
console.log('\n--- TEST 3: Publishing Prerequisite Validation ---');

// Attempting to publish file without successful Telegram upload
const unsyncedRes = store.saveDraftResource({
  title: 'Unsynced Local Draft',
  categoryId: 'cat_lecture_notes',
  uploadStatus: 'local_pending'
}, mgr);

let unsyncedBlocked = false;
try {
  store.publishResource(unsyncedRes.id, mgr);
} catch (e) {
  unsyncedBlocked = true;
}
assert(unsyncedBlocked === true, 'Prevented publishing resource without Telegram upload confirmation');

// Attempting to publish Drive Link with invalid URL
const badDriveRes = store.saveDraftResource({
  title: 'Invalid Drive Link Resource',
  categoryId: 'cat_reference_books',
  resourceType: 'drive_link',
  googleDriveUrl: 'https://badlink.com/file'
}, mgr);

let badDriveBlocked = false;
try {
  store.publishResource(badDriveRes.id, mgr);
} catch (e) {
  badDriveBlocked = true;
}
assert(badDriveBlocked === true, 'Prevented publishing Drive Link with invalid URL format');

// Publishing valid Drive Link resource
const goodDriveRes = store.saveDraftResource({
  title: 'Valid Google Drive Reference Book',
  categoryId: 'cat_reference_books',
  resourceType: 'drive_link',
  googleDriveUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view'
}, mgr);

const publishedDrive = store.publishResource(goodDriveRes.id, mgr);
assert(publishedDrive.publicationStatus === 'published', 'Successfully published valid Google Drive resource');

// Check student portal visibility for published Google Drive resource
const studentVisible = store.getPublishedResources().some(r => r.id === goodDriveRes.id);
assert(studentVisible === true, 'Published Google Drive resource is visible to students in portal');

// --- 4. Relational Deletion Guard (Category & Subject) ---
console.log('\n--- TEST 4: Category & Subject Deletion Guards ---');

// Create unused category and delete it
const tempCat = store.addCategory({ name: 'Temporary Category', icon: '🗑️' }, admin.email);
const deletedTemp = store.deleteCategory(tempCat.id, admin.email);
assert(deletedTemp && deletedTemp.id === tempCat.id, 'Unreferenced category can be cleanly deleted');

// Attempt to delete category referenced by resources
let catDeleteBlocked = false;
try {
  store.deleteCategory('cat_class_notes', admin.email);
} catch (e) {
  catDeleteBlocked = true;
}
assert(catDeleteBlocked === true, 'Prevented deleting category that is actively referenced by resources');

// Attempt to delete subject referenced by resources
let subDeleteBlocked = false;
try {
  store.deleteSubject('sub_maths', admin.email);
} catch (e) {
  subDeleteBlocked = true;
}
assert(subDeleteBlocked === true, 'Prevented deleting subject that is actively referenced by resources');

console.log(`\n========================================`);
console.log(`PHASE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL PHASE 3 LIFECYCLE & STATE MACHINE TESTS PASSED SUCCESSFULLY! ✓');
}
