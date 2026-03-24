# API Overview

Base URL (local): `http://localhost:8080`

## Health

### GET `/api/health`
Response:
```json
{ "ok": true, "service": "growsim-backend" }
```

## Auth

### POST `/api/auth/register`
Body:
```json
{
  "email": "you@example.com",
  "password": "secret123",
  "displayName": "Marco"
}
```
Response:
```json
{
  "token": "<jwt>",
  "user": { "id": "...", "email": "you@example.com", "displayName": "Marco" }
}
```

### POST `/api/auth/login`
Body:
```json
{ "email": "you@example.com", "password": "secret123" }
```
Response: same shape as register.

### GET `/api/auth/me`
Header:
`Authorization: Bearer <jwt>`

Response:
```json
{
  "user": {
    "id": "...",
    "email": "you@example.com",
    "displayName": "Marco",
    "createdAt": "2026-..."
  }
}
```

## Save System

> Save payload is intentionally flexible. `state` can be your full GrowSim state object.

### GET `/api/save?slot=main`
Header:
`Authorization: Bearer <jwt>`

Response (no save yet):
```json
{
  "slot": "main",
  "hasSave": false,
  "state": null,
  "updatedAt": null
}
```

Response (save exists):
```json
{
  "slot": "main",
  "hasSave": true,
  "state": { "simulation": {}, "plant": {}, "events": {} },
  "updatedAt": "2026-...",
  "createdAt": "2026-..."
}
```

### POST `/api/save`
Header:
`Authorization: Bearer <jwt>`

Body:
```json
{
  "slot": "main",
  "state": {
    "simulation": {},
    "plant": {},
    "events": {},
    "status": {},
    "ui": {}
  }
}
```

Response:
```json
{
  "message": "Save stored successfully",
  "slot": "main",
  "updatedAt": "2026-..."
}
```
