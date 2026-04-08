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
- `leaderboardEligible` (`false` for this foundation round)
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

### Not Yet Implemented

- leaderboards
- rewards
- seasons
- hall of fame
- social/friends features

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
