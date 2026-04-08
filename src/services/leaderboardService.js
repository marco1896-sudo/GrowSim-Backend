import { LeaderboardEntry } from '../models/LeaderboardEntry.js';
import { RunSubmission } from '../models/RunSubmission.js';
import { RunVerification } from '../models/RunVerification.js';
import { createPrefixedId } from '../utils/idGenerator.js';
import { getWeeklyPeriodKey } from '../utils/weeklyPeriod.js';
import { httpError } from '../utils/httpError.js';

const CATEGORY_CONFIG = {
  overall: {
    scoreField: 'harvestScore'
  },
  quality: {
    scoreField: 'qualityScore'
  }
};

function compareLeaderboardEntries(a, b, category) {
  const first = normalizeEntry(a);
  const second = normalizeEntry(b);

  if (category === 'overall') {
    if (second.score !== first.score) return second.score - first.score;
    if (second.scoreBreakdown.qualityScore !== first.scoreBreakdown.qualityScore) {
      return second.scoreBreakdown.qualityScore - first.scoreBreakdown.qualityScore;
    }
    if (second.scoreBreakdown.stabilityScore !== first.scoreBreakdown.stabilityScore) {
      return second.scoreBreakdown.stabilityScore - first.scoreBreakdown.stabilityScore;
    }
  }

  if (category === 'quality') {
    if (second.score !== first.score) return second.score - first.score;
    if (second.scoreBreakdown.harvestScore !== first.scoreBreakdown.harvestScore) {
      return second.scoreBreakdown.harvestScore - first.scoreBreakdown.harvestScore;
    }
    if (second.scoreBreakdown.stabilityScore !== first.scoreBreakdown.stabilityScore) {
      return second.scoreBreakdown.stabilityScore - first.scoreBreakdown.stabilityScore;
    }
  }

  const firstVerifiedAt = new Date(first.verifiedAt).getTime();
  const secondVerifiedAt = new Date(second.verifiedAt).getTime();
  if (firstVerifiedAt !== secondVerifiedAt) {
    return firstVerifiedAt - secondVerifiedAt;
  }

  return String(first.entryId).localeCompare(String(second.entryId));
}

function normalizeEntry(entry) {
  return {
    ...entry,
    score: Number(entry.score) || 0,
    scoreBreakdown: {
      harvestScore: Number(entry.scoreBreakdown?.harvestScore) || 0,
      qualityScore: Number(entry.scoreBreakdown?.qualityScore) || 0,
      stabilityScore: Number(entry.scoreBreakdown?.stabilityScore) || 0
    }
  };
}

function toPublicEntry(entry) {
  return {
    rank: entry.rank,
    player: {
      displayName: entry.displayNameSnapshot,
      title: entry.titleSnapshot || null
    },
    score: entry.score,
    entryId: entry.entryId,
    submissionId: entry.submissionId,
    verifiedAt: entry.verifiedAt
  };
}

async function recalculateRanks({ scope, periodKey, category }) {
  const entries = await LeaderboardEntry.find({ scope, periodKey, category }).lean();
  const sortedEntries = entries.slice().sort((a, b) => compareLeaderboardEntries(a, b, category));

  if (sortedEntries.length === 0) return [];

  await Promise.all(
    sortedEntries.map((entry, index) =>
      LeaderboardEntry.updateOne({ _id: entry._id }, { $set: { rank: index + 1 } })
    )
  );

  return sortedEntries.map((entry, index) => ({
    ...entry,
    rank: index + 1
  }));
}

function validateScopeAndCategory({ scope, category }) {
  if (scope !== 'weekly') {
    throw httpError(422, 'scope must be weekly', null, 'validation_failed');
  }

  if (!CATEGORY_CONFIG[category]) {
    throw httpError(422, 'category must be overall or quality', null, 'validation_failed');
  }
}

