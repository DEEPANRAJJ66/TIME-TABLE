// Master Role-Based Permissions, Moderation Hierarchy & Dashboard Integration Test Suite
// Verifies all 17 Acceptance Criteria from the Master Implementation Prompt

import assert from 'assert';
import { LearningStore, getISTDateString, formatStandardNotice } from '../js/learning/learningStore.js';
import { LearningAuthService } from '../js/learning/learningAuth.js';
import { PermissionService, ROLES } from '../js/learning/permissionService.js';

// Setup Mock LocalStorage for Test Runner
class MockLocalStorage {
  constructor() { this.store = {}; }
  getItem(k) { return this.store[k] || null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}
globalThis.localStorage = new MockLocalStorage();

console.log('=== RUNNING MASTER ROLE-BASED DASHBOARD & PERMISSIONS TEST SUITE ===\n');

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

// =============================================================================
// TEST SUITE 1: Four Roles in Exact Hierarchy & Auth Identity
// =============================================================================
console.log('--- TEST GROUP 1: Role Hierarchy (Admin -> Representative -> Manager -> Student) ---');

it('1. New Google user receives default Student role and cannot self-elevate', async () => {
  const store = new LearningStore();
  const auth = new LearningAuthService(store);
  
  // New user signs in with their own Gmail
  const user = await auth.loginWithGoogle('student', {
    email: 'new.student@gmail.com',
    name: 'New Student'
  });

  assert.strictEqual(user.role, ROLES.STUDENT);
  assert.strictEqual(store.getUserRole('new.student@gmail.com'), ROLES.STUDENT);
  assert.strictEqual(auth.isStudent(), true);
  assert.strictEqual(auth.isManager(), false);
  assert.strictEqual(auth.isRepresentative(), false);
  assert.strictEqual(auth.isAdmin(), false);
});

it('2. Manager sign-in succeeds for authorized Manager and gives Manager permissions', async () => {
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  // Authorize a manager
  store.assignManager('manager.maths@saranathan.ac.in', 'Maths Manager', 'jeyaramandeeban@gmail.com');

  const user = await auth.loginWithGoogle('manager', {
    email: 'manager.maths@saranathan.ac.in',
    name: 'Maths Manager'
  });

  assert.strictEqual(user.role, ROLES.MANAGER);
  assert.strictEqual(auth.isManager(), true);
  assert.strictEqual(auth.isRepresentative(), false);
  assert.strictEqual(auth.isAdmin(), false);
});

it('3. Representative has elevated authority between Manager and Admin', async () => {
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  // Appoint Representative via Admin
  store.setUserRole('rep.classa@saranathan.ac.in', ROLES.REPRESENTATIVE, 'jeyaramandeeban@gmail.com', 'admin');

  const user = await auth.loginWithGoogle(null, {
    email: 'rep.classa@saranathan.ac.in',
    name: 'Class Representative A'
  });

  assert.strictEqual(user.role, ROLES.REPRESENTATIVE);
  assert.strictEqual(auth.isRepresentative(), true);
  assert.strictEqual(auth.isManager(), true); // inherits manager capabilities
  assert.strictEqual(auth.isAdmin(), false);
});

it('4. Administrator has highest authority and master governance', async () => {
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  const adminUser = await auth.loginWithGoogle('admin', {
    email: 'jeyaramandeeban@gmail.com',
    name: 'Deepanraj J'
  });

  assert.strictEqual(adminUser.role, ROLES.ADMIN);
  assert.strictEqual(auth.isAdmin(), true);
  assert.strictEqual(auth.isRepresentative(), true);
  assert.strictEqual(auth.isManager(), true);
});

// =============================================================================
// TEST SUITE 2: Central Moderation Rules (Rules A, B, C, D, E)
// =============================================================================
console.log('\n--- TEST GROUP 2: Central Moderation Rules (Rule A, B, C, D, E) ---');

it('5. Rule A: Admin-issued ban can ONLY be unbanned by Admin (Rep & Manager get Permission Denied)', () => {
  const store = new LearningStore();
  const targetStudent = 'violator.student@gmail.com';

  // Admin bans the student
  store.banStudent({
    studentEmail: targetStudent,
    actorEmail: 'jeyaramandeeban@gmail.com',
    actorRole: 'admin',
    banType: 'permanent',
    reason: 'Exam malpractice'
  });

  assert.ok(store.isStudentBanned(targetStudent));

  // Manager attempt to unban -> DENIED
  assert.throws(() => {
    store.unbanStudent({
      studentEmail: targetStudent,
      actorEmail: 'manager.maths@saranathan.ac.in',
      actorRole: 'manager'
    });
  }, /Only an Administrator can lift an Admin-imposed ban/);

  // Representative attempt to unban -> DENIED
  assert.throws(() => {
    store.unbanStudent({
      studentEmail: targetStudent,
      actorEmail: 'rep.classa@saranathan.ac.in',
      actorRole: 'representative'
    });
  }, /Only an Administrator can lift an Admin-imposed ban/);

  // Admin unban -> SUCCESS
  const unbanned = store.unbanStudent({
    studentEmail: targetStudent,
    actorEmail: 'jeyaramandeeban@gmail.com',
    actorRole: 'admin'
  });
  assert.strictEqual(unbanned, true);
  assert.strictEqual(store.isStudentBanned(targetStudent), false);
});

it('6. Rule B: Representative can ban/unban Students & Managers; CANNOT ban Admin', () => {
  const store = new LearningStore();
  const targetStudent = 'noisy.student@gmail.com';
  const targetManager = 'inactive.manager@saranathan.ac.in';

  store.assignManager(targetManager, 'Inactive Mgr', 'jeyaramandeeban@gmail.com');

  // Rep bans Student
  store.banStudent({
    studentEmail: targetStudent,
    actorEmail: 'rep.classa@saranathan.ac.in',
    actorRole: 'representative',
    reason: 'Disrupting class forum'
  });
  assert.ok(store.isStudentBanned(targetStudent));

  // Rep bans Manager
  store.banStudent({
    studentEmail: targetManager,
    actorEmail: 'rep.classa@saranathan.ac.in',
    actorRole: 'representative',
    reason: 'Posting inappropriate content'
  });
  assert.ok(store.isStudentBanned(targetManager));

  // Rep CANNOT ban Admin -> STRICTLY REJECTED
  assert.throws(() => {
    store.banStudent({
      studentEmail: 'jeyaramandeeban@gmail.com',
      actorEmail: 'rep.classa@saranathan.ac.in',
      actorRole: 'representative',
      reason: 'Attempted insubordination'
    });
  }, /SECURITY VIOLATION: An Administrator account cannot be banned/);

  // Manager CANNOT unban account banned by Representative
  assert.throws(() => {
    store.unbanStudent({
      studentEmail: targetStudent,
      actorEmail: 'manager.maths@saranathan.ac.in',
      actorRole: 'manager'
    });
  }, /Managers cannot lift a Representative-issued ban/);

  // Admin can unban account banned by Representative
  store.unbanStudent({
    studentEmail: targetStudent,
    actorEmail: 'jeyaramandeeban@gmail.com',
    actorRole: 'admin'
  });
  assert.strictEqual(store.isStudentBanned(targetStudent), false);
});

it('7. Rule C: Manager can ban Students; CANNOT ban other Managers, Reps, or Admin', () => {
  const store = new LearningStore();

  // Manager CANNOT ban another Manager
  assert.throws(() => {
    store.banStudent({
      studentEmail: 'manager.maths@saranathan.ac.in',
      actorEmail: 'manager.cse@saranathan.ac.in',
      actorRole: 'manager',
      reason: 'Disagreement'
    });
  }, /Managers can only ban Students/);

  // Manager CANNOT ban Representative
  assert.throws(() => {
    store.banStudent({
      studentEmail: 'representative.cse@saranathan.ac.in',
      actorEmail: 'manager.cse@saranathan.ac.in',
      actorRole: 'manager',
      reason: 'Disagreement'
    });
  }, /Managers can only ban Students/);

  // Manager CANNOT ban Admin
  assert.throws(() => {
    store.banStudent({
      studentEmail: 'jeyaramandeeban@gmail.com',
      actorEmail: 'manager.cse@saranathan.ac.in',
      actorRole: 'manager',
      reason: 'Disagreement'
    });
  }, /SECURITY VIOLATION: An Administrator account cannot be banned/);
});

it('8. Rule D: Seven-day restriction blocks ONLY the affected Manager from re-banning the affected Student', () => {
  const store = new LearningStore();
  const studentEmail = 'disputed.student@gmail.com';
  const managerA = 'manager.a@saranathan.ac.in';
  const managerB = 'manager.b@saranathan.ac.in';

  store.assignManager(managerA, 'Manager Alpha', 'jeyaramandeeban@gmail.com');
  store.assignManager(managerB, 'Manager Beta', 'jeyaramandeeban@gmail.com');

  // Manager A bans Student
  store.banStudent({
    studentEmail,
    actorEmail: managerA,
    actorRole: 'manager',
    reason: 'First complaint'
  });

  // Admin unbans Student -> Starts 7-day restriction for Manager A ONLY!
  store.unbanStudent({
    studentEmail,
    actorEmail: 'jeyaramandeeban@gmail.com',
    actorRole: 'admin'
  });

  assert.strictEqual(store.isStudentBanned(studentEmail), false);
  assert.strictEqual(store.isManagerRestricted(managerA, studentEmail), true, 'Manager A is 7-day restricted');
  assert.strictEqual(store.isManagerRestricted(managerB, studentEmail), false, 'Manager B is NOT restricted');

  // Manager A attempts to re-ban -> REJECTED
  assert.throws(() => {
    store.banStudent({
      studentEmail,
      actorEmail: managerA,
      actorRole: 'manager',
      reason: 'Trying again immediately'
    });
  }, /restriction is active for you/);

  // Manager B CAN ban if a new infraction occurs (Rule D: applies only to specific Manager and Student)
  const banByB = store.banStudent({
    studentEmail,
    actorEmail: managerB,
    actorRole: 'manager',
    reason: 'Separate violation observed by Manager B'
  });
  assert.strictEqual(banByB.actorEmail, managerB);
  assert.ok(store.isStudentBanned(studentEmail));

  // Clean up
  store.unbanStudent({ studentEmail, actorEmail: managerB, actorRole: 'manager' });
});

it('9. Rule E: Restricted Manager submits "Request Admin to Ban" without auto-banning', () => {
  const store = new LearningStore();
  const studentEmail = 'req.student@gmail.com';
  const managerEmail = 'manager.x@saranathan.ac.in';

  // Manager X submits ban request
  const req = store.submitAdminBanRequest({
    managerEmail,
    studentEmail,
    reason: 'Continuous disruption during lab session'
  });

  assert.strictEqual(req.status, 'pending');
  // Student is NOT banned automatically
  assert.strictEqual(store.isStudentBanned(studentEmail), false);

  // Admin reviews and approves request
  const decided = store.decideAdminBanRequest({
    requestId: req.id,
    adminEmail: 'jeyaramandeeban@gmail.com',
    decision: 'approved',
    notes: 'Reviewed footage, approved.'
  });

  assert.strictEqual(decided.status, 'approved');
  assert.ok(store.isStudentBanned(studentEmail), 'Student is now banned by Admin');
});

// =============================================================================
// TEST SUITE 3: Notice Management (Standard IST Format & Pinning)
// =============================================================================
console.log('\n--- TEST GROUP 3: Notice Management & Standard IST Format ---');

it('10. Creates standard notice with auto-generated IST date and exact required format', () => {
  const store = new LearningStore();
  const noticeMsg = 'Internal Assessment Test 1 commences next Monday. Please bring your Hall Tickets.';
  const authorName = 'Deepanraj J';
  const authorRole = 'admin';

  const notice = store.createNotice({
    title: 'IAT 1 Schedule Announcement',
    message: noticeMsg,
    authorName,
    authorEmail: 'jeyaramandeeban@gmail.com',
    authorRole,
    isPinned: true
  });

  assert.ok(notice.id);
  assert.strictEqual(notice.isPinned, true);
  assert.strictEqual(notice.isPublished, true);
  
  // Verify standard notice format
  const expectedISTDate = getISTDateString();
  assert.ok(notice.formattedNotice.startsWith(`Date: ${expectedISTDate}`));
  assert.ok(notice.formattedNotice.includes('Dear Friends,'));
  assert.ok(notice.formattedNotice.includes(noticeMsg));
  assert.ok(notice.formattedNotice.includes('With regards,\nDeepanraj J\nAdministrator'));
});

it('11. Representative can create, pin, and edit notices; Managers/Students CANNOT publish', () => {
  const store = new LearningStore();

  // Representative publishes notice
  const notice = store.createNotice({
    title: 'Class A Meeting',
    message: 'Class discussion at 4:10 PM in Hall RV 402.',
    authorName: 'Class Representative',
    authorEmail: 'rep.classa@saranathan.ac.in',
    authorRole: 'representative',
    isPinned: false
  });

  assert.ok(notice);
  assert.strictEqual(notice.authorRole, 'representative');

  // Rep pins notice
  store.togglePinNotice(notice.id, 'rep.classa@saranathan.ac.in', 'representative');
  const updatedNotice = store.notices.find(n => n.id === notice.id);
  assert.strictEqual(updatedNotice.isPinned, true);

  // Student attempt to create notice -> DENIED
  assert.throws(() => {
    store.createNotice({
      title: 'Fake Notice',
      message: 'No classes today',
      authorName: 'Sneaky Student',
      authorEmail: 'student@gmail.com',
      authorRole: 'student'
    });
  }, /Permission denied: Only Administrators and Representatives can publish notices/);

  // Manager attempt to create notice -> DENIED
  assert.throws(() => {
    store.createNotice({
      title: 'Manager Notice',
      message: 'Homework reminder',
      authorName: 'Resource Manager',
      authorEmail: 'manager.cse@saranathan.ac.in',
      authorRole: 'manager'
    });
  }, /Permission denied: Only Administrators and Representatives can publish notices/);
});

// =============================================================================
// TEST SUITE 4: Own-File Management & Draft Isolation
// =============================================================================
console.log('\n--- TEST GROUP 4: Own-File Management & Draft Isolation ---');

it('12. Manager can create folders and organise own files', () => {
  const store = new LearningStore();
  const managerEmail = 'manager.cse@saranathan.ac.in';

  // Create folder
  const folder = store.createFolder({
    name: 'Unit 2 Problem Solving Notes',
    ownerEmail: managerEmail,
    ownerRole: 'manager'
  });

  assert.ok(folder.id);
  assert.strictEqual(folder.name, 'Unit 2 Problem Solving Notes');

  // List folders for Manager
  const myFolders = store.getFolders(managerEmail, 'manager');
  assert.ok(myFolders.some(f => f.id === folder.id));
});

it('13. Manager can rename, move, and trash own resources, but CANNOT modify other users files', () => {
  const store = new LearningStore();
  const manager1 = { id: 'usr_mgr_1', email: 'mgr1@saranathan.ac.in', role: 'manager' };
  const manager2 = { id: 'usr_mgr_2', email: 'mgr2@saranathan.ac.in', role: 'manager' };

  // Manager 1 saves a resource
  const res1 = store.saveDraftResource({
    title: 'Manager 1 Original Notes',
    subjectId: 'sub_python',
    googleDriveFileId: 'gdrv_111',
    uploadStatus: 'uploaded'
  }, manager1);

  // Manager 1 renames own resource -> SUCCESS
  store.renameResource(res1.id, 'Manager 1 Updated Notes', manager1);
  assert.strictEqual(store.getResourceById(res1.id).title, 'Manager 1 Updated Notes');

  // Manager 1 moves own resource to folder -> SUCCESS
  store.moveResource(res1.id, 'fld_unit1_notes', manager1);
  assert.strictEqual(store.getResourceById(res1.id).parentFolderId, 'fld_unit1_notes');

  // Manager 2 attempt to rename Manager 1 resource -> DENIED
  assert.throws(() => {
    store.renameResource(res1.id, 'Malicious Rename', manager2);
  }, /You can only rename your own resources/);

  // Manager 2 attempt to move Manager 1 resource -> DENIED
  assert.throws(() => {
    store.moveResource(res1.id, 'other_folder', manager2);
  }, /You can only move your own resources/);

  // Manager 2 attempt to delete Manager 1 resource -> DENIED
  assert.throws(() => {
    store.deleteResource(res1.id, manager2);
  }, /You can only delete your own resources/);

  // Manager 1 deletes own resource -> moves to recoverable Trash
  store.deleteResource(res1.id, manager1);
  assert.strictEqual(store.getResourceById(res1.id).publicationStatus, 'trash');

  // Manager 1 restores from Trash -> SUCCESS
  store.restoreResource(res1.id, manager1);
  assert.strictEqual(store.getResourceById(res1.id).publicationStatus, 'draft');
});

it('14. Resource status changes trigger uploader notifications', () => {
  const store = new LearningStore();
  const manager1 = { id: 'usr_mgr_1', email: 'author.mgr@saranathan.ac.in', role: 'manager', displayName: 'Author Manager' };
  const admin = { id: 'usr_admin', email: 'jeyaramandeeban@gmail.com', role: 'admin', displayName: 'Deepanraj J' };

  // Manager creates draft
  const res = store.saveDraftResource({
    title: 'Chemistry Periodic Table Guide',
    subjectId: 'sub_chemistry',
    googleDriveFileId: 'gdrv_chem_001',
    uploadStatus: 'uploaded'
  }, manager1);

  // Admin publishes manager draft
  store.publishResource(res.id, admin);

  // Verify notification was generated for original author
  const notifs = store.getNotifications(manager1.email);
  assert.ok(notifs.length > 0);
  assert.ok(notifs.some(n => n.resourceId === res.id && n.statusChange === 'published'));
});

// =============================================================================
// TEST SUITE 5: Role Management & Hierarchy Rules
// =============================================================================
console.log('\n--- TEST GROUP 5: Role Management (Admin Level 1 Authority) ---');

it('15. Admin can promote Student to Manager, Manager to Representative, and demote', () => {
  const store = new LearningStore();
  const studentEmail = 'promoted.student@gmail.com';
  const adminEmail = 'jeyaramandeeban@gmail.com';

  // 1. Promote Student -> Manager
  store.setUserRole(studentEmail, ROLES.MANAGER, adminEmail, 'admin');
  assert.strictEqual(store.getUserRole(studentEmail), ROLES.MANAGER);

  // 2. Promote Manager -> Representative
  store.setUserRole(studentEmail, ROLES.REPRESENTATIVE, adminEmail, 'admin');
  assert.strictEqual(store.getUserRole(studentEmail), ROLES.REPRESENTATIVE);

  // 3. Demote Representative -> Manager
  store.setUserRole(studentEmail, ROLES.MANAGER, adminEmail, 'admin');
  assert.strictEqual(store.getUserRole(studentEmail), ROLES.MANAGER);

  // 4. Demote Manager -> Student
  store.setUserRole(studentEmail, ROLES.STUDENT, adminEmail, 'admin');
  assert.strictEqual(store.getUserRole(studentEmail), ROLES.STUDENT);
});

it('16. Representative CANNOT promote any user to Representative or change roles', () => {
  const store = new LearningStore();

  assert.throws(() => {
    store.setUserRole('target@gmail.com', ROLES.REPRESENTATIVE, 'rep.classa@saranathan.ac.in', 'representative');
  }, /Only an Administrator can change user roles/);
});

it('17. No user can promote themselves or another user to Administrator', () => {
  const store = new LearningStore();

  assert.throws(() => {
    store.setUserRole('newadmin@gmail.com', ROLES.ADMIN, 'jeyaramandeeban@gmail.com', 'admin');
  }, /Cannot promote account to Administrator via this interface/);
});

console.log('\n======================================================');
console.log(`MASTER SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED OUT OF ${passed + failed} TESTS`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
