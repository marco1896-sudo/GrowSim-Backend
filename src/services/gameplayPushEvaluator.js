import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { PushSubscription } from '../models/PushSubscription.js';
import { Save } from '../models/Save.js';
import { RunSubmission } from '../models/RunSubmission.js';
import { RewardGrant } from '../models/RewardGrant.js';
import { GameplayPushState } from '../models/GameplayPushState.js';
import { PUSH_NOTIFICATION_TYPES, createGameplayPushPayload } from './pushPayloadFactory.js';
import { sendToUser } from './pushService.js';

const TYPE_PRIORITY = {
  [PUSH_NOTIFICATION_TYPES.PLANT_NEEDS_WATER]: 100,
  [PUSH_NOTIFICATION_TYPES.EVENT_OCCURRED]: 60,
  [PUSH_NOTIFICATION_TYPES.HARVEST_READY]: 50,
  [PUSH_NOTIFICATION_TYPES.DAILY_REWARD_AVAILABLE]: 20
};

const TYPE_COOLDOWN_MS = {
  [PUSH_NOTIFICATION_TYPES.PLANT_NEEDS_WATER]: 1000 * 60 * 60 * 3,
  [PUSH_NOTIFICATION_TYPES.EVENT_OCCURRED]: 1000 * 60 * 60 * 6,
  [PUSH_NOTIFICATION_TYPES.HARVEST_READY]: 1000 * 60 * 60 * 6,
  [PUSH_NOTIFICATION_TYPES.DAILY_REWARD_AVAILABLE]: 1000 * 60 * 60 * 12
};

const DEFAULT_ICON = '/icons/icon-192.png';
const DEFAULT_BADGE = '/icons/icon-192.png';

function getByPath(source, path) {
  if (!source || typeof source !== 'object') return undefined;
  return path.split('.').reduce((acc, segment) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return acc[segment];
  }, source);
}

