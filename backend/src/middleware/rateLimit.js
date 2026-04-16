// src/middleware/rateLimit.js
//
// Rate-limit helpers. Cloudflare tunnel sits in front of this server, so
// `app.set('trust proxy', 1)` in server.js lets express-rate-limit use
// X-Forwarded-For for the real client IP instead of the Cloudflare edge IP.

import rateLimit from 'express-rate-limit';

// Skip rate limiting in tests AND local dev.
//   - Tests: vitest suite spins many auth calls and we don't want 429s.
//   - Dev: the whole team works from one IP sometimes; typos / log-in-and-out
//     during debugging should never get 429'd. Production + sandbox keep the
//     protection on.
const skipInNonProd = () =>
  process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';

/**
 * Strict limit for credential endpoints (login / register / password reset).
 * 10 failed attempts per IP per 15 minutes — successful logins are NOT counted
 * (skipSuccessfulRequests), so a legit user can log in / out as often as they
 * want. The limit only bites brute-force attempts. Tuned looser than the
 * original 5/15min because user experience beats theoretical security margin
 * when the delta is this small — 10 consecutive wrong passwords is still a
 * strong signal.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInNonProd,
  skipSuccessfulRequests: true,
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
  skip: skipInNonProd,
  message: {
    success: false,
    error: '操作过于频繁，请稍后再试',
    code: 'RATE_LIMITED',
  },
});
