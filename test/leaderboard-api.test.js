import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { afterEach, test, mock } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-with-at-least-32chars';
process.env.MONGODB_URI = 'mongodb://localhost:27017/growsim-test';

const [{ default: app }, { User }, { LeaderboardEntry }, { RunSession }, { RunSubmission }, { RunVerification }] = await Promise.all([
  import('../src/app.js'),
  import('../src/models/User.js'),
  import('../src/models/LeaderboardEntry.js'),
  import('../src/models/RunSession.js'),
  import('../src/models/RunSubmission.js'),
  import('../src/models/RunVerification.js')
]);

const authUser = {
  _id: '507f1f77bcf86cd799439011',
  email: 'player@example.com',
  displayName: 'Player One',
  role: 'user',
  isBanned: false,
  badges: [],
  lastLoginAt: null,
  createdAt: new Date('2026-04-08T09:00:00.000Z'),
  updatedAt: new Date('2026-04-08T09:00:00.000Z')
};

function authHeader(userId = authUser._id) {
  return `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: String(userId), expiresIn: '1h' })}`;
}

function mockAuth(user = authUser) {
  mock.method(User, 'findById', (id) => ({
    select() {
      return {
        lean: async () => (String(id) === String(user._id) ? user : { ...user, _id: id, displayName: 'Other Player' })
      };
    }
  }));
}

function asLean(value) {
  return {
    lean: async () => value
  };
}

async function apiRequest(method, path, { token, body } = {}) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();

  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: token } : {}),
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json();
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));

  return { response, payload };
}

function createEntry({
  entryId,
  userId,
  submissionId,
  category,
  score,
  qualityScore,
  stabilityScore,
  harvestScore,
  verifiedAt,
  displayName = 'Player'
}) {
  return {
    _id: `${entryId}_mongo`,
    entryId,
    userId,
    submissionId,
    scope: 'weekly',
    periodKey: '2026-W15',
    category,
    score,
    rank: null,
    displayNameSnapshot: displayName,
    titleSnapshot: null,
    verifiedAt: new Date(verifiedAt),
    scoreBreakdown: {
      harvestScore,
      qualityScore,
      stabilityScore
    }
  };
}

afterEach(() => {
  mock.restoreAll();
});

test('verified run appears in weekly overall and quality leaderboards', async () => {
  mockAuth();

  const session = {
    sessionId: 'rsn_verified',
    userId: authUser._id,
    startedAt: new Date('2026-04-08T07:30:00.000Z'),
    status: 'active',
    async save() {
      return this;
    }
  };

  let storedEntries = [];
  mock.method(RunSession, 'findOne', async () => session);
  mock.method(RunSubmission, 'findOne', () => asLean(null));
  mock.method(RunSubmission, 'create', async (input) => ({
    ...input,
    createdAt: new Date('2026-04-08T08:15:00.000Z'),
    updatedAt: new Date('2026-04-08T08:15:00.000Z')
  }));
  mock.method(RunVerification, 'create', async (input) => ({
    ...input,
    createdAt: new Date('2026-04-08T08:15:00.000Z'),
    updatedAt: new Date('2026-04-08T08:15:05.000Z')
  }));
  mock.method(LeaderboardEntry, 'findOne', async () => null);
  mock.method(LeaderboardEntry, 'create', async (input) => {
    storedEntries.push({ _id: `${input.entryId}_mongo`, ...input });
    return input;
  });
  mock.method(LeaderboardEntry, 'find', (filter = {}) => ({
    lean: async () =>
      storedEntries.filter(
        (entry) =>
          (!filter.scope || entry.scope === filter.scope) &&
          (!filter.periodKey || entry.periodKey === filter.periodKey) &&
          (!filter.category || entry.category === filter.category)
      )
  }));
  mock.method(LeaderboardEntry, 'updateOne', async (filter, update) => {
    storedEntries = storedEntries.map((entry) =>
      entry._id === filter._id ? { ...entry, rank: update.$set.rank } : entry
    );
    return { acknowledged: true };
  });

  const submitPayload = {
    sessionId: 'rsn_verified',
    clientVersion: '1.2.3',
    endedAt: '2026-04-08T08:15:00.000Z',
    endReason: 'completed',
    declaredSetup: { seedTier: 'hybrid' },
    declaredChallenges: [{ id: 'low-water', tier: 'normal' }],
    clientSummary: {
      harvest: { totalYield: 150, qualityPercent: 87 },
      stabilityScore: 82,
      efficiencyScore: 74,
      completedChallenges: 1
    },
    telemetry: {
      events: [{ t: 1 }, { t: 2 }]
    },
    clientHashes: {
      summaryHash: 'abc12345def67890'
    }
  };

  const submitResult = await apiRequest('POST', '/api/v1/runs/submit', {
    token: authHeader(),
    body: submitPayload
  });

  assert.equal(submitResult.response.status, 201);
  assert.equal(submitResult.payload.status, 'verified');
  assert.equal(submitResult.payload.leaderboardEligible, true);

  const overall = await apiRequest('GET', '/api/v1/leaderboards?scope=weekly&category=overall');
  const quality = await apiRequest('GET', '/api/v1/leaderboards?scope=weekly&category=quality');

  assert.equal(overall.response.status, 200);
  assert.equal(quality.response.status, 200);
  assert.equal(overall.payload.entries.length, 1);
  assert.equal(quality.payload.entries.length, 1);
  assert.equal(overall.payload.entries[0].submissionId, submitResult.payload.submissionId);
  assert.equal(quality.payload.entries[0].submissionId, submitResult.payload.submissionId);
});

