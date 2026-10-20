// Moderation Service: Ban/Unban Hierarchy & 7-Day Manager Re-Ban Restriction
// Institution: Saranathan College of Engineering (Autonomous)

import { canBanUser, canUnbanUser, ROLES, AuthorizationError } from './authorization.js';

export class ModerationService {
  constructor(store) {
    this.store = store;
  }

  /**
   * Helper to format dates in Indian Standard Time (IST, Asia/Kolkata)
   */
  formatKolkata(dateInput = new Date()) {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    const valid = isNaN(d?.getTime?.()) ? new Date() : d;
    const options = {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    return new Intl.DateTimeFormat('en-IN', options).format(valid) + ' IST';
  }

  /**
   * Bans a user according to the role hierarchy
   */
  async banUser(actor, targetUserId, reason) {
    const targetUser = await this.store.getUserById(targetUserId);
    if (!targetUser) {
      throw new Error('Target user does not exist.');
    }

    if (!reason || reason.trim().length < 5) {
      throw new Error('A valid reason (at least 5 characters) is required to issue an account ban.');
    }

    // Check authority and 7-day restriction
    const restrictions = await this.store.getBanRestrictions();
    const authCheck = canBanUser(actor, targetUser, restrictions);
    if (!authCheck.allowed) {
      throw new AuthorizationError(authCheck.reason, authCheck.restrictionActive ? 'SEVEN_DAY_RESTRICTION' : 'FORBIDDEN');
    }

    const nowUtc = new Date().toISOString();
    const recordId = 'mod_' + Math.random().toString(36).substring(2, 10);

    const modRecord = {
      id: recordId,
      targetUserId: targetUser.id,
      targetEmail: targetUser.email,
      targetRole: targetUser.role,
      actingUserId: actor.id,
      actingUserName: actor.displayName || actor.firstName,
      actingUserRole: actor.role,
      action: 'ban',
      reason: reason.trim(),
      isActive: true,
      createdAtUtc: nowUtc,
      createdAtIst: this.formatKolkata(nowUtc)
    };

    // Update target account status to banned
    await this.store.updateUserAccountStatus(targetUser.id, 'banned');
    await this.store.addModerationRecord(modRecord);

    // Audit log
    await this.store.logAuditEvent({
      actorId: actor.id,
      actorName: actor.displayName || actor.firstName,
      actorRole: actor.role,
      actionType: 'USER_BANNED',
      targetResourceType: 'user',
      targetResourceId: targetUser.id,
      metadata: { targetEmail: targetUser.email, targetRole: targetUser.role, reason: reason.trim() }
    });

    return modRecord;
  }

  /**
   * Unbans a user. ONLY the Admin can unban.
   * If target was banned by a Manager, triggers 7-day restriction for that Manager-Student pair.
   */
  async unbanUser(actor, targetUserId, resolutionNotes = 'Unbanned by Administrator') {
    const targetUser = await this.store.getUserById(targetUserId);
    if (!targetUser) {
      throw new Error('Target user does not exist.');
    }

    // Strictly check: ONLY Admin can unban
    const authCheck = canUnbanUser(actor, targetUser);
    if (!authCheck.allowed) {
      throw new AuthorizationError(authCheck.reason, 'ADMIN_ONLY_UNBAN');
    }

    const nowUtc = new Date().toISOString();
    const activeBan = await this.store.getActiveBanForUser(targetUser.id);

    // 7-Day Restriction Rule:
    // If the active ban was issued by a Manager, create a 7-day restriction
    // for that (Manager, Student) pair preventing re-ban.
    let createdRestriction = null;
    if (activeBan && activeBan.actingUserRole === ROLES.MANAGER) {
      const startMs = new Date(nowUtc).getTime();
      const endMs = startMs + (7 * 24 * 60 * 60 * 1000); // exactly 7 days
      const endUtc = new Date(endMs).toISOString();

      createdRestriction = {
        id: 'restr_' + Math.random().toString(36).substring(2, 10),
        managerId: activeBan.actingUserId,
        studentId: targetUser.id,
        restrictionStartUtc: nowUtc,
        restrictionEndUtc: endUtc,
        restrictionEndIst: this.formatKolkata(endUtc),
        reason: `Student ${targetUser.displayName || targetUser.email} was unbanned by Admin. Manager cannot re-ban for 7 days.`,
        createdAtUtc: nowUtc
      };

      await this.store.addBanRestriction(createdRestriction);
    }

    // Mark previous ban record inactive & record unban details
    if (activeBan) {
      activeBan.isActive = false;
      activeBan.unbanActorId = actor.id;
      activeBan.unbanTimestamp = nowUtc;
      activeBan.resolutionNotes = resolutionNotes;
      await this.store.saveModerationRecord(activeBan);
    }

    // Restore target user account to active
    await this.store.updateUserAccountStatus(targetUser.id, 'active');

    // Audit log
    await this.store.logAuditEvent({
      actorId: actor.id,
      actorName: actor.displayName || actor.firstName,
      actorRole: actor.role,
      actionType: 'USER_UNBANNED',
      targetResourceType: 'user',
      targetResourceId: targetUser.id,
      metadata: { 
        targetEmail: targetUser.email, 
        sevenDayRestrictionCreated: !!createdRestriction,
        restrictionEndUtc: createdRestriction?.restrictionEndUtc || null
      }
    });

    return {
      success: true,
      targetUserId: targetUser.id,
      accountStatus: 'active',
      isActive: false,
      unbanActorId: actor.id,
      sevenDayRestriction: createdRestriction
    };
  }

  /**
   * Manager submits a ban request to Admin during a 7-day restriction
   */
  async submitBanRequest(manager, studentId, reason) {
    if (manager.role !== ROLES.MANAGER) {
      throw new AuthorizationError('Only Managers can submit ban requests.', 'FORBIDDEN');
    }

    const student = await this.store.getUserById(studentId);
    if (!student) {
      throw new Error('Student does not exist.');
    }

    if (!reason || reason.trim().length < 10) {
      throw new Error('A detailed justification (at least 10 characters) is required for ban requests.');
    }

    const nowUtc = new Date().toISOString();
    const requestId = 'breq_' + Math.random().toString(36).substring(2, 10);

    const banRequest = {
      id: requestId,
      managerId: manager.id,
      managerName: manager.displayName || manager.firstName,
      studentId: student.id,
      studentName: student.displayName || student.firstName,
      studentEmail: student.email,
      studentRollNumber: student.rollNumber,
      reason: reason.trim(),
      status: 'pending',
      createdAtUtc: nowUtc,
      createdAtIst: this.formatKolkata(nowUtc),
      resolvedBy: null,
      resolvedAt: null
    };

    await this.store.addBanRequest(banRequest);

    // Audit log
    await this.store.logAuditEvent({
      actorId: manager.id,
      actorName: manager.displayName || manager.firstName,
      actorRole: manager.role,
      actionType: 'BAN_REQUEST_SUBMITTED',
      targetResourceType: 'ban_request',
      targetResourceId: requestId,
      metadata: { studentId: student.id, reason: reason.trim() }
    });

    return banRequest;
  }

  /**
   * Admin decides a ban request (approves or rejects)
   */
  async decideBanRequest(admin, requestId, decision, notes = '') {
    if (admin.role !== ROLES.ADMIN) {
      throw new AuthorizationError('Only an Administrator can decide ban requests.', 'FORBIDDEN');
    }

    const banRequest = await this.store.getBanRequestById(requestId);
    if (!banRequest) {
      throw new Error('Ban request not found.');
    }

    if (banRequest.status !== 'pending') {
      throw new Error(`Ban request is already ${banRequest.status}.`);
    }

    const nowUtc = new Date().toISOString();
    const isApproved = decision === 'approve' || decision === 'approved';
    banRequest.status = isApproved ? 'approved' : 'rejected';
    banRequest.resolvedBy = admin.id;
    banRequest.resolvedAt = nowUtc;
    banRequest.resolutionNotes = notes;

    await this.store.saveBanRequest(banRequest);

    // If approved, Admin issues the ban
    if (isApproved) {
      await this.banUser(admin, banRequest.studentId, `Approved Manager Ban Request: ${banRequest.reason}`);
    }

    return banRequest;
  }
}
