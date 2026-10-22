// Production Client Engine: College Learning Platform
// Institution: Saranathan College of Engineering (Autonomous)
// Supports Google-only Auth, 4-tier Role Dashboards, Drive Streaming, & Telegram Audits

import { getSharedSupabaseClient } from './supabaseClient.js';

// State Container
const state = {
  currentUser: null,
  session: null,
  activeTab: 'overview',
  subjects: [],
  resources: [],
  assignments: [],
  submissions: [],
  notices: [],
  notifications: [],
  users: [],
  moderationRecords: [],
  banRestrictions: [],
  banRequests: [],
  auditLogs: [],
  supabase: null,
  appConfig: null
};

// UI Helper: Toast Notifications
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Modal management
export function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

// Attach close listener to all data-close-modal elements
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-close-modal]');
    if (target) {
      const modalId = target.getAttribute('data-close-modal');
      closeModal(modalId);
    }
  });
}

// IST Clock Display
function startIstClock() {
  const clockEl = document.getElementById('istTimeClock');
  if (!clockEl) return;
  const update = () => {
    const now = new Date();
    const formatted = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(now);
    clockEl.textContent = `${formatted} IST`;
  };
  update();
  setInterval(update, 1000);
}

// ----------------------------------------------------
// STANDARDIZED API CLIENT & RESPONSE HANDLING (Section 5)
// ----------------------------------------------------

export class ApiError extends Error {
  constructor(message, status = 500, code = 'API_ERROR', details = null, endpoint = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.endpoint = endpoint;
  }
}

/**
 * Shared API request utility:
 * - Checks HTTP status before treating response as successful
 * - Safely handles JSON, plain-text, and HTML error pages without crashing (avoids SyntaxError: Unexpected token 'T')
 * - Automatically injects Bearer auth and X-User-Id
 * - Distinguishes 400, 401, 403, 404, 408, 429, 500, 502/503
 * - Supports request timeouts
 */
