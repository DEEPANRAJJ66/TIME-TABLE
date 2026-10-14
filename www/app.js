// Main Application Controller for CSE Class A Live Timetable Planner
// Institution: Saranathan College of Engineering (Autonomous)

import { TimeEngine } from './js/timeEngine.js';
import { DayOrderEngine } from './js/dayOrderEngine.js';
import { SupabaseSyncService } from './js/supabaseClient.js';
import { appSettingsData, subjectsData, dayOrderTimetables } from './data/timetableData.js';
import { academicCalendarData, calendarDictionary } from './data/calendarData.js';
import { initIntro } from './js/introManager.js';

class CollegeTimetableApp {
  constructor() {
    this.timeEngine = new TimeEngine('Asia/Kolkata');
    this.dayOrderEngine = new DayOrderEngine();
    this.supabaseService = new SupabaseSyncService();

    // Application state
    this.subjects = { ...subjectsData };
    this.timetables = { ...dayOrderTimetables };
    this.appSettings = { ...appSettingsData };

    this.todayIST = this.timeEngine.getNowIST();
    this.todayDateStr = this.timeEngine.getDateKey(this.todayIST);
    this.selectedDateStr = this.todayDateStr;
    this.previewDayOrder = null; // 1 to 5 if manually previewing
    this.activeView = 'schedule'; // 'schedule' | 'calendar'

    // Calendar orientation mode
    this.calendarViewMode = 'sheet'; // 'sheet' (College PDF Planner format) | 'grid' (Monthly calendar grid)
    this.plannerMonthFilter = 'all'; // 'all' | '8' | '9' | '10' | '11'

    // Calendar grid navigation state
    this.calendarYear = 2026;
    this.calendarMonth = 8; // 8 = September (0-indexed)

    // Chime state
    this.soundEnabled = localStorage.getItem('college_sound_enabled') !== 'false';
    this.lastActivePeriodId = null;

    // DOM Elements
    this.cacheDomElements();
    this.initTheme();
    this.setupEventListeners();
  }

  cacheDomElements() {
    // Top Nav
    this.dbStatusBtn = document.getElementById('dbStatusBtn');
    this.dbStatusLabel = document.getElementById('dbStatusLabel');
    this.themeToggleBtn = document.getElementById('themeToggleBtn');
    this.themeIcon = document.getElementById('themeIcon');
    this.themeLabel = document.getElementById('themeLabel');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.soundIcon = document.getElementById('soundIcon');
    this.soundLabel = document.getElementById('soundLabel');

    // Hero Section
    this.heroDayOrderBadge = document.getElementById('heroDayOrderBadge');
    this.heroWorkingBadge = document.getElementById('heroWorkingBadge');
    this.heroDateText = document.getElementById('heroDateText');
    this.heroEventText = document.getElementById('heroEventText');
    this.heroClockDigits = document.getElementById('heroClockDigits');
    this.jumpTodayBtn = document.getElementById('jumpTodayBtn');
    this.heroHallTag = document.getElementById('heroHallTag');

    // Live Current Period Card
    this.heroCurrentPeriodCard = document.getElementById('heroCurrentPeriodCard');
    this.heroLiveIndicator = document.getElementById('heroLiveIndicator');
    this.heroLiveTag = document.getElementById('heroLiveTag');
    this.heroPeriodTiming = document.getElementById('heroPeriodTiming');
    this.heroPeriodLabel = document.getElementById('heroPeriodLabel');
    this.heroSubjectTitle = document.getElementById('heroSubjectTitle');
    this.heroFacultyName = document.getElementById('heroFacultyName');
    this.heroFacultyText = document.getElementById('heroFacultyText');
    this.heroCountdownLabel = document.getElementById('heroCountdownLabel');
    this.heroCountdownDigits = document.getElementById('heroCountdownDigits');
    this.heroProgressFill = document.getElementById('heroProgressFill');
    this.heroNextPeriodHint = document.getElementById('heroNextPeriodHint');

    // View Navigation & Day Order Buttons
    this.tabScheduleBtn = document.getElementById('tabScheduleBtn');
    this.tabCalendarBtn = document.getElementById('tabCalendarBtn');
    this.scheduleView = document.getElementById('scheduleView');
    this.calendarView = document.getElementById('calendarView');
    this.doButtons = document.querySelectorAll('.do-btn');

    // Schedule List
    this.scheduleHeaderTitle = document.getElementById('scheduleHeaderTitle');
    this.scheduleHeaderBadge = document.getElementById('scheduleHeaderBadge');
    this.scheduleSubText = document.getElementById('scheduleSubText');
    this.periodsList = document.getElementById('periodsList');

    // Calendar Orientations & Containers
    this.btnPlannerSheetView = document.getElementById('btnPlannerSheetView');
    this.btnMonthlyGridView = document.getElementById('btnMonthlyGridView');
    this.plannerSheetContainer = document.getElementById('plannerSheetContainer');
    this.monthlyGridContainer = document.getElementById('monthlyGridContainer');
    this.monthFilterContainer = document.getElementById('monthFilterContainer');
    this.monthFilterButtons = document.querySelectorAll('.month-pill-btn');

    // Monthly Grid Nav Elements
    this.currentMonthLabel = document.getElementById('currentMonthLabel');
    this.prevMonthBtn = document.getElementById('prevMonthBtn');
    this.nextMonthBtn = document.getElementById('nextMonthBtn');
    this.calendarDaysGrid = document.getElementById('calendarDaysGrid');

    // Supabase Modal
    this.supabaseModal = document.getElementById('supabaseModal');
    this.closeModalBtn = document.getElementById('closeModalBtn');
    this.sbUrlInput = document.getElementById('sbUrlInput');
    this.sbKeyInput = document.getElementById('sbKeyInput');
    this.saveDbBtn = document.getElementById('saveDbBtn');
    this.resetDbBtn = document.getElementById('resetDbBtn');
    this.modalStatusMsg = document.getElementById('modalStatusMsg');
  }

