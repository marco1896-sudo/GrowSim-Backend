# API Overview

Base URL local: `http://localhost:8080`

## Health

### GET `/api/health`

Returns service and database status.

## Auth

### POST `/api/auth/register`

Body:

```json
{
  "email": "you@example.com",
  "password": "secret12345",
  "displayName": "Marco"
}
```

### POST `/api/auth/login`

Body:

```json
{
  "email": "you@example.com",
  "password": "secret12345"
}
```

### GET `/api/auth/me`

Header:

```text
Authorization: Bearer <jwt>
```

## Save System

### GET `/api/save?slot=main`

Header:

```text
Authorization: Bearer <jwt>
```

### POST `/api/save`

Header:

```text
Authorization: Bearer <jwt>
Content-Type: application/json
```

Body:

```json
{
  "slot": "main",
  "state": {
    "simulation": {},
    "plant": {},
    "events": {},
    "status": {}
  }
}
```

Rules:
- `slot` only `[a-zA-Z0-9_-]`, max 50 chars
- `state` must be a JSON object (max 1MB)

## Harvest Foundation

Harvest endpoints are authenticated and return the server-side authoritative harvest result.
Frontend-side forecasts remain preview-only and are not treated as authoritative.

### POST `/api/v1/run-sessions`

Header:

```text
Authorization: Bearer <jwt>
Content-Type: application/json
```

Body:

```json
{
  "clientVersion": "1.2.3",
  "startedAt": "2026-04-08T09:30:00.000Z",
  "declaredSetup": {
    "seedTier": "hybrid"
  },
  "declaredChallenges": [
    {
      "id": "low-water",
      "tier": "normal"
    }
  ]
}
```

Response fields:
- `sessionId`
- `createdAt`
- `status`

### POST `/api/v1/runs/submit`

Header:

```text
Authorization: Bearer <jwt>
Content-Type: application/json
```

Required body fields:
- `sessionId`
- `clientVersion`
- `endedAt`
- `endReason`
- `declaredSetup`
- `declaredChallenges`
- `clientSummary`
- `telemetry`
- `clientHashes`

Response shape:

```json
{
  "submissionId": "sub_xxx",
  "status": "provisional",
  "leaderboardEligible": false,
  "result": {
    "harvestScore": 82.7,
    "yieldScore": 89.1,
    "qualityScore": 84.8,
    "stabilityScore": 81.2,
    "efficiencyScore": 77.9,
    "challengeScore": 65
  },
  "anomalyFlags": [],
  "reviewNeeded": false,
  "updatedAt": "2026-04-08T10:00:00.000Z"
}
```

### GET `/api/v1/runs/:submissionId`

Header:

```text
Authorization: Bearer <jwt>
```

Response fields:
- `submissionId`
- `status`
- `leaderboardEligible` (`true` only when the run is verified and materialized for the active weekly leaderboard)
- `result` (`verifiedResult` when available, otherwise `provisionalResult`)
- `anomalyFlags`
- `reviewNeeded`
- `updatedAt`

### Harvest Status Model

- `submitted`
- `provisional`
- `verified`
- `rejected`
- `under_review`

### Active Verification Rules

- session must exist
- session must belong to the authenticated user
- duplicate submit is blocked
- required fields and basic schema must be valid
- `endReason` must be one of `completed`, `failed`, `aborted`, `timeout`
- time axis must be plausible
- obvious extreme numeric values are flagged and can be rejected
- sparse telemetry or weak client hash coverage can downgrade to `provisional` or `under_review`
- server calculates the authoritative result instead of blindly trusting client scores

## Leaderboard V1

Leaderboard V1 is verified-only, weekly-only, and read-only.
Only verified runs can be materialized into leaderboard entries.
Provisional, rejected, and under-review runs never appear.

### Weekly Period Key

The backend uses an ISO-style weekly key in UTC:
- Monday is the start of the week
- format: `YYYY-Www`
- examples: `2026-W15`, `2026-W16`

The same weekly key logic is used for materialization, top leaderboard reads, around-me reads, and me reads.

### Categories

- `overall` uses the verified `harvestScore`
- `quality` uses the verified `qualityScore`

### Tie-breakers

Overall:
1. higher overall score
2. higher quality score
3. higher stability score
4. earlier verified timestamp
5. stable `entryId` fallback

Quality:
1. higher quality score
2. higher overall score
3. higher stability score
4. earlier verified timestamp
5. stable `entryId` fallback

### GET `/api/v1/leaderboards?scope=weekly&category=overall|quality&limit=25`

Response:

```json
{
  "scope": "weekly",
  "category": "overall",
  "periodKey": "2026-W15",
  "entries": [
    {
      "rank": 1,
      "player": {
        "displayName": "Player One",
        "title": null
      },
      "score": 88.2,
      "entryId": "ldb_xxx",
      "submissionId": "sub_xxx",
      "verifiedAt": "2026-04-08T10:00:05.000Z"
    }
  ]
}
```

### GET `/api/v1/leaderboards/around-me?scope=weekly&category=overall|quality`

