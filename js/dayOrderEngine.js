// Day Order Calculation Engine
// Confirmed Anchor: 17 September 2026 = Day Order 1
// Rotation: Day 1 -> Day 2 -> Day 3 -> Day 4 -> Day 5 -> Day 1 -> ...
// Working days only advance the Day Order. Holidays and leave days do not.

import { academicCalendarData, calendarDictionary } from '../data/calendarData.js';

export class DayOrderEngine {
  constructor(customCalendarDict = null) {
    this.calendarDict = customCalendarDict || calendarDictionary;
    this.anchorDateStr = '2026-09-17';
    this.anchorDayOrder = 1;
  }

  setCalendarData(calendarEntries) {
    if (Array.isArray(calendarEntries)) {
      this.calendarDict = calendarEntries.reduce((acc, item) => {
        const key = item.calendar_date || item.date;
        acc[key] = {
          date: key,
          status: item.status,
          day_order: item.day_order,
          working_day_number: item.working_day_number,
          event_name: item.event_name,
          holiday_reason: item.holiday_reason,
          notes: item.notes
        };
        return acc;
      }, {});
    } else if (typeof calendarEntries === 'object' && calendarEntries !== null) {
      this.calendarDict = calendarEntries;
    }
  }

  /**
   * Resolves day status and Day Order for a given YYYY-MM-DD date string
   * @param {string} dateStr - 'YYYY-MM-DD'
   * @returns {Object} Day status object
   */
  getDayDetails(dateStr) {
    const entry = this.calendarDict[dateStr];

    if (entry) {
      // 1. If explicit day_order exists in calendar record
      if (entry.day_order) {
        return {
          date: dateStr,
          isWorkingDay: true,
          dayOrder: entry.day_order,
          workingDayNumber: entry.working_day_number || null,
          status: entry.status,
          title: `Day Order ${this.toRoman(entry.day_order)}`,
          subtitle: entry.event_name || (entry.status === 'exam' ? 'Internal Assessment Test' : 'Regular Working Day'),
          eventName: entry.event_name || null,
          holidayReason: null,
          isHoliday: false
        };
      }

      // 2. If record is non-working / holiday / leave / exam without classes
      const isHoliday = ['holiday', 'sunday', 'leave'].includes(entry.status);
      const isExam = entry.status === 'exam';

      return {
        date: dateStr,
        isWorkingDay: !isHoliday && entry.status === 'working',
        dayOrder: null,
        workingDayNumber: null,
        status: entry.status,
        title: entry.holiday_reason || entry.event_name || (entry.status === 'sunday' ? 'Sunday Holiday' : 'College Holiday'),
        subtitle: isHoliday ? 'College Holiday' : (entry.event_name || 'Non-Instructional Day'),
        eventName: entry.event_name || null,
        holidayReason: entry.holiday_reason || null,
        isHoliday: true
      };
    }

    // 3. Fallback dynamic calculation for dates outside the predefined 122 calendar entries
    return this.calculateDynamicDayOrder(dateStr);
  }

  /**
   * Fallback continuous working-day loop anchored at 17-Sep-2026 = Day 1
   */
  calculateDynamicDayOrder(targetDateStr) {
    const targetDate = new Date(targetDateStr + 'T00:00:00');
    const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 6 = Saturday

    // Default: Sundays are holidays, Saturdays are non-working leave unless defined
    if (dayOfWeek === 0) {
      return {
        date: targetDateStr,
        isWorkingDay: false,
        dayOrder: null,
        status: 'sunday',
        title: 'Sunday',
        subtitle: 'College Holiday',
        isHoliday: true
      };
    }

    // For arbitrary future weekdays, calculate based on continuous Monday-Friday working loop from anchor
    const anchor = new Date(this.anchorDateStr + 'T00:00:00');
    let workingDaysCount = 0;
    const isForward = targetDate >= anchor;
    const step = isForward ? 1 : -1;
    let curr = new Date(anchor);

    // If counting from anchor
    while (curr.toISOString().slice(0, 10) !== targetDateStr) {
      curr.setDate(curr.getDate() + step);
      const dow = curr.getDay();
      if (dow !== 0 && dow !== 6) { // Mon-Fri assumed working in fallback
        workingDaysCount += step;
      }
    }

    // Anchor is Day 1 (0-indexed: 0)
    let computedIndex = (0 + workingDaysCount) % 5;
    if (computedIndex < 0) computedIndex += 5;
    const computedDayOrder = computedIndex + 1;

    return {
      date: targetDateStr,
      isWorkingDay: true,
      dayOrder: computedDayOrder,
      workingDayNumber: null,
      status: 'working',
      title: `Day Order ${this.toRoman(computedDayOrder)}`,
      subtitle: 'Calculated Day Order (Estimated)',
      isHoliday: false
    };
  }

  toRoman(num) {
    const roman = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
    return roman[num] || String(num);
  }
}
