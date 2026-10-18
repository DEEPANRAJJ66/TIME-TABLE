// test/google_auth_and_profile_management.test.js
// Master Test Suite for Google Authentication, First-Time Registration,
// In-Dashboard Profile Editing, Admin User Management, and Security Safeguards
//
// Complies with Antigravity Master Implementation Requirements:
// Test A: New ordinary user registration flow
// Test B: Existing student repeated login (no re-registration)
// Test C: In-dashboard profile editing & roll number uniqueness/validation
// Test D: Admin user management directory (real data, search, filter, RBAC)
// Test E: Role preservation across Manager, Representative, Admin
// Test F: Session management, logout, and restoration
// Test G: Account restrictions & ban enforcement
// Test H: Existing feature regression & dashboard views
// Test I: Security & privilege escalation protection

import assert from 'assert';
import { LearningStore } from '../js/learning/learningStore.js';
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
    throw err;
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
    throw err;
  }
}

console.log('\n============================================================');
console.log('🧪 MASTER SUITE: GOOGLE AUTH, PROFILE MANAGEMENT & ADMIN DIRECTORY');
console.log('============================================================\n');

// Mock localStorage for Node test environment
const mockStorage = new Map();
global.localStorage = {
  getItem: (k) => mockStorage.get(k) || null,
  setItem: (k, v) => mockStorage.set(k, String(v)),
  removeItem: (k) => mockStorage.delete(k),
  clear: () => mockStorage.clear()
};

// ============================================================================
// TEST A — New Ordinary User Registration Flow
// ============================================================================
console.log('--- TEST A: New Ordinary User Registration Flow ---');

await runAsyncTest('Test A.1: Google sign-in of new user defaults to Student role with incomplete profile', async () => {
  mockStorage.clear();
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  const newEmail = 'fresh.student@gmail.com';
  const user = await auth.loginWithGoogle(null, {
    email: newEmail,
    name: 'Fresh Student',
    sub: 'sub_fresh_001'
  });

  assert.strictEqual(user.email, newEmail);
  assert.strictEqual(user.role, ROLES.STUDENT);
  assert.strictEqual(auth.isProfileComplete(), false, 'New student without roll number must require profile completion');
});

await runAsyncTest('Test A.2: First-time profile submission rejects non-6-digit roll numbers', async () => {
  mockStorage.clear();
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  await auth.loginWithGoogle(null, {
    email: 'new.student.val@gmail.com',
    name: 'Student Val'
  });

  // Test invalid roll numbers: too short, letters, special characters, too long
  ['12345', '1234567', 'ABCDEF', '12345a', '12 345', ''].forEach(invalidRoll => {
    assert.throws(() => {
      auth.completeProfile({
        firstName: 'Test',
        secondaryName: 'User',
        rollNumber: invalidRoll
      });
    }, /Roll number must be exactly 6 digits/, `Expected rejection for roll number "${invalidRoll}"`);
  });

  assert.strictEqual(auth.isProfileComplete(), false);
});

await runAsyncTest('Test A.3: Valid first-time profile submission stores profile, syncs users, and marks complete', async () => {
  mockStorage.clear();
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  const email = 'kavya.n@gmail.com';
  await auth.loginWithGoogle(null, { email, name: 'Kavya N' });

  const updated = auth.completeProfile({
    firstName: 'Kavya',
    secondaryName: 'Natarajan',
    rollNumber: '260123'
  });

  assert.strictEqual(updated.firstName, 'Kavya');
  assert.strictEqual(updated.secondaryName, 'Natarajan');
  assert.strictEqual(updated.displayName, 'Kavya Natarajan');
  assert.strictEqual(updated.rollNumber, '260123');
  assert.strictEqual(updated.profileComplete, true);
  assert.strictEqual(auth.isProfileComplete(), true);

  // Check storage persistence
  const savedProfile = store.getStudentProfile(email);
  assert.ok(savedProfile, 'Saved student profile must exist in store');
  assert.strictEqual(savedProfile.rollNumber, '260123');

  const registeredUser = store.getUsers().find(u => u.email === email);
  assert.ok(registeredUser, 'User must exist in registeredUsers');
  assert.strictEqual(registeredUser.rollNumber, '260123');
  assert.strictEqual(registeredUser.role, ROLES.STUDENT);
});

