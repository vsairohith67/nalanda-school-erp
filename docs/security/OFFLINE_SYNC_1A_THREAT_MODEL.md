# OFFLINE-SYNC-1A Threat Model

## System and scope

The system is a browser PWA shell, an app-owned encrypted IndexedDB vault, a device public-key registry, privacy-minimal reference packs, a signed synchronization API, existing finance services, durable idempotency/audit tables and governed device/conflict UI. The feature is default-off and synthetic copied-database QA is the only permitted activation in this release.

Out of scope are operating-system compromise, browser-engine zero-days, a malicious user who knows the offline PIN and controls the approved device, recovery of forgotten local PINs, background sync, native apps, third-party providers and production deployment.

## Assets and security objectives

Assets are draft finance content; Student identity and due summaries; device private keys; wrapped content keys and PIN-derived material; session/role/permission state; official receipts and expense/income integrity; idempotency results; public device keys; audit/conflict evidence; and operational database availability.

Objectives are confidentiality at rest, user/device separation, authenticity and freshness of sync, exactly-once official creation, current server authority, least privilege, revocation on the next request, bounded resource use, recoverable durable evidence and zero cache leakage.

## Actors

- a legitimate Accountant using an approved or unapproved device;
- a Super Admin device approver;
- Director/Principal conflict reviewers;
- a thief with browser profile files but no PIN;
- a thief with an unlocked tab;
- a compromised authenticated non-Accountant account;
- an insider attempting cross-user/device access or duplicate finance creation;
- a network replay/tampering attacker;
- a malicious or corrupted client generating stale, oversized, malformed or conflicting batches;
- malware or a browser exploit with same-origin execution; and
- an availability attacker issuing expensive reference/sync requests.

## Trust boundaries and data flows

1. Human PIN input to PBKDF2 and in-memory content key.
2. Browser UI to encrypted IndexedDB records.
3. Browser Web Crypto private key to signed request headers.
4. Service worker static shell to authenticated network-only APIs.
5. Session cookie plus device proof to middleware and route handlers.
6. Route handler to durable nonce/device/idempotency tables.
7. Reference snapshot claims to current server master validation.
8. Per-item transaction to existing Payment, Expense and Miscellaneous Income services.
9. Operational database to backup v45 and an isolated restore target, retaining v44 restore compatibility.

The service worker may cache only the generic shell and dedicated finance shell plus approved public/static assets. It never caches authenticated HTML, APIs, reference packs, drafts, receipts, backups or exports.

## Threat scenarios, controls and residual risk

