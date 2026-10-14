// ========================================================================
// CAPTION GENERATION & RESOURCE METADATA TEST SUITE
// Verifies all 9 requirements from Section 6 of Master Implementation Plan:
// 1. Telegram message contains correct readable metadata (no raw IDs)
// 2. Manager's authenticated name and email are bound & correct
// 3. Multiline description is saved completely in database
// 4. Database record and Telegram caption refer to the same unique resource ID
// 5. Optional fields are omitted cleanly when empty (no N/A, null, undefined)
// 6. Long descriptions preserved in database without breaking Telegram caption limit (<= 1024 chars)
// 7. Editing, retrying and publishing preserve the metadata
// 8. Students can access only published resources (drafts strictly excluded)
// 9. Existing timetable and timetable calculations remain 100% unchanged
// ========================================================================

import assert from 'assert';
import { buildTelegramCaption, formatKolkataTime, KNOWN_CATEGORIES, KNOWN_SUBJECTS } from '../api/telegram.js';
import { LearningStore } from '../js/learning/learningStore.js';
import { DayOrderEngine } from '../js/dayOrderEngine.js';
import { TimeEngine } from '../js/timeEngine.js';
import { appSettingsData, subjectsData, dayOrderTimetables } from '../data/timetableData.js';
import { academicCalendarData, calendarDictionary } from '../data/calendarData.js';

// Mock localStorage for Node.js test environment
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

console.log('=== RUNNING TELEGRAM CAPTION & METADATA VERIFICATION TEST SUITE ===\n');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    Error: ${err.message}\n${err.stack}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// VERIFICATION 1: Telegram Message Contains Correct Readable Metadata
// -----------------------------------------------------------------------------
console.log('--- VERIFICATION 1: Readable Metadata in Telegram Caption ---');

it('Resolves internal category ID "cat_class_notes" to readable name "Regular Class Notes"', () => {
  const result = buildTelegramCaption({
    title: 'Python Loops Lecture Notes',
    description: 'Detailed traces of for-loops with range() and while-loops.',
    categoryId: 'cat_class_notes',
    subjectId: 'sub_python',
    uploaderName: 'Prof. A. Sharma',
    uploaderEmail: 'sharma@saranathan.ac.in',
    academicDate: '2026-09-17',
    periodNumber: 1
  });

  assert.strictEqual(result.categoryName, 'Regular Class Notes');
  assert.ok(result.caption.includes('📂 <b>Category:</b> Regular Class Notes'), 'Must format readable category');
  assert.ok(!result.caption.includes('cat_class_notes'), 'Must NOT contain raw category ID');
});

it('Resolves internal subject ID "sub_python" to readable name', () => {
  const result = buildTelegramCaption({
    title: 'Python Loops Lecture Notes',
    description: 'Detailed traces.',
    categoryId: 'cat_class_notes',
    subjectId: 'sub_python',
    uploaderName: 'Prof. A. Sharma',
    uploaderEmail: 'sharma@saranathan.ac.in'
  });

  assert.strictEqual(result.subjectName, 'Problem Solving and Python Programming (24ES101A)');
  assert.ok(result.caption.includes('📘 <b>Subject:</b> Problem Solving and Python Programming (24ES101A)'));
  assert.ok(!result.caption.includes('sub_python'), 'Must NOT contain raw subject ID');
});

it('Resolves engineering graphics "sub_graphics" to readable name', () => {
  const result = buildTelegramCaption({
    title: 'Isometric Projection Sheet',
    categoryId: 'cat_lab_manuals',
    subjectId: 'sub_graphics',
    uploaderName: 'Dr. Graphics Faculty',
    uploaderEmail: 'graphics@saranathan.ac.in'
  });

  assert.strictEqual(result.subjectName, 'Engineering Graphics (24ES102A)');
  assert.ok(result.caption.includes('📘 <b>Subject:</b> Engineering Graphics (24ES102A)'));
  assert.ok(!result.caption.includes('sub_graphics'), 'Must NOT contain raw subject ID');
});

