import webpush from 'web-push';
import { env } from './env.js';
import { logger } from './logger.js';
import { httpError } from '../utils/httpError.js';

const hasCompleteVapidConfig = Boolean(env.vapidPublicKey && env.vapidPrivateKey && env.vapidSubject);

if (hasCompleteVapidConfig) {
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
  logger.info('push_vapid_initialized', { subject: env.vapidSubject });
} else {
  logger.warn('push_vapid_not_configured', {
    hasPublicKey: Boolean(env.vapidPublicKey),
    hasPrivateKey: Boolean(env.vapidPrivateKey),
    hasSubject: Boolean(env.vapidSubject)
  });
}

export const pushConfig = {
  enabled: hasCompleteVapidConfig,
  publicKey: env.vapidPublicKey
};

export function ensurePushConfigured() {
  if (!pushConfig.enabled) {
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
