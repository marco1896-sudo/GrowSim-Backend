import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  claimRewardGrantHandler,
  getRewardSummaryHandler,
  getRewardsHandler
} from '../controllers/rewardController.js';
import { claimRewardGrantValidation } from '../validators/rewardValidators.js';

const router = Router();

router.get('/rewards', requireAuth, getRewardsHandler);
router.get('/rewards/summary', requireAuth, getRewardSummaryHandler);
router.post('/rewards/:grantId/claim', requireAuth, claimRewardGrantValidation, validateRequest, claimRewardGrantHandler);

export default router;
