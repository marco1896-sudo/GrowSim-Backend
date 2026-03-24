import { Router } from 'express';
import { body } from 'express-validator';
import { getSave, upsertSave } from '../controllers/saveController.js';
import { authRequired } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

router.get('/', authRequired, getSave);

router.post(
  '/',
  authRequired,
  body('state').exists().withMessage('state is required').custom((value) => value && typeof value === 'object'),
  body('slot').optional().isString().isLength({ min: 1, max: 50 }),
  validateRequest,
  upsertSave
);

export default router;
