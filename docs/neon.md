# Neon connection setup

The application uses managed PostgreSQL in Neon. Create the project in your own Neon account, choose the nearest available region to the API, and keep production and staging in separate branches/projects. Do not use a temporary claimable database for production.

In the project's Connect dialog copy both connection strings. Put the pooled URL in `DATABASE_URL` and the direct URL in `DATABASE_URL_UNPOOLED`. Preserve the supplied TLS parameters. For development against a hosted development branch, store them in `server/.env` (ignored by Git). On the API and worker host, use its secret manager. Never put database credentials in a `VITE_` variable or Vercel's static frontend bundle.

After installing dependencies, run `pnpm --filter ./server build`, then `pnpm --filter ./server release:migrate`. The migration command loads `server/.env` when run through the workspace filter. It uses the direct URL; ordinary application connections use the pooler. Only run migrations against a database you intend to initialize or update.

Neon supplies the database, not the full chat backend. Live cross-instance delivery still needs Redis, attachments/voice need S3-compatible storage and the scanning worker, email verification needs SMTP, and reliable video calls need TURN. Configure these using the root `.env.example` and `docs/deployment.md` before production rollout. Enable the required restore window and test recovery in the chosen Neon plan.

Source: https://neon.com/docs/connect/connection-pooling
