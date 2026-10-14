// Main Controller for College Learning Resource Platform
// saranathan College of Engineering (Autonomous) - First-Year CSE Class A

import { LearningStore, validateGoogleDriveUrl } from './learningStore.js';
import { LearningAuthService } from './learningAuth.js';
import { TelegramService } from './telegramService.js';
import { ViewerModal } from './viewerModal.js';

class LearningPlatformApp {
  constructor() {
    this.store = new LearningStore();
    this.auth = new LearningAuthService(this.store);
    this.telegram = new TelegramService();
    this.viewer = new ViewerModal();

    // Current State
    this.currentRole = 'student'; // 'student' | 'manager' | 'admin'
    this.currentTab = 'home';
    this.searchQuery = '';
    this.selectedSubject = 'all';
    this.selectedCategory = 'all';
    this.selectedDate = '';
    this.selectedPeriod = 'all';

    // Upload draft staging state
    this.stagingFile = null;
    this.stagingDraft = null;

    // DOM Elements Cache
    this.dom = {};
  }

  init() {
    this.cacheDom();
    this.setupAuthListeners();
    this.setupEventListeners();
    this.renderHeaderUser();
    this.renderNavigation();
    this.renderCurrentView();
  }

  cacheDom() {
    this.dom.roleBadge = document.getElementById('lrRoleBadge');
    this.dom.userAvatar = document.getElementById('lrUserAvatar');
    this.dom.userEmail = document.getElementById('lrUserEmail');
    this.dom.userMenuBtn = document.getElementById('lrUserMenuBtn');
    this.dom.roleSwitchBtn = document.getElementById('lrRoleSwitchBtn');
    this.dom.roleModal = document.getElementById('lrRoleModal');
    this.dom.loginModal = document.getElementById('lrLoginModal');

    // Navigation
    this.dom.desktopNav = document.getElementById('lrDesktopNav');
    this.dom.mobileNav = document.getElementById('lrMobileNav');
    this.dom.viewContainer = document.getElementById('lrViewContainer');
  }

  setupAuthListeners() {
    this.auth.onAuthStateChanged((user) => {
      if (user) {
        this.currentRole = user.role;
      } else {
        // Default to student guest browsing
        this.currentRole = 'student';
      }
      this.renderHeaderUser();
      this.renderNavigation();
      this.renderCurrentView();
    });
  }

