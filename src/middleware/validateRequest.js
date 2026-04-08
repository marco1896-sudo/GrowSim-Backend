import { validationResult } from 'express-validator';
import { httpError } from '../utils/httpError.js';

export function validateRequest(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  return next(
    httpError(
      422,
      'Validation failed',
      result.array().map((entry) => ({
        field: entry.path,
        message: entry.msg,
        location: entry.location
      })),
      'validation_failed'
    )
  );
}
