// ==============================================================================
// TEST SUITE: STUDENT PROFILES, 6-DIGIT ROLL NUMBER & BAN HIERARCHY (72H RULE)
// ==============================================================================

import assert from 'assert';
import { LearningStore } from '../js/learning/learningStore.js';
import { LearningAuthService } from '../js/learning/learningAuth.js';

// Setup Mock LocalStorage for Node.js test environment
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new MockLocalStorage();

console.log('=== RUNNING PROFILE, BAN HIERARCHY & 72-HOUR RESTRICTION TEST SUITE ===\n');

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

// -----------------------------------------------------------------------------
// GROUP 1: Student Profiles & 6-Digit Roll Number Validation (Decision 2)
// -----------------------------------------------------------------------------
console.log('--- TEST GROUP 1: Student Profile & 6-Digit Roll Number ---');

it('1. Accepts valid 6-digit roll number with leading zero and preserves it as string', () => {
  const store = new LearningStore();
  const profile = store.saveStudentProfile({
    email: 'student.zero@gmail.com',
    firstName: 'Kavitha',
    secondaryName: 'R',
    rollNumber: '012345'
  });

  assert.strictEqual(profile.rollNumber, '012345', 'Leading zero must be strictly preserved');
  assert.strictEqual(typeof profile.rollNumber, 'string', 'Roll number must be stored as text');
  assert.strictEqual(profile.firstName, 'Kavitha');
  assert.strictEqual(profile.displayName, 'Kavitha R');
});

it('2. Rejects roll number with less or more than 6 digits', () => {
  const store = new LearningStore();
  assert.throws(() => {
    store.saveStudentProfile({
      email: 'student.short@gmail.com',
      firstName: 'Ramesh',
      rollNumber: '12345' // 5 digits
    });
  }, /Roll number must be exactly 6 digits/);

  assert.throws(() => {
    store.saveStudentProfile({
      email: 'student.long@gmail.com',
      firstName: 'Ramesh',
      rollNumber: '1234567' // 7 digits
    });
  }, /Roll number must be exactly 6 digits/);
});

it('3. Rejects non-numeric roll number (alphanumeric)', () => {
  const store = new LearningStore();
  assert.throws(() => {
    store.saveStudentProfile({
      email: 'student.alpha@gmail.com',
      firstName: 'Ramesh',
      rollNumber: '26AB01'
    });
  }, /Roll number must be exactly 6 digits/);
});

it('4. Rejects duplicate roll number registered to a different student', () => {
  const store = new LearningStore();
  store.saveStudentProfile({
    email: 'student.first@gmail.com',
    firstName: 'First',
    rollNumber: '260101'
  });

  assert.throws(() => {
    store.saveStudentProfile({
      email: 'student.second@gmail.com',
      firstName: 'Second',
      rollNumber: '260101' // Duplicate!
    });
  }, /already registered to another account/);
});

// -----------------------------------------------------------------------------
// GROUP 2: Decision 1 & Decision 3: Publishing Policy & Draft Visibility
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 2: Publishing Policy & Privacy-Preserving Drafts ---');

it('5. Manager can publish verified resource immediately (Decision 1 - Option A)', () => {
  const store = new LearningStore();
  const manager = { id: 'usr_mgr_1', email: 'mgr1@saranathan.ac.in', role: 'manager' };

  const draft = store.saveDraftResource({
    title: 'Python Lab Exercise 1',
    subjectId: 'sub_python',
    categoryId: 'cat_class_notes',
    googleDriveFileId: 'gdrv_verified_123',
    uploadStatus: 'uploaded'
  }, manager);

  assert.strictEqual(draft.publicationStatus, 'draft');

  const published = store.publishResource(draft.id, manager);
  assert.strictEqual(published.publicationStatus, 'published');
});

it('6. Admin can restrict resource back to Draft and lock republishing (Decision 1)', () => {
  const store = new LearningStore();
  const manager = { id: 'usr_mgr_1', email: 'mgr1@saranathan.ac.in', role: 'manager' };
  const admin = { id: 'usr_admin', email: 'jeyaramandeeban@gmail.com', role: 'admin' };

  const draft = store.saveDraftResource({
    title: 'Chemistry Exam Prep',
    subjectId: 'sub_chemistry',
    categoryId: 'cat_class_notes',
    googleDriveFileId: 'gdrv_verified_456',
    uploadStatus: 'uploaded'
  }, manager);

  store.publishResource(draft.id, manager);

  // Admin restricts the resource
  const restricted = store.adminRestrictResource(draft.id, admin);
  assert.strictEqual(restricted.publicationStatus, 'draft');
  assert.strictEqual(restricted.restrictedByAdmin, true);

  // Manager attempt to republish is DENIED
  assert.throws(() => {
    store.publishResource(draft.id, manager);
  }, /restricted by the Administrator and cannot be republished by a Manager/);

  // Admin lifts restriction and republishes
  store.adminLiftResourceRestriction(draft.id, admin);
  const repub = store.publishResource(draft.id, manager);
  assert.strictEqual(repub.publicationStatus, 'published');
});

