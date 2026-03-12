/**
 * Prisma Client singleton — Phase 5 PG-only adapter.
 *
 * Lazy initialisation: the client is created only on first call to `getPrisma()`.
 * If DATABASE_URL is not set, all calls return null and the shadow layer no-ops.
 * This ensures the backend starts cleanly even before DATABASE_URL is injected
 * (e.g. during tonight's demo where the container hasn't been restarted yet).
 *
 * Usage:
 *   import { getPrisma } from './prismaClient.js';
 *   const prisma = getPrisma();          // null if DATABASE_URL missing
 *   if (prisma) await prisma.account.findMany();
 */

import { PrismaClient } from '@prisma/client';

let _prisma = null;
let _initAttempted = false;

/**
 * Returns the Prisma client instance, or null if DATABASE_URL is not configured.
 * The client connects lazily on first query — no explicit connect() needed.
 */
export function getPrisma() {
  if (_initAttempted) return _prisma;
  _initAttempted = true;

  if (!process.env.DATABASE_URL) {
    console.warn('[PrismaClient] DATABASE_URL not set — PG shadow layer disabled.');
    return null;
  }

  try {
    _prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
      log: ['warn', 'error'],
    });
    console.log('[PrismaClient] Prisma client initialised (PG shadow layer ready).');
  } catch (err) {
    console.error('[PrismaClient] Failed to initialise:', err.message);
    _prisma = null;
  }

  return _prisma;
}

/**
 * Gracefully disconnect Prisma on process shutdown.
 * Call this in server.js on SIGINT/SIGTERM.
 */
export async function disconnectPrisma() {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
    _initAttempted = false;
  }
}

// Proxy default export to lazily return Prisma instance
// This allows: import prisma from './prismaClient.js'; prisma.volunteer.findMany()
const prismaProxy = new Proxy({}, {
  get: (target, prop) => {
    const client = getPrisma();
    if (!client) {
      console.warn(`[PrismaClient] Client not initialized. Accessing ${prop} will fail.`);
      return undefined;
    }
    return client[prop];
  }
});

export default prismaProxy;
