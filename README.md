# GrowSim Backend

Produktionsnahe, eigenstaendige API fuer GrowSim mit Node.js, Express, MongoDB und JWT.

Dieser Ordner ist bereits fuer die Auslagerung in ein separates Repo vorbereitet.

## Tech Stack
- Node.js 20+
- Express 4
- MongoDB + Mongoose
- JWT (jsonwebtoken)
- bcryptjs

## Features
- Healthcheck mit DB-Status: `GET /api/health`
- Auth:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
- Save-System:
  - `GET /api/save?slot=main`
  - `POST /api/save`
- Harvest-System:
  - `POST /api/v1/run-sessions`
  - `POST /api/v1/runs/submit`
  - `GET /api/v1/runs/:submissionId`
- Internes Admin-System:
  - `GET /admin` (Dashboard, nur Admin)
  - `GET /admin/users`, `PATCH /admin/users/:id/*`
  - `GET /admin/stats/overview`
  - `GET /admin/audit-logs`
- ENV-basierte Konfiguration
- CORS-Konfiguration ueber ENV
- Strukturierte Logs (JSON)
- Fehlerhandling mit `requestId`
- Graceful Shutdown (SIGINT/SIGTERM)

## Harvest Foundation

Das Harvest-Backend ist die authoritative Wahrheit fuer kompetitive Harvest-Ergebnisse.
Frontend-Forecasts bleiben lokale UX-Vorschau und werden serverseitig nur als Inputsignal plausibilisiert.

Aktuell implementiert:
- Run-Session-Erstellung mit Ownership-Bindung
- Run-Submission mit erster serverseitiger Verification
- Verification-Status: `submitted`, `provisional`, `verified`, `rejected`, `under_review`
- Authoritative Harvest-Scores fuer `harvestScore`, `yieldScore`, `qualityScore`, `stabilityScore`, `efficiencyScore`, `challengeScore`
- Konsistente Fehlercodes fuer Harvest-Requests

Bewusst noch nicht implementiert:
- Leaderboards
- Rewards
- Seasons
- Social/Friends-Features

## Standalone Repo Transfer

Wenn du aus dem Hauptprojekt in `GrowSim-Backend` auslagerst:

1. Inhalt von `backend/` in das neue Repo kopieren (oder verschieben).
2. `node_modules/` nicht uebernehmen.
3. Im neuen Repo `.env` aus `.env.example` erstellen.
4. `npm ci` und `npm run check` ausfuehren.

## Ordnerstruktur

```text
src/
  config/
  controllers/
  middleware/
  models/
  routes/
  utils/
  app.js
  server.js
.dockerignore
.env.example
.gitignore
API_OVERVIEW.md
docker-compose.local.yml
Dockerfile
package.json
package-lock.json
README.md
```

## Lokales Setup

```bash
cp .env.example .env
npm install
```

### MongoDB lokal starten (optional via Docker)

```bash
docker compose -f docker-compose.local.yml up -d
```

### API starten

```bash
npm run dev
```

### Produktionsnah starten

```bash
npm start
```

## ENV Variablen

Siehe `.env.example`.

Pflicht:
- `JWT_SECRET` (mindestens 32 Zeichen)
- `MONGODB_URI`

Wichtig:
- `CORS_ORIGINS` (Komma-separierte erlaubte Frontend-Origins)
- `NODE_ENV=production` fuer Deployment

Optional fuer den ersten Admin:
- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`
- `ADMIN_SEED_DISPLAY_NAME`

Admin seed ausfuehren:

```bash
npm run seed:admin
```

## Healthcheck

```bash
curl http://localhost:8080/api/health
```

## Docker / Coolify

- Build ueber `Dockerfile`
- Laufzeitport: `8080`
- Secrets ausschliesslich ueber ENV setzen
- MongoDB als separaten Service betreiben

## Sicherheitshinweise

- Keine Secrets im Code oder im Repo
- `JWT_SECRET` zufaellig und lang halten
- CORS in Produktion restriktiv setzen
- API nur ueber HTTPS-Subdomain veroeffentlichen