  async init() {
    this.updateSoundButtonUI();

    // 1. Initial data load: Directly initialize verified local college data (Phase 1 offline-first)
    this.loadLocalBaselineData();

    // 2. Start live clock & ticker
    this.startTicker();

    // 3. Initial UI render
    this.render();

    // 4. Setup robust lifecycle listeners (Native Capacitor + Web standards)
    this.setupLifecycleListeners();
  }

  loadLocalBaselineData() {
    this.subjects = { ...subjectsData };
    this.timetables = { ...dayOrderTimetables };
    this.appSettings = { ...appSettingsData };
    this.dayOrderEngine.setCalendarData(calendarDictionary);

    if (this.dbStatusLabel) {
      this.dbStatusLabel.textContent = 'Offline Verified';
      if (this.dbStatusBtn) this.dbStatusBtn.style.color = 'var(--accent-emerald)';
    }
  }

  async syncDatabaseData() {
    this.dbStatusLabel.textContent = 'Checking Cloud...';
    try {
      const res = await this.supabaseService.loadAllData();
      if (res.success) {
        this.subjects = res.subjects;
        this.timetables = res.timetables;
        this.appSettings = res.settings;
        this.dayOrderEngine.setCalendarData(res.calendarDict);

        if (res.source === 'supabase') {
          this.dbStatusLabel.textContent = 'Supabase Live';
          this.dbStatusBtn.style.color = 'var(--accent-emerald)';
        } else if (res.source === 'cache') {
          this.dbStatusLabel.textContent = 'Cached Cloud';
          this.dbStatusBtn.style.color = 'var(--accent-blue)';
        } else {
          this.dbStatusLabel.textContent = 'Local Verified';
          this.dbStatusBtn.style.color = 'var(--accent-gold)';
        }
      }
    } catch (err) {
      console.error('Data sync failed:', err);
      this.dbStatusLabel.textContent = 'Local Baseline';
    }
  }

  startTicker() {
    // Run immediately then tick every 1 second
    this.tick();
    setInterval(() => this.tick(), 1000);
  }

  tick() {
    this.todayIST = this.timeEngine.getNowIST();
    this.todayDateStr = this.timeEngine.getDateKey(this.todayIST);

    // Update real-time clock digits
    this.heroClockDigits.textContent = this.timeEngine.formatClockTime(this.todayIST);

    // Live period evaluation
    this.evaluateAndRenderLiveState();
  }

  evaluateAndRenderLiveState() {
    const isViewingToday = (this.selectedDateStr === this.todayDateStr) && (this.previewDayOrder === null);
    
    // Show or hide "Jump to Today" button
    this.jumpTodayBtn.style.display = isViewingToday ? 'none' : 'inline-flex';

    // Day details for active target
    let dayDetails;
    let targetDayOrder;

    if (this.previewDayOrder) {
      targetDayOrder = this.previewDayOrder;
      dayDetails = {
        date: this.selectedDateStr,
        isWorkingDay: true,
        dayOrder: targetDayOrder,
        title: `Day Order ${this.dayOrderEngine.toRoman(targetDayOrder)} (Preview)`,
        subtitle: 'Viewing timetable for selected Day Order',
        isHoliday: false
      };
    } else {
      dayDetails = this.dayOrderEngine.getDayDetails(this.selectedDateStr);
      targetDayOrder = dayDetails.dayOrder;
    }

    const periodsForDay = targetDayOrder ? (this.timetables[targetDayOrder] || []) : [];

    // Evaluate period times against today's IST time
    const liveEval = this.timeEngine.evaluateLiveSchedule(
      periodsForDay,
      dayDetails,
      isViewingToday ? this.todayIST : null
    );

    // Render Hero Card and Period Hero
    this.renderHero(liveEval, dayDetails, isViewingToday);

    // Render Timeline only if in Schedule View
    if (this.activeView === 'schedule') {
      this.renderScheduleTimeline(liveEval, dayDetails, isViewingToday);
    }

    // Check period chime
    if (isViewingToday && liveEval.currentPeriod && this.soundEnabled) {
      const currentPeriodId = `${liveEval.currentPeriod.period}_${liveEval.currentPeriod.start}`;
      if (this.lastActivePeriodId && this.lastActivePeriodId !== currentPeriodId) {
        this.playChime();
      }
      this.lastActivePeriodId = currentPeriodId;
    }
  }

