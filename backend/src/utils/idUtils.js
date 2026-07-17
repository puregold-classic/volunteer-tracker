// src/utils/idUtils.js — v2.1
// Lightweight ID parsing helpers. The heavy generation logic lives in IDGenerator.js.
// Removed v1 cruft: parseId/extractVolunteerId/etc were overcomplicated for the
// few call sites that actually used them.

import IDGenerator from './IDGenerator.js';

export { IDGenerator };

/**
 * Extract the owner volunteer code from a supportId like "PS-PG-0001-003".
 * Returns null on malformed input.
 */
export function extractVolunteerCodeFromSupportId(supportId) {
  if (typeof supportId !== 'string') return null;
  // v3.6: owner code may be legacy "PG-0001" or 生日制 "0305a".
  const match = supportId.match(/^PS-(PG-\d{4}|\d{4}[a-z])-\d{3}$/);
  return match ? match[1] : null;
}
