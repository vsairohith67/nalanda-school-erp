# ERP Security Attack Surface and Threat Model

This repository-wide threat model was refreshed for `SECURITY-RESILIENCE-1A`. Adversarial work must use synthetic fixtures, local MOCK/disabled providers, and a copied database. No external domain, edge provider, real school record, or real person is in scope.

## Inventory

| Surface | Exact repository inventory |
| --- | --- |
| Pages and APIs | 350 page routes; 590 API routes at the SECURITY-RESILIENCE-1A acceptance snapshot. `pnpm routes:list` is the canonical regenerated inventory; older SEC-1 matrices are historical. |
| Authentication entry points | `/login`, `/setup`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/change-password`, privileged user create/reset/status/role APIs, Parent/Teacher linked-login workflows. |
| Session lifecycle | One signed `__Host-nalanda_session` cookie; creation at login, deletion at logout, credential-tag and role validation per authenticated request, rotation on login, invalidation on password/role/active-state change. |
| Public routes | Public website route family, `/login`, `/setup`, `/offline`, manifest/service worker/static icons, and signed provider webhook prefixes. All other routes fail closed in middleware. |
| Authenticated pages | Every non-public page is session-gated in middleware and revalidated through `getCurrentUser`/permission helpers. |
| Server actions | 0 `"use server"` actions. State mutation is through API handlers. |
| Upload routes | Governed private upload families include OCR, Admissions documents, Support attachments, classwork, payslip PDFs, and Event Media. Exact byte/type/structure/storage checks remain route-specific; middleware adds streamed and parsed-structure bounds. Spreadsheet imports are bounded JSON; restore execution is copied-QA-only. |
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

## SECURITY-RESILIENCE-1A actors, assets, and assumptions

Assets include credentials and recovery channels; session and device identity; role/permission and ownership state; Student, Guardian, Staff, safeguarding and private-note data; finance/payment/receipt integrity; private uploads and derivatives; imports, exports and PDFs; Search evidence and ephemeral Smart AI context; notification/sync idempotency; database capacity; backup keys/containers/recovery points; audit evidence; provider budgets; origin address, certificates and tunnel identity; software dependencies and build/release provenance.

Actors include unauthenticated opportunistic users, credential stuffers, spam/bot operators, scrapers, resource-exhaustion and extortion actors, malicious file suppliers, compromised authenticated accounts, over-privileged or malicious insiders, compromised dependencies/build infrastructure, provider/account-cost attackers, and authorised operators who can make mistakes. Managed edge, reverse proxy, application process, database/storage, provider adapters, backup destination and CI/release systems are trusted only for their documented boundary and configuration.

Assumptions: public traffic must first reach a managed edge; the origin is private or edge-restricted; proxy identity is cryptographically proven and overwritten; production uses an atomic distributed rate-limit store; providers stay disabled until separately activated; Smart AI is exact `SUPER_ADMIN`, read-only, Search-grounded and local-provider-disabled by default; real recovery material never enters local QA.

## Refreshed trust boundaries

1. Internet to managed DDoS/WAF/CDN edge.
2. Edge/tunnel to restricted reverse proxy and authenticated proxy proof.
3. Browser to middleware request size, origin, session and abuse policy.
4. Signed opaque session to current database user, credential version, role assignment and object scope.
5. Route input to validators, idempotency controls and bounded database queries/transactions.
6. Uploaded/compressed bytes to decoders, private storage and derivative workers.
7. Search evidence to Smart AI bounded context and untrusted model output validation.
8. Application to disabled/MOCK/approved provider network boundary with timeouts, response caps and circuit state.
9. Operational database/storage to encrypted backup, isolated restore and recovery approval.
10. Source/dependencies to CI, exact-head acceptance, merge commit and annotated release tag.

## Abuse, resilience, and residual-risk register

| Threat | Primary controls | Residual risk / required next gate |
| --- | --- | --- |
| Credential stuffing | Generic errors, dummy password verification, account plus proven-source limits, session/security events, edge login rule. | Distributed attacks require managed edge and atomic distributed store; MFA remains a separate decision. |
| Password recovery abuse | Anti-enumeration response, account/channel/source policy, single-use expiring records, provider disabled/default-safe. | Delivery-provider abuse and OTP policy require live-provider staging before activation. |
| Session theft | Host-prefixed Secure HttpOnly Strict cookie, signed opaque secret, persisted hash, credential/role/status validation, revocation and rotation. | Endpoint compromise and user device malware cannot be eliminated by server controls. |
| Role/permission bypass | Middleware session gate plus route/API/orchestration authorization and current effective permission checks; direct API tests. | New routes can regress and require exact-head inventory/security review. |
| IDOR/BOLA | Object, owner, linked-child, Teacher/Staff and workflow scope checks server-side. | Complex future cross-module links require dedicated negative tests. |
| API scraping | Auth/session/endpoint budgets, bounded result sets, no-store, edge bot/rate policy. | Legitimate authenticated scraping may resemble normal use and needs baselines. |
| Public-form spam | Validation, honeypot, idempotency key, neutral response, bounded upload/body, strict policy and optional accessible challenge boundary. | Bot adaptation remains; challenge is not activated and no external cost is authorised. |
| Query amplification and N+1 | Pagination/date/result bounds, typed queries, route-specific caps, Search concurrency. | SQLite statement cancellation/timeout is limited; query plans need measurement after data growth. |
| Export exhaustion | 10,000-row domain caps, strict export policy, no-store/safe download, role permission. | Large authorised exports remain expensive and need production capacity measurement. |
| PDF/image CPU exhaustion | Image byte/dimension/pixel/format limits, decoder safeguards, two-worker/bounded queues, PDF idempotency and batch cap, 503 load shedding. | Crafted codec/library flaws and multi-instance scheduling require dependency review/distributed coordination. |
| Upload/decompression bombs | Streamed body cap, MIME/magic/container checks, pixel limits, private storage and symlink containment; bounded archive/restore validation. | Edge upload/read timeouts and current decoder advisories must be maintained. |
| AI request exhaustion | Exact role gate, per-user/request limits, bounded context/output, two active/two queued, provider timeout and circuit breaker, no external fallback. | Local model CPU/RAM capacity must be measured in private staging; provider stays disabled. |
| Synchronisation replay | Future policy placeholder plus required device/session identity, idempotency key, replay window and durable receipt. | Sync is not introduced; activating it without the protocol is prohibited. |
| DDoS Layer 3/4 | Origin-hiding blueprint and managed edge requirement. | Application code cannot absorb volumetric attacks; provider capacity is not guaranteed here. |
| HTTP flood Layer 7 | Edge WAF/bot/rate blueprint, central actor/endpoint/cost limits and load shedding. | Distributed low-and-slow traffic can still degrade service; staging baselines required. |
| Slow request attack | Edge header/body/idle timeouts, app streamed body caps and bounded queue wait. | Node does not replace connection-layer proxy controls. |
| Database connection exhaustion | Bounded expensive concurrency, result caps, transaction max-wait/timeout, load shedding. | Actual pool/statement limits depend on deployment engine; SQLite lacks per-statement timeout. |
| Provider-cost attack | Live/default-off flags, approval states, bounded retries, circuit breaker, no Smart AI external fallback, budget alerts blueprint. | Incorrect live-provider configuration can incur cost; activation is separately supervised. |
| Dependency/supply-chain compromise | Exact lockfile, lock policy, dependency audit, secret scan, exact-head CI and retained evidence. | Zero-day and registry/build-host compromise remain possible; continuous review required. |
| Insider privilege abuse | Least privilege, effective-access checks, append-only/auditable events, two-person operational procedures and evidence separation. | A fully privileged malicious operator remains a material residual risk. |
| Origin-IP discovery | No public origin, restricted firewall/tunnel, end-to-end TLS, authenticated proxy proof, DNS/certificate hygiene and rotation runbook. | Historical DNS/certificate/passive data may retain old origin knowledge. |

## Security invariants

- Authorization, privacy, Student/finance integrity, and committed-write semantics fail closed.
- No unbounded request body, parsed structure, result set, retry loop, CPU-heavy concurrency, or work queue is authorised.
- Capacity exhaustion returns controlled 429/503 with safe retry guidance and does not crash the process.
- Health and authentication safety remain available independently of expensive work where the edge/origin still has capacity.
- Forwarding headers have no authority without the configured authenticated edge proof and canonical host/protocol.
- No production multi-instance protection is claimed from an in-memory adapter.
- Operational database bytes and real backups are not modified or exported by security/load QA.
- Edge deployment remains `NOT ACTIVATED`; DDoS immunity is not claimed.

## OFFLINE-SYNC-1A extension — 2026-08-25

The earlier “Sync is not introduced” residual-risk entry is superseded for this default-off software foundation only. The new surface is restricted to encrypted Accountant drafts for fee payment, expense and miscellaneous income. The dedicated model in `docs/security/OFFLINE_SYNC_1A_THREAT_MODEL.md` is authoritative for device enrollment, PIN-derived key wrapping, IndexedDB encryption, reference minimization, signed proof/replay control, per-item idempotency, current authorization, conflict handling, PWA shell isolation, backup v45 exclusions with v44 restore compatibility, and activation blockers.

New trust boundaries are browser PIN to PBKDF2/wrapped content key; non-extractable ECDSA device key to server public-key registry; signed reference snapshot to current finance masters; and per-item sync transaction to existing finance services. Private authenticated HTML/APIs remain network-only in Cache Storage. Browser draft ciphertext is not part of server backup.

Residual risk remains high for an already unlocked stolen device, same-origin script compromise, weak PIN selection, privileged malicious approval and production SQLite contention. Therefore `offline-sync-1a` remains false at zero rollout; no device or workflow is operationally activated by the software release.
