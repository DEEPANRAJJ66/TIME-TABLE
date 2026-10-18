// Central Permission Matrix & Role-Based Access Control (RBAC) Service
// College Timetable App - Shared Dashboard Architecture
// Hierarchy: Admin (Level 1) -> Representative (Level 2) -> Manager (Level 3) -> Student (Level 4)

export const ROLES = {
  ADMIN: 'admin',
  REPRESENTATIVE: 'representative',
  MANAGER: 'manager',
  STUDENT: 'student'
};

export const ROLE_HIERARCHY_LEVELS = {
  [ROLES.ADMIN]: 1,
  [ROLES.REPRESENTATIVE]: 2,
  [ROLES.MANAGER]: 3,
  [ROLES.STUDENT]: 4
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.REPRESENTATIVE]: 'Representative',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.STUDENT]: 'Student'
};

export const ROLE_BADGE_CLASSES = {
  [ROLES.ADMIN]: 'lr-badge lr-badge-admin',
  [ROLES.REPRESENTATIVE]: 'lr-badge lr-badge-rep',
  [ROLES.MANAGER]: 'lr-badge lr-badge-manager',
  [ROLES.STUDENT]: 'lr-badge lr-badge-student'
};

// Central Permission Map defining authorized capabilities for each role
export const PERMISSIONS = {
  // Navigation & View Access
  VIEW_STUDENT_DASHBOARD: [ROLES.ADMIN, ROLES.REPRESENTATIVE, ROLES.MANAGER, ROLES.STUDENT],
  VIEW_TIMETABLE: [ROLES.ADMIN, ROLES.REPRESENTATIVE, ROLES.MANAGER, ROLES.STUDENT],
  VIEW_PUBLISHED_RESOURCES: [ROLES.ADMIN, ROLES.REPRESENTATIVE, ROLES.MANAGER, ROLES.STUDENT],
  VIEW_PUBLISHED_NOTICES: [ROLES.ADMIN, ROLES.REPRESENTATIVE, ROLES.MANAGER, ROLES.STUDENT],
  VIEW_PROFILE: [ROLES.ADMIN, ROLES.REPRESENTATIVE, ROLES.MANAGER, ROLES.STUDENT],

  // Manager Features
  UPLOAD_RESOURCES: [ROLES.ADMIN, ROLES.REPRESENTATIVE, ROLES.MANAGER],
  MANAGE_OWN_RESOURCES: [ROLES.ADMIN, ROLES.REPRESENTATIVE, ROLES.MANAGER],
  MANAGE_OWN_FOLDERS: [ROLES.ADMIN, ROLES.REPRESENTATIVE, ROLES.MANAGER],
  VIEW_OWN_ACTIVITY: [ROLES.ADMIN, ROLES.REPRESENTATIVE, ROLES.MANAGER],

  // Moderation: Students
  BAN_STUDENTS: [ROLES.ADMIN, ROLES.REPRESENTATIVE, ROLES.MANAGER],
  UNBAN_STUDENTS: [ROLES.ADMIN, ROLES.REPRESENTATIVE, ROLES.MANAGER], // subject to Admin unban restrictions
  SUBMIT_BAN_REQUEST: [ROLES.MANAGER],

  // Representative Features
  MANAGE_NOTICES: [ROLES.ADMIN, ROLES.REPRESENTATIVE],
  CREATE_NOTICES: [ROLES.ADMIN, ROLES.REPRESENTATIVE],
  EDIT_NOTICES: [ROLES.ADMIN, ROLES.REPRESENTATIVE],
  PUBLISH_NOTICES: [ROLES.ADMIN, ROLES.REPRESENTATIVE],
  PIN_NOTICES: [ROLES.ADMIN, ROLES.REPRESENTATIVE],
  VIEW_STUDENT_AND_MANAGERS: [ROLES.ADMIN, ROLES.REPRESENTATIVE],
  BAN_MANAGERS: [ROLES.ADMIN, ROLES.REPRESENTATIVE],
  UNBAN_MANAGERS: [ROLES.ADMIN, ROLES.REPRESENTATIVE], // subject to Admin unban restrictions
  REVIEW_DRAFTS_WITHIN_AUTHORITY: [ROLES.ADMIN, ROLES.REPRESENTATIVE],
  VIEW_ACTIVITY_HISTORY: [ROLES.ADMIN, ROLES.REPRESENTATIVE],

  // Admin-Only Master Governance
  MANAGE_ALL_USERS: [ROLES.ADMIN],
  PROMOTE_STUDENT_TO_MANAGER: [ROLES.ADMIN],
  PROMOTE_STUDENT_TO_REPRESENTATIVE: [ROLES.ADMIN],
  PROMOTE_MANAGER_TO_REPRESENTATIVE: [ROLES.ADMIN],
  DEMOTE_REPRESENTATIVE: [ROLES.ADMIN],
  DEMOTE_MANAGER: [ROLES.ADMIN],
  APPOINT_REPRESENTATIVE: [ROLES.ADMIN],
  REMOVE_REPRESENTATIVE: [ROLES.ADMIN],
  BAN_REPRESENTATIVE: [ROLES.ADMIN],
  UNBAN_REPRESENTATIVE: [ROLES.ADMIN],
  MANAGE_ALL_RESOURCES: [ROLES.ADMIN],
  MANAGE_ANY_USERS_DRAFTS: [ROLES.ADMIN],
  RESTRICT_RESOURCE_TO_DRAFT: [ROLES.ADMIN],
  VIEW_ADMIN_OVERVIEW: [ROLES.ADMIN],
  VIEW_PLATFORM_STATISTICS: [ROLES.ADMIN],
  VIEW_AUDIT_LOGS: [ROLES.ADMIN],
  CONFIGURE_PLATFORM_SETTINGS: [ROLES.ADMIN],
  DECIDE_BAN_REQUESTS: [ROLES.ADMIN, ROLES.REPRESENTATIVE],
  SUBMIT_BUG_REPORT: [ROLES.ADMIN, ROLES.REPRESENTATIVE, ROLES.MANAGER, ROLES.STUDENT],
  VIEW_BUG_REPORTS: [ROLES.ADMIN]
};