export async function apiRequest(endpoint, options = {}) {
  const url = endpoint;
  const timeoutMs = options.timeoutMs || 25000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = Object.assign({}, options.headers || {});

  // Inject Bearer token if session exists and not explicitly overridden
  if (!headers['Authorization'] && !headers['authorization']) {
    let token = state.session?.access_token;
    if (!token && state.supabase) {
      try {
        const sessRes = await state.supabase.auth.getSession();
        if (sessRes?.data?.session?.access_token) {
          state.session = sessRes.data.session;
          token = state.session.access_token;
        }
      } catch (_) {}
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Inject current user ID for backend authorization mapping
  if (!headers['X-User-Id'] && state.currentUser?.id) {
    headers['X-User-Id'] = state.currentUser.id;
  }

  // Set Content-Type: application/json if sending a string body and not raw buffer/FormData
  const isBinaryOrFormData = options.body instanceof FormData ||
                             (typeof Blob !== 'undefined' && options.body instanceof Blob) ||
                             (typeof ArrayBuffer !== 'undefined' && (options.body instanceof ArrayBuffer || ArrayBuffer.isView(options.body)));

  if (!isBinaryOrFormData && options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const fetchOptions = {
      ...options,
      headers: {
        Accept: 'application/json',
        ...headers
      },
      signal: options.signal || controller.signal
    };

    let res;
    try {
      res = await fetch(url, fetchOptions);
    } catch (networkErr) {
      if (networkErr.name === 'AbortError') {
        throw new ApiError(`Request to ${endpoint} timed out. Please check your connection.`, 408, 'TIMEOUT', null, endpoint);
      }
      throw new ApiError(`Network request failed: ${networkErr.message}`, 0, 'NETWORK_ERROR', null, endpoint);
    }

    const contentType = (res.headers && res.headers.get('content-type')) || '';
    let parsedData = null;
    let rawText = '';

    // Safely extract text first to avoid unhandled stream reading issues
    try {
      rawText = await res.text();
    } catch (readErr) {
      console.warn(`Could not read response body from ${endpoint}:`, readErr);
    }

    // Try parsing JSON if content-type indicates JSON or if body resembles JSON
    if (rawText && rawText.trim()) {
      const trimmed = rawText.trim();
      const isJsonContentType = contentType.toLowerCase().includes('application/json');
      const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');

      if (isJsonContentType || looksLikeJson) {
        try {
          parsedData = JSON.parse(trimmed);
        } catch (_) {
          // If response status was OK but JSON was corrupted
          if (res.ok) {
            throw new ApiError(
              `Expected a valid JSON API response but received malformed data (HTTP ${res.status})`,
              res.status,
              'INVALID_JSON',
              null,
              endpoint
            );
          }
        }
      }
    }

    // Check HTTP status before treating as successful
    if (!res.ok) {
      let message = '';
      let code = 'ERROR';
      if (res.status === 400) code = 'BAD_REQUEST';
      else if (res.status === 401) code = 'UNAUTHORIZED';
      else if (res.status === 403) code = 'FORBIDDEN';
      else if (res.status === 404) code = 'NOT_FOUND';
      else if (res.status === 408) code = 'TIMEOUT';
      else if (res.status === 429) code = 'RATE_LIMITED';
      else if (res.status >= 500) code = 'INTERNAL_ERROR';

      if (parsedData && typeof parsedData === 'object' && (parsedData.error || parsedData.message)) {
        message = parsedData.error || parsedData.message;
        code = parsedData.code || code;
      } else if (rawText && rawText.length < 150 && !rawText.includes('<!DOCTYPE') && !rawText.includes('<html') && !rawText.toLowerCase().includes('the page could not be found')) {
        message = rawText.trim();
      } else {
        switch (res.status) {
          case 400:
            message = 'Invalid request parameters. Please verify your input.';
            code = 'BAD_REQUEST';
            break;
          case 401:
            message = 'Authentication required. Please sign in with your Google college account.';
            code = 'UNAUTHORIZED';
            break;
          case 403:
            message = 'Access forbidden: You do not have permission for this resource.';
            code = 'FORBIDDEN';
            break;
          case 404:
            message = `Service endpoint not found (${endpoint}).`;
            code = 'NOT_FOUND';
            break;
          case 408:
            message = 'Request timed out. Please try again.';
            code = 'TIMEOUT';
            break;
          case 429:
            message = 'Too many requests. Please wait a moment before trying again.';
            code = 'RATE_LIMITED';
            break;
          case 500:
            message = 'Server encountered an unexpected error. Please retry shortly.';
            code = 'INTERNAL_ERROR';
            break;
          case 502:
          case 503:
          case 504:
            message = 'Upstream service temporarily unavailable. Please retry shortly.';
            code = 'GATEWAY_ERROR';
            break;
          default:
            message = `Server error (HTTP ${res.status}): ${res.statusText || 'Unexpected response'}`;
            code = 'SERVER_ERROR';
        }
      }

      throw new ApiError(message, res.status, code, parsedData, endpoint);
    }

    // HTTP 204 No Content
    if (res.status === 204) return { success: true };

    if (parsedData !== null) {
      return parsedData;
    }

    // If body was empty but OK
    if (!rawText || !rawText.trim()) {
      return { success: true };
    }

    return { success: true, text: rawText };
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err.message || 'An unexpected error occurred.', 0, 'UNKNOWN_ERROR', null, endpoint);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Prevents duplicate submissions caused by repeated clicks,
 * provides loading spinner indicator, and safely restores button state.
 */
export async function withButtonLoading(btn, loadingText, action) {
  if (!btn) return await action();
  if (btn.disabled) return; // Prevent double click

  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  if (loadingText) {
    btn.innerHTML = `<span style="display:inline-block; margin-right:6px;">⏳</span> ${loadingText}`;
  }

  try {
    return await action();
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// ----------------------------------------------------
// AUTHENTICATION & SESSION HANDLING
// ----------------------------------------------------

/**
 * Canonical OAuth Redirect URI Builder
 * In production (mobile or desktop browser), guarantees that the redirect URI
 * matches the deployed application's origin and canonical learning route.
 * In local development, keeps http://localhost:${port}/learning intact.
 */
export function getOAuthRedirectUri() {
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Determine origin: In production, prioritize server-validated appOrigin (if configured)
  // or the current browser window.location.origin
  let baseOrigin = window.location.origin;

  if (!isLocalHost) {
    if (state.appConfig?.appOrigin && !state.appConfig.appOrigin.includes('localhost') && !state.appConfig.appOrigin.includes('127.0.0.1')) {
      baseOrigin = state.appConfig.appOrigin;
    } else {
      baseOrigin = window.location.origin;
    }
  } else {
    // Local development: keep localhost
    baseOrigin = window.location.origin;
  }

  // Canonical target route: /learning (or /learning.html if loaded directly)
  let targetPath = window.location.pathname;
  if (!targetPath || targetPath === '/' || targetPath === '/index.html' || targetPath === '/auth/callback') {
    targetPath = '/learning';
  }

  const cleanBase = baseOrigin.replace(/\/+$/, '');
  const cleanPath = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
  return `${cleanBase}${cleanPath}`;
}

async function initAuth() {
  // 1. Process URL query parameters and hash fragments (e.g. from Google OAuth callback)
  const currentUrl = new URL(window.location.href);
  const hashString = window.location.hash ? window.location.hash.substring(1) : '';
  const hashParams = new URLSearchParams(hashString);
  const queryParams = currentUrl.searchParams;

  // Check for OAuth error indications in search or hash
  const oauthError = queryParams.get('error_description') || 
                     queryParams.get('error') || 
                     hashParams.get('error_description') || 
                     hashParams.get('error');

  if (oauthError) {
    showToast(decodeURIComponent(oauthError.replace(/\+/g, ' ')), 'error');
    // Sanitize address bar to remove error parameters
    window.history.replaceState(null, '', window.location.pathname);
  }

  // 2. Fetch server-configured Supabase configuration
  let supabaseUrl = null;
  let supabaseAnonKey = null;
  try {
    const configData = await apiRequest('/api/auth/config');
    state.appConfig = configData;
    supabaseUrl = configData.supabaseUrl;
    supabaseAnonKey = configData.supabaseAnonKey;
  } catch (err) {
    console.warn('Could not contact /api/auth/config:', err.message);
  }

  // 3. Initialize Shared Supabase Client
  state.supabase = getSharedSupabaseClient(supabaseUrl, supabaseAnonKey);

  if (!state.supabase) {
    console.warn('Supabase client could not be initialized.');
    showToast('Authentication service unavailable. Please check connection.', 'error');
    document.getElementById('authScreen').style.display = 'flex';
    return;
  }

  // 4. Listen for real-time auth state events
  state.supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await handleVerifiedSession(session);
    } else if (event === 'SIGNED_OUT') {
      handleSignOutCleanup();
    }
  });

  // 5. Inspect existing active session from client storage
  try {
    const { data, error } = await state.supabase.auth.getSession();
    if (error) {
      console.warn('Failed to retrieve Supabase session:', error);
    }

    // Sanitize address bar if tokens/code are present in hash or query
    if (window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('refresh_token'))) {
      const cleanPath = window.location.pathname === '/auth/callback' ? '/learning' : window.location.pathname;
      window.history.replaceState(null, '', cleanPath);
    }
    if (window.location.search && (window.location.search.includes('code=') || window.location.search.includes('error='))) {
      const cleanPath = window.location.pathname === '/auth/callback' ? '/learning' : window.location.pathname;
      window.history.replaceState(null, '', cleanPath);
    }

    if (data && data.session) {
      await handleVerifiedSession(data.session);
    } else {
      // Clear any stale local user storage when unauthenticated
      handleSignOutCleanup();
    }
  } catch (sessionErr) {
    console.error('Session retrieval error:', sessionErr);
    handleSignOutCleanup();
  }
}

async function handleVerifiedSession(session) {
  if (!session || !session.user) return;
  state.session = session;
  const user = session.user;
  const email = user.email;
  const id = user.id;
  const name = user.user_metadata?.full_name || user.user_metadata?.name || '';
  const token = session.access_token;
  await resolveUserSession(email, id, token, name);
}

function handleSignOutCleanup() {
  localStorage.removeItem('saranathan_user_id');
  localStorage.removeItem('saranathan_user_email');
  state.currentUser = null;
  state.session = null;
  const mainApp = document.getElementById('mainApp');
  if (mainApp) mainApp.style.display = 'none';
  const authScreen = document.getElementById('authScreen');
  if (authScreen) authScreen.style.display = 'flex';
  closeModal('bannedModal');
  closeModal('profileModal');
}

async function performSignOut() {
  try {
    if (state.supabase) {
      await state.supabase.auth.signOut();
    }
  } catch (e) {
    console.warn('Supabase sign out error:', e);
  }
  handleSignOutCleanup();
}

async function resolveUserSession(email, id = null, token = null, name = null) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const body = { email, id };
    if (name) body.name = name;

    const data = await apiRequest('/api/auth/session', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    state.currentUser = data.user;
    localStorage.setItem('saranathan_user_id', data.user.id);
    localStorage.setItem('saranathan_user_email', data.user.email);

    // Hide auth screen
    document.getElementById('authScreen').style.display = 'none';

    // Check account status
    if (data.isBanned) {
      document.getElementById('bannedModal').classList.add('open');
      document.getElementById('banDetailsText').innerHTML = `
        <strong>Account:</strong> ${escapeHtml(data.user.email)} (${data.user.displayName})<br>
        <strong>Status:</strong> BANNED<br>
        Please contact College Administration to appeal this suspension.
      `;
      return;
    }

    // Check if profile setup is required (Rule: Roll number must be set)
    if (data.requiresProfileSetup) {
      const existingFirst = document.getElementById('setupFirstName').value.trim();
      const existingSec = document.getElementById('setupSecName').value.trim();
      const existingRoll = document.getElementById('setupRollNumber').value.trim();

      document.getElementById('setupFirstName').value = existingFirst || data.user.firstName || '';
      document.getElementById('setupSecName').value = existingSec || data.user.secondaryName || '';
      document.getElementById('setupRollNumber').value = existingRoll || data.user.rollNumber || '';
      openModal('profileModal');
      return;
    }

    // Launch Application Dashboard
    launchDashboard();
  } catch (err) {
    console.error('Session resolution error:', err);
    showToast(err.message || 'Failed to connect to authentication server.', 'error');
    document.getElementById('authScreen').style.display = 'flex';
  }
}

// Profile Setup Handler
async function handleSaveProfile() {
  const firstName = document.getElementById('setupFirstName').value.trim();
  const secondaryName = document.getElementById('setupSecName').value.trim();
  const rollNumber = document.getElementById('setupRollNumber').value.trim();

  if (!firstName) {
    return showToast('First Name is mandatory.', 'error');
  }

  if (!/^[0-9]{6}$/.test(rollNumber)) {
    return showToast('Roll number must be exactly 6 numeric digits (e.g. 240101).', 'error');
  }

  const saveBtn = document.getElementById('saveProfileBtn');

  await withButtonLoading(saveBtn, 'Activating Profile...', async () => {
    try {
      let session = null;
      if (state.supabase) {
        const sessionRes = await state.supabase.auth.getSession();
        session = sessionRes?.data?.session;
        if (!session) {
          // Attempt token refresh
          const refreshRes = await state.supabase.auth.refreshSession();
          session = refreshRes?.data?.session;
        }
      }

      if (!session || !session.access_token) {
        showToast('Authentication session expired or missing. Please sign in with Google.', 'error');
        document.getElementById('authScreen').style.display = 'flex';
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      };
      const actorId = state.currentUser?.id || session.user?.id;
      if (actorId) {
        headers['X-User-Id'] = actorId;
      }

      const data = await apiRequest('/api/auth/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({ firstName, secondaryName, rollNumber })
      });

      state.currentUser = data.user;
      if (state.supabase) {
        state.supabase.auth.updateUser({
          data: { firstName, secondaryName, rollNumber }
        }).catch(e => console.warn('Supabase metadata sync notice:', e));
      }

      closeModal('profileModal');
      showToast('Profile activated successfully!', 'success');
      launchDashboard();
    } catch (err) {
      console.error('Error during profile activation:', err);
      if (err.status === 401) {
        showToast(err.message || 'Authentication session expired. Please sign in with Google.', 'error');
        document.getElementById('authScreen').style.display = 'flex';
      } else {
        showToast(err.message || 'Profile activation failed.', 'error');
      }
    }
  });
}

