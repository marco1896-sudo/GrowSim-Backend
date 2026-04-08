import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createRunSessionValidation,
  getRunSubmissionValidation,
  submitRunValidation
} from '../validators/harvestValidators.js';
import {
  createRunSessionHandler,
  getRunSubmissionHandler,
  submitRunHandler
} from '../controllers/harvestController.js';

const router = Router();

router.post('/run-sessions', requireAuth, createRunSessionValidation, validateRequest, createRunSessionHandler);
router.post('/runs/submit', requireAuth, submitRunValidation, validateRequest, submitRunHandler);
router.get('/runs/:submissionId', requireAuth, getRunSubmissionValidation, validateRequest, getRunSubmissionHandler);

export default router;
