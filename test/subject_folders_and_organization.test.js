// test/subject_folders_and_organization.test.js
// Master Test Suite for 7 Subject-Wise Separation Folders & File Organization
// Verifies:
// 1. Definition and integrity of the 7 Core Subject Separation Folders
// 2. Folder visibility for Managers, Representatives, and Administrators
// 3. Navigation access to Subject Folders across all 3 privileged roles
// 4. File indexing and draft isolation in Subject Folders
// 5. File organization and movement across folders (Manager, Rep, Admin)
// 6. Backend /folders and /resources/move endpoint authorization
// 7. DOM and UI components (folder cards, contents view, move modal triggers)

import assert from 'assert';
import { LearningStore, SYSTEM_SUBJECT_FOLDERS, INITIAL_SUBJECTS } from '../js/learning/learningStore.js';
import { PermissionService, ROLES } from '../js/learning/permissionService.js';
import { serverFolders, SERVER_SUBJECT_FOLDERS, validateResourceMutationAuthority } from '../api/moderationServer.js';
import handler from '../api/handler.js';
import { DashboardViews } from '../js/learning/dashboardViews.js';

let totalTests = 0;
let passedTests = 0;

function runTest(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runAsyncTest(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    Error: ${err.message}`);
  }
}

// Minimal localStorage mock for tests
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, val) {
    this.store[key] = String(val);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

global.localStorage = new LocalStorageMock();
global.sessionStorage = new LocalStorageMock();

console.log('\n=== RUNNING 7 SUBJECT-WISE SEPARATION FOLDERS & FILE ORGANIZATION TEST SUITE ===\n');

// -----------------------------------------------------------------------------
// TEST GROUP 1: The 7 Core Academic Subject Separation Folders Integrity
// -----------------------------------------------------------------------------
console.log('--- TEST GROUP 1: 7 Core Academic Subject Separation Folders Integrity ---');

runTest('1. Exactly 7 Subject Separation Folders are defined and exported', () => {
  assert.strictEqual(Array.isArray(SYSTEM_SUBJECT_FOLDERS), true);
  assert.strictEqual(SYSTEM_SUBJECT_FOLDERS.length, 7);
});

runTest('2. All 7 Core First-Year CSE Class A subjects have dedicated separation folders', () => {
  const expectedSubjectCodes = [
    '24ES102A', // Graphics
    '24PH101A', // Physics
    '24CH101A', // Chemistry
    '24MA101A', // Maths
    '24TA101A', // Tamil
    '24EN101A', // English
    '24ES101A'  // Python
  ];

  const actualCodes = SYSTEM_SUBJECT_FOLDERS.map(f => f.subjectCode);
  expectedSubjectCodes.forEach(code => {
    assert.strictEqual(actualCodes.includes(code), true, `Missing subject folder for code ${code}`);
  });

  SYSTEM_SUBJECT_FOLDERS.forEach(f => {
    assert.strictEqual(f.isSubjectFolder, true);
    assert.strictEqual(f.isShared, true);
    assert.ok(f.icon, 'Subject folder must have an icon');
    assert.ok(f.faculty, 'Subject folder must include faculty information');
    assert.ok(f.description, 'Subject folder must include description');
  });
});

// -----------------------------------------------------------------------------
// TEST GROUP 2: Store Initialization and Multi-Role Folder Retrieval
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 2: Store Initialization and Multi-Role Folder Access ---');

runTest('3. Store initialization ensures all 7 Subject Separation Folders exist in this.folders', () => {
  localStorage.clear();
  const store = new LearningStore();
  
  const folders = store.folders;
  const sysCount = folders.filter(f => f.isSubjectFolder).length;
  assert.strictEqual(sysCount, 7, 'Store must contain all 7 subject folders');
});

runTest('4. Manager can access all 7 Subject Separation Folders via getFolders()', () => {
  const store = new LearningStore();
  const managerFolders = store.getFolders('manager.cse@saranathan.ac.in', ROLES.MANAGER);
  
  const subjectFolders = managerFolders.filter(f => f.isSubjectFolder);
  assert.strictEqual(subjectFolders.length, 7);
  assert.ok(subjectFolders.some(f => f.id === 'fld_sub_python'));
  assert.ok(subjectFolders.some(f => f.id === 'fld_sub_maths'));
});

runTest('5. Representative can access all 7 Subject Separation Folders via getFolders()', () => {
  const store = new LearningStore();
  const repFolders = store.getFolders('rep.classa@saranathan.ac.in', ROLES.REPRESENTATIVE);
  
  const subjectFolders = repFolders.filter(f => f.isSubjectFolder);
  assert.strictEqual(subjectFolders.length, 7);
});

runTest('6. Administrator can access all 7 Subject Separation Folders via getFolders()', () => {
  const store = new LearningStore();
  const adminFolders = store.getFolders('jeyaramandeeban@gmail.com', ROLES.ADMIN);
  
  const subjectFolders = adminFolders.filter(f => f.isSubjectFolder);
  assert.strictEqual(subjectFolders.length, 7);
});

// -----------------------------------------------------------------------------
// TEST GROUP 3: Navigation Menu Configuration for Roles
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 3: Navigation Menu Access for Roles ---');

runTest('7. Manager navigation includes "Subject Folders" (my-folders)', () => {
  const nav = PermissionService.getNavigationForRole(ROLES.MANAGER);
  const foldersItem = nav.roleItems.find(i => i.id === 'my-folders');
  assert.ok(foldersItem, 'Manager navigation must include my-folders');
  assert.strictEqual(foldersItem.label, 'Subject Folders');
});

runTest('8. Representative navigation includes "Subject Folders" (my-folders)', () => {
  const nav = PermissionService.getNavigationForRole(ROLES.REPRESENTATIVE);
  const foldersItem = nav.roleItems.find(i => i.id === 'my-folders');
  assert.ok(foldersItem, 'Representative navigation must include my-folders');
  assert.strictEqual(foldersItem.label, 'Subject Folders');
});

runTest('9. Administrator navigation includes "Subject Folders" (my-folders)', () => {
  const nav = PermissionService.getNavigationForRole(ROLES.ADMIN);
  const foldersItem = nav.roleItems.find(i => i.id === 'my-folders');
  assert.ok(foldersItem, 'Administrator navigation must include my-folders');
  assert.strictEqual(foldersItem.label, 'Subject Folders');
});

// -----------------------------------------------------------------------------
// TEST GROUP 4: Subject Folder Resource Content & Draft Isolation
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 4: Subject Folder Resource Resolution & Draft Isolation ---');

runTest('10. Pre-seeded Python materials automatically index into Problem Solving & Python folder', () => {
  const store = new LearningStore();
  const adminUser = { id: 'usr_admin', email: 'jeyaramandeeban@gmail.com', role: ROLES.ADMIN };
  
  const pythonFiles = store.getResourcesInFolder('fld_sub_python', adminUser);
  assert.ok(pythonFiles.length >= 1, 'Should find at least 1 Python resource');
  assert.ok(pythonFiles.some(r => r.subjectId === 'sub_python'));
});

runTest('11. Private drafts in subject folders respect draft isolation across roles', () => {
  const store = new LearningStore();
  const managerA = { id: 'usr_mgr_a', email: 'managerA@saranathan.ac.in', role: ROLES.MANAGER };
  const managerB = { id: 'usr_mgr_b', email: 'managerB@saranathan.ac.in', role: ROLES.MANAGER };
  const repUser = { id: 'usr_rep', email: 'rep@saranathan.ac.in', role: ROLES.REPRESENTATIVE };
  const studentUser = { id: 'usr_stud', email: 'student@saranathan.ac.in', role: ROLES.STUDENT };

  // Create a draft in Mathematics subject folder by Manager A
  const draftMath = store.saveDraftResource({
    id: 'res_test_draft_math',
    title: 'Differential Calculus Advanced Proofs',
    subjectId: 'sub_maths',
    parentFolderId: 'fld_sub_maths',
    publicationStatus: 'draft',
    ownerId: managerA.id,
    ownerEmail: managerA.email,
    ownerName: 'Manager A'
  }, managerA);

  // 1. Manager A can see their own draft in Mathematics folder
  const filesForMgrA = store.getResourcesInFolder('fld_sub_maths', managerA);
  assert.ok(filesForMgrA.some(r => r.id === draftMath.id), 'Manager A must see their own draft');

  // 2. Manager B CANNOT see Manager A draft
  const filesForMgrB = store.getResourcesInFolder('fld_sub_maths', managerB);
  assert.strictEqual(filesForMgrB.some(r => r.id === draftMath.id), false, 'Manager B must not see other managers drafts');

  // 3. Representative can see drafts in subject folder
  const filesForRep = store.getResourcesInFolder('fld_sub_maths', repUser);
  assert.ok(filesForRep.some(r => r.id === draftMath.id), 'Representative must see drafts for moderation review');

  // 4. Student CANNOT see drafts
  const filesForStudent = store.getResourcesInFolder('fld_sub_maths', studentUser);
  assert.strictEqual(filesForStudent.some(r => r.id === draftMath.id), false, 'Student must not see drafts');
});

// -----------------------------------------------------------------------------
// TEST GROUP 5: File Movement Across Subject Separation Folders
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 5: File Movement and Organization Across Folders ---');

runTest('12. Manager can move their own resource into another subject folder', () => {
  const store = new LearningStore();
  const manager = { id: 'usr_mgr', email: 'manager.cse@saranathan.ac.in', role: ROLES.MANAGER };

  const res = store.saveDraftResource({
    id: 'res_move_test_1',
    title: 'Graphics Isometric Projection Notes',
    subjectId: 'sub_graphics',
    parentFolderId: 'fld_sub_graphics',
    ownerId: manager.id,
    ownerEmail: manager.email
  }, manager);

  assert.strictEqual(res.parentFolderId, 'fld_sub_graphics');

  // Move into Engineering Physics folder
  const moved = store.moveResource(res.id, 'fld_sub_physics', manager);
  assert.strictEqual(moved.parentFolderId, 'fld_sub_physics');
  assert.strictEqual(moved.subjectId, 'sub_physics', 'Moving to subject folder updates subjectId');

  // Verify it appears in Physics folder
  const physicsFiles = store.getResourcesInFolder('fld_sub_physics', manager);
  assert.ok(physicsFiles.some(r => r.id === res.id));
});

runTest('13. Representative can move any resource into a subject folder', () => {
  const store = new LearningStore();
  const rep = { id: 'usr_rep', email: 'rep@saranathan.ac.in', role: ROLES.REPRESENTATIVE };

  // Representative moves a resource owned by CSE Resource Manager
  const res = store.resources[0];
  const originalFolder = res.parentFolderId;
  const targetFolder = 'fld_sub_tamil';

  const moved = store.moveResource(res.id, targetFolder, rep);
  assert.strictEqual(moved.parentFolderId, targetFolder);
  assert.strictEqual(moved.subjectId, 'sub_tamil');
});

runTest('14. Administrator can move any resource into a subject folder', () => {
  const store = new LearningStore();
  const admin = { id: 'usr_admin', email: 'jeyaramandeeban@gmail.com', role: ROLES.ADMIN };

  const res = store.resources[0];
  const targetFolder = 'fld_sub_chemistry';

  const moved = store.moveResource(res.id, targetFolder, admin);
  assert.strictEqual(moved.parentFolderId, targetFolder);
  assert.strictEqual(moved.subjectId, 'sub_chemistry');
});

runTest('15. Unauthorized manager cannot move another users resource', () => {
  const store = new LearningStore();
  const attacker = { id: 'usr_attacker', email: 'attacker.manager@saranathan.ac.in', role: ROLES.MANAGER };
  const targetRes = store.resources.find(r => r.ownerEmail !== attacker.email);

  assert.throws(() => {
    store.moveResource(targetRes.id, 'fld_sub_maths', attacker);
  }, /Permission denied/);
});

// -----------------------------------------------------------------------------
// TEST GROUP 6: Backend Endpoint Tests (/folders & /resources/move)
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 6: Backend /folders & /resources/move Endpoint Tests ---');

runTest('16. Backend serverFolders contains all 7 Subject Separation Folders', () => {
  assert.strictEqual(serverFolders.size >= 7, true);
  assert.ok(serverFolders.has('fld_sub_graphics'));
  assert.ok(serverFolders.has('fld_sub_physics'));
  assert.ok(serverFolders.has('fld_sub_chemistry'));
  assert.ok(serverFolders.has('fld_sub_maths'));
  assert.ok(serverFolders.has('fld_sub_tamil'));
  assert.ok(serverFolders.has('fld_sub_english'));
  assert.ok(serverFolders.has('fld_sub_python'));
});

await runAsyncTest('17. Backend GET /folders returns all 7 Subject Separation Folders for Representative', async () => {
  let statusCode = 0;
  let responseBody = null;

  const req = {
    method: 'GET',
    url: 'http://localhost:3000/api/folders',
    headers: {
      'x-user-role': 'representative',
      'x-user-email': 'rep@saranathan.ac.in'
    }
  };

  const res = {
    setHeader(k, v) {
      return this;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseBody = data;
      return this;
    }
  };

  await handler(req, res);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(responseBody.success, true);
  
  const subjectFolders = responseBody.folders.filter(f => f.isSubjectFolder);
  assert.strictEqual(subjectFolders.length, 7);
});

await runAsyncTest('18. Backend POST /resources/move authorizes Representative and Admin', async () => {
  let statusCode = 0;
  let responseBody = null;

  const req = {
    method: 'POST',
    url: 'http://localhost:3000/api/resources/move',
    headers: {
      'x-user-role': 'representative',
      'x-user-email': 'rep@saranathan.ac.in'
    },
    body: {
      resourceId: 'res_sample_py_p1',
      targetFolderId: 'fld_sub_python',
      ownerEmail: 'manager.cse@saranathan.ac.in'
    }
  };

  const res = {
    setHeader(k, v) {
      return this;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseBody = data;
      return this;
    }
  };

  await handler(req, res);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(responseBody.success, true);
  assert.strictEqual(responseBody.targetFolderId, 'fld_sub_python');
});

// -----------------------------------------------------------------------------
// TEST GROUP 7: UI & DOM Component Verification
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 7: UI & DOM Component Verification ---');

runTest('19. Dashboard shortcut cards include "Subject Folders" for Admin and Representative', () => {
  const store = new LearningStore();
  const mockAppAdmin = {
    auth: { getCurrentUser: () => ({ email: 'jeyaramandeeban@gmail.com', role: ROLES.ADMIN }) },
    currentRole: ROLES.ADMIN,
    store,
    dom: { viewContainer: { innerHTML: '', querySelectorAll: () => [], querySelector: () => null } },
    bindResourceCardActions: () => {}
  };

  DashboardViews.renderDashboardHome(mockAppAdmin);
  const htmlAdmin = mockAppAdmin.dom.viewContainer.innerHTML;
  assert.ok(htmlAdmin.includes('data-dash-jump="my-folders"'), 'Admin dashboard must have shortcut to my-folders');
  assert.ok(htmlAdmin.includes('Subject Folders (7 Subjects)'));

  const mockAppRep = {
    auth: { getCurrentUser: () => ({ email: 'rep@saranathan.ac.in', role: ROLES.REPRESENTATIVE }) },
    currentRole: ROLES.REPRESENTATIVE,
    store,
    dom: { viewContainer: { innerHTML: '', querySelectorAll: () => [], querySelector: () => null } },
    bindResourceCardActions: () => {}
  };

  DashboardViews.renderDashboardHome(mockAppRep);
  const htmlRep = mockAppRep.dom.viewContainer.innerHTML;
  assert.ok(htmlRep.includes('data-dash-jump="my-folders"'), 'Representative dashboard must have shortcut to my-folders');
  assert.ok(htmlRep.includes('Subject Folders (7 Subjects)'));
});

runTest('20. renderMyFoldersView renders all 7 Subject Separation Folders with open-folder buttons', () => {
  const store = new LearningStore();
  const mockApp = {
    auth: { getCurrentUser: () => ({ email: 'manager.cse@saranathan.ac.in', role: ROLES.MANAGER }) },
    currentRole: ROLES.MANAGER,
    store,
    dom: { viewContainer: { innerHTML: '', querySelectorAll: () => [], querySelector: () => null } }
  };

  DashboardViews.renderMyFoldersView(mockApp);
  const html = mockApp.dom.viewContainer.innerHTML;

  // Check all 7 subject folder IDs are present in data-open-folder attributes
  SYSTEM_SUBJECT_FOLDERS.forEach(fld => {
    assert.ok(html.includes(`data-open-folder="${fld.id}"`), `Must include data-open-folder for ${fld.id}`);
    assert.ok(html.includes(fld.name), `Must display folder name ${fld.name}`);
  });
});

runTest('21. renderFolderContentsView renders materials table with "Move" action buttons', () => {
  const store = new LearningStore();
  const mockApp = {
    auth: { getCurrentUser: () => ({ email: 'manager.cse@saranathan.ac.in', id: 'usr_manager_1', role: ROLES.MANAGER }) },
    currentRole: ROLES.MANAGER,
    store,
    dom: { viewContainer: { innerHTML: '', querySelectorAll: () => [], querySelector: () => null } },
    bindResourceCardActions: () => {},
    bindMoveResourceButtons: () => {}
  };

  DashboardViews.renderFolderContentsView(mockApp, 'fld_sub_python');
  const html = mockApp.dom.viewContainer.innerHTML;

  assert.ok(html.includes('Problem Solving and Python Programming'), 'Must show Python folder header');
  assert.ok(html.includes('data-move-res='), 'Must render data-move-res button on materials');
  assert.ok(html.includes('← Back to All Subject Folders'), 'Must provide back button');
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`SUBJECT FOLDERS VERIFICATION SUMMARY: ${passedTests} PASSED, ${totalTests - passedTests} FAILED OUT OF ${totalTests} TESTS`);
console.log('======================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
