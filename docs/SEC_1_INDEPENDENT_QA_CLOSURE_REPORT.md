# SEC-1 Independent Adversarial QA Closure Report

Date: 2026-07-20  
Scope: SEC-1-QA independent local verification after SEC-1A and SEC-1B  
Decision: `SEC_1_FULLY_CLEARED`

Testing was authorized only against the local project and a byte-for-byte copied
SQLite database. No real-system penetration test, real credential test,
destructive load test, external provider call, DNS change, deployment change, or
Prompt 21B/21C/21D work occurred. All adversarial records used the
`QASEC1QA` prefix and local MOCK/disabled providers.

The baseline references were
[OWASP Top 10:2025](https://owasp.org/Top10/),
[OWASP ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/),
the [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/),
[Next.js authentication](https://nextjs.org/docs/app/guides/authentication),
[Next.js CSP](https://nextjs.org/docs/app/guides/content-security-policy),
[Next.js headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers),
[Next.js PWA security](https://nextjs.org/docs/app/guides/progressive-web-apps),
[Prisma raw-query guidance](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries),
and [Node.js cryptography](https://nodejs.org/api/crypto.html).

## Release result

The independent pass found 0 Critical, 1 High, and 3 Medium confirmed defects.
All four were fixed at their root cause and regression tested. No confirmed
Critical, High, or Medium defect remains in the authorized local boundary.

| Severity | Confirmed | Fixed | Open |
| --- | ---: | ---: | ---: |
| Critical | 0 | 0 | 0 |
| High | 1 | 1 | 0 |
| Medium | 3 | 3 | 0 |

Across SEC-1A, SEC-1B, and SEC-1-QA, the consolidated register is 0 Critical,
5 High fixed, and 23 Medium fixed. The two SEC-1B UI findings and three SEC-1-QA
Medium findings are included in that total.

## Files changed in SEC-1-QA

The closure-specific application changes are in `app/globals.css`,
`components/print-button.tsx`, the individual/batch ID-card print pages and API
handlers, the OCR private-image handler, Parent/Teacher notification and
communication-preference pages/APIs, and the exact staff-preference route-matrix
exception. `package.json` and `pnpm-lock.yaml` contain the exact SheetJS update.

The QA helpers are `scripts/sec1-runtime-fixtures.ts`,
`scripts/sec1-runtime-route-sweep.ts`,
`scripts/sec1-runtime-security-probes.ts`, and
`scripts/sec1-runtime-server.ps1`. New/updated regression coverage is in
`tests/sec1-supply-chain.test.ts`, `tests/sec1-state-changing-get.test.ts`,
`tests/sec1-portal-role-boundaries.test.ts`, and
`tests/app-shell-source.test.ts`.

Documentation changes include this report, both prior SEC-1 reports, the backlog
reconciliation, attack-surface/threat model, bug/debt register, developer and
operator guides, feature/gap map, prompt history, index, and
`SEC_1_QA_RUNTIME_ROUTE_API_MATRIX.csv`. The broader SEC-1A/SEC-1B hardening
files and findings remain itemized in their respective reports.

## Independent findings

| ID | Finding | Severity and references | Evidence and impact | Fix and regression evidence | Residual risk | Status |
| --- | --- | --- | --- | --- | --- | --- |
| SEC1QA-H01 | Reachable vulnerable spreadsheet parser | High; CWE-1321/CWE-1333; OWASP A03/A05; ASVS software-supply-chain and validation controls | Direct `xlsx@0.18.5` parsed authorized imports and was affected by prototype-pollution and ReDoS advisories. Existing size/row controls reduced impact but did not remove the vulnerable parser. | Replaced it with the official SheetJS `xlsx-0.20.3.tgz`, exact-pinned the URL and lockfile SHA-512 integrity, and added a supply-chain regression test. | Future package updates still require advisory review. | `FIXED` |
| SEC1QA-M01 | Read-only GET requests changed audit/OCR state | Medium; CWE-749/CWE-352; A01/A10; ASVS API/business-logic controls | ID-card print GETs wrote access events and OCR private-image GET could change a missing-source state. Crawlers, prefetch, retries, or cross-site navigation must not mutate state. | GET handlers are read-only. Explicit same-origin POST audit endpoints perform validated object rechecks; the print UI reports audit failure without blocking print. OCR retrieval no longer mutates state. Five source/behavior tests prevent regression. | Print access auditing depends on the explicit POST completing; security authorization does not. | `FIXED` |
| SEC1QA-M02 | Cross-portal wrong-role pages returned misleading 200 responses | Medium; CWE-284/CWE-639; A01/A10; ASVS access-control/API controls | Parent/Teacher notification and preference surfaces could render blank or generic HTTP 200 content for the wrong role, and the generated matrix incorrectly treated an ownership-scoped Staff preference surface as Teacher-only. | Wrong-role page access redirects to `/unauthorized`; APIs deny Parent access; Accountant-linked Staff ownership remains valid; route-matrix semantics now model the exact staff-preference exception. Four regression tests cover the boundary. | None within the current single-school role model. | `FIXED` |
| SEC1QA-M03 | Mobile drawer dismiss target fell below 44 px | Medium UI/accessibility; CWE-451; A02/A06/A10; ASVS configuration/usability defense | At exact 320×568, scrollbar width reduced the visible backdrop dismiss strip to 33 px. This made reliable keyboard/touch recovery harder during a security-sensitive navigation state. | Reserved a fixed 48 px dismiss strip independent of scrollbar width. Browser remeasurement at 320×568 found zero sub-44 px controls; regression source test added. | Physical-device assistive-technology certification remains a deployment/device activity. | `FIXED` |

## OWASP Top 10:2025 coverage

| Category | Rechecked evidence |
| --- | --- |
| A01 Broken Access Control | All nine role states were swept across 274 pages and 376 APIs. Parent child ownership, Teacher timetable scope, Viewer export denial, Accountant Staff ownership, direct API denial, stale-role invalidation, and indistinguishable missing-object behavior passed. |
| A02 Security Misconfiguration | Production headers, strict private caching, Host-prefixed cookies, safe error pages, no wildcard CORS, no state-changing GET, public/private separation, and production secret fail-closed behavior passed. TLS/HSTS/proxy stripping remain deployment checks. |
| A03 Software Supply Chain Failures | Direct/transitive inventory and lock integrity were rechecked. Reachable `xlsx@0.18.5` was replaced by exact-pinned official 0.20.3. Remaining Vitest/Vite/esbuild advisories are dev-only and not invoked as a server/UI; PostCSS is build-only with no user stylesheet input. |
| A04 Cryptographic Failures | Scrypt password hashes, random salts/tokens/nonces, timing-safe comparisons, versioned HMAC privacy hashes, AES-256-GCM backup containers, environment-only keys, and no weak production fallback passed. |
| A05 Injection | No unsafe Prisma/raw SQLite query was found. No request-reachable shell exists. SQL, command, template, CSV, header/log, traversal, XSS, and redirect payloads remained inert or were rejected. |
| A06 Insecure Design | Copied-database restore, MOCK-first providers, AI read-only allowlists, OCR zero-write payment boundary, explicit approvals, bounded queues/imports/exports, and fail-closed isolation passed. |
| A07 Authentication Failures | Generic login errors, account/source throttling without permanent unauthenticated lockout, disabled-user denial, session rotation/fixation resistance, stale credential/role invalidation, logout, and private-cache behavior passed. |
| A08 Software or Data Integrity Failures | Encrypted backup identity/hash verification, immutable approval snapshots, webhook signature/replay controls, restore semantic validation, and package lock integrity passed. |
| A09 Security Logging and Alerting Failures | Hashed login-failure/rate-limit events, privileged/finance/restore actions, control-character neutralization, secret/session/password redaction, and zero raw stack/SQL/Prisma disclosure passed. Central aggregation/retention remains deployment work. |
| A10 Mishandling of Exceptional Conditions | Bounded 400/401/403/404/413/415/429 cases, safe 500 source contracts, missing/expired/stale/conflict states, provider-disabled recovery, no blank screens, and no state mutation from GET passed. |

## ASVS mapping

SEC-1 verification mapped to selected applicable ASVS requirements. This is not
a claim of full ASVS certification.

| Applicable ASVS domain | Implemented verification evidence |
| --- | --- |
| Architecture and threat modeling | Repository attack-surface inventory, trust boundaries, copied-DB isolation, provider/public/PWA/AI/OCR boundaries, and explicit deployment residuals. |
| Authentication | Generic failures, password policy/hashing, source/account throttling, disabled users, privileged bootstrap proof, and no credential logging. |
| Session management | Rotated signed Host-prefixed cookies, HttpOnly/SameSite/production Secure, logout invalidation, credential/role/status tags, stale/tampered/expired denial, and private no-store. |
| Access control | Server-side permissions and ownership revalidation for role, Parent child, Teacher timetable, Accountant Staff, Viewer masking/export, downloads, private files, and APIs. |
| Validation and encoding | Typed Prisma operations, strict identifier allowlists, body/file/import/export limits, React text encoding, safe CSV cells, redirect validation, and safe headers/logs. |
| Cryptography | Scrypt, secure randomness, timing-safe comparison, HMAC privacy identifiers, AES-256-GCM backup containers, versioned keys, and fail-closed secret policy. |
| Error handling and logging | Fixed client messages, structured security events, redaction, safe error pages/statuses, no stack/SQL/path/secret reflection, and bounded log fields. |
| Data protection | Private/no-store responses, private OCR storage, sanitized backups, public/private query separation, no sensitive Browser persistence, and zero QA residue. |
| Communication security | Production Secure-cookie/HSTS policy, trusted-proxy opt-in, configured origin, same-origin unsafe-request checks, no mixed-scheme redirect, and deployment TLS boundary. |
| Malicious-code prevention | No request-controlled command execution, no uploaded-file execution, strict file formats/magic/structure, no AI code/SQL/shell, and exact-pinned dependencies. |
| Business logic | Receipt ownership, last-privileged-user protection, approval snapshots, duplicate/replay controls, bounded concurrency/retries, finance validations, and read-only GET semantics. |
| Files and resources | Opaque private names, canonical containment, traversal/symlink rejection, size/dimension/page/row limits, no public OCR URL, no PWA private cache, and no overwrite. |
| API security | Permission guards, ownership checks, CSRF/content-type/body limits, safe errors, no wildcard CORS, no state-changing GET, rate limits, pagination/export caps, and no-store. |
| Configuration | Production secret validation, CSP/frame/nosniff/referrer/permissions/COOP/CORP headers, static-only service worker, environment-only providers, and deployment checklist. |

## Authentication, session, and MITM

Wrong-password, unknown-user, and disabled-user responses were identical 401
responses. Bounded repeated attempts produced six 401 responses followed by five
429 responses. Valid and concurrent logins produced unique session cookies.
Tampered cookies and stale credential/role versions were rejected. Cross-site
logout was 403; same-origin logout succeeded; Browser back after logout remained
on the login surface.

The session cookie is Host-prefixed, HttpOnly, SameSite Strict, path `/`, and
Secure in production. Secure is intentionally absent on the isolated local HTTP
server. Production HTTPS, HSTS delivery, trusted-proxy header stripping, and
cookie observation at the real edge require deployment-environment verification.

## Access control and IDOR

The fresh matrix exercised 5,850 requests: 650 discovered routes multiplied by
nine role states. It found zero network errors, zero 5xx responses, and zero
private-cache violations. Parent linked-child access returned 200 while unrelated
and nonexistent child objects returned the same 404 boundary. Teacher own scope
returned 200 and peer scope 403. Viewer direct export was 403. Wrong portal
families redirected to `/unauthorized`; hidden navigation was never treated as
the authorization boundary.

## Injection, XSS, CSRF, CORS, redirects, and SSRF

Repository search found no `$queryRawUnsafe`, `$executeRawUnsafe`, request-driven
raw SQLite call, dynamic SQL identifier, or request-reachable child process.
Synthetic SQL metacharacters, shell/template strings, formula cells, control
characters, traversal strings, script/HTML strings, and malicious redirect
values remained inert data or were rejected. The only intentional HTML sinks
remain a strict-character Code 39 SVG and JSON-LD serialized with `<` escaping.

Unsafe methods require same-origin Origin/Referer/Sec-Fetch evidence, valid
content types, and SameSite Strict cookies. Cross-origin logout returned 403.
There is no state-changing GET, wildcard CORS, credentialed wildcard, arbitrary
return URL, protocol-relative redirect, JavaScript/data redirect, or unintended
framing. CSP uses nonces/strict-dynamic scripts and `frame-ancestors 'none'`;
X-Frame-Options is a fallback.

Outbound provider endpoints are fixed/environment-only and MOCK-first. URL
classification and provider tests cover loopback, private IPv4/IPv6, link-local,
metadata addresses, alternate notation, credentials, schemes, redirect
revalidation, DNS-result validation, timeouts, and response limits. The isolated
QA made zero external calls.

## Files, resource limits, and exception safety

OCR and import tests rechecked extension, MIME, magic bytes, complete structure,
size, image dimensions/pages, animated-format restrictions, decompression
bounds, generated names, traversal, encoded traversal, symlink/junction escape,
private permission-checked retrieval, no-store/nosniff, and service-worker
exclusion. OCR images remain private and payment posting remains disabled.

Bounded tests covered login, streamed JSON/multipart bodies, spreadsheet rows,
reports/exports, OCR, AI, notification recipients, workers, retries, webhook
replay, malformed JSON, unsupported content type, and friendly 413/429 handling.
No destructive load test was run. The full copied-database backup endpoint
remained the slowest safe sweep operation at approximately 10.5–15.5 seconds;
the first `/roles` render was approximately 7.6 seconds. No Lighthouse score is
claimed.

## Cryptography, secrets, logging, and supply chain

No hard-coded production secret, token in Prisma/Browser storage, secret-bearing
backup field, session ID/password log, or silent weak production default was
found. Backup keys remain outside the container. Security event identifiers are
hashed, fields are bounded/neutralized, and client errors are fixed/redacted.

`xlsx` now resolves only to official SheetJS 0.20.3 with exact lock integrity.
There are no Git dependencies or dependency install/postinstall lifecycle
scripts. The remaining audit advisories are classified:

- Vitest UI: `NOT_REACHABLE`; no UI package use or server command.
- Vite development server: `NOT_REACHABLE`; tests use only `vitest run`.
- esbuild development request behavior: `NOT_REACHABLE`; no exposed dev server.
- PostCSS parser/stringifier: `MITIGATED` and `NOT_REACHABLE` from user input;
  it is an internal Next.js build dependency and the ERP accepts no user CSS.

No automatic major framework upgrade was made.

## Runtime Browser and UI/UX recheck

The actual optimized production portal was exercised for Super Admin, Director,
Principal, Admin, Accountant, Viewer, Teacher, Parent, and unauthenticated public
state. Super Admin covered every major module family; each restricted role was
also tested against an allowed workflow and direct denied route/API.

Exact Browser measurements:

| Requested viewport | `window.innerWidth × innerHeight` | `documentElement.clientWidth × clientHeight` |
| --- | --- | --- |
| 1366×768 | 1366×768 | 1351×768 |
| 768×1024 | 768×1024 | 753×1024 |
| 390×844 | 390×844 | 375×844 |
| 320×568 | 320×568 | 305×568 |

Light and dark modes passed. Mobile drawer open/Escape/focus return, dialog focus
trap/Escape/focus return, visible focus, skip link, semantic navigation/main,
screen-reader labels, reduced motion, table containment, long-text wrapping,
permission-denied states, and 44 px targets passed. The PWA diagnostics showed an
activated controller and one static cache with 14 approved entries; policy
display and source tests exclude authenticated HTML, APIs, images, downloads,
reports, print, writes, backups, and private files. No ERP data appeared in
localStorage, sessionStorage, IndexedDB, or CacheStorage.

- Browser console warnings/errors: 0.
- Hydration errors: 0.
- Production stderr: 0 bytes.
- Native Browser dialogs: 0.
- Page overflow after fixes: 0.

## Backup, PWA, AI, OCR, and public site

Encrypted backup identity/integrity, copied-DB rehearsal, key exclusion, and
operational-restore Browser refusal passed. PWA cache remained static-only. AI
remained read-only, allowlisted, local/no-network, with no shell/SQL/write tools
or prompt/answer-body logging. OCR images remained private and its Payment
posting path remained disabled. Public pages queried only published public
content, set no unnecessary session cookie, did not expose drafts/private ERP
data, and used safe indexing/cache policy.

Prompt 21B/21C/21D remain blocked by missing leadership and qualified Indian
privacy/legal approval. No Student address, coordinate, map, or geocoding work
was opened.

## Isolation, cleanup, and source integrity

The fresh `tmp/sec1qa-runtime` root contained isolated database, uploads,
backups, provider, temporary, log, and rehearsal directories. The production
server displayed `operational=false` before fixtures or login. The copied
database initially matched the operational SHA-256 byte-for-byte.

After testing, two independent inspections found zero `QASEC1QA` Users,
Students, Guardians, links, enrollments, StaffMembers, timetable rows, Payments,
campaigns, website objects, files, provider objects, backups, rehearsals, and
logs. The server stopped, port 3012 closed, and the entire copied root was
removed.

The operational database remained 4,771,840 bytes with SHA-256
`1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392`,
UTC modification time `2026-07-19T13:21:15.3528809Z`, 8 Students, 8 active
enrollments, 19 Payments, and INR 99,100 collected. The permanent `.env`
SHA-256 remained
`23985D90887755AF171F9A50B91524C229A3F89CC31BAD70DF5933B33573427B`.

## Helper fallbacks and remaining limitations

- The normal Node heap exhausted after successful compilation during the large
  type/build worker phase. The established bounded
  `NODE_OPTIONS=--max-old-space-size=4096` fallback passed. No `taskkill`, lock,
  Prisma DLL `EPERM`, or port-conflict recovery was used.
- The existing non-empty SQLite database is not Prisma Migrate-baselined.
  `prisma migrate status` on a copy reports P3005/all 40 migrations unapplied.
  This is a deployment/operations baselining boundary; no schema change was made
  in SEC-1.
- TLS/HSTS at the real edge, proxy sanitization, centralized immutable log
  retention/alerting, multi-instance rate limits/worker leases, live-provider
  certification, and physical-device PWA behavior require deployment review.
- MFA, SSO, and account recovery remain future recommendations, not defects in
  the approved local authentication model.

These boundaries are explicit and are not confirmed Critical/High local
vulnerabilities. The next unblocked roadmap activity is deployment-environment
security verification for the intended hosting architecture. Prompt
21B/21C/21D are not unblocked.

## Final command ladder

The release ladder completed on a fresh byte-for-byte copied database:

- `pnpm.cmd routes:list`: passed; 274 page routes and 376 API routes.
- `pnpm.cmd lifecycle:backfill`: passed with the isolation banner
  `operational=false`; 8 active Students, 8 existing active enrollments, 0
  missing rows, 0 created rows, and no data changed.
- `pnpm.cmd typecheck`: passed with the established bounded 4 GB heap.
- `pnpm.cmd test`: 1,410 tests across 155 files passed.
- `pnpm.cmd build`: passed with the bounded 4 GB heap; Next.js 15.5.19 compiled,
  Prisma Client 6.19.3 generated, and all 211 static pages completed.
- `pnpm.cmd audit`: network access was available; it reports 1 Critical, 1 High,
  and 4 Moderate dev/build advisories, all classified above as
  `NOT_REACHABLE` or `MITIGATED`. The reachable SheetJS advisory is gone.
- `pnpm.cmd backup`: passed after deletion of the copied root. Clean backup
  version 37:
  `nalanda-fee-control-backup-2026-07-20-08-31.json`, SHA-256
  `FD2C87A549B6BF871F28711CF8EDA7644F541815D56E6A4DB1F3D8F7B14F04AC`.

The final backup is 862,572 bytes, contains four sanitized User records, and
contains 0 `QASEC1`/`QASEC1QA` markers, 0 private-key markers, and 0
`passwordHash` properties. After backup, the operational database still matched
the original SHA-256, size, UTC modification time, and business totals.

Final release decision: `SEC_1_FULLY_CLEARED`.
