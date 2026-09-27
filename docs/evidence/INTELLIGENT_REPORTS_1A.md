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
- PASS: updated UI/API typecheck partitions after final functional edits. PASS: full repository `pnpm.cmd typecheck` completed with exit 0 across all 20 configured partitions.
- Inherited creation-base-to-product-base history: **70 commits / 409 changed paths**. Those are excluded from P1 contribution.

## Worktree QA handoff

Product implementation commit: `1dec5ab3f6ba73265fc03fde303055fcb52248b0`; tree `d476d733418728ed7b6e89d07123407d2998880c`. Exactly 22 P1 paths, 946 inserted lines at that commit; no merge commits above approved product base. Subsequent evidence-only commits do not change that product source.

Unchanged helper `prepare-qa feature/intelligent-reports-1a --json` returned **BLOCKED** on the clean committed branch. Tool shell exit was 1; helper JSON declared exitCode 2. originMain/mergeBase remain 104aacc7; branchAhead 71 (70 inherited + 1 P1), mainAhead 0, upstream null. Its no-upstream warning does not override the blocking gate; no push performed.

The 18 dirty-overlap paths below are **all inherited candidate paths, zero new P1 paths**, in the protected recovery-integration-1a worktree. Path lists were read; no W1 contents copied, corrected, cleaned or staged.

- `.github/workflows/cross-platform-apps.yml`
- `apps/nalanda-cross-platform/src-tauri/Cargo.lock`
- `apps/nalanda-cross-platform/src-tauri/Cargo.toml`
- `apps/nalanda-cross-platform/src/App.tsx`
- `docs/evidence/RELEASE_RECOVERY_1C.md`
- `lib/native-app/auth.ts`
- `lib/native-app/session-governance.ts`
- `lib/portable-runtime/synthetic-capability.ts`
- `scripts/portable/synthetic-capability.ts`
- `scripts/portable/windows-auth-lifecycle.ts`
- `scripts/qa-communication-delivery-foundation-1a-public-repo-scan.ts`
- `scripts/qa-real-user-access-readiness-1a-public-repo-scan.ts`
- `tests/cross-platform-apps-1a.test.ts`
- `tests/native-mfa-linkage.test.ts`
- `tests/native-reference-observation.test.ts`
- `tests/native-session-governance.test.ts`
- `tests/windows-auth-lifecycle.test.ts`
- `tests/windows-server-service.test.ts`

No retries, altered helper/policy/manifest, merged W1 changes, or manufactured SAFE result. Push/draft review and runtime activation remain deferred.

Final status: **INTELLIGENT_REPORTS_1A_PARTIAL_WITH_EXACT_GAPS**. Connected source implementation, meaningful permitted tests and independent source review are complete; source admission, worktree overlap, full authenticated runtime/browser and PostgreSQL execution gates remain open. No release or activation clearance.

## Tracker readback and measured work interval

At 2026-09-27 09:04:09 UTC, all three final tracker readbacks succeeded: Asana 1218898133561602 contains the exact partial status and product SHA and remains incomplete; Notion register P1 section contains final R1 handoff and retains previous history; Canvs only Mymz5BQXjvPKbZcYrKiHQ matches the final rich text, with geometry x=9009.5/y=48/881x1004 and original container unchanged. Parent and W1 records were not edited.

Measured R1 work interval through tracker readback: 08:12:12 to 09:04:09 UTC, **51 minutes 57 seconds**. Task-specific token/cost usage was not observed and is not estimated. Final source/evidence commit coordinates are provided in the user handoff; tracker product SHA stays pinned to the tested implementation commit.

## R2 — reviewed source admission and provider validation

R2 started 2026-09-27 10:06:14 UTC. Exact starting HEAD `31c98594a2f362217968ef909544185d23c32c95`, tree `13c862a0daeba2c116608fcbc09d080df79255d6`, clean owned feature branch/path. Ancestry from the pinned a4d59b4 product base exits 0. Product app/components/lib/release flags remain byte-identical to tested `1dec5ab`; its tree is not substituted for the evidence HEAD. No initial setup repeated.

