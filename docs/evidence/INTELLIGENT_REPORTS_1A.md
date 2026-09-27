# INTELLIGENT-REPORTS-1A — P1 evidence

## Admission R1 — 27 September 2026

Owner-authorised task-local exception; no shared policy modification.

- Helper: `node tools/dev-parallel/worktree-manager.mjs new intelligent-reports-1a --json`, exit 0, SAFE.
- Actual creation base: `origin/main`, `104aacc7bd314cae82e60bb02b5c8a965c7ffedd`.
- Helper-provided path: `C:/Users/rohit/Documents/school-software-worktrees/intelligent-reports-1a`.
- Branch: `feature/intelligent-reports-1a`.
- Preconditions: exact path/branch/HEAD; clean tracked and untracked status; no implementation commit; candidate tree verified; `merge-base --is-ancestor` exit **0**.
- One-time `git merge --ff-only a4d59b4c5e8ccac7046b1c1f970a58889a51b012`: exit 0, Fast-forward.
- Product base: `a4d59b4c5e8ccac7046b1c1f970a58889a51b012`; tree `f2f8afff324b66697749a0eaca499a95c51b3aad`; clean postcheck. No new commit created by setup.
- All product deltas are measured from that product base, never from main. No W1 mutable files copied.
- No applicable AGENTS.md found in checkout or ancestor paths. Existing parallel guide read. Helper blob remains `00973f4fd51901153118bd67c3ac754c06388ad1`.

## Source contracts and implementation boundaries

| Family | Reusable authority | Exact fields / missing evidence |
| --- | --- | --- |
| Academic | `loadAcademicReportSources`, `parsePublishedSnapshot` | ISSUED current report version + LOCKED governed result; historical published class/section, examination code, totalObtained/totalMaximum/percentage, component states, source hash/formula version. Enrolments define missing-population coverage. Legacy assessments are not mixed into governed results. |
| Attendance | StudentAttendanceSession/Record; published OperationalCalendarDay; AcademicYearEnrollment | exact date/year/class/section; LOCKED session, status; enrollmentDate/exitDate. Published calendar scope precedence. Missing calendar refuses completion; missing records, transfers or ambiguous partial-session policy stay unresolved. Existing KG and governed reporting treat partial statuses differently; no universal policy is invented. |
| Fees | `allocateFees`, `effectiveReceiptState`, `dueDateForMonth`, established `family-collections` source contract | FeeStructure termAmount/months and student discount define liability. Legacy receipts are bounded to academic-year dates and allocated cumulatively. ISSUED FamilyStudentAllocation preserves its exact year/term; active compatibility components must reconcile and are not added twice. Known other-year allocations are excluded. Conflicting legacy/family discount rounding, orphan links, inconsistent reversals and over-allocation are unresolved. Old Due is separate; family master totals are never added. Historical as-of reconstruction is explicitly unsupported. |

Universal Search is bounded discovery, not a cohort engine. Smart AI remains unchanged and receives no P1 results/questions. Existing persistent role permissions, IAM overrides/profiles, session versioning and release flags are reused. Accountants remain subject to existing object-scope restrictions; no shared IAM semantics are loosened.

## Execution record

Implementation active after R1 admission. No operational DB access/copy/hash. No business writes. Only minimal existing user-audit metadata is intended for execution/export. Feature default OFF/0%; existing flags unchanged. Runtime/browser acceptance remains subject to EXTERNAL_RUNTIME_BLOCKED and EPHEMERAL_EXACT_HEAD_CI_ONLY; no local application server is authorised by setup.

## P1 implementation matrix

