# ERP Security Attack Surface and Threat Model

This threat model applies only to the local Nalanda ERP repository. Adversarial work must use QASEC1 fixtures, local MOCK providers, and a copied database. No external domain or real person is in scope.

## Inventory

| Surface | Exact repository inventory |
| --- | --- |
| Pages and APIs | 274 page routes; 376 API routes. The SEC-1-QA generated role/status/cache/indexing matrix is `docs/SEC_1_QA_RUNTIME_ROUTE_API_MATRIX.csv`; the SEC-1B snapshot remains historical. |
| Authentication entry points | `/login`, `/setup`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/change-password`, privileged user create/reset/status/role APIs, Parent/Teacher linked-login workflows. |
| Session lifecycle | One signed `__Host-nalanda_session` cookie; creation at login, deletion at logout, credential-tag and role validation per authenticated request, rotation on login, invalidation on password/role/active-state change. |
| Public routes | Public website route family, `/login`, `/setup`, `/offline`, manifest/service worker/static icons, and signed provider webhook prefixes. All other routes fail closed in middleware. |
| Authenticated pages | Every non-public page is session-gated in middleware and revalidated through `getCurrentUser`/permission helpers. |
| Server actions | 0 `"use server"` actions. State mutation is through API handlers. |
| Upload routes | 1 multipart upload family: OCR batch pages. Spreadsheet imports are parsed in the Browser under strict bounds and sent as bounded JSON. Backup restore accepts JSON only and execution is copied-QA-only. |
| Download/export routes | 35 routes with `Content-Disposition`, including attendance, finance, cash, books, certificates, cloud backup, reports, website admin, Library, marks, timetable, OCR, and generic exports. |
| Backup/restore | `/api/backup`, `/api/restore`, cloud-backup profile/run/report/rehearsal routes, encrypted container helpers, retention helpers, and local MOCK provider storage. |
| Provider webhooks | WhatsApp and SMS/Email webhook route families only. Signatures, key lengths, replay/event counts, and logs are bounded. |
| Outbound HTTP | Production provider helpers in `lib/whatsapp-provider-meta.ts` and `lib/sms-email-provider.ts`; PWA fetch is client-side static-only. AI local endpoint remains allowlisted/local and read-only. |
| Child processes | 0 request-reachable production uses. `scripts/demo-seed.ts` and the local SEC-1 runtime PowerShell launcher are development/QA-only. |
| Raw SQL | 0 `$queryRaw`, `$executeRaw`, unsafe variants, `Prisma.raw`, or direct SQLite driver calls in application source. |
| Dynamic paths | Dynamic route parameters are permission checked; numeric IDs use bounded parsing; OCR paths use opaque keys, canonical containment, and symlink/junction rejection. |
| Redirects | 23 application/middleware files contain redirects. Login `next` values are internal-only; protocol-relative and non-HTTP values are rejected. |
| Cookies | Four implementation locations: middleware, `lib/auth.ts`, login, and logout. No session IDs in URLs. |
| CORS | 0 allow-origin implementations. Default is same-origin; credentialed wildcard CORS is absent. |
| Security headers | Middleware/Next config set CSP nonce, `frame-ancestors 'none'`, X-Frame-Options fallback, nosniff, Referrer-Policy, Permissions-Policy, COOP/CORP, and private no-store controls. HSTS is production flag-gated. |
| PWA | Static asset and generic offline interception only. Authenticated HTML/API, backup, upload, and private artifacts are excluded. |
| Secrets | Environment-only auth, provider, bootstrap, pepper, live activation, storage, and database configuration. Production weak defaults fail closed. |
| Scheduled workers | WhatsApp, SMS/Email, cloud backup, and AI cleanup helpers. Local locks bound same-process concurrency; multi-instance leases require deployment work. |
| Privileged actions | User/role changes, restore, payment, fee, cash, publish, approve, send, OCR, cloud backup, website admin, import/export, and audit/report actions are represented in the generated permission matrix. |

## Assets and trust boundaries

Primary assets are authentication credentials, session tokens, role/permission assignments, Student/Guardian/Staff data, finance records and receipts, private OCR images, report/export data, encrypted backup containers, provider credentials, audit events, and public-site publication state.

Trust boundaries:

1. Browser to Next.js middleware and route handlers.
2. Session cookie to current database identity/role/credential state.
3. Route authorization to object ownership and workflow state.
4. Uploaded/imported bytes to private storage or normalized data.
5. Operational database to copied-QA databases and backup/restore containers.
6. ERP process to MOCK/live external providers.
7. Private ERP content to the public website and PWA cache.

## Principal threat paths and controls

| Threat path | Control outcome |
| --- | --- |
| Anonymous claimant creates first Director | Production requires a secret bootstrap token before any write; the last-privileged-user invariant is rechecked in a serializable transaction. |
| Stolen/fixed/stale session | High-entropy signed token, Host-prefixed HttpOnly cookie, Strict SameSite, Secure in production, credential tag, current role/active-state validation, rotation, no-store private pages. |
| IDOR through predictable IDs | Permission matrix plus server-side object/Parent-child/Teacher-staff scope checks; direct APIs are tested, not merely hidden navigation. |
| SQL/command/template injection | Prisma typed operations, no raw SQL, no request-controlled child process, plain-text rendering, CSV formula escaping, bounded synthetic regression payloads. |
| Cross-site mutation | Strict SameSite plus Origin/Referer/Sec-Fetch validation, JSON/content-type validation, signed webhook exceptions, no state-changing GET. |
| SSRF/provider abuse | Fixed/provider-specific endpoints, scheme/host/private-network validation, timeouts and response limits, MOCK-first and live-disabled defaults. |
| Upload traversal/execution | MIME/magic/structure/size limits, opaque names, private storage, canonical containment, root symlink/junction rejection, no uploaded execution. |
| Resource exhaustion | 5 MB default streamed request cap, 26 MB OCR page cap, 2,000-row imports, 10,000-row report/export caps, 500 Class X cap, bounded webhook events, pagination and worker locks. |
| Secret/log/error leakage | Environment secrets, keyed hashes, no raw API exception messages, generic production error page, log-control-character neutralization, no credential/session logging. |
| Public/PWA/backup leakage | Public-only queries, draft separation, static-only cache, private no-store headers, encrypted off-device containers, no key storage, copied-QA-only Browser restore. |

## Deployment-only controls

Before internet exposure, terminate TLS correctly, set `APP_ORIGIN`, enable `TRUST_PROXY_HEADERS` only behind a proxy that strips client-supplied forwarding headers, enable HSTS/HTTPS upgrade, provide all production secrets/peppers/bootstrap proof, add distributed rate-limit/worker storage, retain security logs immutably, and validate CSP/header behavior at the deployed edge.