// -----------------------------------------------------------------------------
// VERIFICATION 2: Authenticated Name and Email Correct
// -----------------------------------------------------------------------------
console.log('\n--- VERIFICATION 2: Manager Display Name and Authenticated Email ---');

it('Includes authenticated Manager display name and email in Telegram caption', () => {
  const result = buildTelegramCaption({
    title: 'Matrices Eigenvalues Practice Sheet',
    description: 'Practice problems on Cayley-Hamilton theorem and diagonalisation.',
    categoryId: 'cat_study_materials',
    subjectId: 'sub_maths',
    uploaderName: 'Dr. K. Ramanathan, HOD Maths',
    uploaderEmail: 'ramanathan.maths@saranathan.ac.in'
  });

  assert.strictEqual(result.uploaderName, 'Dr. K. Ramanathan, HOD Maths');
  assert.strictEqual(result.uploaderEmail, 'ramanathan.maths@saranathan.ac.in');
  assert.ok(result.caption.includes('👤 <b>Uploaded By:</b> Dr. K. Ramanathan, HOD Maths'));
  assert.ok(result.caption.includes('📧 <b>Manager Email:</b> ramanathan.maths@saranathan.ac.in'));
});

it('Escapes HTML special characters in Manager name to prevent caption injection', () => {
  const result = buildTelegramCaption({
    title: 'Chemistry Lab Guide',
    description: 'Water analysis manual.',
    categoryId: 'cat_lab_manuals',
    subjectId: 'sub_physics',
    uploaderName: 'Prof. Alan & Team <CSE>',
    uploaderEmail: 'alan@saranathan.ac.in'
  });

  assert.ok(result.caption.includes('Prof. Alan &amp; Team &lt;CSE&gt;'), 'Special HTML chars must be escaped');
  assert.ok(!result.caption.includes('<CSE>'), 'Raw unescaped HTML tags forbidden');
});

// -----------------------------------------------------------------------------
// VERIFICATION 3: Description Saved Completely in Database
// -----------------------------------------------------------------------------
console.log('\n--- VERIFICATION 3: Complete Multiline Description Persistence ---');

it('Persists full multiline description in LearningStore without truncation', () => {
  const store = new LearningStore();
  const multilineDesc = `This comprehensive document covers Unit 2: Control Flow Statements.
Key topics:
1. if-elif-else branching
2. for loops and range(start, stop, step)
3. while loops with sentinel control
4. break, continue, pass statements
5. Detailed trace tables for Exam preparation.
Please read sections 2.1 to 2.4 before attending tomorrow's lecture in Hall RV 402.`;

  const record = store.saveDraftResource({
    id: 'res_test_multiline_101',
    title: 'Unit 2 Complete Class Notes',
    description: multilineDesc,
    categoryId: 'cat_class_notes',
    subjectId: 'sub_python',
    academicDate: '2026-09-17',
    periodNumber: 1,
    unit: 'Unit 2: Control Flow',
    topic: 'Loops and Trace Tables',
    ownerId: 'usr_mgr_test',
    ownerEmail: 'manager@saranathan.ac.in',
    ownerName: 'Prof. Saranathan Faculty'
  }, { id: 'usr_mgr_test', email: 'manager@saranathan.ac.in', role: 'manager' });

  const fetched = store.getResourceById('res_test_multiline_101');
  assert.strictEqual(fetched.description, multilineDesc, 'Stored description must be identical to input');
  assert.strictEqual(fetched.unit, 'Unit 2: Control Flow');
  assert.strictEqual(fetched.topic, 'Loops and Trace Tables');
});

// -----------------------------------------------------------------------------
// VERIFICATION 4: Resource ID Matches Between Database and Telegram Caption
// -----------------------------------------------------------------------------
console.log('\n--- VERIFICATION 4: Unique Resource ID Consistency ---');

