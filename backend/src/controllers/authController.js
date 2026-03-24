import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { httpError } from '../utils/httpError.js';

function createToken(userId) {
  return jwt.sign({}, env.jwtSecret, {
    subject: String(userId),
    expiresIn: env.jwtExpiresIn
  });
}

export async function register(req, res, next) {
  try {
    const { email, password, displayName = '' } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return next(httpError(409, 'Email already registered'));

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      displayName
    });

    const token = createToken(user._id);
    return res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName
      }
    });
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

    const token = createToken(user._id);
    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName
      }
    });
  } catch (err) {
    return next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await User.findById(req.auth.userId).select('_id email displayName createdAt');
    if (!user) return next(httpError(404, 'User not found'));

    return res.json({
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    return next(err);
  }
}
