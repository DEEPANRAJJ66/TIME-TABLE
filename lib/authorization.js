// Central Server-Side Authorization Engine
// Institution: Saranathan College of Engineering (Autonomous)
// Enforces: Role Hierarchy (ADMIN -> REPRESENTATIVE -> MANAGER -> STUDENT),
// Scope verification, 7-day re-ban restriction, and IDOR protection.

export const ROLES = {
  ADMIN: 'admin',
  REPRESENTATIVE: 'representative',
  MANAGER: 'manager',
  STUDENT: 'student'
};

export const ROLE_HIERARCHY = {
  admin: 4,
  representative: 3,
  manager: 2,
  student: 1
};

export const ACTIONS = {
  PROMOTE_MANAGER: 'PROMOTE_MANAGER',
  PROMOTE_REPRESENTATIVE: 'PROMOTE_REPRESENTATIVE',
  DEMOTE_MANAGER: 'DEMOTE_MANAGER',
  DEMOTE_REPRESENTATIVE: 'DEMOTE_REPRESENTATIVE',
  BAN_STUDENT: 'BAN_STUDENT',
  BAN_MANAGER: 'BAN_MANAGER',
  BAN_REPRESENTATIVE: 'BAN_REPRESENTATIVE',
  BAN_ADMIN: 'BAN_ADMIN',
  UNBAN_USER: 'UNBAN_USER',
  SUBMIT_BAN_REQUEST: 'SUBMIT_BAN_REQUEST',
  DECIDE_BAN_REQUEST: 'DECIDE_BAN_REQUEST',
  UPLOAD_RESOURCE: 'UPLOAD_RESOURCE',
  EDIT_RESOURCE: 'EDIT_RESOURCE',
  DELETE_RESOURCE: 'DELETE_RESOURCE',
  PUBLISH_RESOURCE: 'PUBLISH_RESOURCE',
  UNPUBLISH_RESOURCE: 'UNPUBLISH_RESOURCE',
  VIEW_RESOURCE: 'VIEW_RESOURCE',
  CREATE_ASSIGNMENT: 'CREATE_ASSIGNMENT',
  EDIT_ASSIGNMENT: 'EDIT_ASSIGNMENT',
  SUBMIT_ASSIGNMENT: 'SUBMIT_ASSIGNMENT',
  VIEW_SUBMISSION: 'VIEW_SUBMISSION',
  POST_NOTICE: 'POST_NOTICE',
  VIEW_AUDIT_LOGS: 'VIEW_AUDIT_LOGS'
};

/**
 * Checks if a user is active (not banned and authenticated)
 */
export function assertUserActive(user) {
  if (!user || !user.id) {
    throw new AuthorizationError('Authentication required to perform this action', 'UNAUTHORIZED', 401);
  }
  if (user.accountStatus === 'banned' || user.account_status === 'banned') {
    throw new AuthorizationError('Account is currently banned. Access to protected features is revoked.', 'ACCOUNT_BANNED', 403);
  }
}

/**
 * Validates role-based permission for user management operations
 */
export function canPromoteUser(actor, targetUser, targetRole) {
  assertUserActive(actor);
  const actorRole = actor.role;

  if (targetRole === ROLES.REPRESENTATIVE) {
    // Only Admin can appoint Representatives
    if (actorRole !== ROLES.ADMIN) {
      return { allowed: false, reason: 'Only an Administrator can appoint a Representative.' };
    }
    return { allowed: true };
  }

  if (targetRole === ROLES.MANAGER) {
    // Admin and Representative can promote Student to Manager
    if (actorRole !== ROLES.ADMIN && actorRole !== ROLES.REPRESENTATIVE) {
      return { allowed: false, reason: 'Only Admin or Representative can promote a Student to Manager.' };
    }
    if (targetUser && targetUser.role === ROLES.ADMIN) {
      return { allowed: false, reason: 'Cannot alter Admin role through manager promotion.' };
    }
    return { allowed: true };
  }

  if (targetRole === ROLES.ADMIN) {
    return { allowed: false, reason: 'Self-service or delegate Admin promotion is strictly prohibited.' };
  }

  return { allowed: false, reason: 'Invalid promotion target role.' };
}

/**
 * Validates role demotion authority
 */