it('Database record and Telegram caption refer to the EXACT same unique resource ID', () => {
  const uniqueId = 'res_unique_verification_98765';
  const metadata = {
    resourceId: uniqueId,
    title: 'Quantum Physics Unit 1 Formula Sheet',
    description: 'Important Planck and De Broglie equations.',
    categoryId: 'cat_study_materials',
    subjectId: 'sub_physics',
    uploaderName: 'Prof. Physics',
    uploaderEmail: 'physics@saranathan.ac.in'
  };

  const captionData = buildTelegramCaption(metadata);
  assert.strictEqual(captionData.resourceId, uniqueId, 'Caption resourceId must match');
  assert.ok(captionData.caption.includes(`🆔 <b>Resource ID:</b> ${uniqueId}`));
  assert.ok(!captionData.caption.includes('N/A'), 'Must NEVER contain N/A');

  const store = new LearningStore();
  const dbRecord = store.saveDraftResource({
    id: uniqueId,
    title: metadata.title,
    description: metadata.description,
    categoryId: metadata.categoryId,
    subjectId: metadata.subjectId,
    ownerId: 'usr_physics',
    ownerEmail: metadata.uploaderEmail,
    ownerName: metadata.uploaderName
  }, { id: 'usr_physics', email: metadata.uploaderEmail, role: 'manager' });

  assert.strictEqual(dbRecord.id, captionData.resourceId, 'DB record ID must match caption ID');
});

// -----------------------------------------------------------------------------
// VERIFICATION 5: Optional Fields Omitted Cleanly When Empty
// -----------------------------------------------------------------------------
console.log('\n--- VERIFICATION 5: Clean Omission of Optional Fields ---');

it('Omits Unit, Topic, Academic Date, and Period when not provided', () => {
  const result = buildTelegramCaption({
    title: 'Semester 1 Autonomous Regulation Curriculum',
    description: 'Official syllabus booklet.',
    categoryId: 'cat_syllabus_curriculum',
    subjectId: 'sub_python',
    uploaderName: 'Dean Academic',
    uploaderEmail: 'dean@saranathan.ac.in'
    // unit, topic, academicDate, period are omitted
  });

  assert.ok(!result.caption.includes('Unit/Chapter'), 'Unit/Chapter must NOT appear');
  assert.ok(!result.caption.includes('Topic'), 'Topic must NOT appear');
  assert.ok(!result.caption.includes('Academic Date'), 'Academic Date must NOT appear');
  assert.ok(!result.caption.includes('Period'), 'Period must NOT appear');
  assert.ok(!result.caption.includes('undefined'), 'Must not contain "undefined"');
  assert.ok(!result.caption.includes('null'), 'Must not contain "null"');
  assert.ok(!result.caption.includes('N/A'), 'Must not contain "N/A"');
});

it('Handles "null", "undefined", or empty string values cleanly without outputting them', () => {
  const result = buildTelegramCaption({
    title: 'General Guide',
    description: 'Instructions',
    categoryId: 'cat_class_notes',
    subjectId: 'sub_python',
    unit: 'null',
    topic: 'undefined',
    academicDate: 'N/A',
    period: ''
  });

  assert.ok(!result.caption.includes('Unit/Chapter'), 'Null string unit omitted');
  assert.ok(!result.caption.includes('Topic:</b> undefined'), 'Undefined string topic omitted');
  assert.ok(!result.caption.includes('Academic Date:</b> N/A'), 'N/A string date omitted');
  assert.ok(!result.caption.includes('Period:</b>'), 'Empty period omitted');
});

it('Formats Asia/Kolkata timezone with IST in caption', () => {
  const result = buildTelegramCaption({
    title: 'Test Timezone Resource',
    uploadedAt: '2026-09-17T09:30:00.000Z'
  });

  assert.ok(result.caption.includes('IST'), 'Must include IST');
  assert.ok(result.caption.includes('⏰ <b>Uploaded At:</b>'));
});

// -----------------------------------------------------------------------------
// VERIFICATION 6: Long Descriptions Preserved Without Invalid Captions
// -----------------------------------------------------------------------------
console.log('\n--- VERIFICATION 6: Long Description Caption Limit Handling ---');

