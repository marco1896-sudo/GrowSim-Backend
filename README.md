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
- ENV-basierte Konfiguration
- CORS-Konfiguration ueber ENV
- Strukturierte Logs (JSON)
- Fehlerhandling mit `requestId`
- Graceful Shutdown (SIGINT/SIGTERM)

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
