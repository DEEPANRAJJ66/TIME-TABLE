// Time Engine for Indian Standard Time (IST) - Asia/Kolkata
// Handles live clock, college schedule boundaries (09:10 - 16:45), period countdowns and completion tracking

export class TimeEngine {
  constructor(customTimezone = 'Asia/Kolkata') {
    this.timezone = customTimezone;
  }

  /**
   * Returns current Date object converted to IST
   */
  getNowIST() {
    const now = new Date();
    // Using Intl to get exact components in Asia/Kolkata
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(now);
    const map = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }

    // Return a JS Date object set to IST year, month, date, hours, minutes, seconds
    return new Date(
      parseInt(map.year, 10),
      parseInt(map.month, 10) - 1,
      parseInt(map.day, 10),
      parseInt(map.hour, 10),
      parseInt(map.minute, 10),
      parseInt(map.second, 10)
    );
  }

  /**
   * Formats date to 'YYYY-MM-DD'
   */
  getDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Formats time string to 12-hour AM/PM with seconds
   */
  formatClockTime(date) {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  /**
   * Formats long date e.g. "Wednesday, 16 September 2026"
   */
  formatFullDate(date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  /**
   * Convert 'HH:MM' string to total minutes from midnight
   */
  timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  /**
   * Format total seconds into HH:MM:SS or MM:SS
   */
  formatCountdown(totalSeconds) {
    if (totalSeconds < 0) totalSeconds = 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const pad = (n) => String(n).padStart(2, '0');
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  /**
   * Convert 'HH:MM' 24h string to 'hh:mm AM/PM'
   */
  to12Hour(timeStr) {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${mStr} ${ampm}`;
  }

  parseTimeToMinutes(timeStr) {
    return this.timeToMinutes(timeStr);
  }

  format12Hour(timeStr) {
    return this.to12Hour(timeStr);
  }

  getTimeDifferenceMinutes(startStr, endStr) {
    return Math.abs(this.timeToMinutes(endStr) - this.timeToMinutes(startStr));
  }

  isCollegeHours(timeStr) {
    const mins = this.timeToMinutes(timeStr);
    return mins >= (9 * 60) && mins <= (16 * 60 + 45);
  }

  /**
   * Evaluates current period, countdown, progress, and all period states
   */
  evaluateLiveSchedule(periods, dayDetails, simulatedDate = null) {
    const now = simulatedDate || this.getNowIST();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    const currentTotalSeconds = currentTotalMinutes * 60 + currentSeconds;

    // College hours: 09:10 to 16:45
    const collegeStartMinutes = 9 * 60 + 10; // 550
    const collegeEndMinutes = 16 * 60 + 45;  // 1005

    // If day is holiday / not working
    if (!dayDetails.isWorkingDay || !dayDetails.dayOrder || !periods || periods.length === 0) {
      return {
        state: 'HOLIDAY',
        statusTitle: 'College Holiday',
        statusSubtitle: dayDetails.title || 'No active classes scheduled today',
        currentPeriod: null,
        nextPeriod: null,
        countdownText: '--:--',
        remainingSeconds: 0,
        progressPercent: 0,
        isLiveActive: false,
        periodsWithStatus: []
      };
    }

    // Determine status of each period in the day
    const periodsWithStatus = periods.map((p, idx) => {
      const startM = this.timeToMinutes(p.start);
      const endM = this.timeToMinutes(p.end);
      let status = 'upcoming';

      if (currentTotalMinutes >= endM) {
        status = 'completed';
      } else if (currentTotalMinutes >= startM && currentTotalMinutes < endM) {
        status = 'current';
      } else {
        status = 'upcoming';
      }

      return {
        ...p,
        index: idx,
        status,
        startFormatted: this.to12Hour(p.start),
        endFormatted: this.to12Hour(p.end),
        startMinutes: startM,
        endMinutes: endM
      };
    });

    // 1. Before College (Before 09:10 AM)
    if (currentTotalMinutes < collegeStartMinutes) {
      const startTotalSecs = collegeStartMinutes * 60;
      const remainingSecs = startTotalSecs - currentTotalSeconds;
      const firstPeriod = periodsWithStatus.find(p => p.period > 0) || periodsWithStatus[0];

      return {
        state: 'BEFORE_COLLEGE',
        statusTitle: 'College Starts at 9:10 AM',
        statusSubtitle: `First period (${firstPeriod.label || 'Period 1'}) begins shortly`,
        currentPeriod: null,
        nextPeriod: firstPeriod,
        countdownText: this.formatCountdown(remainingSecs),
        remainingSeconds: remainingSecs,
        progressPercent: 0,
        isLiveActive: false,
        periodsWithStatus
      };
    }

    // 2. After College (After 4:45 PM)
    if (currentTotalMinutes >= collegeEndMinutes) {
      return {
        state: 'AFTER_COLLEGE',
        statusTitle: "Today's College Hours Have Ended",
        statusSubtitle: 'All 8 scheduled periods completed (Ended at 4:45 PM)',
        currentPeriod: null,
        nextPeriod: null,
        countdownText: 'Completed',
        remainingSeconds: 0,
        progressPercent: 100,
        isLiveActive: false,
        periodsWithStatus
      };
    }

    // 3. During College Hours (09:10 AM to 04:45 PM)
    const currentPeriodItem = periodsWithStatus.find(p => p.status === 'current');
    const upcomingPeriods = periodsWithStatus.filter(p => p.status === 'upcoming');
    const nextPeriod = upcomingPeriods.length > 0 ? upcomingPeriods[0] : null;

    if (currentPeriodItem) {
      const pStartSecs = currentPeriodItem.startMinutes * 60;
      const pEndSecs = currentPeriodItem.endMinutes * 60;
      const totalPeriodSecs = pEndSecs - pStartSecs;
      const elapsedPeriodSecs = currentTotalSeconds - pStartSecs;
      const remainingSecs = Math.max(0, pEndSecs - currentTotalSeconds);
      const progress = Math.min(100, Math.max(0, (elapsedPeriodSecs / totalPeriodSecs) * 100));

      const isBreak = currentPeriodItem.type === 'break' || currentPeriodItem.type === 'lunch';

      return {
        state: isBreak ? 'ACTIVE_BREAK' : 'ACTIVE_PERIOD',
        statusTitle: isBreak ? currentPeriodItem.label : `${currentPeriodItem.label} in Progress`,
        statusSubtitle: isBreak
          ? `Ends at ${currentPeriodItem.endFormatted} (Next: ${nextPeriod ? nextPeriod.label : 'End of Day'})`
          : `Ends at ${currentPeriodItem.endFormatted}`,
        currentPeriod: currentPeriodItem,
        nextPeriod,
        countdownText: this.formatCountdown(remainingSecs),
        remainingSeconds: remainingSecs,
        progressPercent: progress,
        isLiveActive: true,
        periodsWithStatus
      };
    }

    // Fallback if between periods gap
    return {
      state: 'ACTIVE_PERIOD',
      statusTitle: 'Transitioning Between Periods',
      statusSubtitle: `Next: ${nextPeriod ? nextPeriod.label : 'Period'}`,
      currentPeriod: null,
      nextPeriod,
      countdownText: '--:--',
      remainingSeconds: 0,
      progressPercent: 0,
      isLiveActive: true,
      periodsWithStatus
    };
  }
}
