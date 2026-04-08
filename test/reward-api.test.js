import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { afterEach, test, mock } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-with-at-least-32chars';
process.env.MONGODB_URI = 'mongodb://localhost:27017/growsim-test';

const [{ default: app }, { User }, { LeaderboardEntry }, { RewardDefinition }, { RewardGrant }, { PlayerInventory }] =
  await Promise.all([
    import('../src/app.js'),
    import('../src/models/User.js'),
    import('../src/models/LeaderboardEntry.js'),
    import('../src/models/RewardDefinition.js'),
    import('../src/models/RewardGrant.js'),
    import('../src/models/PlayerInventory.js')
  ]);

const authUser = {
  _id: '507f1f77bcf86cd799439011',
  email: 'player@example.com',
  displayName: 'Player One',
  role: 'user',
  isBanned: false,
  badges: [],
  async save() {
    return this;
  }
};

function authHeader(userId = authUser._id) {
  return `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: String(userId), expiresIn: '1h' })}`;
}

function mockAuth(user = authUser) {
  mock.method(User, 'findById', (id) => {
    if (String(id) === String(user._id)) {
      return {
        select() {
          return {
            lean: async () => user
          };
        },
        then(resolve) {
          return Promise.resolve(user).then(resolve);
        }
      };
    }

    return {
      select() {
        return {
          lean: async () => ({ ...user, _id: id, displayName: 'Other Player' })
        };
      },
      then(resolve) {
        return Promise.resolve({ ...user, _id: id, displayName: 'Other Player' }).then(resolve);
      }
    };
  });
}

function asLean(value) {
  return {
    lean: async () => value
  };
}

async function apiRequest(method, path, { token = authHeader(), body } = {}) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();

  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: {
      Authorization: token,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json();
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));

  return { response, payload };
}

function createLeaderboardEntry({ category, rank, score, submissionId = 'sub_verified' }) {
  return {
    _id: `${category}_${rank}`,
    entryId: `ldb_${category}_${rank}`,
    userId: authUser._id,
    submissionId,
    scope: 'weekly',
    periodKey: '2026-W15',
    category,
    score,
    rank,
    verifiedAt: new Date('2026-04-08T08:15:05.000Z'),
    displayNameSnapshot: 'Player One',
    titleSnapshot: null,
    scoreBreakdown: {
      harvestScore: 90,
      qualityScore: 88,
      stabilityScore: 84
    }
  };
}

afterEach(() => {
  mock.restoreAll();
});

test('verified weekly placements generate reward grants and GET /rewards returns them', async () => {
  mockAuth();

  const rewardDefinitions = new Map();
  const grants = [];
  const inventory = {
    userId: authUser._id,
    badges: [],
    titles: [],
    cosmetics: [],
    premiumCurrency: 0,
    seedPacks: 0,
    claimedGrantIds: [],
    async save() {
      return this;
    }
  };

  mock.method(RewardDefinition, 'findOneAndUpdate', async (filter, update) => {
    const definition = { rewardKey: filter.rewardKey, ...update.$setOnInsert };
    rewardDefinitions.set(definition.tier, definition);
    return definition;
  });
  mock.method(RewardDefinition, 'findOne', (filter) => asLean(rewardDefinitions.get(filter.tier)));
  mock.method(LeaderboardEntry, 'find', () =>
    asLean([
      createLeaderboardEntry({ category: 'overall', rank: 12, score: 86.4 }),
      createLeaderboardEntry({ category: 'quality', rank: 2, score: 93.1, submissionId: 'sub_quality' })
    ])
  );
  mock.method(RewardGrant, 'findOne', async (filter) => grants.find((grant) => grant.userId === filter.userId && grant.category === filter.category) || null);
  mock.method(RewardGrant, 'create', async (input) => {
    const grant = {
      ...input,
      async save() {
        return this;
      }
    };
    grants.push(grant);
    return grant;
  });
  mock.method(RewardGrant, 'find', () => ({
    sort() {
      return {
        lean: async () => grants
      };
    }
  }));
  mock.method(PlayerInventory, 'findOneAndUpdate', async () => inventory);

  const { response, payload } = await apiRequest('GET', '/api/v1/rewards');

  assert.equal(response.status, 200);
  assert.equal(payload.scope, 'weekly');
  assert.equal(payload.grants.length, 2);
  assert.equal(payload.grants[0].status, 'claimable');
  assert.ok(payload.grants.some((grant) => grant.tier === 'top_25'));
  assert.ok(payload.grants.some((grant) => grant.tier === 'top_10'));
});

