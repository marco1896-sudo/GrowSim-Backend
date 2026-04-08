import { RewardDefinition } from '../models/RewardDefinition.js';
import { RewardGrant } from '../models/RewardGrant.js';
import { PlayerInventory } from '../models/PlayerInventory.js';
import { LeaderboardEntry } from '../models/LeaderboardEntry.js';
import { User } from '../models/User.js';
import { createPrefixedId } from '../utils/idGenerator.js';
import { getWeeklyPeriodKey } from '../utils/weeklyPeriod.js';
import { httpError } from '../utils/httpError.js';

const REWARD_DEFINITIONS = [
  {
    rewardKey: 'weekly_participation',
    tier: 'participation',
    label: 'Weekly Participation',
    description: 'Verified weekly placement reward for joining the competitive board.',
    rewards: { badges: ['weekly_participant'], titles: [], cosmetics: [], premiumCurrency: 0, seedPacks: 1 }
  },
  {
    rewardKey: 'weekly_top_50',
    tier: 'top_50',
    label: 'Weekly Top 50',
    description: 'Reward for finishing inside the top 50 of a verified weekly leaderboard.',
    rewards: { badges: ['weekly_top_50'], titles: ['Top 50 Grower'], cosmetics: [], premiumCurrency: 10, seedPacks: 2 }
  },
  {
    rewardKey: 'weekly_top_25',
    tier: 'top_25',
    label: 'Weekly Top 25',
    description: 'Reward for finishing inside the top 25 of a verified weekly leaderboard.',
    rewards: {
      badges: ['weekly_top_25'],
      titles: ['Top 25 Grower'],
      cosmetics: ['accent_trim_silver'],
      premiumCurrency: 20,
      seedPacks: 3
    }
  },
  {
    rewardKey: 'weekly_top_10',
    tier: 'top_10',
    label: 'Weekly Top 10',
    description: 'Reward for finishing inside the top 10 of a verified weekly leaderboard.',
    rewards: {
      badges: ['weekly_top_10'],
      titles: ['Top 10 Grower'],
      cosmetics: ['accent_trim_gold'],
      premiumCurrency: 35,
      seedPacks: 4
    }
  },
  {
    rewardKey: 'weekly_top_1',
    tier: 'top_1',
    label: 'Weekly Champion',
    description: 'Reward for finishing rank 1 on a verified weekly leaderboard.',
    rewards: {
      badges: ['weekly_champion'],
      titles: ['Weekly Champion'],
      cosmetics: ['champion_halo'],
      premiumCurrency: 60,
      seedPacks: 5
    }
  }
];

function determineTier(rank) {
  if (rank === 1) return 'top_1';
  if (rank <= 10) return 'top_10';
  if (rank <= 25) return 'top_25';
  if (rank <= 50) return 'top_50';
  return 'participation';
}

function toRewardSnapshot(definition) {
  return {
    rewardKey: definition.rewardKey,
    label: definition.label,
    description: definition.description,
    rewards: {
      badges: Array.isArray(definition.rewards?.badges) ? [...definition.rewards.badges] : [],
      titles: Array.isArray(definition.rewards?.titles) ? [...definition.rewards.titles] : [],
      cosmetics: Array.isArray(definition.rewards?.cosmetics) ? [...definition.rewards.cosmetics] : [],
      premiumCurrency: Number(definition.rewards?.premiumCurrency) || 0,
      seedPacks: Number(definition.rewards?.seedPacks) || 0
    }
  };
}

function toGrantResponse(grant) {
  return {
    grantId: grant.grantId,
    scope: grant.scope,
    periodKey: grant.periodKey,
    category: grant.category,
    tier: grant.tier,
    placementRank: grant.placementRank,
    score: grant.score,
    status: grant.status,
    leaderboardEligible: Boolean(grant.leaderboardEligible),
    sourceSubmissionId: grant.sourceSubmissionId,
    claimedAt: grant.claimedAt || null,
    reward: grant.rewardSnapshot
  };
}

function toInventoryResponse(inventory) {
  return {
    badges: Array.isArray(inventory?.badges) ? inventory.badges : [],
    titles: Array.isArray(inventory?.titles) ? inventory.titles : [],
    cosmetics: Array.isArray(inventory?.cosmetics) ? inventory.cosmetics : [],
    premiumCurrency: Number(inventory?.premiumCurrency) || 0,
    seedPacks: Number(inventory?.seedPacks) || 0
  };
}

function mergeUnique(currentValues, incomingValues) {
  return Array.from(new Set([...(currentValues || []), ...(incomingValues || [])]));
}

