import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { getPublicKeyHandler, subscribeHandler, testPushHandler, unsubscribeHandler } from '../controllers/pushController.js';
import { subscribeValidation, testPushValidation, unsubscribeValidation } from '../validators/pushValidators.js';

const router = Router();

router.get('/public-key', getPublicKeyHandler);
router.post('/subscribe', requireAuth, subscribeValidation, validateRequest, subscribeHandler);
router.post('/unsubscribe', requireAuth, unsubscribeValidation, validateRequest, unsubscribeHandler);
router.post('/test', requireAuth, testPushValidation, validateRequest, testPushHandler);

export default router;