export class PermissionService {
  /**
   * Check if a role possesses a specific permission
   */
  static hasPermission(role, permission) {
    if (!role || !PERMISSIONS[permission]) return false;
    return PERMISSIONS[permission].includes(role);
  }

  /**
   * Check if an actor can moderate (ban/unban) a target based on role hierarchy
   */
  static canModerateUser(actorRole, targetRole) {
    if (!actorRole || !targetRole) return false;
    
    // No one can ban/unban the Admin
    if (targetRole === ROLES.ADMIN) return false;

    // Admin can ban/unban any non-Admin
    if (actorRole === ROLES.ADMIN) return true;

    // Representative can ban/unban Students and Managers
    if (actorRole === ROLES.REPRESENTATIVE) {
      return targetRole === ROLES.STUDENT || targetRole === ROLES.MANAGER;
    }

    // Manager can ban/unban only Students
    if (actorRole === ROLES.MANAGER) {
      return targetRole === ROLES.STUDENT;
    }

    return false;
  }

  /**
   * Check if actor can change target role according to hierarchy rules
   * Only Admin can change roles!
   */
  static canChangeRole(actorRole, currentTargetRole, newTargetRole) {
    if (actorRole !== ROLES.ADMIN) return false;
    if (currentTargetRole === ROLES.ADMIN || newTargetRole === ROLES.ADMIN) {
      // Cannot demote admin or grant admin through regular UI
      return false;
    }
    const validRoles = [ROLES.REPRESENTATIVE, ROLES.MANAGER, ROLES.STUDENT];
    return validRoles.includes(newTargetRole);
  }

  /**
   * Check resource ownership and edit/publish/delete authority
   */
  static canModifyResource(actorRole, actorEmail, resource) {
    if (!resource) return false;
    if (actorRole === ROLES.ADMIN) return true;
    
    // Check ownership
    const isOwner = (resource.ownerEmail && resource.ownerEmail.toLowerCase() === (actorEmail || '').toLowerCase()) ||
                    (resource.ownerId && resource.ownerId === actorEmail);

    if (actorRole === ROLES.REPRESENTATIVE) {
      // Representatives can manage resources within authority or their own
      if (isOwner) return true;
      // Representatives can publish/unpublish if approved by authority
      return true;
    }

    if (actorRole === ROLES.MANAGER) {
      // Managers can ONLY modify their own files
      return isOwner;
    }

    return false;
  }

