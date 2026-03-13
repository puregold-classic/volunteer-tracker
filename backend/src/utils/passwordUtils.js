// src/utils/passwordUtils.js
// Phase 5: Standalone bcrypt helpers, replacing the Mongoose model static/instance methods.

import bcrypt from 'bcryptjs';

/**
 * Hash a plain-text password.
 * @param {string} password
 * @returns {Promise<string>} bcrypt hash
 */
export async function hashPassword(password) {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a plain-text password against a stored hash.
 * @param {string} plainPassword
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plainPassword, storedHash) {
  return bcrypt.compare(plainPassword, storedHash);
}