// ----------------------------------------------------
// DASHBOARD LAUNCH & NAVIGATION
// ----------------------------------------------------
function launchDashboard() {
  const user = state.currentUser;
  if (!user) return;

  document.getElementById('mainApp').style.display = 'flex';

  // Update user header / snippet
  document.getElementById('userNameDisplay').textContent = user.displayName;
  document.getElementById('userEmailDisplay').textContent = user.email;
  document.getElementById('userAvatar').textContent = (user.firstName || 'U')[0].toUpperCase();

  const roleBadge = document.getElementById('userRoleBadge');
  roleBadge.textContent = user.role.toUpperCase();
  roleBadge.className = `sidebar-role-badge role-${user.role}`;

  renderNavigation(user.role);
  navigateTab('overview');
}

function renderNavigation(role) {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = '';

  const addItem = (id, label, icon) => {
    const btn = document.createElement('button');
    btn.className = `nav-item ${state.activeTab === id ? 'active' : ''}`;
    btn.innerHTML = `<span class="icon">${icon}</span> <span>${label}</span>`;
    btn.addEventListener('click', () => navigateTab(id));
    nav.appendChild(btn);
  };

  const addHeader = (title) => {
    const h = document.createElement('div');
    h.className = 'nav-section-title';
    h.textContent = title;
    nav.appendChild(h);
  };

  addHeader('Main');
  addItem('overview', 'Dashboard Overview', '📊');
  addItem('subjects', '7 Official Subjects', '📚');
  addItem('assignments', 'Coursework & Deadlines', '📝');
  addItem('notices', 'Global College Notices', '📢');

  if (role === 'admin') {
    addHeader('Administration');
    addItem('users', 'User & Role Directory', '👥');
    addItem('drafts', 'Draft Review Center', '🔍');
    addItem('moderation', 'Moderation & Bans', '⚖️');
    addItem('audit', 'Audit Logs & Integrations', '📜');
  } else if (role === 'representative') {
    addHeader('Class Leadership');
    addItem('users', 'Members Directory', '👥');
    addItem('drafts', 'Draft Review Center', '🔍');
    addItem('moderation', 'Moderation Center', '⚖️');
  } else if (role === 'manager') {
    addHeader('Faculty Workspace');
    addItem('my-materials', 'My Uploaded Files', '📁');
    addItem('submissions', 'Student Submissions', '📥');
    addItem('moderation', 'Student Moderation', '⚖️');
  } else if (role === 'student') {
    addHeader('Student Portal');
    addItem('my-submissions', 'My Submissions & Receipts', '📋');
    addItem('profile', 'My College Profile', '👤');
  }
}

async function navigateTab(tabId) {
  state.activeTab = tabId;
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));

  // Update title
  const titleMap = {
    'overview': 'Dashboard Overview',
    'subjects': 'First-Year CSE Subject Library',
    'assignments': 'Assignments & Deadlines',
    'notices': 'Global College Notices',
    'users': 'College Members & Role Hierarchy',
    'drafts': 'Draft Review & Publication Workflow',
    'moderation': 'Moderation & Suspension Management',
    'audit': 'System Audit & Activity Logs',
    'my-materials': 'My Subject Teaching Materials',
    'submissions': 'Student Submission Review',
    'my-submissions': 'My Assignment Receipts & Work',
    'profile': 'My Student Enrollment Record'
  };

  document.getElementById('pageTitle').textContent = titleMap[tabId] || 'Platform';

  // Render view
  const content = document.getElementById('pageContent');
  content.innerHTML = '<div style="text-align: center; padding: 50px; color: var(--color-text-muted);">Loading view data...</div>';

  if (tabId === 'overview') await renderOverview(content);
  else if (tabId === 'subjects') await renderSubjectsView(content);
  else if (tabId === 'assignments') await renderAssignmentsView(content);
  else if (tabId === 'notices') await renderNoticesView(content);
  else if (tabId === 'users') await renderUsersView(content);
  else if (tabId === 'drafts') await renderDraftsView(content);
  else if (tabId === 'moderation') await renderModerationView(content);
  else if (tabId === 'audit') await renderAuditView(content);
  else if (tabId === 'my-materials') await renderMyMaterialsView(content);
  else if (tabId === 'submissions') await renderSubmissionsView(content);
  else if (tabId === 'my-submissions') await renderStudentSubmissionsView(content);
  else if (tabId === 'profile') renderProfileView(content);
}