  /**
   * Check if actor can view a resource (respects draft isolation)
   */
  static canViewResource(actorRole, actorEmail, resource) {
    if (!resource) return false;

    // Published resources are visible to everyone
    if (resource.publicationStatus === 'published') return true;

    // Admin can view all drafts
    if (actorRole === ROLES.ADMIN) return true;

    // Representative can review drafts within authority
    if (actorRole === ROLES.REPRESENTATIVE) return true;

    // Resource owner can view their own draft
    const isOwner = (resource.ownerEmail && resource.ownerEmail.toLowerCase() === (actorEmail || '').toLowerCase()) ||
                    (resource.ownerId && resource.ownerId === actorEmail);
    if (isOwner) return true;

    // Managers cannot see other users' drafts; Students cannot see any drafts
    return false;
  }

  /**
   * Generates dynamic navigation configuration based on role
   */
  static getNavigationForRole(role) {
    // 1. Common Student Dashboard navigation (available to all roles)
    const commonItems = [
      { id: 'dashboard', icon: '🏠', label: 'Dashboard / Home', badge: null },
      ...(role === ROLES.STUDENT ? [{ id: 'my-folders', icon: '📂', label: 'Subject Folders', badge: null }] : []),
      { id: 'resources', icon: '📚', label: 'Learning Resources', badge: null },
      { id: 'notices', icon: '📢', label: 'Notices', badge: null },
      { id: 'profile', icon: '👤', label: 'My Profile', badge: null },
      { id: 'bug-report', icon: '🐞', label: 'Report a Bug', badge: null }
    ];

    // 2. Role-specific additional navigation items
    let roleItems = [];

    if (role === ROLES.MANAGER) {
      roleItems = [
        { id: 'upload', icon: '➕', label: 'Upload Material', badge: null },
        { id: 'my-folders', icon: '📁', label: 'Subject Folders', badge: null },
        { id: 'my-uploads', icon: '📤', label: 'My Uploads', badge: null },
        { id: 'student-mgmt', icon: '🎓', label: 'Student Moderation', badge: null },
        { id: 'my-activity', icon: '⚡', label: 'My Activity', badge: null }
      ];
    } else if (role === ROLES.REPRESENTATIVE) {
      roleItems = [
        { id: 'upload', icon: '➕', label: 'Upload Material', badge: null },
        { id: 'my-folders', icon: '📁', label: 'Subject Folders', badge: null },
        { id: 'resource-mgmt', icon: '📁', label: 'Resource Management', badge: null },
        { id: 'notice-mgmt', icon: '📝', label: 'Notice Management', badge: null },
        { id: 'student-manager-mgmt', icon: '👥', label: 'Student & Manager Mgmt', badge: null },
        { id: 'ban-centre', icon: '🛡️', label: 'Ban & Unban Centre', badge: null },
        { id: 'activity-history', icon: '📜', label: 'Activity History', badge: null }
      ];
    } else if (role === ROLES.ADMIN) {
      roleItems = [
        { id: 'upload', icon: '➕', label: 'Upload Material', badge: null },
        { id: 'my-folders', icon: '📁', label: 'Subject Folders', badge: null },
        { id: 'admin-overview', icon: '📊', label: 'Admin Overview', badge: null },
        { id: 'user-mgmt', icon: '👥', label: 'User & Role Management', badge: null },
        { id: 'resource-mgmt', icon: '📁', label: 'Resource Management', badge: null },
        { id: 'notice-mgmt', icon: '📢', label: 'Notice Management', badge: null },
        { id: 'ban-centre', icon: '🛡️', label: 'Ban & Unban Centre', badge: null },
        { id: 'admin-bugs', icon: '🐞', label: 'Bug Reports', badge: null },
        { id: 'statistics', icon: '📈', label: 'Dashboard Statistics', badge: null },
        { id: 'audit-log', icon: '📜', label: 'Audit Log', badge: null },
        { id: 'settings', icon: '⚙️', label: 'Settings', badge: null }
      ];
    }

    return {
      commonItems,
      roleItems,
      allItems: [...commonItems, ...roleItems]
    };
  }
}
