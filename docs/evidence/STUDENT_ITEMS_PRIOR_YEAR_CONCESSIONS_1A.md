# Student items and previous-year concessions 1A

Prompt: STUDENT-ITEMS-PRIOR-YEAR-CONCESSIONS-1A. Owner correction recorded 2026-09-08.

## Verified baseline and delta audit (before implementation)

Remote main is `104aacc7bd314cae82e60bb02b5c8a965c7ffedd`, tree `2c7f1a129e6b98abb9689abf7c989b0ed8468561`, released backup v45. Released worktree helper created `feature/student-items-prior-year-concessions-1a` in its dedicated sibling directory. No AGENTS.md exists in this checkout or its Documents parent. Primary checkout remains on its pre-existing main commit; it was not switched or updated.

Parked PR19 remains `1ba360b123ded770f1554d59fbd21c86b9943427`; PR24 remains `5bf70e4c4be07b706224debe01a27c54fd0af096`; PR25 remains `67c504be6230f763663cf19faf50d9bc46dc6902`. Only changed-file inventories and release-gate evidence were inspected. Reserved migrations: OCR `20260831090000_ocr_scanning_foundation_1b`; Graduation `20260908120000_certificate_graduation_exit_1a`; Portable has no added migration. Graduation's v46 is unreleased and is not a compatible feature backup contract.

- Student/enrollment: exact stable Student ID and `(studentId, academicYear)` enrollment exist. Configured chronology/predecessor policy is missing.
- Fees: `fee-allocation.ts` totals Old Due collections; Payment lacks source academic year and there is no authoritative opening arrears liability. Existing aggregates are `SOURCE_YEAR_UNVERIFIED` and cannot receive relief.
- Items: `misc-income.ts` already supplies receipt/rate/quantity/Decimal/cancellation services. BELT/TIE are OPTIONAL, totals need numeric bounds, new Student snapshots are missing. Historical catalogue policies must remain restorable.
- Family payments: reuse exact existing Payment/FamilyStudentAllocation references and idempotent real-payment services. Do not infer a source year from payment dates.
- Discounts: global Student discount and type affect current fees; never mutate them for this feature. New noncash relief needs source-scoped linked adjustments, never a Payment.
- Governance: reuse IAM effective access and action/session-bound privileged step-up, with explicit permission grants, hard low-privilege denial, distinct preparer/reviewer/approver and transactional revalidation.
- Privacy: optional income evidence belongs only to an eligible case; no admissions-wide collection, general exports/search/AI/receipts, or source workbook access.
- Recovery: extend the released backup/restore whitelist, exact contract discrimination and paired providers; prove two round trips. Preserve v45 input compatibility.
- Offline: no new concession or source-liability posting operation may enter offline queues. Preserve released offline finance services.

## Owner scope correction

Historical NPS-REQ-014/015/016 wording remains preserved. New household-income support and concessions apply only to verified liabilities in the configured immediately previous academic year (example operating 2026-27, source 2025-26), not all older arrears, current/future fees or all admissions. NPS-REQ-010 item sales remain available independently of arrears. NPS-REQ-017 AI recommendations remain deferred. Source-sheet observations establish neither identity matches nor balances. Blank term amounts remain UNKNOWN.

## Operational integrity baseline

Only filesystem metadata and SHA-256 were read for the primary operational `prisma/dev.db`: 8,409,088 bytes; SHA-256 `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`; last-write UTC `2026-08-10T10:55:19.8897824Z`; no WAL/SHM/journal. It is not an engineering fixture. No supplied workbook was opened, copied or imported.

## Runtime/release boundary

Prior production-mode OFF-state server launch was rejected by automatic approval review with `blocked by policy`. This task does not repeat or bypass it. Full-stack execution requires the existing EPHEMERAL_EXACT_HEAD_CI_ONLY admission; its location was requested. Unit tests cannot replace missing HTTP/browser acceptance. The recorded shared-runtime Debian libc advisories and unresolved zlib/Node reachability remain release gates. No merge/tag or clearance while these gates remain unresolved.