  renderHero(evalState, dayDetails, isViewingToday) {
    // 1. Header Badges
    if (dayDetails.dayOrder) {
      this.heroDayOrderBadge.textContent = `Day Order ${this.dayOrderEngine.toRoman(dayDetails.dayOrder)}`;
      this.heroDayOrderBadge.style.display = 'inline-flex';
      this.heroWorkingBadge.textContent = isViewingToday ? 'Working Day' : (dayDetails.eventName || 'Scheduled Day');
      this.heroWorkingBadge.className = 'working-status-badge';
    } else {
      this.heroDayOrderBadge.style.display = 'none';
      this.heroWorkingBadge.textContent = dayDetails.title || 'College Holiday';
      this.heroWorkingBadge.className = 'working-status-badge holiday-status-badge';
    }

    // 2. Date Text
    const dateObj = new Date(this.selectedDateStr + 'T00:00:00');
    this.heroDateText.textContent = this.timeEngine.formatFullDate(dateObj);
    this.heroEventText.textContent = dayDetails.subtitle || (dayDetails.eventName || 'First-Year CSE Class A • RV 402');

    // 3. Right Hero Card: Current Period Status
    if (!isViewingToday) {
      // Previewing a different date or previewing a day order
      this.heroLiveIndicator.style.display = 'none';
      this.heroPeriodTiming.textContent = 'Full Day Overview';
      this.heroPeriodLabel.textContent = dayDetails.title;
      this.heroSubjectTitle.textContent = `${evalState.periodsWithStatus.length} Periods Scheduled`;
      this.heroFacultyName.style.display = 'none';
      this.heroCountdownLabel.textContent = 'Viewing Mode';
      this.heroCountdownDigits.textContent = 'REFERENCE';
      this.heroProgressFill.style.width = '100%';
      this.heroNextPeriodHint.innerHTML = `<span>Scheduled Hall:</span> <strong>${this.appSettings.hall}</strong>`;
      this.heroCurrentPeriodCard.classList.remove('pulse-glow');
      return;
    }

    // We are viewing TODAY in real-time
    this.heroFacultyName.style.display = 'flex';
    this.heroLiveIndicator.style.display = 'inline-flex';

    if (evalState.state === 'HOLIDAY') {
      this.heroCurrentPeriodCard.classList.remove('pulse-glow');
      this.heroLiveTag.textContent = 'HOLIDAY';
      this.heroLiveIndicator.style.background = 'rgba(244, 63, 94, 0.15)';
      this.heroLiveIndicator.style.color = 'var(--accent-rose)';
      this.heroLiveIndicator.style.borderColor = 'rgba(244, 63, 94, 0.3)';
      this.heroPeriodTiming.textContent = 'No Classes';
      this.heroPeriodLabel.textContent = 'College Holiday';
      this.heroSubjectTitle.textContent = dayDetails.title || 'Non-Working Day';
      this.heroFacultyName.style.display = 'none';
      this.heroCountdownLabel.textContent = 'College Status';
      this.heroCountdownDigits.textContent = 'OFF';
      this.heroProgressFill.style.width = '0%';
      this.heroNextPeriodHint.innerHTML = `<span>Remarks:</span> <strong>${dayDetails.holidayReason || 'Academic Holiday'}</strong>`;
    } else if (evalState.state === 'BEFORE_COLLEGE') {
      this.heroCurrentPeriodCard.classList.remove('pulse-glow');
      this.heroLiveTag.textContent = 'STARTING SOON';
      this.heroLiveIndicator.style.background = 'rgba(251, 191, 36, 0.15)';
      this.heroLiveIndicator.style.color = 'var(--accent-gold)';
      this.heroLiveIndicator.style.borderColor = 'rgba(251, 191, 36, 0.3)';
      this.heroPeriodTiming.textContent = '09:10 AM - 04:45 PM';
      this.heroPeriodLabel.textContent = 'College Opens at 09:10 AM';
      const firstP = evalState.nextPeriod;
      this.heroSubjectTitle.textContent = firstP ? firstP.subjectName || this.getSubjectName(firstP.subjectCode) : 'First Period';
      this.heroFacultyText.textContent = firstP ? (firstP.faculty || this.getFacultyName(firstP.subjectCode)) : 'Faculty';
      this.heroCountdownLabel.textContent = 'Countdown to College Start';
      this.heroCountdownDigits.textContent = evalState.countdownText;
      this.heroProgressFill.style.width = '0%';
      this.heroNextPeriodHint.innerHTML = `<span>Starts At:</span> <strong>09:10 AM (${firstP ? firstP.label : 'Period 1'})</strong>`;
    } else if (evalState.state === 'AFTER_COLLEGE') {
      this.heroCurrentPeriodCard.classList.remove('pulse-glow');
      this.heroLiveTag.textContent = 'ENDED';
      this.heroLiveIndicator.style.background = 'rgba(100, 116, 139, 0.2)';
      this.heroLiveIndicator.style.color = 'var(--text-muted)';
      this.heroLiveIndicator.style.borderColor = 'var(--border-glass)';
      this.heroPeriodTiming.textContent = 'College Hours Concluded';
      this.heroPeriodLabel.textContent = 'Class Hours: 09:10 AM - 04:45 PM';
      this.heroSubjectTitle.textContent = "Today's College Hours Have Ended";
      this.heroFacultyName.style.display = 'none';
      this.heroCountdownLabel.textContent = 'Daily Status';
      this.heroCountdownDigits.textContent = 'COMPLETED';
      this.heroProgressFill.style.width = '100%';
      this.heroNextPeriodHint.innerHTML = `<span>Schedule:</span> <strong>All 8 periods concluded at 04:45 PM</strong>`;
    } else {
      // ACTIVE_PERIOD or ACTIVE_BREAK
      this.heroCurrentPeriodCard.classList.add('pulse-glow');
      const cur = evalState.currentPeriod;
      const isBreak = cur.type === 'break' || cur.type === 'lunch';

      this.heroLiveTag.textContent = isBreak ? 'RECESS' : 'LIVE NOW';
      this.heroLiveIndicator.style.background = 'rgba(56, 189, 248, 0.15)';
      this.heroLiveIndicator.style.color = 'var(--accent-blue)';
      this.heroLiveIndicator.style.borderColor = 'rgba(56, 189, 248, 0.3)';
      this.heroPeriodTiming.textContent = `${cur.startFormatted} - ${cur.endFormatted}`;
      this.heroPeriodLabel.textContent = cur.label;
      this.heroSubjectTitle.textContent = isBreak ? (cur.subjectName || cur.label) : this.getSubjectName(cur.subjectCode);
      this.heroFacultyText.textContent = isBreak ? 'Relaxation & Refreshment' : this.getFacultyName(cur.subjectCode);
      this.heroCountdownLabel.textContent = isBreak ? 'Break Ends In' : 'Period Remaining';
      this.heroCountdownDigits.textContent = evalState.countdownText;
      this.heroProgressFill.style.width = `${evalState.progressPercent.toFixed(1)}%`;

      const next = evalState.nextPeriod;
      if (next) {
        const nextSub = next.type === 'break' || next.type === 'lunch'
          ? (next.subjectName || next.label)
          : this.getSubjectName(next.subjectCode);
        this.heroNextPeriodHint.innerHTML = `<span>Up Next:</span> <strong>${nextSub} (${next.startFormatted})</strong>`;
      } else {
        this.heroNextPeriodHint.innerHTML = `<span>Up Next:</span> <strong>End of College Day (04:45 PM)</strong>`;
      }
    }
  }

