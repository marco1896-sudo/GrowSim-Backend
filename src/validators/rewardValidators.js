import { param } from 'express-validator';

export const claimRewardGrantValidation = [
  param('grantId').trim().isString().isLength({ min: 1, max: 50 }).withMessage('grantId is required')
];
