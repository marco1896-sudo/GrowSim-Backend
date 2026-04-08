import { Router } from 'express';
import harvestRoutes from './harvestRoutes.js';

const router = Router();

router.use('/', harvestRoutes);

export default router;
