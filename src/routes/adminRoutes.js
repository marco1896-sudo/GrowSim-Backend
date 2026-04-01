import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  createAdminSession,
  clearAdminSession,
  getAdminLoginPage,
  getAdminPage,
  getAdminOverviewStats,
  listAdminUsers,
  getAdminUserById,
  updateAdminUserRole,
  updateAdminUserBan,
  updateAdminUserBadges,
  updateAdminUserNotes,
  listAdminAuditLogs
} from '../controllers/adminController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

router.get('/login', getAdminLoginPage);
router.post('/session', body('token').isString().notEmpty().withMessage('token is required'), validateRequest, createAdminSession);
router.post('/logout', clearAdminSession);

router.get('/', requireAuth, requireAdmin, getAdminPage);

router.get('/stats/overview', requireAuth, requireAdmin, getAdminOverviewStats);
router.get(
  '/users',
  requireAuth,
  requireAdmin,
  query('search').optional().isString(),
  query('role').optional().isIn(['user', 'tester', 'moderator', 'admin']),
  query('banned').optional().isIn(['true', 'false']),
  query('badge').optional().isString().trim().notEmpty().isLength({ max: 100 }),
  query('sortBy').optional().isIn(['createdAt', 'lastLoginAt', 'role']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  listAdminUsers
);

router.get('/users/:id', requireAuth, requireAdmin, param('id').isMongoId(), validateRequest, getAdminUserById);
router.patch(
  '/users/:id/role',
  requireAuth,
  requireAdmin,
  param('id').isMongoId(),
  body('role').isIn(['user', 'tester', 'moderator', 'admin']),
  validateRequest,
  updateAdminUserRole
);
router.patch(
  '/users/:id/ban',
  requireAuth,
  requireAdmin,
  param('id').isMongoId(),
  body('isBanned').isBoolean(),
  validateRequest,
  updateAdminUserBan
);
router.patch(
  '/users/:id/badges',
  requireAuth,
  requireAdmin,
  param('id').isMongoId(),
  body('action').isIn(['add', 'remove']),
  body('badge').isString().trim().notEmpty().isLength({ max: 100 }),
  validateRequest,
  updateAdminUserBadges
);
router.patch(
  '/users/:id/notes',
  requireAuth,
  requireAdmin,
  param('id').isMongoId(),
  body('adminNotes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  validateRequest,
  updateAdminUserNotes
);
router.get(
  '/audit-logs',
  requireAuth,
  requireAdmin,
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('targetUserId').optional().isMongoId(),
  validateRequest,
  listAdminAuditLogs
);

export default router;
