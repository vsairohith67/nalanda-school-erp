# CERTIFICATE-CONFIRMATION-INTEGRATION-1A

2026-10-03 IST. In progress; no release clearance.

## Ownership and immutable source

The prior primary writer (backend vendor/Node remediation) completed its terminal
handoff. Its chat is not active. Recovery coordinator and product-caller ownership
check are idle. Active backend, K30 and mobile-accessibility workers retain separate
worktrees. This task is the sole primary implementation writer; four project workers
are active at reservation, so independent review is queued until capacity exists.
No task was interrupted. No implementation agent is added.

Primary starting SHA `2aa461b7e0388db6b79afe1e4421a5dc1d9e8dda`, tree
`16004fe31ae0ad8a21dcf861430859250fc1be27`; local branch, remote branch and OPEN/DRAFT
PR28 agreed. Empty starting index. Only initial difference: 29 added ledger lines.
The full original ledger is privately preserved: 418891 bytes, 1606 lines,
SHA256 `0fa923f99b9b87d97bd96ec5c333d01dcc4b7192beab35ea0e60771221212be8`.
No operational database/vault was read, copied or fingerprinted. Historical evidence
is retained as historical, without refreshing its operational fingerprints.
No applicable AGENTS.md was found in the worktree or its ancestor directories.
Local Codex configuration names `gpt-6-astra` / `high`; no running model switch or
independent execution-model attestation is claimed.

Source `ef00677315cbf38d8f3293d7ae41396b2e1c8faa` was read through the local Git
object database, including its parent (the exact starting primary) and all blobs.
The correction was absent from current source. Its entire three-file diff is the
intended self-contained fix; applied with `git cherry-pick --no-commit -x` to retain
one reviewed final integration commit/push. The commit message records attribution.
No current companion working/index bytes were copied. Backend preparation
`c67c146adbac066e12ce29d1e8dec90410a384e3` and later companion work are excluded.

| Source path | Old Git blob | New Git blob |
| --- | --- | --- |
| `components/certificate-forms.tsx` | `2fdc51444cbaa46ab2ed241571f8ee9cedec3df9` | `dfc2cc0fef0af766d4530ee37294978195c0f14e` |
| `config/recovery-integration-source-delta.json` | `6cb35a4512ba0ded978d4cf745dc754467b79555` | `49e5264199be1e863e49572252ebfc83c2e30c11` |
| `tests/portable-certificate-modal.test.ts` | `6a36afa70794927230eb376bd8ffc57dc4f1328a` | `c2b8546b76162546e47d0de0521b1aa5a3f4b293` |

Both components are in `components/certificate-forms.tsx`:
`CertificateRequestActions` and `CertificateWorkflowActions`. The added effect
input is the certificate request/issued-or-draft record `id`, not authenticated
user identity. Existing status and updatedAt invalidation stays intact. No server,
fee, audit, authorization, issuance, document, schema, migration or flag code changes.
The existing manifest retains all entries/source hashes; only the certificate
component current hash changes to the immutable source value.

Reserved paths: the above three source-commit paths,
`tests/portable-certificate-context.test.ts`, this handoff, and the existing
`docs/evidence/RELEASE_RECOVERY_1C.md`. No other source/configuration reservation.

## Finite focused matrix and layers

1. Original two record-switch regressions on an owned archive of committed primary,
with only the immutable source test blob supplied. Both fail on the expected reset
assertion (zero calls), not setup. Four unrelated tests filtered out. 4.421 seconds,
exit 1. Console forwarding hit a Windows Unicode encoding exception after the
runner log/exit metadata had been preserved; original Vitest log is intact.
2. Integrated unit/contract and route-handler tests: 10 files, 153 tests PASS,
15.312 seconds. Includes the original two cases and 10 new handler/hook cases for
same-context success, fresh current-target action, close/version/status reset, and
success/refusal responses after rapid A/B/C switches. No arbitrary waits or timeout
changes. The hook harness executes real component handlers but is not a DOM renderer.
3. Existing isolated certificate service test: 1 file/1 scenario PASS, 10.312 seconds.
Fresh SQLite fixture from unchanged migrations, actual Prisma/service workflow,
separate actors, refusal/positive controls, retry idempotency, issued document
inspection/reissue/void. Its test-owned database was removed by the existing cleanup.
Auth/MFA preparation is stubbed; no login, ERP server or runtime admission occurred.
4. Components TypeScript PASS (42.656 seconds). Tests-m-r initially rejected a
zero-argument deferred-fetch mock signature (TS2493); corrected only its explicit
argument types. Its 10 cases reran PASS (0.891 seconds), final tests-m-r PASS
(10.203 seconds). Initial diagnostic retained, no assertion or timeout weakened.
Source provenance PASS: 281 paths, 4 source heads, 4 backup contracts. Both existing
publication scans PASS: 479 changed paths, zero detected secrets/binaries/real
contacts. Git candidate/staged/tracked safety and diff checks PASS.
5. Independent read-only source review COMPLETE: no material actionable finding.
Normal exact-candidate CI is pending the single reviewed push.

