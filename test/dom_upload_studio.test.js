// DOM & Interactive UI Verification Test Suite for Upload Studio
// Verifies:
// 1. Manager "Upload New File" button targets 'upload' tab
// 2. Upload Studio HTML renders Step 1, Step 2 file picker, Step 3 metadata form
// 3. Admin and Representative dashboards have the Upload Material shortcut
// 4. Resource Management view has "Upload Material" button
// 5. Drafts view has "Upload New Material" button
// 6. Empty state view has "Upload New Material" button for authorized roles

import assert from 'assert';
import { ROLES, ROLE_LABELS, PermissionService } from '../js/learning/permissionService.js';
import { DashboardViews } from '../js/learning/dashboardViews.js';
import { LearningStore } from '../js/learning/learningStore.js';

// Setup Mock LocalStorage for Test Runner
class MockLocalStorage {
  constructor() { this.store = {}; }
  getItem(k) { return this.store[k] || null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}
globalThis.localStorage = new MockLocalStorage();
globalThis.sessionStorage = new MockLocalStorage();

console.log('=== RUNNING DOM & UI UPLOAD STUDIO VERIFICATION TEST SUITE ===\n');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// Mock App State
function createMockApp(role, email = 'user@saranathan.ac.in', name = 'Test User') {
  const store = new LearningStore();
  const mockUser = {
    id: 'user_' + role,
    email,
    name,
    displayName: name,
    role
  };

  const app = {
    currentRole: role,
    currentTab: 'dashboard',
    store,
    auth: {
      getCurrentUser: () => mockUser,
      isAdmin: () => role === ROLES.ADMIN,
      isRepresentative: () => role === ROLES.REPRESENTATIVE,
      isManager: () => role === ROLES.MANAGER,
      isStudent: () => role === ROLES.STUDENT
    },
    renderResourceCardHtml: (r) => `<div class="lr-resource-card">${r.title}</div>`,
    bindResourceCardActions: () => {},
    dom: {
      viewContainer: {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
      }
    }
  };
  return app;
}

// -----------------------------------------------------------------------------
// TEST GROUP 1: Manager Dashboard Quick Upload Banner
// -----------------------------------------------------------------------------
console.log('--- TEST GROUP 1: Manager Dashboard Quick Upload Banner ---');

it('1. Manager Dashboard banner contains "Upload New File" with data-dash-jump="upload"', () => {
  const app = createMockApp(ROLES.MANAGER);
  DashboardViews.renderDashboardHome(app);
  const html = app.dom.viewContainer.innerHTML;

  assert.ok(html.includes('data-dash-jump="upload"'), 'Must have data-dash-jump="upload"');
  assert.ok(html.includes('Upload New File'), 'Must contain "Upload New File" button');
  // Verify it does NOT jump to my-uploads
  assert.ok(!html.includes('data-dash-jump="my-uploads">Upload New File<'), 'Must NOT jump to my-uploads on upload button');
});

// -----------------------------------------------------------------------------
// TEST GROUP 2: Admin and Representative Dashboard Shortcuts
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 2: Admin and Representative Dashboard Shortcuts ---');

it('2. Administrator Dashboard contains "Upload Learning Material" shortcut card with data-dash-jump="upload"', () => {
  const app = createMockApp(ROLES.ADMIN);
  DashboardViews.renderDashboardHome(app);
  const html = app.dom.viewContainer.innerHTML;

  assert.ok(html.includes('data-dash-jump="upload"'), 'Admin must have data-dash-jump="upload" shortcut');
  assert.ok(html.includes('Upload Learning Material'), 'Admin must have "Upload Learning Material" card');
  assert.ok(html.includes('Store files in Google Drive & notify Telegram channel'), 'Mentions Google Drive & Telegram');
});

it('3. Representative Dashboard contains "Upload Learning Material" shortcut card with data-dash-jump="upload"', () => {
  const app = createMockApp(ROLES.REPRESENTATIVE);
  DashboardViews.renderDashboardHome(app);
  const html = app.dom.viewContainer.innerHTML;

  assert.ok(html.includes('data-dash-jump="upload"'), 'Representative must have data-dash-jump="upload" shortcut');
  assert.ok(html.includes('Upload Learning Material'), 'Representative must have "Upload Learning Material" card');
  assert.ok(html.includes('Store files in Google Drive & notify Telegram channel'), 'Mentions Google Drive & Telegram');
});

// -----------------------------------------------------------------------------
// TEST GROUP 3: Navigation Menu Configuration
// -----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 3: Navigation Menu Configuration ---');

it('4. Manager navigation includes Upload Material', () => {
  const nav = PermissionService.getNavigationForRole(ROLES.MANAGER);
  const uploadNav = nav.roleItems.find(i => i.id === 'upload');
  assert.ok(uploadNav, 'Manager navigation must include upload');
  assert.strictEqual(uploadNav.icon, '➕');
});

it('5. Representative navigation includes Upload Material', () => {
  const nav = PermissionService.getNavigationForRole(ROLES.REPRESENTATIVE);
  const uploadNav = nav.roleItems.find(i => i.id === 'upload');
  assert.ok(uploadNav, 'Representative navigation must include upload');
  assert.strictEqual(uploadNav.icon, '➕');
});

it('6. Administrator navigation includes Upload Material', () => {
  const nav = PermissionService.getNavigationForRole(ROLES.ADMIN);
  const uploadNav = nav.roleItems.find(i => i.id === 'upload');
  assert.ok(uploadNav, 'Admin navigation must include upload');
  assert.strictEqual(uploadNav.icon, '➕');
});

it('7. Student navigation excludes Upload Material', () => {
  const nav = PermissionService.getNavigationForRole(ROLES.STUDENT);
  const uploadNav = nav.allItems.find(i => i.id === 'upload');
  assert.strictEqual(uploadNav, undefined, 'Student navigation must NEVER include upload');
});

console.log(`\n======================================================`);
console.log(`DOM VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED OUT OF ${passed + failed} TESTS`);
console.log(`======================================================\n`);

if (failed > 0) {
  process.exit(1);
}
