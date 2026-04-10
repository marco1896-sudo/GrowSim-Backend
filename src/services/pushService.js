import { PushSubscription } from '../models/PushSubscription.js';
import { logger } from '../config/logger.js';
import { ensurePushConfigured, ensurePushPublicKeyConfigured, pushConfig, webpush } from '../config/push.js';
import { httpError } from '../utils/httpError.js';
import { createGameplayPushPayload, normalizePushPayload } from './pushPayloadFactory.js';

function normalizeSubscriptionInput(subscription) {
  if (!subscription || typeof subscription !== 'object' || Array.isArray(subscription)) {
    throw httpError(
      422,
      'Invalid push subscription payload',
      [{ field: 'subscription', message: 'subscription must be an object' }],
      'validation_failed'
    );
  }

  const endpoint = typeof subscription.endpoint === 'string' ? subscription.endpoint.trim() : '';
  const p256dh = typeof subscription.keys?.p256dh === 'string' ? subscription.keys.p256dh.trim() : '';
  const auth = typeof subscription.keys?.auth === 'string' ? subscription.keys.auth.trim() : '';

  const details = [];
  if (!endpoint) details.push({ field: 'subscription.endpoint', message: 'endpoint is required' });
  if (!p256dh) details.push({ field: 'subscription.keys.p256dh', message: 'keys.p256dh is required' });
  if (!auth) details.push({ field: 'subscription.keys.auth', message: 'keys.auth is required' });

  if (details.length > 0) {
    throw httpError(422, 'Invalid push subscription payload', details, 'validation_failed');
  }

  return {
    endpoint,
    keys: { p256dh, auth }
  };
}

function buildWebPushSubscription(subscription) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    }
  };
}

function isInvalidEndpointError(err) {
  const statusCode = Number(err?.statusCode);
  if ([404, 410].includes(statusCode)) return true;

  if (statusCode !== 400) return false;

  const body = JSON.stringify(err?.body || '').toLowerCase();
  return body.includes('notregistered') || body.includes('invalid') || body.includes('unregistered');
}

async function markSubscriptionSuccess(subscription) {
  await PushSubscription.updateOne(
    { _id: subscription._id },
    {
      $set: {
        lastSuccessAt: new Date(),
        lastFailureAt: null
      }
    }
  );
}

async function markSubscriptionFailure(subscription) {
  await PushSubscription.updateOne(
    { _id: subscription._id },
    {
      $set: {
        lastFailureAt: new Date()
      }
    }
  );
}

export async function upsertSubscriptionForUser({ userId, subscription, userAgent = '' }) {
  ensurePushConfigured();
  const normalized = normalizeSubscriptionInput(subscription);

  const updated = await PushSubscription.findOneAndUpdate(
    { endpoint: normalized.endpoint },
    {
      $set: {
        userId,
        endpoint: normalized.endpoint,
        keys: normalized.keys,
        userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : ''
      }
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true
    }
  ).lean();

  logger.info('push_subscription_upserted', {
    userId,
    subscriptionId: String(updated._id),
    endpoint: normalized.endpoint
  });

  return updated;
}

export async function removeSubscriptionForUser({ userId, endpoint }) {
  const trimmed = typeof endpoint === 'string' ? endpoint.trim() : '';
  if (!trimmed) {
    throw httpError(422, 'Invalid unsubscribe payload', [{ field: 'endpoint', message: 'endpoint is required' }], 'validation_failed');
  }

  const result = await PushSubscription.deleteOne({ userId, endpoint: trimmed });
  logger.info('push_subscription_removed', { userId, endpoint: trimmed, deletedCount: result.deletedCount });
  return result.deletedCount > 0;
}

export function getPublicVapidKey() {
  ensurePushPublicKeyConfigured();
  return pushConfig.publicKey;
}

export async function sendToSubscription(subscription, payload) {
  ensurePushConfigured();
  const normalizedPayload = normalizePushPayload(payload);
  const targetSubscription = buildWebPushSubscription(subscription);

  try {
    await webpush.sendNotification(targetSubscription, JSON.stringify(normalizedPayload));
    if (subscription?._id) {
      await markSubscriptionSuccess(subscription);
    }
    return { ok: true, removed: false };
  } catch (err) {
    if (subscription?._id) {
      await markSubscriptionFailure(subscription);
    }

    const statusCode = Number(err?.statusCode) || null;
    logger.warn('push_send_failed', {
      subscriptionId: subscription?._id ? String(subscription._id) : null,
      endpoint: subscription?.endpoint || null,
      statusCode,
      error: err?.message
    });

    if (isInvalidEndpointError(err)) {
      const filter = subscription?._id ? { _id: subscription._id } : { endpoint: subscription.endpoint };
      await PushSubscription.deleteOne(filter);
      logger.info('push_subscription_auto_removed', {
        endpoint: subscription?.endpoint || null,
        statusCode
      });
      return { ok: false, removed: true, statusCode };
    }

    return { ok: false, removed: false, statusCode, error: err?.message || 'Push delivery failed' };
  }
}

export async function sendToManySubscriptions(subscriptions, payload) {
  const deliveryResults = await Promise.all(subscriptions.map((subscription) => sendToSubscription(subscription, payload)));

  const successCount = deliveryResults.filter((entry) => entry.ok).length;
  const removedCount = deliveryResults.filter((entry) => entry.removed).length;
  const failedCount = deliveryResults.length - successCount;

  return {
    total: deliveryResults.length,
    successCount,
    failedCount,
    removedCount,
    results: deliveryResults
  };
}

export async function sendToUser(userId, payload) {
  ensurePushConfigured();
  const subscriptions = await PushSubscription.find({ userId }).lean();

  if (subscriptions.length === 0) {
    return {
      userId,
      total: 0,
      successCount: 0,
      failedCount: 0,
      removedCount: 0,
      results: []
    };
  }

  const result = await sendToManySubscriptions(subscriptions, payload);

  logger.info('push_send_to_user_completed', {
    userId,
    total: result.total,
    successCount: result.successCount,
    failedCount: result.failedCount,
    removedCount: result.removedCount
  });

  return {
    userId,
    ...result
  };
}

export async function sendGameplayTriggerNotification({ userId, type, overrides = {} }) {
  const payload = createGameplayPushPayload(type, overrides);
  return sendToUser(userId, payload);
}
