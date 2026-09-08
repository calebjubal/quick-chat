# Neon database

Use Neon's pooled connection URL as `DATABASE_URL` for runtime requests and its direct URL as `DATABASE_URL_UNPOOLED` for migrations. Keep the supplied SSL parameters. Both values belong only in private server/release configuration.

See [single-project setup](vercel-server.md) for deployment, migration and verification steps. No local PostgreSQL server is required. Runtime rate limits now use PostgreSQL instead of Redis. Existing chat data is preserved.

Choose nearby Vercel/database regions for latency, enable backups/PITR and use a separate Neon branch/database for previews. Rotate credentials previously exposed in chat.
