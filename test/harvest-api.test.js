import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { afterEach, test, mock } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-with-at-least-32chars';
process.env.MONGODB_URI = 'mongodb://localhost:27017/growsim-test';

const [{ default: app }, { User }, { RunSession }, { RunSubmission }, { RunVerification }, { LeaderboardEntry }] = await Promise.all([
  import('../src/app.js'),
  import('../src/models/User.js'),
  import('../src/models/RunSession.js'),
  import('../src/models/RunSubmission.js'),
  import('../src/models/RunVerification.js'),
  import('../src/models/LeaderboardEntry.js')
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
  mock.method(User, 'findById', () => ({
    select() {
      return {
        lean: async () => user
      };
    }
  }));
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

function validSessionPayload() {
  return {
    clientVersion: '1.2.3',
    startedAt: '2026-04-08T07:30:00.000Z',
    declaredSetup: {
      seedTier: 'hybrid',
      trayCount: 3
    },
    declaredChallenges: [{ id: 'low-water', tier: 'normal' }]
  };
}

function validSubmitPayload() {
  return {
    sessionId: 'rsn_validsession',
    clientVersion: '1.2.3',
    endedAt: '2026-04-08T08:15:00.000Z',
    endReason: 'completed',
    declaredSetup: {
      seedTier: 'hybrid',
      trayCount: 3
    },
    declaredChallenges: [{ id: 'low-water', tier: 'normal' }],
    clientSummary: {
      harvest: {
        totalYield: 152,
        qualityPercent: 84
      },
      stabilityScore: 78,
      efficiencyScore: 73,
      completedChallenges: 1
    },
    telemetry: {
      events: [{ t: 1 }, { t: 2 }, { t: 3 }],
      resources: {
        efficiency: 0.74
      }
    },
    clientHashes: {
      summaryHash: 'abc12345def67890'
    }
  };
}

afterEach(() => {
  mock.restoreAll();
});

test('POST /api/v1/run-sessions creates a run session', async () => {
  mockAuth();
  mock.method(RunSession, 'create', async (input) => ({
    ...input,
    createdAt: new Date('2026-04-08T07:30:00.000Z')
  }));

  const { response, payload } = await apiRequest('POST', '/api/v1/run-sessions', {
    body: validSessionPayload()
  });

  assert.equal(response.status, 201);
  assert.equal(payload.status, 'active');
  assert.match(payload.sessionId, /^rsn_/);
  assert.equal(payload.createdAt, '2026-04-08T07:30:00.000Z');
});

test('POST /api/v1/runs/submit accepts a valid submission and returns an authoritative result', async () => {
  mockAuth();

  const session = {
    sessionId: 'rsn_validsession',
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
  mock.method(LeaderboardEntry, 'findOne', async () => null);
  mock.method(LeaderboardEntry, 'create', async (input) => input);
  mock.method(LeaderboardEntry, 'find', () => ({
    lean: async () => []
  }));
  mock.method(LeaderboardEntry, 'updateOne', async () => ({ acknowledged: true }));

  const { response, payload } = await apiRequest('POST', '/api/v1/runs/submit', {
    body: validSubmitPayload()
  });

  assert.equal(response.status, 201);
  assert.equal(payload.status, 'verified');
  assert.equal(payload.leaderboardEligible, true);
  assert.equal(typeof payload.result.harvestScore, 'number');
  assert.equal(payload.reviewNeeded, false);
  assert.deepEqual(payload.anomalyFlags, []);
});

test('GET /api/v1/runs/:submissionId returns the current submission status', async () => {
  mockAuth();
  mock.method(RunSubmission, 'findOne', () =>
    asLean({
      submissionId: 'sub_lookup',
      userId: authUser._id,
      updatedAt: new Date('2026-04-08T08:15:05.000Z')
    })
  );
  mock.method(RunVerification, 'findOne', () =>
    asLean({
      submissionId: 'sub_lookup',
      verificationStatus: 'provisional',
      provisionalResult: {
        harvestScore: 78.2,
        yieldScore: 80.5,
        qualityScore: 79,
        stabilityScore: 75.1,
        efficiencyScore: 74.9,
        challengeScore: 60
      },
      verifiedResult: null,
      anomalyFlags: ['telemetry_sparse'],
      reviewNeeded: false,
      updatedAt: new Date('2026-04-08T08:15:06.000Z')
    })
  );

  const { response, payload } = await apiRequest('GET', '/api/v1/runs/sub_lookup');

  assert.equal(response.status, 200);
  assert.equal(payload.submissionId, 'sub_lookup');
  assert.equal(payload.status, 'provisional');
  assert.equal(payload.result.harvestScore, 78.2);
  assert.deepEqual(payload.anomalyFlags, ['telemetry_sparse']);
});

test('POST /api/v1/runs/submit rejects missing required fields', async () => {
  mockAuth();

  const { response, payload } = await apiRequest('POST', '/api/v1/runs/submit', {
    body: {}
  });

  assert.equal(response.status, 422);
  assert.equal(payload.code, 'validation_failed');
  assert.ok(Array.isArray(payload.details));
});

test('POST /api/v1/runs/submit rejects unknown sessions', async () => {
  mockAuth();
  mock.method(RunSession, 'findOne', async () => null);

  const { response, payload } = await apiRequest('POST', '/api/v1/runs/submit', {
    body: validSubmitPayload()
  });

  assert.equal(response.status, 404);
  assert.equal(payload.code, 'session_not_found');
});

test('POST /api/v1/runs/submit rejects sessions owned by another user', async () => {
  mockAuth();
  mock.method(RunSession, 'findOne', async () => ({
    sessionId: 'rsn_validsession',
    userId: '507f191e810c19729de860ea'
  }));

  const { response, payload } = await apiRequest('POST', '/api/v1/runs/submit', {
    body: validSubmitPayload()
  });

  assert.equal(response.status, 403);
  assert.equal(payload.code, 'session_not_owned');
});

test('POST /api/v1/runs/submit blocks duplicate submissions', async () => {
  mockAuth();
  mock.method(RunSession, 'findOne', async () => ({
    sessionId: 'rsn_validsession',
    userId: authUser._id
  }));
  mock.method(RunSubmission, 'findOne', () => asLean({ submissionId: 'sub_existing' }));

  const { response, payload } = await apiRequest('POST', '/api/v1/runs/submit', {
    body: validSubmitPayload()
  });

  assert.equal(response.status, 409);
  assert.equal(payload.code, 'duplicate_submission');
});

test('POST /api/v1/runs/submit flags and rejects obvious extreme values', async () => {
  mockAuth();

  const session = {
    sessionId: 'rsn_validsession',
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
  mock.method(LeaderboardEntry, 'findOne', async () => null);
  mock.method(LeaderboardEntry, 'create', async () => {
    throw new Error('leaderboard entries must not be created for rejected runs');
  });
  mock.method(LeaderboardEntry, 'find', () => ({
    lean: async () => []
  }));
  mock.method(LeaderboardEntry, 'updateOne', async () => ({ acknowledged: true }));

  const payload = validSubmitPayload();
  payload.clientSummary.harvest.totalYield = 2000001;

  const { response, payload: responsePayload } = await apiRequest('POST', '/api/v1/runs/submit', {
    body: payload
  });

  assert.equal(response.status, 201);
  assert.equal(responsePayload.status, 'rejected');
  assert.equal(responsePayload.reviewNeeded, false);
  assert.ok(responsePayload.anomalyFlags.includes('extreme_client_summary_values'));
});