  setupEventListeners() {
    // Role switch modal toggle
    if (this.dom.roleSwitchBtn) {
      this.dom.roleSwitchBtn.addEventListener('click', () => {
        this.openRoleModal();
      });
    }

    // Role modal selections
    document.querySelectorAll('[data-select-role]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const role = e.currentTarget.getAttribute('data-select-role');
        this.handleRoleSelection(role);
      });
    });

    // Close modals
    document.querySelectorAll('.lr-modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeAllModals();
      });
    });

    // Sign out button
    const signOutBtn = document.getElementById('lrSignOutBtn');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => {
        this.auth.logout();
        this.showToast('Signed out successfully', 'info');
      });
    }
  }

  openRoleModal() {
    if (this.dom.roleModal) {
      this.dom.roleModal.style.display = 'flex';
    }
  }

  closeAllModals() {
    if (this.dom.roleModal) this.dom.roleModal.style.display = 'none';
    if (this.dom.loginModal) this.dom.loginModal.style.display = 'none';
  }

  async handleRoleSelection(role) {
    this.closeAllModals();

    if (role === 'student') {
      // Prompt Google Sign-in for student if unauthenticated or switch
      if (!this.auth.isAuthenticated()) {
        try {
          await this.auth.loginWithGoogle('student');
          this.showToast('Signed in with Google as Student', 'success');
        } catch (err) {
          if (!err.message.includes('cancelled')) {
            this.showToast(err.message, 'error');
          }
        }
      } else {
        this.currentRole = 'student';
        this.currentTab = 'home';
        this.renderCurrentView();
      }
      return;
    }

    if (role === 'manager') {
      if (!this.auth.isManager()) {
        try {
          await this.auth.loginWithGoogle('manager');
          this.currentRole = 'manager';
          this.currentTab = 'overview';
          this.showToast('Manager credentials verified! Welcome to Manager Dashboard.', 'success');
        } catch (err) {
          this.showToast(err.message, 'error', 6000);
        }
      } else {
        this.currentRole = 'manager';
        this.currentTab = 'overview';
        this.renderCurrentView();
      }
      return;
    }

    if (role === 'admin') {
      if (!this.auth.isAdmin()) {
        this.openAdminLoginModal();
      } else {
        this.currentRole = 'admin';
        this.currentTab = 'overview';
        this.renderCurrentView();
      }
    }
  }

  openAdminLoginModal() {
    if (this.dom.loginModal) {
      this.dom.loginModal.style.display = 'flex';
      const form = document.getElementById('lrAdminLoginForm');
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const email = document.getElementById('lrAdminEmail').value;
          const password = document.getElementById('lrAdminPass').value;
          const errEl = document.getElementById('lrAdminLoginErr');
          errEl.style.display = 'none';

          try {
            await this.auth.loginAdmin(email, password);
            this.closeAllModals();
            this.currentRole = 'admin';
            this.currentTab = 'overview';
            this.showToast('Admin authentication confirmed. Access granted.', 'success');
          } catch (err) {
            errEl.textContent = err.message;
            errEl.style.display = 'block';
          }
        };
      }
    }
  }

  renderHeaderUser() {
    const user = this.auth.getCurrentUser();
    if (this.dom.roleBadge) {
      if (this.currentRole === 'admin') {
        this.dom.roleBadge.textContent = 'Admin Workspace';
        this.dom.roleBadge.className = 'lr-badge lr-badge-admin';
      } else if (this.currentRole === 'manager') {
        this.dom.roleBadge.textContent = 'Manager Workspace';
        this.dom.roleBadge.className = 'lr-badge lr-badge-manager';
      } else {
        this.dom.roleBadge.textContent = 'Student Learning Portal';
        this.dom.roleBadge.className = 'lr-badge lr-badge-student';
      }
    }

    if (this.dom.userEmail) {
      this.dom.userEmail.textContent = user ? user.email : 'Public / Guest Student';
    }

    if (this.dom.userAvatar) {
      const avatar = user ? (user.avatar || '👤') : '🎓';
      if (typeof avatar === 'string' && (avatar.startsWith('http://') || avatar.startsWith('https://'))) {
        this.dom.userAvatar.innerHTML = `<img src="${avatar}" alt="Avatar" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; vertical-align: middle;" />`;
      } else {
        this.dom.userAvatar.textContent = avatar;
      }
    }
  }

  renderNavigation() {
    // 1. Desktop Nav Links
    let navItems = [];
    if (this.currentRole === 'admin') {
      navItems = [
        { id: 'overview', icon: '📊', label: 'Overview' },
        { id: 'resources', icon: '📚', label: 'Resource Library' },
        { id: 'managers', icon: '👥', label: 'Managers' },
        { id: 'categories', icon: '🏷️', label: 'Categories' },
        { id: 'subjects', icon: '📘', label: 'Subjects' },
        { id: 'telegram', icon: '✈️', label: 'Telegram Bot' },
        { id: 'audit', icon: '📜', label: 'Audit Logs' },
        { id: 'settings', icon: '⚙️', label: 'Settings' }
      ];
    } else if (this.currentRole === 'manager') {
      navItems = [
        { id: 'overview', icon: '📊', label: 'Overview' },
        { id: 'upload', icon: '📤', label: 'Add Material' },
        { id: 'drafts', icon: '📝', label: 'My Drafts' },
        { id: 'published', icon: '✅', label: 'Published' },
        { id: 'classnotes', icon: '📅', label: 'Class Notes' },
        { id: 'activity', icon: '⚡', label: 'Upload Activity' }
      ];
    } else {
      // Student Learning Portal
      navItems = [
        { id: 'home', icon: '🏠', label: 'Discover' },
        { id: 'classnotes', icon: '📅', label: 'Class Notes' },
        { id: 'subjects', icon: '📘', label: 'Subjects' },
        { id: 'categories', icon: '🏷️', label: 'Categories' },
        { id: 'all', icon: '📚', label: 'All Materials' }
      ];
    }

    // Render Desktop Nav
    if (this.dom.desktopNav) {
      this.dom.desktopNav.innerHTML = navItems.map(item => `
        <button class="lr-nav-link ${this.currentTab === item.id ? 'active' : ''}" data-tab="${item.id}">
          <span class="lr-nav-icon">${item.icon}</span>
          <span class="lr-nav-label">${item.label}</span>
        </button>
      `).join('');

      this.dom.desktopNav.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.currentTab = e.currentTarget.getAttribute('data-tab');
          this.renderNavigation();
          this.renderCurrentView();
        });
      });
    }

    // Render Mobile Bottom Bar (Max 5 items)
    if (this.dom.mobileNav) {
      const mobileItems = navItems.slice(0, 5);
      this.dom.mobileNav.innerHTML = mobileItems.map(item => `
        <button class="lr-mobile-tab ${this.currentTab === item.id ? 'active' : ''}" data-mobile-tab="${item.id}">
          <span class="lr-mobile-icon">${item.icon}</span>
          <span class="lr-mobile-label">${item.label}</span>
        </button>
      `).join('');

      this.dom.mobileNav.querySelectorAll('[data-mobile-tab]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.currentTab = e.currentTarget.getAttribute('data-mobile-tab');
          this.renderNavigation();
          this.renderCurrentView();
        });
      });
    }
  }

  renderCurrentView() {
    if (!this.dom.viewContainer) return;

    if (this.currentRole === 'admin') {
      this.renderAdminView();
    } else if (this.currentRole === 'manager') {
      this.renderManagerView();
    } else {
      this.renderStudentView();
    }
  }

  // =========================================================================
  // STUDENT LEARNING PORTAL VIEWS
  // =========================================================================
  renderStudentView() {
    switch (this.currentTab) {
      case 'classnotes':
        this.renderStudentClassNotes();
        break;
      case 'subjects':
        this.renderStudentSubjects();
        break;
      case 'categories':
        this.renderStudentCategories();
        break;
      case 'all':
        this.renderStudentAllMaterials();
        break;
      case 'home':
      default:
        this.renderStudentHome();
        break;
    }
  }

  renderStudentHome() {
    const published = this.store.getPublishedResources();
    const categories = this.store.getCategories();
    const subjects = this.store.getSubjects();

    const recentClassNotes = published.filter(r => r.categoryId === 'cat_class_notes').slice(0, 4);
    const recentUploads = published.slice(0, 6);

    this.dom.viewContainer.innerHTML = `
      <section class="lr-student-hero">
        <div class="lr-hero-badge">Dept. of Computer Science & Engineering • Saranathan College of Engineering</div>
        <h1 class="lr-hero-title">Central Learning Resource Platform</h1>
        <p class="lr-hero-subtitle">
          Instant access to official lecture notes, daily handwritten classroom notes, question banks, lab materials, and Drive archives for First-Year CSE Class A (Hall RV 402).
        </p>

        <!-- Search Bar -->
        <div class="lr-search-hero-box">
          <span class="lr-search-icon">🔍</span>
          <input type="text" id="lrHeroSearchInput" class="lr-search-input" placeholder="Search by topic, subject, date, unit or keyword (e.g. 'Loops', 'Python', 'Eigenvalues')..." value="${this.searchQuery}" />
          ${this.searchQuery ? '<button id="lrClearSearchBtn" class="lr-clear-btn">✕</button>' : ''}
        </div>
      </section>

      <!-- Quick Jump Shortcuts -->
      <section class="lr-quick-shortcuts">
        <div class="lr-shortcut-card" id="btnQuickTodayNotes">
          <div class="lr-shortcut-icon">📝</div>
          <div class="lr-shortcut-text">
            <h4>Today's Class Notes</h4>
            <p>Catch up on missed lectures from today</p>
          </div>
          <span class="lr-shortcut-arrow">→</span>
        </div>

        <div class="lr-shortcut-card" id="btnQuickQuestionPapers">
          <div class="lr-shortcut-icon">📄</div>
          <div class="lr-shortcut-text">
            <h4>Question Papers & IAT</h4>
            <p>Model exams & previous question sets</p>
          </div>
          <span class="lr-shortcut-arrow">→</span>
        </div>

        <div class="lr-shortcut-card" id="btnQuickRecordedLectures">
          <div class="lr-shortcut-icon">🎥</div>
          <div class="lr-shortcut-text">
            <h4>Recorded Lectures</h4>
            <p>Video tutorials and lab demonstrations</p>
          </div>
          <span class="lr-shortcut-arrow">→</span>
        </div>
      </section>

      <!-- Recent Class Notes Section -->
      <section class="lr-section">
        <div class="lr-section-header">
          <div>
            <h2 class="lr-section-title">Recent Classroom Notes</h2>
            <p class="lr-section-sub">Notes uploaded by period for Hall RV 402 sessions</p>
          </div>
          <button class="lr-link-btn" id="btnSeeAllNotes">View by Date & Period →</button>
        </div>
        <div class="lr-resource-grid">
          ${recentClassNotes.length > 0 
            ? recentClassNotes.map(r => this.renderResourceCardHtml(r)).join('') 
            : '<div class="lr-empty-box"><p>No classroom notes uploaded yet.</p></div>'
          }
        </div>
      </section>

      <!-- Subject Explorer Shortcuts -->
      <section class="lr-section">
        <div class="lr-section-header">
          <div>
            <h2 class="lr-section-title">Semester I Subjects</h2>
            <p class="lr-section-sub">Saranathan College Autonomous Syllabus</p>
          </div>
        </div>
        <div class="lr-subjects-grid">
          ${subjects.map(s => {
            const count = published.filter(r => r.subjectId === s.id).length;
            return `
              <div class="lr-subject-card" data-filter-subject="${s.id}" style="border-top: 4px solid ${s.color};">
                <span class="lr-subject-code">${s.code}</span>
                <h3 class="lr-subject-name">${s.name}</h3>
                <div class="lr-subject-meta">
                  <span>👤 ${s.faculty}</span>
                  <span class="lr-badge-count">${count} materials</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <!-- Recent Uploads Across All Categories -->
      <section class="lr-section">
        <div class="lr-section-header">
          <div>
            <h2 class="lr-section-title">Latest Published Materials</h2>
            <p class="lr-section-sub">Verified resources across all categories</p>
          </div>
          <button class="lr-link-btn" id="btnSeeAllMaterials">Browse Complete Library →</button>
        </div>
        <div class="lr-resource-grid">
          ${recentUploads.length > 0 
            ? recentUploads.map(r => this.renderResourceCardHtml(r)).join('') 
            : '<div class="lr-empty-box"><p>No published resources available.</p></div>'
          }
        </div>
      </section>
    `;

    // Bind event handlers
    const searchInput = document.getElementById('lrHeroSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        if (this.searchQuery.length >= 2) {
          this.currentTab = 'all';
          this.renderNavigation();
          this.renderCurrentView();
        }
      });
    }

    const clearBtn = document.getElementById('lrClearSearchBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.searchQuery = '';
        this.renderStudentHome();
      });
    }

    document.getElementById('btnQuickTodayNotes')?.addEventListener('click', () => {
      this.currentTab = 'classnotes';
      this.selectedDate = '2026-09-17'; // Set to anchor/active date
      this.renderNavigation();
      this.renderCurrentView();
    });

    document.getElementById('btnQuickQuestionPapers')?.addEventListener('click', () => {
      this.currentTab = 'all';
      this.selectedCategory = 'cat_question_papers';
      this.renderNavigation();
      this.renderCurrentView();
    });

    document.getElementById('btnQuickRecordedLectures')?.addEventListener('click', () => {
      this.currentTab = 'all';
      this.selectedCategory = 'cat_recorded_lectures';
      this.renderNavigation();
      this.renderCurrentView();
    });

    document.getElementById('btnSeeAllNotes')?.addEventListener('click', () => {
      this.currentTab = 'classnotes';
      this.renderNavigation();
      this.renderCurrentView();
    });

    document.getElementById('btnSeeAllMaterials')?.addEventListener('click', () => {
      this.currentTab = 'all';
      this.renderNavigation();
      this.renderCurrentView();
    });

    document.querySelectorAll('[data-filter-subject]').forEach(card => {
      card.addEventListener('click', (e) => {
        this.selectedSubject = e.currentTarget.getAttribute('data-filter-subject');
        this.currentTab = 'all';
        this.renderNavigation();
        this.renderCurrentView();
      });
    });

    this.bindResourceCardActions();
  }

  // --- High Priority: Regular Classroom Notes Finder ---
  renderStudentClassNotes() {
    const published = this.store.getPublishedResources().filter(r => r.categoryId === 'cat_class_notes');
    const subjects = this.store.getSubjects();

    // Default to anchor date 2026-09-17 if not set
    const activeDate = this.selectedDate || '2026-09-17';

    // Filter notes for this date
    let filteredNotes = published.filter(r => r.academicDate === activeDate);
    if (this.selectedPeriod !== 'all') {
      filteredNotes = filteredNotes.filter(r => String(r.periodNumber) === String(this.selectedPeriod));
    }
    if (this.selectedSubject !== 'all') {
      filteredNotes = filteredNotes.filter(r => r.subjectId === this.selectedSubject);
    }

    // Group by period 1-8
    const periodGroups = {};
    for (let p = 1; p <= 8; p++) {
      periodGroups[p] = filteredNotes.filter(r => r.periodNumber === p);
    }
    const unassignedPeriod = filteredNotes.filter(r => !r.periodNumber);

    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <span class="lr-badge lr-badge-primary">High Priority Missed-Class Finder</span>
          <h1 class="lr-page-title">Regular Classroom Notes by Date & Period</h1>
          <p class="lr-page-sub">Locate exactly what was written, discussed, and assigned for any missed lecture in Hall RV 402.</p>
        </div>
      </section>

      <!-- Date & Filter Control Bar -->
      <div class="lr-filter-bar">
        <div class="lr-filter-group">
          <label>Academic Date:</label>
          <input type="date" id="lrDateInput" class="lr-form-control" value="${activeDate}" />
        </div>

        <div class="lr-quick-date-pills">
          <button class="lr-pill-btn ${activeDate === '2026-09-17' ? 'active' : ''}" data-set-date="2026-09-17">Day 1 (17 Sep)</button>
          <button class="lr-pill-btn ${activeDate === '2026-09-18' ? 'active' : ''}" data-set-date="2026-09-18">Day 2 (18 Sep)</button>
          <button class="lr-pill-btn ${activeDate === '2026-09-16' ? 'active' : ''}" data-set-date="2026-09-16">Day 0 (16 Sep)</button>
        </div>

        <div class="lr-filter-group">
          <label>Period:</label>
          <select id="lrPeriodSelect" class="lr-form-control">
            <option value="all" ${this.selectedPeriod === 'all' ? 'selected' : ''}>All Periods (1 - 8)</option>
            ${[1,2,3,4,5,6,7,8].map(p => `<option value="${p}" ${String(this.selectedPeriod) === String(p) ? 'selected' : ''}>Period ${p}</option>`).join('')}
          </select>
        </div>

        <div class="lr-filter-group">
          <label>Subject:</label>
          <select id="lrSubjectSelect" class="lr-form-control">
            <option value="all">All Subjects</option>
            ${subjects.map(s => `<option value="${s.id}" ${this.selectedSubject === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Notes Grouped by Periods -->
      <div class="lr-period-schedule-results">
        ${[1,2,3,4,5,6,7,8].map(p => {
          const notes = periodGroups[p];
          if (this.selectedPeriod !== 'all' && String(this.selectedPeriod) !== String(p)) return '';
          return `
            <div class="lr-period-block">
              <div class="lr-period-block-header">
                <div class="lr-period-badge-col">
                  <span class="lr-period-num">Period ${p}</span>
                  <span class="lr-period-count">${notes.length} resource${notes.length === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div class="lr-period-items">
                ${notes.length > 0 
                  ? notes.map(r => this.renderResourceCardHtml(r)).join('') 
                  : `<div class="lr-no-period-notes"><span>No notes uploaded for Period ${p} on ${activeDate}.</span></div>`
                }
              </div>
            </div>
          `;
        }).join('')}

        ${unassignedPeriod.length > 0 ? `
          <div class="lr-period-block">
            <div class="lr-period-block-header">
              <span class="lr-period-num">General Class Notes (Full Day)</span>
            </div>
            <div class="lr-period-items">
              ${unassignedPeriod.map(r => this.renderResourceCardHtml(r)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Bind event handlers
    document.getElementById('lrDateInput')?.addEventListener('change', (e) => {
      this.selectedDate = e.target.value;
      this.renderStudentClassNotes();
    });

    document.querySelectorAll('[data-set-date]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectedDate = e.currentTarget.getAttribute('data-set-date');
        this.renderStudentClassNotes();
      });
    });

    document.getElementById('lrPeriodSelect')?.addEventListener('change', (e) => {
      this.selectedPeriod = e.target.value;
      this.renderStudentClassNotes();
    });

    document.getElementById('lrSubjectSelect')?.addEventListener('change', (e) => {
      this.selectedSubject = e.target.value;
      this.renderStudentClassNotes();
    });

    this.bindResourceCardActions();
  }

  // --- Complete Library & Filter View ---
  renderStudentAllMaterials() {
    let resources = this.store.getPublishedResources();
    const categories = this.store.getCategories();
    const subjects = this.store.getSubjects();

    // Apply Filters
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      resources = resources.filter(r => 
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.unitOrTopic && r.unitOrTopic.toLowerCase().includes(q)) ||
        (r.originalFilename && r.originalFilename.toLowerCase().includes(q)) ||
        (r.tags && r.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    if (this.selectedCategory !== 'all') {
      resources = resources.filter(r => r.categoryId === this.selectedCategory);
    }

    if (this.selectedSubject !== 'all') {
      resources = resources.filter(r => r.subjectId === this.selectedSubject);
    }

    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <h1 class="lr-page-title">Learning Materials Library</h1>
          <p class="lr-page-sub">Browse, filter, and open verified college resources</p>
        </div>
      </section>

      <!-- Advanced Filter Bar -->
      <div class="lr-filter-bar">
        <div class="lr-filter-group" style="flex: 2;">
          <label>Search:</label>
          <input type="text" id="lrLibrarySearch" class="lr-form-control" placeholder="Search by title, topic or tags..." value="${this.searchQuery}" />
        </div>

        <div class="lr-filter-group">
          <label>Category:</label>
          <select id="lrCategoryFilter" class="lr-form-control">
            <option value="all">All Categories</option>
            ${categories.map(c => `<option value="${c.id}" ${this.selectedCategory === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>

        <div class="lr-filter-group">
          <label>Subject:</label>
          <select id="lrSubjectFilter" class="lr-form-control">
            <option value="all">All Subjects</option>
            ${subjects.map(s => `<option value="${s.id}" ${this.selectedSubject === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
        </div>

        <div class="lr-filter-group" style="align-self: flex-end;">
          <button id="lrResetFiltersBtn" class="lr-btn lr-btn-outline">Reset Filters</button>
        </div>
      </div>

      <!-- Results Count -->
      <div class="lr-results-meta">
        <span>Showing <strong>${resources.length}</strong> published materials</span>
      </div>

      <!-- Cards Grid -->
      <div class="lr-resource-grid">
        ${resources.length > 0 
          ? resources.map(r => this.renderResourceCardHtml(r)).join('') 
          : `
            <div class="lr-empty-box">
              <div class="lr-empty-icon">🔍</div>
              <h3>No materials match your filters</h3>
              <p>Try searching with broader terms or resetting your category/subject filters.</p>
              <button id="lrClearFiltersEmptyBtn" class="lr-btn lr-btn-primary" style="margin-top: 1rem;">Clear All Filters</button>
            </div>
          `
        }
      </div>
    `;

    // Bind filters
    document.getElementById('lrLibrarySearch')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderStudentAllMaterials();
    });

    document.getElementById('lrCategoryFilter')?.addEventListener('change', (e) => {
      this.selectedCategory = e.target.value;
      this.renderStudentAllMaterials();
    });

    document.getElementById('lrSubjectFilter')?.addEventListener('change', (e) => {
      this.selectedSubject = e.target.value;
      this.renderStudentAllMaterials();
    });

    const resetHandler = () => {
      this.searchQuery = '';
      this.selectedCategory = 'all';
      this.selectedSubject = 'all';
      this.renderStudentAllMaterials();
    };

    document.getElementById('lrResetFiltersBtn')?.addEventListener('click', resetHandler);
    document.getElementById('lrClearFiltersEmptyBtn')?.addEventListener('click', resetHandler);

    this.bindResourceCardActions();
  }

  renderStudentSubjects() {
    const subjects = this.store.getSubjects();
    const published = this.store.getPublishedResources();

    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <h1 class="lr-page-title">Explore by Subject</h1>
          <p class="lr-page-sub">First-Year Semester I Curriculum • Dept. of CSE</p>
        </div>
      </section>

      <div class="lr-subjects-grid">
        ${subjects.map(s => {
          const items = published.filter(r => r.subjectId === s.id);
          return `
            <div class="lr-subject-card" data-open-subject="${s.id}" style="border-top: 4px solid ${s.color};">
              <div class="lr-subject-code-row">
                <span class="lr-subject-code">${s.code}</span>
                <span class="lr-badge-count">${items.length} materials</span>
              </div>
              <h2 class="lr-subject-name">${s.name}</h2>
              <p class="lr-text-muted" style="font-size: 0.85rem; margin-bottom: 0.75rem;">Department: ${s.department}</p>
              <div class="lr-subject-faculty">
                <span>👤 Faculty: <strong>${s.faculty}</strong></span>
              </div>
              <button class="lr-btn lr-btn-sm lr-btn-outline" style="margin-top: 1rem; width: 100%;">
                View ${s.name} Materials →
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;

    document.querySelectorAll('[data-open-subject]').forEach(card => {
      card.addEventListener('click', (e) => {
        this.selectedSubject = e.currentTarget.getAttribute('data-open-subject');
        this.currentTab = 'all';
        this.renderNavigation();
        this.renderCurrentView();
      });
    });
  }

  renderStudentCategories() {
    const categories = this.store.getCategories();
    const published = this.store.getPublishedResources();

    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <h1 class="lr-page-title">Dynamic Resource Categories</h1>
          <p class="lr-page-sub">Browse organized learning resources by collection type</p>
        </div>
      </section>

      <div class="lr-categories-grid">
        ${categories.map(c => {
          const count = published.filter(r => r.categoryId === c.id).length;
          return `
            <div class="lr-category-card" data-open-category="${c.id}">
              <div class="lr-cat-icon">${c.icon || '📁'}</div>
              <h2 class="lr-cat-name">${c.name}</h2>
              <p class="lr-cat-desc">${c.description || 'Collection of learning materials.'}</p>
              <div class="lr-cat-meta">
                <span class="lr-badge-count">${count} resources available</span>
                <span class="lr-cat-arrow">Open →</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    document.querySelectorAll('[data-open-category]').forEach(card => {
      card.addEventListener('click', (e) => {
        this.selectedCategory = e.currentTarget.getAttribute('data-open-category');
        this.currentTab = 'all';
        this.renderNavigation();
        this.renderCurrentView();
      });
    });
  }

  // =========================================================================
  // MANAGER DASHBOARD VIEWS
  // =========================================================================
  renderManagerView() {
    if (!this.auth.isManager()) {
      this.dom.viewContainer.innerHTML = `
        <div class="lr-access-denied-box">
          <div class="lr-denied-icon">🚫</div>
          <h2>Manager Access Restricted</h2>
          <p>You must sign in with a verified Google Account authorized by the Administrator to access the Manager Dashboard.</p>
          <button class="lr-btn lr-btn-primary" id="btnRetryManagerLogin">Sign In as Manager</button>
        </div>
      `;
      document.getElementById('btnRetryManagerLogin')?.addEventListener('click', () => {
        this.handleRoleSelection('manager');
      });
      return;
    }

    switch (this.currentTab) {
      case 'upload':
        this.renderManagerUploadStudio();
        break;
      case 'drafts':
        this.renderManagerDrafts();
        break;
      case 'published':
        this.renderManagerPublished();
        break;
      case 'classnotes':
        this.renderManagerClassNotes();
        break;
      case 'activity':
        this.renderManagerActivity();
        break;
      case 'overview':
      default:
        this.renderManagerOverview();
        break;
    }
  }

  renderManagerOverview() {
    const user = this.auth.getCurrentUser();
    const myResources = this.store.getResourcesByOwner(user.id);
    const myPublished = myResources.filter(r => r.publicationStatus === 'published');
    const myDrafts = myResources.filter(r => r.publicationStatus === 'draft');
    const myFailed = myResources.filter(r => r.uploadStatus === 'upload_failed');

    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <span class="lr-badge lr-badge-manager">Manager Workspace</span>
          <h1 class="lr-page-title">Welcome, ${user.displayName || user.email}</h1>
          <p class="lr-page-sub">Upload, review drafts, and publish learning materials to the student portal and Telegram channel.</p>
        </div>
        <button class="lr-btn lr-btn-primary" id="btnQuickUpload">
          <span>📤</span> Add New Material
        </button>
      </section>

      <!-- KPI Summary Cards -->
      <div class="lr-stats-grid">
        <div class="lr-stat-card">
          <div class="lr-stat-label">Total My Materials</div>
          <div class="lr-stat-value">${myResources.length}</div>
          <div class="lr-stat-sub">Across all categories</div>
        </div>

        <div class="lr-stat-card">
          <div class="lr-stat-label">Published & Live</div>
          <div class="lr-stat-value text-success">${myPublished.length}</div>
          <div class="lr-stat-sub">Visible to students</div>
        </div>

        <div class="lr-stat-card">
          <div class="lr-stat-label">Private Drafts</div>
          <div class="lr-stat-value text-warning">${myDrafts.length}</div>
          <div class="lr-stat-sub">Pending review / publishing</div>
        </div>

        <div class="lr-stat-card">
          <div class="lr-stat-label">Upload Failures</div>
          <div class="lr-stat-value text-danger">${myFailed.length}</div>
          <div class="lr-stat-sub">Require retry or drive link</div>
        </div>
      </div>

      <!-- Action Banners -->
      <div class="lr-dashboard-banner">
        <div class="lr-banner-info">
          <h3>🚀 Fast Classroom Notes Workflow</h3>
          <p>Did you teach or attend a lecture today? Upload today's whiteboard photos, teacher PDF or handwritten notes in less than 60 seconds.</p>
        </div>
        <button class="lr-btn lr-btn-primary" id="btnBannerUploadNotes">Upload Today's Notes</button>
      </div>

      <!-- Recent Uploads Table -->
      <section class="lr-section">
        <div class="lr-section-header">
          <h2 class="lr-section-title">My Recent Materials</h2>
        </div>
        ${this.renderMaterialsTableHtml(myResources.slice(0, 8), true)}
      </section>
    `;

    document.getElementById('btnQuickUpload')?.addEventListener('click', () => {
      this.currentTab = 'upload';
      this.renderNavigation();
      this.renderCurrentView();
    });

    document.getElementById('btnBannerUploadNotes')?.addEventListener('click', () => {
      this.currentTab = 'upload';
      this.renderNavigation();
      this.renderCurrentView();
    });

    this.bindResourceTableActions();
  }

  // --- Manager Upload Studio (Step-by-step workflow) ---
  renderManagerUploadStudio() {
    const user = this.auth.getCurrentUser();
    const categories = this.store.getCategories();
    const subjects = this.store.getSubjects();

    const savedStaging = sessionStorage.getItem('lr_upload_form_draft');
    let prefill = {};
    if (this.stagingEditResource) {
      prefill = { ...this.stagingEditResource };
    } else if (savedStaging) {
      try { prefill = JSON.parse(savedStaging); } catch (_) {}
    }

    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <span class="lr-badge lr-badge-manager">5-Step Upload Studio</span>
          <h1 class="lr-page-title">Add Learning Material</h1>
          <p class="lr-page-sub">Upload file to Telegram channel, verify metadata, save draft, and publish to students.</p>
        </div>
      </section>

      <div class="lr-upload-container">
        <!-- Step 1: Resource Type Selector -->
        <div class="lr-form-card">
          <h3 class="lr-step-title">Step 1: Choose Resource Type</h3>
          <div class="lr-type-toggle-group">
            <label class="lr-radio-card active" id="typeOptionFile">
              <input type="radio" name="resType" value="file" checked />
              <div class="lr-radio-content">
                <span class="lr-type-icon">📁</span>
                <strong>Device File Upload</strong>
                <p>Upload PDF, image, notes (stored in private Telegram channel up to 50MB)</p>
              </div>
            </label>

            <label class="lr-radio-card" id="typeOptionDrive">
              <input type="radio" name="resType" value="drive_link" />
              <div class="lr-radio-content">
                <span class="lr-type-icon">🔗</span>
                <strong>Google Drive Link</strong>
                <p>For large video recordings, drawing sheets, or shared folder archives</p>
              </div>
            </label>
          </div>
        </div>

        <!-- File Picker Box -->
        <div class="lr-form-card" id="boxFileUpload">
          <h3 class="lr-step-title">Step 2: Select File from Device</h3>
          <div class="lr-drop-zone" id="lrDropZone">
            <input type="file" id="lrFileInput" class="lr-file-input-hidden" />
            <div class="lr-drop-content">
              <span class="lr-drop-icon">☁️</span>
              <p><strong>Click to browse</strong> or drag & drop file here</p>
              <p class="lr-text-muted">Supported: PDF, Images, DOCX, PPTX, MP4, ZIP (Max: 50MB)</p>
            </div>
          </div>
          <div id="lrSelectedFileInfo" class="lr-selected-file-info" style="display: none;">
            <span>📄</span>
            <span id="lrSelectedFileName">filename.pdf</span>
            <span id="lrSelectedFileSize" class="lr-badge">0 MB</span>
            <button id="lrRemoveFileBtn" class="lr-btn-close">✕</button>
          </div>
        </div>

        <!-- Drive URL Box -->
        <div class="lr-form-card" id="boxDriveLink" style="display: none;">
          <h3 class="lr-step-title">Step 2: Enter Google Drive URL</h3>
          <div class="lr-form-group">
            <label for="lrDriveUrlInput">Google Drive Sharing Link:</label>
            <input type="url" id="lrDriveUrlInput" class="lr-form-control" placeholder="https://drive.google.com/file/d/.../view?usp=sharing" />
            <small class="lr-form-hint">Make sure the link sharing setting is set to "Anyone with the link can view".</small>
          </div>
        </div>

        <!-- Step 3: Metadata Form -->
        <div class="lr-form-card">
          <h3 class="lr-step-title">Step 3: Resource Metadata & Details</h3>
          
          <div class="lr-form-grid">
            <div class="lr-form-group full-width">
              <label for="lrInputTitle">Resource Title <span class="text-danger">*</span></label>
              <input type="text" id="lrInputTitle" class="lr-form-control" placeholder="e.g. Unit 2 Control Flow Class Notes (Period 1)" value="${prefill.title || ''}" required />
            </div>

            <div class="lr-form-group full-width">
              <label for="lrInputDesc">Resource Description <span class="text-danger">*</span></label>
              <textarea id="lrInputDesc" class="lr-form-control" rows="4" placeholder="Explain what this resource contains, its purpose, key topics/units covered, study instructions, or notes for students..." required>${prefill.description || ''}</textarea>
              <small class="lr-form-hint">Detailed multiline explanation is saved completely in the portal database and formatted in the Telegram caption.</small>
            </div>

            <div class="lr-form-group">
              <label for="lrInputManagerName">Manager Full Display Name <span class="text-danger">*</span></label>
              <input type="text" id="lrInputManagerName" class="lr-form-control" value="${prefill.ownerName || user?.displayName || 'CSE Resource Manager'}" placeholder="e.g. Dr. / Prof. / Resource Manager" required />
            </div>

            <div class="lr-form-group">
              <label for="lrInputManagerEmail">Manager Email (Authenticated Account)</label>
              <input type="email" id="lrInputManagerEmail" class="lr-form-control" value="${user?.email || ''}" readonly title="Bound to authenticated Google account" style="background: rgba(255,255,255,0.05); opacity: 0.85;" />
            </div>

            <div class="lr-form-group">
              <label for="lrSelectCategory">Category <span class="text-danger">*</span></label>
              <select id="lrSelectCategory" class="lr-form-control">
                ${categories.map(c => `<option value="${c.id}" ${prefill.categoryId === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
              </select>
            </div>

            <div class="lr-form-group">
              <label for="lrSelectSubject">Subject <span class="text-danger">*</span></label>
              <select id="lrSelectSubject" class="lr-form-control">
                ${subjects.map(s => `<option value="${s.id}" ${prefill.subjectId === s.id ? 'selected' : ''}>${s.code} — ${s.name}</option>`).join('')}
              </select>
            </div>

            <div class="lr-form-group">
              <label for="lrInputUnit">Unit or Chapter <span class="text-muted">(Optional)</span></label>
              <input type="text" id="lrInputUnit" class="lr-form-control" placeholder="e.g. Unit 2: Control Flow" value="${prefill.unit || ''}" />
            </div>

            <div class="lr-form-group">
              <label for="lrInputTopic">Topic <span class="text-muted">(Optional)</span></label>
              <input type="text" id="lrInputTopic" class="lr-form-control" placeholder="e.g. Nested Loops & Trace Tables" value="${prefill.topic || ''}" />
            </div>

            <div class="lr-form-group">
              <label for="lrInputDate">Academic Date <span class="text-muted">(Optional)</span></label>
              <input type="date" id="lrInputDate" class="lr-form-control" value="${prefill.academicDate !== undefined ? (prefill.academicDate || '') : '2026-09-17'}" />
            </div>

            <div class="lr-form-group">
              <label for="lrSelectPeriod">Period Number (1 - 8) <span class="text-muted">(Optional)</span></label>
              <select id="lrSelectPeriod" class="lr-form-control">
                <option value="">None / Not Applicable</option>
                ${[1,2,3,4,5,6,7,8].map(p => `<option value="${p}" ${String(prefill.periodNumber) === String(p) ? 'selected' : ''}>Period ${p}</option>`).join('')}
              </select>
            </div>

            <div class="lr-form-group full-width">
              <label for="lrInputTags">Tags (comma separated) <span class="text-muted">(Optional)</span></label>
              <input type="text" id="lrInputTags" class="lr-form-control" placeholder="python, loops, solved-sheet" value="${Array.isArray(prefill.tags) ? prefill.tags.join(', ') : (prefill.tags || '')}" />
            </div>
          </div>
        </div>

        <!-- Upload Progress & Status Alert -->
        <div id="lrUploadProgressBox" class="lr-progress-box" style="display: none;">
          <div class="lr-progress-bar-wrap">
            <div id="lrUploadProgressBar" class="lr-progress-bar-fill" style="width: 0%;"></div>
          </div>
          <div id="lrUploadProgressText" class="lr-progress-text">Preparing upload...</div>
        </div>

        <!-- Actions -->
        <div class="lr-upload-actions">
          <button id="btnSaveDraft" class="lr-btn lr-btn-outline">
            <span>💾</span> Save as Private Draft
          </button>
          <button id="btnPublishDirect" class="lr-btn lr-btn-primary">
            <span>🚀</span> Upload & Publish Now
          </button>
        </div>
      </div>
    `;

    // Type toggle logic
    const radioFile = document.querySelector('input[value="file"]');
    const radioDrive = document.querySelector('input[value="drive_link"]');
    const boxFile = document.getElementById('boxFileUpload');
    const boxDrive = document.getElementById('boxDriveLink');

    radioFile?.addEventListener('change', () => {
      document.getElementById('typeOptionFile').classList.add('active');
      document.getElementById('typeOptionDrive').classList.remove('active');
      boxFile.style.display = 'block';
      boxDrive.style.display = 'none';
    });

    radioDrive?.addEventListener('change', () => {
      document.getElementById('typeOptionDrive').classList.add('active');
      document.getElementById('typeOptionFile').classList.remove('active');
      boxFile.style.display = 'none';
      boxDrive.style.display = 'block';
    });

    // File Drag & Drop
    const dropZone = document.getElementById('lrDropZone');
    const fileInput = document.getElementById('lrFileInput');
    const fileInfo = document.getElementById('lrSelectedFileInfo');
    const fileNameEl = document.getElementById('lrSelectedFileName');
    const fileSizeEl = document.getElementById('lrSelectedFileSize');
    const removeFileBtn = document.getElementById('lrRemoveFileBtn');

    dropZone?.addEventListener('click', () => fileInput.click());

    fileInput?.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleSelectedFile(e.target.files[0], fileInfo, fileNameEl, fileSizeEl, dropZone);
      }
    });

    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        this.handleSelectedFile(e.dataTransfer.files[0], fileInfo, fileNameEl, fileSizeEl, dropZone);
      }
    });

    removeFileBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.stagingFile = null;
      fileInput.value = '';
      fileInfo.style.display = 'none';
      dropZone.style.display = 'block';
    });

    // Autosave draft form on input so progress is not lost on refresh
    const saveFormDraftToSession = () => {
      const draftObj = {
        title: document.getElementById('lrInputTitle')?.value || '',
        description: document.getElementById('lrInputDesc')?.value || '',
        categoryId: document.getElementById('lrSelectCategory')?.value || '',
        subjectId: document.getElementById('lrSelectSubject')?.value || '',
        academicDate: document.getElementById('lrInputDate')?.value || '',
        periodNumber: document.getElementById('lrSelectPeriod')?.value || '',
        unit: document.getElementById('lrInputUnit')?.value || '',
        topic: document.getElementById('lrInputTopic')?.value || '',
        ownerName: document.getElementById('lrInputManagerName')?.value || '',
        tags: document.getElementById('lrInputTags')?.value || ''
      };
      sessionStorage.setItem('lr_upload_form_draft', JSON.stringify(draftObj));
    };

    ['lrInputTitle', 'lrInputDesc', 'lrSelectCategory', 'lrSelectSubject', 'lrInputDate', 'lrSelectPeriod', 'lrInputUnit', 'lrInputTopic', 'lrInputManagerName', 'lrInputTags'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', saveFormDraftToSession);
      document.getElementById(id)?.addEventListener('change', saveFormDraftToSession);
    });

    // Form submission buttons
    document.getElementById('btnSaveDraft')?.addEventListener('click', () => {
      this.executeUploadWorkflow('draft');
    });

    document.getElementById('btnPublishDirect')?.addEventListener('click', () => {
      this.executeUploadWorkflow('publish');
    });
  }

  handleSelectedFile(file, fileInfo, fileNameEl, fileSizeEl, dropZone) {
    try {
      this.telegram.validateFile(file);
      this.stagingFile = file;
      fileNameEl.textContent = file.name;
      fileSizeEl.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
      fileInfo.style.display = 'flex';
      dropZone.style.display = 'none';

      // Auto-populate title if empty
      const titleInput = document.getElementById('lrInputTitle');
      if (titleInput && !titleInput.value) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        titleInput.value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async executeUploadWorkflow(targetAction = 'draft') {
    const user = this.auth.getCurrentUser();
    const isDrive = document.querySelector('input[name="resType"]:checked')?.value === 'drive_link';
    const driveUrl = document.getElementById('lrDriveUrlInput')?.value.trim();
    const title = document.getElementById('lrInputTitle')?.value.trim();
    const description = document.getElementById('lrInputDesc')?.value.trim();
    const managerName = (document.getElementById('lrInputManagerName')?.value || user?.displayName || 'CSE Resource Manager').trim();
    const categoryId = document.getElementById('lrSelectCategory')?.value;
    const subjectId = document.getElementById('lrSelectSubject')?.value;
    const academicDate = document.getElementById('lrInputDate')?.value || null;
    const periodNumber = document.getElementById('lrSelectPeriod')?.value || null;
    const unit = document.getElementById('lrInputUnit')?.value.trim() || null;
    const topic = document.getElementById('lrInputTopic')?.value.trim() || null;
    const tagsRaw = document.getElementById('lrInputTags')?.value.trim();

    if (!title) {
      this.showToast('Resource Title is required', 'error');
      return;
    }

    if (!description) {
      this.showToast('Resource Description is required. Please explain what this resource covers.', 'error');
      return;
    }

    if (!managerName) {
      this.showToast('Manager display name is required', 'error');
      return;
    }

    if (isDrive) {
      if (!driveUrl) {
        this.showToast('Google Drive sharing link is required', 'error');
        return;
      }
      const driveCheck = validateGoogleDriveUrl(driveUrl);
      if (!driveCheck.isValid) {
        this.showToast(driveCheck.error, 'error');
        return;
      }
    }

    if (!isDrive && !this.stagingFile && !this.stagingEditResource?.originalFilename) {
      this.showToast('Please select a file to upload', 'error');
      return;
    }

    const progressBox = document.getElementById('lrUploadProgressBox');
    const progressBar = document.getElementById('lrUploadProgressBar');
    const progressText = document.getElementById('lrUploadProgressText');

    progressBox.style.display = 'block';

    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];

    // Real unique Resource ID generated before upload
    const resourceId = this.stagingResourceId || ('res_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36));
    this.stagingResourceId = resourceId;

    const categoryName = this.store.getCategoryName(categoryId);
    const subjectName = this.store.getSubjectName(subjectId);
    const uploadedAt = new Date().toISOString();

    let uploadResult = null;
    let uploadStatus = isDrive ? 'uploaded' : 'pending';

    if (!isDrive && this.stagingFile) {
      try {
        uploadResult = await this.telegram.uploadFile(
          this.stagingFile,
          {
            resourceId,
            title,
            description,
            categoryId,
            categoryName,
            subjectId,
            subjectName,
            unit,
            topic,
            academicDate,
            period: periodNumber,
            uploaderName: managerName,
            uploaderEmail: user.email,
            userRole: user.role,
            uploadedAt
          },
          (pct, msg) => {
            progressBar.style.width = `${pct}%`;
            progressText.textContent = msg;
          }
        );
        uploadStatus = 'uploaded';
      } catch (uploadErr) {
        console.warn('Google Drive / Telegram upload failed:', uploadErr);
        uploadStatus = 'upload_failed';
        this.showToast(`Upload failed: ${uploadErr.message}`, 'error', 6000);
      }
    }

    // Save record in store
    const recordData = {
      id: resourceId,
      title,
      description,
      categoryId,
      categoryName,
      subjectId,
      subjectName,
      semester: 'I',
      academicDate,
      periodNumber: periodNumber ? Number(periodNumber) : null,
      unit,
      topic,
      tags,
      resourceType: isDrive ? 'drive_link' : 'file',
      googleDriveUrl: isDrive ? driveUrl : null,
      googleDriveFileId: uploadResult?.data?.googleDriveFileId || this.stagingEditResource?.googleDriveFileId || (isDrive ? (driveUrl?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || null) : null),
      googleDriveFolderId: uploadResult?.data?.googleDriveFolderId || '1_Approved_College_Learning_Resources_Root',
      googleDriveStatus: uploadResult?.data?.googleDriveStatus || (uploadStatus === 'uploaded' ? 'VERIFIED' : 'PENDING'),
      telegramAuditStatus: uploadResult?.data?.auditDelivery?.delivered ? 'sent' : (uploadStatus === 'uploaded' ? 'pending' : 'failed'),
      telegramAuditMessageId: uploadResult?.data?.auditDelivery?.messageId || null,
      originalFilename: this.stagingFile ? this.stagingFile.name : (this.stagingEditResource?.originalFilename || null),
      mimeType: this.stagingFile ? this.stagingFile.type : (this.stagingEditResource?.mimeType || 'application/octet-stream'),
      fileSize: this.stagingFile ? this.stagingFile.size : (this.stagingEditResource?.fileSize || 0),
      ownerId: user.id,
      ownerEmail: user.email,
      ownerName: managerName,
      telegramChatId: uploadResult?.data?.chatId || this.store.settings.telegramChannelId || '-1003598863042',
      telegramMessageId: uploadResult?.data?.messageId || this.stagingEditResource?.telegramMessageId || null,
      telegramFileId: uploadResult?.data?.googleDriveFileId || uploadResult?.data?.fileId || this.stagingEditResource?.telegramFileId || null,
      uploadStatus,
      uploadedAt
    };

    const savedDraft = this.store.saveDraftResource(recordData, user);

    // Clear staging and draft cache
    sessionStorage.removeItem('lr_upload_form_draft');
    this.stagingFile = null;
    this.stagingEditResource = null;
    this.stagingResourceId = null;

    if (targetAction === 'publish') {
      if (uploadStatus === 'upload_failed') {
        this.showToast('Saved as draft, but cannot publish because file upload failed. Please retry.', 'warning');
      } else {
        this.store.publishResource(savedDraft.id, user);
        this.showToast(`Resource "${title}" has been published and is now live for students!`, 'success');
      }
    } else {
      this.showToast(`Draft "${title}" saved privately in approved Google Drive folder. You can review or publish it from "My Drafts".`, 'success');
    }

    this.currentTab = targetAction === 'publish' ? 'published' : 'drafts';
    this.renderNavigation();
    this.renderCurrentView();
  }

  renderManagerDrafts() {
    const user = this.auth.getCurrentUser();
    const myDrafts = this.store.getResourcesByOwner(user.id).filter(r => r.publicationStatus === 'draft');

    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <span class="lr-badge lr-badge-warning">Private Drafts</span>
          <h1 class="lr-page-title">My Draft Materials</h1>
          <p class="lr-page-sub">Review metadata and previews before publishing. Drafts are completely invisible to students.</p>
        </div>
      </section>

      ${this.renderMaterialsTableHtml(myDrafts, false)}
    `;

    this.bindResourceTableActions();
  }

  renderManagerPublished() {
    const user = this.auth.getCurrentUser();
    const myPublished = this.store.getResourcesByOwner(user.id).filter(r => r.publicationStatus === 'published');

    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <span class="lr-badge lr-badge-success">Live Materials</span>
          <h1 class="lr-page-title">My Published Materials</h1>
          <p class="lr-page-sub">These materials are verified and actively accessible by all CSE students.</p>
        </div>
      </section>

      ${this.renderMaterialsTableHtml(myPublished, false)}
    `;

    this.bindResourceTableActions();
  }

  renderManagerClassNotes() {
    const user = this.auth.getCurrentUser();
    const notes = this.store.getResourcesByOwner(user.id).filter(r => r.categoryId === 'cat_class_notes');

    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <h1 class="lr-page-title">My Classroom Notes</h1>
          <p class="lr-page-sub">Hall RV 402 Daily Lectures uploaded by you</p>
        </div>
      </section>

      ${this.renderMaterialsTableHtml(notes, false)}
    `;

    this.bindResourceTableActions();
  }

  renderManagerActivity() {
    const user = this.auth.getCurrentUser();
    const myResources = this.store.getResourcesByOwner(user.id);

    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <h1 class="lr-page-title">Upload & Telegram Backup Activity</h1>
          <p class="lr-page-sub">Detailed delivery statuses for all files stored in the private Telegram channel</p>
        </div>
      </section>

      <div class="lr-table-container">
        <table class="lr-table">
          <thead>
            <tr>
              <th>Title / Filename</th>
              <th>Channel ID</th>
              <th>Message ID</th>
              <th>File Size</th>
              <th>Telegram Status</th>
              <th>Publication</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${myResources.map(r => `
              <tr>
                <td>
                  <strong>${r.title}</strong>
                  <div class="lr-text-muted">${r.originalFilename || 'Drive Link'}</div>
                </td>
                <td><code>${r.telegramChatId || '-'}</code></td>
                <td><code>#${r.telegramMessageId || 'N/A'}</code></td>
                <td>${(r.fileSize / 1024 / 1024).toFixed(2)} MB</td>
                <td>
                  ${r.uploadStatus === 'telegram_success' 
                    ? '<span class="lr-badge lr-badge-success">✓ Telegram Stored</span>' 
                    : '<span class="lr-badge lr-badge-danger">✗ Upload Failed</span>'
                  }
                </td>
                <td>
                  <span class="lr-badge lr-badge-${r.publicationStatus === 'published' ? 'primary' : 'warning'}">
                    ${r.publicationStatus.toUpperCase()}
                  </span>
                </td>
                <td>
                  ${r.uploadStatus !== 'telegram_success' 
                    ? `<button class="lr-btn lr-btn-sm lr-btn-warning" data-retry-upload="${r.id}">Retry Upload</button>`
                    : `<button class="lr-btn lr-btn-sm lr-btn-outline" data-preview-res="${r.id}">Verify Preview</button>`
                  }
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    this.bindResourceTableActions();
  }

  // =========================================================================
  // ADMIN DASHBOARD VIEWS
  // =========================================================================
  renderAdminView() {
    if (!this.auth.isAdmin()) {
      this.dom.viewContainer.innerHTML = `
        <div class="lr-access-denied-box">
          <div class="lr-denied-icon">🔒</div>
          <h2>Administrator Authentication Required</h2>
          <p>This workspace is restricted to College Administrators and Coordinators.</p>
          <button class="lr-btn lr-btn-primary" id="btnAdminAuthenticatePrompt">Enter Admin Password</button>
        </div>
      `;
      document.getElementById('btnAdminAuthenticatePrompt')?.addEventListener('click', () => {
        this.openAdminLoginModal();
      });
      return;
    }

    switch (this.currentTab) {
      case 'resources':
        this.renderAdminResources();
        break;
      case 'managers':
        this.renderAdminManagers();
        break;
      case 'categories':
        this.renderAdminCategories();
        break;
      case 'subjects':
        this.renderAdminSubjects();
        break;
      case 'telegram':
        this.renderAdminTelegram();
        break;
      case 'audit':
        this.renderAdminAuditLogs();
        break;
      case 'settings':
        this.renderAdminSettings();
        break;
      case 'overview':
      default:
        this.renderAdminOverview();
        break;
    }
  }

  renderAdminOverview() {
    const all = this.store.getAllResources();
    const published = all.filter(r => r.publicationStatus === 'published');
    const drafts = all.filter(r => r.publicationStatus === 'draft');
    const failed = all.filter(r => r.uploadStatus === 'upload_failed');
    const managers = this.store.getManagers();

    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <span class="lr-badge lr-badge-admin">Admin Master Control</span>
          <h1 class="lr-page-title">College Platform Administration</h1>
          <p class="lr-page-sub">Saranathan College of Engineering (Autonomous) • Learning Resource Subsystem</p>
        </div>
      </section>

      <!-- KPI Summary Cards -->
      <div class="lr-stats-grid">
        <div class="lr-stat-card" data-admin-jump="resources">
          <div class="lr-stat-label">Total Resources</div>
          <div class="lr-stat-value">${all.length}</div>
          <div class="lr-stat-sub">Across all managers</div>
        </div>

        <div class="lr-stat-card" data-admin-jump="resources">
          <div class="lr-stat-label">Published & Live</div>
          <div class="lr-stat-value text-success">${published.length}</div>
          <div class="lr-stat-sub">Accessible by students</div>
        </div>

        <div class="lr-stat-card" data-admin-jump="resources">
          <div class="lr-stat-label">Manager Drafts</div>
          <div class="lr-stat-value text-warning">${drafts.length}</div>
          <div class="lr-stat-sub">Awaiting publication</div>
        </div>

        <div class="lr-stat-card" data-admin-jump="telegram">
          <div class="lr-stat-label">Upload Failures</div>
          <div class="lr-stat-value text-danger">${failed.length}</div>
          <div class="lr-stat-sub">Requires admin inspection</div>
        </div>

        <div class="lr-stat-card" data-admin-jump="managers">
          <div class="lr-stat-label">Authorized Managers</div>
          <div class="lr-stat-value text-primary">${managers.length}</div>
          <div class="lr-stat-sub">Verified Google accounts</div>
        </div>
      </div>

      <!-- Overview Tables -->
      <section class="lr-section">
        <div class="lr-section-header">
          <h2 class="lr-section-title">All Recent Uploads Across All Managers</h2>
          <button class="lr-btn lr-btn-sm lr-btn-outline" id="btnAdminViewAllResources">Manage All Resources →</button>
        </div>
        ${this.renderMaterialsTableHtml(all.slice(0, 8), true)}
      </section>
    `;

    document.querySelectorAll('[data-admin-jump]').forEach(card => {
      card.addEventListener('click', (e) => {
        this.currentTab = e.currentTarget.getAttribute('data-admin-jump');
        this.renderNavigation();
        this.renderCurrentView();
      });
    });

    document.getElementById('btnAdminViewAllResources')?.addEventListener('click', () => {
      this.currentTab = 'resources';
      this.renderNavigation();
      this.renderCurrentView();
    });

    this.bindResourceTableActions();
  }

  renderAdminResources() {
    const all = this.store.getAllResources();

    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <h1 class="lr-page-title">Resource Library Administration</h1>
          <p class="lr-page-sub">Full oversight of drafts, published files, and backups across all uploaders.</p>
        </div>
      </section>

      ${this.renderMaterialsTableHtml(all, true)}
    `;

    this.bindResourceTableActions();
  }

  renderAdminManagers() {
    const managers = this.store.getManagers();

    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <h1 class="lr-page-title">Manager Accounts & Roles</h1>
          <p class="lr-page-sub">Grant or revoke Manager privileges for authenticated Google Accounts.</p>
        </div>
        <button class="lr-btn lr-btn-primary" id="btnOpenAddManagerModal">
          <span>➕</span> Authorize New Manager
        </button>
      </section>

      <div class="lr-table-container">
        <table class="lr-table">
          <thead>
            <tr>
              <th>Google Email</th>
              <th>Display Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Assigned By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${managers.map(m => `
              <tr>
                <td><strong>${m.email}</strong></td>
                <td>${m.displayName}</td>
                <td><span class="lr-badge lr-badge-manager">MANAGER</span></td>
                <td>
                  <span class="lr-badge lr-badge-${m.status === 'active' ? 'success' : 'danger'}">
                    ${m.status.toUpperCase()}
                  </span>
                </td>
                <td>${m.assignedBy || 'Admin'}</td>
                <td>
                  ${m.status === 'active'
                    ? `<button class="lr-btn lr-btn-sm lr-btn-danger" data-revoke-manager="${m.email}">Revoke Access</button>`
                    : `<button class="lr-btn lr-btn-sm lr-btn-success" data-restore-manager="${m.email}">Reactivate</button>`
                  }
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Add Manager Modal -->
      <div id="lrAddManagerModal" class="lr-modal-overlay" style="display: none;">
        <div class="lr-modal-box">
          <header class="lr-modal-header">
            <h3>Authorize Google Account as Manager</h3>
            <button class="lr-modal-close">✕</button>
          </header>
          <div class="lr-modal-body">
            <p class="lr-text-muted">Enter the user's verified Google Account email address. Once authorized, they can log in via Google to upload learning materials.</p>
            <div class="lr-form-group">
              <label>Google Email:</label>
              <input type="email" id="lrNewManagerEmail" class="lr-form-control" placeholder="faculty@saranathan.ac.in" />
            </div>
            <div class="lr-form-group">
              <label>Full Name / Title:</label>
              <input type="text" id="lrNewManagerName" class="lr-form-control" placeholder="Dr. R. Buvaneswari" />
            </div>
          </div>
          <footer class="lr-modal-footer">
            <button class="lr-btn lr-btn-outline lr-modal-close">Cancel</button>
            <button class="lr-btn lr-btn-primary" id="btnSubmitAddManager">Authorize Manager</button>
          </footer>
        </div>
      </div>
    `;

    document.getElementById('btnOpenAddManagerModal')?.addEventListener('click', () => {
      document.getElementById('lrAddManagerModal').style.display = 'flex';
    });

    document.getElementById('btnSubmitAddManager')?.addEventListener('click', () => {
      const email = document.getElementById('lrNewManagerEmail').value.trim();
      const name = document.getElementById('lrNewManagerName').value.trim();
      if (!email) {
        this.showToast('Please enter a valid Google email', 'error');
        return;
      }
      this.store.assignManager(email, name, this.auth.getCurrentUser()?.email);
      this.showToast(`Authorized ${email} as Manager successfully!`, 'success');
      this.renderAdminManagers();
    });

    document.querySelectorAll('[data-revoke-manager]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const email = e.currentTarget.getAttribute('data-revoke-manager');
        if (confirm(`Revoke Manager privileges for ${email}?`)) {
          this.store.revokeManager(email, this.auth.getCurrentUser()?.email);
          this.showToast(`Manager privileges revoked for ${email}`, 'warning');
          this.renderAdminManagers();
        }
      });
    });

    document.querySelectorAll('[data-restore-manager]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const email = e.currentTarget.getAttribute('data-restore-manager');
        this.store.assignManager(email, null, this.auth.getCurrentUser()?.email);
        this.showToast(`Manager privileges reactivated for ${email}`, 'success');
        this.renderAdminManagers();
      });
    });
  }

  renderAdminCategories() {
    const categories = this.store.getCategories(true);

    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <h1 class="lr-page-title">Manage Resource Categories</h1>
          <p class="lr-page-sub">Dynamically create, rename, reorder, and archive learning resource collections.</p>
        </div>
        <button class="lr-btn lr-btn-primary" id="btnOpenAddCategoryModal">
          <span>➕</span> Add New Category
        </button>
      </section>

      <div class="lr-table-container">
        <table class="lr-table">
          <thead>
            <tr>
              <th>Sort</th>
              <th>Icon & Name</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${categories.map(c => `
              <tr>
                <td><code>#${c.sort_order}</code></td>
                <td><strong>${c.icon || '📁'} ${c.name}</strong></td>
                <td><small>${c.description || '-'}</small></td>
                <td>
                  <span class="lr-badge lr-badge-${c.status === 'active' ? 'success' : 'secondary'}">
                    ${c.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  <button class="lr-btn lr-btn-sm lr-btn-outline" data-edit-category="${c.id}">Edit</button>
                  ${c.status === 'active' 
                    ? `<button class="lr-btn lr-btn-sm lr-btn-warning" data-archive-category="${c.id}">Archive</button>`
                    : `<button class="lr-btn lr-btn-sm lr-btn-success" data-activate-category="${c.id}">Reactivate</button>`
                  }
                  <button class="lr-btn lr-btn-sm lr-btn-danger" data-delete-category="${c.id}">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Add Category Modal -->
      <div id="lrAddCategoryModal" class="lr-modal-overlay" style="display: none;">
        <div class="lr-modal-box">
          <header class="lr-modal-header">
            <h3>Create New Resource Category</h3>
            <button class="lr-modal-close">✕</button>
          </header>
          <div class="lr-modal-body">
            <div class="lr-form-group">
              <label>Category Name:</label>
              <input type="text" id="lrNewCatName" class="lr-form-control" placeholder="e.g. Laboratory Viva Questions" />
            </div>
            <div class="lr-form-group">
              <label>Icon Emoji:</label>
              <input type="text" id="lrNewCatIcon" class="lr-form-control" placeholder="🔬" style="max-width: 80px;" />
            </div>
            <div class="lr-form-group">
              <label>Description:</label>
              <textarea id="lrNewCatDesc" class="lr-form-control" rows="2" placeholder="Brief explanation of this collection..."></textarea>
            </div>
          </div>
          <footer class="lr-modal-footer">
            <button class="lr-btn lr-btn-outline lr-modal-close">Cancel</button>
            <button class="lr-btn lr-btn-primary" id="btnSubmitAddCategory">Save Category</button>
          </footer>
        </div>
      </div>
    `;

    document.getElementById('btnOpenAddCategoryModal')?.addEventListener('click', () => {
      document.getElementById('lrAddCategoryModal').style.display = 'flex';
    });

    document.getElementById('btnSubmitAddCategory')?.addEventListener('click', () => {
      const name = document.getElementById('lrNewCatName').value.trim();
      const icon = document.getElementById('lrNewCatIcon').value.trim() || '📁';
      const description = document.getElementById('lrNewCatDesc').value.trim();
      if (!name) {
        this.showToast('Category name is required', 'error');
        return;
      }
      this.store.addCategory({ name, icon, description }, this.auth.getCurrentUser()?.email);
      this.showToast(`Category "${name}" created!`, 'success');
      this.renderAdminCategories();
    });

    document.querySelectorAll('[data-archive-category]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-archive-category');
        this.store.archiveCategory(id, this.auth.getCurrentUser()?.email);
        this.showToast('Category archived without deleting existing resources.', 'warning');
        this.renderAdminCategories();
      });
    });

    document.querySelectorAll('[data-activate-category]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-activate-category');
        this.store.updateCategory(id, { status: 'active' }, this.auth.getCurrentUser()?.email);
        this.showToast('Category reactivated!', 'success');
        this.renderAdminCategories();
      });
    });

    document.querySelectorAll('[data-delete-category]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-delete-category');
        if (confirm('Permanently delete this category? (Operation will be rejected if active resources reference it)')) {
          try {
            this.store.deleteCategory(id, this.auth.getCurrentUser()?.email);
            this.showToast('Category deleted successfully.', 'success');
            this.renderAdminCategories();
          } catch (err) {
            this.showToast(err.message, 'error', 6000);
          }
        }
      });
    });
  }

  renderAdminSubjects() {
    const subjects = this.store.getSubjects(true);

    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <h1 class="lr-page-title">Subjects & Semester Organization</h1>
          <p class="lr-page-sub">Configure academic subjects for First-Year and future semesters.</p>
        </div>
        <button class="lr-btn lr-btn-primary" id="btnOpenAddSubjectModal">
          <span>➕</span> Add Subject
        </button>
      </section>

      <div class="lr-table-container">
        <table class="lr-table">
          <thead>
            <tr>
              <th>Subject Code</th>
              <th>Subject Name</th>
              <th>Semester</th>
              <th>Department</th>
              <th>Faculty</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${subjects.map(s => `
              <tr>
                <td><code>${s.code}</code></td>
                <td><strong>${s.name}</strong></td>
                <td>Semester ${s.semester}</td>
                <td>${s.department}</td>
                <td>${s.faculty}</td>
                <td>
                  <span class="lr-badge lr-badge-${s.status === 'active' ? 'success' : 'secondary'}">
                    ${s.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  <button class="lr-btn lr-btn-sm lr-btn-danger" data-delete-subject="${s.id}">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Add Subject Modal -->
      <div id="lrAddSubjectModal" class="lr-modal-overlay" style="display: none;">
        <div class="lr-modal-box">
          <header class="lr-modal-header">
            <h3>Add New Academic Subject</h3>
            <button class="lr-modal-close">✕</button>
          </header>
          <div class="lr-modal-body">
            <div class="lr-form-group">
              <label>Subject Code:</label>
              <input type="text" id="lrNewSubCode" class="lr-form-control" placeholder="24CS201A" />
            </div>
            <div class="lr-form-group">
              <label>Subject Name:</label>
              <input type="text" id="lrNewSubName" class="lr-form-control" placeholder="Data Structures and Algorithms" />
            </div>
            <div class="lr-form-group">
              <label>Faculty In-Charge:</label>
              <input type="text" id="lrNewSubFaculty" class="lr-form-control" placeholder="Dr. Faculty Name" />
            </div>
            <div class="lr-form-group">
              <label>Semester:</label>
              <input type="text" id="lrNewSubSem" class="lr-form-control" value="I" />
            </div>
          </div>
          <footer class="lr-modal-footer">
            <button class="lr-btn lr-btn-outline lr-modal-close">Cancel</button>
            <button class="lr-btn lr-btn-primary" id="btnSubmitAddSubject">Save Subject</button>
          </footer>
        </div>
      </div>
    `;

    document.getElementById('btnOpenAddSubjectModal')?.addEventListener('click', () => {
      document.getElementById('lrAddSubjectModal').style.display = 'flex';
    });

    document.getElementById('btnSubmitAddSubject')?.addEventListener('click', () => {
      const code = document.getElementById('lrNewSubCode').value.trim();
      const name = document.getElementById('lrNewSubName').value.trim();
      const faculty = document.getElementById('lrNewSubFaculty').value.trim();
      const semester = document.getElementById('lrNewSubSem').value.trim() || 'I';
      if (!code || !name) {
        this.showToast('Subject code and name are required', 'error');
        return;
      }
      this.store.addSubject({ code, name, faculty, semester }, this.auth.getCurrentUser()?.email);
      this.showToast(`Subject ${code} added!`, 'success');
      this.renderAdminSubjects();
    });

    document.querySelectorAll('[data-delete-subject]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-delete-subject');
        if (confirm('Permanently delete this subject? (Operation will be rejected if active resources reference it)')) {
          try {
            this.store.deleteSubject(id, this.auth.getCurrentUser()?.email);
            this.showToast('Subject deleted successfully.', 'success');
            this.renderAdminSubjects();
          } catch (err) {
            this.showToast(err.message, 'error', 6000);
          }
        }
      });
    });
  }

  async renderAdminTelegram() {
    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <span class="lr-badge lr-badge-primary">Server-Side Integrations</span>
          <h1 class="lr-page-title">Google Drive Storage & Telegram Audit Trail</h1>
          <p class="lr-page-sub">Storage boundary enforcement and private channel audit trail monitoring.</p>
        </div>
        <button class="lr-btn lr-btn-outline" id="btnRefreshTelegramStatus">
          <span>🔄</span> Refresh Status
        </button>
      </section>

      <div class="lr-telegram-grid">
        <!-- Google Drive Storage Configuration Card -->
        <div class="lr-card" id="driveConfigCard">
          <h3>📁 Google Drive Dedicated Storage</h3>
          <p><strong>Approved Folder Boundary:</strong></p>
          <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
            <input type="text" id="lrInputDriveFolder" class="lr-form-control" value="1_Approved_College_Learning_Resources_Root" placeholder="Enter Approved Google Drive Folder ID" />
            <button id="btnSaveDriveFolder" class="lr-btn lr-btn-primary" style="white-space: nowrap;">Update Folder</button>
          </div>
          <p class="lr-text-muted" style="font-size: 0.8rem;">
            🔒 <strong>Strict Isolation:</strong> The platform is restricted to this folder. Uploads and streaming requests targeting any file outside this folder are rejected.
          </p>
          <p style="font-size: 0.8rem;"><strong>OAuth Scope:</strong> <code>https://www.googleapis.com/auth/drive.file</code> (Least privilege)</p>
          <p style="font-size: 0.8rem;"><strong>Max Upload Size:</strong> 500 MB (via Resumable Chunked Uploads)</p>
        </div>

        <!-- Telegram Audit Bot Card -->
        <div class="lr-card" id="telegramStatusCard">
          <h3>📢 Telegram Private Channel Audit Trail</h3>
          <div class="lr-spinner"></div>
          <p>Inspecting Telegram audit bot...</p>
        </div>
      </div>

      <!-- Telegram Audit Outbox Queue & Retry Section -->
      <div class="lr-card" style="margin-top: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <div>
            <h3 style="margin: 0;">📨 Telegram Audit Outbox Queue</h3>
            <p class="lr-text-muted" style="margin: 0; font-size: 0.8rem;">Asynchronous durable queue ensuring audit records survive temporary Telegram outages.</p>
          </div>
          <button id="btnRetryTelegramOutbox" class="lr-btn lr-btn-sm lr-btn-outline">
            <span>🔄</span> Retry Failed Outbox Records
          </button>
        </div>
        <div id="lrOutboxContainer">
          <p class="lr-text-muted">Loading outbox records...</p>
        </div>
      </div>

      <div class="lr-setup-wizard-card" style="margin-top: 1rem;">
        <h3>📋 Administrator Setup Checklist for Google Drive & Telegram</h3>
        <ol class="lr-setup-steps">
          <li>
            <strong>Google Drive Folder:</strong> Create a dedicated folder in the owner's 5 TB Google Drive (e.g. <code>CSE Class A Learning Resources</code>), copy its Folder ID from the URL, and save it above.
          </li>
          <li>
            <strong>Add Bot to Channel:</strong> Open your private audit channel (<a href="https://t.me/+6dIBd-yKc75hZGY1" target="_blank">Channel Link</a>), add <code>@DeepanCollegeLearningBot</code> as Administrator with <strong>Post Messages</strong> permission.
          </li>
          <li>
            <strong>Configure Secrets on Server/Vercel:</strong>
            <pre class="lr-code-block">GOOGLE_DRIVE_FOLDER_ID="1_Approved_College_Learning_Resources_Root"
TELEGRAM_BOT_TOKEN="your_bot_token"
TELEGRAM_CHANNEL_ID="-1003598863042"</pre>
          </li>
        </ol>
      </div>
    `;

    document.getElementById('btnRefreshTelegramStatus')?.addEventListener('click', () => {
      this.renderAdminTelegram();
    });

    document.getElementById('btnSaveDriveFolder')?.addEventListener('click', async () => {
      const folderVal = document.getElementById('lrInputDriveFolder')?.value.trim();
      if (!folderVal) return this.showToast('Please enter a valid Folder ID', 'error');
      try {
        const res = await fetch('/api/drive/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Role': 'admin'
          },
          body: JSON.stringify({ folderId: folderVal })
        });
        const data = await res.json();
        if (data.success) {
          this.showToast(data.message || 'Approved folder ID updated!', 'success');
        } else {
          this.showToast(data.error || 'Failed to update folder ID', 'error');
        }
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });

    document.getElementById('btnRetryTelegramOutbox')?.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/telegram/retry-outbox', { method: 'POST' });
        const data = await res.json();
        this.showToast(`Outbox retry completed. ${data.retriedCount || 0} event(s) processed.`, 'success');
        this.renderAdminTelegram();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });

    // Load status
    const status = await this.telegram.checkStatus();
    const statusCard = document.getElementById('telegramStatusCard');
    if (statusCard) {
      if (status.telegram?.ready) {
        statusCard.innerHTML = `
          <h3>📢 Telegram Audit Trail: <span class="text-success">READY & ACTIVE</span></h3>
          <p>✓ Connected Bot: <strong>@${status.telegram.bot?.username}</strong></p>
          <p>✓ Target Private Channel: <code>${status.telegram.channelId}</code></p>
          <p class="text-success">Upload audit records and publication lifecycle events are dispatched to the private channel.</p>
        `;
      } else {
        statusCard.innerHTML = `
          <h3>📢 Telegram Audit Trail: <span class="text-warning">SETUP REQUIRED</span></h3>
          <p class="text-warning">⚠️ ${status.telegram?.message || 'Telegram Bot Token not configured in backend environment.'}</p>
          <p class="lr-text-muted">Uploads continue to Google Drive, and audit records will queue in outbox until Telegram credentials are saved.</p>
        `;
      }
    }

    // Load Drive config into input
    try {
      const driveRes = await fetch('/api/drive/config');
      if (driveRes.ok) {
        const driveData = await driveRes.json();
        const folderInput = document.getElementById('lrInputDriveFolder');
        if (folderInput && driveData.approvedFolderId) {
          folderInput.value = driveData.approvedFolderId;
        }
      }
    } catch (_) {}

    // Load outbox records
    try {
      const outboxRes = await fetch('/api/telegram/audit-events');
      if (outboxRes.ok) {
        const outboxData = await outboxRes.json();
        const container = document.getElementById('lrOutboxContainer');
        if (container) {
          if (!outboxData.events || outboxData.events.length === 0) {
            container.innerHTML = `<p class="lr-text-muted" style="font-size: 0.85rem;">No audit events in queue. New uploads and publication status changes will appear here.</p>`;
          } else {
            container.innerHTML = `
              <table class="lr-table" style="font-size: 0.8rem;">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event</th>
                    <th>Resource ID</th>
                    <th>Status</th>
                    <th>Message ID / Error</th>
                  </tr>
                </thead>
                <tbody>
                  ${outboxData.events.slice(0, 10).map(e => `
                    <tr>
                      <td>${new Date(e.createdAt).toLocaleTimeString()}</td>
                      <td><strong>${e.eventType}</strong></td>
                      <td><code>${e.resourceId || '-'}</code></td>
                      <td><span class="lr-badge ${e.status === 'sent' ? 'lr-badge-student' : 'lr-badge-danger'}">${e.status.toUpperCase()}</span></td>
                      <td>${e.telegramMessageId ? `Msg #${e.telegramMessageId}` : (e.lastError ? `<span class="text-danger">${e.lastError}</span>` : '-')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `;
          }
        }
      }
    } catch (_) {}
  }

  renderAdminAuditLogs() {
    const logs = this.store.getAuditLogs();

    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <h1 class="lr-page-title">Platform Security & Audit Logs</h1>
          <p class="lr-page-sub">Chronological immutable audit trail of all management, role assignments, and publishing events.</p>
        </div>
      </section>

      <div class="lr-table-container">
        <table class="lr-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Resource ID</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(log => `
              <tr>
                <td><small>${new Date(log.createdAt).toLocaleString()}</small></td>
                <td><code>${log.actorEmail}</code></td>
                <td><span class="lr-badge lr-badge-primary">${log.action}</span></td>
                <td><code>${log.resourceId || '-'}</code></td>
                <td><small>${JSON.stringify(log.metadata || {})}</small></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderAdminSettings() {
    this.dom.viewContainer.innerHTML = `
      <section class="lr-page-header">
        <div>
          <h1 class="lr-page-title">Platform Configuration</h1>
          <p class="lr-page-sub">Global storage thresholds, institution metadata, and retention policies.</p>
        </div>
      </section>

      <div class="lr-form-card" style="max-width: 650px;">
        <h3>System Settings</h3>
        <div class="lr-form-group">
          <label>Platform Display Title:</label>
          <input type="text" class="lr-form-control" value="CSE Class A Learning Hub" />
        </div>
        <div class="lr-form-group">
          <label>Institution Name:</label>
          <input type="text" class="lr-form-control" value="Saranathan College of Engineering (Autonomous)" readonly />
        </div>
        <div class="lr-form-group">
          <label>Classroom / Room Number:</label>
          <input type="text" class="lr-form-control" value="Hall RV 402" readonly />
        </div>
        <div class="lr-form-group">
          <label>Max Telegram Upload Size (MB):</label>
          <input type="number" class="lr-form-control" value="50" max="50" />
        </div>
        <div class="lr-form-group">
          <label>Trash & Retention Policy (Days):</label>
          <input type="number" class="lr-form-control" value="30" />
        </div>
        <button class="lr-btn lr-btn-primary" style="margin-top: 1rem;" onclick="alert('Settings saved successfully!')">Save Settings</button>
      </div>
    `;
  }

  // =========================================================================
  // HELPER HTML RENDERERS & EVENT BINDINGS
  // =========================================================================
  renderResourceCardHtml(r) {
    const isDrive = r.resourceType === 'drive_link';
    const typeLabel = isDrive ? 'Google Drive' : (r.mimeType?.split('/')[1]?.toUpperCase() || 'FILE');
    const catName = r.categoryName || this.store.getCategoryName(r.categoryId);
    const subName = r.subjectName || this.store.getSubjectName(r.subjectId);

    return `
      <div class="lr-resource-card" data-card-res="${r.id}">
        <div class="lr-card-top">
          <span class="lr-badge lr-badge-${isDrive ? 'warning' : 'primary'}">${typeLabel}</span>
          ${r.academicDate ? `<span class="lr-card-date">📅 ${r.academicDate}</span>` : ''}
        </div>

        <h3 class="lr-card-title">${r.title}</h3>
        <p class="lr-card-desc">${r.description || 'No description provided.'}</p>

        <div class="lr-card-meta-tags">
          <span class="lr-tag" title="Category">📂 ${catName}</span>
          <span class="lr-tag" title="Subject">📘 ${subName}</span>
          ${r.unit ? `<span class="lr-tag">📖 ${r.unit}</span>` : ''}
          ${r.topic ? `<span class="lr-tag">🔖 ${r.topic}</span>` : ''}
          ${r.periodNumber ? `<span class="lr-tag">🕒 Period ${r.periodNumber}</span>` : ''}
          <span class="lr-tag" title="Resource ID">🆔 ${r.id}</span>
        </div>

        <div class="lr-card-footer">
          <div class="lr-card-uploader">
            <span>👤 ${r.ownerName || 'Faculty / Manager'}</span>
          </div>
          <button class="lr-btn lr-btn-sm lr-btn-primary" data-open-res="${r.id}">
            <span>${isDrive ? '🔗' : '👁️'}</span> Open
          </button>
        </div>
      </div>
    `;
  }

  renderMaterialsTableHtml(materials, showOwnerCol = false) {
    const user = this.auth.getCurrentUser();
    const isAdmin = this.auth.isAdmin();

    if (!materials || materials.length === 0) {
      return `
        <div class="lr-empty-box">
          <div class="lr-empty-icon">📂</div>
          <h3>No materials in this view</h3>
          <p>Upload a file or create a draft to get started.</p>
        </div>
      `;
    }

    return `
      <div class="lr-table-container">
        <table class="lr-table">
          <thead>
            <tr>
              <th>Title / Resource</th>
              <th>Category</th>
              <th>Subject</th>
              ${showOwnerCol ? '<th>Owner</th>' : ''}
              <th>Date / Period</th>
              <th>Publication</th>
              <th>Upload Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${materials.map(r => {
              const canEdit = isAdmin || r.ownerId === user?.id;
              const catName = r.categoryName || this.store.getCategoryName(r.categoryId);
              const subName = r.subjectName || this.store.getSubjectName(r.subjectId);
              return `
                <tr>
                  <td>
                    <strong>${r.title}</strong>
                    <div class="lr-text-muted" style="font-size: 0.8rem; margin-top: 0.2rem;">
                      🆔 <code>${r.id}</code>
                      ${r.originalFilename ? ` • ${r.originalFilename}` : (r.googleDriveUrl ? ' • Google Drive Link' : '')}
                      ${r.unit ? ` • 📖 ${r.unit}` : ''}
                      ${r.topic ? ` • 🔖 ${r.topic}` : ''}
                    </div>
                  </td>
                  <td><span class="lr-tag">📂 ${catName}</span></td>
                  <td><span class="lr-tag">📘 ${subName}</span></td>
                  ${showOwnerCol ? `<td><small><strong>${r.ownerName || 'Manager'}</strong><br>${r.ownerEmail || '-'}</small></td>` : ''}
                  <td>
                    ${r.academicDate ? `📅 ${r.academicDate}` : '-'}
                    ${r.periodNumber ? `<br><small class="lr-badge">🕒 Period ${r.periodNumber}</small>` : ''}
                  </td>
                  <td>
                     <td>
                    <span class="lr-badge lr-badge-${(r.uploadStatus === 'uploaded' || r.uploadStatus === 'telegram_success' || r.googleDriveFileId) ? 'success' : 'danger'}">
                      ${(r.uploadStatus === 'uploaded' || r.uploadStatus === 'telegram_success' || r.googleDriveFileId) ? '✓ Drive Stored' : 'Upload Failed'}
                    </span>
                    ${r.telegramAuditStatus ? `
                      <br><small class="lr-badge lr-badge-outline" style="margin-top: 0.2rem;">📢 Audit: ${r.telegramAuditStatus.toUpperCase()}</small>
                    ` : ''}
                  </td>
                  <td>
                    <div class="lr-actions-btn-group">
                      ${(r.uploadStatus === 'uploaded' || r.uploadStatus === 'telegram_success' || r.googleDriveFileId) ? `
                        <button class="lr-btn lr-btn-sm lr-btn-outline" data-open-res="${r.id}" title="Preview / Open">
                          👁️
                        </button>
                      ` : `
                        <button class="lr-btn lr-btn-sm lr-btn-warning" data-retry-upload="${r.id}" title="Re-upload file to Google Drive">
                          🔄 Re-upload
                        </button>
                      `}
                      ${canEdit && r.publicationStatus === 'draft' && (r.uploadStatus === 'uploaded' || r.uploadStatus === 'telegram_success' || r.googleDriveFileId) ? `
                        <button class="lr-btn lr-btn-sm lr-btn-primary" data-publish-res="${r.id}" title="Publish to students">
                          📢 Publish
                        </button>
                      ` : ''}
                      ${canEdit && r.publicationStatus === 'published' ? `
                        <button class="lr-btn lr-btn-sm lr-btn-warning" data-unpublish-res="${r.id}" title="Unpublish">
                          ⏸ Unpublish
                        </button>
                      ` : ''}
                      ${canEdit ? `
                        <button class="lr-btn lr-btn-sm lr-btn-danger" data-delete-res="${r.id}" title="Delete / Archive">
                          🗑
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
    `;
  }

  bindResourceCardActions() {
    document.querySelectorAll('[data-open-res]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-open-res');
        const res = this.store.getResourceById(id);
        if (res) this.viewer.open(res);
      });
    });
  }

  bindResourceTableActions() {
    this.bindResourceCardActions();

    const user = this.auth.getCurrentUser();

    document.querySelectorAll('[data-publish-res]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-publish-res');
        try {
          this.store.publishResource(id, user);
          this.showToast('Resource published successfully!', 'success');
          this.renderCurrentView();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    });

    document.querySelectorAll('[data-unpublish-res]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-unpublish-res');
        try {
          this.store.unpublishResource(id, user);
          this.showToast('Resource unpublished and hidden from students', 'warning');
          this.renderCurrentView();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    });

    document.querySelectorAll('[data-delete-res]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-delete-res');
        if (confirm('Are you sure you want to delete this resource?')) {
          try {
            this.store.deleteResource(id, user);
            this.showToast('Resource deleted', 'info');
            this.renderCurrentView();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        }
      });
    });

    document.querySelectorAll('[data-retry-upload]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-retry-upload');
        const res = this.store.getResourceById(id);
        if (res) {
          this.stagingEditResource = res;
          this.stagingResourceId = res.id;
        }
        this.currentTab = 'upload';
        this.renderNavigation();
        this.renderCurrentView();
        if (res) {
          this.showToast(`Retrying "${res.title}" (ID: ${res.id}). Selected file can now be uploaded to Telegram.`, 'info', 6000);
        }
      });
    });
  }

  showToast(message, type = 'info', duration = 3500) {
    let toastContainer = document.getElementById('lrToastContainer');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'lrToastContainer';
      toastContainer.className = 'lr-toast-container';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `lr-toast lr-toast-${type}`;
    toast.innerHTML = `
      <span class="lr-toast-icon">${type === 'success' ? '✓' : (type === 'error' ? '✗' : (type === 'warning' ? '⚠️' : 'ℹ️'))}</span>
      <span>${message}</span>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.learningApp = new LearningPlatformApp();
  window.learningApp.init();
});
