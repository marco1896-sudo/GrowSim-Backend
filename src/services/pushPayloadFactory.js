import { httpError } from '../utils/httpError.js';

export const PUSH_NOTIFICATION_TYPES = Object.freeze({
  GENERAL: 'general',
  TEST: 'test',
  PLANT_NEEDS_WATER: 'plant_needs_water',
  EVENT_OCCURRED: 'event_occurred',
  HARVEST_READY: 'harvest_ready',
  DAILY_REWARD_AVAILABLE: 'daily_reward_available'
});

const TEMPLATE_BY_TYPE = {
  [PUSH_NOTIFICATION_TYPES.PLANT_NEEDS_WATER]: {
    title: 'Deine Pflanze braucht Wasser',
    body: 'Schau kurz im Grow-Raum vorbei, bevor der Zustand sinkt.',
    tag: 'plant-needs-water'
  },
  [PUSH_NOTIFICATION_TYPES.EVENT_OCCURRED]: {
    title: 'Neues Event in GrowSim',
    body: 'Ein neues Ereignis ist aktiv. Reagiere jetzt fuer bessere Ergebnisse.',
    tag: 'event-occurred'
  },
  [PUSH_NOTIFICATION_TYPES.HARVEST_READY]: {
    title: 'Ernte ist bereit',
    body: 'Dein Lauf ist bereit fuer die Ernte. Zeit fuer den Abschluss.',
    tag: 'harvest-ready'
  },
  [PUSH_NOTIFICATION_TYPES.DAILY_REWARD_AVAILABLE]: {
    title: 'Daily Reward verfuegbar',
    body: 'Deine taegliche Belohnung wartet bereits auf dich.',
    tag: 'daily-reward'
  }
};

function sanitizeOptionalString(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function normalizePushPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw httpError(422, 'Invalid push payload', [{ field: 'payload', message: 'payload must be an object' }], 'validation_failed');
  }

  const title = sanitizeOptionalString(payload.title);
  const body = sanitizeOptionalString(payload.body);

  if (!title) {
    throw httpError(422, 'Invalid push payload', [{ field: 'payload.title', message: 'title is required' }], 'validation_failed');
  }
  if (!body) {
    throw httpError(422, 'Invalid push payload', [{ field: 'payload.body', message: 'body is required' }], 'validation_failed');
  }

  const normalized = {
    title,
    body,
    icon: sanitizeOptionalString(payload.icon),
    badge: sanitizeOptionalString(payload.badge),
    tag: sanitizeOptionalString(payload.tag),
    url: sanitizeOptionalString(payload.url),
    type: sanitizeOptionalString(payload.type) || PUSH_NOTIFICATION_TYPES.GENERAL
  };

  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    normalized.data = payload.data;
  }

  return normalized;
}

export function createGameplayPushPayload(type, overrides = {}) {
  const template = TEMPLATE_BY_TYPE[type];
  if (!template) {
    throw httpError(
      400,
      `Unsupported gameplay push type: ${type}`,
      [{ field: 'type', message: `Use one of: ${Object.keys(TEMPLATE_BY_TYPE).join(', ')}` }],
      'invalid_payload'
    );
  }

  return normalizePushPayload({
    ...template,
    type,
    ...overrides
  });
}