Unit suite: portable-certificate-modal, portable-certificate-context,
import-action-state, bulk-data-exchange-ux-1a, student-certificates,
student-certificates-security-backup, certificate-graduation-exit-1a,
certificate-http-privacy, portable-certificate-browser, portable-publication-1c.
The existing Parent linked/unlinked controls and issued-record edit denials are
unit/service contracts; do not promote them to authenticated browser acceptance.

Private raw logs/command metadata, original evidence bytes and disposable baseline
are in the owned ignored task root. The baseline reads installed runner packages
without dependency/client generation; writable baseline cache is unique. Primary
Prisma dependencies are owned by this exclusive worktree; no generated client,
.env, browser profile or database is shared with another worker. TMP/TEMP and all
explicit DATABASE_URL/DIRECT_URL values point to newly owned synthetic paths.

## Preserved boundaries

Runtime/authenticated browser/device acceptance NOT_EXECUTED. PR28 remains
OPEN/DRAFT. No manual scan/dispatch/retry, actual ERP image build, main merge, tag,
installation or deployment. Backend product caller stays unactivated. Four native
warnings, residual base-scan findings, missing Node applicability/trust evidence,
controller/host inputs and EXTERNAL_RUNTIME_BLOCKED remain independent. No change
to main/PR29/PR30, backend/K30/W1/P1 ownership/cards, FA1-FA4, schema/migrations/v48,
requirement history, OFF flags, NALANDA PUBLIC SCHOOL Georgia Bold or geometry.

Links: [source receipt](https://github.com/vsairohith67/nalanda-school-erp/pull/28#issuecomment-5958361697),
[approved plan](https://github.com/vsairohith67/nalanda-school-erp/pull/28#issuecomment-5960042903).

## Normal CI plan inspected before push

All 11 workflow YAML files parse. Nine have applicable normal PR triggers against
the complete PR28 diff; no manual dispatch is needed. The declared matrix expands
to 43 combinations, but GitHub evaluates the false OCI gate before its matrix and
reports one skipped OCI job instead of two; expected displayed jobs are 42.
Six portable runtime job definitions remain held through the unchanged false
OCI-image dependency chain. The independent native producer is separately
conditional. The two normal base-input architecture scans remain enabled under
the existing PR28-only condition; known policy findings must remain failures.
No workflow, backend caller, scanner policy or trust registration is edited.
The full matrix and trigger inventory are retained privately for reconciliation
against actual run/job records. No historical run is current-head validation.

## Cleanup boundary

The existing service fixture removed its freshly created database. After tests
settled, automatic approval review rejected the bounded task-owned baseline/cache
cleanup with "blocked by policy". The command did not execute; no alternate wrapper
or retry. The baseline archive/directory, two typecheck caches and owned synthetic
TMP/cache directories are retained as policy-denied residue. Original evidence and
logs remain private. Historical/ambiguous resources were never selected.

## Independent review

One reviewer was started only after the mobile task completed and released a slot;
the other two tasks had received their review findings. GPT-6 Astra was requested
through the available agent tool; no independent underlying-model attestation is
provided. No model switch or independent execution evidence is claimed.
Reviewer confirmed exact source/index blob equality, component hash, untouched
other registrations, absence of backend contamination, unchanged-context/current
record targeting, reset effects and validity of the ten new hook/handler cases.
It read original red/green logs, final typecheck metadata and the prior-ledger hash
and exact byte-prefix preservation. No material actionable finding; no tests,
builds, writes, operational-data reads or cleanup executed by the reviewer.

Review limits: delayed-response cases establish that old confirmation is not
restored in the tested sequence; they are not universal isolation of every
outstanding response from newly opened UI. Existing correction/reissue/cancel
routes do not consume the submitted expectedUpdatedAt. That behavior is unchanged;
this correction does not establish client-version enforcement on every action.
Unchanged server permissions, target validation, Parent ownership/projection,
issued-record immutability and idempotency remain separate from UI confirmation.
The planned workflow counts remain a plan until actual current-candidate CI ends.
