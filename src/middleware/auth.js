import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { httpError } from '../utils/httpError.js';

export function authRequired(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(httpError(401, 'Missing or invalid Authorization header'));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });

    if (!payload?.sub) {
      return next(httpError(401, 'Invalid token payload'));
    }

    req.auth = { userId: payload.sub };
    return next();
  } catch {
    return next(httpError(401, 'Invalid or expired token'));
  }
}
