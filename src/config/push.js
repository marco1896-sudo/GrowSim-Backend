import webpush from 'web-push';
import { env } from './env.js';
import { logger } from './logger.js';
import { httpError } from '../utils/httpError.js';

const hasPublicVapidKey = Boolean(env.vapidPublicKey);
const hasCompleteVapidConfig = Boolean(env.vapidPublicKey && env.vapidPrivateKey && env.vapidSubject);
const missingVapidParts = [
  !env.vapidPublicKey ? 'VAPID_PUBLIC_KEY' : null,
  !env.vapidPrivateKey ? 'VAPID_PRIVATE_KEY' : null,
  !env.vapidSubject ? 'VAPID_SUBJECT' : null
].filter(Boolean);

if (hasCompleteVapidConfig) {
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
  logger.info('push_vapid_initialized', { subject: env.vapidSubject });
} else {
  logger.warn('push_vapid_not_configured', {
    missing: missingVapidParts,
    hasPublicKey: Boolean(env.vapidPublicKey),
    hasPrivateKey: Boolean(env.vapidPrivateKey),
    hasSubject: Boolean(env.vapidSubject)
  });
}

export const pushConfig = {
  hasPublicKey: hasPublicVapidKey,
  enabled: hasCompleteVapidConfig,
  publicKey: env.vapidPublicKey
};

export function ensurePushPublicKeyConfigured() {
  if (pushConfig.hasPublicKey) return;

  logger.warn('push_public_key_unavailable', {
    missing: missingVapidParts
  });
  throw httpError(
    503,
    'Web Push public key is not configured on this server',
    [
      {
        field: 'VAPID_PUBLIC_KEY',
        message: 'Set VAPID_PUBLIC_KEY to allow clients to initialize PushManager'
      }
    ],
    'push_public_key_not_configured'
  );
}

export function ensurePushConfigured() {
  if (!pushConfig.enabled) {
    logger.warn('push_dispatch_not_configured', {
      missing: missingVapidParts
    });
    throw httpError(
      503,
      'Web Push is not configured on this server',
      [
        {
          field: 'VAPID_*',
          message: 'Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT to enable push notifications'
        }
      ],
      'push_not_configured'
    );
  }
}

export { webpush };