### Current handoff and failure history

First unchanged prepare-qa recheck: **SAFE**, native exit 0; clean, no dirty overlap, upstream null, originMain/mergeBase104aacc7, branchAhead72/mainAhead0. The earlier18-path BLOCKED result above remains historical. W1 remote ref observed1c2e1a3; not adopted. Final committed handoff is recorded separately below.

First unchanged source check again failed with `RECOVERY_SOURCE_DRIFT:app/api/intelligent-reports/access/route.ts`, exit1. R2 expressly authorises the manifest correction; checker and helper were not changed. The generator returned `GENERATED_NOT_REVIEW_CLEARANCE`,270 records. Independent review was then performed against actual content, not inferred from generation.

### Exact reviewed registration

`config/recovery-integration-source-delta.json`:254 to270 records.252 old records remain structurally identical;16 added (15 feature source files plus existing shared navigation `lib/access-rules.ts`); only the two existing records for `lib/permissions.ts` and `config/release-feature-flags.json` changed. No removals, base/head/date changes, historical hash rewrites or wildcard admissions. New P1 records retain `RECOVERY_RECONCILIATION_REQUIRES_INDEPENDENT_REVIEW`, never mislabelled as a historical admitted source. All270 normalized current hashes independently checked.

The existing `PRODUCT-EXPERIENCE-1A` completeness contract also required the new page. Narrow `config/product-experience-screen-register.json` registration adds only `/intelligent-reports` with four eligible roles, module permission, HIGH risk and manual accessibility review required;365 previous rows/order preserved, counts366. Its generator/checker and general role inference were not changed. Conditional domain/export restrictions remain in the actual service, not overridden by this inventory.

One independent reviewer found no remaining material R2 finding and reused verified unchanged product evidence. Frozen normalized LF SHA256:

| Reviewed file | SHA256 |
| --- | --- |
| config/recovery-integration-source-delta.json | f7c41e9823b57fb54d0963110c16b130928e1ebdcda277f210a32bb168a955ba |
| config/product-experience-screen-register.json | c7a9766b55e13d311e6108a41c2149e126111fe1053936a1307f017bf1de56b9 |
| tests/intelligent-reports-service.test.ts | 29202602b31fc6fd8a93976ac3128135a6454a2b6efef545e9b6bf0b23a912d2 |

Unchanged final-content source checker: **PASS**,270 records/four source heads/four backup contracts, exit0. This is register consistency; the separate reviewer verdict above is limited source review, not runtime/security certification.

### Provider-connected tests and explicit doubles

Same feature service suite now selects SQLite or PostgreSQL from the actual configured provider. SQLite remains a freshly migrated in-memory database saved to a unique task-owned temporary directory, absence checked before creation, real-path/symlink/hardlink checks, no replacement or shared cleanup. PostgreSQL requires CI=true plus unchanged `assertSyntheticPostgresQa` (opt-in, loopback, synthetic database name, non-production); it uses a unique `ir1_<UUID>` schema and existing PostgreSQL migrate-deploy. Hosted disposable service owns its lifecycle. No operational database or another worktree database is accessed.

The existing hosted `postgres-readiness.yml` application-regression job uses PostgreSQL17.11-bookworm and `pnpm test:postgres`, which automatically includes this test file. No workflow or full ERP harness modification is needed. Local Docker database daemon inspection failed (missing desktop-linux pipe); no local admitted target exists and no server/container was launched.

Doubles: transport identity and Prisma singleton adapters remain in-process. PostgreSQL additionally uses an explicitly disclosed in-memory configuration fixture for exactly the module and bulk-export flags, evaluated by the real flag evaluator. The unmodified runtime admits SQLite QA only; separate assertions prove actual PostgreSQL runtime and production config stay OFF. The database URL/provider is never disguised as SQLite. No persisted flags or activation/runtime policy change. Reader, session, permission, transaction, fee engine and audit queries remain actual provider execution when run.

