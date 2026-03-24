import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, me } from '../controllers/authController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.post(
  '/register',
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 chars'),
  body('displayName').optional().isString().isLength({ max: 80 }),
  validateRequest,
  register
);

router.post(
  '/login',
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isString().notEmpty().withMessage('Password is required'),
  validateRequest,
  login
);

router.get('/me', authRequired, me);

export default router;