  renderScheduleTimeline(evalState, dayDetails, isViewingToday) {
    // Header
    this.scheduleHeaderTitle.textContent = isViewingToday ? "Today's Class Schedule" : "Scheduled Day Timetable";
    if (dayDetails.dayOrder) {
      this.scheduleHeaderBadge.textContent = `Day Order ${this.dayOrderEngine.toRoman(dayDetails.dayOrder)}`;
      this.scheduleHeaderBadge.style.display = 'inline-flex';
    } else {
      this.scheduleHeaderBadge.style.display = 'none';
    }

    const periods = evalState.periodsWithStatus || [];
    if (periods.length === 0) {
      this.periodsList.innerHTML = `
        <div class="glass-card" style="text-align: center; padding: 2.5rem 1.5rem;">
          <h3 style="font-size: 1.3rem; margin-bottom: 0.5rem; color: var(--accent-gold);">${dayDetails.title || 'College Holiday'}</h3>
          <p style="color: var(--text-secondary); max-width: 450px; margin: 0 auto;">
            ${dayDetails.holidayReason || dayDetails.subtitle || 'No instructional classes scheduled for this date according to the academic planner.'}
          </p>
        </div>
      `;
      return;
    }

    let html = '';
    for (const p of periods) {
      const isBreak = p.type === 'break' || p.type === 'lunch';
      const status = isViewingToday ? p.status : 'scheduled';
      const stateClass = `state-${status}`;
      const typeClass = isBreak ? `type-${p.type}` : '';

      const subName = isBreak ? (p.subjectName || p.label) : this.getSubjectName(p.subjectCode);
      const subFaculty = isBreak ? '-' : this.getFacultyName(p.subjectCode);
      const subCodeTag = p.subjectCode ? `<span class="subject-code-tag">${p.subjectCode}</span>` : '';
      const roomTag = p.room ? `<span>📍 ${p.room}</span>` : '';

      let badgeHtml = '';
      if (isViewingToday) {
        if (status === 'completed') {
          badgeHtml = `<span class="status-badge completed">✓ Completed</span>`;
        } else if (status === 'current') {
          badgeHtml = `<span class="status-badge current"><span class="status-dot"></span> LIVE NOW</span>`;
        } else {
          badgeHtml = `<span class="status-badge upcoming">Starts ${p.startFormatted}</span>`;
        }
      } else {
        badgeHtml = `<span class="status-badge upcoming">${p.startFormatted} - ${p.endFormatted}</span>`;
      }

      html += `
        <div class="period-card ${stateClass} ${typeClass}">
          <div class="period-time-col">
            <span class="period-badge">${p.label}</span>
            <span class="period-time-text">${p.startFormatted} - ${p.endFormatted}</span>
          </div>

          <div class="period-details-col">
            <div class="period-subject-title">
              <span>${subName}</span>
              ${subCodeTag}
            </div>
            <div class="period-sub-meta">
              ${!isBreak ? `<span>👤 ${subFaculty}</span>` : ''}
              ${roomTag}
              ${p.type === 'lab' ? `<span style="color: var(--accent-blue); font-weight: 600;">[Laboratory Session]</span>` : ''}
              ${p.type === 'practical' ? `<span style="color: var(--accent-purple); font-weight: 600;">[Practical Drawing]</span>` : ''}
            </div>
          </div>

          <div class="period-status-col">
            ${badgeHtml}
          </div>
        </div>
      `;
    }

    this.periodsList.innerHTML = html;
  }

