# SEC-1B Production Runtime Browser and UI/UX Audit

Date: 2026-07-20  
Scope: local optimized production portal only  
Database: byte-for-byte copied SQLite database only  
Baseline: SEC-1A, OWASP Top 10:2025, OWASP ASVS 5.0.0

## Authorization and safety boundary

- Testing was limited to `http://127.0.0.1:3011` and the local repository.
- No external domain, live provider, DNS, deployment, real credential interception, destructive load, or real-user brute force was used.
- All new records used the `QASEC1` prefix and existed only in `tmp/sec1-runtime/database/qasec1-runtime.db`.
- The launcher failed closed unless the active database was inside the isolated database root and different from `prisma/dev.db`.
- WhatsApp, SMS/Email, AI, OCR, and cloud-provider behavior remained MOCK/local-disabled. No live call was made.
- Prompt 21B, Prompt 21C, Prompt 21D, Student addresses, coordinates, maps, and geocoding remained untouched.

## Isolation evidence

| Check | Result |
| --- | --- |
| Operational SHA-256 before | `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392` |
| Fresh copy SHA-256 before fixtures | exact match |
| Operational size | 4,771,840 bytes |
| Operational timestamp | `2026-07-19T13:21:15.3528809Z` |
| Permanent `.env` SHA-256 before/after | `23985D90887755AF171F9A50B91524C229A3F89CC31BAD70DF5933B33573427B` |
| Server isolation proof | `QA20C_ISOLATION_ACTIVE ... operational=false` |
| Operational login | never used |
| Operational SHA-256 after cleanup | unchanged |
| Operational totals after cleanup | 8 Students; 8 active enrollments; 19 Payments; ₹99,100 |

## Route and API matrix

`SEC_1_RUNTIME_ROUTE_API_MATRIX.csv` contains every discovered page/API, public/private state, permission, role allowance/blocking, expected unauthenticated/blocked behavior, cache policy, indexing policy, source file, and observed status for every role family.

- Pages: 274
- APIs: 375
- Role states: unauthenticated plus eight authenticated roles
- Requests: 5,841
- Network errors: 0
- HTTP 5xx: 0
- Private cache violations: 0

`400` results were invalid synthetic dynamic parameters, `404` results were nonexistent QASEC1 objects, and `405` results were GET probes against handlers that deliberately expose only other methods. The final sweep had no unexplained anomaly.

## Browser routes and modules inspected

The optimized production Browser pass inspected 41 representative module surfaces and was repeated after each confirmed UI fix:

`/dashboard`, `/students`, `/students/lifecycle`, `/payments`, `/pending-dues`, `/receipt-audit`, `/expenses`, `/budgets`, `/cash-book`, `/books`, `/library`, `/homework`, `/attendance/students`, `/leave/staff`, `/substitutes`, `/timetable`, `/exams`, `/marks`, `/report-cards`, `/teacher-analytics`, `/certificates`, `/class-x-documents`, `/id-cards`, `/notifications/manage`, `/whatsapp`, `/sms-email`, `/settings/pwa`, `/ai-assistant`, `/fee-register-ocr`, `/cloud-backup`, `/`, `/website-admin`, `/roles`, `/users`, `/import-export`, `/import-verification`, `/settings`, `/parent`, `/teacher`, `/staff`, and `/guardians`.

The authenticated sweep supplied the complete route/API coverage; dynamic routes used only QASEC1-owned or deliberately missing identifiers.

## Role, authorization, and IDOR result

| Role | Browser-allowed surface | Browser-blocked proof |
| --- | --- | --- |
| Super Admin | `/roles` | all-permission control role |
| Director | `/dashboard` | `/roles` → `/unauthorized` |
| Principal | `/dashboard` | `/roles` → `/unauthorized` |
| Admin | `/students` | `/roles` → `/unauthorized` |
| Accountant | `/payments` | `/roles` → `/unauthorized` |
| Viewer | `/students/lifecycle` | `/payments/new` → `/unauthorized` |
| Teacher | `/teacher` | `/students` → `/unauthorized` |
| Parent | `/parent` | `/students` → `/unauthorized` |