export function canDemoteUser(actor, targetUser, targetRole) {
  assertUserActive(actor);
  const actorRole = actor.role;

  if (targetUser.role === ROLES.ADMIN) {
    return { allowed: false, reason: 'The Admin account cannot be demoted through normal operations.' };
  }

  if (targetUser.role === ROLES.REPRESENTATIVE) {
    // Only Admin can demote Representatives
    if (actorRole !== ROLES.ADMIN) {
      return { allowed: false, reason: 'Only an Administrator can demote a Representative.' };
    }
    return { allowed: true };
  }

  if (targetUser.role === ROLES.MANAGER) {
    // Admin and Representative can demote Manager to Student
    if (actorRole !== ROLES.ADMIN && actorRole !== ROLES.REPRESENTATIVE) {
      return { allowed: false, reason: 'Only Admin or Representative can demote a Manager.' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Target user is already a Student or cannot be demoted.' };
}

/**
 * Validates ban authority and checks the 7-day restriction
 */
export function canBanUser(actor, targetUser, banRestrictions = []) {
  assertUserActive(actor);
  const actorRole = actor.role;
  const targetRole = targetUser.role;

  // Rule 1: No one can ban the Admin
  if (targetRole === ROLES.ADMIN) {
    return { allowed: false, reason: 'The Administrator account cannot be banned.' };
  }

  // Rule 2: Cannot ban oneself
  if (actor.id === targetUser.id) {
    return { allowed: false, reason: 'Self-ban is not permitted.' };
  }

  // Rule 3: Admin can ban Representative, Manager, Student
  if (actorRole === ROLES.ADMIN) {
    return { allowed: true };
  }

  // Rule 4: Representative can ban Manager and Student
  if (actorRole === ROLES.REPRESENTATIVE) {
    if (targetRole === ROLES.MANAGER || targetRole === ROLES.STUDENT) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Representative cannot ban other Representatives or Admin.' };
  }

  // Rule 5: Manager can ONLY ban Student
  if (actorRole === ROLES.MANAGER) {
    if (targetRole !== ROLES.STUDENT) {
      return { allowed: false, reason: 'Managers are only authorized to moderate Students within their assigned scope.' };
    }

    // Check 7-day re-ban restriction between this Manager and this Student
    const nowUtc = new Date().toISOString();
    const activeRestriction = banRestrictions.find(r => 
      r.managerId === actor.id && 
      r.studentId === targetUser.id &&
      new Date(r.restrictionEndUtc) > new Date(nowUtc)
    );

    if (activeRestriction) {
      const remainingMs = new Date(activeRestriction.restrictionEndUtc).getTime() - new Date(nowUtc).getTime();
      const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
      return {
        allowed: false,
        reason: `7-Day Re-Ban Restriction Active: You recently had this student unbanned by an Administrator. You cannot directly ban this student for another ${remainingDays} day(s). You may submit a Ban Request to the Admin.`,
        restrictionActive: true,
        restrictionEndUtc: activeRestriction.restrictionEndUtc
      };
    }

    return { allowed: true };
  }

  // Rule 6: Students cannot ban anyone
  return { allowed: false, reason: 'Students do not have moderation privileges.' };
}

/**
 * Validates unban authority (ONLY Admin can unban)
 */
export function canUnbanUser(actor, targetUser, moderationRecord) {
  assertUserActive(actor);
  const actorRole = actor.role;

  // Strict Rule: ONLY the Admin can unban any user (whether banned by Admin, Rep, or Manager)
  if (actorRole !== ROLES.ADMIN) {
    return { 
      allowed: false, 
      reason: 'Only an Administrator has the authority to lift account bans.' 
    };
  }

  return { allowed: true };
}

/**
 * Validates resource upload permissions
 */
export function canUploadResource(actor, subjectId, assignedSubjectIds = []) {
  assertUserActive(actor);
  const actorRole = actor.role;

  if (actorRole === ROLES.ADMIN || actorRole === ROLES.REPRESENTATIVE) {
    return { allowed: true };
  }

  if (actorRole === ROLES.MANAGER) {
    if (!assignedSubjectIds.includes(subjectId)) {
      return { 
        allowed: false, 
        reason: 'Manager is not assigned to this subject. You can only upload materials to your designated subjects.' 
      };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Students are not authorized to upload learning resources.' };
}

/**
 * Validates resource modification or deletion
 */
export function canModifyResource(actor, resource) {
  assertUserActive(actor);
  const actorRole = actor.role;

  if (actorRole === ROLES.ADMIN || actorRole === ROLES.REPRESENTATIVE) {
    return { allowed: true };
  }

  if (actorRole === ROLES.MANAGER) {
    if (resource.uploaderId !== actor.id) {
      return { 
        allowed: false, 
        reason: 'Managers cannot edit or delete materials uploaded by other Managers.' 
      };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Students cannot modify learning resources.' };
}

/**
 * Validates publication status changes (Draft -> Published or Published -> Draft)
 */
export function canChangePublicationStatus(actor) {
  assertUserActive(actor);
  const actorRole = actor.role;

  if (actorRole === ROLES.ADMIN || actorRole === ROLES.REPRESENTATIVE) {
    return { allowed: true };
  }

  return { 
    allowed: false, 
    reason: 'Only an Administrator or Representative can publish or unpublish learning resources.' 
  };
}

/**
 * Validates resource view access (Drafts are strictly hidden from Students)
 */
export function canViewResource(user, resource) {
  if (resource.publicationStatus === 'published') {
    return { allowed: true };
  }

  // If resource is DRAFT:
  if (!user) {
    return { allowed: false, reason: 'Resource is a private draft.' };
  }

  const role = user.role;
  if (role === ROLES.ADMIN || role === ROLES.REPRESENTATIVE) {
    return { allowed: true };
  }

  if (role === ROLES.MANAGER && resource.uploaderId === user.id) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Students cannot view unpublished draft resources.' };
}

/**
 * Validates student submission view access (Strict IDOR protection)
 */
export function canViewSubmission(actor, submission, assignment, assignedSubjectIds = []) {
  assertUserActive(actor);
  const actorRole = actor.role;

  // Student can ONLY view their own submission
  if (actorRole === ROLES.STUDENT) {
    if (submission.studentId === actor.id) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Access Denied: You can only inspect your own assignment submission.' };
  }

  if (actorRole === ROLES.ADMIN || actorRole === ROLES.REPRESENTATIVE) {
    return { allowed: true };
  }

  if (actorRole === ROLES.MANAGER) {
    if (assignedSubjectIds.includes(assignment.subjectId)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Access Denied: Managers can only view submissions for their assigned subjects.' };
  }

  return { allowed: false, reason: 'Unauthorized access to submission.' };
}

/**
 * Validates global notice posting
 */
export function canPostNotice(actor) {
  assertUserActive(actor);
  const actorRole = actor.role;

  if (actorRole === ROLES.ADMIN || actorRole === ROLES.REPRESENTATIVE) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Only an Administrator or Representative can broadcast global college notices.' };
}

export class AuthorizationError extends Error {
  constructor(message, code = 'FORBIDDEN', statusCode = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
