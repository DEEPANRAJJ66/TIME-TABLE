// Supabase Database Integration Client
// Provides remote real-time data sync with resilient offline fallback and local storage caching

import { appSettingsData, subjectsData, dayOrderTimetables } from '../data/timetableData.js';
import { academicCalendarData, calendarDictionary } from '../data/calendarData.js';

let _sharedClient = null;

/**
 * Returns a shared singleton Supabase client instance across the application.
 * Reuses validated configuration from localStorage or institutional environment defaults.
 */
export function getSharedSupabaseClient(customUrl = null, customKey = null) {
  if (_sharedClient && !customUrl && !customKey) {
    return _sharedClient;
  }

  const url = customUrl || (typeof window !== 'undefined' && localStorage.getItem('college_planner_supabase_url')) || 'https://uryiomifyhcbvzeafizi.supabase.co';
  const anonKey = customKey || (typeof window !== 'undefined' && localStorage.getItem('college_planner_supabase_key')) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyeWlvbWlmeWhjYnZ6ZWFmaXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NjM3NTYsImV4cCI6MjEwNTEzOTc1Nn0.aJqNd28FiMf_KdKqWOELlW0pAgxFjp7yxt0nOIyTSsQ';

  if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      _sharedClient = window.supabase.createClient(url.trim(), anonKey.trim(), {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined
        }
      });
      return _sharedClient;
    } catch (err) {
      console.warn('Failed to initialize shared Supabase client:', err);
    }
  }
  return null;
}

export class SupabaseSyncService {
  constructor() {
    this.storageKeys = {
      url: 'college_planner_supabase_url',
      anonKey: 'college_planner_supabase_key',
      cachedSettings: 'college_cache_settings',
      cachedSubjects: 'college_cache_subjects',
      cachedPeriods: 'college_cache_periods',
      cachedCalendar: 'college_cache_calendar',
      lastSync: 'college_cache_last_sync'
    };

    this.client = null;
    this.connectionState = {
      connected: false,
      status: 'offline', // 'connected' | 'cached' | 'baseline' | 'error'
      message: 'Using Verified Local Data',
      source: 'baseline',
      lastSyncTime: null
    };

    this.initClient();
  }

  getCredentials() {
    return {
      url: localStorage.getItem(this.storageKeys.url) || 'https://uryiomifyhcbvzeafizi.supabase.co',
      anonKey: localStorage.getItem(this.storageKeys.anonKey) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyeWlvbWlmeWhjYnZ6ZWFmaXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NjM3NTYsImV4cCI6MjEwNTEzOTc1Nn0.aJqNd28FiMf_KdKqWOELlW0pAgxFjp7yxt0nOIyTSsQ'
    };
  }

  setCredentials(url, anonKey) {
    if (url && anonKey) {
      localStorage.setItem(this.storageKeys.url, url.trim());
      localStorage.setItem(this.storageKeys.anonKey, anonKey.trim());
    } else {
      localStorage.removeItem(this.storageKeys.url);
      localStorage.removeItem(this.storageKeys.anonKey);
    }
    _sharedClient = null; // Invalidate cached singleton to re-instantiate
    this.initClient();
  }

  initClient() {
    const { url, anonKey } = this.getCredentials();
    this.client = getSharedSupabaseClient(url, anonKey);
    if (this.client) {
      this.connectionState.status = 'configured';
      return true;
    }
    return false;
  }

