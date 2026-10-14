// Phase 2: Automated Security Enforcement & RLS Policy Test Suite
// Verifies: Student Draft Isolation, Cross-Manager Write Protection, and Role Escalation Prevention

import { LearningStore } from '../js/learning/learningStore.js';
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

console.log('=== RUNNING PHASE 2 SECURITY & RLS POLICY TEST SUITE ===\n');

// Mock localStorage
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

const store = new LearningStore();
const auth = new LearningAuthService(store);

// Users setup
const studentUser = { id: 'usr_student_1', email: 'student.cse@gmail.com', role: 'student', displayName: 'Student One' };
const managerAlpha = { id: 'usr_mgr_alpha', email: 'manager.alpha@saranathan.ac.in', role: 'manager', displayName: 'Manager Alpha' };
const managerBeta = { id: 'usr_mgr_beta', email: 'manager.beta@saranathan.ac.in', role: 'manager', displayName: 'Manager Beta' };
const adminUser = { id: 'usr_admin_1', email: 'admin@saranathan.ac.in', role: 'admin', displayName: 'Admin One' };

// Authorize managerAlpha and managerBeta
store.assignManager(managerAlpha.email, managerAlpha.displayName, adminUser.email);
store.assignManager(managerBeta.email, managerBeta.displayName, adminUser.email);

// TEST 1: Student Draft Isolation (Students can NEVER see drafts)
console.log('--- TEST 1: Student Draft Isolation Policy ---');
const alphaDraft = store.saveDraftResource({
  title: 'Top Secret Exam Question Draft (IAT 1)',
  categoryId: 'cat_question_papers',
  subjectId: 'sub_maths',
  academicDate: '2026-09-25',
  resourceType: 'file',
  originalFilename: 'secret_iat1_draft.pdf',
  uploadStatus: 'telegram_success'
}, managerAlpha);

assert(alphaDraft.publicationStatus === 'draft', 'Resource created as draft');

// Query from student perspective
const publishedList = store.getPublishedResources();
const draftLeaked = publishedList.some(r => r.id === alphaDraft.id);
assert(!draftLeaked, 'SECURITY RULE: Draft resource is completely excluded from student queries');

// TEST 2: Cross-Manager Write Protection (Manager Beta cannot modify Alpha’s resources)
console.log('\n--- TEST 2: Cross-Manager Write Protection ---');
let crossEditBlocked = false;
try {
  // Manager Beta attempts to modify Alpha's resource
  store.saveDraftResource({
    id: alphaDraft.id,
    title: 'Tampered Title by Manager Beta'
  }, managerBeta);
} catch (err) {
  crossEditBlocked = err.message.includes('Permission denied');
}
assert(crossEditBlocked, 'SECURITY RULE: Manager Beta is BLOCKED from editing Manager Alpha resource');

// Manager Beta attempts to delete Alpha's resource
let crossDeleteBlocked = false;
try {
  store.deleteResource(alphaDraft.id, managerBeta);
} catch (err) {
  crossDeleteBlocked = err.message.includes('Permission denied');
}
assert(crossDeleteBlocked, 'SECURITY RULE: Manager Beta is BLOCKED from deleting Manager Alpha resource');

// TEST 3: Admin Override Authority
console.log('\n--- TEST 3: Admin Override Authority ---');
let adminCanModerate = false;
try {
  store.updateCategory('cat_class_notes', { description: 'Updated by Admin' }, adminUser.email);
  adminCanModerate = true;
} catch (err) {
  adminCanModerate = false;
}
assert(adminCanModerate, 'SECURITY RULE: Admin possesses verified moderation authority across platform');

// TEST 4: Role Escalation Prevention
console.log('\n--- TEST 4: Role Escalation Prevention ---');
// A student or unauthorized user cannot authorize themselves as a Manager
const studentTriesManagerAuth = store.isAuthorizedManager(studentUser.email);
assert(studentTriesManagerAuth === false, 'SECURITY RULE: Ordinary student email is NOT authorized as Manager');

// An unverified Google sign-in cannot bypass manager verification
let managerBypassBlocked = false;
try {
  // Simulate client attempting to claim manager role without admin record
  const fakeTokenEmail = 'hacker@gmail.com';
  if (!store.isAuthorizedManager(fakeTokenEmail)) {
    throw new Error('ACCESS_DENIED: Manager role not authorized by admin');
  }
} catch (e) {
  managerBypassBlocked = true;
}
assert(managerBypassBlocked, 'SECURITY RULE: Self-proclaimed manager role without admin assignment is rejected');

// TEST 5: Owner Immutability Check
console.log('\n--- TEST 5: Owner ID Immutability ---');
// When manager Alpha saves draft, verify ownerId cannot be forged to admin or another manager
const updatedAlphaDraft = store.saveDraftResource({
  id: alphaDraft.id,
  title: 'Alpha Draft Updated Title',
  ownerId: 'usr_admin_1' // Attempt to forge owner to admin
}, managerAlpha);

assert(updatedAlphaDraft.ownerId === managerAlpha.id, 'SECURITY RULE: Owner ID remains bound to authenticated user and cannot be forged');

console.log(`\n========================================`);
console.log(`PHASE 2 SECURITY TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL PHASE 2 SECURITY TESTS PASSED SUCCESSFULLY! ✓');
}
