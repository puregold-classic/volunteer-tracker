// src/startup/createInitialAdmin.js — v2.1
//
// Idempotent admin bootstrap: on server startup, ensure at least one account
// with role='admin' exists. Reads BOOTSTRAP_ADMIN_EMAIL / _PASSWORD / _NAME
// from env and creates the admin via AccountService.createAdminAccount.
//
// v2.1 simplification: admin is the only role exempt from the volunteerId
// CHECK constraint, so the v1 PG-0000 reserved-volunteer-code hack is gone.

import prisma from '../utils/prismaClient.js';
import { createAdminAccount } from '../services/AccountService.js';

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
        'not set — system will start without an admin. Set these env vars on first deploy.',
    );
    return { skipped: true, reason: 'env_missing' };
  }

  const result = await createAdminAccount({ email, password, name });

  if (result.validationError) {
    console.error('[bootstrap] admin validation failed:', result.validationError);
    return { skipped: true, reason: 'validation', error: result.validationError };
  }
  if (result.conflict) {
    console.warn('[bootstrap] admin email already exists:', result.conflict);
    return { skipped: true, reason: 'conflict' };
  }

  console.log(`[bootstrap] created initial admin account: ${result.account.email} (id=${result.account.id})`);
  return { created: true, accountId: result.account.id };
};
