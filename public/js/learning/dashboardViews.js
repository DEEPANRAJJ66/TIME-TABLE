// Dashboard Views & UI Components for College Learning Resource Platform
// Implements Shared Dashboard Foundation, Role-Aware Views, Moderation Centre, and Notices Board
// Saranathan College of Engineering (Autonomous) - First-Year CSE Class A

import { PermissionService, ROLES, ROLE_LABELS, ROLE_BADGE_CLASSES } from './permissionService.js';
import { getISTDateString, formatStandardNotice, SYSTEM_SUBJECT_FOLDERS } from './learningStore.js';

export class DashboardViews {
  /**
   * 1. SHARED ACADEMIC DASHBOARD / HOME
   * Shared foundation for all roles with role-specific KPI overlays
   */
  static renderDashboardHome(app) {
    const user = app.auth.getCurrentUser();
    const role = app.currentRole;
    const profile = user?.email ? app.store.getStudentProfile(user.email) : null;
    const rollNumber = user?.rollNumber || profile?.rollNumber || 'Not Set';
    const published = app.store.getPublishedResources();
    const notices = app.store.getNotices();
    const pinnedNotices = notices.filter(n => n.isPinned);
    const recentNotices = notices.slice(0, 3);
    const recentClassNotes = published.filter(r => r.categoryId === 'cat_class_notes').slice(0, 4);

    // Calculate live counts
    const users = app.store.getUsers();
    const totalStudents = users.filter(u => (u.role || 'student') === ROLES.STUDENT).length;
    const totalManagers = users.filter(u => u.role === ROLES.MANAGER).length;
    const totalReps = users.filter(u => u.role === ROLES.REPRESENTATIVE).length;
    const allResources = app.store.getAllResources();
    const totalDrafts = allResources.filter(r => r.publicationStatus === 'draft').length;
    const pendingBanRequests = app.store.getAdminBanRequests('pending').length;

    let roleKpiHtml = '';

    if (role === ROLES.ADMIN) {
      roleKpiHtml = `
        <div class="lr-stats-grid">
          <div class="lr-stat-card" data-dash-jump="user-mgmt">
            <div class="lr-stat-label">Total Students</div>
            <div class="lr-stat-value text-primary">${totalStudents}</div>
            <div class="lr-stat-sub">Enrolled Class A</div>
          </div>
          <div class="lr-stat-card" data-dash-jump="user-mgmt">
            <div class="lr-stat-label">Total Managers</div>
            <div class="lr-stat-value text-warning">${totalManagers}</div>
            <div class="lr-stat-sub">Content uploaders</div>
          </div>
          <div class="lr-stat-card" data-dash-jump="user-mgmt">
            <div class="lr-stat-label">Representatives</div>
            <div class="lr-stat-value" style="color: #c084fc;">${totalReps}</div>
            <div class="lr-stat-sub">Class leaders</div>
          </div>
          <div class="lr-stat-card" data-dash-jump="resource-mgmt">
            <div class="lr-stat-label">Published / Drafts</div>
            <div class="lr-stat-value text-success">${published.length} <span style="font-size: 0.9rem; color: var(--lr-text-muted);">/ ${totalDrafts} drafts</span></div>
            <div class="lr-stat-sub">Learning library</div>
          </div>
          <div class="lr-stat-card" data-dash-jump="ban-centre">
            <div class="lr-stat-label">Pending Ban Requests</div>
            <div class="lr-stat-value ${pendingBanRequests > 0 ? 'text-danger' : 'text-success'}">${pendingBanRequests}</div>
            <div class="lr-stat-sub">Requires review</div>
          </div>
        </div>

        <div class="lr-quick-shortcuts" style="margin-bottom: 1.5rem;">
          <div class="lr-shortcut-card" data-dash-jump="upload">
            <div class="lr-shortcut-icon">📤</div>
            <div class="lr-shortcut-text">
              <h4>Upload Learning Material</h4>
              <p>Store files in Google Drive & notify Telegram channel</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
          <div class="lr-shortcut-card" data-dash-jump="user-mgmt">
            <div class="lr-shortcut-icon">👥</div>
            <div class="lr-shortcut-text">
              <h4>Manage Users & Roles</h4>
              <p>Promote, demote, and oversee Class A accounts</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
          <div class="lr-shortcut-card" data-dash-jump="notice-mgmt">
            <div class="lr-shortcut-icon">📢</div>
            <div class="lr-shortcut-text">
              <h4>Publish Official Notice</h4>
              <p>Post announcements with auto-generated IST timestamp</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
          <div class="lr-shortcut-card" data-dash-jump="ban-centre">
            <div class="lr-shortcut-icon">🛡️</div>
            <div class="lr-shortcut-text">
              <h4>Moderation & Ban Centre</h4>
              <p>Review active bans, Rule A-E enforcement & requests</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
          <div class="lr-shortcut-card" data-dash-jump="my-folders">
            <div class="lr-shortcut-icon">📂</div>
            <div class="lr-shortcut-text">
              <h4>Subject Folders (7 Subjects)</h4>
              <p>Organize, view, and move files across the 7 subject separation folders</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
          <div class="lr-shortcut-card" data-dash-jump="admin-bugs" style="border-left: 3px solid #ef4444;">
            <div class="lr-shortcut-icon" style="background: rgba(239, 68, 68, 0.15);">🐞</div>
            <div class="lr-shortcut-text">
              <h4>Bug Reports Oversight</h4>
              <p>Review submitted user bugs & live Telegram notification trail</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
        </div>
      `;
    } else if (role === ROLES.REPRESENTATIVE) {
      roleKpiHtml = `
        <div class="lr-stats-grid">
          <div class="lr-stat-card" data-dash-jump="notice-mgmt">
            <div class="lr-stat-label">Active Notices</div>
            <div class="lr-stat-value text-primary">${notices.length}</div>
            <div class="lr-stat-sub">Broadcast to class</div>
          </div>
          <div class="lr-stat-card" data-dash-jump="resource-mgmt">
            <div class="lr-stat-label">Published Materials</div>
            <div class="lr-stat-value text-success">${published.length}</div>
            <div class="lr-stat-sub">Live resources</div>
          </div>
          <div class="lr-stat-card" data-dash-jump="student-manager-mgmt">
            <div class="lr-stat-label">Managed Students</div>
            <div class="lr-stat-value" style="color: #38bdf8;">${totalStudents}</div>
            <div class="lr-stat-sub">Class A peers</div>
          </div>
          <div class="lr-stat-card" data-dash-jump="ban-centre">
            <div class="lr-stat-label">Active Bans</div>
            <div class="lr-stat-value text-warning">${app.store.getBans().filter(b => b.status === 'active' || b.isActive).length}</div>
            <div class="lr-stat-sub">Moderation oversight</div>
          </div>
        </div>

        <div class="lr-quick-shortcuts" style="margin-bottom: 1.5rem;">
          <div class="lr-shortcut-card" data-dash-jump="upload">
            <div class="lr-shortcut-icon">📤</div>
            <div class="lr-shortcut-text">
              <h4>Upload Learning Material</h4>
              <p>Store files in Google Drive & notify Telegram channel</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
          <div class="lr-shortcut-card" data-dash-jump="my-folders">
            <div class="lr-shortcut-icon">📂</div>
            <div class="lr-shortcut-text">
              <h4>Subject Folders (7 Subjects)</h4>
              <p>Organize and browse materials within the 7 academic subject folders</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
          <div class="lr-shortcut-card" data-dash-jump="notice-mgmt">
            <div class="lr-shortcut-icon">📝</div>
            <div class="lr-shortcut-text">
              <h4>Create Class Notice</h4>
              <p>Post announcements for Class A students</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
          <div class="lr-shortcut-card" data-dash-jump="student-manager-mgmt">
            <div class="lr-shortcut-icon">👥</div>
            <div class="lr-shortcut-text">
              <h4>Student & Manager Moderation</h4>
              <p>Supervise forum behaviour and manage infractions</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
          <div class="lr-shortcut-card" data-open-bug-report style="border-left: 3px solid #ef4444;">
            <div class="lr-shortcut-icon" style="background: rgba(239, 68, 68, 0.15);">🐞</div>
            <div class="lr-shortcut-text">
              <h4>Report an App Bug</h4>
              <p>Submit issues directly to Department Admin Telegram channel</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
        </div>
      `;
    } else if (role === ROLES.MANAGER) {
      const myResources = app.store.getResourcesByOwner(user?.id || user?.email);
      const myPublished = myResources.filter(r => r.publicationStatus === 'published');
      const myDrafts = myResources.filter(r => r.publicationStatus === 'draft');
      const myFolders = app.store.getFolders(user?.email || '', 'manager');

      roleKpiHtml = `
        <div class="lr-stats-grid">
          <div class="lr-stat-card" data-dash-jump="my-uploads">
            <div class="lr-stat-label">My Uploaded Files</div>
            <div class="lr-stat-value text-primary">${myResources.length}</div>
            <div class="lr-stat-sub">Total owned materials</div>
          </div>
          <div class="lr-stat-card" data-dash-jump="my-uploads">
            <div class="lr-stat-label">Published Live</div>
            <div class="lr-stat-value text-success">${myPublished.length}</div>
            <div class="lr-stat-sub">Visible to students</div>
          </div>
          <div class="lr-stat-card" data-dash-jump="my-uploads">
            <div class="lr-stat-label">Private Drafts</div>
            <div class="lr-stat-value text-warning">${myDrafts.length}</div>
            <div class="lr-stat-sub">Personal workspace</div>
          </div>
          <div class="lr-stat-card" data-dash-jump="my-folders">
            <div class="lr-stat-label">My Folders</div>
            <div class="lr-stat-value" style="color: #38bdf8;">${myFolders.length}</div>
            <div class="lr-stat-sub">Organised collections</div>
          </div>
          <div class="lr-stat-card" data-dash-jump="student-mgmt">
            <div class="lr-stat-label">Enrolled Students</div>
            <div class="lr-stat-value" style="color: #c084fc;">${totalStudents}</div>
            <div class="lr-stat-sub">Class A peers</div>
          </div>
        </div>

        <div class="lr-dashboard-banner" style="margin-bottom: 1.5rem;">
          <div class="lr-banner-info">
            <h3>📤 Quick Upload Workspace</h3>
            <p>Upload lecture notes, unit slides, or classroom whiteboard notes directly to your private Google Drive draft folder.</p>
          </div>
          <button class="lr-btn lr-btn-primary" data-dash-jump="upload">Upload New File</button>
        </div>

        <div class="lr-quick-shortcuts" style="margin-bottom: 1.5rem;">
          <div class="lr-shortcut-card" data-dash-jump="upload">
            <div class="lr-shortcut-icon">📤</div>
            <div class="lr-shortcut-text">
              <h4>Upload Learning Material</h4>
              <p>Store files in Google Drive & notify Telegram channel</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
          <div class="lr-shortcut-card" data-dash-jump="my-folders">
            <div class="lr-shortcut-icon">📂</div>
            <div class="lr-shortcut-text">
              <h4>Subject Folders (7 Subjects)</h4>
              <p>Organise and browse notes within 7 subject folders</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
          <div class="lr-shortcut-card" data-dash-jump="student-mgmt">
            <div class="lr-shortcut-icon">🎓</div>
            <div class="lr-shortcut-text">
              <h4>Student Roster & Moderation (${totalStudents})</h4>
              <p>View all enrolled students and manage temporary 24h moderation</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
          <div class="lr-shortcut-card" data-open-bug-report style="border-left: 3px solid #ef4444;">
            <div class="lr-shortcut-icon" style="background: rgba(239, 68, 68, 0.15);">🐞</div>
            <div class="lr-shortcut-text">
              <h4>Report an App Bug</h4>
              <p>Notify administrators of bugs, errors, or upload issues</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
        </div>
      `;
    } else {
      // Student role - provide helpful quick navigation and bug report action
      roleKpiHtml = `
        <div class="lr-quick-shortcuts" style="margin-bottom: 1.5rem;">
          <div class="lr-shortcut-card" data-dash-jump="my-folders">
            <div class="lr-shortcut-icon">📂</div>
            <div class="lr-shortcut-text">
              <h4>Subject Folders (7 Subjects)</h4>
              <p>Browse notes and materials organized by semester subjects</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
          <div class="lr-shortcut-card" data-dash-jump="resources">
            <div class="lr-shortcut-icon">📚</div>
            <div class="lr-shortcut-text">
              <h4>Class Resource Library</h4>
              <p>View all published lecture notes, syllabus & question banks</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
          <div class="lr-shortcut-card" data-dash-jump="notices">
            <div class="lr-shortcut-icon">📢</div>
            <div class="lr-shortcut-text">
              <h4>Official Class Notices</h4>
              <p>Check announcements from Class Representatives & HOD</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
          <div class="lr-shortcut-card" data-open-bug-report style="border-left: 3px solid #ef4444;">
            <div class="lr-shortcut-icon" style="background: rgba(239, 68, 68, 0.15);">🐞</div>
            <div class="lr-shortcut-text">
              <h4>Report an App Bug</h4>
              <p>Found an issue? Report directly to our Telegram admin bot</p>
            </div>
            <span class="lr-shortcut-arrow">→</span>
          </div>
        </div>
      `;
    }

    app.dom.viewContainer.innerHTML = `
      <!-- Welcome Header -->
      <section class="lr-page-header">
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
            <span class="${ROLE_BADGE_CLASSES[role] || 'lr-badge lr-badge-student'}">${ROLE_LABELS[role] || 'Student'}</span>
            <span style="font-size: 0.8rem; color: var(--lr-text-muted);">• Indian Standard Time (IST)</span>
          </div>
          <h1 class="lr-page-title">Welcome back, ${user?.displayName || user?.name || 'Student'}</h1>
          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.4rem; font-size: 0.85rem;">
            <span style="color: #38bdf8; font-weight: 600;">🎓 Roll No: <code style="background: rgba(56, 189, 248, 0.15); padding: 0.15rem 0.45rem; border-radius: 4px; color: #38bdf8;">${profile?.rollNumber || user?.rollNumber || 'Not Set'}</code></span>
            <span style="color: var(--lr-text-muted);">•</span>
            <span style="color: var(--lr-text-secondary);">✉️ Gmail: <code style="background: rgba(255, 255, 255, 0.05); padding: 0.15rem 0.45rem; border-radius: 4px; color: #f8fafc;">${user?.email || 'N/A'}</code></span>
          </div>
          <p class="lr-page-sub" style="margin-top: 0.45rem;">First-Year CSE Class A • Saranathan College of Engineering (Autonomous) • Hall RV 402</p>
        </div>
      </section>

      <!-- Role-Specific KPI / Action Row -->
      ${roleKpiHtml}

      <!-- Today's Live Timetable Summary Card (Invariant Protected) -->
      <section class="lr-section" style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.7) 100%); border: 1px solid var(--lr-border-subtle); border-radius: var(--lr-radius-lg); padding: 1.25rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <div style="font-size: 2.2rem; background: rgba(56, 189, 248, 0.1); padding: 0.5rem; border-radius: var(--lr-radius-md);">📅</div>
            <div>
              <h3 style="margin: 0; font-size: 1.1rem; color: #f8fafc;">Live Timetable & Day Order Engine</h3>
              <p style="margin: 0.2rem 0 0; font-size: 0.825rem; color: var(--lr-text-secondary);">
                Active college working hours: 09:00 AM - 04:10 PM • 7 Working Periods • Break & Lunch Schedules
              </p>
            </div>
          </div>
          <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
            <button class="lr-btn lr-btn-outline" data-open-bug-report style="border-color: rgba(239, 68, 68, 0.5); color: #fca5a5; font-size: 0.85rem;">
              <span>🐞</span> Report a Bug
            </button>
            <a href="index.html" class="lr-btn lr-btn-primary">
              <span>⏱️</span> Open Today's Schedule →
            </a>
          </div>
        </div>
      </section>

      <!-- 7 Subject-Wise Separation Folders Section (Accessible to Students in Read-Only Mode) -->
      <section class="lr-section">
        <div class="lr-section-header">
          <div>
            <h2 class="lr-section-title">📂 Core Academic Subject Folders</h2>
            <p class="lr-section-sub">Browse organized notes, question banks, and lecture slides curated by class managers</p>
          </div>
          <button class="lr-link-btn" data-dash-jump="my-folders">Browse All Subject Folders →</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
          ${SYSTEM_SUBJECT_FOLDERS.map(fld => {
            const files = app.store.getResourcesInFolder(fld.id, user);
            const count = files.length;
            const accentColor = fld.color || '#38bdf8';
            return `
              <div class="lr-card lr-folder-card-clickable" data-open-folder="${fld.id}" style="border-left: 4px solid ${accentColor}; display: flex; flex-direction: column; justify-content: space-between; padding: 1.15rem; background: var(--lr-bg-card); border-radius: var(--lr-radius-md); box-shadow: var(--lr-shadow-sm); cursor: pointer;">
                <div>
                  <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="font-size: 1.85rem;">${fld.icon || '📁'}</span>
                    <span class="lr-badge" style="background: rgba(255,255,255,0.06); color: ${accentColor}; font-size: 0.7rem; font-weight: 700; border: 1px solid ${accentColor}40;">${fld.subjectCode}</span>
                  </div>
                  <h3 style="margin: 0 0 0.25rem 0; font-size: 0.95rem; color: #f8fafc; font-weight: 700;">${fld.subjectName}</h3>
                  <div style="font-size: 0.75rem; color: var(--lr-text-muted); margin-bottom: 0.5rem;">${fld.faculty}</div>
                  <p style="margin: 0; font-size: 0.75rem; color: var(--lr-text-secondary); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${fld.description}
                  </p>
                </div>
                <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px dashed var(--lr-border-subtle); display: flex; align-items: center; justify-content: space-between;">
                  <span style="font-size: 0.75rem; font-weight: 600; color: #94a3b8;">
                    📁 ${count} ${count === 1 ? 'material' : 'materials'}
                  </span>
                  <button class="lr-btn lr-btn-sm lr-btn-outline" data-open-folder="${fld.id}" style="border-color: ${accentColor}; color: ${accentColor}; padding: 0.3rem 0.65rem; font-size: 0.75rem;">
                    Open Folder →
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <!-- Pinned & Recent Official Notices -->
      <section class="lr-section">
        <div class="lr-section-header">
          <div>
            <h2 class="lr-section-title">📢 Official Academic Notices</h2>
            <p class="lr-section-sub">Standard announcements from Department Administrators and Class Representatives</p>
          </div>
          <button class="lr-link-btn" data-dash-jump="notices">View All Notices (${notices.length}) →</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${pinnedNotices.length > 0 
            ? pinnedNotices.map(n => DashboardViews.renderNoticeCardHtml(n, app)).join('')
            : (recentNotices.length > 0 
                ? recentNotices.map(n => DashboardViews.renderNoticeCardHtml(n, app)).join('')
                : '<div class="lr-empty-box"><p>No official notices posted yet.</p></div>'
              )
          }
        </div>
      </section>

      <!-- Recent Classroom Notes -->
      <section class="lr-section">
        <div class="lr-section-header">
          <div>
            <h2 class="lr-section-title">📚 Latest Classroom Notes</h2>
            <p class="lr-section-sub">Verified lecture materials and notes for Hall RV 402</p>
          </div>
          <button class="lr-link-btn" data-dash-jump="resources">Browse Complete Library →</button>
        </div>
        <div class="lr-resource-grid">
          ${recentClassNotes.length > 0 
            ? recentClassNotes.map(r => (typeof app.renderResourceCardHtml === 'function' ? app.renderResourceCardHtml(r) : '')).join('') 
            : '<div class="lr-empty-box"><p>No classroom notes available yet.</p></div>'
          }
        </div>
      </section>
    `;

    // Bind navigation buttons inside dashboard
    app.dom.viewContainer.querySelectorAll('[data-dash-jump]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-dash-jump');
        app.currentTab = target;
        app.renderNavigation();
        app.renderCurrentView();
      });
    });

    // Bind subject folder open buttons
    app.dom.viewContainer.querySelectorAll('[data-open-folder]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const folderId = e.currentTarget.getAttribute('data-open-folder');
        DashboardViews.renderFolderContentsView(app, folderId);
      });
    });

    // Bind bug report buttons
    app.dom.viewContainer.querySelectorAll('[data-open-bug-report]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        app.openBugReportModal?.();
      });
    });

    app.bindResourceCardActions?.();
    DashboardViews.bindNoticeActions?.(app);
  }

  /**
   * 2. ACADEMIC NOTICES VIEW (Standard IST Format)
   * Prompt Section 11:
   * Date: [Automatically generated IST date]
   * Dear Friends,
   * [Notice message]
   * With regards,
   * [Sender's name]
   * [Sender's role]
   */
  static renderNoticesView(app) {
    const role = app.currentRole;
    const canManageNotices = PermissionService.hasPermission(role, 'MANAGE_NOTICES');
    const notices = app.store.getNotices();
    const pinned = notices.filter(n => n.isPinned);
    const unpinned = notices.filter(n => !n.isPinned);

    app.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <span class="lr-badge lr-badge-student">Class A Notices</span>
          <h1 class="lr-page-title">Department & Class Notices</h1>
          <p class="lr-page-sub">Official academic announcements for First-Year CSE Class A • Asia/Kolkata IST Timestamps</p>
        </div>
        ${canManageNotices ? `
          <button class="lr-btn lr-btn-primary" id="btnOpenCreateNotice">
            <span>➕</span> Create Official Notice
          </button>
        ` : ''}
      </section>

      <!-- Notice Feed -->
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        ${pinned.length > 0 ? `
          <div style="display: flex; align-items: center; gap: 0.5rem; color: #fbbf24; font-size: 0.85rem; font-weight: 700;">
            <span>📌</span> PINNED ANNOUNCEMENTS
          </div>
          ${pinned.map(n => DashboardViews.renderNoticeCardHtml(n, app)).join('')}
        ` : ''}

        ${unpinned.length > 0 ? `
          <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--lr-text-secondary); font-size: 0.85rem; font-weight: 700; margin-top: 0.5rem;">
            <span>📋</span> ALL NOTICES
          </div>
          ${unpinned.map(n => DashboardViews.renderNoticeCardHtml(n, app)).join('')}
        ` : ''}

        ${notices.length === 0 ? `
          <div class="lr-empty-box">
            <span class="lr-empty-icon">📢</span>
            <h3>No Notices Published Yet</h3>
            <p>Official notices from Administrators and Representatives will appear here in the standard format.</p>
          </div>
        ` : ''}
      </div>

      <!-- Create Notice Modal -->
      <div id="lrCreateNoticeModal" class="lr-modal-overlay" style="display: none;">
        <div class="lr-modal-box" style="max-width: 620px;">
          <header class="lr-modal-header">
            <h3>📢 Compose Official Notice</h3>
            <button class="lr-modal-close">✕</button>
          </header>
          <div class="lr-modal-body">
            <p class="lr-text-muted" style="margin: 0; font-size: 0.825rem;">
              Notices are automatically formatted with the current Indian Standard Time date, official greeting, and your authenticated signature.
            </p>

            <div class="lr-form-group" style="margin-top: 0.75rem;">
              <label>Notice Subject / Title <span style="color: #ef4444;">*</span></label>
              <input type="text" id="lrNoticeTitleInput" class="lr-form-control" placeholder="e.g. Internal Assessment Test 1 Schedule" />
            </div>

            <div class="lr-form-group">
              <label>Notice Message Body <span style="color: #ef4444;">*</span></label>
              <textarea id="lrNoticeMessageInput" class="lr-form-control" rows="4" placeholder="Type announcement details here..."></textarea>
            </div>

            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
              <input type="checkbox" id="lrNoticePinCheck" style="cursor: pointer;" />
              <label for="lrNoticePinCheck" style="font-size: 0.85rem; color: var(--lr-text-primary); cursor: pointer;">
                📌 Pin to the top of notice board
              </label>
            </div>

            <!-- Real-time Standard Format Preview -->
            <div style="margin-top: 1rem; border-top: 1px dashed var(--lr-border-subtle); padding-top: 0.75rem;">
              <div style="font-size: 0.75rem; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.35rem;">
                Live Standard Format Preview
              </div>
              <div id="lrNoticeLivePreview" style="background: rgba(15, 23, 42, 0.95); border: 1px solid var(--lr-border-subtle); border-radius: var(--lr-radius-md); padding: 1rem; font-size: 0.85rem; line-height: 1.6; white-space: pre-wrap; font-family: var(--lr-font-sans); color: #f8fafc;">
Date: ${getISTDateString()}

Dear Friends,
(Your notice message will appear here...)

With regards,
${app.auth.getCurrentUser()?.displayName || 'Administrator'}
${ROLE_LABELS[role] || 'Administrator'}</div>
            </div>
          </div>
          <footer class="lr-modal-footer">
            <button class="lr-btn lr-btn-outline lr-modal-close">Cancel</button>
            <button class="lr-btn lr-btn-primary" id="btnSubmitPublishNotice">Publish Notice for All Users</button>
          </footer>
        </div>
      </div>
    `;

