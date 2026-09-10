# Quickchat — simple Vercel edition

`main` serves the React frontend and Hono API from **one Vercel project**, with Neon PostgreSQL and SMTP email delivery. No Redis, object storage, scanner, push service, WebSocket server, or background worker is required.

## Branches

- `main`: shared chat links, guest names, persistent text messaging, verified email accounts, account upgrade, profiles, sessions and themes. Visible conversations refresh every three seconds; hidden tabs pause polling.
- `codex/dev`: complete pre-simplification feature implementation at `2af309e`, including media, voice notes, video calls, push, presence, durable realtime transport, workers and infrastructure. These features and their tests are recoverable there. Neither branch is pushed by this task.

No database tables or existing customer data are removed. This version cannot upload or play media. Existing media records remain available to the development version. Automatic expiry, export jobs and scheduled deletion are not offered without their worker.

## Run and deploy

See [single-project Vercel setup](docs/vercel-server.md) for the small environment list and migration commands.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
```

Local API defaults to port 3001; Vite proxies `/api` there. Production always uses the same origin even if old `VITE_API_URL` settings remain in the dashboard. Use the repository root as Vercel Root Directory, Other as the framework, and Node 22.

Guest accounts can create five shared chats, join unlimited received chats, and send 50 text messages per rolling day. Registered accounts can send 1,000. Login requires a verified email; SMTP must be configured. This release does not promise offline sending: failed sends keep the draft for retry.

Graphite and electric-mint dark mode, a light theme, real empty states, and a self-hosted font keep the interface focused. No demo users or messages are bundled.
