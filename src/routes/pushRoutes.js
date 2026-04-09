import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { getPublicKeyHandler, subscribeHandler, testPushHandler, unsubscribeHandler } from '../controllers/pushController.js';
import { subscribeValidation, testPushValidation, unsubscribeValidation } from '../validators/pushValidators.js';
import { validateGameplayDispatchPayload } from '../validators/pushGameplayValidator.js';
import { gameplayDispatchHandler } from '../controllers/pushGameplayController.js';

const router = Router();

router.get('/public-key', getPublicKeyHandler);
router.post('/subscribe', requireAuth, subscribeValidation, validateRequest, subscribeHandler);
router.post('/unsubscribe', requireAuth, unsubscribeValidation, validateRequest, unsubscribeHandler);
router.post('/test', requireAuth, testPushValidation, validateRequest, testPushHandler);
router.post('/gameplay-dispatch', requireAuth, validateGameplayDispatchPayload, gameplayDispatchHandler);

export default router;