Direct API probes additionally proved:

- linked Parent → linked QASEC1 child: 200;
- linked Parent → unrelated QASEC1 child: 404;
- linked Parent → nonexistent child: identical 404 body, preventing object-existence disclosure;
- Teacher own Homework scope: 200;
- Teacher request against peer Staff ID: 403 before request-body processing;
- stale role, password-changed, restored-password, expired/tampered session paths fail closed.

No navigation-only authorization control was accepted as proof.

## Authentication, session, and adversarial result

The final runtime adversarial suite passed 40 checks:

- wrong password, unknown account, and disabled account return identical generic 401 responses;
- successful and concurrent logins rotate the signed session;
- local HTTP QA cookie is HttpOnly and SameSite=Strict; production Secure behavior is source/test verified;
- tampered sessions redirect; logout invalidates; cross-site logout is 403;
- password and role changes invalidate existing sessions, including Next.js streamed redirects that contain `NEXT_REDIRECT` to `/login` and no protected content;
- repeated bounded failures produce 429 without permanent unauthenticated account denial;
- malformed JSON is 400, unsupported media is 415, and oversized input is 413;
- SQL, HTML/script, CSV formula, traversal, and header-injection strings remain inert;
- invalid numeric paths are safely 400;
- CORS remains default-deny with no `Access-Control-Allow-Origin`;
- public home sets no session cookie;
- no response exposed Prisma, SQLite, SQL, stack, `node_modules`, or an absolute user path.

The initial stale-role probe expected a transport 307. Next.js emitted a streamed server-component redirect as HTTP 200. The harness now accepts only the exact `/login` redirect marker with protected content absent; this was a harness correction, not an authorization bypass.

## UI/UX and accessibility

Exact light and dark passes were completed at:

- 1440×900
- 1366×768
- 1024×768
- 768×1024
- 390×844
- 375×667
- 320×568

In-page proof captured `window.innerWidth`, `window.innerHeight`, `document.documentElement.clientWidth`, and `document.documentElement.clientHeight`. Scrollbar-adjusted client width was expected; every requested inner viewport matched exactly.

Final results:

- zero document-level horizontal overflow;
- zero visible buttons below 44 px;
- mobile drawer link minimum: exactly 44 px at 390, 375, and 320 widths;
- drawer `aria-expanded` changes correctly;
- Escape closes the drawer and returns focus to “Open navigation menu”;
- skip link, semantic main/navigation regions, active navigation, labels, alt text, focus-visible CSS, focus trap, and reduced-motion source contracts remained present;
- no native `alert`, `confirm`, or `prompt`;
- tables remain contained by their scroll wrappers;
- light/dark theme switching is stable at every viewport;
- no hydration error, blank screen, or Browser console warning/error.

## Confirmed runtime defects and fixes

| ID | Severity | Defect | Fix | Regression evidence |
| --- | --- | --- | --- | --- |
| SEC1B-U01 | Medium UI/accessibility | Mobile ERP drawer links rendered at 37 px, below the required 44 px touch target. | Added mobile `.nav a { min-height: 44px; }`. | Source test plus repeated 390/375/320 Browser measurement: 44 px, zero undersized drawer controls. |
| SEC1B-U02 | Medium exceptional-condition UX | Unknown routes used the bare Next.js 404 without a page-specific recovery action. | Added a safe custom `app/not-found.tsx` with neutral wording, “No data was changed,” and a safe return link. | Source test plus Browser 404 pass: heading/recovery present, no leak, no overflow. |

## Error and exception UX

- 400/401/403/404/413/415/429 were exercised through bounded runtime probes.
- Permission denial uses `/unauthorized`, safe role wording, and a recovery link.
- Unknown routes use the custom 404 and safe return link.
- Missing dynamic objects remain 404 without existence leakage.
- Provider-disabled and PWA-unavailable states use explicit non-destructive wording.
- 500 redaction is covered by focused production error-source tests; no production-reachable forced-500 endpoint was added merely for QA.
- No raw Prisma message, SQL, stack, secret, or absolute path appeared in Browser content.

## Headers, PWA, cache, and Browser storage

