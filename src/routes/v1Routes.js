import { Router } from 'express';
import harvestRoutes from './harvestRoutes.js';
import leaderboardRoutes from './leaderboardRoutes.js';
import rewardRoutes from './rewardRoutes.js';

const router = Router();

router.use('/', harvestRoutes);
router.use('/', leaderboardRoutes);
router.use('/', rewardRoutes);

export default router;