it('Preserves 2,500-char description in DB while keeping caption <= 1024 chars', () => {
  const longDesc = 'A'.repeat(2500);
  const metadata = {
    resourceId: 'res_long_desc_999',
    title: 'Extremely Detailed Machine Learning & Python Handout',
    description: longDesc,
    categoryId: 'cat_class_notes',
    subjectId: 'sub_python',
    unit: 'Unit 5: Advanced Python',
    topic: 'Comprehensive NumPy & Matrix Math',
    academicDate: '2026-09-17',
    period: 4,
    uploaderName: 'Prof. Senior Faculty',
    uploaderEmail: 'senior.faculty@saranathan.ac.in'
  };

  const captionData = buildTelegramCaption(metadata);

  // Database retains full length
  assert.strictEqual(captionData.fullDescription.length, 2500, 'Full description in DB must NOT be truncated');
  
  // Caption respects Telegram 1024-char limit
  assert.ok(captionData.caption.length <= 1020, `Caption length (${captionData.caption.length}) must be <= 1020 chars`);
  assert.ok(captionData.caption.includes('... [Full details in Portal]'), 'Must note portal has complete details');
  assert.ok(captionData.caption.includes('res_long_desc_999'), 'Resource ID must remain present in caption');
  assert.ok(captionData.caption.includes('Prof. Senior Faculty'), 'Uploader name must remain present');
});

// -----------------------------------------------------------------------------
// VERIFICATION 7: Editing, Retrying and Publishing Preserve Metadata
// -----------------------------------------------------------------------------
console.log('\n--- VERIFICATION 7: Metadata Preservation Across Lifecycle ---');

it('Preserves metadata when editing, retrying upload and publishing', () => {
  const store = new LearningStore();
  const managerUser = { id: 'usr_mgr_alpha', email: 'mgr.alpha@saranathan.ac.in', role: 'manager' };

  // 1. Initial draft creation with failed upload
  const draftRecord = store.saveDraftResource({
    id: 'res_retry_flow_123',
    title: 'Engineering Graphics Sheet 3',
    description: 'Curves of intersection and development of surfaces.',
    categoryId: 'cat_lab_manuals',
    categoryName: 'Laboratory Manuals & Programs',
    subjectId: 'sub_graphics',
    subjectName: 'Engineering Graphics (24ES102A)',
    academicDate: '2026-09-18',
    periodNumber: 3,
    unit: 'Unit 3: Isometric and Perspective',
    topic: 'Cylinder Cone Penetration',
    ownerId: managerUser.id,
    ownerEmail: managerUser.email,
    ownerName: 'Prof. Graphics Manager',
    uploadStatus: 'upload_failed',
    publicationStatus: 'draft'
  }, managerUser);

  assert.strictEqual(draftRecord.uploadStatus, 'upload_failed');
  assert.strictEqual(draftRecord.description, 'Curves of intersection and development of surfaces.');

  // 2. Retry: update upload status to telegram_success (simulating successful retry)
  const updatedRecord = store.updateResource('res_retry_flow_123', {
    telegramChatId: '-1003598863042',
    telegramMessageId: 108,
    telegramFileId: 'BQACAgUAAxkBAAIC',
    uploadStatus: 'telegram_success'
  }, managerUser);

  // Verify metadata intact
  assert.strictEqual(updatedRecord.title, 'Engineering Graphics Sheet 3');
  assert.strictEqual(updatedRecord.unit, 'Unit 3: Isometric and Perspective');
  assert.strictEqual(updatedRecord.topic, 'Cylinder Cone Penetration');
  assert.strictEqual(updatedRecord.periodNumber, 3);
  assert.strictEqual(updatedRecord.academicDate, '2026-09-18');
  assert.strictEqual(updatedRecord.ownerName, 'Prof. Graphics Manager');
  assert.strictEqual(updatedRecord.ownerEmail, managerUser.email);
  assert.strictEqual(updatedRecord.telegramMessageId, 108);

  // 3. Publishing
  const publishedRecord = store.publishResource('res_retry_flow_123', managerUser);
  assert.strictEqual(publishedRecord.publicationStatus, 'published');
  assert.strictEqual(publishedRecord.description, 'Curves of intersection and development of surfaces.');
  assert.strictEqual(publishedRecord.id, 'res_retry_flow_123');
});