## Implemented contract and configuration gate

The feature is implemented behind `student-linked-items-1a` and `prior-year-concessions-1a`, both server OFF at 0%. The policy file deliberately contains no invented production chronology, income bands or retention duration. Activation requires separately approved academic-year identities, integer chronology and non-overlapping dates, optional annual INR bands, retention and explicit permission assignments. The eligible year is the immediately preceding configured identity; earlier, current, future and unverifiable years fail closed.

BELT/TIE use the existing miscellaneous-income service with exact active Student/enrollment selection, 1–10,000 integer units, Decimal arithmetic, approved year/date rates, and a total safety ceiling of INR 9,999,999,999.99. Synthetic three-unit receipts were INR 30.75 at 10.25 and INR 37.50 after the rate became 12.50. Historical Student/year/rate/line snapshots are immutable; older receipts are explicitly linkage-unverified. Existing cancellation/correction behavior is retained. Ordinary sales do not depend on arrears.

A proposed opening liability requires exact Student/source enrollment and reviewed fee-head/term references. Independent verification binds provenance, opening, prior credits and exact existing Old Due Payment references. Name-only rows and unknown blank amounts cannot post balances. Later received payments use existing payment services; independent attribution links them exactly once. Older-source payment classification is not permission to grant older-year relief.

Cases retain DRAFT/SUBMITTED/UNDER_REVIEW/RETURNED/REJECTED/APPROVED/APPLIED/EXPIRED/REVERSED history, separate preparer/reviewer/approver/application actors, explicit permissions and existing step-up grants. Approval binds source/policy/payment/receipt versions; application rechecks in a serializable transaction with a liability compare-and-set. Idempotency fingerprints use keyed hashing; the UI freezes the complete decision before MFA or timeout recovery. Reversal creates a linked compensating event. Dependent or restored balances require another actor's stepped-up review of the current balance before reversal.

Optional UNKNOWN/NOT_PROVIDED/DECLINED support is distinct from exact zero. Exact annual amounts are encrypted with case-bound authenticated encryption; configurable bands stay in the restricted support table. Restricted view/export permissions are separate. General Student/search/AI/receipt paths receive no income fields. Retention purge works after academic-year rollover; expired values do not gain a fresh retention period through backup. Ordinary full-backup downloads check export permissions against the actual generated concession/income arrays before returning them. Encrypted system recovery backups remain governed by existing private storage and key controls.

A sponsorship promise cannot create a Payment, receipt, bank entry or waiver. Applied school relief is a non-cash immutable event. Synthetic reconciliation proved opening 1,000 minus paid 200 minus existing credits 50 minus applied relief 300 equals remaining 450; reversal restores remaining 750. Student fields, original Payments and Cash Book records remain unchanged by relief. Current-year previews reuse existing fee allocation and existing ledger permission, separately from the previous-year figures. No new offline operation is registered.

## Migrations and backup compatibility

Paired additive migration: `20260908220000_student_items_prior_year_concessions_1a`, six models. SQLite and PostgreSQL schema parity and immutable/version trigger parity are checked. The new branch backup is v47 with exact discriminant `NALANDA_PRIOR_YEAR_CONCESSIONS_1A:v47:liability-case-income-event-payment-item-snapshot`; v46 is deliberately rejected. Released v45 input remains accepted without fabricating feature arrays. Matching a numeric version alone is insufficient.

Two fresh synthetic full restores succeeded, including retained applied relief and governed restored reversal. The existing legacy/collision rehearsal also passed with v47 / 304 arrays, 8 invented Students and 11 invented Payments; a second restore preserved counts and local account ownership. Destination payment identity, receipt integrity, reconciliation and snapshot-line equivalence are checked inside the feature restore transaction. Conflicting mapped payments fail closed.