test('provisional and rejected runs do not materialize into the leaderboard', async () => {
  mockAuth();

  const session = {
    sessionId: 'rsn_nonverified',
    userId: authUser._id,
    startedAt: new Date('2026-04-08T07:30:00.000Z'),
    status: 'active',
    async save() {
      return this;
    }
  };

  mock.method(RunSession, 'findOne', async () => session);
  mock.method(RunSubmission, 'findOne', () => asLean(null));
  mock.method(RunSubmission, 'create', async (input) => ({
    ...input,
    createdAt: new Date('2026-04-08T08:15:00.000Z'),
    updatedAt: new Date('2026-04-08T08:15:00.000Z')
  }));
  mock.method(RunVerification, 'create', async (input) => ({
    ...input,
    createdAt: new Date('2026-04-08T08:15:00.000Z'),
    updatedAt: new Date('2026-04-08T08:15:05.000Z')
  }));
  const createSpy = mock.method(LeaderboardEntry, 'create', async () => {
    throw new Error('should not create leaderboard entries');
  });
  mock.method(LeaderboardEntry, 'find', () => ({
    lean: async () => []
  }));

  const provisionalPayload = {
    sessionId: 'rsn_nonverified',
    clientVersion: '1.2.3',
    endedAt: '2026-04-08T08:15:00.000Z',
    endReason: 'completed',
    declaredSetup: { seedTier: 'hybrid' },
    declaredChallenges: [{ id: 'low-water', tier: 'normal' }],
    clientSummary: {
      harvest: { totalYield: 150, qualityPercent: 87 },
      stabilityScore: 82,
      efficiencyScore: 74,
      completedChallenges: 1
    },
    telemetry: {},
    clientHashes: {
      summaryHash: 'abc12345def67890'
    }
  };

  const provisional = await apiRequest('POST', '/api/v1/runs/submit', {
    token: authHeader(),
    body: provisionalPayload
  });

  assert.equal(provisional.response.status, 201);
  assert.equal(provisional.payload.status, 'provisional');
  assert.equal(createSpy.mock.callCount(), 0);

  const rejectedPayload = {
    ...provisionalPayload,
    sessionId: 'rsn_nonverified_2',
    telemetry: { events: [{ t: 1 }] },
    clientSummary: {
      harvest: { totalYield: 2000001, qualityPercent: 87 },
      stabilityScore: 82,
      efficiencyScore: 74,
      completedChallenges: 1
    }
  };

  const anotherSession = {
    ...session,
    sessionId: 'rsn_nonverified_2'
  };
  mock.method(RunSession, 'findOne', async ({ sessionId }) => (sessionId === 'rsn_nonverified_2' ? anotherSession : session));

  const rejected = await apiRequest('POST', '/api/v1/runs/submit', {
    token: authHeader(),
    body: rejectedPayload
  });

  assert.equal(rejected.response.status, 201);
  assert.equal(rejected.payload.status, 'rejected');
  assert.equal(createSpy.mock.callCount(), 0);
});