// ============================================================================
// TEST B — Existing Student Repeated Login (No Re-Registration)
// ============================================================================
console.log('\n--- TEST B: Existing Student Repeated Login ---');

await runAsyncTest('Test B.1: Existing student logs in repeatedly without being asked to register again', async () => {
  mockStorage.clear();
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  const email = 'existing.student@gmail.com';

  // First session: register
  await auth.loginWithGoogle(null, { email, name: 'Original Name' });
  auth.completeProfile({
    firstName: 'Priya',
    secondaryName: 'Dharshini',
    rollNumber: '260155'
  });

  assert.strictEqual(auth.isProfileComplete(), true);

  // Simulate logout
  auth.logout();
  assert.strictEqual(auth.isAuthenticated(), false);

  // Second session: re-login with Google
  const reloadedUser = await auth.loginWithGoogle(null, { email, name: 'Google Changed Name' });

  // Verification: profile remains complete, roll number preserved, no overwrite with defaults
  assert.strictEqual(reloadedUser.email, email);
  assert.strictEqual(reloadedUser.rollNumber, '260155');
  assert.strictEqual(reloadedUser.firstName, 'Priya');
  assert.strictEqual(reloadedUser.secondaryName, 'Dharshini');
  assert.strictEqual(reloadedUser.displayName, 'Priya Dharshini');
  assert.strictEqual(reloadedUser.profileComplete, true);
  assert.strictEqual(auth.isProfileComplete(), true, 'Existing user must not be marked profile incomplete');
});

// ============================================================================
// TEST C — Profile Editing Inside Dashboard
// ============================================================================
console.log('\n--- TEST C: In-Dashboard Profile Editing & Validation ---');

await runAsyncTest('Test C.1: User can edit own First Name, Secondary Name, and Roll Number', async () => {
  mockStorage.clear();
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  const email = 'arun.kumar@gmail.com';
  await auth.loginWithGoogle(null, { email, name: 'Arun K' });
  auth.completeProfile({ firstName: 'Arun', rollNumber: '260201' });

  // Update profile via updateProfile
  const updated = auth.updateProfile({
    firstName: 'Arunkumar',
    secondaryName: 'M',
    rollNumber: '260202'
  });

  assert.strictEqual(updated.firstName, 'Arunkumar');
  assert.strictEqual(updated.secondaryName, 'M');
  assert.strictEqual(updated.displayName, 'Arunkumar M');
  assert.strictEqual(updated.rollNumber, '260202');

  // Verify persistence in store
  const profile = store.getStudentProfile(email);
  assert.strictEqual(profile.firstName, 'Arunkumar');
  assert.strictEqual(profile.secondaryName, 'M');
  assert.strictEqual(profile.rollNumber, '260202');
});

await runAsyncTest('Test C.2: Profile editing rejects duplicate roll number already owned by another user', async () => {
  mockStorage.clear();
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  // User 1
  await auth.loginWithGoogle(null, { email: 'student1@gmail.com', name: 'Student One' });
  auth.completeProfile({ firstName: 'Student', secondaryName: 'One', rollNumber: '260301' });
  auth.logout();

  // User 2
  await auth.loginWithGoogle(null, { email: 'student2@gmail.com', name: 'Student Two' });
  auth.completeProfile({ firstName: 'Student', secondaryName: 'Two', rollNumber: '260302' });

  // User 2 attempts to take User 1's roll number
  assert.throws(() => {
    auth.updateProfile({
      firstName: 'Student',
      secondaryName: 'Two',
      rollNumber: '260301' // Duplicate!
    });
  }, /already registered to another account/);

  // Ensure roll number was NOT changed
  assert.strictEqual(auth.getCurrentUser().rollNumber, '260302');
});