Fixtures cover800 students; Decimal0/59.999999 and exact LT/LTE boundaries; historical enrolment vs current class; issued/missing/incomplete results; dated calendars, another-class calendar exclusion, missing/partial records; actual40000 master with25000/15000 allocations; year/term separation/reversal/rounding conflict; pagination and stale-source export rejection; module/domain/user/role DENY and stale authority; all three routes' business-record equality and exactly six minimal new run/export audits; privacy canaries absent from CSV. Expectations are specified independently; no provider-result normalization or lossy Decimal/date conversion was introduced.

Initial added-calendar test failed its actual database constraint because fixture used unsupported HOLIDAY. Corrected to existing NON_WORKING_DAY; no schema/policy/assertion/timeout change. Final focused run **147 tests/12 files PASS**,20.69seconds, including28 feature contract and14 real SQLite service/route tests. Static provider contracts **7 tests/3 files PASS**, schema parity,201-trigger parity and immutable baseline PASS. Static checks are not PostgreSQL execution.

### Local validation and retained limits

PASS: complete production compile/generate build; both existing publication scans (429 main-relative paths), Git safety, full and production dependency audits (no findings), route inventory (P1page+six APIs;366pages/659APIs),46-requirement register, unchanged25 flags and newOFF/0%, diff whitespace check. Full20-partition typecheck PASS, exit0. Final committed handoff and hosted execution are appended after their actual results.

Leadership roles require effective module/domain/export permissions and flags. Accountant fee reports remain permission-gated; academic read requires explicit underlying user/profile grant. Accountant attendance and academic export remain unavailable under unchanged global policy: this is an **unresolved original capability requirement**, not simply Browser execution pending. Other roles are excluded. Issued/locked governed academics, unresolved ambiguous attendance, no historical fee reconstruction and no allocation of unassigned family credit remain unchanged.

Browser/UI/native/device execution is NOT_EXECUTED; existing connected UI and real browser driver retained. In-process routes do not prove login/middleware/rendering/dark mode/keyboard/download/cross-session race. EXTERNAL_RUNTIME_BLOCKED and EPHEMERAL_EXACT_HEAD_CI_ONLY remain. W1, native/auth/runtime tools, operational database, v48/migrations/schema/history/46 requirement IDs/OCR exclusion preserved; no model/provider activation, deployment, merge or release tag.

### R2 hosted admission correction (original failure retained)

First committed candidate `ba0f54fa5310c3508803b87c1ad1713a46e88ba8`, tree `0b6e84b799304d964f7ff735b638e75c314880a4`: final clean prepare-qa **SAFE**, exit0, no crossWorktreeOverlap/unreadable worktrees/blockers; only no-upstream warning. Main-relative branchAhead73 contains70 inherited plus3 P1 commits. Own normal push succeeded; draft stacked PR29 targets recovery at1c2e1a3, exact head and24 P1 paths verified. No inherited recovery paths presented as P1. Concurrency is exactSHA or distinct PR/ref scoped; no W1 runs cancelled. Six workflows triggered normally, no duplicate dispatch.

Hosted master run36312335723/job108600560371 failed unchanged `tests/master-requirements-reconciliation.test.ts:134`: screen register366 versus corresponding debt register365, missing only P1 page. The source-checker test itself passed. This is a second narrow current-source inventory registration under R2 section3, not permission to change the test/historical audit. `config/product-experience-debt-register.json` adds only one P1 row, four eligible roles/module permission/owning bundle; all nineteen dimensions remain REQUIRES_TARGETED_RUNTIME_OR_DESIGN_REVIEW, role coverage unverified and Accountant gap explicit. Every previous365 row and top-level historical metadata is preserved. No generator/scanner or acceptance assertion changed. The original failed CI remains retained.

