# OFFLINE-SYNC-1A QA and Release Evidence

Status: `LOCAL_GATES_GREEN_RELEASE_PENDING`. This record becomes `SOFTWARE_CLEARED_OPERATIONAL_ACTIVATION_OFF` only after exact-head GitHub CI, normal merge, annotated tag and tracker readback are complete.

## Scope and immutable boundaries

- Dedicated branch/worktree: `feature/offline-sync-1a` / `offline-sync-1a`.
- Authorised base: `945f3665f507f5b381968c14282fccbd28afd21a`.
- Feature flag: `offline-sync-1a`, production default `false`, rollout `0%`.
- Operational database: read-only. All dynamic finance/device/browser/migration/restore work used synthetic or copied databases.
- Phase 1 supports only fee-payment intake, expense-entry and miscellaneous-income drafts. An offline draft is never an official transaction or receipt.
- No deployment, real device enrolment, real-user creation, real-data offline storage, provider activation or native-app release is included.

## Local verification evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| Focused contracts | PASS | 23 OFFLINE-SYNC-1A contracts plus one executable cross-tab storage-fallback test passed. The fallback test removes `BroadcastChannel`, performs logout in one fake tab and proves the second tab receives `LOGOUT`, discards its vault key and observes the lock event through `localStorage`. |
| Copied DB | PASS | 79 accepted, 3 conflicts, 1 rejected and 84 safe events. A 75-mutation bounded load completed in 2,669 ms. Same-ID replay returned the original result; changed-hash reuse was rejected; concurrency produced no duplicate authoritative writes. |
| Challenge and historical-dues corrections | PASS | Expired challenges were purged and exact expiry was persisted. An offline `Old Due` attempt was rejected with zero Payment writes; the online payment path remains unchanged. |
| Operational DB integrity | PASS | SHA-256 remained `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA` before and after copied-DB, Browser, load, migration, backup and cleanup work. |
| Routes | PASS | `pnpm.cmd routes:list`: 353 page routes and 600 API routes. |
| Lifecycle | PASS | `pnpm.cmd lifecycle:backfill`: dry run, no operational changes. |
| Typecheck | PASS | All application, component, library, QA-tool and test TypeScript projects passed. |
| Full regression | PASS | 230 test files passed, 1 file intentionally skipped; 2,134 tests passed and 3 qpdf-dependent tests were skipped because qpdf is unavailable in this environment. Total: 2,137 tests. No skip is counted as a pass. |
| Production build | PASS | Compilation and static generation passed; 316/316 static pages generated. |
| Backup | PASS | Backup version 44 generated. Durable device public metadata, mutation hashes/results, safe events and conflict reviews are included; private keys, PIN material, wrapped browser keys, challenges, nonces and local drafts are excluded. |
| Git safety | PASS | `pnpm.cmd git:safety-check` and `git diff --check` passed after fixture naming was corrected. |
| Dependency and secret checks | PASS | `pnpm audit --audit-level high` reported no known vulnerabilities. Repository secret/config checks found no private key, PIN, cookie, provider secret, operational DB or real-data fixture. No new runtime dependency was added. |

## Migration, schema and recovery

- Fresh migration: 23 migrations, 326 Prisma models and 326 tables; synthetic bootstrap passed. Fingerprint: `FF8F4...EE11`.
- Existing copied-main upgrade: two passes preserved all 326 models/tables and produced digest `23F7...1ECD`.
- Schema equivalence: 326 models, 326 tables, 1,605 indexes and 562 foreign keys.
- Restore: backup version 44 with 273 arrays, 8 Students and 11 Payments restored twice idempotently. Device revocation, accepted-mutation replay and conflict history were preserved.

## Browser and PWA evidence

- Approved Browser control covered 1366x768 and exact 390x844 layouts in light and dark themes, keyboard/focus/status behavior, dialogs and responsive tables without private-data flash or horizontal overflow.
- The synthetic lifecycle covered request, named-Accountant approval, PIN setup, reference refresh, all three draft forms, encrypted queue/sync, accepted result, conflict, rejection, revocation and fail-closed feature-off behavior.
- The corrected approval table and confirmation explicitly showed `OFFLINE-SYNC-1A ACCOUNTANT` and the physical device label before approval.
- The refreshed fee reference controls contained only `Current Year Fee`; neither fee type nor term controls exposed `Old Due`.
- Two unlocked live ERP tabs were tested. Logout in the first immediately changed the second to `Encrypted offline vault locked across all ERP tabs`, removed the decrypted draft editor and required the PIN again.
- A separate executable test removed `BroadcastChannel` and proved the same logout lock through the storage-event fallback.
- Production-runtime Browser QA previously loaded the dedicated cached finance shell with the server stopped. After deliberate logout cache clearing, the safe no-record fallback displayed only the generic offline message; no private response, API data or decrypted draft entered Cache Storage.
- Browser fixtures, copied database, synthetic runtime roots and tabs were removed; no listener remained on port 3256.

## Security and resilience

- Codex Security scan `68b91560-5da7-4e09-ba19-656c91aaa041` found 2 Medium and 3 Low issues; all were remediated.
- Follow-up scan `7c597952-6a8b-46c6-a646-7b4fdd10f2fa` found 4 Low issues: conflict query scope, approval-owner visibility, expired-challenge retention and unbounded offline historical dues. All were remediated and regression-tested.
- Clean review `41976ff6-b1b6-4ab7-8bd5-5e157444a106` reviewed 80/80 changed files and reported zero candidates/findings. The final post-evidence scan ID and final 0-finding result are recorded in the release section below.
- Security Resilience acceptance passed 46 tests. Local saturation sent 149 requests: 98 accepted, 51 controlled `429`, 4 controlled `503`, and recovery succeeded without operational DB mutation.
- Search Extension acceptance remained green: safe-metadata coverage passed, p95 was 58.18 ms and maximum was 67.92 ms. Offline drafts are not Search or Smart AI sources.

## Release evidence

| Item | Result |
| --- | --- |
| Implementation candidate SHA | `TO_BE_RECORDED_AFTER_SCOPED_COMMIT` |
| Final feature/PR head | `TO_BE_RECORDED_AFTER_EXACT_HEAD_CI` |
| PR | `TO_BE_RECORDED_AFTER_CREATION` |
| Exact-head CI | `TO_BE_RECORDED_AFTER_RUNNER_EXECUTION` |
| Merge/main SHA | `TO_BE_RECORDED_AFTER_NORMAL_MERGE` |
| Annotated tag | `TO_BE_RECORDED_AFTER_MERGE` |
| Final security scan | `7f701a12-8149-442b-8f0f-fe3149a96085`; 80/80 changed source files reviewed, zero candidates/findings, complete snapshot digest `a5af31deeee80923163c5a9cdf243d8d939c129136133d33561d67225b334d3f` |
| Notion readback | `TO_BE_RECORDED_AFTER_TERMINAL_VERDICT` |
| Canvs readback | `TO_BE_RECORDED_AFTER_TERMINAL_VERDICT` |

The immutable PR head, CI run, merge SHA and tag are also repeated in the final handoff. A commit cannot literally contain its own SHA, so this repository record captures the preceding implementation candidate and the externally verifiable final head/tag evidence without rewriting history.

## Activation exclusions

Software clearance leaves the flag off at zero rollout. Real activation still requires private HTTPS staging, managed-device/browser policy, named approvers and support ownership, trained PIN/revocation procedures, distributed abuse controls for multi-instance deployment, monitoring/alerts, backup v44 rehearsal, physical-device certification and a separately approved cohort. Windows, Android and iOS applications remain the next separate phase and must reuse the same protocol.
