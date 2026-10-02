# Deployment

Lumen deploys as one image (API, worker, and migration share it) plus a
PostgreSQL database. The compose file is the reference topology; production is
the same three processes on a managed database.

## Local / single host

```bash
cp .env.example .env      # set POSTGRES_PASSWORD and JWT_SECRET
docker compose up --build
```

Startup order is enforced by compose:

1. `db` becomes healthy (`pg_isready`).
2. `migrate` runs `node dist/db/migrate.js` once and exits.
3. `api` and `worker` start only after the migration succeeds.

Verify:

```bash
curl http://localhost:4000/health     # {"status":"ok"}
```

Point the app at it with `apps/mobile/.env`:
`EXPO_PUBLIC_API_URL=http://<host>:4000`. For the Android emulator, `localhost`
is the emulator itself — use `http://10.0.2.2:4000`. For a physical device use
your machine's LAN IP.

Stop and remove volumes with `docker compose down -v`.

## Production

Use `docker compose up` behind a TLS-terminating load balancer / reverse proxy,
or the equivalent managed container service. The image is the same; only config
changes.

Build and push:

```bash
docker build -f apps/api/Dockerfile -t registry.example.com/lumen-api:0.1.0 .
docker push registry.example.com/lumen-api:0.1.0
```

Then run three deployments from that image:

| Process | Command | Replicas |
|---|---|---|
| API | `node dist/index.js` | 1+ (stateless) |
| Migration | `node dist/db/migrate.js` | once per release, before API |
| Worker | `node dist/worker.js` | **exactly 1** |

### Required environment

- `DATABASE_URL` — point at a managed Postgres. Prefer a private network and a
  least-privilege role; migrations (DDL) may need a separate role.
- `JWT_SECRET` — 32+ random characters, from a secret manager. Rotating it
  invalidates existing access tokens (users re-authenticate; refresh tokens are
  unaffected).
- `CORS_ORIGINS` — comma-separated allow-list. **Never `*` in production.**
- `NODE_ENV=production`.

### Notes and guardrails

- **Do not expose Postgres** (`5432`) publicly. Drop the `ports` mapping on the
  `db` service in production; keep it private to the compose network.
- **Run exactly one worker.** The scheduled jobs (feature reconciliation,
  recommendation expiry, account deletion) are not yet safe to run concurrently.
- **Terminate TLS at the edge.** The API speaks plain HTTP and relies on the
  proxy/LB for HTTPS. The mobile app must use an `https://` `EXPO_PUBLIC_API_URL`.
- **Deletion is destructive and asynchronous.** A `DELETE /v1/account` marks the
  account and the worker erases health records and anonymizes the row. Verify
  backups reconcile with completed deletions and cannot resurrect erased data.
- **Migrations are a release step**, not boot logic. Always run the `migrate`
  job before the new API starts.
- The health check is process-only (`/health`). Add a DB-ping readiness check
  before relying on it for zero-downtime rollouts.

### Pre-launch checklist

Before exposing this to real users, also address the items in the README's
"must-close" list: rate limiting on auth, security headers, retention jobs for
`idempotency_keys`/`audit_events`/expired sessions, secret rotation, PII-free
error reporting, and tested database backups. Legal review (HIPAA status, FDA
device-function guidance, state health-privacy laws, privacy policy) is required
before any clinical or provider integration — see `docs/design-spec.md` §11.