| Scenario | Preventive/detective controls | Residual risk and gate |
| --- | --- | --- |
| Stolen browser storage is read directly | AES-256-GCM, PBKDF2 310k, random salt, wrapped random content key, unique IV, scope-bound AAD, no plaintext sensitive indexes | Weak user PINs remain guessable with sufficient offline resources. Production activation needs PIN training and supported-browser performance measurement. |
| Approved unlocked device is stolen | Explicit Lock/logout key discard, device revocation, server proof on every request, no background sync | Data visible in an already unlocked tab can be stolen until locked/revoked. Device handling is an operational control. |
| Device identity is cloned | Non-extractable browser private key; server stores public JWK only; challenge proof for enrollment and rotation | Browser malware/same-origin code can use a live key without extracting it. CSP, dependency controls and endpoint hygiene remain required. |
| Registration spam or rogue approval | Authenticated Accountant permission, proof of new key, pending state, max-device cap, Super Admin-only approval and safe event log | A malicious Super Admin can approve a rogue device; governance/audit review remains necessary. |
| Revoked device continues syncing | Device status and key version are reread for signed request and again inside every item transaction | Requests already committed before revocation remain valid evidence and are not rolled back. |
| Request replay | Five-minute timestamp, 192-bit nonce, body hash, path/method binding, durable unique hashed nonce, idempotency ledger | Clock skew can deny legitimate work; UI must present time-correction guidance without widening the replay window. |
| Body/signature substitution | Exact raw-body SHA-256 in canonical signature; schema and key version binding | Compromised same-origin code can sign its own body while the tab is unlocked. Server domain validation limits impact. |
| Duplicate official finance creation | Unique `(deviceId, clientMutationId)`, stable payload hash, per-item serializable transaction, stored original safe result, DB uniqueness and concurrency tests | A user can intentionally create two different mutation IDs; current domain rules, audit and human reconciliation still apply. |
| Idempotency-key poisoning | Different hash under the same key is rejected and audited; no replacement result is written | A malicious local client can block its own ID. It cannot overwrite the original official result. |
| Stale reference accepts wrong amount/master | 24h warning/72h hard expiry, HMAC actor/device scope, current Student/master/rate/due checks, base Student version, authoritative service | A legitimate change not represented by an entity version may become a conflict through service validation rather than an early comparison. |
| Cross-user or cross-device IDOR | Session user must own device; snapshot/cursor bound to user/device; local AAD bound to user/device; management and review permissions separated | A fully privileged database administrator remains outside application enforcement. |
| Non-Accountant obtains delegated permission | Runtime exact role allowlist plus permission checks in route and item transaction; immutable Computer Operator denial; unknown roles deny | Super Admin itself retains use authority for recovery/QA; its activity is audited. |
| Offline data leaks via PWA cache | Static-shell-only cache; APIs/private HTML rejected; no-store responses; IndexedDB ciphertext is separate from Cache Storage | A future service-worker edit could regress. PWA contract tests and Browser cache inspection are release gates. |
| Reference pack over-collects | Explicit field-level select, row caps, no contacts/IDs/notes/documents/photos/marks/attendance/payroll | Student name/admission/class and due are still personal data; approved device/PIN/retention rules remain mandatory. |
| XSS steals decrypted drafts | React text rendering, CSP, no raw HTML, bounded fields, no draft content in logs/events | Any future same-origin script injection is high impact while unlocked. Security diff scan and dependency audit are required per release. |
| PIN brute force | PBKDF2 cost, local verifier, escalating delays and reset guidance | Local attempt counters are attacker-modifiable. Cryptographic work factor—not UI delay—is the core storage control. |
| Key/IV reuse | New random CEK per vault and 96-bit random IV per record; GCM AAD | Random failure/collision is extremely unlikely; browser entropy quality is trusted. |
| Lost PIN/data corruption | Explicit app-owned DB reset only; no server recovery of drafts; official accepted server results remain authoritative | Unsynced work is unrecoverable by design. UX must communicate this before reset. |
| Batch/resource abuse | 512 KiB streamed cap, 25 items, bounded strings/objects, device/session/endpoint rate limit, sequential per-item handling, query caps | SQLite contention can still cause `RETRY_LATER`; production capacity baseline is required before activation. |
| Conflict reviewer force-applies stale data | Review records safe resolution only; no endpoint converts conflict into a finance write | A reviewer must ask the Accountant to revise/requeue where appropriate. |
| Backup leaks local secrets | Only public keys and safe/hashes are durable; challenges/nonces/local vault excluded; validator rejects unknown fields | Public keys and actor/device metadata remain sensitive governance data and must stay in encrypted backup containers. |

## Abuse cases and explicit denials

- A Teacher, Parent, Student, Admin, Viewer, Gate Staff, Computer Operator or unknown/custom role calls any offline endpoint: deny.
- A Director or Principal attempts device approval or sync: deny; conflict review only.
- A pending, revoked, retired, wrong-owner or wrong-key-version device signs correctly: deny.
- A request is replayed with the same nonce, a changed path, body or timestamp: deny.
- A batch carries 26 items, unsupported schema, unsupported operation, non-object payload, duplicate ID in one batch or incorrect payload hash: reject.
- A stale Student, inactive master, changed rate, overpayment or hard-expired snapshot reaches sync: conflict; no official write.
- Two tabs sync the same outbox: Web Lock or expiring IndexedDB lease coordinates locally; server idempotency remains authoritative.
- Browser connectivity events fire: show a hint only; never auto-submit.

## Launch blockers and operational prerequisites

Production activation is prohibited until: managed-device/browser policy is approved; HTTPS/HSTS and trusted ingress are live; distributed rate limiting is configured for multi-instance deployment; device approval/revocation ownership and support procedures are trained; clock-skew support is documented; PIN strength/usability is measured; telemetry alerts cover repeated proof failures, nonce replay, idempotency misuse, conflicts and revocation; backup v45 restore is rehearsed with v44 compatibility retained; and an explicit activation change sets a governed non-zero rollout. This release satisfies none of those operational activation decisions.

## Verification map

- Unit/contract: crypto/AAD, signature canonicalization, permissions, feature off, batch bounds, idempotency source boundary, PWA cache, migration constraints and backup exclusions.
- Copied DB: additive/idempotent migration, three authoritative operations, stale conflict, revoked device, duplicate hash, changed-hash rejection, 12-way concurrency, 75-item representative load, backup/restore twice and operational hash.
- Browser: registration/pending/approval, setup/unlock/lock/reset, each draft type, offline reload, stale/conflict, duplicate sync, revoked next request, two-tab coordination, responsive light/dark and cache inspection.
- Security: Codex security diff scan plus manual inspection for authorization, IDOR, cache leakage, XSS, replay, body limits, secret/log leakage and dependency advisories.