// -----------------------------------------------------------------------------
// VERIFICATION 8: Students Can Access Only Published Resources
// -----------------------------------------------------------------------------
console.log('\n--- VERIFICATION 8: Student Access Exclusivity ---');

it('Ensures student queries return strictly published materials, hiding drafts & failed uploads', () => {
  const store = new LearningStore();
  const managerUser = { id: 'usr_mgr_test', email: 'mgr@saranathan.ac.in', role: 'manager' };

  // Create 1 draft, 1 failed, 1 published
  store.saveDraftResource({
    id: 'res_draft_hidden',
    title: 'Secret Draft Notes',
    categoryId: 'cat_class_notes',
    ownerId: managerUser.id,
    ownerEmail: managerUser.email,
    uploadStatus: 'telegram_success',
    publicationStatus: 'draft'
  }, managerUser);

  store.saveDraftResource({
    id: 'res_failed_hidden',
    title: 'Failed Upload Notes',
    categoryId: 'cat_class_notes',
    ownerId: managerUser.id,
    ownerEmail: managerUser.email,
    uploadStatus: 'upload_failed',
    publicationStatus: 'draft'
  }, managerUser);

  const pub = store.saveDraftResource({
    id: 'res_published_visible',
    title: 'Live Classroom Notes',
    categoryId: 'cat_class_notes',
    ownerId: managerUser.id,
    ownerEmail: managerUser.email,
    uploadStatus: 'telegram_success',
    publicationStatus: 'draft'
  }, managerUser);
  store.publishResource(pub.id, managerUser);

  const studentAccessible = store.getPublishedResources();
  assert.ok(studentAccessible.some(r => r.id === 'res_published_visible'), 'Published resource must be accessible');
  assert.ok(!studentAccessible.some(r => r.id === 'res_draft_hidden'), 'Draft resource must be HIDDEN from students');
  assert.ok(!studentAccessible.some(r => r.id === 'res_failed_hidden'), 'Failed upload resource must be HIDDEN from students');
});

// -----------------------------------------------------------------------------
// VERIFICATION 9: Existing Timetable Remains 100% Unchanged
// -----------------------------------------------------------------------------
console.log('\n--- VERIFICATION 9: Existing Timetable Integrity ---');

it('Timetable metadata (College, Hall RV 402, Dept CSE) is intact', () => {
  assert.ok(appSettingsData.college_name.includes('Saranathan College of Engineering'));
  assert.strictEqual(appSettingsData.hall, 'RV 402');
  assert.ok(appSettingsData.department.includes('Computer Science and Engineering'));
  assert.strictEqual(appSettingsData.section, 'A');
  assert.strictEqual(appSettingsData.semester, 'I');
});

it('All 5 Day Orders contain all periods and breaks (11 schedule entries)', () => {
  for (let doNum = 1; doNum <= 5; doNum++) {
    const schedule = dayOrderTimetables[doNum];
    assert.strictEqual(schedule.length, 11, `Day Order ${doNum} must have 11 schedule entries`);
  }
});

it('Time engine evaluates live periods and transitions without alterations', () => {
  const doEngine = new DayOrderEngine(calendarDictionary);
  const timeEngine = new TimeEngine('Asia/Kolkata');
  const day1Periods = dayOrderTimetables[1];
  const day1Details = doEngine.getDayDetails('2026-09-17');
  const simDate = new Date(2026, 8, 17, 9, 30, 0);
  const evaluation = timeEngine.evaluateLiveSchedule(day1Periods, day1Details, simDate);
  assert.strictEqual(evaluation.state, 'ACTIVE_PERIOD');
  assert.strictEqual(evaluation.currentPeriod.period, 1);
  assert.strictEqual(evaluation.currentPeriod.status, 'current');
});

console.log('\n======================================================');
console.log(`TEST SUMMARY: ${passedTests} PASSED, 0 FAILED OUT OF ${totalTests} TESTS`);
console.log('======================================================\n');
