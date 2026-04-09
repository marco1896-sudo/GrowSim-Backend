import {
  getPublicVapidKey,
  removeSubscriptionForUser,
  sendToUser,
  upsertSubscriptionForUser
} from '../services/pushService.js';

const DEFAULT_TEST_PAYLOAD = {
  title: 'GrowSim Test-Benachrichtigung',
  body: 'Web Push fuer deinen Account funktioniert.',
  icon: '/static/icons/icon-192.png',
  badge: '/static/icons/icon-192.png',
  tag: 'growsim-test',
  url: '/',
  type: 'test',
  data: { source: 'push.test' }
};

export function getPublicKeyHandler(_req, res, next) {
  try {
    const publicKey = getPublicVapidKey();
    return res.json({ publicKey });
  } catch (err) {
    return next(err);
  }
}

export async function subscribeHandler(req, res, next) {
  try {
    const subscriptionPayload = req.body.subscription ?? req.body;

    const subscription = await upsertSubscriptionForUser({
      userId: req.auth.userId,
      subscription: subscriptionPayload,
      userAgent: req.headers['user-agent'] || req.body.userAgent || ''
    });

    return res.status(200).json({
      message: 'Push subscription saved',
      subscriptionId: String(subscription._id),
      endpoint: subscription.endpoint
    });
  } catch (err) {
    return next(err);
  }
}

export async function unsubscribeHandler(req, res, next) {
  try {
    const removed = await removeSubscriptionForUser({
      userId: req.auth.userId,
      endpoint: req.body.endpoint
    });

    return res.status(200).json({
      message: removed ? 'Push subscription removed' : 'No subscription found for endpoint',
      removed
    });
  } catch (err) {
    return next(err);
  }
}

export async function testPushHandler(req, res, next) {
  try {
    const payload = {
      ...DEFAULT_TEST_PAYLOAD,
      ...(req.body.payload || {}),
      type: req.body.payload?.type || DEFAULT_TEST_PAYLOAD.type
    };

    const result = await sendToUser(req.auth.userId, payload);

    return res.status(200).json({
      message: 'Test push dispatch finished',
      ...result
    });
  } catch (err) {
    return next(err);
  }
}