await runAsyncTest('Test C.3: User cannot update email or role through updateProfile', async () => {
  mockStorage.clear();
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  const email = 'safe.student@gmail.com';
  await auth.loginWithGoogle(null, { email, name: 'Safe Student' });
  auth.completeProfile({ firstName: 'Safe', rollNumber: '260401' });

  // Attempting to pass role or email in updateProfile payload
  auth.updateProfile({
    firstName: 'Safe',
    rollNumber: '260401',
    role: 'admin',
    email: 'hacked@admin.com'
  });

  const currentUser = auth.getCurrentUser();
  assert.strictEqual(currentUser.role, ROLES.STUDENT, 'Role must NOT be changeable via profile update');
  assert.strictEqual(currentUser.email, email, 'Email must NOT be changeable via profile update');
});

// ============================================================================
// TEST D — Administrator Account & Registered User Directory
// ============================================================================
console.log('\n--- TEST D: Admin Account & Registered User Directory ---');

await runAsyncTest('Test D.1: Administrator retains Admin role and is not downgraded to Student', async () => {
  mockStorage.clear();
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  const adminEmail = 'jeyaramandeeban@gmail.com';
  const adminUser = await auth.loginWithGoogle(null, { email: adminEmail, name: 'Deepanraj J' });

  assert.strictEqual(adminUser.role, ROLES.ADMIN);
  assert.strictEqual(auth.isAdmin(), true);

  // Admin completes / updates profile
  auth.completeProfile({ firstName: 'Deepanraj', secondaryName: 'J', rollNumber: '260999' });
  assert.strictEqual(auth.getCurrentUser().role, ROLES.ADMIN, 'Admin must NEVER be downgraded during profile update');
});

runTest('Test D.2: Admin User Management View renders real user records, search, and filters', () => {
  const store = new LearningStore();
  
  // Seed two distinct users in store
  store.saveStudentProfile({
    email: 'arun@gmail.com',
    firstName: 'Arun',
    secondaryName: 'K',
    displayName: 'Arun K',
    rollNumber: '260111',
    authProvider: 'google_oauth'
  });
  store.saveStudentProfile({
    email: 'bavya@gmail.com',
    firstName: 'Bavya',
    secondaryName: 'M',
    displayName: 'Bavya M',
    rollNumber: '260222',
    authProvider: 'google_oauth'
  });

  let capturedHtml = '';
  const mockApp = {
    store,
    auth: {
      getCurrentUser: () => ({ email: 'jeyaramandeeban@gmail.com', role: ROLES.ADMIN })
    },
    currentRole: ROLES.ADMIN,
    dom: {
      viewContainer: {
        set innerHTML(val) { capturedHtml = val; },
        get innerHTML() { return capturedHtml; },
        querySelectorAll: () => [],
        querySelector: () => null
      }
    }
  };

  DashboardViews.renderUserManagementView(mockApp);

  assert.ok(capturedHtml.includes('User & Role Management'), 'Must render directory title');
  assert.ok(capturedHtml.includes('data-role-filter'), 'Must have role filter buttons');
  assert.ok(capturedHtml.includes('data-status-filter'), 'Must have status filter buttons');
  assert.ok(capturedHtml.includes('lrUserSearchInput'), 'Must have multi-field search input');
  assert.ok(capturedHtml.includes('260111'), 'Must display Arun\'s roll number');
  assert.ok(capturedHtml.includes('260222'), 'Must display Bavya\'s roll number');
});

// ============================================================================
// TEST E — Role Preservation Across Manager, Representative, Admin
// ============================================================================
console.log('\n--- TEST E: Role Preservation Across Existing Roles ---');

