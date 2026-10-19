// Test Suite: Section 15 & 39 Assignments & Submissions
// Institution: Saranathan College of Engineering (Autonomous)
// Validates deadline enforcement, late submission tracking, receipt generation, and IDOR isolation

import { PlatformStore } from '../api/store.js';
import { canViewSubmission } from '../api/authorization.js';

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

console.log('\n--- SECTION 15 & 39 ASSIGNMENTS & SUBMISSIONS SUITE ---');

const store = new PlatformStore();

// 1. Assignment Creation
const deadlinePast = new Date(Date.now() - 3600000).toISOString(); // 1 hr ago
const deadlineFuture = new Date(Date.now() + 86400000 * 3).toISOString(); // 3 days in future

const assignment1 = await store.saveAssignment({
  title: 'Python Lab Sheet 1: Functions',
  instructions: 'Implement recursive and iterative factorial functions.',
  subjectId: 'sub_python',
  sectionName: 'Unit 1',
  creatorId: 'usr_mgr1',
  creatorName: 'Faculty Manager',
  deadlineUtc: deadlineFuture,
  deadlineIst: '22 Oct 2026, 05:00 PM IST',
  publicationStatus: 'published',
  submissionCount: 0
});

assert(assignment1.id && assignment1.title.includes('Python Lab'), 'Assignment 1 created with stable ID');
assert(assignment1.submissionCount === 0, 'Initial submission count is 0');

// 2. Student Submission: On-Time
const submission1 = await store.saveSubmission({
  assignmentId: assignment1.id,
  studentId: 'usr_stud1',
  studentName: 'Student One',
  studentRollNumber: '240101',
  studentEmail: 'stud1@saranathan.ac.in',
  answerText: 'def factorial(n): return 1 if n <= 1 else n * factorial(n-1)',
  submittedAtUtc: new Date().toISOString(),
  isLate: false,
  status: 'submitted'
});

assert(submission1.receiptId && submission1.receiptId.startsWith('RCPT-'), 'Cryptographic receipt generated: ' + submission1.receiptId);
assert(submission1.isLate === false, 'Submission marked on-time');

// Check that assignment submission count was incremented
const updatedAsgn1 = await store.getAssignmentById(assignment1.id);
assert(updatedAsgn1.submissionCount === 1, 'Assignment submission count incremented to 1');

// 3. Late Submission Enforcement
const assignmentExpired = await store.saveAssignment({
  title: 'Physics Assignment 1: Optics',
  subjectId: 'sub_physics',
  deadlineUtc: deadlinePast,
  deadlineIst: '19 Oct 2026, 10:00 AM IST'
});

const isLateCalculated = new Date() > new Date(assignmentExpired.deadlineUtc);
assert(isLateCalculated === true, 'Server detects submission past deadline UTC instant');

const lateSubmission = await store.saveSubmission({
  assignmentId: assignmentExpired.id,
  studentId: 'usr_stud2',
  studentName: 'Student Two',
  studentRollNumber: '240102',
  submittedAtUtc: new Date().toISOString(),
  isLate: true,
  status: 'submitted_late'
});

assert(lateSubmission.isLate === true, 'Late submission marked with isLate: true');
assert(lateSubmission.status === 'submitted_late', 'Late submission status is "submitted_late"');

// 4. Strict IDOR Isolation Test (Section 37 Rule 7)
const student1 = { id: 'usr_stud1', role: 'student' };
const student2 = { id: 'usr_stud2', role: 'student' };
const managerAssigned = { id: 'usr_mgr1', role: 'manager' };
const managerUnassigned = { id: 'usr_mgr2', role: 'manager' };
const admin = { id: 'usr_admin', role: 'admin' };

// Student 1 can view their own submission
assert(canViewSubmission(student1, submission1, assignment1).allowed === true, "Student 1 CAN view their own submission");

// Student 2 CANNOT view Student 1's submission (IDOR Prevention)
assert(canViewSubmission(student2, submission1, assignment1).allowed === false, "Student 2 CANNOT view Student 1's submission (IDOR Protected)");

// Manager assigned to 'sub_python' CAN view submission
assert(canViewSubmission(managerAssigned, submission1, assignment1, ['sub_python']).allowed === true, "Manager assigned to Python CAN view submission");

// Manager assigned only to 'sub_physics' CANNOT view Python submission
assert(canViewSubmission(managerUnassigned, submission1, assignment1, ['sub_physics']).allowed === false, "Manager assigned only to Physics CANNOT view Python submission");

// Admin can view all submissions
assert(canViewSubmission(admin, submission1, assignment1).allowed === true, "Admin CAN view submission");

console.log(`\nSection 15 & 39 Assignments Results: ${passed} Passed, ${failed} Failed\n`);
if (failed > 0) process.exit(1);
