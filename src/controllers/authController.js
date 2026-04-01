import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { httpError } from '../utils/httpError.js';
import { normalizeUserRole } from '../utils/userRole.js';

function createToken(userId) {
  return jwt.sign({}, env.jwtSecret, {
    subject: String(userId),
    expiresIn: env.jwtExpiresIn
  });
}

function mapUser(user) {
  return {
    id: user._id,
    email: user.email,
    displayName: user.displayName,
    role: normalizeUserRole(user.role),
    isBanned: user.isBanned,
    badges: Array.isArray(user.badges) ? user.badges : [],
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export async function register(req, res, next) {
  try {
    const { email, password } = req.body;
    const displayName = (req.body.displayName || '').trim();

    const existing = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existing) return next(httpError(409, 'Email already registered'));

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      displayName
    });

    const token = createToken(user._id);
    return res.status(201).json({ token, user: mapUser(user) });
  } catch (err) {
    return next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return next(httpError(401, 'Invalid email or password'));

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return next(httpError(401, 'Invalid email or password'));

    user.role = normalizeUserRole(user.role);
    user.lastLoginAt = new Date();
    await user.save();

    const token = createToken(user._id);
    return res.json({ token, user: mapUser(user) });
  } catch (err) {
    return next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await User.findById(req.auth.userId).select(
      '_id email displayName role isBanned badges lastLoginAt createdAt updatedAt'
    );
    if (!user) return next(httpError(404, 'User not found'));

    return res.json({ user: mapUser(user) });
  } catch (err) {
    return next(err);
  }
}
