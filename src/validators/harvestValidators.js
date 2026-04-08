import { body, param } from 'express-validator';

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isIsoDateString(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isChallengeArray(value) {
  return Array.isArray(value) && value.every((entry) => entry && typeof entry === 'object' && !Array.isArray(entry));
}

export const createRunSessionValidation = [
  body('clientVersion').trim().isString().isLength({ min: 1, max: 80 }).withMessage('clientVersion is required'),
  body('startedAt')
    .optional({ values: 'falsy' })
    .custom(isIsoDateString)
    .withMessage('startedAt must be a valid ISO date string'),
  body('declaredSetup')
    .optional({ values: 'falsy' })
    .custom(isPlainObject)
    .withMessage('declaredSetup must be an object'),
  body('declaredChallenges')
    .optional({ values: 'falsy' })
    .custom(isChallengeArray)
    .withMessage('declaredChallenges must be an array of objects')
];

export const submitRunValidation = [
  body('sessionId').trim().isString().isLength({ min: 1, max: 50 }).withMessage('sessionId is required'),
  body('clientVersion').trim().isString().isLength({ min: 1, max: 80 }).withMessage('clientVersion is required'),
  body('endedAt').custom(isIsoDateString).withMessage('endedAt must be a valid ISO date string'),
  body('endReason')
    .isString()
    .isIn(['completed', 'failed', 'aborted', 'timeout'])
    .withMessage('endReason must be one of completed, failed, aborted or timeout'),
  body('declaredSetup').custom(isPlainObject).withMessage('declaredSetup must be an object'),
  body('declaredChallenges').custom(isChallengeArray).withMessage('declaredChallenges must be an array of objects'),
  body('clientSummary').custom(isPlainObject).withMessage('clientSummary must be an object'),
  body('telemetry').custom(isPlainObject).withMessage('telemetry must be an object'),
  body('clientHashes').custom(isPlainObject).withMessage('clientHashes must be an object')
];

export const getRunSubmissionValidation = [
  param('submissionId').trim().isString().isLength({ min: 1, max: 50 }).withMessage('submissionId is required')
];
