# Release Operations Architecture

**Requirement:** `V1-REL-OPS-021`  
**Status:** implementation checkpoint; independent RELEASE-OPS-1A-QA required  
**Deployment status:** not authorised

## Trust and environment boundary

The release path is `DEVELOPMENT → TEST → PREVIEW → STAGING → PRODUCTION`. Every environment has a distinct database, private-storage root, backup root, secrets, origin/cookie scope, provider mode, release channel and observability label. Staging defaults to fresh synthetic data, `noindex`, a visible STAGING banner, disabled live providers and no production cookie/domain reuse. Operational data may not be copied to staging without a separate anonymisation approval.

The application remains one writable Node process over persistent local-SSD SQLite. Horizontal/multi-region writers, network-mounted SQLite, ephemeral databases and multiple containers sharing one writable file are prohibited. Migration and raw restore require an exclusive release lock, application drain, maintenance mode, completed backup and post-start health.

## Release manifest and package

`lib/release-manifest.ts` produces the authoritative machine-readable contract. It records release/application/channel identity, commit/tag, build ID/time, Node and package-manager versions, lockfile/schema hashes, ordered migration hashes, schema fingerprint, backup format, public assets, PWA build, private-asset schema, compatibility/minimum-client versions, flag snapshot, environment, payload hash and previous known good release. Missing metadata fails closed; no value is invented from the backup version.

`lib/release-package.ts` packages one explicitly selected runtime: `standalone` for a symlink-capable Linux release runner, or `framework` for a Windows/local portability rehearsal using allowlisted compiled `.next/server`, static and manifest files. Staging deployment uses `standalone`; `framework` requires an exact lockfile production install and is not silently substituted. Both modes include versioned public assets, active Prisma schema/migrations, provider-neutral staging templates and package/lock metadata. The canonical payload inventory is deterministically hashed; the ZIP receives a separate SHA-256. Symlinks, traversal, secret-like content, `.env*`, databases/sidecars, backups, private uploads/assets, reports, payslips, logs, QA residue, coverage, IDE/Git files and development caches are refused.

Size meanings:

- repository size: source plus history and development material; never a client download;
- build-cache size: local compiler cache; excluded;
- deployment-artifact size: the explicitly declared standalone or framework server runtime and allowlisted runtime material;
- Web/PWA download size: requested public static assets only, never the database or repository;
- future native binary: not produced; governed by the compatibility contract.

## Candidate, lock and audit

The local/private state root defaults to ignored `.release-ops/` and may be placed at an absolute environment-specific location. `candidate.json` is atomically replaceable restart state. `release.lock.json` is created exclusively and names bounded owner/session/environment/release/expiry values without secrets. A second operator is refused; stale recovery requires an explicit reason. `audit.jsonl` is append-only and hash-chained.

The CLI exposes `inspect`, `prepare`, `package`, `verify-artifact`, `rehearse`, `enter-maintenance`, `backup`, `migrate`, `switch-release`, `health-check`, `smoke-test`, `complete`, `rollback`, and `inspect-cleanup`. Each invocation requires environment/current/target identity and the same lock owner/session. Production mutation phases require a separate runtime authorization plus approval reference; this repository phase sets neither. There is no one-command public deployment.

## Gates and migration policy

All required gates begin `PENDING` and accept bounded privacy-safe evidence. A destructive/incompatible migration blocks ordinary release. Staging/production uses `prisma migrate deploy`, never `db push`; deploy is rehearsed on fresh and byte-identical copied databases and executed twice to prove no-op. Backfills are separate/idempotent. Rollback never runs an automatic down migration. An old-schema rollback uses the verified pre-migration database plus matching asset checkpoint.

For additive changes use expand → compatible code → verify → later contract. Code-only release is `NONE`; data backfill and code-dependent additions are declared explicitly.

## Private assets and recovery

Code rollback never deletes newer assets. Database restore uses the matching encrypted private-asset backup and reconciles metadata, ownership, replacement links, asset hashes, orphan state and failed temporary files. A release package contains no private asset bytes. Production readiness requires a logical backup, byte-identical raw rollback copy, encrypted asset backup, hashes/sizes, restore rehearsal, SQLite integrity/foreign-key checks, business/account reconciliation, asset reconciliation and named rollback owner. Backup without restore evidence is not a passed gate.
