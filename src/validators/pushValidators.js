import { body } from 'express-validator';

export const subscribeValidation = [
  body().custom((value, { req }) => {
    const subscription = req.body.subscription ?? value;
    if (!subscription || typeof subscription !== 'object' || Array.isArray(subscription)) {
      throw new Error('subscription payload is required');
    }

    if (typeof subscription.endpoint !== 'string' || !subscription.endpoint.trim()) {
      throw new Error('subscription.endpoint is required');
    }

    if (typeof subscription.keys?.p256dh !== 'string' || !subscription.keys.p256dh.trim()) {
      throw new Error('subscription.keys.p256dh is required');
    }

    if (typeof subscription.keys?.auth !== 'string' || !subscription.keys.auth.trim()) {
      throw new Error('subscription.keys.auth is required');
    }

    return true;
  })
];

export const unsubscribeValidation = [
  body('endpoint').isString().trim().notEmpty().withMessage('endpoint is required')
];

export const testPushValidation = [
  body('payload').optional().isObject().withMessage('payload must be an object'),
  body('payload.title').optional().isString().trim().notEmpty().withMessage('payload.title must be a non-empty string'),
  body('payload.body').optional().isString().trim().notEmpty().withMessage('payload.body must be a non-empty string')
];
