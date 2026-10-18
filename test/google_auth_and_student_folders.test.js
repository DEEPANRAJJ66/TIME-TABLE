// test/google_auth_and_student_folders.test.js
// Master Test Suite for Google-Only Authentication Experience and Student Read-Only Subject Folders
// Verifies:
// 1. Google-Only Authentication architecture
// 2. Predefined Administrator: jeyaramandeeban@gmail.com receives 'admin' role automatically
// 3. Regular Google/Gmail sign-ins default to 'student' role (Level 4)
// 4. Student Profile Completion (First Name + 6-Digit Roll Number)
// 5. Account ban enforcement during Google authentication
// 6. Student Subject Folders navigation visibility (my-folders in commonItems)
// 7. Student Subject Folders read-only access (no move, no custom folder creation, no draft leakage)
// 8. Privileged organization capabilities (Manager, Rep, Admin can move files across subject folders)
// 9. Unauthenticated view renders Google-Only landing page with Continue with Google CTA

import assert from 'assert';
import { LearningStore, SYSTEM_SUBJECT_FOLDERS } from '../js/learning/learningStore.js';
import { LearningAuthService } from '../js/learning/learningAuth.js';
import { PermissionService, ROLES } from '../js/learning/permissionService.js';
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

console.log('\n============================================================');
console.log('🧪 RUNNING GOOGLE AUTH & STUDENT SUBJECT FOLDERS TEST SUITE');
console.log('============================================================\n');

// Mock localStorage for Node test environment
const mockStorage = new Map();
global.localStorage = {
  getItem: (k) => mockStorage.get(k) || null,
  setItem: (k, v) => mockStorage.set(k, String(v)),
  removeItem: (k) => mockStorage.delete(k),
  clear: () => mockStorage.clear()
};

// -------------------------------------------------------------
// PART 1: GOOGLE-ONLY AUTHENTICATION & PREDEFINED ADMIN
// -------------------------------------------------------------
console.log('--- PART 1: Google-Only Authentication & Predefined Admin ---');

await runAsyncTest('Predefined Administrator Google Account receives Level 1 "admin" role automatically', async () => {
  mockStorage.clear();
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  const adminEmail = 'jeyaramandeeban@gmail.com';
  const user = await auth.loginWithGoogle(null, {
    email: adminEmail,
    name: 'Deepanraj J',
    sub: 'google_sub_admin_123'
  });

  assert.strictEqual(user.email, adminEmail);
  assert.strictEqual(user.role, ROLES.ADMIN);
  assert.strictEqual(user.authMethod, 'google_oauth');
  assert.strictEqual(auth.isAdmin(), true);
  assert.strictEqual(auth.isRepresentative(), true);
  assert.strictEqual(auth.isManager(), true);
  assert.strictEqual(auth.isStudent(), true);
});

await runAsyncTest('Non-admin Google Account defaults to Level 4 "student" role', async () => {
  mockStorage.clear();
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  const studentEmail = 'student.ravi@gmail.com';
  const user = await auth.loginWithGoogle(null, {
    email: studentEmail,
    name: 'Ravi Kumar',
    sub: 'google_sub_student_456'
  });

  assert.strictEqual(user.email, studentEmail);
  assert.strictEqual(user.role, ROLES.STUDENT);
  assert.strictEqual(user.authMethod, 'google_oauth');
  assert.strictEqual(auth.isAdmin(), false);
  assert.strictEqual(auth.isRepresentative(), false);
  assert.strictEqual(auth.isManager(), false);
  assert.strictEqual(auth.isStudent(), true);
});

await runAsyncTest('Google Sign-in enforces bans and blocks restricted users', async () => {
  mockStorage.clear();
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  const bannedEmail = 'bad.actor@gmail.com';
  store.banStudent({
    studentEmail: bannedEmail,
    studentName: 'Bad Actor',
    actorEmail: 'jeyaramandeeban@gmail.com',
    actorRole: 'admin',
    banType: 'temporary',
    reason: 'Repeated unauthorized file spamming',
    durationDays: 7
  });

  await assert.rejects(async () => {
    await auth.loginWithGoogle(null, {
      email: bannedEmail,
      name: 'Bad Actor'
    });
  }, (err) => {
    return err.code === 'ACCOUNT_BANNED';
  });
});

