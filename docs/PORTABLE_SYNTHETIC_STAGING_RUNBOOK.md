# Portable synthetic staging runbook

Prerequisites: Docker/Compose, Node 24, pnpm 11, and a clean dedicated worktree. Run `pnpm.cmd install --frozen-lockfile`, set `NALANDA_SYNTHETIC_STAGING=true`, generate local secrets, then run `pnpm.cmd qa:portable-stack`.

The command builds the working-tree image; starts PostgreSQL, Valkey, MinIO, migrator, seed, two web replicas and loopback HTTPS; tests shared limits, private objects, job locking, encrypted backup/repeated restore, dependency outages and recovery; then removes containers, networks, volumes, TLS and QA files. Seed refuses a non-synthetic target and a non-empty unmarked database.

The URL is `https://portable-staging.localhost:8443` and local-only. Trust its disposable CA only for rehearsal. Do not expose the port or import operational records/assets.