test('leaderboard absence yields clean reward state and provisional-only users get no grants', async () => {
  mockAuth();

  const rewardDefinitions = new Map();
  mock.method(RewardDefinition, 'findOneAndUpdate', async (filter, update) => {
    const definition = { rewardKey: filter.rewardKey, ...update.$setOnInsert };
    rewardDefinitions.set(definition.tier, definition);
    return definition;
  });
  mock.method(RewardDefinition, 'findOne', (filter) => asLean(rewardDefinitions.get(filter.tier)));
  mock.method(LeaderboardEntry, 'find', () => asLean([]));
  mock.method(RewardGrant, 'findOne', async () => null);
  mock.method(RewardGrant, 'find', () => ({
    sort() {
      return {
        lean: async () => []
      };
    }
  }));
  mock.method(PlayerInventory, 'findOneAndUpdate', async () => ({
    userId: authUser._id,
    badges: [],
    titles: [],
    cosmetics: [],
    premiumCurrency: 0,
    seedPacks: 0,
    claimedGrantIds: [],
    async save() {
      return this;
    }
  }));

  const { response, payload } = await apiRequest('GET', '/api/v1/rewards');

  assert.equal(response.status, 200);
  assert.deepEqual(payload.grants, []);
  assert.equal(payload.inventory.premiumCurrency, 0);
});