| Outcome | Implemented behavior | Remaining qualification |
| --- | --- | --- |
| IR1 | Persistent module/domain/export permission registration, role permissions and existing individual IAM overrides/profiles; actual session/account/selected-role rechecks; one OFF/0% release flag; navigation and page connected. Director new permissions excluded from automatic defaults. | Existing global IAM does not support Accountant attendance grants or academic exports. P1 retains those restrictions. Native governance UI/step-up end-to-end acceptance not executed. |
| IR2 | One strict canonical model for question and builder; exact year/scope/exam mapping; LT/LTE/GT/GTE; rejects extra fields, negation, unknown or ambiguous names. Query review precedes execution. | Overall issued-exam percentage only; no new subject calculation or legacy result engine. |
| IR3 | Complete enrolled cohort, not first page; exact current ISSUED publication joined to LOCKED governed Decimal result; zero retained, incomplete/withheld/legacy unavailable rows separate. Historical enrolment scope survives current Student class changes. | Legacy/draft/unpublished evidence remains unresolved. |
| IR4 | Published scoped calendar, known admission and exclusive exit date, current matching calendar-basis keys, complete locked records; exact rational threshold comparison; coverage counters. | Transfer history, null admission date, partial days/statuses and calendar reconciliation remain unresolved where existing policy does not establish an unambiguous denominator/numerator. Historical attendance has no safe existing source link because that destination fixes the current year. |
| IR5 | Current exact-term paise balance; legacy dated receipts plus exact family allocation; Old Due excluded; future/identity/reversal/rounding conflict unresolved; paid/liability/outstanding reconcile; NOT_YET_DUE vs OVERDUE vs SETTLED. | No historical balance reconstruction, new credit assignment, or disputed-state inference. Unallocated family credit is never assigned and is explained as outside Student term totals. |
| IR6 | Connected responsive scoped UI, school colors/theme, question/builder/review, run/cancel/reset, summary/pagination, authenticated source details, independently authorised formula-safe CSV with fixed columns and current revision checks. Query/context changes cancel and invalidate results. | Authenticated full-stack browser, visual/device/dark/keyboard acceptance remain NOT_EXECUTED under runtime hold. No new print/PDF engine or font distribution; CSV is font-free. |

Supported examples (after choosing authorised year/scopes and exact examinations):

- `students below 60% in 7A and 9B`
- `students scoring above 80% in Term 1` (distinct exam IDs require preselected mappings)
- `attendance below 80% between 2026-06-01 and 2026-06-30`
- `outstanding fees for Term 2 in 2026-27`

No raw questions in URLs, persistent browser state, audit or external providers. Query/body/rows/source joins/export bytes are bounded; sources are read within a short transaction; source revision changes require refresh. Pagination and exports reauthorize and recompute the full admitted cohort. Export limit 2,000 rows / 2 MB; no silent truncation. Read metadata and export audit contain family/source-state/operation only. Source links reauthorize at existing destinations and confer no additional ledger/Student permission.

## Meaningful verification

- PASS: **131 tests in 10 files**, 13.39 seconds, serial worker. Final focused run at 2026-09-27 14:22:50 IST.
- Feature tests: **28 contract tests + 12 real migrated SQLite service/in-process route tests**. Parser/builder equivalence, exact exams, strict fields, dates, precision, missing evidence, streamed request bound, formula-safe CSV and generation cancellation.
- Actual IAM: every eligible/excluded known role, unknown role rejected by existing database constraint, module OFF, role OFF, user DENY, domain grant, Accountant explicit academic grant/restricted attendance, export feature OFF, inactive/suspended account, expired/revoked/stale/forged session and expired assignment.
- Actual source reads: 800 students, issued Decimal thresholds including zero and 59.999999, historical enrolment vs current class, real ENROLLED lifecycle event, exit, missing attendance, partial status, calendar unavailable, source revision change, row/page/export totals and privacy canaries.
- Actual financial fixtures use existing preview/confirm/reverseFamilyCollection: one INR 40,000 master, INR 25,000 and INR 15,000 allocated to children, explicit Term 4 money does not pay Term 2, master never counted twice, reversal restores due. Valid previous-year family allocation is excluded; INR 2.01 at 50% discount exposes engine rounding disagreement and remains unresolved.
- In-process route adapter: only `getCurrentAuthContext` and Prisma singleton are doubled to provide the synthetic current identity/client. Real IAM, sources, transaction, flags, origin validation, revision checks and user audit execute. Access/options/interpret/run/details/export tested; forged projection, missing revision, hostile origin and revocation rejected. This is **not HTTP login, middleware, native or browser proof**.
- Business read-only assertion compares full synthetic Student/Payment/attendance/result rows before/after all three readers and paging. Service calls create no UserAudit; actual route run/export create only the two expected minimal audit records. Family fixture setup/reversal is distinct from report execution.
- Latest measured 800-student local SQLite readers: academic **82 ms / 29 queries**; attendance **127 ms / 29 queries**; fees **86 ms / 28 queries**. These are one measured run, not production throughput or an SLA.
- PASS: actual route inventory finds page `/intelligent-reports` and six APIs (`access`, `options`, `interpret`, `run`, `source`, `export`), total repository 366 pages / 659 APIs.
- PASS: PostgreSQL schema parity, 201-trigger contract parity and immutable baseline contract checks. **PostgreSQL execution NOT_EXECUTED**; no admitted local PG target was created or inferred. SQLite fixture is explicitly SQLite-only, not misreported as a dual-provider test.
- PASS: focused permission/API/fee/family/attendance/academic regression, publication-upload-policy tests, production-source secret scan.
- PASS: all 25 original feature configurations compare byte-equivalent after JSON parsing to the pinned product base; new flag OFF/0%. No schema, migration, backup contract, helper, native/auth/runtime, shared recovery ledger or workflow changes.
- Independent reviewer read complete page/API/access/reader/export/UI path. Proven in-scope defects fixed with regressions. Final focused verdict: no remaining material finding identified in reviewed scope. Reviewer performed no DB access, writes or tests; runtime clearance not implied.

