# SEC-1 Security Audit and Hardening Report

Scope: repository-wide SEC-1A security audit and hardening, SEC-1B production
runtime verification, and SEC-1-QA independent closure. Local authorized testing
only; no real-system penetration testing. Baselines: OWASP Top 10:2025 and OWASP
ASVS 5.0.0.

## Result

Pre-remediation discovery consolidated 0 Critical, 4 High, and 18 Medium confirmed findings. Every confirmed High and Medium defect that was safe in this phase is fixed and regression tested. Deployment-only controls and upstream/package constraints remain explicit; Prompt 21B/21C/21D remain blocked.

| Severity | Confirmed | Fixed | Accepted/deployment residual |
| --- | ---: | ---: | ---: |
| Critical | 0 | 0 | 0 |
| High | 4 | 4 | 0 |
| Medium | 18 | 18 | 0 |

## Finding register

| ID | Finding and references | Evidence / attack scenario and impact | Fix and tests | Residual risk | Status |
| --- | --- | --- | --- | --- | --- |
| SEC1-H01 | Anonymous first-run Director claim. CWE-306; OWASP A01/A07; ASVS V2/V4 | An uninitialized production database could be claimed through public setup. | `FIRST_RUN_BOOTSTRAP_TOKEN` required in production before writes; UI proof handling; setup tests. | Secret provisioning is deployment work. | `FIXED` |
| SEC1-H02 | Operational Browser restore. CWE-284/494; A01/A08; ASVS V4/V12 | Authorized Browser restore could replace operational data/RBAC with supplied JSON. | Execution requires absolute DB inside `BROWSER_RESTORE_COPIED_QA_ROOT`, rejects `prisma/dev.db`, rejects role-permission restore; preview retained. | CLI/operator restore remains a controlled operational procedure. | `FIXED` |
| SEC1-H03 | Last privileged account TOCTOU. CWE-367/269; A01; ASVS V4 | Concurrent role/status changes could remove the final privileged user and reopen setup. | Serializable transaction recheck; role sessions invalidate; user-management tests. | Distributed databases should preserve equivalent isolation. | `FIXED` |
| SEC1-H04 | Known seed/provider credentials. CWE-798; A02/A07; ASVS V2/V6 | Generic seed or MOCK provider defaults could create known privileged credentials/signatures. | Generic seed fails closed; demo defaults require explicit opt-in; production MOCK secrets/tokens require 32+ characters. | Secret rotation is operational. | `FIXED` |
| SEC1-M01 | Receipt/Student ownership invariant. CWE-639; A01; ASVS V4 | Editing/import/restoring a Payment could bind a receipt shared with another Student. | Shared ownership enforcement for create/edit/import/restore; regression tests. | None beyond operator data quality. | `FIXED` |
| SEC1-M02 | Payment import race/unbounded rows. CWE-400/362; A04; ASVS V5/V11 | Large imports or stale duplicate snapshots could exhaust resources/create duplicates. | 2,000-row cap and exact duplicate recheck in transaction. | Multi-node database isolation must remain equivalent. | `FIXED` |
| SEC1-M03 | Content-Length-only limits. CWE-400; A04; ASVS V5/V12 | Lengthless/chunked bodies bypassed pre-parse size checks. | Clone-stream byte counting; malformed lengths reject; 413 tests. | Edge/proxy limits still recommended. | `FIXED` |
| SEC1-M04 | Login throttling denial risk. CWE-307/400; A07; ASVS V2 | Shared “direct” source or pure account bucket could let an attacker continuously deny a victim. | Trusted source + account/source buckets; shared untrusted direct source never hard-blocks; generic errors and dummy scrypt retained. | Distributed limiter required for multiple instances. | `FIXED` |
| SEC1-M05 | Weak new-password and stale role session policy. CWE-521/613; A07; ASVS V2/V3 | Eight-character/common passwords and role-stale sessions weakened credentials. | 12–128 characters, common/repeated rejection, UI alignment, credential and role tags. | MFA is a future recommendation, not SEC-1 scope. | `FIXED` |
| SEC1-M06 | Forwarded host/protocol trust. CWE-346; A05; ASVS V14 | Client-supplied forwarded headers could influence same-origin validation. | Ignore unless `TRUST_PROXY_HEADERS=true`; configured `APP_ORIGIN` preferred; tests. | Proxy must strip/sanitize headers. | `FIXED` |
| SEC1-M07 | Raw exception disclosure. CWE-209/117; A05/A09; ASVS V7/V13 | Prisma/SQL/path/secret/stack messages could be reflected by APIs or error UI. | 205 API responses use `safeClientError`; generic app error page; control-character and source-scan tests. | Detailed server logging must be protected. | `FIXED` |
| SEC1-M08 | OCR state/storage authorization. CWE-284/22/59; A01/A08; ASVS V4/V12 | Paused profiles could reactivate, terminal rows mutate, weak cancel states, or configured roots escape. | State/permission guards, manual cap, canonical realpath containment, symlink/junction/public rejection. | Real Windows junction creation was not used in tests. | `FIXED` |
| SEC1-M09 | Class X cross-year/state/duplicate defects. CWE-639/362; A01/A04; ASVS V4/V5 | Cross-year eligibility, fabricated review wording, duplicate active packages, weak cancellation. | Exact-year enrollment, no fabricated review, transaction duplicate guard, stronger cancel/approval, newest-500 report cap. | Non-SQLite backend should add durable uniqueness. | `FIXED` |
| SEC1-M10 | Fee/cash validation and audit gaps. CWE-20/345; A04/A09; ASVS V5/V7 | Invalid class/year/month/amount or unverifiable opening balances could corrupt finance controls. | Canonical fee validator, unknown-month rejection, opening provenance, structured actor-attributed event. | Log durability depends on deployment retention. | `FIXED` |
| SEC1-M11 | CSV formula injection. CWE-1236; A03; ASVS V5 | Exported attacker-controlled cells could execute formulas when opened. | Shared CSV escape prefixes `= + - @ tab CR`; certificate year validation; tests. | Spreadsheet applications remain external trust boundaries. | `FIXED` |
| SEC1-M12 | Webhook storage/replay amplification. CWE-400/347; A04/A08; ASVS V11/V13 | Large event arrays/keys and invalid signatures could amplify storage/logs. | 100 events, 200-character keys, signature verification, bounded aggregation/replay tests. | Edge request limits still recommended. | `FIXED` |
| SEC1-M13 | Ambiguous external send retry/rate race. CWE-362; A04/A08; ASVS V11 | Stale `SENDING` rows could be retried and same-process workers race rate checks. | `NEEDS_RECONCILIATION` non-retryable state and process mutex. | Distributed lease is deployment work. | `FIXED` |
| SEC1-M14 | SMS/Email approval drift. CWE-345; A08; ASVS V8 | Changed campaign/template content could replace what was approved. | Send-time revalidation and immutable approval snapshot. | Live provider activation remains supervised. | `FIXED` |
| SEC1-M15 | Unkeyed privacy hashes. CWE-328/321; A02; ASVS V6/V8 | Low-entropy contact/query hashes were guessable if peppers were absent. | Versioned HMAC; production peppers fail closed; no body logging. | Pepper rotation procedure is deployment work. | `FIXED` |
| SEC1-M16 | Unbounded report/export families. CWE-400; A04; ASVS V11 | Historical tables could be fully buffered and serialized. | Explicit 10,000-row caps; 500 Class X cap; response cache/nosniff hardening; source tests. | Pagination is future usability work. | `FIXED` |
| SEC1-M17 | Restore semantic/state gaps. CWE-345/639; A01/A08; ASVS V4/V8 | Restore could violate receipt ownership, messaging paused state, or semantic idempotence. | Shared receipt invariant, copied-QA Browser execution, stronger validation/state handling. | Full operational restore remains offline/operator controlled. | `FIXED` |
| SEC1-M18 | Native dialogs and permission-nav leakage. CWE-284; A01; ASVS V4/V14 | Native dialogs harmed accessible confirmation; preferences link appeared without both required permissions. | Shared accessible dialog with Escape/focus trap/return; all native calls removed; shell links permission-gated. | Browser runtime pass verifies every viewport/mode. | `FIXED` |