async function ensureRewardDefinitions() {
  for (const definition of REWARD_DEFINITIONS) {
    await RewardDefinition.findOneAndUpdate(
      { rewardKey: definition.rewardKey },
      { $setOnInsert: { ...definition, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

async function getDefinitionByTier(tier) {
  const definition = await RewardDefinition.findOne({ tier, isActive: true }).lean();
  if (!definition) {
    throw httpError(500, `Missing reward definition for tier ${tier}`);
  }

  return definition;
}

async function ensureInventory(userId) {
  return PlayerInventory.findOneAndUpdate(
    { userId },
    {
      $setOnInsert: {
        userId,
        badges: [],
        titles: [],
        cosmetics: [],
        premiumCurrency: 0,
        seedPacks: 0,
        claimedGrantIds: []
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function refreshWeeklyRewardGrantsForUser(userId) {
  await ensureRewardDefinitions();

  const periodKey = getWeeklyPeriodKey(new Date());
  const leaderboardEntries = await LeaderboardEntry.find({ userId, scope: 'weekly', periodKey }).lean();
  const refreshedGrants = [];

  for (const entry of leaderboardEntries) {
    const tier = determineTier(entry.rank);
    const definition = await getDefinitionByTier(tier);
    const rewardSnapshot = toRewardSnapshot(definition);

    const existingGrant = await RewardGrant.findOne({
      userId,
      scope: 'weekly',
      periodKey,
      category: entry.category
    });

    if (!existingGrant) {
      const createdGrant = await RewardGrant.create({
        grantId: createPrefixedId('grt'),
        userId,
        definitionKey: definition.rewardKey,
        sourceSubmissionId: entry.submissionId,
        scope: 'weekly',
        periodKey,
        category: entry.category,
        tier,
        placementRank: entry.rank,
        score: entry.score,
        status: 'claimable',
        rewardSnapshot,
        leaderboardEligible: true,
        claimedAt: null
      });
      refreshedGrants.push(createdGrant);
      continue;
    }

    if (existingGrant.status === 'claimed') {
      refreshedGrants.push(existingGrant);
      continue;
    }

    existingGrant.definitionKey = definition.rewardKey;
    existingGrant.sourceSubmissionId = entry.submissionId;
    existingGrant.tier = tier;
    existingGrant.placementRank = entry.rank;
    existingGrant.score = entry.score;
    existingGrant.rewardSnapshot = rewardSnapshot;
    existingGrant.leaderboardEligible = true;
    await existingGrant.save();
    refreshedGrants.push(existingGrant);
  }

  return { periodKey, grants: refreshedGrants };
}

export async function getRewards({ userId }) {
  const { periodKey } = await refreshWeeklyRewardGrantsForUser(userId);
  const [grants, inventory] = await Promise.all([
    RewardGrant.find({ userId, scope: 'weekly', periodKey }).sort({ claimedAt: 1, category: 1, updatedAt: -1 }).lean(),
    ensureInventory(userId)
  ]);

  return {
    scope: 'weekly',
    periodKey,
    grants: grants.map(toGrantResponse),
    inventory: toInventoryResponse(inventory)
  };
}

export async function getRewardSummary({ userId }) {
  const rewards = await getRewards({ userId });
  const claimableCount = rewards.grants.filter((grant) => grant.status === 'claimable').length;
  const claimedCount = rewards.grants.filter((grant) => grant.status === 'claimed').length;

  return {
    scope: rewards.scope,
    periodKey: rewards.periodKey,
    claimableCount,
    claimedCount,
    hasClaimableRewards: claimableCount > 0,
    inventory: rewards.inventory
  };
}

export async function claimRewardGrant({ userId, grantId }) {
  const { periodKey } = await refreshWeeklyRewardGrantsForUser(userId);
  const grant = await RewardGrant.findOne({ grantId, userId, scope: 'weekly' });

  if (!grant) {
    throw httpError(404, 'Reward grant not found', null, 'reward_grant_not_found');
  }

  const inventory = await ensureInventory(userId);

  if (grant.status === 'claimed') {
    return {
      scope: 'weekly',
      periodKey,
      grant: toGrantResponse(grant),
      inventory: toInventoryResponse(inventory)
    };
  }

  inventory.badges = mergeUnique(inventory.badges, grant.rewardSnapshot.rewards.badges);
  inventory.titles = mergeUnique(inventory.titles, grant.rewardSnapshot.rewards.titles);
  inventory.cosmetics = mergeUnique(inventory.cosmetics, grant.rewardSnapshot.rewards.cosmetics);
  inventory.premiumCurrency += Number(grant.rewardSnapshot.rewards.premiumCurrency) || 0;
  inventory.seedPacks += Number(grant.rewardSnapshot.rewards.seedPacks) || 0;
  inventory.claimedGrantIds = mergeUnique(inventory.claimedGrantIds, [grant.grantId]);
  await inventory.save();

  const user = await User.findById(userId);
  if (user) {
    user.badges = mergeUnique(user.badges, grant.rewardSnapshot.rewards.badges);
    await user.save();
  }

  grant.status = 'claimed';
  grant.claimedAt = new Date();
  await grant.save();

  return {
    scope: 'weekly',
    periodKey,
    grant: toGrantResponse(grant),
    inventory: toInventoryResponse(inventory)
  };
}