await runAsyncTest('Test E.1: Manager account retains Manager role on login and profile updates', async () => {
  mockStorage.clear();
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  // Pre-seed manager in registeredUsers
  const managerEmail = 'manager.sec@saranathan.ac.in';
  store.registerUser({
    email: managerEmail,
    role: ROLES.MANAGER,
    name: 'Class Manager',
    status: 'active'
  });

  const loggedUser = await auth.loginWithGoogle(null, {
    email: managerEmail,
    name: 'Class Manager'
  });

  assert.strictEqual(loggedUser.role, ROLES.MANAGER);
  assert.strictEqual(auth.isManager(), true);

  // Profile update preserves Manager role
  auth.updateProfile({ firstName: 'Class', secondaryName: 'Manager', rollNumber: '260002' });
  assert.strictEqual(auth.getCurrentUser().role, ROLES.MANAGER);
});

await runAsyncTest('Test E.2: Representative account retains Representative role on login', async () => {
  mockStorage.clear();
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  const repEmail = 'rep.class@saranathan.ac.in';
  store.registerUser({
    email: repEmail,
    role: ROLES.REPRESENTATIVE,
    name: 'Class Representative',
    status: 'active'
  });

  const loggedUser = await auth.loginWithGoogle(null, {
    email: repEmail,
    name: 'Class Representative'
  });

  assert.strictEqual(loggedUser.role, ROLES.REPRESENTATIVE);
  assert.strictEqual(auth.isRepresentative(), true);
  assert.strictEqual(auth.isManager(), true); // Rep inherits manager permissions
});

// ============================================================================
// TEST F — Session Management, Refresh & Logout
// ============================================================================
console.log('\n--- TEST F: Session Management & Logout ---');

await runAsyncTest('Test F.1: Session persists across auth re-instantiation (simulating page reload)', async () => {
  mockStorage.clear();
  const store1 = new LearningStore();
  const auth1 = new LearningAuthService(store1);

  const email = 'persistent.user@gmail.com';
  await auth1.loginWithGoogle(null, { email, name: 'Persistent User' });
  auth1.completeProfile({ firstName: 'Persistent', rollNumber: '260777' });

  // Simulate page reload by creating new instances reading from same storage
  const store2 = new LearningStore();
  const auth2 = new LearningAuthService(store2);

  assert.strictEqual(auth2.isAuthenticated(), true);
  assert.strictEqual(auth2.getCurrentUser().email, email);
  assert.strictEqual(auth2.getCurrentUser().rollNumber, '260777');
  assert.strictEqual(auth2.isProfileComplete(), true);
});

await runAsyncTest('Test F.2: Logout clears active session without deleting saved database records', async () => {
  mockStorage.clear();
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  const email = 'logout.test@gmail.com';
  await auth.loginWithGoogle(null, { email, name: 'Logout Tester' });
  auth.completeProfile({ firstName: 'Logout', rollNumber: '260888' });

  auth.logout();

  assert.strictEqual(auth.isAuthenticated(), false);
  assert.strictEqual(auth.getCurrentUser(), null);

  // Verify that student profile and registeredUser still exist in store!
  const profile = store.getStudentProfile(email);
  assert.ok(profile, 'Profile must NOT be deleted upon logout');
  assert.strictEqual(profile.rollNumber, '260888');
});

// ============================================================================
// TEST G — Account Restrictions & Ban Enforcement
// ============================================================================
console.log('\n--- TEST G: Account Restrictions & Ban Enforcement ---');

