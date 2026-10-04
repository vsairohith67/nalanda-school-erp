# ASK-NALANDA-ATTENDANCE-EVIDENCE-1B

**ASK_NALANDA_ATTENDANCE_EVIDENCE_IMPLEMENTED_VALIDATED_LOCAL** — LOCAL / UNMERGED, 3 October 2026. This is scoped product implementation evidence, not integration, runtime admission or release clearance.

## Immutable source and ownership

- Worktree: `C:/Users/rohit/Documents/school-software-worktrees/intelligent-reports-attendance-evidence-1b`.
- Branch: `feature/intelligent-reports-attendance-evidence-1b`.
- Approved repository helper created from `104aacc7bd314cae82e60bb02b5c8a965c7ffedd`; clean ownership and ancestry were proved before the explicitly permitted task-local fast-forward.
- Task base: `5a3e21904f44815af5f8d2b8d41a7d75bab2343b`; tree `12cd4d12665eb22fc689530370a9abb7ed67f4cb`.
- Final implementation: `1b78c1f9035307dca56f943984219c47a719f323`; tree `461dd45412f9bcf92967640624c2bbea0a43ce26`. The following commit adds only this handoff; obtain its self-identifying tip/tree with `git show -s --format="%H %T" HEAD`.
- PR29 remains OPEN/DRAFT at the original pinned head; its original branch/worktree were not changed. No source from the active recovery/mobile/K30 worktrees was copied or edited.
- Repository-helper management is verified. Desktop attachment refused this checkout as not app-managed; no second worktree was created.

## Delivered connection and acceptance

| Capability | Actual implementation and evidence |
| --- | --- |
| Attendance explanation | Existing source route → `executeSource` → authorized Serializable report transaction → shared `attendanceRows` decision loop, collecting dates for only the selected opaque row → actual workspace dialog/`AttendanceEvidenceView`. Safe identity, selected scope/year/range, criterion, full numerator/denominator, official percentage or unresolved/no-eligible state and chronological evidence. |
| Missing-data/policy explanations | One disjoint coverage bucket per date plus separately overlapping diagnostics. Missing/unlocked/recordless, partial, basis/reconciliation, admission/transfer, closure/vacation and zero-eligible cases remain distinct. No guessed absence, half-day weighting or official partial percentage. Global calendar refusal stays refusal. |
| Historical period | Fresh selected-year enrollment/calendar/sessions determine detail inside P1; changed current class/settings year does not replace historical scope. Generation/revision describe a current read of retained records, not an immutable historical snapshot. No current-year source redirect. |

The same decision path produces aggregate metrics and evidence. Canonical query semantics and deterministic source values bind revisions within the same transaction; source changes require refresh. Canonical serialization ignores source ordering alone. Indexed dates/sessions/records avoid per-day database calls. Existing academic/fee metrics and fixed separately authorized cohort CSV are retained.

Actual IAM snapshots remain mandatory. A P1-local credential-version/password-change check closes the in-process boundary gap without modifying global IAM. The inherited Director object-scope restriction remains denied even with a domain grant; no new scope resolver or Accountant workaround was introduced. Positive Super Admin tests run. All 26 P1 flags remain OFF/0%. Source reads preserve existing minimal audit behavior (no new detailed permanent audit).

UI uses the existing native dialog and CSS module, unique IDs, cancellation generations, focus containment/return and persistent fallback focus after errors. All dates are shown initially; filters affect visible dates only, not full-period totals. Historical headings, permission/source-change/loading/failure states are explicit. No notes, contacts, health narratives, raw ORM objects, day-level export, URLs/localStorage payloads or shared private cache.

## Exact changed-file reservation / manifest

1. `components/intelligent-reports/attendance-evidence.tsx`
2. `components/intelligent-reports/workspace.module.css`
3. `components/intelligent-reports/workspace.tsx`
4. `config/recovery-integration-source-delta.json`
5. `lib/intelligent-reports/access.ts`
6. `lib/intelligent-reports/api.ts`
7. `lib/intelligent-reports/contract.ts`
8. `lib/intelligent-reports/readers.ts`
9. `lib/intelligent-reports/service.ts`
10. `tests/intelligent-reports-contract.test.ts`
11. `tests/intelligent-reports-evidence-browser.mjs`
12. `tests/intelligent-reports-service.test.ts`
13. `docs/evidence/intelligent-reports-attendance-evidence-1b/HANDOFF.md`

Only eight owned production registrations were updated/added; validator rules and inherited registration history remain. No shared import component, global CSS, core IAM, write service, schema/migration, lockfile, workflow or feature configuration change.

## Executed evidence

Private receipts and synthetic screenshots are in this worktree's `tmp/attendance-evidence-1b/`; they are not GitHub file links.

