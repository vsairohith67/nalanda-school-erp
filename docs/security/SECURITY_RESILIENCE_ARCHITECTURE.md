# Security Resilience Architecture

Status: software foundation only. Edge deployment is not activated and no DDoS guarantee is claimed.

## Security objectives

Nalanda ERP uses defence in depth, fail-closed authorization, bounded resource use, controlled degradation, privacy-safe incident evidence, and recoverable operations. It must never be described as unhackable, impossible to attack, immune to every DDoS, or 100% secure.

## Central policy layer

`lib/security-resilience.ts` is the typed governance point for operation cost, endpoint policy, actor dimensions, and rate-limit storage. Policies are specific to login, recovery, OTP, public Admissions, public Support, uploads, imports, exports, PDFs, Event Media, Universal Search, Smart AI, and future sync. Health is deliberately outside expensive-work limiting.

Actor dimensions supported by the contract are IP, authenticated account, active role, session, device, endpoint, and operation cost. A route uses only identity proven at its trust boundary. Missing identity never causes arbitrary forwarding headers to become trusted.

The adapters have deliberately different claims:

- `local-deterministic`: test-only, deterministic time supplied by the caller.
- `single-process`: development and explicit isolated loopback rehearsal only; bounded memory, but resets on restart and cannot coordinate multiple processes or VPS instances.
- `distributed`: provider-neutral contract requiring atomic multi-key consumption. Staging/production fail with controlled 503 for governed endpoints until a real distributed adapter is registered.

No in-memory component is claimed to protect multiple instances.

## Operation cost and capacity

| Cost | Typical work | Capacity treatment |
| --- | --- | --- |
| LOW | Small authenticated reads and health | Preserve whenever possible; bounded query results still apply. |
| MEDIUM | Login verification, bounded reports, public intake, Search | Actor and endpoint budgets; controlled 429. |
| HIGH | Imports, exports, PDFs, image processing, Smart AI | Strict budgets plus bounded concurrency/queue; controlled 429 or 503. |
| VERY_HIGH | Backup generation, restore rehearsal, recovery | Operator-only, offline/disposable environment, no public request queue. |

Cost is internal policy metadata. Unauthorised responses receive only safe retry information, never internal scoring details.

## Resource budgets

Server-wide streamed request limits remain in middleware, with stricter path limits for authentication, Admissions, Support, Search/AI, PDF requests, imports, OCR, payslips, and Event Media. Parsed JSON is also bounded by depth, node count, object keys, array length, and string length. Query pagination is limited to 250 and paired date ranges to 366 days.

Existing domain limits remain authoritative where stricter: Payment import 2,000 rows; report/export families 10,000 rows; report publication 60 reports; Event Media 15 MiB, 12,000 pixels per dimension and 40 million input pixels; Smart AI request/context/output/provider-response bounds; provider timeouts; webhook and retry caps.

Prisma interactive transactions now use a 2 second acquisition wait and 10 second transaction timeout. SQLite has no supported per-statement timeout or read/write replica topology in this repository, so neither is claimed. Deployment must retain bounded process counts and database connection settings appropriate to the selected database engine.

## Load shedding and recovery

`lib/resource-guard.ts` supplies bounded semaphores for Search, Smart AI, Event Media image work, and PDF admission. Full queues or bounded wait expiry reject new work with a safe 503 and `Retry-After`; committed writes are not silently dropped. PDF processing keeps its two-worker cap and now has a bounded 16-item waiting queue. Smart AI provider failure opens a bounded circuit breaker; there is no external fallback.

Authentication and content-free health paths do not enter CPU-heavy semaphores. The maintenance path remains available for governed under-attack operation.

## Idempotency and write integrity

- PDF generation requires a request key and reuses the same manifest; conflicting reuse is rejected.
- public Admissions enquiries use a caller request key and unique/idempotent database handling.
- public Support uses a submission key and neutral handling; attachments are rolled back when the submission is neutralised or fails.
- payment import rechecks exact duplicates inside its transaction and caps rows.
- notification/provider workers retain durable delivery/reconciliation states rather than blind retry.
- future sync mutations must require authenticated device/session identity, mutation idempotency keys, replay windows, and durable server receipts before activation.

## Observability boundary

Privacy-safe events cover rate-limit hits, authentication abuse, queue saturation, timeout, circuit state, excessive import/export, blocked upload, authorization denial, provider unavailability, and edge/origin mismatch. Metadata is allowlisted and control characters are neutralised. Passwords, tokens, request bodies, Student records, AI prompts/context, and private notes are prohibited.

## Residual risks and deployment gates

Volumetric Layer 3/4 attacks cannot be absorbed by application code. A managed edge, authenticated tunnel/restricted origin, distributed rate-limit store, provider-specific WAF validation, private staging exercise, immutable log destination, and measured production database pool configuration remain operational gates. This phase does not purchase, provision, expose, import, activate, or deploy anything.