  // =========================================================================
  // Academic Calendar Rendering:
  // 1. Official College Planner Sheet (Matches PDF layout)
  // 2. Monthly Calendar Grid (Strict 7-column layout with perfect alignment)
  // =========================================================================
  renderCalendar() {
    if (this.calendarViewMode === 'sheet') {
      this.plannerSheetContainer.style.display = 'grid';
      this.monthlyGridContainer.style.display = 'none';
      this.monthFilterContainer.style.display = 'flex';
      this.renderPlannerSheet();
    } else {
      this.plannerSheetContainer.style.display = 'none';
      this.monthlyGridContainer.style.display = 'flex';
      this.monthFilterContainer.style.display = 'none';
      this.renderMonthlyGrid();
    }
  }

  /**
   * Official College Academic Planner Sheet (Matches PDF format)
   * 4 Month Columns: SEP'26, OCT'26, NOV'26, DEC'26 with Day Order, Working Days, Events
   */
  renderPlannerSheet() {
    const monthConfigs = [
      { monthIndex: 8, name: "SEP'26", days: 30, workingDays: 13, cumulative: 13 },
      { monthIndex: 9, name: "OCT'26", days: 31, workingDays: 22, cumulative: 35 },
      { monthIndex: 10, name: "NOV'26", days: 30, workingDays: 20, cumulative: 55 },
      { monthIndex: 11, name: "DEC'26", days: 31, workingDays: 15, cumulative: 70 }
    ];

    const dowNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    let html = '';

    const displayedMonths = this.plannerMonthFilter === 'all'
      ? monthConfigs
      : monthConfigs.filter(m => String(m.monthIndex) === String(this.plannerMonthFilter));

    for (const mConfig of displayedMonths) {
      let rowsHtml = '';

      for (let d = 1; d <= mConfig.days; d++) {
        const dStr = `2026-${String(mConfig.monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayInfo = this.dayOrderEngine.getDayDetails(dStr);
        const dayDate = new Date(`${dStr}T00:00:00`);
        const dow = dowNames[dayDate.getDay()];

        const isToday = (dStr === this.todayDateStr);
        const isSelected = (dStr === this.selectedDateStr);

        // Class determination matching the PDF
        let rowClass = 'planner-row';
        if (isToday) rowClass += ' row-today';
        if (isSelected) rowClass += ' row-selected';

        if (dayInfo.status === 'holiday' || dayInfo.status === 'sunday' || dayInfo.status === 'leave') {
          rowClass += ' row-holiday';
        } else if (dayInfo.eventName && (dayInfo.eventName.includes('CIA Test') || dayInfo.eventName.includes('Children\'s Day'))) {
          rowClass += ' row-cia';
        } else if (dayInfo.eventName && (
          dayInfo.eventName.includes('First Year Classes Commence') ||
          dayInfo.eventName.includes('Induction') ||
          dayInfo.eventName.includes('Syllabus Completion') ||
          dayInfo.eventName.includes('Examinations')
        )) {
          rowClass += ' row-special';
        }

        const doText = dayInfo.dayOrder ? this.dayOrderEngine.toRoman(dayInfo.dayOrder) : '-';
        const wdText = dayInfo.workingDayNumber ? dayInfo.workingDayNumber : '-';

        let remarks = dayInfo.holidayReason || dayInfo.eventName || '';
        if (!remarks && dayInfo.status === 'sunday') remarks = 'Holiday';

        rowsHtml += `
          <div class="${rowClass}" data-date="${dStr}" title="Click to view timetable for ${dStr}">
            <div class="p-date-col">
              <span class="p-date-num">${d}</span>
              <span class="p-day-dow">${dow}</span>
            </div>
            <div class="p-event-text" title="${remarks}">${remarks}</div>
            <div class="p-do-badge">${doText}</div>
            <div class="p-wd-badge">${wdText}</div>
          </div>
        `;
      }

      html += `
        <div class="planner-month-card">
          <div class="planner-month-header">
            <div class="planner-month-title">${mConfig.name}</div>
            <div class="planner-col-headers">
              <div>Day</div>
              <div>Schedule / Remarks</div>
              <div>D.O</div>
              <div>W.D</div>
            </div>
          </div>
          <div class="planner-rows-list">
            ${rowsHtml}
          </div>
          <div class="planner-month-footer">
            <span>No. of Working Days: ${mConfig.workingDays}</span>
            <span>Total: ${mConfig.cumulative}</span>
          </div>
        </div>
      `;
    }

    this.plannerSheetContainer.innerHTML = html;

    // Attach click listeners to rows
    this.plannerSheetContainer.querySelectorAll('.planner-row').forEach(row => {
      row.addEventListener('click', () => {
        const d = row.getAttribute('data-date');
        this.selectDate(d);
      });
    });
  }

  /**
   * Fixed Monthly Calendar Grid (Strict 7 equal columns with minmax(0, 1fr) and matching gaps)
   */
  renderMonthlyGrid() {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    this.currentMonthLabel.textContent = `${monthNames[this.calendarMonth]} ${this.calendarYear}`;

    // Reliable calculation of first day of month (0 = Sun, 1 = Mon, 2 = Tue, etc.)
    const firstDayDate = new Date(`${this.calendarYear}-${String(this.calendarMonth + 1).padStart(2, '0')}-01T00:00:00`);
    const firstDayIndex = firstDayDate.getDay(); 
    const totalDays = new Date(this.calendarYear, this.calendarMonth + 1, 0).getDate();

    let gridHtml = '';

    // Empty cells before 1st (perfect placeholder cells)
    for (let i = 0; i < firstDayIndex; i++) {
      gridHtml += `<div class="cal-day-cell empty"></div>`;
    }

    // Days 1 to totalDays
    for (let d = 1; d <= totalDays; d++) {
      const dStr = `${this.calendarYear}-${String(this.calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayInfo = this.dayOrderEngine.getDayDetails(dStr);

      const isToday = (dStr === this.todayDateStr);
      const isSelected = (dStr === this.selectedDateStr && this.previewDayOrder === null);
      
      let classes = ['cal-day-cell'];
      if (isToday) classes.push('today');
      if (isSelected) classes.push('selected');
      if (dayInfo.isHoliday) classes.push('holiday');
      if (dayInfo.status === 'exam') classes.push('exam');

      let doBadgeHtml = '';
      if (dayInfo.dayOrder) {
        doBadgeHtml = `<span class="cal-day-order-badge">Day ${this.dayOrderEngine.toRoman(dayInfo.dayOrder)}</span>`;
      } else if (dayInfo.status === 'holiday' || dayInfo.status === 'sunday' || dayInfo.status === 'leave') {
        doBadgeHtml = `<span class="cal-day-order-badge" style="background: rgba(244, 63, 94, 0.2); color: var(--accent-rose);">Holiday</span>`;
      } else if (dayInfo.status === 'exam') {
        doBadgeHtml = `<span class="cal-day-order-badge" style="background: rgba(251, 191, 36, 0.2); color: var(--accent-gold);">Exam</span>`;
      }

      let eventTagHtml = '';
      if (dayInfo.holidayReason) {
        eventTagHtml = `<div class="cal-event-tag" style="color: var(--accent-rose);">${dayInfo.holidayReason.replace(' - Holiday', '')}</div>`;
      } else if (dayInfo.eventName) {
        eventTagHtml = `<div class="cal-event-tag">${dayInfo.eventName}</div>`;
      }

      gridHtml += `
        <div class="${classes.join(' ')}" data-date="${dStr}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <span class="cal-date-number">${d}</span>
            ${doBadgeHtml}
          </div>
          ${eventTagHtml}
        </div>
      `;
    }

    this.calendarDaysGrid.innerHTML = gridHtml;

    // Attach click event to day cells
    this.calendarDaysGrid.querySelectorAll('.cal-day-cell:not(.empty)').forEach(cell => {
      cell.addEventListener('click', () => {
        const dateClicked = cell.getAttribute('data-date');
        this.selectDate(dateClicked);
      });
    });
  }

  selectDate(dateStr) {
    this.selectedDateStr = dateStr;
    this.previewDayOrder = null;
    this.resetDoButtonActiveState();

    // Switch to schedule view to view selected date timetable
    this.switchView('schedule');
    this.evaluateAndRenderLiveState();
  }

  getSubjectName(code) {
    if (!code) return 'General Session';
    const s = this.subjects[code];
    return s ? s.name : code;
  }

  getFacultyName(code) {
    if (!code) return '-';
    const s = this.subjects[code];
    return s ? s.faculty : '-';
  }

  setupEventListeners() {
    // 1. Primary View Switching
    this.tabScheduleBtn.addEventListener('click', () => this.switchView('schedule'));
    this.tabCalendarBtn.addEventListener('click', () => this.switchView('calendar'));

    // 2. Jump to Today
    this.jumpTodayBtn.addEventListener('click', () => {
      this.selectedDateStr = this.todayDateStr;
      this.previewDayOrder = null;
      this.resetDoButtonActiveState();
      this.switchView('schedule');
      this.evaluateAndRenderLiveState();
    });

    // 3. Quick Day Order Buttons (Day 1 - 5 preview)
    this.doButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const day = parseInt(btn.getAttribute('data-day'), 10);
        this.previewDayOrder = day;
        this.resetDoButtonActiveState();
        btn.classList.add('active');
        this.switchView('schedule');
        this.evaluateAndRenderLiveState();
      });
    });

