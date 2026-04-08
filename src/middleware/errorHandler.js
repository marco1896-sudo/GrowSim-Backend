import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

function handleMongooseError(err) {
  if (err?.name === 'ValidationError') {
    return {
      status: 422,
      message: 'Validation failed',
      details: Object.values(err.errors).map((entry) => entry.message),
      code: 'validation_failed'
    };
  }

  if (err?.name === 'CastError') {
    return {
      status: 400,
      message: `Invalid value for ${err.path}`,
      code: 'invalid_payload'
    };
  }

  if (err?.code === 11000) {
    return {
      status: 409,
      message: 'Duplicate key conflict',
      code: 'duplicate_conflict'
    };
  }

  return null;
}

export function notFoundHandler(req, res) {
  return res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    requestId: req.requestId
  });
}

export function errorHandler(err, req, res, _next) {
  const requestId = req.requestId;

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON payload',
      code: 'invalid_payload',
      requestId
    });
  }

  const dbError = handleMongooseError(err);
  if (dbError) {
    return res.status(dbError.status).json({
      error: dbError.message,
      code: dbError.code,
      details: dbError.details,
      requestId
    });
  }

  const status = Number(err?.status) || 500;
  const message = status >= 500 ? 'Internal server error' : err?.message || 'Request failed';

  logger.error('request_failed', {
    requestId,
    status,
    path: req.originalUrl,
    method: req.method,
    error: err?.message,
    stack: env.isProduction ? undefined : err?.stack
  });

  const payload = {
    error: message,
    requestId
  };

  if (err?.code) {
    payload.code = err.code;
  }

  if (err?.details) {
    payload.details = err.details;
  }

  if (!env.isProduction && status >= 500 && err?.stack) {
    payload.stack = err.stack;
  }

  return res.status(status).json(payload);
}