await runAsyncTest('Student Profile completion validates 6-digit roll number requirement', async () => {
  mockStorage.clear();
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  const studentEmail = 'ananya.s@gmail.com';
  await auth.loginWithGoogle(null, {
    email: studentEmail,
    name: 'Ananya S'
  });

  // Profile incomplete initially
  assert.strictEqual(auth.isProfileComplete(), false);

  // Complete profile with valid 6-digit roll number
  auth.completeProfile({
    firstName: 'Ananya',
    secondaryName: 'Sundaram',
    rollNumber: '260114'
  });

  assert.strictEqual(auth.isProfileComplete(), true);
  const updatedUser = auth.getCurrentUser();
  assert.strictEqual(updatedUser.rollNumber, '260114');
  assert.strictEqual(updatedUser.displayName, 'Ananya Sundaram');
  assert.strictEqual(updatedUser.profileComplete, true);
});

// -------------------------------------------------------------
// PART 2: STUDENT SUBJECT FOLDERS & NAVIGATION ACCESS
// -------------------------------------------------------------
console.log('\n--- PART 2: Student Subject Folders & Navigation Access ---');

runTest('Subject Folders (my-folders) is in commonItems navigation for Students', () => {
  const studentNav = PermissionService.getNavigationForRole(ROLES.STUDENT);
  const folderNav = studentNav.commonItems.find(i => i.id === 'my-folders');
  assert.ok(folderNav, 'Student navigation must include Subject Folders (my-folders)');
  assert.strictEqual(folderNav.label, 'Subject Folders');
});

runTest('Subject Folders (my-folders) is in navigation across all roles', () => {
  [ROLES.STUDENT, ROLES.MANAGER, ROLES.REPRESENTATIVE, ROLES.ADMIN].forEach(role => {
    const nav = PermissionService.getNavigationForRole(role);
    const folderNav = nav.allItems.find(i => i.id === 'my-folders');
    assert.ok(folderNav, `Role ${role} must have Subject Folders in allItems`);
  });
});

runTest('Student Dashboard renders 7 Core Academic Subject Folders section', () => {
  const store = new LearningStore();

  let capturedHtml = '';
  const mockApp = {
    store,
    auth: {
      getCurrentUser: () => ({ email: 'student@saranathan.ac.in', role: ROLES.STUDENT })
    },
    currentRole: ROLES.STUDENT,
    dom: {
      viewContainer: {
        set innerHTML(val) { capturedHtml = val; },
        get innerHTML() { return capturedHtml; },
        querySelectorAll: () => [],
        querySelector: () => null
      }
    }
  };

  DashboardViews.renderDashboardHome(mockApp);

  assert.ok(capturedHtml.includes('Academic Subject Folders'), 'Dashboard must render Subject Folders heading');
  assert.ok(capturedHtml.includes('24ES101A'), 'Dashboard must render Python code');
  assert.ok(capturedHtml.includes('24ES102A'), 'Dashboard must render Graphics code');
  assert.ok(capturedHtml.includes('24PH101A'), 'Dashboard must render Physics code');
  assert.ok(capturedHtml.includes('24CH101A'), 'Dashboard must render Chemistry code');
  assert.ok(capturedHtml.includes('24MA101A'), 'Dashboard must render Maths code');
  assert.ok(capturedHtml.includes('24TA101A'), 'Dashboard must render Tamil code');
  assert.ok(capturedHtml.includes('24EN101A'), 'Dashboard must render English code');
});

runTest('renderMyFoldersView for Student is strictly read-only', () => {
  const store = new LearningStore();
  let capturedHtml = '';
  const mockApp = {
    store,
    auth: {
      getCurrentUser: () => ({ email: 'student@saranathan.ac.in', role: ROLES.STUDENT })
    },
    currentRole: ROLES.STUDENT,
    dom: {
      viewContainer: {
        set innerHTML(val) { capturedHtml = val; },
        get innerHTML() { return capturedHtml; },
        querySelectorAll: () => []
      }
    }
  };

  DashboardViews.renderMyFoldersView(mockApp);

  assert.ok(capturedHtml.includes('Verified Class Repository'), 'Student must see verified repository badge');
  assert.strictEqual(capturedHtml.includes('id="btnOpenCreateFolder"'), false, 'Student view must NOT render Create Custom Folder button');
  assert.strictEqual(capturedHtml.includes('Upload New File'), false, 'Student view must NOT render Upload New File button');
});

