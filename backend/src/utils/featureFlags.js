/**
 * Feature flag reader — Phase 3 parallel adapter.
 *
 * All flags are read from environment variables at call time (not cached),
 * so they can be toggled via env injection without a code change.
 *
 * Flags:
 *   PG_SHADOW_WRITE=true   — After a successful Mongoose write, mirror the document to PG.
 *                            Failures are logged but never propagated.
 *   PG_SHADOW_READ=true    — (Future) Read from PG in parallel and compare with Mongo result.
 *                            Not yet implemented; present for forward-compat naming.
 *
 * Usage:
 *   import { flags } from './featureFlags.js';
 *   if (flags.pgShadowWrite()) { ... }
 */

export const flags = {
  /** Mirror Mongoose writes to PostgreSQL after commit. Default: off. */
  pgShadowWrite: () => process.env.PG_SHADOW_WRITE === 'true',

  /** Compare Mongoose read results with PG reads. Default: off. */
  pgShadowRead: () => process.env.PG_SHADOW_READ === 'true',
};
