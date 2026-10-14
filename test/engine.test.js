// Automated Unit & Integration Tests for CSE Class A Timetable Engine
import { TimeEngine } from '../js/timeEngine.js';
import { DayOrderEngine } from '../js/dayOrderEngine.js';
import { appSettingsData, subjectsData, dayOrderTimetables } from '../data/timetableData.js';
import { academicCalendarData, calendarDictionary } from '../data/calendarData.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('=== RUNNING CSE CLASS A TIMETABLE ENGINE TEST SUITE ===\n');

// 1. College Metadata & Subject Verification
console.log('--- TEST GROUP 1: Verified College Metadata & Subject Data ---');
assert(appSettingsData.college_name.includes('Saranathan College of Engineering'), 'College name is Saranathan College of Engineering (Autonomous)');
assert(appSettingsData.hall === 'RV 402', 'Hall is RV 402');
assert(appSettingsData.department.includes('Computer Science'), 'Department is CSE');
assert(appSettingsData.section === 'A', 'Section is A');
assert(appSettingsData.semester === 'I', 'Semester is I (First Year)');
assert(appSettingsData.anchor_date === '2026-09-17', 'Anchor date is 2026-09-17');
assert(appSettingsData.anchor_day_order === 1, 'Anchor Day Order is 1');

// Check all core subjects
const expectedCodes = ['24EN101A', '24MA101A', '24PH101A', '24CH101A', '24ES101A', '24ES102A', '24TA101A', '24PH111A', '24ES111A', '24EM111A'];
expectedCodes.forEach(code => {
  assert(!!subjectsData[code], `Subject code ${code} exists with name: "${subjectsData[code]?.name}"`);
});

// 2. Day Order Engine Tests
console.log('\n--- TEST GROUP 2: Day Order Engine & Academic Calendar ---');
const doEngine = new DayOrderEngine(calendarDictionary);

// Anchor Test: 17 September 2026 = Day Order I
const anchorDay = doEngine.getDayDetails('2026-09-17');
assert(anchorDay.isWorkingDay === true, '17-Sep-2026 is a working day');
assert(anchorDay.dayOrder === 1, '17-Sep-2026 has Day Order I');

// Holiday Test: 04-Sep-2026 Krishna Jayanthi
const krishnaJayanthi = doEngine.getDayDetails('2026-09-04');
assert(krishnaJayanthi.isHoliday === true, '04-Sep-2026 is marked as Holiday');
assert(krishnaJayanthi.dayOrder === null, '04-Sep-2026 does not have a Day Order assigned');

// Sunday Test: 20-Sep-2026
const sunday = doEngine.getDayDetails('2026-09-20');
assert(sunday.isHoliday === true, '20-Sep-2026 is Sunday Holiday');

// Day Order 1 through 5 verification
for (let d = 1; d <= 5; d++) {
  const periods = dayOrderTimetables[d];
  assert(periods && periods.length >= 8, `Day Order ${d} has all periods and breaks (total entries: ${periods?.length})`);
}

// 3. Time Engine & Live Schedule Simulation Tests
console.log('\n--- TEST GROUP 3: Time Engine & Period Evaluation ---');
const timeEngine = new TimeEngine('Asia/Kolkata');

// Helper to create simulated date on Day 1 (17-Sep-2026)
function makeSimDate(hours, minutes, seconds = 0) {
  return new Date(2026, 8, 17, hours, minutes, seconds); // Month 8 is September
}

const day1Periods = dayOrderTimetables[1];
const day1Details = doEngine.getDayDetails('2026-09-17');

// Test: 08:30 AM (Before College)
const evalBefore = timeEngine.evaluateLiveSchedule(day1Periods, day1Details, makeSimDate(8, 30));
assert(evalBefore.state === 'BEFORE_COLLEGE', '08:30 AM returns BEFORE_COLLEGE state');
assert(evalBefore.isLiveActive === false, '08:30 AM live period is not active');
assert(evalBefore.nextPeriod && evalBefore.nextPeriod.period === 1, '08:30 AM next period is Period 1');