    // Modal listeners
    document.getElementById('btnOpenCreateNotice')?.addEventListener('click', () => {
      const modal = document.getElementById('lrCreateNoticeModal');
      if (modal) {
        modal.style.display = 'flex';
        const msgInput = document.getElementById('lrNoticeMessageInput');
        const preview = document.getElementById('lrNoticeLivePreview');
        const user = app.auth.getCurrentUser();
        const authorName = user?.displayName || user?.name || 'Administrator';
        const authorRoleLabel = ROLE_LABELS[app.currentRole] || 'Administrator';

        msgInput?.addEventListener('input', () => {
          const val = msgInput.value.trim() || '(Your notice message will appear here...)';
          preview.textContent = formatStandardNotice(val, authorName, authorRoleLabel);
        });
      }
    });

    document.getElementById('btnSubmitPublishNotice')?.addEventListener('click', () => {
      const title = document.getElementById('lrNoticeTitleInput').value.trim();
      const message = document.getElementById('lrNoticeMessageInput').value.trim();
      const isPinned = document.getElementById('lrNoticePinCheck').checked;
      const user = app.auth.getCurrentUser();

      if (!title || !message) {
        app.showToast('Please enter both title and notice message', 'error');
        return;
      }

      try {
        app.store.createNotice({
          title,
          message,
          authorName: user?.displayName || user?.name || 'Authorized Member',
          authorEmail: user?.email,
          authorRole: app.currentRole,
          isPinned
        });

        app.showToast('Official notice published successfully!', 'success');
        document.getElementById('lrCreateNoticeModal').style.display = 'none';
        DashboardViews.renderNoticesView(app);
      } catch (err) {
        app.showToast(err.message, 'error');
      }
    });