test('around-me and me return stable weekly placements and empty states', async () => {
  mockAuth();

  let storedEntries = [
    createEntry({
      entryId: 'ldb_1',
      userId: 'user-a',
      submissionId: 'sub-a',
      category: 'overall',
      score: 91,
      qualityScore: 86,
      stabilityScore: 84,
      harvestScore: 91,
      verifiedAt: '2026-04-08T08:00:00.000Z',
      displayName: 'Alpha'
    }),
    createEntry({
      entryId: 'ldb_2',
      userId: authUser._id,
      submissionId: 'sub-me',
      category: 'overall',
      score: 89,
      qualityScore: 85,
      stabilityScore: 83,
      harvestScore: 89,
      verifiedAt: '2026-04-08T08:01:00.000Z',
      displayName: 'Player One'
    }),
    createEntry({
      entryId: 'ldb_3',
      userId: 'user-c',
      submissionId: 'sub-c',
      category: 'overall',
      score: 88,
      qualityScore: 84,
      stabilityScore: 82,
      harvestScore: 88,
      verifiedAt: '2026-04-08T08:02:00.000Z',
      displayName: 'Charlie'
    })
  ];

  mock.method(LeaderboardEntry, 'find', ({ category }) => ({
    lean: async () => storedEntries.filter((entry) => entry.category === category)
  }));
  mock.method(LeaderboardEntry, 'updateOne', async (filter, update) => {
    storedEntries = storedEntries.map((entry) =>
      entry._id === filter._id ? { ...entry, rank: update.$set.rank } : entry
    );
    return { acknowledged: true };
  });
  mock.method(RunSubmission, 'findOne', () => asLean({ submissionId: 'sub-me', status: 'verified' }));
  mock.method(RunVerification, 'findOne', () => asLean({ submissionId: 'sub-me', verificationStatus: 'verified' }));

  const around = await apiRequest('GET', '/api/v1/leaderboards/around-me?scope=weekly&category=overall', {
    token: authHeader()
  });
  const me = await apiRequest('GET', '/api/v1/leaderboards/me?scope=weekly&category=overall', {
    token: authHeader()
  });
  const empty = await apiRequest('GET', '/api/v1/leaderboards/me?scope=weekly&category=quality', {
    token: authHeader()
  });

  assert.equal(around.response.status, 200);
  assert.equal(around.payload.centerRank, 2);
  assert.equal(around.payload.entries.length, 3);

  assert.equal(me.response.status, 200);
  assert.equal(me.payload.inLeaderboard, true);
  assert.equal(me.payload.currentRank, 2);
  assert.equal(me.payload.bestVerifiedSubmissionRef, 'sub-me');
  assert.equal(me.payload.leaderboardEligible, true);

  assert.equal(empty.response.status, 200);
  assert.equal(empty.payload.inLeaderboard, false);
  assert.equal(empty.payload.currentRank, null);
});

test('tie-breakers are deterministic and empty leaderboards stay stable', async () => {
  mockAuth();

  let storedEntries = [
    createEntry({
      entryId: 'ldb_quality_older',
      userId: 'user-a',
      submissionId: 'sub-a',
      category: 'quality',
      score: 90,
      qualityScore: 90,
      stabilityScore: 79,
      harvestScore: 88,
      verifiedAt: '2026-04-08T08:00:00.000Z',
      displayName: 'Alpha'
    }),
    createEntry({
      entryId: 'ldb_quality_newer',
      userId: 'user-b',
      submissionId: 'sub-b',
      category: 'quality',
      score: 90,
      qualityScore: 90,
      stabilityScore: 79,
      harvestScore: 88,
      verifiedAt: '2026-04-08T08:05:00.000Z',
      displayName: 'Bravo'
    })
  ];

  mock.method(LeaderboardEntry, 'find', ({ category }) => ({
    lean: async () => storedEntries.filter((entry) => entry.category === category)
  }));
  mock.method(LeaderboardEntry, 'updateOne', async (filter, update) => {
    storedEntries = storedEntries.map((entry) =>
      entry._id === filter._id ? { ...entry, rank: update.$set.rank } : entry
    );
    return { acknowledged: true };
  });

  const quality = await apiRequest('GET', '/api/v1/leaderboards?scope=weekly&category=quality');
  const emptyAround = await apiRequest('GET', '/api/v1/leaderboards/around-me?scope=weekly&category=overall', {
    token: authHeader('missing-user')
  });

  assert.equal(quality.response.status, 200);
  assert.equal(quality.payload.entries[0].submissionId, 'sub-a');
  assert.equal(quality.payload.entries[1].submissionId, 'sub-b');

  assert.equal(emptyAround.response.status, 200);
  assert.equal(emptyAround.payload.centerRank, null);
  assert.deepEqual(emptyAround.payload.entries, []);
});
