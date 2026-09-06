# Production deployment

## Topology

Deploy the Vercel frontend and the API, worker, PostgreSQL, Redis, S3-compatible storage, SMTP relay, TURN service, and telemetry collectors in or nearest Mumbai (`ap-south-1`). Keep the API, PostgreSQL, Redis, object storage, and TURN traffic on private networking where the provider supports it. Terminate only HTTPS and WSS publicly.

Use a custom site such as `chat.example.com` and API such as `api.example.com`. This keeps secure cookie behavior predictable. Set `COOKIE_SAME_SITE=Lax` for same-site subdomains; use `None` only when the frontend and API truly live on different sites. Never weaken `Secure` or HTTP-only cookies.

## Frontend (Vercel)

1. Set the project Root Directory to `client` and enable access to files outside the root so Vercel can use the workspace lockfile.
2. Set `VITE_API_URL`, `VITE_WS_URL`, `VITE_VAPID_PUBLIC_KEY`, `VITE_STUN_URL`, `VITE_TURN_URL`, `VITE_TURN_USERNAME`, and `VITE_TURN_CREDENTIAL` for Production and Preview.
3. Use a `turns:` URL on port 443 in production. Issue short-lived TURN credentials from the infrastructure provider where possible.
4. Deploy only after the API readiness check and release migration succeed. Hashed assets are immutable; the service worker and manifest are always revalidated.

## API and worker

Build the root `Dockerfile` once and deploy the same digest twice:

- API command: `node server/dist/index.js`
- Worker command: `node server/dist/worker.js`
- Release migration: `node server/dist/migrate.js`

Run exactly one release migration before replacing API instances. The liveness endpoint is `/health/live`; route traffic only when `/health/ready` returns 200. Use a termination grace period of at least 15 seconds so WebSockets drain and telemetry flushes. Scale the worker separately from the API and begin with one worker replica.

The environment contract is documented in `.env.example`. Store all values in the deployment platform's secret manager. Rotate database, Redis, S3, SMTP, VAPID, TURN, and telemetry credentials independently. Never expose server environment values through Vite.

## Storage and database durability

- Enable PostgreSQL automated backups, continuous WAL archiving, and point-in-time recovery with at least 14 days of retention. Test a restore into an isolated project every quarter.
- Use Multi-AZ PostgreSQL and Redis where available. Redis is rebuildable, but persistence reduces reconnect churn.
- Enable S3 versioning, server-side encryption, blocked public access, and the lifecycle policy in `infra/s3-lifecycle.json`. Restrict CORS to the production frontend and only the methods needed for presigned upload/download.
- Alert on backup failures, replication lag, database saturation, Redis memory pressure, worker backlog, HTTP 5xx rate, WebSocket disconnect rate, and p95 message acknowledgement latency.

## Rollout and rollback

1. Build, test, audit, and scan the immutable image in CI.
2. Restore a recent production backup into staging, run migrations, then run the staging smoke and Playwright journeys.
3. Run the production migration as a release job. Database changes must be backward-compatible with both the previous and next API image.
4. Roll the API gradually, verify readiness/error/latency signals, then roll the worker and frontend.
5. If application health degrades, route back to the previous image digest and previous Vercel deployment. Do not reverse a migration during an incident; use a forward repair migration. Pause workers if they are the source of damage.

Record the image digest, Vercel deployment, migration version, operator, and restore point for every release. No deployment step in this repository pushes code or creates cloud resources automatically.