test('claim endpoint is idempotent and writes claimed rewards into inventory', async () => {
  mockAuth();

  const rewardDefinitions = new Map();
  const inventory = {
    userId: authUser._id,
    badges: [],
    titles: [],
    cosmetics: [],
    premiumCurrency: 0,
    seedPacks: 0,
    claimedGrantIds: [],
    async save() {
      return this;
    }
  };

  const grant = {
    grantId: 'grt_claim',
    userId: authUser._id,
    definitionKey: 'weekly_top_10',
    sourceSubmissionId: 'sub_verified',
    scope: 'weekly',
    periodKey: '2026-W15',
    category: 'overall',
    tier: 'top_10',
    placementRank: 8,
    score: 89.2,
    status: 'claimable',
    rewardSnapshot: {
      rewardKey: 'weekly_top_10',
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
    leaderboardEligible: true,
    claimedAt: null,
    async save() {
      return this;
    }
  };

  mock.method(RewardDefinition, 'findOneAndUpdate', async (filter, update) => {
    const definition = { rewardKey: filter.rewardKey, ...update.$setOnInsert };
    rewardDefinitions.set(definition.tier, definition);
    return definition;
  });
  mock.method(RewardDefinition, 'findOne', (filter) => asLean(rewardDefinitions.get(filter.tier)));
  mock.method(LeaderboardEntry, 'find', () => asLean([createLeaderboardEntry({ category: 'overall', rank: 8, score: 89.2 })]));
  mock.method(RewardGrant, 'findOne', async (filter) => {
    if (filter.grantId) return grant;
    if (filter.category === 'overall') return grant;
    return null;
  });
  mock.method(RewardGrant, 'create', async () => grant);
  mock.method(RewardGrant, 'find', () => ({
    sort() {
      return {
        lean: async () => [grant]
      };
    }
  }));
  mock.method(PlayerInventory, 'findOneAndUpdate', async () => inventory);

  const firstClaim = await apiRequest('POST', '/api/v1/rewards/grt_claim/claim');
  assert.equal(firstClaim.response.status, 200);
  assert.equal(firstClaim.payload.grant.status, 'claimed');
  assert.equal(firstClaim.payload.inventory.premiumCurrency, 35);
  assert.ok(firstClaim.payload.inventory.badges.includes('weekly_top_10'));

  const secondClaim = await apiRequest('POST', '/api/v1/rewards/grt_claim/claim');
  assert.equal(secondClaim.response.status, 200);
  assert.equal(secondClaim.payload.grant.status, 'claimed');
  assert.equal(secondClaim.payload.inventory.premiumCurrency, 35);
  assert.equal(inventory.claimedGrantIds.length, 1);
});

test('reward summary reports claimable counts and inventory snapshot', async () => {
  mockAuth();

  const rewardDefinitions = new Map();
  const inventory = {
    userId: authUser._id,
    badges: ['weekly_participant'],
    titles: [],
    cosmetics: [],
    premiumCurrency: 10,
    seedPacks: 1,
    claimedGrantIds: ['grt_claimed'],
    async save() {
      return this;
    }
  };

  const grants = [
    {
      grantId: 'grt_claimed',
      userId: authUser._id,
      scope: 'weekly',
      periodKey: '2026-W15',
      category: 'overall',
      tier: 'participation',
      placementRank: 72,
      score: 70.5,
      status: 'claimed',
      leaderboardEligible: true,
      sourceSubmissionId: 'sub_claimed',
      claimedAt: new Date('2026-04-08T09:00:00.000Z'),
      rewardSnapshot: {
        rewardKey: 'weekly_participation',
        label: 'Weekly Participation',
        description: 'Verified weekly placement reward for joining the competitive board.',
        rewards: { badges: ['weekly_participant'], titles: [], cosmetics: [], premiumCurrency: 0, seedPacks: 1 }
      },
      async save() {
        return this;
      }
    },
    {
      grantId: 'grt_claimable',
      userId: authUser._id,
      scope: 'weekly',
      periodKey: '2026-W15',
      category: 'quality',
      tier: 'top_50',
      placementRank: 41,
      score: 84.5,
      status: 'claimable',
      leaderboardEligible: true,
      sourceSubmissionId: 'sub_claimable',
      claimedAt: null,
      rewardSnapshot: {
        rewardKey: 'weekly_top_50',
        label: 'Weekly Top 50',
        description: 'Reward for finishing inside the top 50 of a verified weekly leaderboard.',
        rewards: { badges: ['weekly_top_50'], titles: ['Top 50 Grower'], cosmetics: [], premiumCurrency: 10, seedPacks: 2 }
      },
      async save() {
        return this;
      }
    }
  ];

  mock.method(RewardDefinition, 'findOneAndUpdate', async (filter, update) => {
    const definition = { rewardKey: filter.rewardKey, ...update.$setOnInsert };
    rewardDefinitions.set(definition.tier, definition);
    return definition;
  });
  mock.method(RewardDefinition, 'findOne', (filter) => asLean(rewardDefinitions.get(filter.tier)));
  mock.method(LeaderboardEntry, 'find', () => asLean([]));
  mock.method(RewardGrant, 'findOne', async (filter) => grants.find((grant) => grant.category === filter.category) || null);
  mock.method(RewardGrant, 'find', () => ({
    sort() {
      return {
        lean: async () => grants
      };
    }
  }));
  mock.method(PlayerInventory, 'findOneAndUpdate', async () => inventory);

  const { response, payload } = await apiRequest('GET', '/api/v1/rewards/summary');

  assert.equal(response.status, 200);
  assert.equal(payload.claimableCount, 1);
  assert.equal(payload.claimedCount, 1);
  assert.equal(payload.hasClaimableRewards, true);
  assert.equal(payload.inventory.premiumCurrency, 10);
});
