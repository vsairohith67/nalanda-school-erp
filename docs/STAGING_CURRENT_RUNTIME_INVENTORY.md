# Staging Current Runtime Inventory

Status: `DEVOPS-1C planning and local readiness only`
Inventory date: 2026-07-23
Source revision: `a0f84455705bf9fbe8d57150f92db580501744ce` on the base of `devops/staging-readiness-plan`

No cloud deployment, DNS change, operational-database onboarding, provider activation, or paid resource is represented by this document.

## Verified checkpoint

| Evidence | Value |
| --- | --- |
| Page/API routes | 274 / 376 before DEVOPS-1C; the local readiness health route adds one API route |
| Active migration | `20260722_clean_install_baseline` |
| Canonical migrated schema fingerprint | `D828F96B0B3F35FC0DA4CD355FADA335CF7969C6DD4AFD7DAF146F2C438CEA44` |
| `prisma/schema.prisma` SHA-256 | `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00` |
| Operational DB SHA-256 | `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392` |
| Operational DB size / UTC mtime | 4,771,840 bytes / `2026-07-19T13:21:15.3528809Z` |
| Business baseline | 8 Students; 8 active enrollments; 19 Payments; INR 99,100 collected |
| Backup format | version 37 |
| Runtime tools | Node `v24.17.0`; pnpm `11.7.0` |

The operational database has no `_prisma_migrations` table. It is never a staging migration target in DEVOPS-1C.

## Runtime shape

- Next.js 15 App Router runs as a long-lived Node server. `next.config.ts` does not set static export or `output: "standalone"`; the supported local production command is `pnpm exec next start` after `pnpm build`.
- `pnpm build` runs `prisma generate` before `next build`. The generated Prisma client must match the checked-out schema and active migration.
- Prisma uses SQLite exclusively through `DATABASE_URL`. The application process opens the file directly; it is not a network database client.
- React/Next caches and image optimization use process memory and `.next` runtime/build artifacts. Authenticated dynamic pages are explicitly `private, no-store`.
- Session state is a signed, 12-hour, HttpOnly, SameSite=strict cookie. Every authenticated request revalidates the current User, active state, role, and password-derived credential tag in SQLite.
- Build/typecheck can exceed Node's default 2 GB heap in this checkout. The bounded 4 GB heap is a build-time ceiling only. Start staging with 2 GB RAM and measure steady-state/RSS before considering a smaller instance; 512 MB is not an approved assumption.

## Runtime dependency classification

| Dependency | Evidence/current location | Classification | Staging disposition |
| --- | --- | --- | --- |
| Next.js Node process | `package.json`, `app/**`, `middleware.ts` | STATELESS; REQUIRES_SECRET | One process bound to loopback behind one ingress. |
| Prisma client | generated during `pnpm build` | STATELESS; REQUIRES_DATABASE | Generate per release; never generate or migrate against the operational DB. |
| SQLite database | `DATABASE_URL`; current local default is `prisma/dev.db` | REQUIRES_PERSISTENT_DISK; REQUIRES_DATABASE; NOT_SAFE_FOR_STAGING_YET unless validator passes | Staging uses a fresh file below `STAGING_DATA_DIR`, never `prisma/dev.db`. |
| SQLite journal/WAL/SHM | adjacent to SQLite file when used by SQLite | REQUIRES_PERSISTENT_DISK; REQUIRES_DATABASE | Keep on the same local volume; never copy only one live sidecar. |
| OCR source images | `FEE_REGISTER_OCR_STORAGE_DIR`, fallback `data/fee-register-ocr` | REQUIRES_PERSISTENT_DISK; LOCAL_ONLY; PRIVATE | Private directory under staging data root; manual/deterministic OCR only. |
| JSON backups | `BACKUP_DIRECTORY`, fallback `backups/` | REQUIRES_PERSISTENT_DISK; LOCAL_ONLY; PRIVATE | Staging must override the fallback to a persistent private path. |
| Encrypted cloud-backup local provider | `CLOUD_BACKUP_LOCAL_FOLDER` | REQUIRES_PERSISTENT_DISK; REQUIRES_SECRET; LOCAL_ONLY | Permitted only as local encrypted staging storage; no external provider. |
| Cloud-backup temp | `CLOUD_BACKUP_TEMP_DIR`, fallback `data/cloud-backup-temp` | REQUIRES_PERSISTENT_DISK for crash cleanup; LOCAL_ONLY | Private data volume; cleanup is singleton. |
| Restore-rehearsal DB copies | `CLOUD_BACKUP_REHEARSAL_DIR`, fallback `data/cloud-backup-rehearsal` | REQUIRES_PERSISTENT_DISK; REQUIRES_DATABASE; LOCAL_ONLY | Isolated copies only; delete DB and sidecars after rehearsal. |
| Public assets/icons | `public/**` | STATELESS; PUBLIC | Baked into each release; hashed Next assets may be immutable-cached. |
| Private generated CSV/PDF responses | API/print routes; generated in memory | STATELESS; REQUIRES_DATABASE | `private, no-store`; do not persist response bodies or log contents. |
| Pilot copies/sample CSV | explicit CLI destinations | LOCAL_ONLY; REQUIRES_PERSISTENT_DISK when retained | Disabled in normal staging process; only approved synthetic paths. |
| Audit trails | Prisma audit/event tables | REQUIRES_DATABASE | Persist in staging SQLite; application logs are not a substitute. |
| Console/application logs | stdout/stderr only | STATELESS at app layer; NOT_SAFE_FOR_STAGING_YET without collector | Service manager captures; future central immutable sink required. |
| Login rate-limit buckets | in-memory global Map | STATELESS; single-process memory | Safe only with exactly one process; resets on restart and is not distributed. |
| Notification campaigns | SQLite, manually triggered routes | REQUIRES_DATABASE | In-app only; no external delivery expansion. |
| WhatsApp worker/adapters | DB profiles plus MOCK/Meta adapter | REQUIRES_DATABASE; REQUIRES_SECRET; REQUIRES_BACKGROUND_WORKER; REQUIRES_EXTERNAL_PROVIDER | MOCK only; live variables absent and live flag false. |
| SMS/Email worker/adapters | DB profiles plus MOCK/Gmail/unavailable SMS adapter | REQUIRES_DATABASE; REQUIRES_SECRET; REQUIRES_BACKGROUND_WORKER; REQUIRES_EXTERNAL_PROVIDER | MOCK only; all live flags false and Gmail credentials absent. |
| Cloud-backup worker | DB schedules, encryption key, provider adapter | REQUIRES_DATABASE; REQUIRES_SECRET; REQUIRES_BACKGROUND_WORKER | Manual/local encrypted runs only in DEVOPS-1C. |
| AI assistant | MOCK/local/cloud adapters and DB profiles | REQUIRES_DATABASE; REQUIRES_SECRET; REQUIRES_EXTERNAL_PROVIDER | deterministic MOCK only; local/cloud endpoints disabled. |
| OCR extraction | deterministic/manual provider and private files | REQUIRES_DATABASE; REQUIRES_PERSISTENT_DISK | Human review and fail-closed Payment posting remain mandatory. |
| PWA service worker | `/sw.js`, manifest, icons | STATELESS | Static/offline shell only; no private records, navigation HTML, or APIs cached. |
| Deployment health | `/api/deployment-health` | STATELESS; LOCAL READINESS | Anonymous non-mutating liveness, `private, no-store`; no database contents. |