The corrected debt row is non-runtime inventory. Prior product build/full20-partition typecheck/147 feature and regression tests remain valid for identical product bytes. The affected master/product contract tests and tests-m-r typecheck are rerun on the actual correction. Subsequent final head, prepare-qa and hosted results are recorded in PR29 and existing P1 trackers without a cosmetic report-only push loop.
Independent debt-row review found no material issue; LF SHA256 `ace4f129124d420b215aff5f7761910d6a3e81e5a1dec74ac89224d77f2820df`. Corrected master/product contracts28 PASS and affected tests-m-r typecheck PASS, exit0.

### First hosted provider failures and reviewed corrective candidate

At ba0f54fa5310c3508803b87c1ad1713a46e88ba8, PostgreSQL run36312335595/job108600560063 executed the real readers and routes: 13/14 P1 service tests passed,28/28 P1 contract tests passed; full suite2850 passed,5 failed,3 skipped. This is execution evidence, not a provider PASS. Failure at service.test.ts:154 assumed CUSTOM role insertion fails identically: existing PostgreSQL schema accepts it, SQLite rejects UserRoleAssignment_role_check. The correction asserts the actual P1 authorization rejects an accepted PostgreSQL custom role even with module grant; SQLite retains the insertion-constraint assertion. No schema, IAM or assertion relaxation.

The four wider failures were missing P1 entries in debt, bulk-export, feature runtime-contract and private robots inventories. First Windows biometric suite2881 passed/4 failed/3 skipped corroborated those four inventory gaps; communication corrected-scope gate found the runtime-contract gap. Original failed runs are retained.

The debt correction was committed separately at73b4284be94c9665f1f914dce41ce7d6a83449e8. Further narrow registrations use the existing bulk/final-scope schemas and private path list. Prior entries remain equivalent; discovery totals now68 surfaces/46 bulk/22 nonbulk,2 bulk-flag mappings. Existing scanner and historical final-scope contracts remain unchanged. P1 export route now exposes a real transport authentication guard and private error/header handling; the existing handler independently reauthorizes session/module/domain/export/revision. Its service import uses the absolute existing path so the unchanged scanner follows the actual CSV sanitizer. All three family export assertions now invoke the actual Next route; null-context exports assert401/private headers. No source semantics or role capability broadened.

Unchanged source generator produces270 records. Compared with the prior reviewed P1 ledger, only current hashes for export route, API import and private-routing source change; the private-routing record moves from historical admitted source to requires-independent-review. All base/source/historical hashes remain intact. Unchanged checker PASS270/4sourceHeads/4backupContracts.

Focused independent reviewer: no remaining material finding. Final LF-normalized SHA256 binding:
- export route e808f39b42b74528159e328579a47f960eb60679de919424f338b77b65b41092
- API a9e0d692adf1c720fb5253cd3f226a41b50203229cc33bdbc944eace0ef101b1
- private routing df6b1d08880ac8b5dd5ff4d1f7d44ddef97b277e495fac38e485d45b94c2473e
- source ledger 08ca680fea310995b39b9572bbdfeff3b2f87f021a884bcd24f048ece062e65f
- service tests a36f8679322b8847d3484502d7e3d4c13548d59a99a399110d2f0d06934d95c7
- bulk tests c9fe6694bbf59bc7c3c804d5b25f032f56802595ea5a8cc5638aa5e038568a6c
- bulk contracts d2b6c25104e297bb6dfdfdb917b642b8d2c8f63bf57787718ff2c17ec309ba73
- scope contracts 20aa7bc2c1c6b575350a2d33e898e46dd21302934e4b5db5f646b71c0a69dce5

Corrected SQLite/focused registration suite96 tests/6 files PASS in23.01seconds. These results do not yet claim corrected hosted PostgreSQL PASS. Subsequent exact-head provider/full-workflow results, clean handoff and final SHA are recorded in PR29 and P1 trackers without cosmetic report-only pushes. Original R1 commits and all failure history remain retained.
Corrected candidate additional local verification: affected API/lib/test typecheck partitions PASS exit0; full production compile/generate build PASS exit0; both unchanged publication scans PASS. Complete 20-partition typecheck and dependency audits passed earlier in R2; dependencies unchanged.