    // 4. Calendar View Mode Toggle (Sheet vs Grid)
    this.btnPlannerSheetView.addEventListener('click', () => {
      this.calendarViewMode = 'sheet';
      this.btnPlannerSheetView.classList.add('active');
      this.btnMonthlyGridView.classList.remove('active');
      this.renderCalendar();
    });

    this.btnMonthlyGridView.addEventListener('click', () => {
      this.calendarViewMode = 'grid';
      this.btnMonthlyGridView.classList.add('active');
      this.btnPlannerSheetView.classList.remove('active');
      this.renderCalendar();
    });

    // 5. Month Filter Pills for Planner Sheet
    this.monthFilterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.monthFilterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.plannerMonthFilter = btn.getAttribute('data-filter');
        this.renderCalendar();
      });
    });

    // 6. Monthly Grid Month Navigation
    this.prevMonthBtn.addEventListener('click', () => {
      this.calendarMonth--;
      if (this.calendarMonth < 8) { // Bound to Sep 2026
        this.calendarMonth = 8;
      }
      this.renderCalendar();
    });

    this.nextMonthBtn.addEventListener('click', () => {
      this.calendarMonth++;
      if (this.calendarMonth > 11) { // Bound to Dec 2026
        this.calendarMonth = 11;
      }
      this.renderCalendar();
    });

    // 7. Theme Toggle
    this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());

    // 8. Sound Toggle
    this.soundToggleBtn.addEventListener('click', () => {
      this.soundEnabled = !this.soundEnabled;
      localStorage.setItem('college_sound_enabled', this.soundEnabled);
      this.updateSoundButtonUI();
      if (this.soundEnabled) this.playChime();
    });

    // 9. Supabase Modal
    this.dbStatusBtn.addEventListener('click', () => this.openSupabaseModal());
    this.closeModalBtn.addEventListener('click', () => this.closeSupabaseModal());
    this.saveDbBtn.addEventListener('click', () => this.saveSupabaseConfig());
    this.resetDbBtn.addEventListener('click', () => this.resetToBaseline());

    // Setup lifecycle listeners separately in setupLifecycleListeners()
  }

  setupLifecycleListeners() {
    // 1. Web Standard visibilitychange
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.handleForegroundResume();
      }
    });

    // 2. Window focus & pageshow
    window.addEventListener('focus', () => {
      this.handleForegroundResume();
    });

    window.addEventListener('pageshow', () => {
      this.handleForegroundResume();
    });

    // 3. Capacitor Native App plugin lifecycle
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      window.Capacitor.Plugins.App.addListener('appStateChange', (state) => {
        if (state && state.isActive) {
          this.handleForegroundResume();
        }
      });
      window.Capacitor.Plugins.App.addListener('resume', () => {
        this.handleForegroundResume();
      });
    }
  }

  handleForegroundResume() {
    // 1. Immediately sample fresh IST date and time
    this.todayIST = this.timeEngine.getNowIST();
    this.todayDateStr = this.timeEngine.getDateKey(this.todayIST);

    // 2. Align selectedDateStr if viewing live schedule
    if (this.previewDayOrder === null) {
      this.selectedDateStr = this.todayDateStr;
    }

    // 3. Immediately refresh clock digits
    if (this.heroClockDigits) {
      this.heroClockDigits.textContent = this.timeEngine.formatClockTime(this.todayIST);
    }

    // 4. Immediately recalculate Day Order, period/break/holiday state, countdown, and update UI
    this.evaluateAndRenderLiveState();

    // 5. Update calendar view if visible
    if (this.activeView === 'calendar') {
      this.renderCalendar();
    }
  }

  switchView(viewName) {
    this.activeView = viewName;
    if (viewName === 'schedule') {
      this.tabScheduleBtn.classList.add('active');
      this.tabCalendarBtn.classList.remove('active');
      this.scheduleView.style.display = 'flex';
      this.calendarView.style.display = 'none';
      this.evaluateAndRenderLiveState();
    } else {
      this.tabScheduleBtn.classList.remove('active');
      this.tabCalendarBtn.classList.add('active');
      this.scheduleView.style.display = 'none';
      this.calendarView.style.display = 'flex';
      this.renderCalendar();
    }
  }

  resetDoButtonActiveState() {
    this.doButtons.forEach(b => b.classList.remove('active'));
  }

  initTheme() {
    const savedTheme = localStorage.getItem('college_planner_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeButtonUI(savedTheme);
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('college_planner_theme', nextTheme);
    this.updateThemeButtonUI(nextTheme);
  }

  updateThemeButtonUI(theme) {
    if (theme === 'dark') {
      this.themeIcon.textContent = '🌙';
      this.themeLabel.textContent = 'Dark';
    } else {
      this.themeIcon.textContent = '☀️';
      this.themeLabel.textContent = 'Light';
    }
  }

  updateSoundButtonUI() {
    if (this.soundEnabled) {
      this.soundIcon.textContent = '🔔';
      this.soundLabel.textContent = 'Bell On';
      this.soundToggleBtn.classList.add('btn-active');
    } else {
      this.soundIcon.textContent = '🔕';
      this.soundLabel.textContent = 'Bell Off';
      this.soundToggleBtn.classList.remove('btn-active');
    }
  }

  playChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
      // Audio autoplay policy handled silently
    }
  }

  openSupabaseModal() {
    const { url, anonKey } = this.supabaseService.getCredentials();
    this.sbUrlInput.value = url;
    this.sbKeyInput.value = anonKey;
    this.modalStatusMsg.style.display = 'none';
    this.supabaseModal.classList.add('open');
  }

  closeSupabaseModal() {
    this.supabaseModal.classList.remove('open');
  }

  async saveSupabaseConfig() {
    const url = this.sbUrlInput.value.trim();
    const key = this.sbKeyInput.value.trim();

    if (!url || !key) {
      this.modalStatusMsg.style.display = 'block';
      this.modalStatusMsg.style.color = 'var(--accent-rose)';
      this.modalStatusMsg.textContent = 'Please provide both Project URL and Anon Key.';
      return;
    }

    this.modalStatusMsg.style.display = 'block';
    this.modalStatusMsg.style.color = 'var(--accent-blue)';
    this.modalStatusMsg.textContent = 'Testing connection to Supabase...';

    this.supabaseService.setCredentials(url, key);
    await this.syncDatabaseData();

    if (this.supabaseService.connectionState.status === 'connected') {
      this.modalStatusMsg.style.color = 'var(--accent-emerald)';
      this.modalStatusMsg.textContent = 'Connected successfully! Synchronized college data.';
      setTimeout(() => {
        this.closeSupabaseModal();
        this.render();
      }, 1000);
    } else {
      this.modalStatusMsg.style.color = 'var(--accent-rose)';
      this.modalStatusMsg.textContent = 'Connection test failed or tables not seeded yet. Schema & seed scripts are in /sql folder.';
    }
  }

  async resetToBaseline() {
    this.supabaseService.setCredentials('', '');
    await this.syncDatabaseData();
    this.modalStatusMsg.style.display = 'block';
    this.modalStatusMsg.style.color = 'var(--accent-emerald)';
    this.modalStatusMsg.textContent = 'Switched to verified local baseline.';
    setTimeout(() => {
      this.closeSupabaseModal();
      this.render();
    }, 800);
  }

  render() {
    this.evaluateAndRenderLiveState();
    if (this.activeView === 'calendar') {
      this.renderCalendar();
    }
  }
}

// Instantiate and start app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initIntro();
  const app = new CollegeTimetableApp();
  app.init();
});