  /**
   * Fetches data with 3-tier resilience:
   * Tier 1: Supabase remote cloud database (live)
   * Tier 2: Previously cached Supabase response from localStorage
   * Tier 3: Verified baseline college data (Screenshot & Academic Planner PDF)
   */
  async loadAllData() {
    // 1. Try remote Supabase if client is ready
    if (this.client) {
      try {
        const [settingsRes, subjectsRes, periodsRes, calendarRes] = await Promise.all([
          this.client.from('app_settings').select('*').limit(1),
          this.client.from('subjects').select('*'),
          this.client.from('timetable_periods').select('*').order('day_order').order('period_number'),
          this.client.from('academic_calendar').select('*').order('calendar_date')
        ]);

        if (!calendarRes.error && !periodsRes.error) {
          const settings = (settingsRes.data && settingsRes.data[0]) || appSettingsData;
          const subjects = this.processSubjects(subjectsRes.data);
          const timetables = this.processPeriods(periodsRes.data, subjects);
          const calendarDict = this.processCalendar(calendarRes.data);

          // Save to local cache
          localStorage.setItem(this.storageKeys.cachedSettings, JSON.stringify(settings));
          localStorage.setItem(this.storageKeys.cachedSubjects, JSON.stringify(subjects));
          localStorage.setItem(this.storageKeys.cachedPeriods, JSON.stringify(timetables));
          localStorage.setItem(this.storageKeys.cachedCalendar, JSON.stringify(calendarDict));
          const nowStr = new Date().toLocaleTimeString();
          localStorage.setItem(this.storageKeys.lastSync, nowStr);

          this.connectionState = {
            connected: true,
            status: 'connected',
            message: 'Connected to Supabase Remote Database',
            source: 'supabase',
            lastSyncTime: nowStr
          };

          return {
            success: true,
            source: 'supabase',
            settings,
            subjects,
            timetables,
            calendarDict
          };
        } else {
          console.warn('Supabase query returned error, falling back to cache:', calendarRes.error || periodsRes.error);
        }
      } catch (networkErr) {
        console.warn('Network exception while reaching Supabase:', networkErr);
      }
    }

    // 2. Try localStorage Cache
    const cachedCal = localStorage.getItem(this.storageKeys.cachedCalendar);
    const cachedTimetables = localStorage.getItem(this.storageKeys.cachedPeriods);
    if (cachedCal && cachedTimetables) {
      try {
        const calendarDict = JSON.parse(cachedCal);
        const timetables = JSON.parse(cachedTimetables);
        const subjects = JSON.parse(localStorage.getItem(this.storageKeys.cachedSubjects) || '{}');
        const settings = JSON.parse(localStorage.getItem(this.storageKeys.cachedSettings) || '{}');
        const lastSync = localStorage.getItem(this.storageKeys.lastSync) || 'Earlier';

        this.connectionState = {
          connected: false,
          status: 'cached',
          message: `Using Cached Data (Last synced at ${lastSync})`,
          source: 'cache',
          lastSyncTime: lastSync
        };

        return {
          success: true,
          source: 'cache',
          settings: { ...appSettingsData, ...settings },
          subjects: { ...subjectsData, ...subjects },
          timetables: { ...dayOrderTimetables, ...timetables },
          calendarDict
        };
      } catch (parseErr) {
        console.warn('Failed to parse cached data:', parseErr);
      }
    }

    // 3. Fallback to Verified Baseline Data from Local Project Files
    this.connectionState = {
      connected: false,
      status: 'baseline',
      message: 'Using Verified Local College Schedule (Offline)',
      source: 'baseline',
      lastSyncTime: null
    };

    return {
      success: true,
      source: 'baseline',
      settings: appSettingsData,
      subjects: subjectsData,
      timetables: dayOrderTimetables,
      calendarDict: calendarDictionary
    };
  }

  processSubjects(rows) {
    if (!rows || rows.length === 0) return subjectsData;
    const map = {};
    for (const r of rows) {
      map[r.subject_code] = {
        code: r.subject_code,
        name: r.subject_name,
        faculty: r.faculty_name,
        department: r.department,
        hours: r.total_hours,
        color: r.color_accent || '#3b82f6',
        isLab: r.is_lab
      };
    }
    return map;
  }

  processPeriods(rows, subjectsMap) {
    if (!rows || rows.length === 0) return dayOrderTimetables;
    const timetables = { 1: [], 2: [], 3: [], 4: [], 5: [] };

    for (const r of rows) {
      const doNum = r.day_order;
      if (!timetables[doNum]) timetables[doNum] = [];

      const sub = subjectsMap[r.subject_id] || (r.subject_id ? subjectsData[r.subject_id] : null);

      timetables[doNum].push({
        period: r.period_number,
        label: r.period_label || (r.period_number > 0 ? `Period ${r.period_number}` : 'Break'),
        start: r.start_time.slice(0, 5),
        end: r.end_time.slice(0, 5),
        subjectCode: r.subject_id,
        subjectName: sub ? sub.name : (r.period_label || 'Special Session'),
        faculty: sub ? sub.faculty : '-',
        room: r.room || 'RV 402',
        type: r.session_type || 'lecture',
        color: sub ? sub.color : '#64748b'
      });
    }

    // Sort periods chronologically
    for (let i = 1; i <= 5; i++) {
      if (timetables[i].length === 0) {
        timetables[i] = dayOrderTimetables[i];
      } else {
        timetables[i].sort((a, b) => a.start.localeCompare(b.start));
      }
    }
    return timetables;
  }

  processCalendar(rows) {
    if (!rows || rows.length === 0) return calendarDictionary;
    const dict = {};
    for (const r of rows) {
      dict[r.calendar_date] = {
        date: r.calendar_date,
        status: r.status,
        day_order: r.day_order,
        working_day_number: r.working_day_number,
        event_name: r.event_name,
        holiday_reason: r.holiday_reason,
        notes: r.notes
      };
    }
    return dict;
  }
}
