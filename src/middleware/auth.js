import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { httpError } from '../utils/httpError.js';
import { User } from '../models/User.js';
import { normalizeUserRole } from '../utils/userRole.js';

function parseCookieHeader(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const index = pair.indexOf('=');
      if (index === -1) return acc;
      const key = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (!key) return acc;
      try {
        acc[key] = decodeURIComponent(value);
      } catch {
        acc[key] = value;
      }
      return acc;
    }, {});
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) return token;

  const cookies = parseCookieHeader(req.headers.cookie || '');
  if (cookies.admin_token) return cookies.admin_token;

  return null;
}

export async function requireAuth(req, _res, next) {
  const token = extractToken(req);

  if (!token) {
    return next(httpError(401, 'Missing or invalid Authorization header'));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });

    if (!payload?.sub) {
      return next(httpError(401, 'Invalid token payload'));
    }

    const user = await User.findById(payload.sub).select('_id email displayName role isBanned badges adminNotes lastLoginAt createdAt updatedAt').lean();
    if (!user) {
      return next(httpError(401, 'User no longer exists'));
    }

    if (user.isBanned) {
      return next(httpError(403, 'Your account is banned'));
    }

    req.auth = {
      userId: String(user._id),
      role: normalizeUserRole(user.role),
      user
    };

    return next();
  } catch {
    return next(httpError(401, 'Invalid or expired token'));
  }
}

export function requireAdmin(req, _res, next) {
  if (normalizeUserRole(req.auth?.role) !== 'admin') {
    return next(httpError(403, 'Admin access required'));
  }

  return next();
}

export const authRequired = requireAuth;
