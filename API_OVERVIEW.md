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
