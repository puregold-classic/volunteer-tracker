// src/middleware/rateLimit.js
//
// Rate-limit helpers. Cloudflare tunnel sits in front of this server, so
// `app.set('trust proxy', 1)` in server.js lets express-rate-limit use
// X-Forwarded-For for the real client IP instead of the Cloudflare edge IP.

import rateLimit from 'express-rate-limit';

// Skip rate limiting in tests — the vitest suite spins many auth calls
// and we don't want 429s in unit tests.
const skipInTests = () => process.env.NODE_ENV === 'test';

/**
 * Strict limit for credential endpoints (login / register / password reset).
 * 5 requests per IP per 15 minutes. Tuned to block brute-force while still
 * allowing a human who typoed a password a few tries.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: {
    success: false,
    error: '登录尝试过多，请 15 分钟后再试',
    code: 'RATE_LIMITED',
  },
});

/**
 * Looser limit for write operations (create/update/delete on business data).
 * 30 per minute per IP — catches runaway scripts without hitting real users.
 */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: {
    success: false,
    error: '操作过于频繁，请稍后再试',
    code: 'RATE_LIMITED',
  },
});