## Required gates and exact remaining gaps

1. **FAILED / BLOCKED source admission:** unchanged `node scripts/recovery-source-evidence.mjs` exits 1 with `RECOVERY_SOURCE_DRIFT:app/api/intelligent-reports/access/route.ts`. The checker only reads the protected recovery ledger; no supported feature extension was found. All new P1 runtime paths and the three shared registrations need coordinated source admission; no ledger/provenance rewrite made. This result is not suppressed by local tests.
2. Full authenticated UI driver authored at `tests/intelligent-reports-browser.ts`; must be attached to the admitted exact-head synthetic CI harness with independently logged-in pages/fixtures. It launches no server, mocks no responses and bypasses no admission. **NOT_EXECUTED**, including desktop/tablet/mobile, real download, focus and source-modal interactions. Existing runtime conditions remain `EXTERNAL_RUNTIME_BLOCKED` and `EPHEMERAL_EXACT_HEAD_CI_ONLY`.
3. Whole-repository tests/operational copied-DB scripts are not run locally: some inherited suites require `prisma/dev.db`, which this task is forbidden to access/create/copy. Exact-head CI and actual PostgreSQL execution remain pending. No new CI dispatch or public artifact upload.
4. Broader profile-deny/expiry and governance-step-up UI matrix, real cross-session browser race handling, full unallocated-family-credit operational fixture and historic attendance link acceptance remain unexecuted. Existing deny precedence and fail-closed behavior are retained; no authority is expanded to obtain acceptance.
5. No push/draft PR until mandatory admission gates permit it. Static concurrency inspection: portable and master-requirements use exact-head groups with cancel-in-progress false; PostgreSQL uses workflow/ref and false. No W1 CI/process was cancelled. Protected W1 ref observed at `4c5ed41fdd28d31b6af6ee32a491b2f9c87e9ca5`; P1 stays on the approved a4d59b4 base.

## Scope accounting and preserved state

New P1 changes only: `app/intelligent-reports/`, `app/api/intelligent-reports/`, `components/intelligent-reports/`, `lib/intelligent-reports/`, the three dedicated test files, this evidence file; shared additions only `lib/permissions.ts`, `lib/access-rules.ts`, `config/release-feature-flags.json`. Route inventory discovers new routes automatically. No unapplied UI registration patch is being presented as connected.

Use `git diff a4d59b4c5e8ccac7046b1c1f970a58889a51b012...HEAD` for P1 contribution. Main-to-candidate recovery is inherited, not new P1 work. No merge commit made by setup; no merge into recovery/main, release tag, reset, rebase or force-push. W1 files, helper/policy, historical contracts/v48/migrations/46 requirement IDs/OCR exclusion remain unchanged. No operational DB access, copy or fresh hash, real user/data, external provider/model, deployment, purchase, DNS, font or private-artifact upload.

Final worktree QA, build, typecheck and tracker readback results are appended below when complete.

- PASS: `pnpm.cmd build` (SQLite own generated client, task-owned synthetic build URL, telemetry disabled, existing one-CPU configuration). Initial build caught a Windows mixed-encoding component; normalized to UTF-8 and complete compile/generate rerun exited 0. No application server launched.
- PASS: `pnpm.cmd audit --prod` - no known vulnerabilities found. This does not clear inherited bundled-runtime/OCI gates.
- PASS: updated UI/API typecheck partitions after final functional edits. Full repository typecheck result pending.
- Inherited creation-base-to-product-base history: **70 commits / 409 changed paths**. Those are excluded from P1 contribution.
