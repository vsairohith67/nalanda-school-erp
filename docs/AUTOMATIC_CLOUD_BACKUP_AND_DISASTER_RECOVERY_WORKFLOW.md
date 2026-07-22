# Automatic Encrypted Off-Device Backup and Disaster-Recovery Workflow

Review date: 2026-07-19  
Phase: Prompt 20C  
Backup format: 36  
Encrypted container format: 1 (`.npsbackup`)

## Safety position

A local JSON file or a successful upload is not, by itself, a verified backup. Nalanda marks a cloud-backup run `VERIFIED` only after it generates and validates the existing ERP JSON once, hashes the exact plaintext, gzip-compresses it, encrypts it with AES-256-GCM and a fresh nonce, uploads only the encrypted container, reads it back, verifies ciphertext SHA-256, authenticates/decrypts/decompresses it, verifies plaintext SHA-256, and parses the supported Nalanda schema.

Any failed stage leaves the run non-verified and blocks retention pruning. Provider ETags are not accepted as integrity proof.

## Existing backup integration

The entry point is `generateFullBackup()` in `lib/backup.ts`. Generation is in memory. The legacy `pnpm.cmd backup` command still serializes the same document to the local `backups` directory as JSON.

Automatic backup uses the same generator, serializer, version, and restore validation path. It does not construct a second logical snapshot for one run. Version 36 adds:

- `cloudBackupProfiles`
- `cloudBackupSchedules`
- `cloudBackupRetentionPolicies`
- `cloudBackupRuns`
- `cloudBackupArtifacts`
- `cloudBackupVerifications`
- `cloudBackupRestoreRehearsals`
- `cloudBackupEvents`

The executing run is excluded from its own payload. Only previously completed cloud-backup runs and linked metadata are eligible. Version-35 and older backups remain readable because the eight arrays are optional on input.

Password hashes, encryption keys, provider credentials/tokens, encrypted object bodies, decrypted payloads, absolute paths, and temporary files are excluded. Restore forces live use off, pauses restored QA profiles, disables restored schedules, and disables automatic pruning.

## Container and cryptography

The binary container starts with ASCII `NPSBACK1`, followed by a bounded header length, strict JSON header, and ciphertext. Unknown fields, malformed types/base64, oversized headers, invalid timestamps, unsupported algorithms/versions, wrong sizes, and truncation are rejected.

Selected primitives:

- compression: gzip, level 9;
- encryption: AES-256-GCM;
- key size: exactly 32 decoded bytes;
- nonce: 12 cryptographically random bytes per artifact;
- authentication tag: 16 bytes;
- plaintext integrity: SHA-256 of exact validated JSON bytes;
- ciphertext integrity: SHA-256 of encrypted compressed bytes;
- authenticated data: the canonical security-relevant header;
- container version: 1;
- key versions: `V1` through `V999`.

GCM authentication must pass before decompression or JSON parsing. Wrong keys, modified authenticated headers/tags/ciphertext, and truncation fail closed.

Official documentation reviewed on 2026-07-19:

- Node.js Crypto (`createCipheriv`, `createDecipheriv`, GCM authentication tags, `randomBytes`, hashing): https://nodejs.org/api/crypto.html
- Node.js Zlib (`gzip`, `gunzip`): https://nodejs.org/api/zlib.html

No custom cipher, password-protected ZIP, or provider-side encryption substitute is used.

## Environment-only key custody

Profiles store only an encryption-key version reference. Key material is loaded server-side from `CLOUD_BACKUP_ENCRYPTION_KEY_V1` and later separately named versions. Values must be canonical base64 decoding to exactly 32 bytes. The Browser never receives or accepts them. Prisma, backups, reports, CSV, logs, errors, and provider metadata never store them.

New runs use the active version. Historical artifacts retain their original version and require that historical environment key. A missing key returns `KEY_UNAVAILABLE`; the artifact must not be silently deleted.

Keep at least two controlled offline copies of every required historical key. Losing a key permanently loses access to its artifacts. Rotation changes new runs only; Prompt 20C does not bulk re-encrypt history.

## Providers

### MOCK

MOCK is deterministic, in-process, makes no network request, and supports success, transient/permanent upload failure, timeout, missing object, truncated readback, corrupted ciphertext, and delete failure. Its memory does not survive a Node restart; use LOCAL_FOLDER for persistent CLI rehearsals.

### LOCAL_FOLDER

LOCAL_FOLDER is configured only through `CLOUD_BACKUP_LOCAL_FOLDER` and must not be inside `public`. Object keys are opaque run/artifact identities with no school personal or finance data.

It accepts only encrypted `NPSBACK1` containers; enforces root containment; rejects traversal and symlinked roots/directories/files; uses exclusive temporary writes and atomic rename; reads back exact bytes; and deletes only exact stored identities. It never performs prefix-wide deletion.

This is off-device only when deployment points the environment path to an actually separate protected medium.

### OBJECT_STORAGE and GOOGLE_DRIVE

Both are disabled foundations. Their health checks say disabled and no upload/download/delete network method exists. UI cannot set endpoints, credentials, refresh tokens, buckets, or Drive identities.

Before implementation/activation, conduct an exact official SDK/API, server identity, least privilege, private ACL, endpoint, upload/readback/delete/retry, versioning/retention, limit, and redaction review. Drive additionally requires an approved Shared Drive/folder and service identity policy; there is no Browser OAuth flow.

No price, quota, durability, retention, or availability promise is hard-coded.