- Baseline characterization before reader refactor: 74 tests/5 files PASS; 12.37 s. Same set after minimum refactor: PASS, 9.54 s.
- Final focused run: **86 tests/5 files PASS**, 17.04 s (`service.log`). Includes 26 actual migrated synthetic service/in-process-route tests and 29 P1 contracts, plus attendance/permission regressions. This is injected synthetic identity/client acceptance, not HTTP login or middleware acceptance.
- Real SQLite coverage: 18/20 = 90%; 17 present +2 absent +missing record unresolved with exact missing date; complete absence =0%; no eligible days; inclusive admission/exclusive exit; leap/month/year boundaries; publication scope/working/closure/partial cases; transfers/unknown admission; basis/reconciliation overlap; historical class/year isolation; forged contexts/rows/revisions; deletion/source changes; grant/session/credential/role revocation; minimal payload/audit; business-row before/after equality; source reads inside one transaction. Setup writes are separate from read-only report/source execution. Calendar ambiguity adversarial boundary is labelled; schema uniqueness is tested without weakening it.
- Additional same-fixture pinned-reader comparison plus calendar/fee regressions: **76 tests/4 files PASS**, 22.81 s (`comparison.log`); overlaps the preceding suite and is not additive. Pinned reader came from `git show`, with import paths relocated only. Compared exact metrics/classifications/state/explanation inside the same actual source transaction.
- **26 rendered checks PASS** (`browser-receipt.json`, `browser.log`). Actual workspace/new component/original CSS, installed Playwright fallback after Browser capability was unavailable, service-captured invented fixtures, loopback-only allowlisted listener. Desktop1366x768/mobile390x844 light+dark;320px evidence/long Unicode errors in both themes. Row open/switch while pending, cancelled/reopened/late reply, attention filter, current/past periods, missing/empty evidence, access denial/revocation, source changed, malformed/failing detail, year/date/scope/family/rerun invalidation, focus/keyboard/Escape. No uncaught errors/framework overlay; expected injected403/409/500 console messages retained. Resize is not genuine zoom.
- Screenshot pair: `before-desktop.png` (same candidate before opening source) and `after-1366-light.png` (source open). Mobile screenshots inspected; caption layout corrected and affected browser checks rerun. No claim that the first screenshot depicts the old implementation.
- Production compile and generation **PASS**,358/358 pages (`build-r2.log`); no ERP server launched. Five affected typechecks PASS: app-api83.26 s, app-ui77.84 s, components46.83 s, lib45.56 s, tests-g-l41.26 s. Individual logs contain no diagnostics.
- Unchanged source validator **PASS282 records/4 source heads/4 backup contracts**. Scoped publication scans and Git/diff safeguards PASS. Flags/schema/IAM/lock/package/workflows byte unchanged relative task base. No whole-project suite pointed at protected/default data.

### Bounded measurements (same environment, invented sources)

| Cohort / days | Pinned reader ms | Candidate reader ms | Source queries each | Full report/detail ms | Full queries each |
| --- | ---: | ---: | ---: | ---: | ---: |
|50 /20|17|9|6|77 /62|32|
|50 /366|263|48|6|109 /133|32|
|800 /20|178|90|6|262 /200|32|
|800 /366|1916|360|6|372 /310|32|

The discovered maximum is366 days. The maximum-window fixture intentionally includes unresolved sparse coverage. Supported2000/refused2001 cohort boundaries run. These are individual read samples, not an SLA; cold fixture/migration/build time is separate. Total work/review/wait duration and token usage were not instrumented and are not claimed.

## Review, corrections and retained limitations

One independent requested-Astra read-only reviewer checked the full source→route→UI delta, math, privacy/IAM, snapshot/revision, cancellation and preserved regressions, then reviewed exact implementation commit and final26-check receipt. **No remaining material findings.** Reviewer inspected source/receipts and did not independently execute tests/builds; running model identity is not attested. Finding fixed: source-error focus return when results disappear. Browser-found narrow caption problem was also fixed.

Stable P1 dependency artifacts were copied into this owned worktree because no dependency installation was authorized. A `pnpm.cmd run` invocation attempted automatic repair and aborted with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; no install completed or retry was used. Copied-link resolution initially caused missing Vitest utility/duplicate React and a failed static generation; only owned dependency links were restored. Final build/tests passed without dependency/configuration changes. Original failed build receipt remains.

**prepare-qa BLOCKED**, clean owned branch, because the helper compares all inherited history against origin/main and detects `docs/evidence/RELEASE_RECOVERY_1C.md` dirty in `recovery-integration-1a`. Verified task-base→candidate delta does not change that file. The helper also warns no upstream; the task explicitly forbids push. Neither condition was bypassed; serial integrator must resolve the overlap. This is not a SAFE integration verdict.

New-candidate PostgreSQL is **NOT_EXECUTED**: no already-authorized disposable target configured; provider-neutral fixture code remains compatible for later normal hosted execution. No new service/container was started. Prior PR29 PostgreSQL/CI receipts are historical context only. HTTP login/middleware, authenticated ERP, native/device, genuine zoom, current combined recovery regression, runtime/security admission and deployment remain unexecuted/unreleased.

## Trackers and preservation

- GitHub PR29 comment `5967168445`, referencing plan `5966721518`: written/read back; OPEN/DRAFT pinned ref reverified.
- Asana P1 `1218898133561602`, comment `1219124169125404`: written/read back; task remains incomplete; original notes/owners/dates preserved.
- Notion register `3b6c9801-27a8-81da-bcbd-cbd62189364d`: create returned success/comment `3eec9801-27a8-8119-b473-001dcced38d0`, but subsequent discussion reads still omit it. **Readback pending; no duplicate post.**
- Canvs board `1LzTSjaWjpOaHppTtyXqICkMbEgHbT6T-`, P1 element `Mymz5BQXjvPKbZcYrKiHQ`: queried, one bounded append, read back. Exact existing rich-text prefix, geometry, bindings, typography and container preserved; other cards untouched.

Owned short-lived synthetic browser listeners and browser processes stopped through harness finally blocks. Test/build/typecheck commands exited. Private receipts/screenshots/bundles, copied dependency backups, pinned comparison source and fresh migrated synthetic temporary fixtures are retained. No broad cleanup or retry of historically denied/ambiguous cleanup roots. No operational DB/vault read/copy/hash, school-data intake, provider/model/SDK/device call, business-record mutation, activation, ERP launch/image, push/CI/ref change, release, hosting/DNS/tunnel or preview banner.

**One next action:** serial review/integration of this exact local increment into P1 and later current recovery, resolving the inherited helper overlap, rederiving combined source registrations, rerunning current-source regression and missing provider/runtime validation. Do not integrate automatically.