    // Close buttons
    app.dom.viewContainer.querySelectorAll('.lr-modal-close').forEach(b => {
      b.addEventListener('click', () => {
        const m = document.getElementById('lrCreateNoticeModal');
        if (m) m.style.display = 'none';
      });
    });

    DashboardViews.bindNoticeActions(app);
  }

  static renderNoticeCardHtml(notice, app) {
    const role = app.currentRole;
    const canManageNotices = PermissionService.hasPermission(role, 'MANAGE_NOTICES');
    const roleBadgeClass = ROLE_BADGE_CLASSES[notice.authorRole] || 'lr-badge lr-badge-student';
    const roleLabel = ROLE_LABELS[notice.authorRole] || 'Official';

    return `
      <article class="lr-card" style="border-left: 4px solid ${notice.isPinned ? '#fbbf24' : '#0284c7'}; padding: 1.25rem; background: var(--lr-bg-card);">
        <header style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${notice.isPinned ? '<span class="lr-badge lr-badge-warning" style="font-size: 0.75rem;">📌 PINNED</span>' : ''}
            <span class="lr-badge lr-badge-student" style="font-family: var(--lr-font-mono); font-size: 0.725rem;">
              📅 ${notice.istDate || getISTDateString(notice.createdAt)}
            </span>
            <span class="${roleBadgeClass}">${roleLabel}</span>
          </div>

          ${canManageNotices ? `
            <div style="display: flex; align-items: center; gap: 0.35rem;">
              <button class="lr-btn lr-btn-sm lr-btn-outline" data-toggle-pin="${notice.id}" title="${notice.isPinned ? 'Unpin Notice' : 'Pin Notice'}">
                ${notice.isPinned ? 'Unpin' : '📌 Pin'}
              </button>
              <button class="lr-btn lr-btn-sm lr-btn-danger" data-delete-notice="${notice.id}" title="Delete Notice">
                🗑️
              </button>
            </div>
          ` : ''}
        </header>

        <h3 style="font-size: 1.15rem; font-weight: 700; color: #ffffff; margin: 0 0 0.5rem 0;">
          ${notice.title}
        </h3>

        <!-- Formatted Standard Text Box -->
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--lr-border-subtle); border-radius: var(--lr-radius-md); padding: 1rem; font-size: 0.875rem; line-height: 1.6; white-space: pre-wrap; color: var(--lr-text-primary); margin-bottom: 0.5rem;">
${notice.formattedNotice || notice.message}
        </div>
      </article>
    `;
  }

  static bindNoticeActions(app) {
    app.dom.viewContainer.querySelectorAll('[data-toggle-pin]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-toggle-pin');
        const user = app.auth.getCurrentUser();
        try {
          app.store.togglePinNotice(id, user?.email, app.currentRole);
          app.showToast('Notice pin status updated', 'success');
          app.renderCurrentView();
        } catch (err) {
          app.showToast(err.message, 'error');
        }
      });
    });

    app.dom.viewContainer.querySelectorAll('[data-delete-notice]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-delete-notice');
        const user = app.auth.getCurrentUser();
        if (confirm('Are you sure you want to delete this notice?')) {
          try {
            app.store.deleteNotice(id, user?.email, app.currentRole);
            app.showToast('Notice deleted', 'info');
            app.renderCurrentView();
          } catch (err) {
            app.showToast(err.message, 'error');
          }
        }
      });
    });
  }

  /**
   * 3. USER & ROLE MANAGEMENT VIEW (Admin Level 1 Master Governance)
   */
  static renderUserManagementView(app) {
    if (app.currentRole !== ROLES.ADMIN) {
      app.dom.viewContainer.innerHTML = `
        <div class="lr-access-denied-box">
          <h2>Access Denied</h2>
          <p>Only an Administrator can access User & Role Management.</p>
        </div>
      `;
      return;
    }

    const users = app.store.getUsers();
    const activeFilter = app.userMgmtRoleFilter || 'all';
    const activeStatusFilter = app.userMgmtStatusFilter || 'all';
    const searchQuery = (app.userMgmtSearch || '').toLowerCase().trim();

    const filteredUsers = users.filter(u => {
      if (activeFilter !== 'all' && u.role !== activeFilter) return false;
      if (activeStatusFilter === 'active' && u.isBanned) return false;
      if (activeStatusFilter === 'banned' && !u.isBanned) return false;
      if (searchQuery) {
        const matchName = (u.displayName || u.name || '').toLowerCase().includes(searchQuery);
        const matchFirst = (u.firstName || '').toLowerCase().includes(searchQuery);
        const matchSecond = (u.secondaryName || '').toLowerCase().includes(searchQuery);
        const matchEmail = (u.email || '').toLowerCase().includes(searchQuery);
        const matchRoll = (u.rollNumber || '').toLowerCase().includes(searchQuery);
        return matchName || matchFirst || matchSecond || matchEmail || matchRoll;
      }
      return true;
    });

    app.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <span class="lr-badge lr-badge-admin">Admin Governance</span>
          <h1 class="lr-page-title">User & Role Management</h1>
          <p class="lr-page-sub">Authoritative registered accounts directory, role promotions, and central moderation.</p>
        </div>
      </section>

      <!-- Filter & Search Bar -->
      <div class="lr-filter-bar" style="margin-bottom: 1.25rem; display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end;">
        <div class="lr-form-group" style="flex: 1; min-width: 240px;">
          <label>Search Directory:</label>
          <input type="text" id="lrUserSearchInput" class="lr-form-control" placeholder="Search by name, Gmail, or 6-digit roll number..." value="${app.userMgmtSearch || ''}" />
        </div>
        <div class="lr-form-group">
          <label>Filter Role:</label>
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            ${['all', ROLES.STUDENT, ROLES.MANAGER, ROLES.REPRESENTATIVE, ROLES.ADMIN].map(r => `
              <button class="lr-btn lr-btn-sm ${activeFilter === r ? 'lr-btn-primary' : 'lr-btn-outline'}" data-role-filter="${r}">
                ${r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            `).join('')}
          </div>
        </div>
        <div class="lr-form-group">
          <label>Account Status:</label>
          <div style="display: flex; gap: 0.35rem;">
            ${['all', 'active', 'banned'].map(s => `
              <button class="lr-btn lr-btn-sm ${activeStatusFilter === s ? 'lr-btn-primary' : 'lr-btn-outline'}" data-status-filter="${s}">
                ${s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Users Table -->
      <div class="lr-table-container">
        <table class="lr-table">
          <thead>
            <tr>
              <th>User Identity</th>
              <th>Roll No.</th>
              <th>Assigned Role</th>
              <th>Account Status</th>
              <th>Registered</th>
              <th>Role Management Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filteredUsers.length === 0 ? `
              <tr>
                <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--lr-text-muted);">
                  No registered users found matching the selected search or filter criteria.
                </td>
              </tr>
            ` : filteredUsers.map(u => {
              const role = u.role || ROLES.STUDENT;
              const isBanned = app.store.isStudentBanned(u.email);
              const isSelf = u.email.toLowerCase() === app.auth.getCurrentUser()?.email?.toLowerCase();
              const nameDisplay = u.displayName || u.name || 'Class A Student';
              const nameParts = [u.firstName, u.secondaryName].filter(Boolean).join(' ');

              return `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                      <div style="font-size: 1.5rem;">${u.avatar || '👤'}</div>
                      <div>
                        <strong>${nameDisplay}</strong>
                        ${nameParts && nameParts !== nameDisplay ? `<div style="font-size: 0.72rem; color: #94a3b8;">${nameParts}</div>` : ''}
                        <div style="font-size: 0.75rem; color: var(--lr-text-muted);">${u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <code>${u.rollNumber || '<span class="lr-text-muted">-</span>'}</code>
                  </td>
                  <td>
                    <span class="${ROLE_BADGE_CLASSES[role] || 'lr-badge lr-badge-student'}">
                      ${ROLE_LABELS[role] || 'Student'}
                    </span>
                  </td>
                  <td>
                    ${isBanned 
                      ? '<span class="lr-badge lr-badge-danger">⛔ BANNED</span>' 
                      : '<span class="lr-badge lr-badge-success">✓ ACTIVE</span>'
                    }
                  </td>
                  <td>
                    <span style="font-size: 0.8rem; color: var(--lr-text-secondary);">${u.joinDate || '2026-09-15'}</span>
                  </td>
                  <td>
                    ${isSelf ? '<span class="lr-text-muted" style="font-size: 0.8rem;">(Your Account)</span>' : `
                      <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                        ${role === ROLES.STUDENT ? `
                          <button class="lr-btn lr-btn-sm lr-btn-warning" data-change-role="${u.email}" data-target-role="${ROLES.MANAGER}">
                            Promote to Manager
                          </button>
                        ` : ''}

                        ${role === ROLES.MANAGER ? `
                          <button class="lr-btn lr-btn-sm" style="background: rgba(168, 85, 247, 0.2); border-color: rgba(168, 85, 247, 0.4); color: #c084fc;" data-change-role="${u.email}" data-target-role="${ROLES.REPRESENTATIVE}">
                            Promote to Rep
                          </button>
                          <button class="lr-btn lr-btn-sm lr-btn-outline" data-change-role="${u.email}" data-target-role="${ROLES.STUDENT}">
                            Demote to Student
                          </button>
                        ` : ''}

                        ${role === ROLES.REPRESENTATIVE ? `
                          <button class="lr-btn lr-btn-sm lr-btn-warning" data-change-role="${u.email}" data-target-role="${ROLES.MANAGER}">
                            Demote to Manager
                          </button>
                          <button class="lr-btn lr-btn-sm lr-btn-outline" data-change-role="${u.email}" data-target-role="${ROLES.STUDENT}">
                            Demote to Student
                          </button>
                        ` : ''}

                        ${isBanned ? `
                          <button class="lr-btn lr-btn-sm lr-btn-success" data-unban-user="${u.email}">
                            Unban
                          </button>
                        ` : `
                          <button class="lr-btn lr-btn-sm lr-btn-danger" data-ban-user="${u.email}" data-user-role="${role}">
                            Ban
                          </button>
                        `}
                      </div>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Confirmation Dialog Modal for Role Change -->
      <div id="lrRoleConfirmModal" class="lr-modal-overlay" style="display: none;">
        <div class="lr-modal-box" style="max-width: 480px;">
          <header class="lr-modal-header">
            <h3>⚠️ Confirm Role Transition</h3>
            <button class="lr-modal-close">✕</button>
          </header>
          <div class="lr-modal-body">
            <p id="lrRoleConfirmText" style="line-height: 1.5; font-size: 0.9rem; color: var(--lr-text-primary);"></p>
            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--lr-radius-sm); padding: 0.75rem; font-size: 0.8rem; color: #fbbf24; margin-top: 0.75rem;">
              ℹ️ This administrative decision will immediately adjust the user's dashboard capabilities and will be permanently recorded in the append-only audit log.
            </div>
          </div>
          <footer class="lr-modal-footer">
            <button class="lr-btn lr-btn-outline lr-modal-close">Cancel</button>
            <button class="lr-btn lr-btn-primary" id="btnConfirmRoleChange">Execute Role Change</button>
          </footer>
        </div>
      </div>
    `;

    // Search & Filter Listeners (Browser DOM Only)
    if (typeof document !== 'undefined') {
      document.getElementById('lrUserSearchInput')?.addEventListener('input', (e) => {
        app.userMgmtSearch = e.target.value;
        DashboardViews.renderUserManagementView(app);
      });

      app.dom.viewContainer?.querySelectorAll('[data-role-filter]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          app.userMgmtRoleFilter = e.currentTarget.getAttribute('data-role-filter');
          DashboardViews.renderUserManagementView(app);
        });
      });

      app.dom.viewContainer?.querySelectorAll('[data-status-filter]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          app.userMgmtStatusFilter = e.currentTarget.getAttribute('data-status-filter');
          DashboardViews.renderUserManagementView(app);
        });
      });

      // Role Change Buttons
      app.dom.viewContainer?.querySelectorAll('[data-change-role]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const targetEmail = e.currentTarget.getAttribute('data-change-role');
          const targetRole = e.currentTarget.getAttribute('data-target-role');
          const currentRole = app.store.getUserRole(targetEmail);
          DashboardViews.openRoleConfirmModal(app, targetEmail, currentRole, targetRole);
        });
      });

      // Ban & Unban Buttons
      app.dom.viewContainer?.querySelectorAll('[data-ban-user]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const email = e.currentTarget.getAttribute('data-ban-user');
          const userRole = e.currentTarget.getAttribute('data-user-role');
          DashboardViews.openBanModal(app, email, userRole);
        });
      });

      app.dom.viewContainer?.querySelectorAll('[data-unban-user]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const email = e.currentTarget.getAttribute('data-unban-user');
          const user = app.auth.getCurrentUser();
          try {
            app.store.unbanStudent({
              studentEmail: email,
              actorEmail: user?.email,
              actorRole: app.currentRole
            });
            app.showToast(`Unbanned ${email} successfully!`, 'success');
            DashboardViews.renderUserManagementView(app);
          } catch (err) {
            app.showToast(err.message, 'error');
          }
        });
      });
    }
  }

  static openRoleConfirmModal(app, email, currentRole, newRole) {
    const modal = document.getElementById('lrRoleConfirmModal');
    const textEl = document.getElementById('lrRoleConfirmText');
    const confirmBtn = document.getElementById('btnConfirmRoleChange');

    textEl.innerHTML = `Are you sure you want to transition <strong>${email}</strong> from <strong>${ROLE_LABELS[currentRole]}</strong> to <strong>${ROLE_LABELS[newRole]}</strong>?`;
    modal.style.display = 'flex';

    confirmBtn.onclick = () => {
      try {
        const adminEmail = app.auth.getCurrentUser()?.email;
        app.store.setUserRole(email, newRole, adminEmail, 'admin');
        app.showToast(`Promoted/Demoted ${email} to ${ROLE_LABELS[newRole]}!`, 'success');
        modal.style.display = 'none';
        DashboardViews.renderUserManagementView(app);
      } catch (err) {
        app.showToast(err.message, 'error');
      }
    };

    modal.querySelectorAll('.lr-modal-close').forEach(b => {
      b.onclick = () => { modal.style.display = 'none'; };
    });
  }

  /**
   * 4. BAN & UNBAN CENTRE (Rules A, B, C, D, E Server-Enforced Moderation)
   */
  static renderBanCentreView(app) {
    const role = app.currentRole;
    if (role === ROLES.STUDENT) {
      app.dom.viewContainer.innerHTML = `
        <div class="lr-access-denied-box">
          <h2>Access Denied</h2>
          <p>Students cannot access the Moderation Centre.</p>
        </div>
      `;
      return;
    }

    const bans = app.store.getBans().filter(b => b.status === 'active' || b.isActive);
    const requests = app.store.getAdminBanRequests();
    const students = app.store.getUsers().filter(u => (u.role || 'student') === ROLES.STUDENT);

    app.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <span class="lr-badge lr-badge-admin">Server-Enforced Moderation</span>
          <h1 class="lr-page-title">Ban & Unban Centre</h1>
          <p class="lr-page-sub">Central compliance with Rules A, B, C, D, and E moderation architecture.</p>
        </div>
        <button class="lr-btn lr-btn-danger" id="btnOpenNewBanModal">
          <span>⛔</span> Issue Account Ban
        </button>
      </section>

      <!-- Enrolled Students Directory (Class A Roster) -->
      <section class="lr-section" style="margin-bottom: 1.5rem;">
        <div class="lr-section-header">
          <div>
            <h2 class="lr-section-title">🎓 Enrolled Students Directory (${students.length})</h2>
            <p class="lr-section-sub">All Class A peer accounts logged in with Google authentication</p>
          </div>
        </div>
        <div class="lr-table-container">
          <table class="lr-table">
            <thead>
              <tr>
                <th>Student Identity</th>
                <th>Roll No.</th>
                <th>Status</th>
                <th>Enrolled Date</th>
                <th>Moderation / Actions</th>
              </tr>
            </thead>
            <tbody>
              ${students.length > 0 ? students.map(s => {
                const isBanned = app.store.isStudentBanned(s.email);
                return `
                  <tr>
                    <td>
                      <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <div style="font-size: 1.4rem;">${s.avatar || '🎓'}</div>
                        <div>
                          <strong>${s.displayName || s.name || s.email.split('@')[0]}</strong>
                          <div style="font-size: 0.75rem; color: var(--lr-text-muted);">${s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code>${s.rollNumber || '<span class="lr-badge lr-badge-warning" style="font-size: 0.7rem;">Pending Setup</span>'}</code>
                    </td>
                    <td>
                      ${isBanned
                        ? '<span class="lr-badge lr-badge-danger">⛔ BANNED</span>'
                        : '<span class="lr-badge lr-badge-success">✓ ACTIVE</span>'
                      }
                    </td>
                    <td><code>${s.joinDate || '2026-09-16'}</code></td>
                    <td>
                      ${isBanned ? `
                        <button class="lr-btn lr-btn-sm lr-btn-success" data-lift-ban="${s.email}">
                          Lift Ban
                        </button>
                      ` : `
                        <button class="lr-btn lr-btn-sm lr-btn-danger" data-quick-ban="${s.email}">
                          ${role === ROLES.MANAGER ? 'Temporary Ban (24h)' : 'Issue Ban'}
                        </button>
                      `}
                    </td>
                  </tr>
                `;
              }).join('') : '<tr><td colspan="5" style="text-align: center; color: var(--lr-text-muted); padding: 1.5rem;">No students enrolled yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Active Bans Table -->
      <section class="lr-section">
        <div class="lr-section-header">
          <h2 class="lr-section-title">Active Account Bans (${bans.length})</h2>
        </div>
        <div class="lr-table-container">
          <table class="lr-table">
            <thead>
              <tr>
                <th>Target Account</th>
                <th>Target Role</th>
                <th>Issued By</th>
                <th>Ban Type</th>
                <th>Reason</th>
                <th>Ban Timestamp (IST)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${bans.length > 0 ? bans.map(b => `
                <tr>
                  <td><strong>${b.targetEmail}</strong></td>
                  <td><span class="${ROLE_BADGE_CLASSES[b.targetRole] || 'lr-badge lr-badge-student'}">${ROLE_LABELS[b.targetRole] || 'Student'}</span></td>
                  <td>
                    <div>${b.actorEmail}</div>
                    <span class="${ROLE_BADGE_CLASSES[b.actorRole] || 'lr-badge lr-badge-student'}" style="font-size: 0.65rem;">${ROLE_LABELS[b.actorRole] || 'Official'}</span>
                  </td>
                  <td>
                    <span class="lr-badge ${b.banType === 'permanent' ? 'lr-badge-danger' : 'lr-badge-warning'}">
                      ${b.banType === 'permanent' ? 'PERMANENT' : 'TEMPORARY (24H)'}
                    </span>
                  </td>
                  <td>${b.reason}</td>
                  <td><code>${getISTDateString(b.banTimestamp || b.startsAt)}</code></td>
                  <td>
                    <button class="lr-btn lr-btn-sm lr-btn-success" data-lift-ban="${b.targetEmail}">
                      Lift Ban
                    </button>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="7" style="text-align: center; color: var(--lr-text-muted); padding: 1.5rem;">No active bans recorded.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Pending Ban Requests (Rule E) -->
      <section class="lr-section" style="margin-top: 1.5rem;">
        <div class="lr-section-header">
          <div>
            <h2 class="lr-section-title">📋 Ban Requests (Rule E Compliance)</h2>
            <p class="lr-section-sub">Requests submitted during 7-day restrictions or requiring Admin review</p>
          </div>
        </div>
        <div class="lr-table-container">
          <table class="lr-table">
            <thead>
              <tr>
                <th>Student Email</th>
                <th>Requesting Manager</th>
                <th>Reason</th>
                <th>Submitted (IST)</th>
                <th>Decision Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${requests.length > 0 ? requests.map(r => `
                <tr>
                  <td><strong>${r.studentEmail}</strong></td>
                  <td>${r.managerEmail}</td>
                  <td>${r.reason}</td>
                  <td><code>${getISTDateString(r.createdAt)}</code></td>
                  <td>
                    <span class="lr-badge lr-badge-${r.status === 'approved' ? 'danger' : (r.status === 'rejected' ? 'secondary' : 'warning')}">
                      ${r.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    ${r.status === 'pending' && (role === ROLES.ADMIN || role === ROLES.REPRESENTATIVE) ? `
                      <button class="lr-btn lr-btn-sm lr-btn-danger" data-approve-ban-req="${r.id}">Approve Ban</button>
                      <button class="lr-btn lr-btn-sm lr-btn-outline" data-reject-ban-req="${r.id}">Reject</button>
                    ` : '<span class="lr-text-muted">-</span>'}
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="6" style="text-align: center; color: var(--lr-text-muted); padding: 1.5rem;">No ban requests submitted.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Issue Ban Modal -->
      <div id="lrIssueBanModal" class="lr-modal-overlay" style="display: none;">
        <div class="lr-modal-box" style="max-width: 500px;">
          <header class="lr-modal-header">
            <h3>⛔ Issue Account Ban</h3>
            <button class="lr-modal-close">✕</button>
          </header>
          <div class="lr-modal-body">
            <div class="lr-form-group">
              <label>Target Account Email <span style="color: #ef4444;">*</span></label>
              <input type="email" id="lrBanTargetEmail" class="lr-form-control" placeholder="user@gmail.com" />
            </div>

            <div class="lr-form-group">
              <label>Ban Reason <span style="color: #ef4444;">*</span></label>
              <textarea id="lrBanReason" class="lr-form-control" rows="3" placeholder="State reason for disciplinary moderation..."></textarea>
            </div>

            ${role === ROLES.ADMIN ? `
              <div class="lr-form-group">
                <label>Ban Duration / Severity:</label>
                <select id="lrBanTypeSelect" class="lr-form-control">
                  <option value="temporary">Temporary (24 Hours)</option>
                  <option value="permanent">Permanent Account Suspension</option>
                </select>
              </div>
            ` : `
              <div class="lr-text-muted" style="font-size: 0.8rem;">
                Note: Non-admin moderation enforces standard 24-hour temporary bans.
              </div>
            `}
          </div>
          <footer class="lr-modal-footer">
            <button class="lr-btn lr-btn-outline lr-modal-close">Cancel</button>
            <button class="lr-btn lr-btn-danger" id="btnSubmitBanAction">Execute Ban</button>
          </footer>
        </div>
      </div>
    `;

    // Event Listeners
    if (typeof document !== 'undefined' && app.dom?.viewContainer) {
      document.getElementById('btnOpenNewBanModal')?.addEventListener('click', () => {
        const modal = document.getElementById('lrIssueBanModal');
        if (modal) modal.style.display = 'flex';
      });

      document.getElementById('btnSubmitBanAction')?.addEventListener('click', () => {
        const studentEmail = document.getElementById('lrBanTargetEmail')?.value?.trim();
        const reason = document.getElementById('lrBanReason')?.value?.trim();
        const banTypeSelect = document.getElementById('lrBanTypeSelect');
        const banType = banTypeSelect ? banTypeSelect.value : 'temporary';
        const actor = app.auth.getCurrentUser();

        if (!studentEmail || !reason) {
          app.showToast('Target email and reason are required', 'error');
          return;
        }

        try {
          app.store.banStudent({
            studentEmail,
            actorEmail: actor?.email,
            actorRole: app.currentRole,
            banType,
            reason
          });
          app.showToast(`Banned ${studentEmail} successfully`, 'success');
          const modal = document.getElementById('lrIssueBanModal');
          if (modal) modal.style.display = 'none';
          DashboardViews.renderBanCentreView(app);
        } catch (err) {
          if (err.message.includes('ADMIN_72H_RESTRICTION_ACTIVE') || err.message.includes('7-day restriction')) {
            if (confirm('A 7-day restriction is active because an Administrator unbanned this student. Would you like to submit a "Request Admin to Ban" instead?')) {
              app.store.submitAdminBanRequest({
                managerEmail: actor?.email,
                studentEmail,
                reason
              });
              app.showToast('Ban request submitted for Administrator review!', 'info');
              const modal = document.getElementById('lrIssueBanModal');
              if (modal) modal.style.display = 'none';
              DashboardViews.renderBanCentreView(app);
              return;
            }
          }
          app.showToast(err.message, 'error');
        }
      });

      app.dom.viewContainer.querySelectorAll('[data-lift-ban]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const studentEmail = e.currentTarget.getAttribute('data-lift-ban');
          const actor = app.auth.getCurrentUser();
          try {
            app.store.unbanStudent({
              studentEmail,
              actorEmail: actor?.email,
              actorRole: app.currentRole
            });
            app.showToast(`Unbanned ${studentEmail} successfully`, 'success');
            DashboardViews.renderBanCentreView(app);
          } catch (err) {
            app.showToast(err.message, 'error');
          }
        });
      });

      app.dom.viewContainer.querySelectorAll('[data-approve-ban-req]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const requestId = e.currentTarget.getAttribute('data-approve-ban-req');
          const actor = app.auth.getCurrentUser();
          try {
            app.store.decideAdminBanRequest({
              requestId,
              adminEmail: actor?.email,
              decision: 'approved',
              notes: 'Approved via Moderation Centre'
            });
            app.showToast('Ban request approved and student account banned!', 'success');
            DashboardViews.renderBanCentreView(app);
          } catch (err) {
            app.showToast(err.message, 'error');
          }
        });
      });

      app.dom.viewContainer.querySelectorAll('[data-reject-ban-req]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const requestId = e.currentTarget.getAttribute('data-reject-ban-req');
          const actor = app.auth.getCurrentUser();
          try {
            app.store.decideAdminBanRequest({
              requestId,
              adminEmail: actor?.email,
              decision: 'rejected',
              notes: 'Rejected by reviewer'
            });
            app.showToast('Ban request rejected', 'info');
            DashboardViews.renderBanCentreView(app);
          } catch (err) {
            app.showToast(err.message, 'error');
          }
        });
      });

      app.dom.viewContainer.querySelectorAll('[data-quick-ban]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const studentEmail = e.currentTarget.getAttribute('data-quick-ban');
          const modal = document.getElementById('lrIssueBanModal');
          const targetInput = document.getElementById('lrBanTargetEmail');
          const reasonInput = document.getElementById('lrBanReason');
          if (targetInput) targetInput.value = studentEmail;
          if (reasonInput) {
            reasonInput.value = '';
            reasonInput.focus();
          }
          if (modal) modal.style.display = 'flex';
        });
      });

      app.dom.viewContainer.querySelectorAll('.lr-modal-close').forEach(b => {
        b.onclick = () => {
          const modal = document.getElementById('lrIssueBanModal');
          if (modal) modal.style.display = 'none';
        };
      });
    }
  }

  static openBanModal(app, email, userRole) {
    DashboardViews.renderBanCentreView(app);
    const modal = document.getElementById('lrIssueBanModal');
    if (modal) {
      modal.style.display = 'flex';
      const input = document.getElementById('lrBanTargetEmail');
      if (input) input.value = email;
    }
  }

  /**
   * 5. SUBJECT-WISE SEPARATION FOLDERS & OWN-FILE ORGANIZATION
   * Allows Managers, Representatives, and Admins to browse and organize files by subject folder
   */
  static renderMyFoldersView(app) {
    const user = app.auth.getCurrentUser();
    const role = app.currentRole;
    const folders = app.store.getFolders(user?.email || '', role);
    const subjectFolders = folders.filter(f => f.isSubjectFolder);
    const customFolders = folders.filter(f => !f.isSubjectFolder);

    const isStudent = role === ROLES.STUDENT;
    const roleBadgeClass = ROLE_BADGE_CLASSES[role] || 'lr-badge lr-badge-student';
    const roleLabel = ROLE_LABELS[role] || 'Student';

    app.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem;">
            <span class="${roleBadgeClass}">${roleLabel} Workspace</span>
            <span class="lr-badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);">7 Subject Separation</span>
          </div>
          <h1 class="lr-page-title">Subject Separation Folders</h1>
          <p class="lr-page-sub">
            ${isStudent 
              ? 'Dedicated separation folders for all 7 First-Year CSE Class A subjects. Browse verified lecture notes, handwritten classroom materials, question banks, and lab exercises organized by faculty coordinators and class managers.'
              : 'Dedicated separation folders for all 7 First-Year CSE Class A subjects. Managers, Representatives, and Administrators can browse files, view documents, and organize resources into their proper subject folders.'
            }
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          ${!isStudent ? `
            <button class="lr-btn lr-btn-outline" id="btnOpenCreateFolder">
              <span>📁➕</span> Create Custom Folder
            </button>
            <button class="lr-btn lr-btn-primary" data-dash-jump="upload">
              <span>➕</span> Upload New File
            </button>
          ` : `
            <span class="lr-badge lr-badge-outline" style="padding: 0.45rem 0.85rem; font-size: 0.8rem; border-color: rgba(255,255,255,0.15); color: #94a3b8;">
              🔒 Verified Class Repository • Read-Only
            </span>
          `}
        </div>
      </section>

      <!-- Section 1: 7 Core Academic Subject Separation Folders -->
      <section class="lr-section" style="margin-bottom: 2rem;">
        <div class="lr-section-header">
          <div>
            <h2 class="lr-section-title">🏛️ 7 Core Academic Subject Separation Folders</h2>
            <p class="lr-section-sub">Standard subject directories for First-Year Semester I curriculum</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
          ${subjectFolders.map(f => {
            const files = app.store.getResourcesInFolder(f.id, user);
            const count = files.length;
            const accentColor = f.color || '#38bdf8';
            return `
              <div class="lr-card" style="padding: 1.25rem; background: var(--lr-bg-card); border-top: 4px solid ${accentColor}; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                    <div style="font-size: 2rem; background: rgba(255, 255, 255, 0.05); padding: 0.4rem 0.6rem; border-radius: var(--lr-radius-md);">${f.icon || '📁'}</div>
                    <span class="lr-badge" style="background: rgba(255,255,255,0.06); color: ${accentColor}; border: 1px solid ${accentColor}40; font-family: monospace; font-size: 0.75rem;">${f.subjectCode || 'CORE'}</span>
                  </div>
                  <h3 style="font-size: 1.1rem; font-weight: 700; color: #f8fafc; margin: 0 0 0.35rem; line-height: 1.3;">${f.name}</h3>
                  <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.5rem;">
                    <span>👤 <strong>${f.faculty || 'Faculty Coordinators'}</strong></span>
                    ${f.department ? ` • <span>${f.department}</span>` : ''}
                  </div>
                  <p style="font-size: 0.8rem; color: var(--lr-text-secondary); line-height: 1.4; margin: 0 0 1rem; min-height: 2.4rem;">
                    ${f.description || 'Subject learning materials, handouts, and handwritten classroom notes.'}
                  </p>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--lr-border-subtle); padding-top: 0.85rem; margin-top: 0.5rem;">
                  <span class="lr-badge lr-badge-${count > 0 ? 'success' : 'outline'}" style="font-size: 0.75rem;">
                    📁 ${count} ${count === 1 ? 'material' : 'materials'} organized
                  </span>
                  <button class="lr-btn lr-btn-sm lr-btn-primary" data-open-folder="${f.id}">
                    Open Folder →
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <!-- Section 2: Custom Unit & Topic Folders -->
      <section class="lr-section">
        <div class="lr-section-header">
          <div>
            <h2 class="lr-section-title">📂 Custom Unit & Topic Folders</h2>
            <p class="lr-section-sub">Personalized resource collections created by managers and representatives</p>
          </div>
        </div>

        ${customFolders.length === 0 ? `
          <div class="lr-empty-box" style="padding: 2rem;">
            <p style="color: var(--lr-text-muted); margin: 0 0 0.75rem;">No custom folders created yet.</p>
            <button class="lr-btn lr-btn-sm lr-btn-outline" id="btnEmptyCustomFolder"><span>📁➕</span> Create a Custom Folder</button>
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
            ${customFolders.map(f => {
              const files = app.store.getResourcesInFolder(f.id, user);
              return `
                <div class="lr-card" style="padding: 1rem; background: var(--lr-bg-card); display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                      <span style="font-size: 1.5rem;">📁</span>
                      <h4 style="margin: 0; font-size: 1rem; color: #f8fafc;">${f.name}</h4>
                    </div>
                    <p style="font-size: 0.75rem; color: var(--lr-text-muted); margin: 0 0 0.75rem;">
                      Created by ${f.ownerEmail || 'Manager'} • ${getISTDateString(f.createdAt)}
                    </p>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--lr-border-subtle); padding-top: 0.75rem;">
                    <span class="lr-badge lr-badge-outline" style="font-size: 0.75rem;">${files.length} files</span>
                    <button class="lr-btn lr-btn-sm lr-btn-outline" data-open-folder="${f.id}">Open Folder →</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </section>

      <!-- Create Folder Modal -->
      <div id="lrCreateFolderModal" class="lr-modal-overlay" style="display: none;">
        <div class="lr-modal-box" style="max-width: 440px;">
          <header class="lr-modal-header">
            <h3>📁 Create New Folder</h3>
            <button class="lr-modal-close">✕</button>
          </header>
          <div class="lr-modal-body">
            <div class="lr-form-group">
              <label>Folder Name <span style="color: #ef4444;">*</span></label>
              <input type="text" id="lrNewFolderName" class="lr-form-control" placeholder="e.g. Unit 3 Problem Solving Notes" />
            </div>
          </div>
          <footer class="lr-modal-footer">
            <button class="lr-btn lr-btn-outline lr-modal-close">Cancel</button>
            <button class="lr-btn lr-btn-primary" id="btnSubmitCreateFolder">Create Folder</button>
          </footer>
        </div>
      </div>
    `;

    // Bind Folder Open Click handlers
    app.dom.viewContainer.querySelectorAll('[data-open-folder]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const folderId = e.currentTarget.getAttribute('data-open-folder');
        DashboardViews.renderFolderContentsView(app, folderId);
      });
    });

    // Bind quick jump buttons
    app.dom.viewContainer.querySelectorAll('[data-dash-jump]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-dash-jump');
        app.currentTab = target;
        app.renderNavigation();
        app.renderCurrentView();
      });
    });

    if (typeof document !== 'undefined') {
      const openModalHandler = () => {
        const modal = document.getElementById('lrCreateFolderModal');
        if (modal) modal.style.display = 'flex';
      };
      document.getElementById('btnOpenCreateFolder')?.addEventListener('click', openModalHandler);
      document.getElementById('btnEmptyCustomFolder')?.addEventListener('click', openModalHandler);

      document.getElementById('btnSubmitCreateFolder')?.addEventListener('click', () => {
        const name = document.getElementById('lrNewFolderName')?.value.trim();
        if (!name) {
          app.showToast?.('Please enter folder name', 'error');
          return;
        }
        try {
          app.store.createFolder({
            name,
            ownerEmail: user?.email,
            ownerRole: role
          });
          app.showToast?.(`Folder "${name}" created successfully!`, 'success');
          const modal = document.getElementById('lrCreateFolderModal');
          if (modal) modal.style.display = 'none';
          DashboardViews.renderMyFoldersView(app);
        } catch (err) {
          app.showToast?.(err.message, 'error');
        }
      });

      app.dom.viewContainer.querySelectorAll('.lr-modal-close').forEach(b => {
        b.onclick = () => {
          const modal = document.getElementById('lrCreateFolderModal');
          if (modal) modal.style.display = 'none';
        };
      });
    }
  }

  /**
   * View all materials within a selected subject or custom folder
   * Allows previewing, moving files to other subject folders, and uploading directly
   */
  static renderFolderContentsView(app, folderId) {
    const user = app.auth.getCurrentUser();
    const role = app.currentRole;
    const folder = app.store.getFolderById(folderId);

    if (!folder) {
      app.showToast('Folder not found', 'error');
      DashboardViews.renderMyFoldersView(app);
      return;
    }

    const files = app.store.getResourcesInFolder(folderId, user);
    const accentColor = folder.color || '#38bdf8';
    const canOrganize = role === ROLES.ADMIN || role === ROLES.REPRESENTATIVE || role === ROLES.MANAGER;

    app.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <button class="lr-btn lr-btn-sm lr-btn-outline" id="btnBackToFolders" style="margin-bottom: 0.75rem;">
            ← Back to All Subject Folders
          </button>
          <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem;">
            <span class="lr-badge" style="background: ${accentColor}20; color: ${accentColor}; border: 1px solid ${accentColor}50;">
              ${folder.subjectCode || 'FOLDER'}
            </span>
            ${folder.isSubjectFolder ? '<span class="lr-badge lr-badge-primary">Subject Separation Folder</span>' : ''}
          </div>
          <h1 class="lr-page-title">${folder.icon || '📁'} ${folder.name}</h1>
          <p class="lr-page-sub">
            ${folder.faculty ? `Faculty: <strong>${folder.faculty}</strong> • Department: ${folder.department} • ` : ''}
            ${folder.description || 'Files organized in this folder.'}
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          ${canOrganize ? `
            <button class="lr-btn lr-btn-primary" id="btnUploadToThisFolder">
              <span>➕</span> Upload Material to this Folder
            </button>
          ` : ''}
        </div>
      </section>

      <!-- Folder Materials Header & Count -->
      <section class="lr-section">
        <div class="lr-section-header">
          <div>
            <h2 class="lr-section-title">Organized Materials (${files.length})</h2>
            <p class="lr-section-sub">
              ${canOrganize ? 'Managers, Representatives, and Admins can preview or move any file to another subject folder.' : 'Browse published files.'}
            </p>
          </div>
        </div>

        ${files.length === 0 ? `
          <div class="lr-empty-box" style="padding: 3rem 1.5rem;">
            <div style="font-size: 3rem; margin-bottom: 0.75rem;">📂</div>
            <h3 style="color: #f8fafc; margin: 0 0 0.5rem;">No materials in this folder yet</h3>
            <p style="color: var(--lr-text-secondary); max-width: 480px; margin: 0 auto 1.25rem;">
              This subject folder is currently empty. You can upload new files directly into it or use "Move to Folder" from any material list.
            </p>
            ${canOrganize ? `
              <button class="lr-btn lr-btn-primary" id="btnEmptyUploadToFolder">
                <span>➕</span> Upload First Material to ${folder.name}
              </button>
            ` : ''}
          </div>
        ` : `
          <div class="lr-table-container">
            <table class="lr-table">
              <thead>
                <tr>
                  <th>Title / Material</th>
                  <th>Category</th>
                  <th>Topic / Unit</th>
                  <th>Uploader</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${files.map(r => {
                  const catName = r.categoryName || app.store.getCategoryName(r.categoryId);
                  const isOwner = (r.ownerId === user?.id) || (r.ownerEmail && r.ownerEmail.toLowerCase() === (user?.email || '').toLowerCase());
                  const canMove = (role === ROLES.ADMIN || role === ROLES.REPRESENTATIVE || role === ROLES.MANAGER || isOwner) && role !== ROLES.STUDENT;
                  return `
                    <tr>
                      <td>
                        <strong>${r.title}</strong>
                        <div class="lr-text-muted" style="font-size: 0.75rem; margin-top: 0.2rem;">
                          ${r.originalFilename ? `📄 ${r.originalFilename}` : '🔗 Google Drive Asset'}
                          ${r.fileSize ? ` • ${(r.fileSize / (1024 * 1024)).toFixed(2)} MB` : ''}
                        </div>
                      </td>
                      <td><span class="lr-tag">📂 ${catName}</span></td>
                      <td>
                        <span class="lr-text-secondary" style="font-size: 0.8rem;">
                          ${r.unit || r.topic || '<span class="lr-text-muted">General</span>'}
                        </span>
                      </td>
                      <td>
                        <div style="font-size: 0.8rem;">
                          <strong>${r.ownerName || 'Faculty'}</strong>
                          <div class="lr-text-muted" style="font-size: 0.7rem;">${r.ownerEmail || ''}</div>
                        </div>
                      </td>
                      <td><small>${getISTDateString(r.academicDate || r.uploadedAt)}</small></td>
                      <td>
                        <span class="lr-badge lr-badge-${r.publicationStatus === 'published' ? 'success' : 'warning'}">
                          ${r.publicationStatus.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div class="lr-actions-btn-group">
                          <button class="lr-btn lr-btn-sm lr-btn-outline" data-open-res="${r.id}" title="Preview / Open Material">
                            👁️ Preview
                          </button>
                          ${canMove ? `
                            <button class="lr-btn lr-btn-sm lr-btn-primary" data-move-res="${r.id}" title="Move into another subject folder">
                              📂 Move
                            </button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </section>
    `;

    if (typeof document !== 'undefined') {
      document.getElementById('btnBackToFolders')?.addEventListener('click', () => {
        DashboardViews.renderMyFoldersView(app);
      });

      const triggerUploadToFolder = () => {
        app.stagingEditResource = {
          subjectId: folder.subjectId || 'sub_python',
          parentFolderId: folder.id
        };
        app.currentTab = 'upload';
        app.renderNavigation?.();
        app.renderCurrentView?.();
      };

      document.getElementById('btnUploadToThisFolder')?.addEventListener('click', triggerUploadToFolder);
      document.getElementById('btnEmptyUploadToFolder')?.addEventListener('click', triggerUploadToFolder);
    }

    // Bind preview and move buttons
    app.bindResourceCardActions?.();
    app.bindMoveResourceButtons?.();
  }

  /**
   * 6. PROFILE & ACCOUNT VIEW
   */
  static renderProfileView(app) {
    const user = app.auth.getCurrentUser();
    const role = app.currentRole;
    const profile = app.store.getStudentProfile(user?.email);
    const rollNumber = profile?.rollNumber || user?.rollNumber || 'Not Set';

    app.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <span class="${ROLE_BADGE_CLASSES[role] || 'lr-badge lr-badge-student'}">${ROLE_LABELS[role] || 'Student'}</span>
          <h1 class="lr-page-title">Profile & Account Identity</h1>
          <p class="lr-page-sub">Verified College Account credentials & academic access details.</p>
        </div>
      </section>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
        <!-- User Identity Card -->
        <div class="lr-card" style="padding: 1.5rem; background: var(--lr-bg-card);">
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem;">
            <div style="font-size: 2.5rem; background: rgba(255, 255, 255, 0.05); padding: 0.5rem; border-radius: var(--lr-radius-md);">${user?.avatar || '🎓'}</div>
            <div>
              <h2 style="font-size: 1.25rem; font-weight: 700; color: #f8fafc; margin: 0;">${user?.displayName || user?.name || 'Class A Student'}</h2>
              <div style="color: #38bdf8; font-size: 0.85rem; font-weight: 600; margin-top: 0.15rem;">Roll No: ${rollNumber}</div>
              <div style="color: var(--lr-text-secondary); font-size: 0.8rem;">${user?.email}</div>
              <div style="margin-top: 0.35rem;">
                <span class="${ROLE_BADGE_CLASSES[role] || 'lr-badge lr-badge-student'}">${ROLE_LABELS[role] || 'Student'}</span>
              </div>
            </div>
          </div>

          <div style="border-top: 1px solid var(--lr-border-subtle); padding-top: 1rem;">
            <div class="lr-details-grid">
              <div class="lr-details-item">
                <span class="lr-details-label">Student Roll Number:</span>
                <span class="lr-details-val"><code style="color: #38bdf8; font-size: 0.95rem; font-weight: 700;">${rollNumber}</code></span>
              </div>
              <div class="lr-details-item">
                <span class="lr-details-label">College Gmail:</span>
                <span class="lr-details-val"><code>${user?.email || 'N/A'}</code></span>
              </div>
              <div class="lr-details-item">
                <span class="lr-details-label">Institution:</span>
                <span class="lr-details-val">Saranathan College of Engineering (Autonomous)</span>
              </div>
              <div class="lr-details-item">
                <span class="lr-details-label">Department & Class:</span>
                <span class="lr-details-val">CSE • First-Year Class A (Hall RV 402)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Academic Permissions Card -->
        <div class="lr-card" style="padding: 1.5rem; background: var(--lr-bg-card);">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: #38bdf8; margin: 0 0 1rem;">Academic Portal Access</h3>
          <ul style="padding-left: 1.25rem; line-height: 1.8; font-size: 0.85rem; color: var(--lr-text-secondary); margin: 0;">
            <li>✓ Access live timetable and daily day-order planner (Autonomous)</li>
            <li>✓ Browse published classroom notes, lecture PDFs, and question banks</li>
            <li>✓ In-app preview for lecture materials, notes, and study guides</li>
            <li>✓ Read official academic notices in standard IST format</li>
            ${role === ROLES.MANAGER || role === ROLES.REPRESENTATIVE || role === ROLES.ADMIN ? `
              <li style="color: #fbbf24;">✓ Upload resources and study material to private storage</li>
              <li style="color: #fbbf24;">✓ Create and manage subject folders for course notes</li>
              <li style="color: #fbbf24;">✓ Organize learning materials</li>
            ` : ''}
            ${role === ROLES.REPRESENTATIVE || role === ROLES.ADMIN ? `
              <li style="color: #c084fc;">✓ Publish official academic notices for all students</li>
              <li style="color: #c084fc;">✓ Pin announcements to the top of notice board</li>
              <li style="color: #c084fc;">✓ Moderate student behaviour and manage infractions</li>
            ` : ''}
            ${role === ROLES.ADMIN ? `
              <li style="color: #fb7185;">✓ Master user & role governance (Promote/Demote accounts)</li>
              <li style="color: #fb7185;">✓ Review and approve pending ban requests</li>
              <li style="color: #fb7185;">✓ Append-only audit trail logging and settings management</li>
            ` : ''}
        <!-- In-Dashboard Profile Editor (Section 6) -->
        <div class="lr-card" style="padding: 1.5rem; background: var(--lr-bg-card); grid-column: 1 / -1;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; border-bottom: 1px solid var(--lr-border-subtle); padding-bottom: 0.75rem;">
            <div>
              <h3 style="font-size: 1.15rem; font-weight: 700; color: #f8fafc; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                <span>✏️</span> Edit Profile Details
              </h3>
              <p style="margin: 0.25rem 0 0; font-size: 0.8rem; color: var(--lr-text-muted);">
                Update your student name and 6-digit roll number. Your Google email and platform role are managed securely.
              </p>
            </div>
            <span class="lr-badge lr-badge-outline" style="font-size: 0.72rem;">Self-Service Profile</span>
          </div>

          <div id="lrEditProfileErr" class="lr-badge lr-badge-danger" style="display: none; padding: 0.65rem 1rem; border-radius: var(--lr-radius-sm); margin-bottom: 1rem; font-size: 0.825rem; line-height: 1.4;"></div>
          <div id="lrEditProfileSuccess" class="lr-badge lr-badge-success" style="display: none; padding: 0.65rem 1rem; border-radius: var(--lr-radius-sm); margin-bottom: 1rem; font-size: 0.825rem; line-height: 1.4;"></div>

          <form id="lrEditProfileForm">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
              <div class="lr-form-group">
                <label style="font-size: 0.8rem; font-weight: 600; color: var(--lr-text-secondary); margin-bottom: 0.35rem; display: block;">
                  Google Account (Verified) <span style="font-size: 0.7rem; color: var(--lr-text-muted);">🔒 Read-Only</span>
                </label>
                <input type="email" value="${user?.email || ''}" readonly class="lr-form-control" style="opacity: 0.85; background: rgba(255,255,255,0.04); color: #38bdf8; cursor: not-allowed;" />
                <small class="lr-form-hint" style="font-size: 0.7rem; color: var(--lr-text-muted); margin-top: 0.2rem; display: block;">Verified by Google OAuth.</small>
              </div>

              <div class="lr-form-group">
                <label style="font-size: 0.8rem; font-weight: 600; color: var(--lr-text-secondary); margin-bottom: 0.35rem; display: block;">
                  Assigned Platform Role <span style="font-size: 0.7rem; color: var(--lr-text-muted);">🔒 Read-Only</span>
                </label>
                <input type="text" value="${ROLE_LABELS[role] || 'Student'}" readonly class="lr-form-control" style="opacity: 0.85; background: rgba(255,255,255,0.04); color: #e2e8f0; cursor: not-allowed;" />
                <small class="lr-form-hint" style="font-size: 0.7rem; color: var(--lr-text-muted); margin-top: 0.2rem; display: block;">Role management requires administrator authorization.</small>
              </div>

              <div class="lr-form-group">
                <label for="lrEditProfileFirstName" style="font-size: 0.8rem; font-weight: 600; color: var(--lr-text-secondary); margin-bottom: 0.35rem; display: block;">
                  First Name <span style="color: #ef4444;">*</span>
                </label>
                <input type="text" id="lrEditProfileFirstName" class="lr-form-control" value="${profile?.firstName || user?.firstName || (user?.displayName || '').split(' ')[0] || ''}" required minlength="2" maxlength="50" placeholder="e.g. Deepan" />
              </div>

              <div class="lr-form-group">
                <label for="lrEditProfileSecondaryName" style="font-size: 0.8rem; font-weight: 600; color: var(--lr-text-secondary); margin-bottom: 0.35rem; display: block;">
                  Secondary / Last Name <span class="lr-text-muted">(Optional)</span>
                </label>
                <input type="text" id="lrEditProfileSecondaryName" class="lr-form-control" value="${profile?.secondaryName || user?.secondaryName || (user?.displayName || '').split(' ').slice(1).join(' ') || ''}" maxlength="50" placeholder="e.g. Raj" />
              </div>

              <div class="lr-form-group" style="grid-column: 1 / -1;">
                <label for="lrEditProfileRollNumber" style="font-size: 0.8rem; font-weight: 600; color: var(--lr-text-secondary); margin-bottom: 0.35rem; display: block;">
                  Roll Number (Exactly 6 Digits) <span style="color: #ef4444;">*</span>
                </label>
                <input type="text" id="lrEditProfileRollNumber" class="lr-form-control" value="${rollNumber !== 'Not Set' ? rollNumber : ''}" maxlength="6" inputmode="numeric" pattern="[0-9]{6}" required placeholder="e.g. 260101" style="max-width: 320px;" />
                <small class="lr-form-hint" style="font-size: 0.72rem; color: var(--lr-text-muted); margin-top: 0.25rem; display: block;">
                  Must be exactly 6 numeric digits (e.g. 260101). Verified for uniqueness against all database records.
                </small>
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--lr-border-subtle); padding-top: 1rem;">
              <button type="submit" id="btnSaveProfileEdit" class="lr-btn lr-btn-primary" style="min-width: 180px;">
                💾 Save Profile Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Event listener for profile editing form
    if (typeof document !== 'undefined') {
      const editForm = document.getElementById('lrEditProfileForm');
      if (editForm) {
        editForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const errBox = document.getElementById('lrEditProfileErr');
          const succBox = document.getElementById('lrEditProfileSuccess');
          const submitBtn = document.getElementById('btnSaveProfileEdit');
          if (errBox) errBox.style.display = 'none';
          if (succBox) succBox.style.display = 'none';

          const newFirst = document.getElementById('lrEditProfileFirstName')?.value?.trim();
          const newSec = document.getElementById('lrEditProfileSecondaryName')?.value?.trim() || '';
          const newRoll = document.getElementById('lrEditProfileRollNumber')?.value?.trim();

          if (!newFirst || newFirst.length < 2) {
            if (errBox) {
              errBox.textContent = 'First Name must be at least 2 characters long.';
              errBox.style.display = 'block';
            }
            return;
          }

          if (!newRoll || !/^[0-9]{6}$/.test(newRoll)) {
            if (errBox) {
              errBox.textContent = 'Roll Number must be exactly 6 numeric digits (e.g. 260101).';
              errBox.style.display = 'block';
            }
            return;
          }

          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving Changes…';
          }

          try {
            app.auth.updateProfile({
              firstName: newFirst,
              secondaryName: newSec,
              rollNumber: newRoll
            });

            // Sync with backend API if available
            try {
              await fetch('/api/users/profile', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-User-Email': user.email,
                  'X-User-Role': role
                },
                body: JSON.stringify({
                  email: user.email,
                  firstName: newFirst,
                  secondaryName: newSec,
                  rollNumber: newRoll
                })
              });
            } catch (_) {}

            app.renderHeaderUser();
            app.showToast('Profile saved successfully.', 'success');

            if (succBox) {
              succBox.textContent = 'Profile saved successfully. Changes are persisted across sessions.';
              succBox.style.display = 'block';
            }

            setTimeout(() => {
              if (app.currentTab === 'profile') {
                DashboardViews.renderProfileView(app);
              }
            }, 600);
          } catch (err) {
            if (errBox) {
              errBox.textContent = err.message || 'We could not save your profile. Please try again.';
              errBox.style.display = 'block';
            }
            app.showToast(err.message || 'Error saving profile', 'error');
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = '💾 Save Profile Changes';
            }
          }
        });
      }
    }
  }

  /**
   * 7. PREMIUM GOOGLE-ONLY AUTHENTICATION VIEW
   * World-class, modern cinematic two-column authentication interface
   * "One platform. One Google account. One seamless entry experience."
   */
  static renderGoogleAuthView(app) {
    app.dom.viewContainer.innerHTML = `
      <div class="lr-auth-container">
        <div class="lr-auth-ambient-glow lr-glow-1"></div>
        <div class="lr-auth-ambient-glow lr-glow-2"></div>
        <div class="lr-auth-grid-overlay"></div>

        <div class="lr-auth-layout">
          <!-- LEFT COLUMN: Brand & Visual Storytelling (55-60%) -->
          <div class="lr-auth-hero">
            <div class="lr-auth-brand-row">
              <div class="lr-auth-institution-pill">
                <span class="lr-auth-pill-dot"></span>
                SARANATHAN COLLEGE OF ENGINEERING (AUTONOMOUS)
              </div>
            </div>

            <div class="lr-auth-hero-content">
              <div class="lr-auth-dept-tag">DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING • CLASS A</div>
              <h1 class="lr-auth-headline">
                Your campus.<br>
                <span class="lr-auth-headline-gradient">One connected experience.</span>
              </h1>
              <p class="lr-auth-subtext">
                Your timetable, learning resources, and academic essentials — together in one place.
              </p>

              <!-- Centerpiece CSS Product Preview -->
              <div class="lr-auth-preview-card" aria-hidden="true">
                <div class="lr-preview-header">
                  <div class="lr-preview-badge">
                    <span class="lr-preview-status-dot"></span>
                    Live Academic Hub • Room RV 402
                  </div>
                  <div class="lr-preview-time">09:00 AM – 04:10 PM</div>
                </div>

                <div class="lr-preview-grid">
                  <div class="lr-preview-item">
                    <div class="lr-preview-icon">⏱️</div>
                    <div class="lr-preview-info">
                      <div class="lr-preview-title">Day Order Engine</div>
                      <div class="lr-preview-desc">7 Working Periods • Real-time status</div>
                    </div>
                  </div>

                  <div class="lr-preview-item">
                    <div class="lr-preview-icon">📂</div>
                    <div class="lr-preview-info">
                      <div class="lr-preview-title">7 Subject Folders</div>
                      <div class="lr-preview-desc">Organized by Faculty & Managers</div>
                    </div>
                  </div>
                </div>

                <div class="lr-preview-subject-chips">
                  <span class="lr-chip" style="--chip-c: #f59e0b;">📐 Graphics</span>
                  <span class="lr-chip" style="--chip-c: #06b6d4;">⚛️ Physics</span>
                  <span class="lr-chip" style="--chip-c: #10b981;">🧪 Chemistry</span>
                  <span class="lr-chip" style="--chip-c: #8b5cf6;">📐 Maths</span>
                  <span class="lr-chip" style="--chip-c: #ec4899;">🏛️ Tamil</span>
                  <span class="lr-chip" style="--chip-c: #3b82f6;">📖 English</span>
                  <span class="lr-chip" style="--chip-c: #14b8a6;">💻 Python</span>
                </div>

                <div class="lr-preview-footer">
                  <div class="lr-preview-notice">
                    <span class="lr-preview-notice-icon">📢</span>
                    <span>Central Notice: Verified notes & assignments updated today</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="lr-auth-hero-footer">
              <p class="lr-auth-caption">Built for a more connected campus.</p>
            </div>
          </div>

          <!-- RIGHT COLUMN: Centered Authentication Card (40-45%) -->
          <div class="lr-auth-card-panel">
            <div class="lr-auth-card">
              <div class="lr-auth-card-header">
                <div class="lr-auth-logo-badge">
                  <img src="assets/cse.jpeg" alt="CSE Department Logo" class="lr-auth-logo-img" />
                </div>
                <h2 class="lr-auth-title">Welcome back</h2>
                <p class="lr-auth-subtitle">Sign in with your Google account to continue to your campus workspace.</p>
              </div>

              <!-- Dynamic Error State -->
              <div id="lrAuthErrorBox" class="lr-auth-error-box" style="display: none;" role="alert">
                <span class="lr-auth-error-icon">⚠️</span>
                <span id="lrAuthErrorMsg" class="lr-auth-error-msg">We couldn't complete your sign-in. Please try again.</span>
              </div>

              <!-- The ONLY Sign-In Action: Continue with Google -->
              <div class="lr-auth-action-group">
                <button id="btnGoogleSignIn" class="lr-btn-google-primary" type="button" aria-label="Continue with Google">
                  <span class="lr-google-icon-box">
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                  </span>
                  <span id="btnGoogleSignInLabel" class="lr-google-btn-label">Continue with Google</span>
                </button>
              </div>

              <div class="lr-auth-security-notes">
                <div class="lr-auth-note-item">
                  <span class="lr-auth-check-icon">🔒</span>
                  <span>Secure sign-in powered by Google.</span>
                </div>
                <p class="lr-auth-privacy-text">
                  Your account is used to securely identify you and personalize your campus experience.
                </p>
              </div>

              <div class="lr-auth-card-footer">
                <div class="lr-auth-footer-tagline">One account. Your campus workspace.</div>
                <div style="margin-top: 0.85rem; padding-top: 0.85rem; border-top: 1px dashed rgba(255,255,255,0.08); text-align: center;">
                  <a href="index.html" class="lr-auth-timetable-link">
                    <span>⏱️</span> View Live Timetable (Public Display) →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Event listener: "Continue with Google" always triggers real OAuth — never shows pre-auth form
    if (typeof document !== 'undefined') {
      const googleBtn = document.getElementById('btnGoogleSignIn');
      const errorBox = document.getElementById('lrAuthErrorBox');
      const errorMsg = document.getElementById('lrAuthErrorMsg');
      const btnLabel = document.getElementById('btnGoogleSignInLabel');

      if (googleBtn) {
        googleBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          if (errorBox) errorBox.style.display = 'none';

          // Check if Supabase OAuth is available
          const supabaseAvailable = typeof window !== 'undefined' &&
            window.supabase &&
            typeof window.supabase.auth?.signInWithOAuth === 'function';

          if (supabaseAvailable) {
            // Show redirect loading state — Supabase will redirect to Google
            if (btnLabel) btnLabel.textContent = 'Signing in with Google…';
            googleBtn.disabled = true;
          }

          try {
            const result = await app.auth.loginWithGoogle();

            // If loginWithGoogle returns undefined/null it triggered an OAuth redirect.
            // Nothing to do — the page will reload after OAuth callback.
            if (result === undefined || result === null) return;

            // Demo/dev mode: loginWithGoogle returned a user object immediately
            const user = app.auth.getCurrentUser();
            if (user) {
              app.currentRole = user.role || ROLES.STUDENT;
              app.currentTab = app.currentRole === ROLES.ADMIN ? 'admin-overview' : 'dashboard';
              app.renderHeaderUser();
              app.renderNavigation();
              app.renderCurrentView();

              // Show profile completion form if student has no profile yet
              if (app.currentRole === ROLES.STUDENT && !app.auth.isProfileComplete()) {
                app.openProfileModal();
              }
            }
          } catch (err) {
            if (btnLabel) btnLabel.textContent = 'Continue with Google';
            googleBtn.disabled = false;
            if (err.code === 'ACCOUNT_BANNED') {
              if (errorBox && errorMsg) {
                errorBox.style.display = 'flex';
                errorMsg.textContent = err.message.replace('ACCOUNT_BANNED: ', '');
              }
            } else if (err.message && err.message !== 'Google sign-in cancelled by user') {
              if (errorBox && errorMsg) {
                errorBox.style.display = 'flex';
                errorMsg.textContent = err.message || "We couldn't complete your sign-in. Please try again.";
              }
            }
          }
        });
      }
    }
  }

  /**
   * 11. ADMIN BUG REPORTS & TELEGRAM AUDIT TRAIL VIEW
   * Admin-only oversight for bug reports and telegram deliveries
   */
  static async renderAdminBugReportsView(app) {
    if (app.currentRole !== ROLES.ADMIN) {
      app.dom.viewContainer.innerHTML = `
        <div class="lr-empty-box" style="padding: 3rem;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔒</div>
          <h3>Access Restricted</h3>
          <p>Only Department Administrators have clearance to view bug reports and server audit trails.</p>
          <button class="lr-btn lr-btn-primary" data-dash-jump="dashboard">Back to Dashboard</button>
        </div>
      `;
      return;
    }

    const user = app.auth.getCurrentUser();
    app.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <span class="lr-badge lr-badge-danger" style="margin-bottom: 0.35rem; display: inline-flex;">Admin Clearance Level 1</span>
          <h1 class="lr-page-title">🐞 Bug Reports Oversight</h1>
          <p class="lr-page-sub">
            Real-time defect tracking & Telegram notifications dispatched to <strong>Bug report SCE</strong> (-1004484073817)
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <button class="lr-btn lr-btn-outline" id="btnRefreshBugReports">
            <span>🔄</span> Refresh Reports
          </button>
          <button class="lr-btn lr-btn-primary" data-open-bug-report style="background: linear-gradient(135deg, #ef4444, #dc2626); border-color: #ef4444;">
            <span>➕</span> Submit New Bug
          </button>
        </div>
      </section>

      <div style="display: flex; align-items: center; justify-content: center; padding: 3rem;">
        <div class="lr-spinner" style="width: 32px; height: 32px;"></div>
      </div>
    `;

    const reports = await app.store.getBugReports('admin', user?.email);

    // Calculate metrics
    const totalCount = reports.length;
    const openCount = reports.filter(r => (r.status || 'open') === 'open').length;
    const inProgressCount = reports.filter(r => r.status === 'in_progress').length;
    const resolvedCount = reports.filter(r => r.status === 'resolved' || r.status === 'closed').length;
    const telegramDeliveredCount = reports.filter(r => r.telegramDelivery?.sent).length;

    const escapeHtml = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const getSeverityBadge = (sev) => {
      const s = (sev || 'Medium').toLowerCase();
      if (s === 'critical') return `<span class="lr-badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239,68,68,0.4); font-weight: 700;">🔥 CRITICAL</span>`;
      if (s === 'high') return `<span class="lr-badge" style="background: rgba(249, 115, 22, 0.2); color: #fb923c; border: 1px solid rgba(249,115,22,0.4); font-weight: 700;">⚠️ HIGH</span>`;
      if (s === 'low') return `<span class="lr-badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3);">🟢 LOW</span>`;
      return `<span class="lr-badge" style="background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid rgba(234,179,8,0.3);">🟡 MEDIUM</span>`;
    };

    const getStatusBadge = (st) => {
      const s = (st || 'open').toLowerCase();
      if (s === 'resolved') return `<span class="lr-badge lr-badge-success">✓ RESOLVED</span>`;
      if (s === 'in_progress') return `<span class="lr-badge" style="background: rgba(192, 132, 252, 0.2); color: #c084fc; border: 1px solid rgba(192,132,252,0.4);">⚡ IN PROGRESS</span>`;
      if (s === 'closed') return `<span class="lr-badge" style="background: rgba(148, 163, 184, 0.2); color: #94a3b8;">CLOSED</span>`;
      return `<span class="lr-badge lr-badge-danger">● OPEN</span>`;
    };

    app.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <span class="lr-badge lr-badge-danger" style="margin-bottom: 0.35rem; display: inline-flex;">Admin Clearance Level 1</span>
          <h1 class="lr-page-title">🐞 Bug Reports Oversight</h1>
          <p class="lr-page-sub">
            Real-time defect tracking & Telegram notifications dispatched to <strong>Bug report SCE</strong> (-1004484073817)
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <button class="lr-btn lr-btn-outline" id="btnRefreshBugReports">
            <span>🔄</span> Refresh Reports
          </button>
          <button class="lr-btn lr-btn-primary" data-open-bug-report style="background: linear-gradient(135deg, #ef4444, #dc2626); border-color: #ef4444;">
            <span>➕</span> Submit New Bug
          </button>
        </div>
      </section>

      <!-- KPI Summary Cards -->
      <div class="lr-stats-grid" style="margin-bottom: 1.5rem;">
        <div class="lr-stat-card">
          <div class="lr-stat-label">Total Reports</div>
          <div class="lr-stat-value text-primary">${totalCount}</div>
          <div class="lr-stat-sub">All-time submissions</div>
        </div>
        <div class="lr-stat-card">
          <div class="lr-stat-label">Open Issues</div>
          <div class="lr-stat-value text-danger">${openCount}</div>
          <div class="lr-stat-sub">Needs attention</div>
        </div>
        <div class="lr-stat-card">
          <div class="lr-stat-label">In Progress</div>
          <div class="lr-stat-value" style="color: #c084fc;">${inProgressCount}</div>
          <div class="lr-stat-sub">Under active fix</div>
        </div>
        <div class="lr-stat-card">
          <div class="lr-stat-label">Resolved / Closed</div>
          <div class="lr-stat-value text-success">${resolvedCount}</div>
          <div class="lr-stat-sub">Fixed defects</div>
        </div>
        <div class="lr-stat-card">
          <div class="lr-stat-label">Telegram Alerts</div>
          <div class="lr-stat-value text-success">${telegramDeliveredCount} <span style="font-size: 0.85rem; color: var(--lr-text-muted);">/ ${totalCount}</span></div>
          <div class="lr-stat-sub">Delivered to channel</div>
        </div>
      </div>

      <!-- Telegram Bot Integration Status Banner -->
      <section class="lr-section" style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%); border: 1px solid var(--lr-border-subtle); border-radius: var(--lr-radius-lg); padding: 1rem 1.25rem; margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="font-size: 1.6rem; background: rgba(56, 189, 248, 0.15); border-radius: var(--lr-radius-md); padding: 0.35rem 0.6rem;">🤖</div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <strong style="color: #f8fafc; font-size: 0.95rem;">Telegram Bot Channel: Bug report SCE</strong>
                <span class="lr-badge lr-badge-success" style="font-size: 0.7rem;">● BOT ACTIVE</span>
              </div>
              <p style="margin: 0.15rem 0 0; font-size: 0.75rem; color: var(--lr-text-secondary);">
                Chat ID: <code style="color: #38bdf8;">-1004484073817</code> • Shared Bot: <code>DeepanCollegeLearningBot</code> • Direct Link: <a href="https://t.me/+DUb_bXrp_x03OGZl" target="_blank" style="color: #38bdf8;">t.me/+DUb_bXrp_x03OGZl</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Reports List Table -->
      <section class="lr-section">
        <div class="lr-section-header">
          <div>
            <h2 class="lr-section-title">Submitted Bug Reports (${reports.length})</h2>
            <p class="lr-section-sub">Detailed logs, reproduction steps, screenshots, and resolution status</p>
          </div>
        </div>

        ${reports.length === 0 ? `
          <div class="lr-empty-box" style="padding: 3rem;">
            <div style="font-size: 3rem; margin-bottom: 0.75rem;">🎉</div>
            <h3 style="color: #f8fafc; margin: 0 0 0.5rem;">No bug reports submitted yet</h3>
            <p style="color: var(--lr-text-secondary); max-width: 480px; margin: 0 auto 1.25rem;">
              The system is healthy! When students, managers, or representatives submit a bug report, it will appear here instantly and alert the Telegram channel.
            </p>
            <button class="lr-btn lr-btn-primary" data-open-bug-report>Submit Test Report</button>
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${reports.map(rpt => {
              const tgSent = rpt.telegramDelivery?.sent;
              const hasScreenshot = Boolean(rpt.screenshotUrl || rpt.screenshot);
              return `
                <div class="lr-card" style="border-left: 4px solid ${rpt.severity === 'Critical' ? '#ef4444' : (rpt.severity === 'High' ? '#f97316' : '#38bdf8')}; padding: 1.25rem;">
                  <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;">
                    <div>
                      <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.35rem;">
                        <code style="background: rgba(255,255,255,0.08); padding: 0.15rem 0.5rem; border-radius: 4px; color: #38bdf8; font-weight: 700; font-size: 0.8rem;">
                          ${escapeHtml(rpt.id)}
                        </code>
                        ${getSeverityBadge(rpt.severity)}
                        <span class="lr-badge" style="background: rgba(255,255,255,0.06); color: #cbd5e1; font-size: 0.75rem;">
                          ${escapeHtml(rpt.category || 'Other')}
                        </span>
                        ${getStatusBadge(rpt.status)}
                        ${tgSent 
                          ? `<span class="lr-badge lr-badge-success" title="Delivered to Telegram channel 'Bug report SCE'">✓ Telegram Alerted</span>`
                          : `<span class="lr-badge" style="background: rgba(239,68,68,0.15); color: #fca5a5;">⚠️ Telegram Pending</span>`
                        }
                      </div>
                      <h3 style="margin: 0; font-size: 1.1rem; color: #f8fafc; font-weight: 700;">
                        ${escapeHtml(rpt.title)}
                      </h3>
                    </div>
                    <div style="text-align: right; font-size: 0.75rem; color: var(--lr-text-muted);">
                      <div>📅 ${escapeHtml(rpt.istTimestamp || getISTDateString(rpt.submittedAt))}</div>
                      <div>App: <code>${escapeHtml(rpt.appVersion || 'v2.5.0')}</code></div>
                    </div>
                  </div>

                  <!-- Reporter Meta Strip -->
                  <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--lr-border-subtle); border-radius: var(--lr-radius-sm); padding: 0.5rem 0.75rem; font-size: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; margin-bottom: 0.75rem;">
                    <div><span style="color: var(--lr-text-muted);">Reporter:</span> <strong style="color: #38bdf8;">${escapeHtml(rpt.reporterName)}</strong> (${escapeHtml(rpt.reporterRole)})</div>
                    <div><span style="color: var(--lr-text-muted);">Email:</span> <span style="color: #cbd5e1;">${escapeHtml(rpt.reporterEmail || 'N/A')}</span></div>
                    <div><span style="color: var(--lr-text-muted);">Roll No:</span> <code>${escapeHtml(rpt.rollNumber || 'Not Set')}</code></div>
                    <div><span style="color: var(--lr-text-muted);">Affected Page:</span> <strong style="color: #fb923c;">${escapeHtml(rpt.affectedPage || 'Dashboard')}</strong></div>
                  </div>

                  <!-- Description & Reproduction Steps -->
                  <div style="margin-bottom: 1rem;">
                    <h5 style="margin: 0 0 0.35rem 0; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--lr-text-muted);">
                      Description & Reproduction Steps:
                    </h5>
                    <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--lr-border-subtle); border-radius: var(--lr-radius-sm); padding: 0.75rem 1rem; font-size: 0.85rem; color: #f1f5f9; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(rpt.description)}</div>
                  </div>

                  ${hasScreenshot ? `
                    <div style="margin-bottom: 1rem;">
                      <h5 style="margin: 0 0 0.35rem 0; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--lr-text-muted);">
                        Attached Screenshot:
                      </h5>
                      <div style="display: inline-block; background: rgba(0,0,0,0.3); border: 1px solid var(--lr-border-subtle); border-radius: var(--lr-radius-md); padding: 0.35rem; cursor: pointer;" data-preview-img="${rpt.screenshotUrl || rpt.screenshot}">
                        <img src="${rpt.screenshotUrl || rpt.screenshot}" alt="Bug Screenshot" style="max-height: 120px; max-width: 240px; border-radius: 4px; display: block; object-fit: contain;" />
                        <span style="font-size: 0.7rem; color: #38bdf8; display: block; text-align: center; margin-top: 0.25rem;">🔍 Click to enlarge</span>
                      </div>
                    </div>
                  ` : ''}

                  <!-- Status Modification Controls -->
                  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--lr-border-subtle);">
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                      <label style="font-size: 0.75rem; color: var(--lr-text-muted); font-weight: 600;">Update Status:</label>
                      <select class="lr-form-control lr-bug-status-select" data-bug-id="${escapeHtml(rpt.id)}" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; width: auto;">
                        <option value="open" ${rpt.status === 'open' ? 'selected' : ''}>Open</option>
                        <option value="in_progress" ${rpt.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                        <option value="resolved" ${rpt.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                        <option value="closed" ${rpt.status === 'closed' ? 'selected' : ''}>Closed</option>
                      </select>
                      <button class="lr-btn lr-btn-sm lr-btn-primary btn-save-bug-status" data-bug-id="${escapeHtml(rpt.id)}" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">
                        Save
                      </button>
                    </div>

                    ${rpt.resolvedBy ? `
                      <div style="font-size: 0.7rem; color: var(--lr-text-muted);">
                        Resolved by <strong>${escapeHtml(rpt.resolvedBy)}</strong> on ${escapeHtml(rpt.resolvedAt ? getISTDateString(rpt.resolvedAt) : 'N/A')}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </section>
    `;

    // Bind refresh button
    document.getElementById('btnRefreshBugReports')?.addEventListener('click', () => {
      DashboardViews.renderAdminBugReportsView(app);
    });

    // Bind status update saves
    app.dom.viewContainer.querySelectorAll('.btn-save-bug-status').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const bugId = e.currentTarget.getAttribute('data-bug-id');
        const sel = app.dom.viewContainer.querySelector(`.lr-bug-status-select[data-bug-id="${bugId}"]`);
        if (!sel) return;
        const newStatus = sel.value;

        btn.disabled = true;
        btn.textContent = 'Saving...';
        try {
          await app.store.updateBugStatus(bugId, newStatus, user?.email, app.currentRole);
          app.showToast?.(`Report ${bugId} marked as ${newStatus}!`, 'success');
          DashboardViews.renderAdminBugReportsView(app);
        } catch (err) {
          app.showToast?.(err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Save';
        }
      });
    });

    // Bind screenshot preview clicks
    app.dom.viewContainer.querySelectorAll('[data-preview-img]').forEach(el => {
      el.addEventListener('click', () => {
        const src = el.getAttribute('data-preview-img');
        if (src && window.open) {
          window.open(src, '_blank');
        }
      });
    });

    // Bind quick jump & test report buttons
    app.dom.viewContainer.querySelectorAll('[data-dash-jump]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-dash-jump');
        app.currentTab = target;
        app.renderNavigation();
        app.renderCurrentView();
      });
    });

    app.dom.viewContainer.querySelectorAll('[data-open-bug-report]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        app.openBugReportModal?.();
      });
    });
  }
}

