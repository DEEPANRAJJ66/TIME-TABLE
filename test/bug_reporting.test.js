// Comprehensive Test Suite for In-App Bug Reporting & Telegram Admin Notifications
// Saranathan College of Engineering (Autonomous) - First-Year CSE Class A

import assert from 'assert';
import { PermissionService, ROLES } from '../js/learning/permissionService.js';
import {
  submitServerBugReport,
  getServerBugReports,
  updateServerBugStatus
} from '../api/moderationServer.js';
import {
  getBugChannelId,
  buildBugReportMessage
} from '../api/telegram.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('\n============================================================');
console.log('🐞 RUNNING IN-APP BUG REPORTING & TELEGRAM SUITE');
console.log('============================================================\n');

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

async function runAllTests() {
  // -----------------------------------------------------------------------------
  // 1. TELEGRAM BOT CONFIGURATION & TARGET CHANNEL RESOLUTION
  // -----------------------------------------------------------------------------
  console.log('--- PART 1: Telegram Bot Configuration & Channel Resolution ---');

  it('1. Target channel ID resolves to configured admin channel (-1004484073817)', () => {
    const channelId = getBugChannelId();
    assert.strictEqual(channelId, '-1004484073817', 'Bug channel must be -1004484073817 (Bug report SCE)');
  });

  it('2. Notification message formats properly with IST timestamp, report ID, role, category, severity', () => {
    const mockReport = {
      id: 'BUG-2026-TEST01',
      title: 'Google login not working',
      reporterName: 'Deepanraj J',
      reporterEmail: 'student@saranathan.ac.in',
      reporterRole: 'student',
      rollNumber: '260101',
      category: 'Login/Authentication',
      severity: 'High',
      affectedPage: 'Login View',
      description: 'When tapping Continue with Google, OAuth redirect times out.',
      istTimestamp: '17/10/2026, 6:00:00 pm IST',
      appVersion: '2.5.0-production'
    };

    const msg = buildBugReportMessage(mockReport);
    assert(msg.includes('BUG-2026-TEST01'), 'Must include Report ID');
    assert(msg.includes('Google login not working'), 'Must include Title');
    assert(msg.includes('Deepanraj J'), 'Must include Reporter Name');
    assert(msg.includes('student'), 'Must include Reporter Role');
    assert(msg.includes('260101'), 'Must include Roll Number');
    assert(msg.includes('Login/Authentication'), 'Must include Category');
    assert(msg.includes('High'), 'Must include Severity');
    assert(msg.includes('Login View'), 'Must include Affected Page');
    assert(msg.includes('#BugReport'), 'Must include hashtag #BugReport');
    assert(msg.includes('#CollegeApp'), 'Must include hashtag #CollegeApp');
  });

  // -----------------------------------------------------------------------------
  // 2. SERVER-SIDE BUG REPORT SUBMISSION & VALIDATION
  // -----------------------------------------------------------------------------
  console.log('\n--- PART 2: Server-Side Bug Submission & Data Integrity ---');

  await itAsync('3. Student can submit a valid bug report with auto-captured metadata', async () => {
    const report = await submitServerBugReport({
      title: 'Timetable day order display discrepancy',
      category: 'Timetable',
      severity: 'Medium',
      affectedPage: 'Live Timetable Banner',
      description: 'Day Order 3 shown instead of Day Order 4 for Friday after holiday.',
      reporterName: 'Karthik S',
      reporterEmail: 'karthik.student@gmail.com',
      reporterRole: 'student',
      rollNumber: '260124',
      clientMeta: { platform: 'Windows', userAgent: 'Chrome/120' }
    });

    assert(report.id.startsWith('BUG-'), 'Report ID must start with BUG-');
    assert.strictEqual(report.title, 'Timetable day order display discrepancy');
    assert.strictEqual(report.reporterRole, 'student');
    assert.strictEqual(report.rollNumber, '260124');
    assert.strictEqual(report.status, 'open');
    assert(report.istTimestamp.includes('IST'), 'Timestamp must be in IST');
    assert(report.telegramDelivery, 'Must contain telegram delivery tracking');
  });

  await itAsync('4. Manager can submit a valid bug report with optional screenshot', async () => {
    // Small sample 1x1 png base64
    const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const report = await submitServerBugReport({
      title: 'Google Drive chunk stream timeout on 50MB file',
      category: 'File Upload',
      severity: 'High',
      affectedPage: 'Upload Studio',
      description: 'Uploading large syllabus PDF failed after 30 seconds with network error.',
      screenshot: sampleBase64,
      reporterName: 'CSE Resource Manager',
      reporterEmail: 'manager.cse@saranathan.ac.in',
      reporterRole: 'manager',
      rollNumber: 'STAFF',
      clientMeta: { platform: 'Linux', userAgent: 'Firefox/115' }
    });

    assert(report.id.startsWith('BUG-'));
    assert.strictEqual(report.reporterRole, 'manager');
    assert(report.screenshotUrl, 'Screenshot URL/data must be preserved');
  });

  await itAsync('5. Validation rejects empty or too-short bug titles', async () => {
    let errThrown = false;
    try {
      await submitServerBugReport({
        title: 'No',
        category: 'UI/Design',
        severity: 'Low',
        description: 'This is a test description that meets the length requirement.',
        reporterRole: 'student',
        reporterEmail: 'tester.title@gmail.com'
      });
    } catch (err) {
      errThrown = true;
      assert(err.message.includes('3 characters'), 'Should complain about title length');
    }
    assert(errThrown, 'Should throw validation error for short title');
  });

  await itAsync('6. Validation rejects empty or too-short descriptions', async () => {
    let errThrown = false;
    try {
      await submitServerBugReport({
        title: 'Valid Bug Title',
        category: 'UI/Design',
        severity: 'Low',
        description: 'Too short',
        reporterRole: 'student',
        reporterEmail: 'tester.desc@gmail.com'
      });
    } catch (err) {
      errThrown = true;
      assert(err.message.includes('10 characters'), 'Should complain about description length');
    }
    assert(errThrown, 'Should throw validation error for short description');
  });

  await itAsync('7. Validation rejects invalid severity enum', async () => {
    let errThrown = false;
    try {
      await submitServerBugReport({
        title: 'Valid Bug Title',
        category: 'UI/Design',
        severity: 'SuperCriticalExtreme',
        description: 'Valid description that has sufficient character count.',
        reporterRole: 'student',
        reporterEmail: 'tester.sev@gmail.com'
      });
    } catch (err) {
      errThrown = true;
      assert(err.message.toLowerCase().includes('severity'), 'Should complain about severity');
    }
    assert(errThrown, 'Should throw validation error for invalid severity');
  });

  await itAsync('8. Validation rejects oversized screenshot attachments (>5MB)', async () => {
    // Generate oversized base64 (> 7MB string)
    const hugeBase64 = 'data:image/png;base64,' + 'A'.repeat(8 * 1024 * 1024);
    let errThrown = false;
    try {
      await submitServerBugReport({
        title: 'Valid Bug Title',
        category: 'UI/Design',
        severity: 'Medium',
        description: 'Valid description that has sufficient character count.',
        screenshot: hugeBase64,
        reporterRole: 'student',
        reporterEmail: 'tester.huge@gmail.com'
      });
    } catch (err) {
      errThrown = true;
      assert(err.message.includes('5MB limit'), 'Should reject oversized screenshot');
    }
    assert(errThrown, 'Should throw validation error for oversized screenshot');
  });

  await itAsync('9. Multiple rapid duplicate submissions are prevented by rate limiting', async () => {
    const rapidEmail = `spammer.${Date.now()}@example.com`;
    // Submit 5 reports in rapid succession
    for (let i = 0; i < 5; i++) {
      await submitServerBugReport({
        title: `Rapid Bug Report Submission #${i + 1}`,
        category: 'Other',
        severity: 'Low',
        description: 'Legitimate looking description for rapid submission test.',
        reporterEmail: rapidEmail,
        reporterRole: 'student'
      });
    }

    // 6th submission within 1 minute window must trigger rate limit
    let rateLimited = false;
    try {
      await submitServerBugReport({
        title: 'Rapid Bug Report Submission #6 (Excessive)',
        category: 'Other',
        severity: 'Low',
        description: 'This submission exceeds the 5-per-minute rate limit threshold.',
        reporterEmail: rapidEmail,
        reporterRole: 'student'
      });
    } catch (err) {
      rateLimited = true;
      assert(err.message.includes('Too many bug reports submitted'), 'Must return rate limit message');
    }
    assert(rateLimited, '6th submission in 1 minute must be rejected by rate limiter');
  });

  // -----------------------------------------------------------------------------
  // 3. ADMIN AUTHORIZATION & STATUS MANAGEMENT
  // -----------------------------------------------------------------------------
  console.log('\n--- PART 3: Admin Authorization & Status Management ---');

  it('10. Non-admin roles are forbidden from fetching all bug reports', () => {
    assert.throws(() => {
      getServerBugReports('student');
    }, /Forbidden/, 'Students must not view all bug reports');

    assert.throws(() => {
      getServerBugReports('manager');
    }, /Forbidden/, 'Managers must not view all bug reports');
  });

  it('11. Administrators can review all submitted bug reports', () => {
    const reports = getServerBugReports('admin');
    assert(Array.isArray(reports), 'Must return array of reports');
    assert(reports.length > 0, 'Must contain submitted reports');
  });

  it('12. Administrators can update bug status and add resolution notes', () => {
    const reports = getServerBugReports('admin');
    const target = reports[0];

    const updated = updateServerBugStatus(
      target.id,
      'resolved',
      'jeyaramandeeban@gmail.com',
      'admin',
      'Fixed in patch v2.5.1 by correcting time zone offset.'
    );

    assert.strictEqual(updated.status, 'resolved');
    assert.strictEqual(updated.resolvedBy, 'jeyaramandeeban@gmail.com');
    assert(updated.resolvedAt, 'Must set resolvedAt timestamp');
    assert.strictEqual(updated.resolutionNotes, 'Fixed in patch v2.5.1 by correcting time zone offset.');
  });

  it('13. Non-admin roles cannot update bug status', () => {
    const reports = getServerBugReports('admin');
    const target = reports[0];

    assert.throws(() => {
      updateServerBugStatus(target.id, 'closed', 'student@saranathan.ac.in', 'student');
    }, /Forbidden/, 'Students must not update bug status');
  });

  // -----------------------------------------------------------------------------
  // 4. UI & DOM PERMISSIONS & NAVIGATION INTEGRATION
  // -----------------------------------------------------------------------------
  console.log('\n--- PART 4: Navigation, Permissions & HTML Elements ---');

  it('14. PermissionService defines SUBMIT_BUG_REPORT and VIEW_BUG_REPORTS', () => {
    assert(PermissionService.hasPermission(ROLES.STUDENT, 'SUBMIT_BUG_REPORT'), 'Student can submit bug reports');
    assert(PermissionService.hasPermission(ROLES.MANAGER, 'SUBMIT_BUG_REPORT'), 'Manager can submit bug reports');
    assert(PermissionService.hasPermission(ROLES.REPRESENTATIVE, 'SUBMIT_BUG_REPORT'), 'Representative can submit bug reports');
    assert(PermissionService.hasPermission(ROLES.ADMIN, 'SUBMIT_BUG_REPORT'), 'Admin can submit bug reports');

    assert.strictEqual(PermissionService.hasPermission(ROLES.STUDENT, 'VIEW_BUG_REPORTS'), false, 'Student cannot view bug reports oversight');
    assert.strictEqual(PermissionService.hasPermission(ROLES.MANAGER, 'VIEW_BUG_REPORTS'), false, 'Manager cannot view bug reports oversight');
    assert.strictEqual(PermissionService.hasPermission(ROLES.REPRESENTATIVE, 'VIEW_BUG_REPORTS'), false, 'Representative cannot view bug reports oversight');
    assert.strictEqual(PermissionService.hasPermission(ROLES.ADMIN, 'VIEW_BUG_REPORTS'), true, 'Admin can view bug reports oversight');
  });

  it('15. Navigation includes bug-report action in common items and admin-bugs in Admin roleItems', () => {
    const studentNav = PermissionService.getNavigationForRole(ROLES.STUDENT);
    const adminNav = PermissionService.getNavigationForRole(ROLES.ADMIN);

    const studentBugItem = studentNav.commonItems.find(i => i.id === 'bug-report');
    assert(studentBugItem, 'commonItems must include bug-report for all roles');

    const adminBugItem = adminNav.roleItems.find(i => i.id === 'admin-bugs');
    assert(adminBugItem, 'adminNav.roleItems must include admin-bugs');
  });

  it('16. learning.html contains #lrHeaderBugBtn and #lrBugReportModal with all form inputs', () => {
    const htmlPath = resolve(process.cwd(), 'learning.html');
    const html = readFileSync(htmlPath, 'utf8');

    assert(html.includes('id="lrHeaderBugBtn"'), 'Must have header bug button #lrHeaderBugBtn');
    assert(html.includes('id="lrBugReportModal"'), 'Must have bug report modal #lrBugReportModal');
    assert(html.includes('id="txtBugTitle"'), 'Must have title input #txtBugTitle');
    assert(html.includes('id="selBugCategory"'), 'Must have category dropdown #selBugCategory');
    assert(html.includes('id="selBugSeverity"'), 'Must have severity dropdown #selBugSeverity');
    assert(html.includes('id="txtBugAffectedPage"'), 'Must have affected page input #txtBugAffectedPage');
    assert(html.includes('id="txtBugDescription"'), 'Must have description textarea #txtBugDescription');
    assert(html.includes('id="fileBugScreenshot"'), 'Must have screenshot file input #fileBugScreenshot');
    assert(html.includes('id="btnSubmitBugReport"'), 'Must have submit button #btnSubmitBugReport');
  });

  it('17. learning.css contains styling for header bug button and modal animations', () => {
    const cssPath = resolve(process.cwd(), 'learning.css');
    const css = readFileSync(cssPath, 'utf8');

    assert(css.includes('.lr-header-bug-btn'), 'Must define .lr-header-bug-btn');
    assert(css.includes('.lr-bug-modal-box'), 'Must define .lr-bug-modal-box');
    assert(css.includes('.lr-folder-card-clickable'), 'Must define .lr-folder-card-clickable');
  });

  it('18. Dashboard shortcuts and timetable card contain bug reporting triggers', () => {
    const jsPath = resolve(process.cwd(), 'js/learning/dashboardViews.js');
    const code = readFileSync(jsPath, 'utf8');

    assert(code.includes('data-open-bug-report'), 'Must include data-open-bug-report trigger in dashboard');
    assert(code.includes('renderAdminBugReportsView'), 'Must implement renderAdminBugReportsView in DashboardViews');
    assert(code.includes('lr-folder-card-clickable'), 'Subject folder cards must include lr-folder-card-clickable');
  });

  // -----------------------------------------------------------------------------
  // 5. TIMETABLE ENGINE & INVARIANT PROTECTION
  // -----------------------------------------------------------------------------
  console.log('\n--- PART 5: Invariant Protection & Timetable Integrity ---');

  it('19. Timetable engine, calculation files, and schedules remain untouched', () => {
    const timetablePath = resolve(process.cwd(), 'js/timeEngine.js');
    const timetableCode = readFileSync(timetablePath, 'utf8');

    assert(timetableCode.includes('TimeEngine'), 'Must retain original TimeEngine class');
    assert(timetableCode.includes('getNowIST'), 'Must retain getNowIST calculation');
    assert(timetableCode.includes('Asia/Kolkata'), 'Must retain Asia/Kolkata timezone default');

    const dataPath = resolve(process.cwd(), 'data/timetableData.js');
    const dataCode = readFileSync(dataPath, 'utf8');
    assert(dataCode.includes('appSettingsData') && dataCode.includes('subjectsData') && dataCode.includes('dayOrderTimetables'), 'Must retain original timetable schedule');
  });

  console.log('\n============================================================');
  console.log(`📊 BUG REPORTING TEST SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