function getNumberByPaths(source, paths) {
  for (const path of paths) {
    const value = getByPath(source, path);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function getDateByPaths(source, paths) {
  for (const path of paths) {
    const value = getByPath(source, path);
    if (typeof value !== 'string') continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function getHourInTimezone(date, timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false
    }).formatToParts(date);
    const hourPart = parts.find((entry) => entry.type === 'hour');
    if (!hourPart) return date.getUTCHours();
    const parsed = Number(hourPart.value);
    return Number.isFinite(parsed) ? parsed : date.getUTCHours();
  } catch {
    return date.getUTCHours();
  }
}

function isQuietHours(state, now) {
  const quietHours = state?.quietHours || {};
  const enabled = quietHours.enabled !== false;
  if (!enabled) return false;

  const startHour = Number.isFinite(quietHours.startHour) ? quietHours.startHour : env.gameplayPushQuietHoursStart;
  const endHour = Number.isFinite(quietHours.endHour) ? quietHours.endHour : env.gameplayPushQuietHoursEnd;
  const timezone = typeof quietHours.timezone === 'string' && quietHours.timezone.trim() ? quietHours.timezone : env.gameplayPushQuietHoursTimezone;
  const hour = getHourInTimezone(now, timezone);

  if (startHour === endHour) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

function withBasePushFields(payload) {
  return {
    ...payload,
    icon: payload.icon || DEFAULT_ICON,
    badge: payload.badge || DEFAULT_BADGE,
    tag: payload.tag || payload.type
  };
}

async function getOrCreatePushState(userId) {
  return GameplayPushState.findOneAndUpdate(
    { userId },
    {
      $setOnInsert: {
        userId,
        quietHours: {
          enabled: env.gameplayPushQuietHoursEnabled,
          startHour: env.gameplayPushQuietHoursStart,
          endHour: env.gameplayPushQuietHoursEnd,
          timezone: env.gameplayPushQuietHoursTimezone
        }
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );
}

function shouldSendCandidate({ candidate, state, now }) {
  const typeState = state.typeState?.[candidate.type];
  const cooldownMs = TYPE_COOLDOWN_MS[candidate.type] || 0;
  const lastSentAt = typeState?.lastSentAt ? new Date(typeState.lastSentAt) : null;
  const lastSignature = typeState?.lastSignature || '';

  if (lastSignature && lastSignature === candidate.signature) {
    return { send: false, reason: 'duplicate_signature' };
  }

  if (lastSentAt && now.getTime() - lastSentAt.getTime() < cooldownMs) {
    return { send: false, reason: 'cooldown_active' };
  }

  return { send: true };
}

function buildPlantNeedsWaterCandidate(save, now) {
  if (!save?.state || typeof save.state !== 'object') return null;

  const moisture = getNumberByPaths(save.state, [
    'plant.waterLevel',
    'plant.moisture',
    'plant.water',
    'status.waterLevel',
    'status.moisture',
    'simulation.waterLevel',
    'simulation.moisture'
  ]);

  const nextWaterAt = getDateByPaths(save.state, [
    'plant.nextWaterAt',
    'status.nextWaterAt',
    'events.nextWaterAt',
    'timers.nextWaterAt'
  ]);

  const moistureThreshold = 25;

  if (moisture !== null && moisture <= moistureThreshold) {
    const signature = `moisture:${Math.round(moisture)}`;
    return {
      type: PUSH_NOTIFICATION_TYPES.PLANT_NEEDS_WATER,
      priority: TYPE_PRIORITY[PUSH_NOTIFICATION_TYPES.PLANT_NEEDS_WATER],
      signature,
      payload: withBasePushFields(
        createGameplayPushPayload(PUSH_NOTIFICATION_TYPES.PLANT_NEEDS_WATER, {
          url: '/garden',
          data: { moisture }
        })
      )
    };
  }

  if (nextWaterAt && nextWaterAt.getTime() <= now.getTime()) {
    const signature = `nextWaterAt:${nextWaterAt.toISOString().slice(0, 16)}`;
    return {
      type: PUSH_NOTIFICATION_TYPES.PLANT_NEEDS_WATER,
      priority: TYPE_PRIORITY[PUSH_NOTIFICATION_TYPES.PLANT_NEEDS_WATER],
      signature,
      payload: withBasePushFields(
        createGameplayPushPayload(PUSH_NOTIFICATION_TYPES.PLANT_NEEDS_WATER, {
          url: '/garden',
          data: { nextWaterAt: nextWaterAt.toISOString() }
        })
      )
    };
  }

  return null;
}

function buildEventOccurredCandidate(save) {
  if (!save?.state || typeof save.state !== 'object') return null;

  const activeEvents = [];
  const fromArray = getByPath(save.state, 'events.active');
  if (Array.isArray(fromArray)) {
    for (const entry of fromArray) {
      if (!entry || typeof entry !== 'object') continue;
      const eventId = typeof entry.id === 'string' ? entry.id.trim() : '';
      if (!eventId) continue;
      const eventName = typeof entry.name === 'string' ? entry.name.trim() : '';
      activeEvents.push({ id: eventId, name: eventName });
    }
  }

  if (activeEvents.length === 0) {
    const currentEvent = getByPath(save.state, 'events.current');
    if (currentEvent && typeof currentEvent === 'object') {
      const eventId = typeof currentEvent.id === 'string' ? currentEvent.id.trim() : '';
      if (eventId) {
        activeEvents.push({
          id: eventId,
          name: typeof currentEvent.name === 'string' ? currentEvent.name.trim() : ''
        });
      }
    }
  }

  if (activeEvents.length === 0) return null;

  const sortedIds = activeEvents.map((entry) => entry.id).sort();
  const signature = `events:${sortedIds.join('|')}`;
  const firstLabel = activeEvents[0].name || activeEvents[0].id;

  return {
    type: PUSH_NOTIFICATION_TYPES.EVENT_OCCURRED,
    priority: TYPE_PRIORITY[PUSH_NOTIFICATION_TYPES.EVENT_OCCURRED],
    signature,
    payload: withBasePushFields(
      createGameplayPushPayload(PUSH_NOTIFICATION_TYPES.EVENT_OCCURRED, {
        body: `Aktives Event: ${firstLabel}. Schau vorbei und sichere dir Vorteile.`,
        url: '/events',
        data: { eventIds: sortedIds }
      })
    )
  };
}

function buildHarvestReadyCandidate(runSubmission) {
  if (!runSubmission) return null;

  const signature = `submission:${runSubmission.submissionId}:${runSubmission.status}`;
  return {
    type: PUSH_NOTIFICATION_TYPES.HARVEST_READY,
    priority: TYPE_PRIORITY[PUSH_NOTIFICATION_TYPES.HARVEST_READY],
    signature,
    payload: withBasePushFields(
      createGameplayPushPayload(PUSH_NOTIFICATION_TYPES.HARVEST_READY, {
        url: '/harvest',
        data: {
          submissionId: runSubmission.submissionId,
          status: runSubmission.status
        }
      })
    )
  };
}

function buildDailyRewardCandidate(grant) {
  if (!grant) return null;

  const signature = `reward:${grant.grantId}:${grant.periodKey}:${grant.category}`;
  return {
    type: PUSH_NOTIFICATION_TYPES.DAILY_REWARD_AVAILABLE,
    priority: TYPE_PRIORITY[PUSH_NOTIFICATION_TYPES.DAILY_REWARD_AVAILABLE],
    signature,
    payload: withBasePushFields(
      createGameplayPushPayload(PUSH_NOTIFICATION_TYPES.DAILY_REWARD_AVAILABLE, {
        url: '/rewards',
        data: {
          grantId: grant.grantId,
          periodKey: grant.periodKey,
          category: grant.category
        }
      })
    )
  };
}

async function collectCandidatesForUser(userId, now) {
  const [save, latestHarvestSubmission, claimableGrant] = await Promise.all([
    Save.findOne({ userId, slot: 'main' }).lean(),
    RunSubmission.findOne({
      userId,
      status: { $in: ['verified', 'provisional'] }
    })
      .sort({ updatedAt: -1 })
      .lean(),
    RewardGrant.findOne({ userId, status: 'claimable' })
      .sort({ updatedAt: -1 })
      .lean()
  ]);

  const candidates = [
    buildPlantNeedsWaterCandidate(save, now),
    buildEventOccurredCandidate(save),
    buildHarvestReadyCandidate(latestHarvestSubmission),
    buildDailyRewardCandidate(claimableGrant)
  ].filter(Boolean);

  return candidates.sort((a, b) => b.priority - a.priority);
}

async function persistEvaluationState({ state, now, selectedCandidate, sent }) {
  state.lastEvaluatedAt = now;
  if (sent) {
    state.lastPushAt = now;
  }

  if (selectedCandidate) {
    const typeState = state.typeState?.[selectedCandidate.type];
    if (typeState) {
      typeState.lastCandidateAt = now;
      if (sent) {
        typeState.lastSentAt = now;
        typeState.lastSignature = selectedCandidate.signature;
      }
    }
  }

  await state.save();
}

export async function evaluateAndDispatchForUser(userId, now = new Date()) {
  const state = await getOrCreatePushState(userId);

  if (isQuietHours(state, now)) {
    await persistEvaluationState({ state, now, selectedCandidate: null, sent: false });
    return { userId, sent: false, reason: 'quiet_hours' };
  }

  const candidates = await collectCandidatesForUser(userId, now);
  if (candidates.length === 0) {
    await persistEvaluationState({ state, now, selectedCandidate: null, sent: false });
    return { userId, sent: false, reason: 'no_candidates' };
  }

  let selectedCandidate = null;
  for (const candidate of candidates) {
    const decision = shouldSendCandidate({ candidate, state, now });
    if (decision.send) {
      selectedCandidate = candidate;
      break;
    }
  }

  if (!selectedCandidate) {
    await persistEvaluationState({ state, now, selectedCandidate: candidates[0], sent: false });
    return { userId, sent: false, reason: 'cooldown_or_duplicate' };
  }

  const dispatchResult = await sendToUser(userId, selectedCandidate.payload);
  const sent = dispatchResult.successCount > 0;

  await persistEvaluationState({ state, now, selectedCandidate, sent });

  return {
    userId,
    sent,
    type: selectedCandidate.type,
    dispatchResult
  };
}

export async function evaluateAndDispatchUsersBatch({ limit = env.gameplayPushBatchSize } = {}) {
  const activeUsers = await PushSubscription.aggregate([
    { $sort: { updatedAt: -1 } },
    { $group: { _id: '$userId', latestSubAt: { $max: '$updatedAt' } } },
    { $sort: { latestSubAt: -1 } },
    { $limit: limit }
  ]);

  const results = [];
  for (const userEntry of activeUsers) {
    const userId = String(userEntry._id);
    try {
      const result = await evaluateAndDispatchForUser(userId);
      results.push(result);
    } catch (err) {
      logger.error('gameplay_push_evaluation_failed', {
        userId,
        error: err?.message
      });
      results.push({ userId, sent: false, reason: 'evaluation_error' });
    }
  }

  return {
    processedUsers: activeUsers.length,
    sentCount: results.filter((entry) => entry.sent).length,
    results
  };
}