await runAsyncTest('Test G.1: Banned user is blocked from Google login with ACCOUNT_BANNED', async () => {
  mockStorage.clear();
  const store = new LearningStore();
  const auth = new LearningAuthService(store);

  const bannedEmail = 'spammer@gmail.com';
  store.banStudent({
    studentEmail: bannedEmail,
    studentName: 'Spammer User',
    actorEmail: 'jeyaramandeeban@gmail.com',
    actorRole: 'admin',
    banType: 'permanent',
    reason: 'Violated academic integrity rules'
  });

  await assert.rejects(async () => {
    await auth.loginWithGoogle(null, { email: bannedEmail, name: 'Spammer' });
  }, (err) => {
    return err.code === 'ACCOUNT_BANNED' && err.message.includes('account has been restricted');
  });

  assert.strictEqual(auth.isAuthenticated(), false);
});

// ============================================================================
// TEST H — Existing Feature Regression & Dashboard Views
// ============================================================================
console.log('\n--- TEST H: Existing Feature Regression & Dashboard Views ---');

runTest('Test H.1: Navigation includes My Profile across all roles', () => {
  [ROLES.STUDENT, ROLES.MANAGER, ROLES.REPRESENTATIVE, ROLES.ADMIN].forEach(role => {
    const nav = PermissionService.getNavigationForRole(role);
    const profileItem = nav.allItems.find(item => item.id === 'profile');
    assert.ok(profileItem, `Role ${role} must have 'profile' navigation item`);
    assert.strictEqual(profileItem.label, 'My Profile');
  });
});

runTest('Test H.2: Dashboard profile view renders interactive profile editor with read-only email', () => {
  const store = new LearningStore();
  const auth = new LearningAuthService(store);
  
  const user = {
    email: 'kavya.profile@gmail.com',
    firstName: 'Kavya',
    secondaryName: 'N',
    displayName: 'Kavya N',
    rollNumber: '260901',
    role: ROLES.STUDENT
  };

  let capturedHtml = '';
  const mockApp = {
    store,
    auth: {
      getCurrentUser: () => user
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

  DashboardViews.renderProfileView(mockApp);

  assert.ok(capturedHtml.includes('lrEditProfileForm'), 'Must contain lrEditProfileForm');
  assert.ok(capturedHtml.includes('lrEditProfileFirstName'), 'Must contain lrEditProfileFirstName');
  assert.ok(capturedHtml.includes('lrEditProfileSecondaryName'), 'Must contain lrEditProfileSecondaryName');
  assert.ok(capturedHtml.includes('lrEditProfileRollNumber'), 'Must contain lrEditProfileRollNumber');
  assert.ok(capturedHtml.includes('kavya.profile@gmail.com'), 'Must display verified Google email as read-only');
  assert.ok(capturedHtml.includes('btnSaveProfileEdit'), 'Must contain save changes button');
});

// ============================================================================
// TEST I — Security & Server-Side RBAC Enforcement
// ============================================================================
console.log('\n--- TEST I: Security & RBAC Enforcement ---');

runTest('Test I.1: Student cannot access Admin-only navigation items', () => {
  const studentNav = PermissionService.getNavigationForRole(ROLES.STUDENT);
  const userMgmt = studentNav.allItems.find(item => item.id === 'users');
  assert.strictEqual(userMgmt, undefined, 'Student must NOT have access to User Management navigation');

  const banCentre = studentNav.allItems.find(item => item.id === 'moderation');
  assert.strictEqual(banCentre, undefined, 'Student must NOT have access to Ban Centre / Moderation');
});

runTest('Test I.2: Manager cannot access Admin-only audit or user directory', () => {
  const managerNav = PermissionService.getNavigationForRole(ROLES.MANAGER);
  const userMgmt = managerNav.allItems.find(item => item.id === 'users');
  assert.strictEqual(userMgmt, undefined, 'Manager must NOT have access to User Management navigation');

  const auditLog = managerNav.allItems.find(item => item.id === 'audit-log');
  assert.strictEqual(auditLog, undefined, 'Manager must NOT have access to System Audit Logs');
});

console.log('\n============================================================');
console.log(`📊 TEST SUMMARY: ${passedTests}/${totalTests} Passed (0 Failed)`);
console.log('============================================================\n');
