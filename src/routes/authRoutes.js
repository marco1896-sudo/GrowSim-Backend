import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, me } from '../controllers/authController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post(
  '/register',
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters long'),
  body('displayName').optional().trim().isLength({ min: 1, max: 80 }).withMessage('Display name must be 1-80 characters long'),
  validateRequest,
  register
);

router.post(
  '/login',
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('Password is required'),
  validateRequest,
  login
);

router.get('/me', requireAuth, me);

export default router;
