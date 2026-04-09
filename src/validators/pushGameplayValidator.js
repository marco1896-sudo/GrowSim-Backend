import { httpError } from '../utils/httpError.js';

const ALLOWED_TYPES = new Set([
  'plant_needs_water',
  'event_occurred',
  'harvest_ready',
  'daily_reward_available'
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidRelativeUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return false;
  if (trimmed.startsWith('//')) return false;
  return true;
}

export function validateGameplayDispatchPayload(req, _res, next) {
  const payload = req.body;
  const errors = [];

  if (!isPlainObject(payload)) {
    return next(httpError(400, 'Invalid payload', [{ field: 'body', message: 'Request body must be an object' }], 'invalid_payload'));
  }

  const type = typeof payload.type === 'string' ? payload.type.trim() : '';
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  const tag = payload.tag;
  const url = payload.url;
  const data = payload.data;

  if (!type) {
    errors.push({ field: 'type', message: 'type is required' });
  } else if (!ALLOWED_TYPES.has(type)) {
    errors.push({
      field: 'type',
      message: `type must be one of: ${Array.from(ALLOWED_TYPES).join(', ')}`
    });
  }

  if (!title) {
    errors.push({ field: 'title', message: 'title is required' });
  } else if (title.length > 120) {
    errors.push({ field: 'title', message: 'title must be at most 120 characters' });
  }

  if (!body) {
    errors.push({ field: 'body', message: 'body is required' });
  } else if (body.length > 200) {
    errors.push({ field: 'body', message: 'body must be at most 200 characters' });
  }

  if (tag !== undefined && typeof tag !== 'string') {
    errors.push({ field: 'tag', message: 'tag must be a string' });
  }

  if (url !== undefined && !isValidRelativeUrl(url)) {
    errors.push({ field: 'url', message: 'url must be a relative path starting with /' });
  }

  if (data !== undefined && !isPlainObject(data)) {
    errors.push({ field: 'data', message: 'data must be an object' });
  }

  if (errors.length > 0) {
    return next(httpError(400, 'Invalid payload', errors, 'invalid_payload'));
  }

  req.gameplayPush = {
    type,
    title,
    body,
    tag: typeof tag === 'string' ? tag.trim() : undefined,
    url: typeof url === 'string' ? url.trim() : undefined,
    data: isPlainObject(data) ? data : undefined
  };

  return next();
}

export const gameplayPushAllowedTypes = Object.freeze(Array.from(ALLOWED_TYPES));