## Filesystem writes

Runtime writes discovered by source inspection:

1. OCR images: create/read/delete beneath `FEE_REGISTER_OCR_STORAGE_DIR`; symlinks/junctions and public-directory placement are rejected.
2. JSON backup CLI: writes versioned files to `BACKUP_DIRECTORY` (the pre-existing local fallback remains `./backups`).
3. Encrypted local backup adapter: atomic temporary write and rename beneath `CLOUD_BACKUP_LOCAL_FOLDER`.
4. Cloud-backup temp cleanup and restore rehearsal: `CLOUD_BACKUP_TEMP_DIR` and `CLOUD_BACKUP_REHEARSAL_DIR`.
5. SQLite database plus journal/WAL/SHM beside the configured database file.
6. Explicit CLI-only pilot/sample, migration QA, and SEC-1 evidence outputs. These are not normal staging server writes and must remain disabled or pointed at ignored synthetic roots.

No private asset is intentionally written under `public/`. `.next`, source releases, and dependencies are replaceable release artifacts, not persistence locations.

## Security, proxy, cache, and PWA observations

- `middleware.ts` applies a nonce CSP, COOP, CORP, origin checks, body-size enforcement, authentication, and private cache controls.
- General request limit is 5 MiB; OCR page upload is 26 MiB; Server Actions are 4 MiB. The reverse proxy must set equal or lower limits and timeouts.
- HSTS is emitted only when `ENABLE_HSTS=true`. Staging also requires secure cookies and HTTPS-upgrade CSP.
- Forwarded origin/client-IP headers are trusted only when both `TRUST_PROXY_HEADERS=true` and `NALANDA_TRUSTED_PROXY_MODE=single-hop-sanitized`. The Node listener must be unreachable except through the proxy, which overwrites forwarded headers.
- Login brute-force protection is process-local: 10 failures in 5 minutes cause a 60-second source/account block when a trusted source address exists. Central ingress limits are still required.
- APIs and authenticated pages are `private, no-store`. Public website pages use revalidation; hashed Next static assets use framework immutable caching. The service worker rejects navigation HTML, API, login, private/no-store, cookie-bearing, JSON/PDF/CSV/binary responses.
- PWA uses a generated manifest and dynamic service worker. Physical device certification is blocked until a real HTTPS staging origin exists.

## Gaps before external staging

- Choose provider, budget, owners, access policy, backup destination, monitoring/log sink, and continuous versus scheduled uptime.
- Provisioning, DNS, certificates, secrets, and external uptime/logging are deliberately not performed here.
- Validate real steady-state RAM/CPU/disk and school concurrency using synthetic data.
- Central immutable redacted logging is a staging-entry requirement.
- Any copied operational-data rehearsal needs a separate written approval and maintenance window.