it('7. Other managers drafts are invisible to Manager (Decision 3 - Option A)', () => {
  const store = new LearningStore();
  const managerA = { id: 'usr_mgr_A', email: 'mgrA@saranathan.ac.in', role: 'manager' };
  const managerB = { id: 'usr_mgr_B', email: 'mgrB@saranathan.ac.in', role: 'manager' };
  const student = { id: 'usr_std', email: 'student@gmail.com', role: 'student' };

  // Manager A creates draft
  const draftA = store.saveDraftResource({
    title: 'Manager A Secret Draft',
    subjectId: 'sub_python',
    googleDriveFileId: 'gdrv_a_123',
    uploadStatus: 'uploaded'
  }, managerA);

  // Student queries: draftA is NOT visible
  const studentList = store.getResources({}, student);
  assert.strictEqual(studentList.some(r => r.id === draftA.id), false);

  // Manager B queries: draftA is NOT visible
  const managerBList = store.getResources({}, managerB);
  assert.strictEqual(managerBList.some(r => r.id === draftA.id), false);

  // Manager A queries: draftA IS visible
  const managerAList = store.getResources({}, managerA);
  assert.strictEqual(managerAList.some(r => r.id === draftA.id), true);
});

// -----------------------------------------------------------------------------
// GROUP 3: Ban Hierarchy, 72-Hour Rule & Admin Ban Requests (Decisions 4 & 5)
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 3: Ban Hierarchy, 72-Hour Rule & Suspension Scope ---');

it('8. Manager can impose temporary ban (24h) on Student (Decision 4 - Option A)', () => {
  const store = new LearningStore();
  const ban = store.banStudent({
    studentEmail: 'bad.student@gmail.com',
    actorEmail: 'manager@saranathan.ac.in',
    actorRole: 'manager',
    banType: 'temporary',
    reason: 'Repeated spam in comments',
    durationHours: 24
  });

  assert.strictEqual(ban.isActive, true);
  assert.strictEqual(ban.actorRole, 'manager');
  assert.strictEqual(ban.banType, 'temporary');
  assert.ok(ban.expiresAt, 'Temporary ban must have an expiry timestamp');
  assert.ok(store.isStudentBanned('bad.student@gmail.com'));
});

it('9. Manager CANNOT impose permanent ban (Decision 4 - Option A)', () => {
  const store = new LearningStore();
  assert.throws(() => {
    store.banStudent({
      studentEmail: 'naughty.student@gmail.com',
      actorEmail: 'manager@saranathan.ac.in',
      actorRole: 'manager',
      banType: 'permanent',
      reason: 'Plagiarism'
    });
  }, /Managers can only issue temporary bans/);
});

it('10. Admin unban of Manager-banned student triggers 72-hour restriction', () => {
  const store = new LearningStore();
  const studentEmail = 'student.72h@gmail.com';

  // Manager bans student
  store.banStudent({
    studentEmail,
    actorEmail: 'manager1@saranathan.ac.in',
    actorRole: 'manager',
    banType: 'temporary',
    reason: 'Misbehavior'
  });

  assert.ok(store.isStudentBanned(studentEmail));

  // Admin unbans the student
  store.unbanStudent({
    studentEmail,
    actorEmail: 'jeyaramandeeban@gmail.com',
    actorRole: 'admin'
  });

  assert.strictEqual(store.isStudentBanned(studentEmail), false, 'Student is now unbanned');
  assert.strictEqual(store.is72hRestricted(studentEmail), true, '72-hour restriction must be active');
});

it('11. Manager direct ban attempt during 72-hour window is REJECTED', () => {
  const store = new LearningStore();
  const studentEmail = 'student.72h@gmail.com';

  // Manager attempt to re-ban student during active 72h window
  assert.throws(() => {
    store.banStudent({
      studentEmail,
      actorEmail: 'another.manager@saranathan.ac.in',
      actorRole: 'manager',
      banType: 'temporary',
      reason: 'Another complaint'
    });
  }, (err) => {
    return err.code === 'ADMIN_72H_RESTRICTION_ACTIVE' && err.message.includes('72-hour platform restriction is active');
  });
});

