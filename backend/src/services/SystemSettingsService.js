// src/services/SystemSettingsService.js — v2.1
//
// Singleton settings table (id=1). Currently holds the lockedBefore date for
// month-end / quarter-end "封档" — records with serviceDate before this point
// are immutable to non-admin users.
//
// The migration SQL inserted the singleton row, so reads always succeed.

import prisma from '../utils/prismaClient.js';

const SINGLETON_ID = 1;

class SystemSettingsService {
  /** Read current settings. Always returns a row. */
  static async get() {
    const row = await prisma.systemSettings.findUnique({ where: { id: SINGLETON_ID } });
    if (!row) {
      // Self-heal in case the singleton row is missing (should not happen
      // post-migration but defensive against accidental DELETE).
      return prisma.systemSettings.upsert({
        where: { id: SINGLETON_ID },
        update: {},
        create: { id: SINGLETON_ID, updatedAt: new Date() },
      });
    }
    return row;
  }

  /**
   * Set lockedBefore. Only admin / a_admin should call this; the controller
   * is responsible for the role check. Returns the updated row.
   *
   * Refuses to move lockedBefore backwards (you can only seal further forward
   * in time). To unlock, pass lockedBefore=null explicitly with allowUnlock=true.
   */
  static async setLockedBefore(lockedBefore, operator, { allowUnlock = false } = {}) {
    const current = await this.get();
    const newDate = lockedBefore ? new Date(lockedBefore) : null;

    if (newDate === null && !allowUnlock) {
      return { validationError: '解除封档需要 allowUnlock=true' };
    }
    if (newDate && current.lockedBefore && newDate < new Date(current.lockedBefore)) {
      return { validationError: '不能将封档日期往前回退（只允许往后推或显式解除）' };
    }

    const updated = await prisma.systemSettings.update({
      where: { id: SINGLETON_ID },
      data: {
        lockedBefore: newDate,
        updatedById: operator?.id ?? null,
      },
    });
    return { settings: updated };
  }

  /**
   * Check whether a given serviceDate is locked. Used by ProjectSupportService
   * before allowing create / update / delete by non-admin users.
   */
  static async isDateLocked(serviceDate) {
    const settings = await this.get();
    if (!settings.lockedBefore) return false;
    return new Date(serviceDate) < new Date(settings.lockedBefore);
  }
}

export default SystemSettingsService;