## Schedules and worker

Only `QA20C-` profile codes are created in this phase. Only MOCK or LOCAL_FOLDER can activate; only one automatic profile is active by default. LIVE remains false.

Schedules support hourly, daily, weekly, monthly, and manual-only frequencies using bounded fields and `Asia/Kolkata`; arbitrary cron is absent. A unique schedule/due idempotency key prevents duplicates. Missed-run recovery creates at most one catch-up and advances `nextRunAt`.

The database schedule does not invoke itself. Deployment must separately configure Windows Task Scheduler, a service scheduler, or a future protected hosting cron to run:

```powershell
pnpm.cmd cloud-backup:process-due
```

Creating a Prisma schedule does not mean automatic scheduling is active.

Commands:

```powershell
pnpm.cmd cloud-backup:health
pnpm.cmd cloud-backup:process-due
pnpm.cmd cloud-backup:run-now
pnpm.cmd cloud-backup:verify
pnpm.cmd cloud-backup:rehearse
pnpm.cmd cloud-backup:retention-preview
pnpm.cmd cloud-backup:prune
pnpm.cmd cloud-backup:inspect
pnpm.cmd cloud-backup:cleanup-temp
```

Runs use compare-and-set claims. Recalling a non-pending run returns existing state and cannot upload it again. Retry is limited to classified transient failures, bounded by profile retry/backoff, and receives its own idempotency identity. Pause blocks new runs.

The worker keeps plaintext and encrypted bytes in memory and creates no plaintext backup file. Stale cleanup removes only old, strictly named files from its dedicated non-public root and never follows symlinks.

## Verification, health, and RPO

Append-only verification rows record local-container, remote-head, readback, decryption, plaintext-hash, schema, and restore-compatibility stages without bodies or decrypted data.

Health distinguishes latest attempt/upload/verified run/passed rehearsal, verified age, due/overdue state, consecutive failures, provider mode, encrypted destination coverage, private-asset coverage, and LIVE-disabled state. A local JSON file alone cannot make health `HEALTHY`.

RPO is the maximum acceptable age of the newest verified backup. RTO is the target time to retrieve keys/artifacts and restore service. Prompt 20C reports evidence; it promises neither until an external scheduler/destination and monitoring ownership are configured.

## Private-asset coverage

The database payload excludes private OCR image bytes. Every artifact records this explicitly and UI reports:

> Database backup verified. Private uploaded assets are not included in this backup.

OCR metadata remains covered, but the implementation does not claim private file protection. A separate allowlisted encrypted archive needs a later narrow review and is not implemented.

## Isolated restore rehearsal

Only a `VERIFIED` artifact is eligible. It is read, hash-checked, decrypted/authenticated, plaintext-hash checked, and schema validated. The operational SQLite database is copied to a dedicated random rehearsal path. Both restore passes target only that copied database through an isolated Prisma client.

Aggregate digests after first and second passes must match, restore errors remain zero, and the operational file hash must be unchanged during the isolated operation. The copied database and SQLite sidecars are removed after success or failure.

There is no Browser destination chooser. The dialog states:

> This verifies recovery in a temporary database. It does not restore or change the operational ERP.

## Retention

Preview is read-only and shows exact artifacts, verification/rehearsal state, retained/eligible reasons, and post-prune verified count.

Pruning requires auto-prune enabled, latest run `VERIFIED`, minimum verified copies remaining, latest/rehearsal-source protection, provider readiness, and unchanged exact object identity. Failed/unverified newest runs block pruning. Missing objects are handled idempotently; no prefix/delete-all operation exists. Metadata and hashes remain `PRUNED`.

Policy changes never delete immediately. Keep at least two newest verified copies and two after pruning. Provider object lock/ransomware resistance requires later provider review and is not claimed.

## Permissions and reports

Cloud permissions are separate from dashboard/local backup/restore. Super Admin and Director receive all. Principal receives health, verification, isolated rehearsal, reports/export but no live activation or purge. Admin manages MOCK/LOCAL metadata, schedules, runs, verification, reports/export but no live activation, key change, or purge. Viewer/Auditor sees aggregate health/reports only and cannot export. Accountant, Teacher, and Parent receive none by default.

CSV uses allowlisted aggregate fields and formula protection. It contains no body, personal record, database/raw actor ID, full URL/path, provider payload, credential, key, or contact.

## Live activation prerequisites

Prompt 20C and QA prohibit real external upload. **Confirm Live Cloud Backup Activation** is reachable for permission/UI testing, but the API safely refuses. A future selected-provider phase needs provider-specific documentation/security review, implementation/tests, supervised environment credential injection, private destination validation, readback and isolated rehearsal, deletion/retention review, scheduler deployment, monitoring/incident ownership, and explicit approval. Prompt 20D was completed separately and does not enable a live cloud-backup provider.

## Prompt 21A future Student-location backup boundary

Prompt 21A changes no persistent data and backup remains version 37. A later Prompt 21B must not rely on broad Student-row serialization for new address/location fields. It must define explicit backup and restore projections, confirm encryption and access, keep provider disabled after restore, treat unverified provenance as unverified, reconcile address/location deletions against retained backup expiry, and prevent generic CSV/print exposure.

Any future coordinate is high-risk child personal data. Exact points are outside the approved 21B boundary; provider responses and temporary geocoding payloads must not enter JSON backup. A restore rehearsal must prove permissions do not broaden and stale points are invalidated when their source address/version no longer matches.
