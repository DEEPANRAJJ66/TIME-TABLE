// Automated Unit & Integration Tests for College Learning Resource Platform
// Tests: Auth, Role Permissions, Draft Lifecycle, Ownership, Categories, and Missed Class Search

import { LearningStore, INITIAL_CATEGORIES, INITIAL_SUBJECTS } from '../js/learning/learningStore.js';
import { LearningAuthService } from '../js/learning/learningAuth.js';

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

console.log('=== RUNNING COLLEGE LEARNING RESOURCE PLATFORM TEST SUITE ===\n');

// Mock localStorage for node environment
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

const store = new LearningStore();
const auth = new LearningAuthService(store);

// 1. Categories & Subject Registry Tests
console.log('--- TEST GROUP 1: Dynamic Categories & Initial Subjects ---');
const activeCats = store.getCategories();
assert(activeCats.length >= 9, `Initial dynamic categories count is ${activeCats.length} (>= 9)`);
assert(activeCats.some(c => c.name === 'Regular Class Notes'), 'Contains "Regular Class Notes"');
assert(activeCats.some(c => c.name === 'Question Papers'), 'Contains "Question Papers"');
assert(activeCats.some(c => c.name === 'Recorded Lectures'), 'Contains "Recorded Lectures"');

// Admin adds a dynamic category
const newCat = store.addCategory({ name: 'Model Lab Programs', icon: '💻', description: 'Exam programs' }, 'admin@saranathan.ac.in');
assert(newCat && newCat.id.startsWith('cat_'), 'Admin successfully created dynamic category');
assert(store.getCategories().some(c => c.name === 'Model Lab Programs'), 'New category is immediately available');

// Initial Semester 1 Subjects
const subjects = store.getSubjects();
assert(subjects.length >= 7, `Initial subjects count is ${subjects.length}`);
const subjectCodes = subjects.map(s => s.code);
assert(subjectCodes.includes('24ES101A'), 'Contains Python (24ES101A)');
assert(subjectCodes.includes('24ES102A'), 'Contains Engineering Graphics (24ES102A)');
assert(subjectCodes.includes('24MA101A'), 'Contains Mathematics I (24MA101A)');
assert(subjectCodes.includes('24PH101A'), 'Contains Physics I (24PH101A)');

// 2. Authentication & Access Control Tests
console.log('\n--- TEST GROUP 2: Authentication & Role Verification ---');

// Test: Authorized Manager Login
const isAuthorized = store.isAuthorizedManager('manager.cse@saranathan.ac.in');
assert(isAuthorized === true, 'Authorized manager email is verified');

// Test: Unauthorized Manager Attempt
const isUnauthorized = store.isAuthorizedManager('random.student@gmail.com');
assert(isUnauthorized === false, 'Unauthorized Google account is correctly rejected for Manager role');

// Admin adds new manager
store.assignManager('faculty.maths@saranathan.ac.in', 'Dr. R. Buvaneswari', 'admin@saranathan.ac.in');
assert(store.isAuthorizedManager('faculty.maths@saranathan.ac.in') === true, 'Admin can authorize new manager account');

// 3. Resource Lifecycle: Draft -> Telegram Stored -> Publish
console.log('\n--- TEST GROUP 3: Resource Lifecycle & Ownership Enforcement ---');

const managerUser1 = { id: 'usr_mgr_1', email: 'manager.cse@saranathan.ac.in', role: 'manager', displayName: 'Manager 1' };
const managerUser2 = { id: 'usr_mgr_2', email: 'faculty.maths@saranathan.ac.in', role: 'manager', displayName: 'Manager 2' };

// Step 1: Save Draft
const draft = store.saveDraftResource({
  title: 'Period 1: Engineering Physics Lasers Derivations',
  categoryId: 'cat_class_notes',
  subjectId: 'sub_physics',
  academicDate: '2026-09-17',
  periodNumber: 1,
  resourceType: 'file',
  originalFilename: 'lasers_p1.pdf',
  uploadStatus: 'telegram_success'
}, managerUser1);

assert(draft.publicationStatus === 'draft', 'Newly created resource is saved as private draft');
assert(draft.ownerId === managerUser1.id, 'Resource is linked to creator user ID');

// Step 2: Student Privacy Check
const studentVisibleBefore = store.getPublishedResources().filter(r => r.id === draft.id);
assert(studentVisibleBefore.length === 0, 'Students CANNOT view drafts');

// Step 3: Publish
const publishedRes = store.publishResource(draft.id, managerUser1);
assert(publishedRes.publicationStatus === 'published', 'Resource successfully published by owner');

// Step 4: Student Visibility Check
const studentVisibleAfter = store.getPublishedResources().filter(r => r.id === draft.id);
assert(studentVisibleAfter.length === 1, 'Published resource is now accessible to students');

// Step 5: Ownership Enforcement Check
let illegalEditBlocked = false;
try {
  store.publishResource(draft.id, managerUser2); // Manager 2 tries to alter Manager 1 resource
} catch (e) {
  illegalEditBlocked = true;
}
assert(illegalEditBlocked === true, 'Manager 2 CANNOT modify Manager 1 resource (Backend Ownership Enforced)');

// Step 6: Unpublish
store.unpublishResource(draft.id, managerUser1);
const studentVisibleAfterUnpublish = store.getPublishedResources().filter(r => r.id === draft.id);
assert(studentVisibleAfterUnpublish.length === 0, 'Unpublished resource is immediately removed from Student Portal');

// 4. Regular Classroom Notes Missed-Class Discovery
console.log('\n--- TEST GROUP 4: Missed-Class Date & Period Discovery ---');
// Re-publish note for date 2026-09-17 period 1
store.publishResource(draft.id, managerUser1);

const day1Period1Notes = store.getPublishedResources().filter(
  r => r.categoryId === 'cat_class_notes' && r.academicDate === '2026-09-17' && r.periodNumber === 1
);
assert(day1Period1Notes.length >= 1, `Found ${day1Period1Notes.length} classroom note(s) for 17-Sep-2026 Period 1`);

// 5. Audit Logging Verification
console.log('\n--- TEST GROUP 5: Security Audit Trail ---');
const logs = store.getAuditLogs();
assert(logs.length >= 4, `Audit logs recorded ${logs.length} events`);
assert(logs.some(l => l.action === 'CREATE_CATEGORY'), 'Audit log contains CREATE_CATEGORY');
assert(logs.some(l => l.action === 'ASSIGN_MANAGER'), 'Audit log contains ASSIGN_MANAGER');
assert(logs.some(l => l.action === 'PUBLISH_RESOURCE'), 'Audit log contains PUBLISH_RESOURCE');

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL LEARNING PLATFORM TESTS PASSED SUCCESSFULLY! ✓');
}
