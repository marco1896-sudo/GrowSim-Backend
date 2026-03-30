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
