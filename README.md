# Lumen

Lumen is a personal, privacy-conscious health-tracking app built around one
person's longitudinal patterns. It records cycle events, daily check-ins,
activity, symptoms, and sleep, then turns them into clear, modest, non-diagnostic
suggestions.

This repository is a working monorepo: an Expo app with offline-first local
storage, a Fastify + PostgreSQL backend, authentication, purpose-based consent,
and machine-readable privacy export/deletion. On top of that sits a deterministic
personalization layer, plus an optional local-model layer that can add a few
wellbeing suggestions. The model layer runs on a private, self-hosted Ollama
instance and is **disabled by default** and fails closed — see
[docs/ai-closed-loop.md](docs/ai-closed-loop.md). The [design spec](docs/design-spec.md)
describes the product thinking behind it.

## Monorepo layout

```
apps/
  api/       Fastify + TypeScript API, PostgreSQL (Drizzle), background worker
  mobile/    Expo + React Native app (offline-first)
packages/
  shared/    Zod contracts, types, and deterministic cycle math shared by both
docs/
  design-spec.md
  deployment.md
  ai-closed-loop.md
```

npm workspaces tie them together. `@lumen/shared` is consumed as TypeScript
source by both Metro and the API (bundled at build time with tsup).

## Prerequisites

- Node.js >= 20
- PostgreSQL 14+
- Expo Go on a device, or an iOS/Android emulator

## Setup

```bash
npm install

# Configure and migrate the database
cp apps/api/.env.example apps/api/.env      # then edit DATABASE_URL + JWT_SECRET
createdb lumen
npm run db:migrate

# Point the app at the API
cp apps/mobile/.env.example apps/mobile/.env
```

Generate a strong secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Run

```bash
npm run dev:api       # Fastify API on :4000
npm run dev:mobile    # Expo dev server
npm run worker        # feature reconciliation + deletion jobs
```

The app can be used **without an account**: check-ins are written to local
SQLite first and only synced when signed in and online. Sync replays an ordered
queue with per-mutation `Idempotency-Key`s, so retries are safe.

## Verify

```bash
npm run typecheck     # all workspaces
npm test              # API unit tests (cycle math, features, safety, time)
npm run build         # production bundle of the API
```

## Ship to a phone

For a shareable Android APK, the Cloudflare Tunnel to reach your API, and turning
on the consent-gated AI suggestions, see
[docs/mobile-release.md](docs/mobile-release.md).

## Deploy

A multi-stage API image (`apps/api/Dockerfile`) and a `docker-compose.yml` with
Postgres, a one-shot migration job, the API, and a single worker:

```bash
cp .env.example .env      # set POSTGRES_PASSWORD and JWT_SECRET
docker compose up --build
curl http://localhost:4000/health
```

See [docs/deployment.md](docs/deployment.md) for the production topology, secrets,
worker scaling, and the pre-launch checklist.

## API surface

| Method | Endpoint | Responsibility |
|---|---|---|
| `POST` | `/v1/auth/register` | Create account (email + password) |
| `POST` | `/v1/auth/login` | Start a session (access + refresh token) |
| `POST` | `/v1/auth/refresh` | Rotate a refresh token |
| `POST` | `/v1/auth/logout` | Revoke a session |
| `GET` | `/v1/auth/me` | Current user |
| `GET`/`PUT` | `/v1/consents[/:purpose]` | Purpose-based consent |
| `GET`/`PUT` | `/v1/profile` | Preferences, goals, timezone |
| `GET`/`PUT` | `/v1/health-preferences` | Goals and constraints |
| `POST`/`GET` | `/v1/check-ins` | Idempotent daily check-in (upsert per day) |
| `POST`/`GET` | `/v1/cycle-events` | Cycle events and corrections |
| `POST`/`GET` | `/v1/activities` | Activity entries |
| `POST`/`GET` | `/v1/symptoms` | Reported symptoms |
| `POST`/`GET` | `/v1/sleep` | Sleep entries |
| `GET` | `/v1/dashboard/today` | Cycle context, trends, evidence |
| `GET` | `/v1/recommendations` | Active suggestions |
| `POST` | `/v1/recommendations/generate` | Consent-gated local generation (disabled by default) |
| `POST` | `/v1/recommendations/:id/feedback` | Helpfulness / action taken |
| `GET` | `/v1/ai/status` | Inference boundary status (no health data) |
| `GET` | `/v1/privacy/export` | Machine-readable export |
| `DELETE` | `/v1/account` | Start verified deletion |

Every health-log write accepts an `Idempotency-Key` header. `userId` always comes
from the authenticated session — never from the request body.

## Design commitments carried into code

- **User owns their data** — export and a verified deletion workflow ship now;
  deletion erases health records and anonymizes the account.
- **AI is bounded** — generation is off by default and fails closed. It is
  consent-gated, restricted to an allow-list of pinned local models, fed only
  minimized derived features, and every suggestion passes a deterministic safety
  gate before it is stored. The mobile app never reaches the model host.
- **Offline first** — the device writes to SQLite and queues mutations; the
  backend is the source of truth after sync.
- **Deterministic features before AI** — `daily_features` is versioned and
  rebuildable; the dashboard states the window behind every claim and never
  invents a cause.
- **Privacy by construction** — cycle math is timezone-aware and never relies on
  server time; operational logs and audit metadata avoid raw notes.

## Not shipped yet

- Clinical claims, diagnosis, medication, fertility, or emergency advice.
- Model promotion tooling: the allow-list gate is enforced in code, but there is
  no evaluation suite yet for promoting new models — see
  [docs/ai-closed-loop.md](docs/ai-closed-loop.md).
- Fine-tuning on health data, RAG, or vector stores.
- Wearable imports, notifications, and third-party sharing.
