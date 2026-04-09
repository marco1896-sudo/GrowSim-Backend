import { logger } from '../config/logger.js';
import { httpError } from '../utils/httpError.js';
import { sendToUser } from '../services/pushService.js';

const DEFAULT_ICON = '/icons/icon-192.png';
const DEFAULT_BADGE = '/icons/icon-192.png';

export async function gameplayDispatchHandler(req, res, next) {
  try {
    const userId = req.auth?.userId || req.user?.id;
    if (!userId) {
      return next(httpError(401, 'Unauthorized', null, 'unauthorized'));
    }

    const input = req.gameplayPush || {};
    const payload = {
      type: input.type,
      title: input.title,
      body: input.body,
      icon: DEFAULT_ICON,
      badge: DEFAULT_BADGE,
      tag: input.tag || input.type,
      ...(input.url ? { url: input.url } : {}),
      ...(input.data ? { data: input.data } : {})
    };

    const dispatchResult = await sendToUser(userId, payload);
    const sent = dispatchResult.successCount > 0;

    return res.status(200).json({
      message: 'Gameplay push dispatched',
      type: payload.type,
      sent
    });
  } catch (err) {
    logger.error('gameplay_push_dispatch_failed', {
      userId: req.auth?.userId || req.user?.id || null,
      type: req.gameplayPush?.type || null,
      error: err?.message
    });
    return next(err);
  }
}
