# Deployment

The main branch now uses **one Vercel project + Neon + SMTP**. See [the current deployment and environment guide](vercel-server.md).

The former API/worker Docker topology, Redis, S3, scanner, TURN and push infrastructure are preserved on `codex/dev` at `2af309e`, not required by this release.

Keep Neon backups/PITR enabled and test restores. Migrations must remain backward compatible because both branches share the historical schema. Never run development tests or load generators against customer data. Roll back application revisions rather than automatically reversing migrations.
