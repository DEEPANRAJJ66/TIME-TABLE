// Unified Test Runner: All Production Verification Suites
// Institution: Saranathan College of Engineering (Autonomous)
// Executes Section 37 Role-Permissions, Auth, Assignments, Moderation, Storage, and Timetable 49/49

import { spawnSync } from 'child_process';
import path from 'path';

const suites = [
  { name: 'Section 37: Role-Permission Matrix (22 Rules)', file: 'role_permissions.test.js' },
  { name: 'Section 4: Google-Only Auth & 6-Digit Profile Validation', file: 'auth_and_profile.test.js' },
  { name: 'Section 15 & 39: Coursework Assignments & Submissions', file: 'assignments_and_submissions.test.js' },
  { name: 'Section 9: Moderation, Admin Unbans & 7-Day Restriction', file: 'moderation_and_restrictions.test.js' },
  { name: 'Section 12 & 38: Google Drive Storage & Streaming Proxy', file: 'google_drive_storage.test.js' },
  { name: 'Timetable & Day Order Engine (49 Preservation Tests)', file: 'engine.test.js' }
];

console.log('================================================================');
console.log('SARANATHAN COLLEGE OF ENGINEERING — PLATFORM TEST RUNNER');
console.log('Department of Computer Science and Engineering (Class A)');
console.log('================================================================\n');

let totalPassedSuites = 0;
let totalFailedSuites = 0;

for (const suite of suites) {
  console.log(`▶ Running Suite: ${suite.name} (${suite.file})...`);
  const filePath = path.join(process.cwd(), 'test', suite.file);

  const result = spawnSync('node', [filePath], {
    stdio: 'inherit',
    env: process.env
  });

  if (result.status === 0) {
    totalPassedSuites++;
    console.log(`✔ SUITE PASSED: ${suite.name}\n`);
  } else {
    totalFailedSuites++;
    console.error(`✖ SUITE FAILED (Exit Code ${result.status}): ${suite.name}\n`);
  }
}

console.log('================================================================');
console.log(`TEST EXECUTION SUMMARY: ${totalPassedSuites} Passed, ${totalFailedSuites} Failed out of ${suites.length} Suites`);
console.log('================================================================');

if (totalFailedSuites > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 ALL ACCEPTANCE CRITERIA AND PRODUCTION TESTS VERIFIED SUCCESSFULLY!\n');
}