// ----------------------------------------------------
// VIEW: OVERVIEW
// ----------------------------------------------------
async function renderOverview(container) {
  const [subRes, asgnRes, notcRes] = await Promise.all([
    apiRequest('/api/subjects').catch(() => ({ subjects: [] })),
    apiRequest('/api/assignments').catch(() => ({ assignments: [] })),
    apiRequest('/api/notices').catch(() => ({ notices: [] }))
  ]);

  state.subjects = subRes.subjects || [];
  state.assignments = asgnRes.assignments || [];
  state.notices = notcRes.notices || [];

  const totalMaterials = state.subjects.reduce((sum, s) => sum + (s.resourceCount || 0), 0);

  container.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon">📚</div>
        <div>
          <div class="stat-val">7</div>
          <div class="stat-label">Official Subjects</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📁</div>
        <div>
          <div class="stat-val">${totalMaterials}</div>
          <div class="stat-label">Published Materials</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📝</div>
        <div>
          <div class="stat-val">${state.assignments.length}</div>
          <div class="stat-label">Active Assignments</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📢</div>
        <div>
          <div class="stat-val">${state.notices.length}</div>
          <div class="stat-label">College Notices</div>
        </div>
      </div>
    </div>

    <!-- Quick Access Subjects -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">First-Semester Engineering Subjects</div>
        <button class="btn btn-secondary btn-sm" id="viewAllSubjectsBtn">View Full Library →</button>
      </div>
      <div class="card-body">
        <div class="subjects-grid">
          ${state.subjects.map(s => `
            <div class="subject-card" data-subject-id="${s.id}">
              <div>
                <div class="subject-header">
                  <span class="subject-icon">${s.icon}</span>
                  <div>
                    <span class="subject-code">${s.code}</span>
                    <h3 class="subject-title">${escapeHtml(s.name)}</h3>
                  </div>
                </div>
              </div>
              <div class="subject-footer">
                <span>${s.resourceCount || 0} Materials Available</span>
                <span style="font-weight: 600; color: var(--color-primary);">Open Folder →</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Latest Notices -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Latest Announcements</div>
      </div>
      <div class="card-body">
        ${state.notices.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📢</div>
            <div class="empty-title">No notices broadcasted yet</div>
            <div class="empty-desc">Check back later for official college announcements.</div>
          </div>
        ` : state.notices.slice(0, 3).map(n => `
          <div class="notice-card">
            <div style="font-weight: 700; font-size: 1.05rem; margin-bottom: 8px;">${escapeHtml(n.title)}</div>
            <div class="notice-letterhead">${escapeHtml(n.formattedLetterhead || n.message)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('viewAllSubjectsBtn')?.addEventListener('click', () => navigateTab('subjects'));

  container.querySelectorAll('.subject-card').forEach(card => {
    card.addEventListener('click', () => {
      const subId = card.getAttribute('data-subject-id');
      renderSubjectDetail(subId);
    });
  });
}

// ----------------------------------------------------
// VIEW: 7 SUBJECTS & MATERIALS
// ----------------------------------------------------
async function renderSubjectsView(container) {
  const res = await apiRequest('/api/subjects').catch(() => ({ subjects: [] }));
  state.subjects = res.subjects || [];

  const canUpload = ['admin', 'representative', 'manager'].includes(state.currentUser.role);

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
      <div>
        <h2 style="font-size: 1.25rem; font-weight: 700;">Department Subject Repositories</h2>
        <p style="font-size: 0.85rem; color: var(--color-text-muted);">Organized learning materials, notes, lab sheets, and references stored in designated Google Drive folder.</p>
      </div>
      ${canUpload ? `<button id="uploadMaterialBtn" class="btn btn-primary">➕ Upload Study Material</button>` : ''}
    </div>

    <div class="subjects-grid">
      ${state.subjects.map(s => `
        <div class="subject-card" data-subject-id="${s.id}">
          <div>
            <div class="subject-header">
              <span class="subject-icon">${s.icon}</span>
              <div>
                <span class="subject-code">${s.code}</span>
                <h3 class="subject-title">${escapeHtml(s.name)}</h3>
              </div>
            </div>
          </div>
          <div class="subject-footer">
            <span>${s.resourceCount || 0} Published Resources</span>
            <span style="font-weight: 600; color: var(--color-primary);">Browse Subject →</span>
          </div>
        </div>
      `).join('')}
    </div>

    <div id="subjectResourceArea" style="margin-top: var(--space-8);"></div>
  `;

  document.getElementById('uploadMaterialBtn')?.addEventListener('click', () => {
    populateUploadSubjectSelect();
    openModal('uploadModal');
  });

  container.querySelectorAll('.subject-card').forEach(card => {
    card.addEventListener('click', () => {
      const subId = card.getAttribute('data-subject-id');
      renderSubjectDetail(subId);
    });
  });
}

async function renderSubjectDetail(subjectId) {
  const area = document.getElementById('subjectResourceArea');
  if (!area) return;

  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  area.innerHTML = '<div style="padding: 20px; text-align: center;">Fetching study materials from Google Drive...</div>';

  const data = await apiRequest(`/api/resources?subjectId=${subjectId}`).catch(err => {
    showToast(err.message || 'Failed to load materials', 'error');
    return { resources: [] };
  });
  const resources = data.resources || [];

  area.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${subject.icon} ${escapeHtml(subject.name)} (${subject.code}) — Materials</div>
        <button class="btn btn-secondary btn-sm" id="closeDetailBtn">Close Subject</button>
      </div>
      <div class="card-body">
        ${resources.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📂</div>
            <div class="empty-title">No published materials in this subject yet</div>
            <div class="empty-desc">Materials uploaded by managers will appear here once approved.</div>
          </div>
        ` : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Uploader</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${resources.map(r => `
                  <tr>
                    <td><strong>${escapeHtml(r.title)}</strong><br><span style="font-size: 11px; color: var(--color-text-muted);">${escapeHtml(r.filename)}</span></td>
                    <td><span class="badge" style="background: #f1f5f9; color: #334155;">${escapeHtml(r.resourceType)}</span></td>
                    <td>${escapeHtml(r.sectionName || 'Unit 1')}</td>
                    <td>${escapeHtml(r.uploaderName || 'Faculty')}</td>
                    <td><span class="badge badge-${r.publicationStatus}">${escapeHtml(r.publicationStatus)}</span></td>
                    <td>
                      <a href="/api/drive/stream/${r.googleDriveFileId}" target="_blank" class="btn btn-secondary btn-sm" title="View or Download Secure Stream">
                        👁️ Preview / Download
                      </a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;

  document.getElementById('closeDetailBtn')?.addEventListener('click', () => {
    area.innerHTML = '';
  });
}

function populateUploadSubjectSelect() {
  const select = document.getElementById('uploadSubjectSelect');
  if (!select) return;
  select.innerHTML = state.subjects.map(s => `
    <option value="${s.id}">${s.icon} ${escapeHtml(s.name)} (${s.code})</option>
  `).join('');
}

// ----------------------------------------------------
// VIEW: COURSEWORK ASSIGNMENTS & SUBMISSIONS
// ----------------------------------------------------
async function renderAssignmentsView(container) {
  const [asgnRes, subRes] = await Promise.all([
    apiRequest('/api/assignments').catch(() => ({ assignments: [] })),
    apiRequest('/api/subjects').catch(() => ({ subjects: [] }))
  ]);

  state.assignments = asgnRes.assignments || [];
  state.subjects = subRes.subjects || [];

  const canCreate = ['admin', 'representative', 'manager'].includes(state.currentUser.role);

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
      <div>
        <h2 style="font-size: 1.25rem; font-weight: 700;">Coursework Assignments</h2>
        <p style="font-size: 0.85rem; color: var(--color-text-muted);">Deadlines are authoritatively stored and validated against UTC server time.</p>
      </div>
      ${canCreate ? `<button id="createAsgnBtn" class="btn btn-primary">➕ Create Assignment</button>` : ''}
    </div>

    <div class="card">
      <div class="card-body">
        ${state.assignments.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📝</div>
            <div class="empty-title">No assignments posted</div>
            <div class="empty-desc">Faculty and Administrators will post upcoming coursework assignments here.</div>
          </div>
        ` : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Subject</th>
                  <th>Submission Deadline (IST)</th>
                  <th>Submissions</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${state.assignments.map(a => {
                  const subject = state.subjects.find(s => s.id === a.subjectId);
                  const isPast = new Date() > new Date(a.deadlineUtc);
                  return `
                    <tr>
                      <td>
                        <strong>${escapeHtml(a.title)}</strong><br>
                        <span style="font-size: 12px; color: var(--color-text-muted);">${escapeHtml(a.instructions || 'No instructions provided.')}</span>
                      </td>
                      <td>${subject ? `${subject.icon} ${escapeHtml(subject.name)}` : a.subjectId}</td>
                      <td>
                        <strong style="color: ${isPast ? 'var(--color-danger)' : 'var(--color-text-primary)'};">
                          ${escapeHtml(a.deadlineIst || a.deadlineUtc)}
                        </strong>
                        ${isPast ? `<br><span class="badge badge-late">Deadline Passed</span>` : ''}
                      </td>
                      <td>${a.submissionCount || 0} submitted</td>
                      <td>
                        ${state.currentUser.role === 'student' ? `
                          <button class="btn btn-primary btn-sm submit-work-btn" data-asgn-id="${a.id}" data-asgn-title="${escapeHtml(a.title)}" data-asgn-deadline="${escapeHtml(a.deadlineIst || '')}">
                            Submit Work
                          </button>
                        ` : `
                          <button class="btn btn-secondary btn-sm inspect-submissions-btn" data-asgn-id="${a.id}">
                            View Submissions
                          </button>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;

  document.getElementById('createAsgnBtn')?.addEventListener('click', () => {
    const sel = document.getElementById('asgnSubjectSelect');
    if (sel) {
      sel.innerHTML = state.subjects.map(s => `<option value="${s.id}">${s.icon} ${escapeHtml(s.name)}</option>`).join('');
    }
    openModal('assignmentModal');
  });

  container.querySelectorAll('.submit-work-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-asgn-id');
      const title = btn.getAttribute('data-asgn-title');
      const deadline = btn.getAttribute('data-asgn-deadline');
      openSubmissionModal(id, title, deadline);
    });
  });

  container.querySelectorAll('.inspect-submissions-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTab('submissions');
    });
  });
}

function openSubmissionModal(assignmentId, title, deadline) {
  document.getElementById('submitModalTitle').textContent = `Submit Work: ${title}`;
  document.getElementById('submitAsgnDetails').innerHTML = `
    <strong>Assignment:</strong> ${escapeHtml(title)}<br>
    <strong>Deadline:</strong> ${escapeHtml(deadline)}<br>
    <em>Ensure your submission contains required explanations or solutions before confirming.</em>
  `;
  document.getElementById('confirmSubmitBtn').setAttribute('data-target-asgn-id', assignmentId);
  openModal('submitAssignmentModal');
}

// ----------------------------------------------------
// VIEW: GLOBAL COLLEGE NOTICES (Section 16 Letterhead)
// ----------------------------------------------------
async function renderNoticesView(container) {
  const res = await apiRequest('/api/notices').catch(() => ({ notices: [] }));
  state.notices = res.notices || [];

  const canPost = ['admin', 'representative'].includes(state.currentUser.role);

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
      <div>
        <h2 style="font-size: 1.25rem; font-weight: 700;">Official Notices & Circulars</h2>
        <p style="font-size: 0.85rem; color: var(--color-text-muted);">Authoritative broadcasts with server-verified Indian Standard Time (IST) timestamps.</p>
      </div>
      ${canPost ? `<button id="broadcastNoticeBtn" class="btn btn-primary">📢 Post College Notice</button>` : ''}
    </div>

    ${state.notices.length === 0 ? `
      <div class="card">
        <div class="card-body">
          <div class="empty-state">
            <div class="empty-icon">📢</div>
            <div class="empty-title">No college notices published yet</div>
            <div class="empty-desc">Notices issued by Administration will be displayed here in official letterhead format.</div>
          </div>
        </div>
      </div>
    ` : state.notices.map(n => `
      <div class="notice-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-2);">
          <div style="font-weight: 800; font-size: 1.15rem; color: var(--color-nav-bg);">${escapeHtml(n.title)}</div>
          <span class="badge badge-published">Official</span>
        </div>
        <div class="notice-letterhead">${escapeHtml(n.formattedLetterhead || n.message)}</div>
      </div>
    `).join('')}
  `;

  document.getElementById('broadcastNoticeBtn')?.addEventListener('click', () => {
    openModal('noticeModal');
  });
}

// ----------------------------------------------------
// VIEW: USER & ROLE DIRECTORY (Admin & Representative)
// ----------------------------------------------------
async function renderUsersView(container) {
  const data = await apiRequest('/api/users').catch(err => {
    showToast(err.message || 'Failed to load users', 'error');
    return { users: [] };
  });
  state.users = data.users || [];

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
      <div>
        <h2 style="font-size: 1.25rem; font-weight: 700;">Department Members Directory</h2>
        <p style="font-size: 0.85rem; color: var(--color-text-muted);">Role Hierarchy: ADMIN → REPRESENTATIVE → MANAGER → STUDENT. All accounts begin as Student.</p>
      </div>
      <input type="text" id="userSearchInput" class="form-input" placeholder="Search by name, roll number, or email..." style="max-width: 320px;">
    </div>

    <div class="card">
      <div class="card-body">
        <div class="table-wrapper">
          <table class="data-table" id="usersTable">
            <thead>
              <tr>
                <th>Member Name</th>
                <th>Roll No</th>
                <th>Institutional Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${state.users.map(u => `
                <tr>
                  <td><strong>${escapeHtml(u.displayName)}</strong></td>
                  <td><code>${escapeHtml(u.rollNumber || 'PENDING')}</code></td>
                  <td>${escapeHtml(u.email)}</td>
                  <td><span class="sidebar-role-badge role-${u.role}">${escapeHtml(u.role)}</span></td>
                  <td><span class="badge badge-${u.accountStatus}">${escapeHtml(u.accountStatus)}</span></td>
                  <td>
                    ${canManageUser(state.currentUser, u) ? `
                      <button class="btn btn-secondary btn-sm change-role-btn" data-user-id="${u.id}" data-user-name="${escapeHtml(u.displayName)}" data-user-role="${u.role}">
                        Role
                      </button>
                      ${u.accountStatus !== 'banned' ? `
                        <button class="btn btn-danger btn-sm ban-user-btn" data-user-id="${u.id}" data-user-name="${escapeHtml(u.displayName)}" data-user-role="${u.role}">
                          Ban
                        </button>
                      ` : ''}
                    ` : '<span style="font-size: 11px; color: var(--color-text-muted);">Protected</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('.change-role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uid = btn.getAttribute('data-user-id');
      const uname = btn.getAttribute('data-user-name');
      const urole = btn.getAttribute('data-user-role');
      openRoleModal(uid, uname, urole);
    });
  });

  container.querySelectorAll('.ban-user-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uid = btn.getAttribute('data-user-id');
      const uname = btn.getAttribute('data-user-name');
      const urole = btn.getAttribute('data-user-role');
      openBanModal(uid, uname, urole);
    });
  });
}

function canManageUser(actor, target) {
  if (target.role === 'admin') return false; // Admin cannot be altered by normal buttons
  if (actor.id === target.id) return false;
  if (actor.role === 'admin') return true;
  if (actor.role === 'representative' && (target.role === 'manager' || target.role === 'student')) return true;
  return false;
}

function openRoleModal(userId, name, currentRole) {
  document.getElementById('roleTargetInfo').innerHTML = `
    <strong>Target Member:</strong> ${name}<br>
    <strong>Current Role:</strong> ${currentRole.toUpperCase()}
  `;
  const select = document.getElementById('targetRoleSelect');
  select.innerHTML = '';

  if (state.currentUser.role === 'admin') {
    select.innerHTML = `
      <option value="representative">Representative</option>
      <option value="manager">Manager</option>
      <option value="student">Student</option>
    `;
  } else if (state.currentUser.role === 'representative') {
    select.innerHTML = `
      <option value="manager">Manager</option>
      <option value="student">Student</option>
    `;
  }
  document.getElementById('confirmRoleChangeBtn').setAttribute('data-target-user-id', userId);
  openModal('roleModal');
}

function openBanModal(userId, name, currentRole) {
  document.getElementById('banTargetInfo').innerHTML = `
    <strong>Target Account:</strong> ${name} (${currentRole.toUpperCase()})<br>
    <em>A mandatory justification must be provided. An audit notification will be dispatched to the Telegram security channel.</em>
  `;
  document.getElementById('confirmBanBtn').setAttribute('data-target-user-id', userId);
  openModal('banModal');
}

// ----------------------------------------------------
// VIEW: DRAFT REVIEW & PUBLISHING (Admin & Representative)
// ----------------------------------------------------
async function renderDraftsView(container) {
  const data = await apiRequest('/api/resources').catch(err => {
    showToast(err.message || 'Failed to load drafts', 'error');
    return { resources: [] };
  });
  const allResources = data.resources || [];
  const drafts = allResources.filter(r => r.publicationStatus === 'draft');

  container.innerHTML = `
    <div style="margin-bottom: var(--space-4);">
      <h2 style="font-size: 1.25rem; font-weight: 700;">Draft Publication Review Center</h2>
      <p style="font-size: 0.85rem; color: var(--color-text-muted);">Materials uploaded by Managers require review and publication before becoming visible to Students.</p>
    </div>

    <div class="card">
      <div class="card-body">
        ${drafts.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">✅</div>
            <div class="empty-title">All uploaded materials are published</div>
            <div class="empty-desc">No drafts currently awaiting administrative review.</div>
          </div>
        ` : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Subject</th>
                  <th>Uploader</th>
                  <th>Drive File ID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${drafts.map(d => `
                  <tr>
                    <td><strong>${escapeHtml(d.title)}</strong><br><span style="font-size: 11px; color: var(--color-text-muted);">${escapeHtml(d.filename)}</span></td>
                    <td><code>${escapeHtml(d.subjectId)}</code></td>
                    <td>${escapeHtml(d.uploaderName)} (${escapeHtml(d.uploaderRole)})</td>
                    <td><code>${escapeHtml(d.googleDriveFileId)}</code></td>
                    <td style="display: flex; gap: var(--space-2);">
                      <a href="/api/drive/stream/${d.googleDriveFileId}" target="_blank" class="btn btn-secondary btn-sm">Preview</a>
                      <button class="btn btn-primary btn-sm publish-btn" data-res-id="${d.id}">Publish</button>
                      <button class="btn btn-danger btn-sm delete-res-btn" data-res-id="${d.id}">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;

  container.querySelectorAll('.publish-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const resId = btn.getAttribute('data-res-id');
      await updateResourceStatus(resId, 'published');
      renderDraftsView(container);
    });
  });

  container.querySelectorAll('.delete-res-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to permanently delete this resource?')) return;
      const resId = btn.getAttribute('data-res-id');
      await deleteResource(resId);
      renderDraftsView(container);
    });
  });
}

async function updateResourceStatus(resourceId, newStatus) {
  try {
    await apiRequest('/api/resources/status', {
      method: 'POST',
      body: JSON.stringify({ resourceId, newStatus })
    });
    showToast(`Resource status updated to ${newStatus}.`, 'success');
  } catch (err) {
    showToast(err.message || 'Status update failed', 'error');
  }
}

async function deleteResource(resourceId) {
  try {
    await apiRequest(`/api/resources/${resourceId}`, {
      method: 'DELETE'
    });
    showToast('Resource deleted successfully.', 'success');
  } catch (err) {
    showToast(err.message || 'Deletion failed', 'error');
  }
}

// ----------------------------------------------------
// VIEW: MODERATION & 7-DAY RESTRICTION (Section 9)
// ----------------------------------------------------
async function renderModerationView(container) {
  let data = { records: [], requests: [], restrictions: [] };
  try {
    data = await apiRequest('/api/moderation/records');
  } catch (err) {
    showToast(err.message || 'Failed to load moderation records', 'error');
  }
  const records = data.records || [];
  const requests = data.requests || [];
  const restrictions = data.restrictions || [];

  const isAdmin = state.currentUser.role === 'admin';

  container.innerHTML = `
    <div style="margin-bottom: var(--space-4);">
      <h2 style="font-size: 1.25rem; font-weight: 700;">Account Moderation & Suspension Center</h2>
      <p style="font-size: 0.85rem; color: var(--color-text-muted);">
        Rule: ONLY the Administrator can unban an account. When Admin unbans a Student banned by a Manager, a 7-day restriction prevents that Manager from re-banning that Student.
      </p>
    </div>

    <!-- Active 7-Day Restrictions -->
    ${restrictions.length > 0 ? `
      <div class="card" style="border-left: 4px solid var(--color-warning);">
        <div class="card-header">
          <div class="card-title">Active 7-Day Re-Ban Restrictions</div>
        </div>
        <div class="card-body">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Manager</th>
                  <th>Student</th>
                  <th>Expires (IST)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${restrictions.map(r => `
                  <tr>
                    <td><code>${escapeHtml(r.managerId)}</code></td>
                    <td><code>${escapeHtml(r.studentId)}</code></td>
                    <td><strong>${escapeHtml(r.restrictionEndIst)}</strong></td>
                    <td><span class="badge badge-draft">Restriction Enforced</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- Moderation Records Table -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Moderation History & Active Suspensions</div>
      </div>
      <div class="card-body">
        ${records.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🛡️</div>
            <div class="empty-title">No moderation records found</div>
            <div class="empty-desc">All student and faculty accounts are currently in good standing.</div>
          </div>
        ` : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Target Account</th>
                  <th>Banned By</th>
                  <th>Reason</th>
                  <th>Timestamp (IST)</th>
                  <th>Status</th>
                  ${isAdmin ? '<th>Admin Action</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${records.map(r => `
                  <tr>
                    <td><strong>${escapeHtml(r.targetEmail)}</strong><br><span style="font-size: 11px;">ID: ${escapeHtml(r.targetUserId)}</span></td>
                    <td>${escapeHtml(r.actingUserName)} (${escapeHtml(r.actingUserRole)})</td>
                    <td>${escapeHtml(r.reason)}</td>
                    <td>${escapeHtml(r.createdAtIst || r.createdAtUtc)}</td>
                    <td><span class="badge badge-${r.isActive ? 'banned' : 'active'}">${r.isActive ? 'BANNED' : 'LIFTED'}</span></td>
                    ${isAdmin ? `
                      <td>
                        ${r.isActive ? `
                          <button class="btn btn-primary btn-sm unban-btn" data-target-id="${r.targetUserId}">
                            Lift Ban (Admin Only)
                          </button>
                        ` : '<span style="font-size: 11px; color: var(--color-success);">Resolved</span>'}
                      </td>
                    ` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;

  if (isAdmin) {
    container.querySelectorAll('.unban-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetId = btn.getAttribute('data-target-id');
        const notes = prompt('Enter resolution notes for lifting ban:', 'Unbanned after administrative review.');
        if (!notes) return;
        await unbanUser(targetId, notes);
        renderModerationView(container);
      });
    });
  }
}

async function unbanUser(targetUserId, resolutionNotes) {
  try {
    await apiRequest('/api/moderation/unban', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, resolutionNotes })
    });
    showToast('Account unbanned successfully! 7-day restriction initialized if applicable.', 'success');
  } catch (err) {
    showToast(err.message || 'Unban failed', 'error');
  }
}

