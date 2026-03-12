/**
 * pgShadow.js — Parallel-adapter shadow writer, Phase 3.
 *
 * Contract (hard guarantees):
 *  1. NEVER throws. Any PG failure is caught, logged, and silently dropped.
 *  2. NEVER modifies the Mongoose document or affects the Mongoose write path.
 *  3. Skips silently when PG_SHADOW_WRITE flag is off or DATABASE_URL is missing.
 *  4. Skips silently when the mapper returns null (unrecoverable validation failure).
 *
 * Usage (in service layer, after a successful Mongoose save):
 *
 *   import pgShadow from '../utils/pgShadow.js';
 *
 *   await nonProjectServiceDoc.save();           // Mongoose — source of truth
 *   pgShadow.write('NonProjectService', doc);    // fire-and-forget shadow
 *
 * The write is intentionally NOT awaited in the critical path — it runs as a
 * background microtask so the HTTP response is not delayed by PG latency.
 * Errors are logged to console with a [pgShadow] prefix for easy grep.
 *
 * Supported model names (match Prisma model names exactly):
 *   'Account' | 'Volunteer' | 'ServiceApplication' | 'NonProjectService' | 'AuditLog'
 */

import { flags } from './featureFlags.js';
import { getPrisma } from './prismaClient.js';
import {
  mapAccount,
  mapVolunteer,
  mapServiceApplication,
  mapNonProjectService,
  mapAuditLog,
} from './pgMapper.js';

// ── Mapper registry ───────────────────────────────────────────────────────────

const MAPPERS = {
  Account:             mapAccount,
  Volunteer:           mapVolunteer,
  ServiceApplication:  mapServiceApplication,
  NonProjectService:   mapNonProjectService,
  AuditLog:            mapAuditLog,
};

// ── Prisma model accessor ─────────────────────────────────────────────────────

// Maps model name → Prisma client accessor key (camelCase as Prisma uses)
const PRISMA_MODEL = {
  Account:             'account',
  Volunteer:           'volunteer',
  ServiceApplication:  'serviceApplication',
  NonProjectService:   'nonProjectService',
  AuditLog:            'auditLog',
};

// ── Core shadow write ─────────────────────────────────────────────────────────

/**
 * Shadow-write a Mongoose document to PostgreSQL.
 *
 * @param {'Account'|'Volunteer'|'ServiceApplication'|'NonProjectService'|'AuditLog'} modelName
 * @param {Object} mongoDoc - Mongoose document (or lean plain object)
 * @returns {Promise<void>} - Always resolves, never rejects.
 */
async function write(modelName, mongoDoc) {
  // Guard: feature flag
  if (!flags.pgShadowWrite()) return;

  // Guard: Prisma client available
  const prisma = getPrisma();
  if (!prisma) return;

  // Guard: known model
  const mapper = MAPPERS[modelName];
  const prismaKey = PRISMA_MODEL[modelName];
  if (!mapper || !prismaKey) {
    console.warn(`[pgShadow] Unknown model: "${modelName}". Skipping shadow write.`);
    return;
  }

  // Map document → PG row
  let pgData;
  try {
    pgData = mapper(mongoDoc);
  } catch (err) {
    console.error(`[pgShadow] Mapper error for ${modelName}:`, err.message);
    return;
  }

  if (!pgData) {
    const id = mongoDoc?._id?.toString() || '?';
    console.warn(`[pgShadow] ${modelName} mapper returned null (validation failed) for _id=${id}. Skipping.`);
    return;
  }

  // Shadow write — upsert by domain unique key to be idempotent
  try {
    await prisma[prismaKey].upsert({
      where:  { [_uniqueKey(modelName)]: _uniqueValue(modelName, pgData) },
      create: pgData,
      update: pgData,
    });
    console.log(`[pgShadow] ✅ ${modelName} shadow-written: ${_uniqueValue(modelName, pgData)}`);
  } catch (err) {
    console.error(`[pgShadow] ❌ PG write failed for ${modelName} (${_uniqueValue(modelName, pgData)}):`, err.message);
    // Intentionally swallowed — never propagate to caller
  }
}

// Domain unique field per model (used for upsert idempotency)
function _uniqueKey(modelName) {
  const keys = {
    Account:            'email',
    Volunteer:          'volunteerId',
    ServiceApplication: 'applicationId',
    NonProjectService:  'serviceId',
    AuditLog:           'auditId',
  };
  return keys[modelName];
}

function _uniqueValue(modelName, pgData) {
  return pgData[_uniqueKey(modelName)];
}

// ── Convenience wrappers (optional — slightly more readable at call sites) ────

const pgShadow = {
  write,

  /** Convenience: shadow-write an Account document. */
  account: (doc) => write('Account', doc),

  /** Convenience: shadow-write a Volunteer document. */
  volunteer: (doc) => write('Volunteer', doc),

  /** Convenience: shadow-write a ServiceApplication document. */
  serviceApplication: (doc) => write('ServiceApplication', doc),

  /** Convenience: shadow-write a NonProjectService document. */
  nonProjectService: (doc) => write('NonProjectService', doc),

  /** Convenience: shadow-write an AuditLog document. */
  auditLog: (doc) => write('AuditLog', doc),
};

export default pgShadow;
