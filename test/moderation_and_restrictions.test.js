// Test Suite: Section 9 Moderation & 7-Day Restriction Verification
// Institution: Saranathan College of Engineering (Autonomous)
// Validates Ban/Unban authority, Admin-only unban, and the 7-day restriction boundary conditions

import { PlatformStore } from '../lib/store.js';
import { ModerationService } from '../lib/moderation.js';
import { ROLES, canBanUser, canUnbanUser } from '../lib/authorization.js';

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

console.log('\n--- SECTION 9 MODERATION & 7-DAY RESTRICTION SUITE ---');

const store = new PlatformStore();
store.banRestrictions = [];
store.moderationRecords = [];
store.banRequests = [];
const moderation = new ModerationService(store);

// Seed Mock Users
const admin = { id: 'usr_admin', email: 'admin@saranathan.ac.in', role: ROLES.ADMIN, accountStatus: 'active', displayName: 'Admin' };
const rep = { id: 'usr_rep', email: 'rep@saranathan.ac.in', role: ROLES.REPRESENTATIVE, accountStatus: 'active', displayName: 'Rep' };
const manager1 = { id: 'usr_mgr1', email: 'mgr1@saranathan.ac.in', role: ROLES.MANAGER, accountStatus: 'active', displayName: 'Manager 1' };
const manager2 = { id: 'usr_mgr2', email: 'mgr2@saranathan.ac.in', role: ROLES.MANAGER, accountStatus: 'active', displayName: 'Manager 2' };
const studentA = { id: 'usr_stua', email: 'stua@saranathan.ac.in', role: ROLES.STUDENT, accountStatus: 'active', displayName: 'Student A' };

store.users.set(admin.id, admin);
store.users.set(rep.id, rep);
store.users.set(manager1.id, manager1);
store.users.set(manager2.id, manager2);
store.users.set(studentA.id, studentA);

// 1. Manager 1 bans Student A
const banRecord = await moderation.banUser(manager1, studentA.id, 'Disruptive behavior during Python lab');
assert(banRecord.isActive === true, 'Manager 1 successfully issued ban for Student A');
assert(banRecord.actingUserRole === 'manager', 'Acting role recorded as manager');

const updatedStudent = await store.getUserById(studentA.id);
assert(updatedStudent.accountStatus === 'banned', 'Student A account status transitioned to banned');

// 2. Representative attempts to unban Student A -> MUST FAIL (Only Admin can unban)
try {
  await moderation.unbanUser(rep, studentA.id, 'Attempting rep unban');
  assert(false, 'Representative unban was erroneously permitted');
} catch (err) {
  assert(err.message.includes('Administrator'), 'Representative unban correctly rejected (Admin only): ' + err.message);
}

// 3. Manager 1 attempts to unban Student A -> MUST FAIL
try {
  await moderation.unbanUser(manager1, studentA.id, 'Attempting manager unban');
  assert(false, 'Manager unban was erroneously permitted');
} catch (err) {
  assert(err.message.includes('Administrator'), 'Manager unban correctly rejected (Admin only)');
}

// 4. Admin unbans Student A -> MUST SUCCEED and trigger 7-day restriction for Manager 1
const unbanRecord = await moderation.unbanUser(admin, studentA.id, 'Unbanned after academic review and warning');
assert(unbanRecord.isActive === false, 'Student A unbanned by Admin');
assert(unbanRecord.unbanActorId === admin.id, 'Unban actor recorded as Admin');

const unbannedStudent = await store.getUserById(studentA.id);
assert(unbannedStudent.accountStatus === 'active', 'Student A account status restored to active');

// Check 7-day restriction existence
const restrictions = await store.getBanRestrictions();
const restriction = restrictions.find(r => r.managerId === manager1.id && r.studentId === studentA.id);
assert(!!restriction, '7-day restriction successfully recorded between Manager 1 and Student A');
assert(new Date(restriction.restrictionEndUtc) > new Date(), 'Restriction end time is in the future');

// 5. Manager 1 attempts to immediately re-ban Student A -> MUST BE BLOCKED BY 7-DAY RESTRICTION
try {
  await moderation.banUser(manager1, studentA.id, 'Second infraction in lab');
  assert(false, 'Manager 1 was erroneously permitted to re-ban Student A during 7-day restriction');
} catch (err) {
  assert(err.message.includes('7-Day Re-Ban Restriction Active'), 'Re-ban blocked with 7-day restriction error: ' + err.message);
}

// 6. Manager 2 (not restricted) CAN moderate Student A if needed
const mgr2Check = canBanUser(manager2, studentA, restrictions);
assert(mgr2Check.allowed === true, 'Manager 2 without restriction is not blocked by Manager 1 restriction');

// 7. Manager 1 submits a Ban Request to Admin
const banRequest = await moderation.submitBanRequest(manager1, studentA.id, 'Student violated lab rules again; requesting Admin review due to active restriction.');
assert(banRequest.status === 'pending', 'Ban request submitted with status "pending"');
assert(banRequest.id.startsWith('breq_'), 'Ban request ID generated');

// Verify that Ban Request did NOT ban the student
const studentStillActive = await store.getUserById(studentA.id);
assert(studentStillActive.accountStatus === 'active', 'Ban request did not itself ban Student A');

// 8. Admin reviews and resolves the Ban Request
const decidedReq = await moderation.decideBanRequest(admin, banRequest.id, 'approved', 'Admin approved after examining lab logs.');
assert(decidedReq.status === 'approved', 'Ban request marked approved by Admin');

// 9. Boundary Test: Expired 7-day restriction
const pastDate = new Date(Date.now() - 1000).toISOString();
const mockExpiredRestrictions = [
  { managerId: manager1.id, studentId: studentA.id, restrictionEndUtc: pastDate }
];
const expiredCheck = canBanUser(manager1, studentA, mockExpiredRestrictions);
assert(expiredCheck.allowed === true, 'At restriction boundary, expired restriction allows normal authority check');

console.log(`\nSection 9 Moderation Results: ${passed} Passed, ${failed} Failed\n`);
if (failed > 0) process.exit(1);