// ----------------------------------------------------
// VIEW: AUDIT LOGS (Admin)
// ----------------------------------------------------
async function renderAuditView(container) {
  const [auditRes, statusRes] = await Promise.all([
    apiRequest('/api/audit').catch(() => ({ logs: [] })),
    apiRequest('/api/status').catch(() => ({ services: {} }))
  ]);

  const logs = auditRes.logs || [];

  container.innerHTML = `
    <div style="margin-bottom: var(--space-4);">
      <h2 style="font-size: 1.25rem; font-weight: 700;">System Audit Logs & Integration Status</h2>
      <p style="font-size: 0.85rem; color: var(--color-text-muted);">Immutable audit records of administrative, moderation, and storage events.</p>
    </div>

    <!-- Integration Health Card -->
    <div class="card" style="margin-bottom: var(--space-6);">
      <div class="card-header">
        <div class="card-title">External Integration Health</div>
      </div>
      <div class="card-body" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-4);">
        <div style="background: #f8fafc; padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--color-text-muted);">TELEGRAM AUDIT BOT</div>
          <div style="font-size: 1.1rem; font-weight: 800; color: var(--color-success); margin: 4px 0;">
            ${statusRes.services?.telegram || 'CONNECTED'}
          </div>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">
            Bot: @DeepanCollegeLearningBot (8968622105)<br>
            Audit Channel: -1003598863042
          </div>
        </div>
        <div style="background: #f8fafc; padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--color-text-muted);">GOOGLE DRIVE STORAGE</div>
          <div style="font-size: 1.1rem; font-weight: 800; color: var(--color-success); margin: 4px 0;">
            ${statusRes.services?.googleDrive || 'CONFIGURED'}
          </div>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">
            Approved Folder: saranathan cse materials<br>
            Direct Chunked / Resumable OAuth Streaming
          </div>
        </div>
      </div>
    </div>

    <!-- Audit Logs Table -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Recent Event Ledger</div>
      </div>
      <div class="card-body">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Actor</th>
                <th>Target Resource</th>
                <th>Timestamp (UTC)</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td><code>${escapeHtml(l.actionType)}</code></td>
                  <td>${escapeHtml(l.actorName)} (${escapeHtml(l.actorRole)})</td>
                  <td>${escapeHtml(l.targetResourceType)}: <code>${escapeHtml(l.targetResourceId)}</code></td>
                  <td><span style="font-size: 12px;">${escapeHtml(l.createdAt)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// VIEW: MANAGER WORKSPACE (My Materials & Submissions)
// ----------------------------------------------------
async function renderMyMaterialsView(container) {
  const data = await apiRequest('/api/resources').catch(err => {
    showToast(err.message || 'Failed to load materials', 'error');
    return { resources: [] };
  });
  const allResources = data.resources || [];
  const myResources = allResources.filter(r => r.uploaderId === state.currentUser?.id);

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
      <div>
        <h2 style="font-size: 1.25rem; font-weight: 700;">My Uploaded Teaching Materials</h2>
        <p style="font-size: 0.85rem; color: var(--color-text-muted);">Files uploaded to your assigned subjects in the Google Drive storage container.</p>
      </div>
      <button id="managerUploadBtn" class="btn btn-primary">➕ Upload to Assigned Subject</button>
    </div>

    <div class="card">
      <div class="card-body">
        ${myResources.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📁</div>
            <div class="empty-title">You have not uploaded any materials yet</div>
            <div class="empty-desc">Click "Upload to Assigned Subject" to add notes, assignments, or videos.</div>
          </div>
        ` : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Subject</th>
                  <th>Section</th>
                  <th>Publication State</th>
                  <th>Drive ID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${myResources.map(r => `
                  <tr>
                    <td><strong>${escapeHtml(r.title)}</strong><br><span style="font-size: 11px; color: var(--color-text-muted);">${escapeHtml(r.filename)}</span></td>
                    <td><code>${escapeHtml(r.subjectId)}</code></td>
                    <td>${escapeHtml(r.sectionName)}</td>
                    <td><span class="badge badge-${r.publicationStatus}">${escapeHtml(r.publicationStatus)}</span></td>
                    <td><code>${escapeHtml(r.googleDriveFileId)}</code></td>
                    <td>
                      <a href="/api/drive/stream/${r.googleDriveFileId}" target="_blank" class="btn btn-secondary btn-sm">Preview</a>
                      <button class="btn btn-danger btn-sm delete-my-res-btn" data-res-id="${r.id}">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;

  document.getElementById('managerUploadBtn')?.addEventListener('click', () => {
    populateUploadSubjectSelect();
    openModal('uploadModal');
  });

  container.querySelectorAll('.delete-my-res-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete this resource?')) return;
      const resId = btn.getAttribute('data-res-id');
      await deleteResource(resId);
      renderMyMaterialsView(container);
    });
  });
}

// ----------------------------------------------------
// VIEW: SUBMISSIONS REVIEW (Managers & Admins)
// ----------------------------------------------------
async function renderSubmissionsView(container) {
  const data = await apiRequest('/api/submissions').catch(err => {
    showToast(err.message || 'Failed to load submissions', 'error');
    return { submissions: [] };
  });
  const submissions = data.submissions || [];

  container.innerHTML = `
    <div style="margin-bottom: var(--space-4);">
      <h2 style="font-size: 1.25rem; font-weight: 700;">Student Coursework Submissions</h2>
      <p style="font-size: 0.85rem; color: var(--color-text-muted);">Submissions from your assigned subjects with verified receipt codes.</p>
    </div>

    <div class="card">
      <div class="card-body">
        ${submissions.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📥</div>
            <div class="empty-title">No submissions received yet</div>
            <div class="empty-desc">Completed student assignments will appear here for evaluation.</div>
          </div>
        ` : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Roll No</th>
                  <th>Receipt ID</th>
                  <th>Submitted At (IST)</th>
                  <th>Status</th>
                  <th>Answer Content</th>
                </tr>
              </thead>
              <tbody>
                ${submissions.map(s => `
                  <tr>
                    <td><strong>${escapeHtml(s.studentName)}</strong><br><span style="font-size: 11px; color: var(--color-text-muted);">${escapeHtml(s.studentEmail)}</span></td>
                    <td><code>${escapeHtml(s.studentRollNumber || 'N/A')}</code></td>
                    <td><code style="color: var(--color-primary); font-weight: 700;">${escapeHtml(s.receiptId)}</code></td>
                    <td>${escapeHtml(s.submittedAtIst || s.submittedAtUtc)}</td>
                    <td><span class="badge badge-${s.isLate ? 'late' : 'published'}">${s.isLate ? 'LATE' : 'ON TIME'}</span></td>
                    <td>
                      <div style="max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px;">
                        ${escapeHtml(s.answerText || 'File attachments provided')}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// VIEW: STUDENT SUBMISSIONS (Strict IDOR Isolation)
// ----------------------------------------------------
async function renderStudentSubmissionsView(container) {
  const data = await apiRequest('/api/submissions').catch(err => {
    showToast(err.message || 'Failed to load your submissions', 'error');
    return { submissions: [] };
  });
  const mySubmissions = data.submissions || [];

  container.innerHTML = `
    <div style="margin-bottom: var(--space-4);">
      <h2 style="font-size: 1.25rem; font-weight: 700;">My Assignment Submissions & Receipts</h2>
      <p style="font-size: 0.85rem; color: var(--color-text-muted);">Official cryptographic submission receipts confirmed by the server.</p>
    </div>

    <div class="card">
      <div class="card-body">
        ${mySubmissions.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <div class="empty-title">You have not submitted any assignments yet</div>
            <div class="empty-desc">Head to the "Coursework & Deadlines" section to view and submit your work.</div>
          </div>
        ` : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Receipt ID</th>
                  <th>Submitted At (IST)</th>
                  <th>Status</th>
                  <th>My Submission Notes</th>
                </tr>
              </thead>
              <tbody>
                ${mySubmissions.map(s => `
                  <tr>
                    <td><strong style="color: var(--color-primary); font-family: var(--font-family-mono);">${escapeHtml(s.receiptId)}</strong></td>
                    <td>${escapeHtml(s.submittedAtIst || s.submittedAtUtc)}</td>
                    <td><span class="badge badge-${s.isLate ? 'late' : 'published'}">${s.isLate ? 'SUBMITTED LATE' : 'CONFIRMED'}</span></td>
                    <td>
                      <div style="max-width: 300px; font-size: 12px;">
                        ${escapeHtml(s.answerText || 'Submission files recorded.')}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// VIEW: STUDENT PROFILE
// ----------------------------------------------------
function renderProfileView(container) {
  const u = state.currentUser;
  container.innerHTML = `
    <div class="card" style="max-width: 600px;">
      <div class="card-header">
        <div class="card-title">My College Enrollment Profile</div>
      </div>
      <div class="card-body">
        <div style="display: flex; gap: var(--space-5); align-items: center; margin-bottom: var(--space-6);">
          <div class="user-avatar" style="width: 64px; height: 64px; font-size: 1.5rem;">
            ${(u.firstName || 'U')[0].toUpperCase()}
          </div>
          <div>
            <h3 style="font-size: 1.2rem; font-weight: 800;">${escapeHtml(u.displayName)}</h3>
            <div style="font-size: 0.85rem; color: var(--color-text-muted);">${escapeHtml(u.email)}</div>
            <span class="sidebar-role-badge role-${u.role}" style="margin-top: 6px;">${u.role.toUpperCase()}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-4);">
          <div style="background: #f8fafc; padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <div style="font-size: 11px; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase;">Roll Number</div>
            <div style="font-size: 1.1rem; font-weight: 800; font-family: var(--font-family-mono); margin-top: 2px;">
              ${escapeHtml(u.rollNumber || 'PENDING')}
            </div>
          </div>
          <div style="background: #f8fafc; padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <div style="font-size: 11px; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase;">Class & Section</div>
            <div style="font-size: 1.1rem; font-weight: 800; margin-top: 2px;">
              CSE - Class A
            </div>
          </div>
        </div>

        <div style="font-size: 0.8rem; color: var(--color-text-muted); background: #fdfdfd; padding: var(--space-3); border-radius: var(--radius-sm); border: 1px solid #f1f5f9;">
          Institutional Record ID: <code>${escapeHtml(u.id)}</code><br>
          Enrolled: ${escapeHtml(u.createdAt)}
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// EVENT HANDLERS & MODAL ACTIONS
// ----------------------------------------------------
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    startIstClock();
    initAuth();

  // Mobile menu toggle
  document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
    document.getElementById('appSidebar').classList.toggle('open');
  });

  // Google sign in button
  document.getElementById('googleSignInBtn')?.addEventListener('click', async () => {
    if (!state.supabase) {
      state.supabase = getSharedSupabaseClient();
    }

    if (!state.supabase) {
      showToast('Authentication service is currently unavailable. Please refresh and try again.', 'error');
      return;
    }

    const signInBtn = document.getElementById('googleSignInBtn');
    if (signInBtn) {
      signInBtn.disabled = true;
      signInBtn.innerHTML = `
        <span style="display: inline-block; margin-right: 8px;">⏳</span>
        Connecting to Google...
      `;
    }

    try {
      const redirectUri = getOAuthRedirectUri();
      console.log('Initiating Google OAuth with redirectUri:', redirectUri);

      const { data, error } = await state.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account'
          }
        }
      });

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Google OAuth error:', err);
      showToast(err.message || 'Failed to initiate Google sign-in.', 'error');
      if (signInBtn) {
        signInBtn.disabled = false;
        signInBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right: 8px;">
            <path fill="#ffffff" d="M12.24 10.285V13.4h6.887C18.2 16.14 15.645 18 12.24 18c-3.315 0-6-2.685-6-6s2.685-6 6-6c1.65 0 3.015.6 4.05 1.575l2.4-2.4C16.89 3.48 14.73 2.5 12.24 2.5 7.02 2.5 2.76 6.76 2.76 12s4.26 9.5 9.48 9.5c5.445 0 9.06-3.825 9.06-9.225 0-.645-.06-1.275-.18-1.99H12.24z"/>
          </svg>
          Sign in with Google
        `;
      }
    }
  });

  // Save profile button
  document.getElementById('saveProfileBtn')?.addEventListener('click', handleSaveProfile);

  // Logout button
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await performSignOut();
    showToast('Signed out successfully.', 'info');
  });

  document.getElementById('bannedLogoutBtn')?.addEventListener('click', async () => {
    await performSignOut();
    location.reload();
  });

  // Upload Study Material to Google Drive Handler
  document.getElementById('startUploadBtn')?.addEventListener('click', async () => {
    const subjectId = document.getElementById('uploadSubjectSelect').value;
    const sectionName = document.getElementById('uploadSectionInput').value.trim();
    const title = document.getElementById('uploadTitleInput').value.trim();
    const resourceType = document.getElementById('uploadTypeSelect').value;
    const fileInput = document.getElementById('uploadFileInput');

    if (!title || !fileInput.files[0]) {
      return showToast('Title and file are mandatory.', 'error');
    }

    const file = fileInput.files[0];
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.zip'];
    const fileExt = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!allowedExts.includes(fileExt)) {
      return showToast('File type not supported. Allowed: PDF, PNG, JPG/JPEG, DOC/DOCX, ZIP.', 'error');
    }

    if (file.size > 50 * 1024 * 1024) {
      return showToast('File exceeds the 50 MB limit.', 'error');
    }

    const uploadBtn = document.getElementById('startUploadBtn');
    const progContainer = document.getElementById('uploadProgressContainer');
    if (progContainer) progContainer.style.display = 'block';

    await withButtonLoading(uploadBtn, 'Uploading to Drive...', async () => {
      try {
        const formData = new FormData();
        formData.append('file', file, file.name);
        formData.append('subjectId', subjectId);
        formData.append('sectionName', sectionName || 'Unit 1');
        formData.append('title', title);
        formData.append('resourceType', resourceType);
        formData.append('category', resourceType);

        await apiRequest('/api/resources/upload-direct', {
          method: 'POST',
          headers: {
            'X-Subject-Id': subjectId,
            'X-Section-Name': encodeURIComponent(sectionName || 'Unit 1'),
            'X-Resource-Title': encodeURIComponent(title),
            'X-Resource-Type': resourceType,
            'X-Filename': encodeURIComponent(file.name)
          },
          body: formData
        });

        showToast('File successfully uploaded to designated Google Drive folder!', 'success');
        closeModal('uploadModal');
        fileInput.value = '';
        navigateTab(state.activeTab);
      } catch (err) {
        showToast(err.message || 'Drive upload failed', 'error');
      } finally {
        if (progContainer) progContainer.style.display = 'none';
      }
    });
  });

  // Create Assignment Handler
  document.getElementById('saveAssignmentBtn')?.addEventListener('click', async () => {
    const subjectId = document.getElementById('asgnSubjectSelect').value;
    const title = document.getElementById('asgnTitleInput').value.trim();
    const instructions = document.getElementById('asgnInstructionsInput').value.trim();
    const deadlineVal = document.getElementById('asgnDeadlineInput').value;
    const saveBtn = document.getElementById('saveAssignmentBtn');

    if (!title || !deadlineVal) {
      return showToast('Title and deadline are required.', 'error');
    }

    const deadlineUtc = new Date(deadlineVal).toISOString();

    await withButtonLoading(saveBtn, 'Publishing Assignment...', async () => {
      try {
        await apiRequest('/api/assignments', {
          method: 'POST',
          body: JSON.stringify({ subjectId, title, instructions, deadlineUtc })
        });

        showToast('Assignment created and published!', 'success');
        closeModal('assignmentModal');
        navigateTab('assignments');
      } catch (err) {
        showToast(err.message || 'Failed to create assignment', 'error');
      }
    });
  });

  // Confirm Student Submission Handler
  document.getElementById('confirmSubmitBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('confirmSubmitBtn');
    const assignmentId = btn.getAttribute('data-target-asgn-id');
    const answerText = document.getElementById('submissionAnswerInput').value.trim();

    if (!answerText) {
      return showToast('Please enter your answer text or solution notes.', 'error');
    }

    await withButtonLoading(btn, 'Submitting Work...', async () => {
      try {
        const data = await apiRequest('/api/submissions', {
          method: 'POST',
          body: JSON.stringify({ assignmentId, answerText })
        });

        closeModal('submitAssignmentModal');
        alert(`SUBMISSION CONFIRMED!\n\nReceipt Code: ${data.submission.receiptId}\nSubmitted At: ${data.submission.submittedAtIst}\nStatus: ${data.submission.status.toUpperCase()}`);
        navigateTab('my-submissions');
      } catch (err) {
        showToast(err.message || 'Submission failed', 'error');
      }
    });
  });

  // Post Notice Handler (Section 16 Format)
  document.getElementById('postNoticeBtn')?.addEventListener('click', async () => {
    const title = document.getElementById('noticeTitleInput').value.trim();
    const message = document.getElementById('noticeMessageInput').value.trim();
    const btn = document.getElementById('postNoticeBtn');

    if (!title || !message) {
      return showToast('Title and message are mandatory.', 'error');
    }

    await withButtonLoading(btn, 'Broadcasting Notice...', async () => {
      try {
        await apiRequest('/api/notices', {
          method: 'POST',
          body: JSON.stringify({ title, message })
        });

        showToast('Global notice broadcasted to all students and Telegram!', 'success');
        closeModal('noticeModal');
        navigateTab('notices');
      } catch (err) {
        showToast(err.message || 'Failed to post notice', 'error');
      }
    });
  });

  // Confirm Role Transition Handler
  document.getElementById('confirmRoleChangeBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('confirmRoleChangeBtn');
    const targetUserId = btn.getAttribute('data-target-user-id');
    const targetRole = document.getElementById('targetRoleSelect').value;

    await withButtonLoading(btn, 'Updating Role...', async () => {
      try {
        await apiRequest('/api/users/role', {
          method: 'POST',
          body: JSON.stringify({ targetUserId, targetRole })
        });

        showToast('Role updated successfully!', 'success');
        closeModal('roleModal');
        navigateTab('users');
      } catch (err) {
        showToast(err.message || 'Role change denied', 'error');
      }
    });
  });

  // Confirm Account Ban Handler
  document.getElementById('confirmBanBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('confirmBanBtn');
    const targetUserId = btn.getAttribute('data-target-user-id');
    const reason = document.getElementById('banReasonInput').value.trim();

    if (!reason || reason.length < 5) {
      return showToast('Reason must be at least 5 characters.', 'error');
    }

    await withButtonLoading(btn, 'Enforcing Ban...', async () => {
      try {
        await apiRequest('/api/moderation/ban', {
          method: 'POST',
          body: JSON.stringify({ targetUserId, reason })
        });

        showToast('Account ban issued and logged to audit channel.', 'success');
        closeModal('banModal');
        navigateTab(state.activeTab);
      } catch (err) {
        showToast(err.message || 'Ban denied', 'error');
      }
    });
  });

  // Report Bug Modal & Submission (Telegram Dispatch)
  document.getElementById('reportBugBtn')?.addEventListener('click', () => {
    openModal('bugModal');
  });

  document.getElementById('submitBugBtn')?.addEventListener('click', async () => {
    const title = document.getElementById('bugTitleInput').value.trim();
    const category = document.getElementById('bugCategorySelect').value;
    const description = document.getElementById('bugDescInput').value.trim();
    const btn = document.getElementById('submitBugBtn');

    if (!title || !description) {
      return showToast('Title and description are required.', 'error');
    }

    await withButtonLoading(btn, 'Dispatching Bug Report...', async () => {
      try {
        const reportRes = await apiRequest('/api/telegram/bug-report', {
          method: 'POST',
          body: JSON.stringify({
            title,
            category,
            description,
            affectedPage: state.activeTab
          })
        });

        if (reportRes && reportRes.telegramDelivered) {
          showToast('Bug report dispatched directly to administration Telegram channel!', 'success');
        } else {
          showToast(reportRes?.message || 'Bug report recorded in audit ledger for administrative review.', 'info');
        }
        closeModal('bugModal');
        document.getElementById('bugTitleInput').value = '';
        document.getElementById('bugDescInput').value = '';
      } catch (err) {
        showToast(err.message || 'Bug report submission failed', 'error');
      }
    });
  });
});
}
