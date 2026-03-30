import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { env } from '../config/env.js';
import { httpError } from '../utils/httpError.js';

const ROLES = ['user', 'tester', 'moderator', 'admin'];
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ADMIN_COOKIE_NAME = 'admin_token';

function mapUser(user) {
  return {
    id: user._id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    isBanned: user.isBanned,
    badges: Array.isArray(user.badges) ? user.badges : [],
    adminNotes: user.adminNotes || '',
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

async function createAuditLog({ actorUserId, action, targetUserId, metadata = {} }) {
  await AuditLog.create({
    actorUserId,
    action,
    targetUserId,
    metadata
  });
}

function resolvePagination(query) {
  const pageRaw = Number(query.page ?? 1);
  const limitRaw = Number(query.limit ?? 25);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 25;
  return { page, limit, skip: (page - 1) * limit };
}

export async function createAdminSession(req, res, next) {
  try {
    const { token } = req.body;
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });

    if (!payload?.sub) return next(httpError(401, 'Invalid token payload'));

    const user = await User.findById(payload.sub).select('_id role isBanned').lean();
    if (!user) return next(httpError(401, 'User no longer exists'));
    if (user.isBanned) return next(httpError(403, 'Your account is banned'));
    if (user.role !== 'admin') return next(httpError(403, 'Admin access required'));

    res.cookie(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: env.isProduction,
      path: '/admin',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({ ok: true });
  } catch {
    return next(httpError(401, 'Invalid or expired token'));
  }
}

export function clearAdminSession(_req, res) {
  res.clearCookie(ADMIN_COOKIE_NAME, { path: '/admin' });
  return res.status(204).end();
}

export function getAdminLoginPage(_req, res) {
  return res.sendFile(path.resolve(__dirname, '../views/admin-login.html'));
}

export function getAdminPage(_req, res) {
  return res.sendFile(path.resolve(__dirname, '../views/admin.html'));
}

export async function getAdminOverviewStats(_req, res, next) {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const activeSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalUsers, newUsersToday, bannedUsers, adminUsers, testerUsers, activeUsers] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: startOfDay } }),
      User.countDocuments({ isBanned: true }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'tester' }),
      User.countDocuments({ lastLoginAt: { $gte: activeSince } })
    ]);

    return res.json({
      totalUsers,
      newUsersToday,
      bannedUsers,
      adminUsers,
      testerUsers,
      activeUsers
    });
  } catch (err) {
    return next(err);
  }
}

export async function listAdminUsers(req, res, next) {
  try {
    const { search, role } = req.query;
    const banned = req.query.banned;
    const { page, limit, skip } = resolvePagination(req.query);

    const filter = {};

    if (search) {
      const safeSearch = String(search).trim();
      if (safeSearch) {
        const regex = new RegExp(safeSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ email: regex }, { displayName: regex }, { username: regex }];
      }
    }

    if (role && ROLES.includes(role)) {
      filter.role = role;
    }

    if (banned === 'true' || banned === 'false') {
      filter.isBanned = banned === 'true';
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('_id email displayName role isBanned badges adminNotes lastLoginAt createdAt updatedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    return res.json({
      data: users.map(mapUser),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (err) {
    return next(err);
  }
}

export async function getAdminUserById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return next(httpError(400, 'Invalid user id'));

    const user = await User.findById(id).select('_id email displayName role isBanned badges adminNotes lastLoginAt createdAt updatedAt').lean();
    if (!user) return next(httpError(404, 'User not found'));

    return res.json({ user: mapUser(user) });
  } catch (err) {
    return next(err);
  }
}

export async function updateAdminUserRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) return next(httpError(400, 'Invalid user id'));
    if (!ROLES.includes(role)) return next(httpError(400, 'Invalid role'));

    const user = await User.findById(id);
    if (!user) return next(httpError(404, 'User not found'));

    const oldRole = user.role;
    user.role = role;
    await user.save();

    await createAuditLog({
      actorUserId: req.auth.userId,
      action: 'user.role.updated',
      targetUserId: user._id,
      metadata: { from: oldRole, to: role }
    });

    return res.json({ user: mapUser(user) });
  } catch (err) {
    return next(err);
  }
}

export async function updateAdminUserBan(req, res, next) {
  try {
    const { id } = req.params;
    const { isBanned } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) return next(httpError(400, 'Invalid user id'));

    const user = await User.findById(id);
    if (!user) return next(httpError(404, 'User not found'));

    const previous = user.isBanned;
    user.isBanned = Boolean(isBanned);
    await user.save();

    await createAuditLog({
      actorUserId: req.auth.userId,
      action: user.isBanned ? 'user.banned' : 'user.unbanned',
      targetUserId: user._id,
      metadata: { from: previous, to: user.isBanned }
    });

    return res.json({ user: mapUser(user) });
  } catch (err) {
    return next(err);
  }
}

export async function updateAdminUserBadges(req, res, next) {
  try {
    const { id } = req.params;
    const { action, badge } = req.body;
    const normalizedBadge = String(badge || '').trim();

    if (!mongoose.Types.ObjectId.isValid(id)) return next(httpError(400, 'Invalid user id'));
    if (!['add', 'remove'].includes(action)) return next(httpError(400, 'Invalid action'));
    if (!normalizedBadge) return next(httpError(400, 'badge is required'));

    const user = await User.findById(id);
    if (!user) return next(httpError(404, 'User not found'));

    const badges = Array.isArray(user.badges) ? [...user.badges] : [];
    const hasBadge = badges.includes(normalizedBadge);

    if (action === 'add' && !hasBadge) {
      badges.push(normalizedBadge);
    }

    if (action === 'remove' && hasBadge) {
      user.badges = badges.filter((entry) => entry !== normalizedBadge);
    } else {
      user.badges = badges;
    }

    await user.save();

    await createAuditLog({
      actorUserId: req.auth.userId,
      action: action === 'add' ? 'user.badge.added' : 'user.badge.removed',
      targetUserId: user._id,
      metadata: { badge: normalizedBadge }
    });

    return res.json({ user: mapUser(user) });
  } catch (err) {
    return next(err);
  }
}

export async function updateAdminUserNotes(req, res, next) {
  try {
    const { id } = req.params;
    const adminNotes = String(req.body.adminNotes ?? '').trim();
    if (!mongoose.Types.ObjectId.isValid(id)) return next(httpError(400, 'Invalid user id'));

    const user = await User.findById(id);
    if (!user) return next(httpError(404, 'User not found'));

    const previous = user.adminNotes || '';
    user.adminNotes = adminNotes;
    await user.save();

    await createAuditLog({
      actorUserId: req.auth.userId,
      action: 'user.notes.updated',
      targetUserId: user._id,
      metadata: {
        previousLength: previous.length,
        nextLength: adminNotes.length
      }
    });

    return res.json({ user: mapUser(user) });
  } catch (err) {
    return next(err);
  }
}

export async function listAdminAuditLogs(req, res, next) {
  try {
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 200) : 50;

    const logs = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({ path: 'actorUserId', select: '_id email displayName role' })
      .populate({ path: 'targetUserId', select: '_id email displayName role' })
      .lean();

    return res.json({
      data: logs.map((entry) => ({
        id: entry._id,
        actor: entry.actorUserId,
        action: entry.action,
        target: entry.targetUserId,
        metadata: entry.metadata ?? {},
        createdAt: entry.createdAt
      }))
    });
  } catch (err) {
    return next(err);
  }
}