## Category results

- Authentication: generic wrong/unknown/disabled responses; bounded source/account throttling; production bootstrap proof; inactive users denied; no password logging.
- Session/cookie/MITM: rotated signed Host-prefixed HttpOnly Strict cookie; Secure in production; password/role/status invalidation; private no-store. TLS, HSTS, and proxy trust require deployment verification.
- Authorization/IDOR: current database role and object ownership are revalidated; Parent/Teacher/Viewer/Accountant scopes remain server-side. The generated matrix covers all 649 routes.
- SQL/command/RCE: no raw Prisma/SQLite query use and no request-reachable child process. Synthetic injection strings remain data.
- XSS/CSRF/CORS/redirect/clickjacking: plain-text/default React encoding, nonce CSP, Origin/Referer checks, no allow-origin CORS, internal redirects, `frame-ancestors 'none'`.
- SSRF/outbound: provider-specific endpoints, MOCK-first, live-disabled, safe schemes/hosts/limits.
- Upload/path: OCR private storage and structural bounds; spreadsheets bounded by size/signature/sheet/columns/rows; canonical path checks.
- DoS: streamed bodies, imports, webhook payloads, AI audit limits, worker locks, and reports are bounded.
- Crypto/secrets: scrypt with random salt, timing-safe compare, secure randomness, HMAC privacy hashes, fail-closed production secrets.
- Logging/errors: structured critical events, hash-only broad identifiers, neutralized control characters, no raw API error reflection.
- Dependency/supply chain: independent QA confirmed the reachable
  `xlsx@0.18.5` advisory as High and fixed it with the exact-pinned official
  SheetJS 0.20.3 distribution plus lock-integrity regression tests.
  Vitest/Vite/esbuild advisories are development-only and not reachable because
  the repository exposes no test UI/development server; PostCSS is build-only
  and receives no user CSS. No git dependencies or dependency
  install/postinstall scripts were found.