Runtime responses exposed CSP, frame protection, nosniff, Referrer-Policy, Permissions-Policy, COOP, and CORP. Protected/API responses remained private/no-store, public routes did not create a session cookie, and the route sweep found zero private cache violations.

The PWA diagnostics page reported no service-worker capability in the in-app local HTTP environment, no Nalanda cache, and zero cache entries. This is an honest Browser-environment limitation, not evidence of physical-device installability. Source and regression tests continue to enforce static-assets-only caching and exclude authenticated pages, APIs, reports, downloads, backups, and private images. No ERP record is written to localStorage, sessionStorage, or IndexedDB by the implementation.

## Performance observations

No Lighthouse score is claimed. No Browser memory warning, repeated request loop, hydration loop, or client-console error appeared. The slowest deliberate sweep operations were:

- copied-database full backup endpoint: approximately 10.5–17.2 seconds;
- first optimized `/roles` render: approximately 8.2 seconds because it renders the complete permission matrix;
- AI administration pages: approximately 1.0–1.6 seconds;
- ordinary module pages were generally below approximately 0.6 seconds after warm-up.

These are observations, not a destructive load test. Backup and the complete permission matrix remain candidates for future pagination/streaming UX review, but no security failure was confirmed.

## Console, stderr, and cleanup

- Browser console warnings/errors: 0.
- Hydration errors: 0.
- Production stderr contained only expected hashed `AUTH_LOGIN_FAILURE` and `AUTH_LOGIN_RATE_LIMIT` security events from the bounded probe; no stack or server exception.
- Two independent copied-database inspections returned zero QASEC1 Users, Students, Guardians, links, enrollments, StaffMembers, timetable objects, Payments, campaigns, website pages, and website posts.
- QA uploads: 0; backup objects: 0; provider objects: 0; rehearsal files: 0.
- The stopped server, PID file, logs, route-sweep JSON, security-probe JSON, and copied database were deleted with the whole verified `tmp/sec1-runtime` root.
- Port 3011 listeners after cleanup: 0.
- Operational database SHA-256, file size, timestamp, business totals, and `.env` SHA-256 are unchanged.

## Remaining limitations and next gate

- TLS/HSTS, trusted-proxy stripping, distributed rate limiting/leases, centralized log retention/alerting, physical PWA/device behavior, and live provider controls require deployment-environment verification.
- The later independent SEC-1-QA pass replaced reachable `xlsx@0.18.5` with the
  exact-pinned official SheetJS 0.20.3 distribution and added lock-integrity
  regression tests. It is no longer an open advisory in this repository.
- MFA/SSO/account recovery remain future recommendations, not hidden SEC-1 scope.
- Prompt 21B/21C/21D remain blocked by external approval and were not reopened.

## Final release verification

- Routes: 274 pages and 375 APIs.
- Lifecycle backfill: passed on a fresh copied database with 0 missing or
  created enrollment rows.
- Typecheck: passed.
- Tests: 1,399 across 152 files passed.
- Optimized production build: passed using the established bounded 4 GB heap;
  all 211 static pages generated.
- Final clean backup: version 37,
  `nalanda-fee-control-backup-2026-07-20-03-38.json`.
- Operational database: original SHA-256, size, UTC timestamp, and business
  totals unchanged after copied-database deletion and backup.
- Residue: `tmp/sec1-runtime` absent, `tmp/sec1-final` absent, port 3011 closed,
  and the two independent QASEC1 inspections remained all-zero.

At SEC-1B closure, SEC-1-QA was safe to begin for the authorized local boundary.
It has now completed as recorded below. Deployment-only controls remain
explicit, and Prompt 21B/21C/21D remain blocked.

## Independent SEC-1-QA addendum

`SEC_1_INDEPENDENT_QA_CLOSURE_REPORT.md` records the completed fresh copied-DB
verification. The repeat Browser pass covered all roles, four exact required
viewports, light/dark, PWA runtime storage/cache evidence, focus/dialog/drawer
behavior, console/hydration/stderr, and zero-residue cleanup. It also corrected
a 320 px drawer-dismiss touch target and cross-portal wrong-role behavior.
