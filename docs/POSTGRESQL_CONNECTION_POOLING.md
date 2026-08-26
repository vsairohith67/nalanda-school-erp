# PostgreSQL connection pooling

`DATABASE_URL` is the runtime URL and may point to a managed transaction-mode pool. `DIRECT_URL` is the direct PostgreSQL endpoint for Prisma migration/status operations and administrative checks that need session continuity.

Staging/production requirements:

- both values come from the secret store and explicitly set `sslmode=require&sslaccept=strict`; `verify-ca` and `verify-full` are also accepted only with `sslaccept=strict`;
- the runtime identity is least privilege and the direct identity is a different migrator username;
- set explicit positive `connection_limit`, `pool_timeout`, and `connect_timeout` values on the runtime URL, and a positive `connect_timeout` on the direct URL; the software rejects runtime limits above 50, pool timeouts above 60 seconds, and connect timeouts above 30 seconds;
- budget total connections across web instances, workers, migrations, restore checks, provider tooling, and an operator reserve;
- do not run migrations, session-level locks/settings, LISTEN/NOTIFY, or unsupported prepared-statement assumptions through a transaction pool;
- bound statement, lock, connect, and transaction timeouts at the provider/operator layer;
- fail readiness when the runtime pool is unusable, while reporting direct/admin health only to authorized operations views.

`lib/database-provider.ts` and `scripts/postgres/select-provider.mjs` enforce these staging/production URL requirements before application startup or migration execution. The committed staging example uses placeholders only. It does not contain a reachable host, password, disabled TLS, or active provider account.
