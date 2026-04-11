// src/middleware/optionalAuth.js
//
// Like `authenticate` but never rejects — if a valid token is present, req.user
// is populated; otherwise req.user stays undefined and the request continues.
// Use this on public endpoints that reveal extra fields to logged-in users
// (e.g., volunteer list returning email/phone only to admins or self).

import jwt from 'jsonwebtoken';
import prisma from '../utils/prismaClient.js';

const extractToken = (req) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim();
};

export const optionalAuthenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return next();

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return next();

    const payload = jwt.verify(token, jwtSecret);
    const account = await prisma.account.findUnique({
      where: { id: payload.sub },
    });
    if (!account || !account.isActive) return next();

    // Enforce tokenValidAfter if set (see authenticate.js for details).
    if (account.tokenValidAfter) {
      const iatMs = (payload.iat || 0) * 1000;
      if (iatMs < account.tokenValidAfter.getTime()) return next();
    }

    req.user = {
      accountId: account.id,
      email: account.email,
      role: account.role,
      volunteerId: account.volunteerId,
      name: account.name,
    };
  } catch {
    // Ignore any auth error — treat as anonymous
  }
  return next();
};
