import { Router } from 'express';
import { body, query } from 'express-validator';
import { getSave, upsertSave } from '../controllers/saveController.js';
import { authRequired } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const slotRule = /^[a-zA-Z0-9_-]{1,50}$/;

const isValidState = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  return bytes <= 1024 * 1024;
};

const slotValidationMessage = 'slot must contain only letters, numbers, _ or -, max 50 chars';

const router = Router();

router.get(
  '/',
  authRequired,
  query('slot').optional().isString().matches(slotRule).withMessage(slotValidationMessage),
  validateRequest,
  getSave
);

router.post(
  '/',
  authRequired,
  body('state')
    .exists()
    .withMessage('state is required')
    .bail()
    .custom(isValidState)
    .withMessage('state must be an object with max 1MB JSON size'),
  body('slot').optional().isString().matches(slotRule).withMessage(slotValidationMessage),
  validateRequest,
  upsertSave
);

export default router;
