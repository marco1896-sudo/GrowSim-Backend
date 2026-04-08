import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest.js';
import { requireAuth } from '../middleware/auth.js';
import { leaderboardQueryValidation } from '../validators/leaderboardValidators.js';
import {
  getLeaderboardAroundMeHandler,
  getLeaderboardHandler,
  getMyLeaderboardPlacementHandler
} from '../controllers/leaderboardController.js';

const router = Router();

router.get('/leaderboards', leaderboardQueryValidation, validateRequest, getLeaderboardHandler);
router.get('/leaderboards/around-me', requireAuth, leaderboardQueryValidation, validateRequest, getLeaderboardAroundMeHandler);
router.get('/leaderboards/me', requireAuth, leaderboardQueryValidation, validateRequest, getMyLeaderboardPlacementHandler);

export default router;
