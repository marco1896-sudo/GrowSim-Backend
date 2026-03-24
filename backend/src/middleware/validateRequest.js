import { validationResult } from 'express-validator';

export function validateRequest(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  return next({
    status: 400,
    message: 'Validation failed',
    details: result.array()
  });
}
