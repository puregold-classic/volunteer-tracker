// src/startup/createInitialAdmin.js
//
// Idempotent admin bootstrap: on server startup, ensure at least one account
// with role 'admin' exists. If none exists and BOOTSTRAP_ADMIN_EMAIL +
// BOOTSTRAP_ADMIN_PASSWORD are set, create one. Otherwise log a warning.
//
// This solves the chicken-and-egg of empty databases (e.g. first boot on a
// fresh deploy): the public /register endpoint hardcodes role='user', and the
// admin-only createAccountByAdmin requires an existing admin to authenticate.

import prisma from '../utils/prismaClient.js';
import { hashPassword } from '../utils/passwordUtils.js';

// Reserved domain volunteer ID for the system admin. Unlike regular accounts,
// this does not require a corresponding Volunteer row — Account.volunteerId is
// nullable-unique with no foreign key to the Volunteer table.
const RESERVED_ADMIN_VOLUNTEER_ID = 'PG-0000';

export const createInitialAdminIfMissing = async () => {
  const existingAdminCount = await prisma.account.count({ where: { role: 'admin' } });
  if (existingAdminCount > 0) {
    console.log('[bootstrap] admin account already present, skipping');
    return { skipped: true, reason: 'admin_exists' };
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME || 'Admin';

  if (!email || !password) {
    console.warn(
      '[bootstrap] no admin in DB and BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD ' +
        'not set — system will start without an admin. Set these env vars on first deploy.'
    );
    return { skipped: true, reason: 'env_missing' };
  }

  if (password.length < 8) {
    console.error('[bootstrap] BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters; skipping');
    return { skipped: true, reason: 'weak_password' };
  }

  try {
    const passwordHash = await hashPassword(password);
    const account = await prisma.account.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        role: 'admin',
        volunteerId: RESERVED_ADMIN_VOLUNTEER_ID,
      },
    });
    console.log(`[bootstrap] created initial admin account: ${account.email} (id=${account.id})`);
    return { created: true, accountId: account.id };
  } catch (err) {
    // Most likely cause: PG-0000 already taken by some pre-existing non-admin
    // account, or email already taken by a non-admin account. Log loudly but
    // do not crash — server can start without an admin and an operator can
    // resolve it manually.
    console.error('[bootstrap] failed to create initial admin:', err.message);
    return { error: err.message };
  }
};