it('12. Manager can submit "Request Admin to Ban" during 72-hour restriction', () => {
  const store = new LearningStore();
  const studentEmail = 'student.72h@gmail.com';

  const req = store.submitAdminBanRequest({
    managerEmail: 'manager@saranathan.ac.in',
    studentEmail,
    reason: 'Documented cheating during test'
  });

  assert.strictEqual(req.status, 'pending');
  assert.strictEqual(req.studentEmail, studentEmail);

  // Student is NOT banned just by submitting request
  assert.strictEqual(store.isStudentBanned(studentEmail), false);
});

it('13. Admin can approve Manager Ban Request and enforce ban', () => {
  const store = new LearningStore();
  const studentEmail = 'student.72h@gmail.com';

  const requests = store.getAdminBanRequests();
  const lastReq = requests.find(r => r.studentEmail === studentEmail);

  const decided = store.decideAdminBanRequest({
    requestId: lastReq.id,
    adminEmail: 'jeyaramandeeban@gmail.com',
    decision: 'approved',
    notes: 'Reviewed evidence and confirmed'
  });

  assert.strictEqual(decided.status, 'approved');
  assert.ok(store.isStudentBanned(studentEmail), 'Student is now banned by Admin');
});

it('14. Admin unban of Admin-banned student does NOT trigger 72h restriction', () => {
  const store = new LearningStore();
  const studentEmail = 'admin.banned.student@gmail.com';

  // Admin bans directly
  store.banStudent({
    studentEmail,
    actorEmail: 'jeyaramandeeban@gmail.com',
    actorRole: 'admin',
    banType: 'permanent',
    reason: 'Academic violation'
  });

  // Admin unbans directly
  store.unbanStudent({
    studentEmail,
    actorEmail: 'jeyaramandeeban@gmail.com',
    actorRole: 'admin'
  });

  assert.strictEqual(store.is72hRestricted(studentEmail), false, 'Direct admin unban must not trigger 72h rule');
});

it('15. Manager unban does NOT trigger 72h restriction', () => {
  const store = new LearningStore();
  const studentEmail = 'mgr.unbanned.student@gmail.com';

  store.banStudent({
    studentEmail,
    actorEmail: 'manager@saranathan.ac.in',
    actorRole: 'manager',
    banType: 'temporary',
    reason: 'Temporary hold'
  });

  // Manager unbans
  store.unbanStudent({
    studentEmail,
    actorEmail: 'manager@saranathan.ac.in',
    actorRole: 'manager'
  });

  assert.strictEqual(store.is72hRestricted(studentEmail), false, 'Manager unban must not trigger 72h rule');
});

it('16. Manager suspension revokes Manager role but retains Student access (Decision 5 - Option A)', () => {
  const store = new LearningStore();
  const managerEmail = 'demoted.manager@saranathan.ac.in';

  store.assignManager(managerEmail, 'Former Manager', 'admin');
  assert.strictEqual(store.isAuthorizedManager(managerEmail), true);

  // Admin revokes manager role
  store.revokeManager(managerEmail, 'jeyaramandeeban@gmail.com');
  assert.strictEqual(store.isAuthorizedManager(managerEmail), false, 'Manager privileges revoked');

  // Verify student access is NOT banned
  assert.strictEqual(store.isStudentBanned(managerEmail), false, 'Retains student portal access');
});

it('17. Banned student login attempt is blocked with ACCOUNT_BANNED', async () => {
  const store = new LearningStore();
  const auth = new LearningAuthService(store);
  const bannedEmail = 'blocked.student@gmail.com';

  store.banStudent({
    studentEmail: bannedEmail,
    actorEmail: 'jeyaramandeeban@gmail.com',
    actorRole: 'admin',
    banType: 'temporary',
    reason: 'Disciplinary suspension'
  });

  let blocked = false;
  try {
    await auth.loginWithGoogle('student', { email: bannedEmail, name: 'Blocked Student' });
  } catch (err) {
    if (err.code === 'ACCOUNT_BANNED') {
      blocked = true;
    }
  }

  assert.strictEqual(blocked, true, 'Banned student must be blocked from logging in');
});

console.log('\n======================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED OUT OF ${passed + failed} TESTS`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