// Test: 09:30 AM (Period 1 active: 09:10 - 10:00)
const evalP1 = timeEngine.evaluateLiveSchedule(day1Periods, day1Details, makeSimDate(9, 30));
assert(evalP1.state === 'ACTIVE_PERIOD', '09:30 AM returns ACTIVE_PERIOD state');
assert(evalP1.currentPeriod && evalP1.currentPeriod.period === 1, '09:30 AM current period is Period 1 (Python)');
assert(evalP1.currentPeriod && evalP1.currentPeriod.status === 'current', 'Period 1 marked current');
assert(evalP1.countdownText.length > 0, `09:30 AM countdown is ${evalP1.countdownText}`);

// Test: 10:55 AM (Morning Break: 10:50 - 11:05)
const evalMBrk = timeEngine.evaluateLiveSchedule(day1Periods, day1Details, makeSimDate(10, 55));
assert(evalMBrk.state === 'ACTIVE_BREAK', '10:55 AM returns ACTIVE_BREAK state');
assert(evalMBrk.currentPeriod && evalMBrk.currentPeriod.label === 'Morning Break', 'Current event is Morning Break');
assert(evalMBrk.nextPeriod && evalMBrk.nextPeriod.period === 3, 'Next period after morning break is Period 3');

// Test: 13:00 PM (Lunch: 12:45 - 13:30)
const evalLunch = timeEngine.evaluateLiveSchedule(day1Periods, day1Details, makeSimDate(13, 0));
assert(evalLunch.state === 'ACTIVE_BREAK' || evalLunch.state === 'ACTIVE_LUNCH', '13:00 PM returns ACTIVE_BREAK / LUNCH');
assert(evalLunch.currentPeriod && evalLunch.currentPeriod.label === 'Lunch Break', 'Current event is Lunch Break');

// Test: 15:05 PM (Afternoon Break: 15:00 - 15:15)
const evalABrk = timeEngine.evaluateLiveSchedule(day1Periods, day1Details, makeSimDate(15, 5));
assert(evalABrk.state === 'ACTIVE_BREAK', '15:05 PM returns ACTIVE_BREAK');
assert(evalABrk.currentPeriod && evalABrk.currentPeriod.label === 'Afternoon Break', 'Current event is Afternoon Break');

// Test: 16:30 PM (Period 8: 16:00 - 16:45)
const evalP8 = timeEngine.evaluateLiveSchedule(day1Periods, day1Details, makeSimDate(16, 30));
assert(evalP8.state === 'ACTIVE_PERIOD', '16:30 PM returns ACTIVE_PERIOD');
assert(evalP8.currentPeriod && evalP8.currentPeriod.period === 8, 'Current period is Period 8');

// Test: 17:00 PM (After College: >= 16:45)
const evalAfter = timeEngine.evaluateLiveSchedule(day1Periods, day1Details, makeSimDate(17, 0));
assert(evalAfter.state === 'AFTER_COLLEGE', '17:00 PM returns AFTER_COLLEGE state');
assert(evalAfter.currentPeriod === null, 'After college has no active current period');
assert(evalAfter.periodsWithStatus.every(p => p.status === 'completed'), 'All periods marked completed after 4:45 PM');

// 4. Dynamic Fallback & Edge Case Resolution Tests
console.log('\n--- TEST GROUP 4: Dynamic Fallback Day Order Calculation ---');
const fallbackFriday = doEngine.calculateDynamicDayOrder('2026-09-18');
assert(fallbackFriday.isWorkingDay === true, '18-Sep-2026 dynamic fallback is working day');
assert(fallbackFriday.dayOrder === 2, '18-Sep-2026 dynamic fallback calculates Day Order II');

const fallbackSunday = doEngine.calculateDynamicDayOrder('2026-09-20');
assert(fallbackSunday.isHoliday === true, '20-Sep-2026 dynamic fallback identifies Sunday as Holiday');

// 5. Summary
console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED SUCCESSFULLY! ✓');
}