export async function materializeVerifiedLeaderboardEntries({ submission, verification, user }) {
  if (verification.verificationStatus !== 'verified' || !verification.verifiedResult) {
    return [];
  }

  const verifiedAt = verification.updatedAt || verification.createdAt || submission.updatedAt || submission.createdAt || new Date();
  const scope = 'weekly';
  const periodKey = getWeeklyPeriodKey(verifiedAt);
  const displayNameSnapshot = (user?.displayName || user?.email || 'Player').trim() || 'Player';
  const titleSnapshot = null;
  const scoreBreakdown = {
    harvestScore: verification.verifiedResult.harvestScore,
    qualityScore: verification.verifiedResult.qualityScore,
    stabilityScore: verification.verifiedResult.stabilityScore
  };

  const updatedEntries = [];

  for (const category of Object.keys(CATEGORY_CONFIG)) {
    const score = verification.verifiedResult[CATEGORY_CONFIG[category].scoreField];
    const incomingEntry = {
      entryId: createPrefixedId('ldb'),
      userId: submission.userId,
      submissionId: submission.submissionId,
      scope,
      periodKey,
      category,
      score,
      rank: null,
      displayNameSnapshot,
      titleSnapshot,
      verifiedAt,
      scoreBreakdown
    };

    const existingEntry = await LeaderboardEntry.findOne({
      userId: submission.userId,
      scope,
      periodKey,
      category
    });

    if (!existingEntry) {
      await LeaderboardEntry.create(incomingEntry);
      updatedEntries.push({ scope, periodKey, category });
      continue;
    }

    const candidateWins = compareLeaderboardEntries(
      { ...incomingEntry, entryId: incomingEntry.entryId },
      {
        ...existingEntry.toObject(),
        entryId: existingEntry.entryId
      },
      category
    ) < 0;

    if (candidateWins) {
      existingEntry.submissionId = submission.submissionId;
      existingEntry.score = score;
      existingEntry.displayNameSnapshot = displayNameSnapshot;
      existingEntry.titleSnapshot = titleSnapshot;
      existingEntry.verifiedAt = verifiedAt;
      existingEntry.scoreBreakdown = scoreBreakdown;
      await existingEntry.save();
      updatedEntries.push({ scope, periodKey, category });
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const item of updatedEntries) {
    const key = `${item.scope}:${item.periodKey}:${item.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  for (const target of deduped) {
    await recalculateRanks(target);
  }

  return deduped;
}

export async function getLeaderboard({ scope, category, limit = 25 }) {
  validateScopeAndCategory({ scope, category });
  const periodKey = getWeeklyPeriodKey(new Date());
  const rankedEntries = await recalculateRanks({ scope, periodKey, category });

  return {
    scope,
    category,
    periodKey,
    entries: rankedEntries.slice(0, limit).map(toPublicEntry)
  };
}

export async function getLeaderboardAroundMe({ scope, category, userId, windowSize = 2 }) {
  validateScopeAndCategory({ scope, category });
  const periodKey = getWeeklyPeriodKey(new Date());
  const rankedEntries = await recalculateRanks({ scope, periodKey, category });
  const userIndex = rankedEntries.findIndex((entry) => String(entry.userId) === String(userId));

  if (userIndex === -1) {
    return {
      scope,
      category,
      periodKey,
      centerRank: null,
      entries: []
    };
  }

  const start = Math.max(0, userIndex - windowSize);
  const end = Math.min(rankedEntries.length, userIndex + windowSize + 1);

  return {
    scope,
    category,
    periodKey,
    centerRank: rankedEntries[userIndex].rank,
    entries: rankedEntries.slice(start, end).map(toPublicEntry)
  };
}

export async function getMyLeaderboardPlacement({ scope, category, userId }) {
  validateScopeAndCategory({ scope, category });
  const periodKey = getWeeklyPeriodKey(new Date());
  const rankedEntries = await recalculateRanks({ scope, periodKey, category });
  const myEntry = rankedEntries.find((entry) => String(entry.userId) === String(userId));

  if (!myEntry) {
    return {
      scope,
      category,
      periodKey,
      inLeaderboard: false,
      currentRank: null,
      score: null,
      bestVerifiedSubmissionRef: null,
      leaderboardEligible: false
    };
  }

  const submission = await RunSubmission.findOne({ submissionId: myEntry.submissionId }).lean();
  const verification = await RunVerification.findOne({ submissionId: myEntry.submissionId }).lean();

  return {
    scope,
    category,
    periodKey,
    inLeaderboard: true,
    currentRank: myEntry.rank,
    score: myEntry.score,
    bestVerifiedSubmissionRef: myEntry.submissionId,
    leaderboardEligible: verification?.verificationStatus === 'verified' && submission?.status === 'verified'
  };
}