runTest('renderFolderContentsView disables "Move" button for Students', () => {
  const store = new LearningStore();
  const folder = SYSTEM_SUBJECT_FOLDERS[0]; // Graphics folder
  let capturedHtml = '';
  const mockApp = {
    store,
    auth: {
      getCurrentUser: () => ({ id: 'usr_std_1', email: 'student@saranathan.ac.in', role: ROLES.STUDENT })
    },
    currentRole: ROLES.STUDENT,
    dom: {
      viewContainer: {
        set innerHTML(val) { capturedHtml = val; },
        get innerHTML() { return capturedHtml; },
        querySelectorAll: () => []
      }
    }
  };

  DashboardViews.renderFolderContentsView(mockApp, folder.id);

  assert.ok(capturedHtml.includes('👁️ Preview'), 'Student must see Preview button');
  assert.strictEqual(capturedHtml.includes('📂 Move'), false, 'Student must NOT see Move action button');
  assert.strictEqual(capturedHtml.includes('id="btnUploadToThisFolder"'), false, 'Student must NOT see Upload Material button');
});

runTest('renderFolderContentsView enables "Move" and "Upload" buttons for Manager, Rep, and Admin', () => {
  const store = new LearningStore();
  const folder = SYSTEM_SUBJECT_FOLDERS[0];

  [ROLES.MANAGER, ROLES.REPRESENTATIVE, ROLES.ADMIN].forEach(role => {
    let capturedHtml = '';
    const mockApp = {
      store,
      auth: {
        getCurrentUser: () => ({ id: 'usr_auth_1', email: `test.${role}@saranathan.ac.in`, role })
      },
      currentRole: role,
      dom: {
        viewContainer: {
          set innerHTML(val) { capturedHtml = val; },
          get innerHTML() { return capturedHtml; },
          querySelectorAll: () => []
        }
      }
    };

    DashboardViews.renderFolderContentsView(mockApp, folder.id);

    assert.ok(capturedHtml.includes('id="btnUploadToThisFolder"'), `Role ${role} must see Upload Material button`);
    assert.ok(capturedHtml.includes('📂 Move'), `Role ${role} must see Move action for materials`);
  });
});

runTest('getResourcesInFolder shields Students from unpublished draft resources', () => {
  const store = new LearningStore();
  const folderId = 'fld_sub_python';
  const managerA = { id: 'usr_mgr_py', email: 'manager.python@saranathan.ac.in', role: ROLES.MANAGER };

  // Add draft resource into python folder
  const draftRes = store.saveDraftResource({
    id: 'res_test_draft_python',
    title: 'Secret Draft Exam Guide',
    categoryId: 'cat_py_notes',
    parentFolderId: folderId,
    publicationStatus: 'draft',
    ownerEmail: managerA.email,
    ownerRole: 'manager'
  }, managerA);

  const studentUser = { id: 'usr_student_1', email: 'student@saranathan.ac.in', role: ROLES.STUDENT };
  const studentFolderFiles = store.getResourcesInFolder(folderId, studentUser);

  const foundDraft = studentFolderFiles.find(r => r.id === draftRes.id);
  assert.strictEqual(foundDraft, undefined, 'Student must NOT see draft resources in folder');
});

// -------------------------------------------------------------
// PART 3: GOOGLE AUTH LANDING PAGE PRESENTATION
// -------------------------------------------------------------
console.log('\n--- PART 3: Google Auth Landing Page Presentation ---');

runTest('renderGoogleAuthView renders modern Google-Only SaaS landing experience', () => {
  let capturedHtml = '';
  const mockApp = {
    dom: {
      viewContainer: {
        set innerHTML(val) { capturedHtml = val; },
        get innerHTML() { return capturedHtml; }
      }
    }
  };

  DashboardViews.renderGoogleAuthView(mockApp);

  assert.ok(capturedHtml.includes('lr-auth-container'), 'Must render lr-auth-container');
  assert.ok(capturedHtml.includes('SARANATHAN COLLEGE OF ENGINEERING'), 'Must display college name');
  assert.ok(capturedHtml.includes('btnGoogleSignIn'), 'Must render Continue with Google button');
  assert.ok(capturedHtml.includes('Continue with Google'), 'Must have "Continue with Google" label');
  assert.ok(capturedHtml.includes('Secure sign-in powered by Google'), 'Must render security assurance note');
  assert.ok(capturedHtml.includes('Live Timetable'), 'Must include link to Live Timetable');
});

