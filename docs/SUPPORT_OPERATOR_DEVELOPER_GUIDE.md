# Support operator and developer guide

Operational commands are sequential: `pnpm.cmd prisma:migrate:status`, `pnpm.cmd support:sla-check`, `pnpm.cmd support:asset-backup`, `pnpm.cmd backup`, focused tests, and normal release gates. Never run QA against `prisma/dev.db`; use `pnpm.cmd qa:support1a` or the independent variant, which copies the DB, deploys twice, verifies the operational hash and cleans twice.

Before real operation, approve privacy/retention wording, named restricted groups, queue owners, targets and emergency channels. Keep live Email/SMS/WhatsApp, deployment and real-user onboarding disabled. Logs must contain no request body, identity, filename, storage key or raw network data.

Developer invariants: no state-changing GET, no submitted hard-delete route, plain text by default, append corrections, private/no-store APIs, server-side role/object checks, CAS versions, idempotent escalation/notifications, separate corrective modules and full logical/encrypted-asset recovery.
