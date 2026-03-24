# Grow Simulator Backend

Ein schlankes, produktionsnahes Backend für dein bestehendes Grow-Simulator-Frontend.

## Warum diese Architektur?

Ich habe **Node.js + Express + MongoDB + JWT** gewählt, weil das für deinen Fall am einfachsten wartbar ist:
- sehr klarer REST-Flow
- flexibel für deinen großen Game-State (JSON)
- mit Coolify gut deploybar (API als Container + MongoDB als separater Service)
- keine Supabase-spezifische Komplexität (RLS, Policies, Keys) nötig

## Was dieses Backend kann

- Auth:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
- Save-System (voller Simulator-State als JSON):
  - `GET /api/save`
  - `POST /api/save`
- Health:
  - `GET /api/health`
- CORS per ENV
- Docker-ready für Coolify/VPS

## Projektstruktur

```text
backend/
  src/
    config/
      db.js
      env.js
    controllers/
      authController.js
      saveController.js
    middleware/
      auth.js
      errorHandler.js
      validateRequest.js
    models/
      Save.js
      User.js
    routes/
      authRoutes.js
      healthRoutes.js
      saveRoutes.js
    utils/
      httpError.js
    app.js
    server.js
  .dockerignore
  .env.example
  Dockerfile
  docker-compose.local.yml
  API_OVERVIEW.md
  package.json
```

## Environment Variablen

Siehe `.env.example`:

- `NODE_ENV` - development/production
- `PORT` - API Port, z. B. `8080`
- `JWT_SECRET` - langer geheimer String (Pflicht)
- `JWT_EXPIRES_IN` - z. B. `7d`
- `CORS_ORIGINS` - komma-separierte Frontend URLs
- `MONGODB_URI` - Mongo-Verbindung

## Lokal starten (einfach)

1. In `backend/` wechseln
2. Abhängigkeiten installieren
3. `.env.example` nach `.env` kopieren und Werte setzen
4. Mongo starten (lokal oder per Docker)
5. API starten

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Health prüfen:

```bash
curl http://localhost:8080/api/health
```

## Optional: Mongo lokal via Docker

```bash
docker compose -f docker-compose.local.yml up -d
```

## Coolify Deployment (VPS)

### Service 1: Backend
- Quelle: dieses Repo
- Base Directory: `backend`
- Build: Dockerfile
- Port: `8080`
- ENV in Coolify setzen (`JWT_SECRET`, `MONGODB_URI`, `CORS_ORIGINS`, ...)

### Service 2: MongoDB
- Entweder Coolify Mongo Service erstellen
- Oder externe MongoDB nutzen
- `MONGODB_URI` ins Backend eintragen

## Frontend Integration (minimaler Refactor)

Dein Frontend nutzt aktuell LocalStorage (`grow-sim-state-v2`). Das bleibt erstmal bestehen.

Empfohlener Integrationsweg:
1. Beim Login Token speichern (`localStorage` oder später secure Storage).
2. Beim Start:
   - `GET /api/save`
   - wenn `hasSave=true`, den `state` in deinen bestehenden Restore-Flow geben.
3. Beim Speichern (manuell oder autosave):
   - gesamten bestehenden State als `state` zu `POST /api/save` senden.

Beispiel:

```js
await fetch(`${API_BASE}/api/save`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ slot: 'main', state: fullGrowSimState })
});
```

## Sicherheit / Hinweise

- Passwörter werden gehasht (`bcryptjs`)
- JWT schützt private Endpunkte
- Eingaben werden validiert (`express-validator`)
- Keine Secrets im Code hardcoden
- Für Produktion `JWT_SECRET` lang & zufällig setzen

## Verfügbare NPM Scripts

- `npm run dev` - Start mit Watch
- `npm start` - Produktionsstart
- `npm run check` - einfache Syntaxchecks

---
Wenn du willst, baue ich dir im nächsten Schritt direkt die **konkrete Frontend-Anbindung** in `app.js/storage.js` ein (Login, Cloud-Save, Fallback auf LocalStorage).