import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { pushConfig } from '../config/push.js';
import { evaluateAndDispatchUsersBatch } from './gameplayPushEvaluator.js';

let intervalRef = null;
let isTickRunning = false;

async function runTick() {
  if (isTickRunning) return;
  isTickRunning = true;

  try {
    if (!pushConfig.enabled) {
      logger.warn('gameplay_push_scheduler_skip_push_not_configured');
      return;
    }

    const summary = await evaluateAndDispatchUsersBatch({
      limit: env.gameplayPushBatchSize
    });

    logger.info('gameplay_push_scheduler_tick_completed', {
      processedUsers: summary.processedUsers,
      sentCount: summary.sentCount
    });
  } catch (err) {
    logger.error('gameplay_push_scheduler_tick_failed', {
      error: err?.message
    });
  } finally {
    isTickRunning = false;
  }
}

export function startGameplayPushScheduler() {
  if (!env.gameplayPushSchedulerEnabled) {
    logger.info('gameplay_push_scheduler_disabled');
    return () => {};
  }

  if (intervalRef) {
    return () => {
      clearInterval(intervalRef);
      intervalRef = null;
    };
  }

  const intervalMs = env.gameplayPushIntervalSeconds * 1000;
  intervalRef = setInterval(runTick, intervalMs);
  intervalRef.unref();

  setTimeout(runTick, 15_000).unref();

  logger.info('gameplay_push_scheduler_started', {
    intervalSeconds: env.gameplayPushIntervalSeconds,
    batchSize: env.gameplayPushBatchSize
  });

  return () => {
    if (intervalRef) {
      clearInterval(intervalRef);
      intervalRef = null;
      logger.info('gameplay_push_scheduler_stopped');
    }
  };
}
