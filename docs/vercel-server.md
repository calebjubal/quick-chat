# One Vercel project + Neon

## Project settings

Use a single existing Vercel project for the whole repository:
- Root Directory: **repository root** (leave blank).
- Framework: **Other**.
- Node.js: **22.x**.
- Install: `pnpm install --frozen-lockfile`.
- Build: `pnpm build`.
- Output: `client/dist`.

The root `vercel.json` contains these commands, static security/cache headers, and rewrites. `/api/*` and `/health/*` route to `api/index.js` before the SPA fallback. The function imports the built HTTP handler, not a listening server. There are no frontend/server cross-site cookies or WebSocket requirements.

Previously configured server-root settings must be changed when releasing this branch. No cloud project setting, push, migration or deployment is performed automatically by the simplification.

## Environment variables

In this project's Settings → Environment Variables, select Production and enter actual values:

```dotenv
NODE_ENV=production
APP_URL=https://<your-single-vercel-domain>
ALLOWED_ORIGINS=https://<your-single-vercel-domain>
DATABASE_URL=<Neon-pooled-URL-with-SSL>
RATE_LIMIT_SALT=<unique-random-secret-at-least-32-characters>
SMTP_HOST=<your-email-provider-host>
SMTP_PORT=587
SMTP_USER=<SMTP-user>
SMTP_PASS=<SMTP-password>
SMTP_FROM=Quickchat <no-reply@your-verified-domain>
COOKIE_SAME_SITE=Lax
```

No `VITE_*`, Redis, S3, ClamAV, VAPID, TURN or worker variables are needed. SMTP port 465 is also supported. The email provider's sender/domain must be verified. Registration, verification, guest upgrade and password resets use SMTP; there is no verification bypass. Guest access and existing verified-account login remain available without SMTP; email-dependent actions return 503 until configured.

For the current deployment, both `APP_URL` and `ALLOWED_ORIGINS` must be `https://server-one-peach-29.vercel.app` (not localhost). Set `NODE_ENV=production` for Secure, HTTP-only cookies. Environment changes apply to the next deployment, not the running one. Release the corrected code together with these variables.

Do not paste secrets into chat or commit env files. Rotate the previously shared Neon credential. Preview deployments should use separate databases/email configuration and their own explicitly allowed origin.

## Migration before first release

Save the pooled URL as `DATABASE_URL` and the direct URL as `DATABASE_URL_UNPOOLED` in private `server/.env` or a trusted release environment. From repository root:

```sh
pnpm --filter ./server build
pnpm --filter ./server release:migrate
```

The new `0002_request_limits` migration adds shared PostgreSQL request counters with an expiry index. It does not drop any existing table. Do not run migrations on every function request or build. Without this migration, API requests fail closed with 503. Expired rate-limit counters are cleaned in bounded batches during subsequent requests; no worker is needed.

## Release verification

Deploy only after environment configuration and migrations. Test:
1. `/health/live` and `/health/ready` return 200.
2. Guest enters a name, creates a link, and a second browser joins it.
3. Text appears in the second visible browser within a polling interval plus network latency.
4. Guest upgrades; SMTP verification and login preserve existing chats.
5. Reload retains login; logout and password reset revoke the expected sessions.
6. Foreign/missing Origin mutation requests fail; cookies remain Secure and HTTP-only.
7. Auth, API and health paths never return the SPA HTML or cached private content.

The full-feature branch is `codex/dev`. Switch to it explicitly to work on media, voice, calls, push and worker infrastructure, then reinstall dependencies. Do not merge its deployment configuration wholesale into this simplified branch.

Reference: [Vercel project configuration](https://vercel.com/docs/project-configuration).
