// src/utils/identifierUtils.js — v3.3
//
// Shared helpers for the tri-modal login identifier (email / phone /
// volunteerCode). The frontend sends a single `identifier` string; the
// AuthService uses `detectIdentifierKind` to decide which column to look
// up. `normalizePhone` is also used by AccountService on writes so the
// stored form is canonical and the @unique index behaves sanely.

/**
 * Normalize a phone number to a canonical digits-only form.
 * - Strips whitespace / dashes / parens / plus signs
 * - If the result starts with "86" and is 13 digits, drops the "86"
 *   (Chinese mobile numbers are 11 digits; with country code 13).
 * - Empty / nullish input → null (so empty strings don't collide under
 *   the @unique index).
 * - Returns null if what's left doesn't look like a phone (<10 digits or
 *   >15 digits per E.164 upper bound).
 */
export function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  let canonical = digits;
  if (canonical.length === 13 && canonical.startsWith('86')) {
    canonical = canonical.slice(2);
  }
  if (canonical.length < 10 || canonical.length > 15) return null;
  return canonical;
}

/**
 * Classify a raw login identifier.
 * Order matters — phone is tried BEFORE volunteerCode so that dash-formatted
 * numbers ("+86 138-0013-8001") don't get misclassified as codes.
 *   1. Contains `@` → email
 *   2. Normalizes to a phone (≥10 digits after strip) → phone
 *   3. Matches an alphanumeric-with-dash code → volunteerCode (upper-cased)
 *
 * Returns `{ kind, value }` where value is pre-normalized for lookup:
 * - email:         trimmed + lowercased
 * - phone:         digits-only canonical form (see normalizePhone)
 * - volunteerCode: trimmed + uppercased
 *
 * Anything else → `{ kind: 'invalid' }`.
 */
const VOLUNTEER_CODE_SHAPE = /^[A-Za-z]{1,6}-[A-Za-z0-9]+$/;

export function detectIdentifierKind(raw) {
  if (typeof raw !== 'string') return { kind: 'invalid' };
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'invalid' };

  if (trimmed.includes('@')) {
    return { kind: 'email', value: trimmed.toLowerCase() };
  }

  // Try phone before code: "+86 138-0013-8001" should not be confused for a code.
  const phone = normalizePhone(trimmed);
  if (phone) return { kind: 'phone', value: phone };

  // Remaining branch: volunteer code like "PG-0001". Must look code-shaped
  // (letters + dash + alphanumerics) — random strings fail as invalid rather
  // than hitting a useless DB lookup.
  if (VOLUNTEER_CODE_SHAPE.test(trimmed)) {
    return { kind: 'volunteerCode', value: trimmed.toUpperCase() };
  }
  return { kind: 'invalid' };
}