- Backup/PWA/AI/public site: encrypted containers, no key storage, copied-QA Browser restore, static-only PWA cache, read-only privacy-safe AI, public-content-only queries and draft separation.

## Verification record

Focused SEC-1 suites cover bootstrap, login enumeration/rate limits, password/session rotation, stale role/password sessions, restore isolation, receipt ownership, import injection/races, request streams, proxy trust, CSRF, redirects, headers/CSP/cache, SSRF classification, traversal/symlink, malformed files, webhook replay, XSS/CSV, error redaction, secrets, permission/IDOR matrices, backup/PWA/public boundaries, OCR/Class X/fee/cash, and messaging/AI.

## SEC-1A closure evidence

- Route inventory: 274 pages and 375 APIs.
- Lifecycle backfill: copied-database dry run scanned 8 active Students, found 8 active enrollments and 0 missing rows, and changed nothing.
- Typecheck: passed.
- Tests: 1,398 tests across 152 files passed at SEC-1A closure.
- Optimized production build: passed after the established bounded `NODE_OPTIONS=--max-old-space-size=4096` fallback; the ordinary worker exhausted its heap only after compilation. No Node lock, Prisma DLL `EPERM`, port conflict, or `taskkill` was involved.
- Clean SEC-1A backup: version 37, `nalanda-fee-control-backup-2026-07-20-02-57.json`.
- Operational database SHA-256 and business totals remained unchanged.

## SEC-1B closure

The copied-database production Browser audit, role/API matrix, runtime adversarial probes, UI fixes, repeated full pass, and residue cleanup are recorded in `SEC_1_RUNTIME_BROWSER_AND_UI_UX_AUDIT.md`. SEC-1B confirmed and fixed two Medium UI/exception-handling defects: undersized mobile navigation targets and the bare 404 recovery experience.

Prompt 21B/21C/21D remain blocked.

## Final SEC-1 command ladder

The release ladder completed on 2026-07-20. Database-aware validation and the
optimized build used a fresh byte-for-byte copied database; the copy was deleted
before the clean backup.

- `pnpm.cmd routes:list`: passed; 274 page routes and 375 API routes.
- `pnpm.cmd lifecycle:backfill`: passed against the copied database; 8 active
  Students, 8 existing active enrollments, and 0 missing or created rows.
- `pnpm.cmd typecheck`: passed.
- `pnpm.cmd test`: 1,399 tests across 152 files passed.
- `pnpm.cmd build`: passed with the established bounded
  `NODE_OPTIONS=--max-old-space-size=4096` fallback; Next.js generated all 211
  static pages. No lock, Prisma DLL `EPERM`, port conflict, or `taskkill`.
- `pnpm.cmd backup`: clean backup version 37,
  `nalanda-fee-control-backup-2026-07-20-03-38.json`
  (SHA-256 `76E4D14CF5EF0B6D5D8654FA5DE14A4AEB7BD2B253F19E6F2AFEEE4BC0D7762B`).
  It contains 0 QASEC1 markers, 0 private-key markers, and no password-hash
  property in its four sanitized User records. Literal `passwordHash` text
  occurs only inside the AI safety policy/evaluation prohibited-term lists.

After the ladder, the operational database remained 4,771,840 bytes with
SHA-256 `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392`
and UTC modification time `2026-07-19T13:21:15.3528809Z`. Business totals
remained 8 Students, 8 active enrollments, 19 Payments, and INR 99,100
collected. The permanent `.env` SHA-256 remained
`23985D90887755AF171F9A50B91524C229A3F89CC31BAD70DF5933B33573427B`.
Both `tmp/sec1-runtime` and `tmp/sec1-final` are absent, and port 3011 has zero
listeners.

## SEC-1-QA independent closure

The independent static, copied-database, role/IDOR, adversarial, optimized
Browser, cleanup, and source-integrity recheck is recorded in
`SEC_1_INDEPENDENT_QA_CLOSURE_REPORT.md`. It confirmed and fixed one High
supply-chain finding and three Medium state-changing-GET, cross-portal role, and
mobile accessibility defects. No confirmed Critical, High, or Medium finding
remains in the authorized local boundary.

The consolidated SEC-1 finding count is 0 Critical, 5 High fixed, and 23 Medium
fixed. SEC-1 is fully cleared for the authorized local boundary, subject to the
explicit deployment-only limitations. Prompt 21B/21C/21D remain blocked.

Final SEC-1-QA release ladder: 274 pages, 376 APIs, copied-DB lifecycle dry run
with 0 changes, passing typecheck, 1,410 tests across 155 files, optimized build
with 211/211 static pages, and clean backup version 37
`nalanda-fee-control-backup-2026-07-20-08-31.json` (SHA-256
`FD2C87A549B6BF871F28711CF8EDA7644F541815D56E6A4DB1F3D8F7B14F04AC`).
The operational database hash/totals and `.env` remained unchanged.

Release decision: `SEC_1_FULLY_CLEARED`.