Requires auth.

Response:

```json
{
  "scope": "weekly",
  "category": "overall",
  "periodKey": "2026-W15",
  "centerRank": 12,
  "entries": []
}
```

If the user is not currently placed, `centerRank` is `null` and `entries` is an empty array.

### GET `/api/v1/leaderboards/me?scope=weekly&category=overall|quality`

Requires auth.

Response:

```json
{
  "scope": "weekly",
  "category": "quality",
  "periodKey": "2026-W15",
  "inLeaderboard": true,
  "currentRank": 4,
  "score": 91.3,
  "bestVerifiedSubmissionRef": "sub_xxx",
  "leaderboardEligible": true
}
```

If the user has no verified placement for the active weekly key, `inLeaderboard` is `false` and rank/score/submission ref are `null`.

### Not Yet Implemented

- seasons beyond the weekly key
- hall of fame
- social/friends features

## Rewards V1

Rewards V1 is verified-only and weekly-only.
Only verified weekly leaderboard placements can generate claimable grants.
Provisional, rejected, under-review, and local-only runs never create rewards.

### Reward Tiers

- `participation`
- `top_50`
- `top_25`
- `top_10`
- `top_1`

### Reward Types

- badges
- titles
- cosmetics
- small premium currency
- seed packs

### Grant Generation

- reward grants are derived from the current verified weekly leaderboard placement
- one active grant per `user + weekly period + category`
- unclaimed grants refresh to the current weekly placement tier
- claimed grants remain claimed and are not double-awarded
- claim is idempotent

### GET `/api/v1/rewards`

Requires auth.

Response:

```json
{
  "scope": "weekly",
  "periodKey": "2026-W15",
  "grants": [
    {
      "grantId": "grt_xxx",
      "scope": "weekly",
      "periodKey": "2026-W15",
      "category": "overall",
      "tier": "top_25",
      "placementRank": 18,
      "score": 88.4,
      "status": "claimable",
      "leaderboardEligible": true,
      "sourceSubmissionId": "sub_xxx",
      "claimedAt": null,
      "reward": {
        "rewardKey": "weekly_top_25",
        "label": "Weekly Top 25",
        "description": "Reward for finishing inside the top 25 of a verified weekly leaderboard.",
        "rewards": {
          "badges": ["weekly_top_25"],
          "titles": ["Top 25 Grower"],
          "cosmetics": ["accent_trim_silver"],
          "premiumCurrency": 20,
          "seedPacks": 3
        }
      }
    }
  ],
  "inventory": {
    "badges": [],
    "titles": [],
    "cosmetics": [],
    "premiumCurrency": 0,
    "seedPacks": 0
  }
}
```

### GET `/api/v1/rewards/summary`

Requires auth.

Response:

```json
{
  "scope": "weekly",
  "periodKey": "2026-W15",
  "claimableCount": 1,
  "claimedCount": 2,
  "hasClaimableRewards": true,
  "inventory": {
    "badges": ["weekly_participant"],
    "titles": [],
    "cosmetics": [],
    "premiumCurrency": 10,
    "seedPacks": 1
  }
}
```

### POST `/api/v1/rewards/:grantId/claim`

Requires auth.

Response:

```json
{
  "scope": "weekly",
  "periodKey": "2026-W15",
  "grant": {
    "grantId": "grt_xxx",
    "status": "claimed",
    "claimedAt": "2026-04-08T10:00:00.000Z"
  },
  "inventory": {
    "badges": ["weekly_top_10"],
    "titles": ["Top 10 Grower"],
    "cosmetics": ["accent_trim_gold"],
    "premiumCurrency": 35,
    "seedPacks": 4
  }
}
```

### Not Yet Implemented

- seasons beyond the weekly key
- friends/social reward layers
- hall of fame rewards
- shop or broad economy systems
- pay-to-win mechanics

## Admin (internal)

Admin endpoints require an authenticated user with `role=admin`.

### GET `/admin/login`

Internal login page for admin session cookie bootstrap.

### POST `/admin/session`

Body:

```json
{
  "token": "<jwt_from_/api/auth/login>"
}
```

### GET `/admin`

Internal admin dashboard page.

### GET `/admin/stats/overview`

Returns `totalUsers`, `newUsersToday`, `bannedUsers`, `adminUsers`, `testerUsers`, `activeUsers`.

### GET `/admin/users`

Query:
- `search`
- `role`
- `banned`
- `page`
- `limit`

### GET `/admin/users/:id`
### PATCH `/admin/users/:id/role`
### PATCH `/admin/users/:id/ban`
### PATCH `/admin/users/:id/badges`
### PATCH `/admin/users/:id/notes`
### GET `/admin/audit-logs?limit=50`

## Error Format

All errors return JSON. Example:

```json
{
  "error": "Validation failed",
  "code": "validation_failed",
  "requestId": "d9d5e...",
  "details": [
    {
      "field": "email",
      "message": "Valid email is required",
      "location": "body"
    }
  ]
}
```