// PART 4: New Student Visibility in Dashboards
console.log('\n--- PART 4: New Student Google Login Visibility in Dashboards ---');

runTest('New student logging in with Google is registered and visible in store.getUsers()', async () => {
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  const initialCount = store.getUsers().filter(u => u.role === ROLES.STUDENT).length;

  // New student logs in with another Gmail
  await auth.loginWithGoogle(null, {
    email: 'kavitha.cse@gmail.com',
    name: 'Kavitha S'
  });

  const updatedUsers = store.getUsers();
  const student = updatedUsers.find(u => u.email === 'kavitha.cse@gmail.com');
  assert.ok(student, 'New student must be present in store.getUsers()');
  assert.strictEqual(student.role, 'student', 'Role must be student');
  assert.strictEqual(student.displayName, 'Kavitha S', 'DisplayName must be preserved');
  assert.strictEqual(store.getUsers().filter(u => u.role === ROLES.STUDENT).length, initialCount + 1, 'Student count must increment');
});

runTest('Admin User Management view displays newly logged in Google student', async () => {
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  await auth.loginWithGoogle(null, {
    email: 'rohit.classa@gmail.com',
    name: 'Rohit Kumar'
  });

  let capturedHtml = '';
  const adminApp = {
    currentRole: ROLES.ADMIN,
    store,
    auth: {
      getCurrentUser: () => ({ email: 'jeyaramandeeban@gmail.com', role: ROLES.ADMIN }),
      isAdmin: () => true
    },
    dom: {
      viewContainer: {
        set innerHTML(val) { capturedHtml = val; },
        get innerHTML() { return capturedHtml; },
        querySelectorAll: () => []
      }
    }
  };

  DashboardViews.renderUserManagementView(adminApp);
  assert.ok(capturedHtml.includes('rohit.classa@gmail.com'), 'Admin User Management must display new student email');
  assert.ok(capturedHtml.includes('Rohit Kumar'), 'Admin User Management must display new student name');
  assert.ok(capturedHtml.includes('Promote to Manager'), 'Admin must have promotion options for new student');
});

runTest('Representative and Manager Ban Centre / Moderation displays Enrolled Students Directory', async () => {
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  await auth.loginWithGoogle(null, {
    email: 'priya.test@gmail.com',
    name: 'Priya M'
  });

  // Test Manager View
  let capturedManagerHtml = '';
  const managerApp = {
    currentRole: ROLES.MANAGER,
    store,
    auth: {
      getCurrentUser: () => ({ email: 'manager.cse@saranathan.ac.in', role: ROLES.MANAGER }),
      isManager: () => true
    },
    dom: {
      viewContainer: {
        set innerHTML(val) { capturedManagerHtml = val; },
        get innerHTML() { return capturedManagerHtml; },
        querySelectorAll: () => []
      }
    }
  };

  DashboardViews.renderBanCentreView(managerApp);
  assert.ok(capturedManagerHtml.includes('Enrolled Students Directory'), 'Manager view must include Enrolled Students Directory');
  assert.ok(capturedManagerHtml.includes('priya.test@gmail.com'), 'Manager must see enrolled student email');
  assert.ok(capturedManagerHtml.includes('Temporary Ban (24h)'), 'Manager must have temporary ban option for student');

  // Test Representative View
  let capturedRepHtml = '';
  const repApp = {
    currentRole: ROLES.REPRESENTATIVE,
    store,
    auth: {
      getCurrentUser: () => ({ email: 'rep.classa@saranathan.ac.in', role: ROLES.REPRESENTATIVE }),
      isRepresentative: () => true
    },
    dom: {
      viewContainer: {
        set innerHTML(val) { capturedRepHtml = val; },
        get innerHTML() { return capturedRepHtml; },
        querySelectorAll: () => []
      }
    }
  };

  DashboardViews.renderBanCentreView(repApp);
  assert.ok(capturedRepHtml.includes('Enrolled Students Directory'), 'Representative view must include Enrolled Students Directory');
  assert.ok(capturedRepHtml.includes('priya.test@gmail.com'), 'Representative must see enrolled student email');
});

console.log('\n============================================================');
console.log(`📊 TEST SUMMARY: ${passedTests}/${totalTests} Passed (${totalTests - passedTests} Failed)`);
console.log('============================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