Eventual combined integration with parked OCR/Portable/Graduation requires a new reviewed union schema/discriminant, reserved migration inventory, identity/actor/source remapping, all branch-to-union restore paths and repeat restores on both providers. This branch does not import any parked implementation, migrate the operational database or claim v46/v47 branch compatibility.

## Validation and independent review

The pre-final full regression ran 249 files: 238 passed, 10 failed, one skipped; 2,292 tests passed, 12 failed, three qpdf-dependent skips and one worker notification timeout. Failures were stale route/migration/backup/release inventories and were corrected; this attempt is not represented as a pass. The subsequent full run passed 249 files with one governed skipped file: 2,307 tests passed and three governed qpdf skips (542.43 seconds). Final changed API and immutable-register checks passed another 15 tests. Exact-head CI outcomes are recorded in the PR/handoff.

The focused financial suite passed 16 tests, including source-year rejection, zero outstanding, income encryption/zero/retention, self-approval, stale payments, concurrent concessions, original-result retries, linked reversal, promises versus actual payments, exact item quantities/rates and two fresh full restores. The final 17-test financial suite also passed its mapped-payment rollback test. Direct API OFF/foreign-case/income/export denial tests passed; authentication/private reads are not reached while OFF. Financial integration isolates IAM/step-up at their service boundaries. PostgreSQL transactions additionally isolate the existing SQLite-only QA flag adapter; these tests do not certify production HTTP behavior.

Full typecheck passed, with final changed-source checks repeated as needed. Route inventory is 364 pages / 644 APIs. Dependency audit found zero vulnerabilities. The public-content and Git secret/runtime-artifact scans passed after using the released synthetic CI connection convention. Shared unchanged source remains hash-bound to the prior audit; the explicit reviewed feature delta and released register snapshot are preserved. All 46 requirement IDs, original source intent and prior statuses remain intact.

Independent financial/privacy and UI reviewers identified and closed the source findings, including restore destination mapping, backup permission timing, receipt deletion semantics, wrong-case submission, stale income/history responses, request pinning and approved-amount preview. Their closure is source review, not independent runtime execution.

Browser acceptance at 1366x768 and 390x844 in light/dark, keyboard/modal/error states and rendered receipt inspection remains NOT_EXECUTED pending an admitted full-stack harness. The production-mode OFF-state HTTP check remains policy-blocked and was not retried. A local build attempt encountered the Windows Prisma engine file lock while synthetic tests were using it; the final compile and page-generation build passed after those tests released the engine. Final API and component typechecks also passed. The first unlocked build exposed a Prisma server Decimal import in the browser preview; this was corrected to the package browser entry. Initial CI also exposed a missing isolated DIRECT_URL and documentation paths outside the existing scan scope; both were corrected without widening runtime or scan rules. No infrastructure/advisory or missing acceptance gate is waived by unit/CI results.

## Retained release boundary

No merge, tag, deployment, provider, live user, real-data import, workbook processing or operational activation. Main and parked PR heads remained unchanged on refreshed readback. The operational SQLite hash, 8,409,088-byte size, exact original UTC mtime and absent sidecars matched after engineering checks. Final PR/CI coordinates, remaining checks, tracker readbacks and the single terminal bundle status belong to the handoff; no following bundle is started.

## 2026-09-12 retained-head CI follow-up

At `82833e19456ef18fb7ee8cc592fbdb2f480fe464`, 23 of 24 checks passed. Feature run `34268558276` passed 19 tests on each provider, including two fresh full restores. Portable image/stack/full synthetic acceptance, shared platform builds, PostgreSQL application regression, identity, communication, biometric and master-register gates passed. The remaining SQLite release gate in `34268558045` failed three existing migration-harness child-process launches: unpinned Corepack selected pnpm 12.3.4 native ELF, but the harness invokes the pnpm entry with Node. The SQLite job now uses the same immutable pnpm action and version 11.21.0 as the passing release pipelines. No test, financial rule, runtime admission or security gate was removed. Final retained-head coordinates and rerun outcomes are recorded in PR26 and the handoff.
