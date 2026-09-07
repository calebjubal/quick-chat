# Deploying the Quickchat server on Vercel

## Current production diagnosis

On September 7, 2026, the linked `server` project's latest deployment failed with **No entrypoint found**. Its build ran from the repository root rather than `server`. The production environment-variable listing was empty. A successful local build does not prove that production login or email delivery works.

The repository now supplies `server/api/index.js` and `server/vercel.json`. The function exports the compiled HTTP server, including `/api/v1/*`, health endpoints, and `/ws`. Vercel owns its listener; Docker and local development still listen normally.

## 1. Fix project settings

Open Vercel → **server** project → **Settings → Build and Deployment**:

- Root Directory: `server` (not the repository root).
- Enable inclusion of source files outside the Root Directory: the workspace lockfile and shared contracts live there.
- Framework Preset: **Other**. Remove stale Hono/Vite/output-directory overrides.
- Node.js: **22.x**.
- Install and Build commands: use the checked-in `server/vercel.json` values.
- Do not set the output directory to `client/dist` or treat this API as a static site.
- Use Fluid compute for the WebSocket endpoint. Connections must reconnect when the function duration expires.

Vercel currently documents native WebSockets as **beta**. Quickchat uses its supported Node HTTP-server export shape, but real upgrade/reconnect behavior must be tested on the deployed project before release. The existing long-running Docker API remains an alternative. See [Vercel WebSockets](https://vercel.com/docs/functions/websockets).

## 2. Add server environment variables

Open **server → Settings → Environment Variables → Add**. Enter each name and value separately, select **Production**, and save. Store credentials as Secret/sensitive values. Use separate values/resources for Preview; do not share production customer data with previews. Leave optional unset values absent rather than saving empty strings.

These are **server project variables**, without a `VITE_` prefix:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_URL` | Canonical frontend HTTPS origin, e.g. `https://chat.example.com`; no trailing slash |
| `ALLOWED_ORIGINS` | That exact frontend origin; comma-separated explicit origins if necessary; no wildcard or paths |
| `DATABASE_URL` | Neon **pooled** connection URL, retaining SSL parameters |
| `REDIS_URL` | Hosted Redis TCP/TLS URL (`rediss://...`), not an HTTP REST endpoint; must support Streams and pub/sub |
| `COOKIE_SAME_SITE` | `Lax` for `chat.example.com` + `api.example.com`; see cookie warning below |
| `RATE_LIMIT_SALT` | Unique random secret, at least 32 characters |
| `SMTP_HOST` | Your transactional email provider's SMTP host |
| `SMTP_PORT` | `587` with STARTTLS, or `465` with implicit TLS |
| `SMTP_USER` | Provider SMTP username |
| `SMTP_PASS` | Provider SMTP password/API credential |
| `SMTP_FROM` | Verified sender, e.g. `Quickchat <no-reply@example.com>` |
| `S3_REGION` | Bucket's actual region |
| `S3_BUCKET` | Private media bucket name |
| `S3_ENDPOINT` | HTTPS endpoint for non-AWS S3-compatible storage; omit for AWS |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Restricted bucket credentials |
| `CLAMAV_HOST` / `CLAMAV_PORT` | Scanner hostname reachable by the worker, usually port `3310`; never publicly expose an unauthenticated scanner |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Matching web-push keys; keep the private key secret |
| `VAPID_SUBJECT` | Real operations contact, e.g. `mailto:ops@example.com` |

The current production startup validator requires SMTP, VAPID, a non-local scanner hostname, a unique salt, and non-local origins. PostgreSQL/Redis must also be reachable; media needs storage and the scanner worker. Do not put fake values in just to bypass validation. `.env.example` at the repository root documents optional limits and telemetry settings.

For migrations, set `DATABASE_URL_UNPOOLED` to Neon's **direct** connection URL in the trusted release environment. Run `pnpm --filter ./server build`, then `pnpm --filter ./server release:migrate` once as a controlled release step. Do not run migrations in every function invocation or preview build.

**Cookie warning:** two unrelated `*.vercel.app` projects are cross-site. They require `COOKIE_SAME_SITE=None`, but browsers can still block third-party cookies. For reliable production auth across supported browsers, use your own same-site frontend/API subdomains. Never disable Secure or HTTP-only cookies. Every mutating REST request requires an allowed `Origin` header, including CLI probes.

Local `server/.env` is ignored by Git and is **not uploaded to Vercel**. Never paste credentials into source files, `vercel.json`, chat messages, or frontend variables. Rotate the Neon password previously shared in chat, then update the private local and hosted values.

Changes apply to **new deployments**. Once the code has been made available through your chosen authorized release process, deploy that revision with the new variables; redeploying an old revision will not include these code fixes. Nothing in this task automatically pushes or deploys. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

## 3. Configure the separate frontend project

Keep Root Directory `client`. Add these public build variables there and rebuild the frontend:

```dotenv
VITE_API_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com/ws
VITE_VAPID_PUBLIC_KEY=<the-public-key-only>
```

Use the real canonical API domain, not an expiring preview URL. Never place database, SMTP, S3, session, or private VAPID credentials in this project. Configure TURN separately before claiming calls work across arbitrary networks.

## 4. Keep a worker running

The API function does not run `worker.ts`. Run the existing container worker (`node server/dist/worker.js`) on a separately managed long-running service with the same database, Redis, storage, push and scanner configuration. It publishes durable outbox events, scans media, expires messages, cleans up uploads, and processes deletion tasks. Function timers are not a reliable substitute for this worker.

## 5. Production auth acceptance checklist

Use a real inbox you control, not seeded or hard-coded production demo accounts:

1. `/health/live` returns 200 and `/health/ready` returns 200 with PostgreSQL and Redis ready.
2. Register; receive email from the verified sender; verify the link; confirm an unverified account cannot log in.
3. Log in, reload, and open another tab: the session persists. Inspect the API cookie for `__Host-quickchat_session`, Secure, HTTP-only, Path=/, and the intended SameSite value.
4. Resend verification for an expired link. Reset a password; confirm the old password and old sessions fail and a consumed reset link cannot be reused.
5. Log out; reload confirms signed-out state. Confirm remote session revocation and deletion revoke access.
6. Reject mutation requests with missing, `null`, or foreign Origin. Verify CORS permits only configured frontend origins.
7. Test guest → account upgrade using a real inbox; existing chats remain attached after verification and login.
8. Test Chrome, Firefox, and Safari, including mobile/private browsing. Check network requests for blocked third-party cookies and credentialed CORS failures.
9. Confirm `/ws` upgrades and reconnects after function rotation; messages survive refresh, a second replica, and worker restart.

Automated unit/component tests are not a substitute for this checklist. Production verification remains pending until the hosted variables, email provider and successful deployment exist.
