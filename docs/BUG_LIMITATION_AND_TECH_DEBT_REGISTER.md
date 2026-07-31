# Bug, Limitation, and Tech Debt Register

## EXAM-RC-IMPL-1 disposition

Resolved:

- Examination configuration is additive and versioned by academic year,
  examination and class with governed section/subject/paper overrides.
- Numeric schemes explicitly select `RAW_SUM` or `WEIGHTED_NORMALIZED`;
  maxima, duplicates, denominator safety and exact weighted total are validated
  before activation.
- Exact Teacher ownership requires active Staff, timetable Teacher and matching
  year/class/section/subject assignment. Permission alone grants no ownership.
- Activation, archive, proposal and exceptional intervention are append-only
  audited; active/frozen schemes are corrected through a new version.
- Development CSP permits the Next.js hydration requirement only when
  `NODE_ENV=development`; production/test CSP remain strict. Login has a
  POST fallback so a pre-hydration submit cannot put a password in the URL.

Remaining:

- The marks-entry grid, result calculation/moderation/approval, publication,
  report-card issue and bulk PDF/ZIP generation are intentionally not
  implemented.
- Multi-examination/board-family consolidation remains
  `REQUIRES_SOURCE_APPROVAL`; the configuration foundation does not infer a
  formula.
- Historical active-version immutability after marks entry opens will become
  enforceable only when that later marks lifecycle is implemented; the current
  phase already exposes no in-place mutation path for active/frozen versions.
- SQLite remains a supported single-instance write architecture; horizontal
  multi-instance writes are outside this phase.

Independent QA is complete. It corrected cross-workflow optimistic
concurrency, paper/component applicability, assignment-version immutability,
contributor ownership, Teacher-state revalidation and accessibility before
the fast-forward release.

## DATA-0B follow-up

| ID | Area | Status | Risk | Required action |
|---|---|---|---|---|
| `AUTH-2A` | Retained operational accounts | COMPLETE through P4C | One owned/rotated Super Admin remains active; Admin, Accountant and Viewer are inactive with preserved audit history | Do not reactivate a retained account without a named owner and current need; preserve the governed status-change and last-Super-Admin safeguards |
| `AUTH-2B` | Central session, login alias and reset-channel state | IMPLEMENTED; AUTH-2B-QA REQUIRED | Live recovery delivery remains disabled, legacy cookies require fresh login at cutover, and multi-instance rate limiting is not provided | Independently QA the retained branch; approve/configure a governed provider separately before operational recovery delivery; do not merge early |
| `IAM-1A` | Delegated named accounts and fine-grained authorization | FUTURE after DEVOPS-1E | Current base roles do not provide reusable profiles or explicit per-user grants/denials for multiple named leaders and operators | Add named Directors/Associate Directors, Principal, Accountant, Computer Operator, Teacher, Parent and other users with base roles, reusable permission profiles, and explicit per-user grants/denials |
| `SUPPORT-1A` | Governed support operations | FUTURE | Login links to the real public Contact route, but no approved support owner, hours, intake classification, or service workflow exists | Define the supported contact channel, owner, privacy-safe intake, escalation, retention, and availability before adding in-app support workflow |
| `OBS-1A` | Redacted monitoring and incident alerting | FUTURE | Core health/readiness is local and permission-gated; no central monitoring provider is active | Approve allowlisted events, retention, access, incident ownership, hosting and processor terms before any Sentry/PostHog/provider integration |
| `DATA0B-BACKUP-SETTINGS` | v37 blank-database restore | FIXED in DATA-0B | Prior backup omitted the full `SchoolSettings` singleton, which a restore over a preconfigured copy could mask | Keep the allowlisted settings snapshot, parser validation, idempotent upsert and blank migrated restore-twice regression |

## UX-1A shared shell disposition

- Shared login/header/navigation/design tokens are implemented without an auth
  or data-model change. Independent UX-1A-QA remains the merge gate.
- `UX-YEAR-1`: only one current `SchoolSettings.academicYear` exists. There is
  no historical context switch or year-creation workflow; the shell must not
  imply otherwise.
- `UX-DEV-CSP-1`: strict production CSP is preserved. Current Next development
  mode requests `unsafe-eval`, so production builds are the reliable Browser
  QA target until a separately reviewed nonce/hash-compatible dev strategy
  exists. Never weaken production CSP to silence this tooling mismatch.
- `UX-AUTH-1`: password reset, verified aliases, central sessions, and reset
  channels remain AUTH-2B. No fake Forgot Password action is permitted.
- `UX-IAM-1`: the human designation is presentation only. It does not add
  multi-role switching or per-user permission state; that remains IAM-1A.
- `UX-OBS-1`: health and deployment readiness are separated, but continuous
  monitoring remains OBS-1A.
- `UX-SUPPORT-1`: Contact Support uses the existing public Contact route.
  Service ownership and intake workflow remain SUPPORT-1A.
- `UX-VERIFIER-1`: `deployment:integrity-check` still encodes the superseded
  8 / 8 / 19 baseline and pre-DEVOPS-1E migration state. UX-1A uses exact
  read-only live checks and its isolated harness; repair the legacy verifier
  only in a separately scoped governance task.

## Prompt 23B critical finding and consolidation status

- The Prompt 23B critical Teacher attendance object-scope defect is fixed on the
  Prompt 23C feature branch. Page, GET/POST API, reports, CSV, Teacher portal
  and dashboard now use one exact active
  `StaffMember -> TimetableTeacher -> TimetableAssignment` or confirmed dated
  substitute resolver. Permission alone grants no cohort.
- Prompt 23C-QA independently cleared the exact attendance boundary. The
  critical attendance blocker is resolved; overall Teacher replacement remains
  `CONDITIONAL` and is not a full parity release.
- Residual design limit `ATTENDANCE-SCOPE-1`: the current timetable model has
  no explicit class-wide attendance-owner record. Blank section is treated as
  an exact cohort, never a wildcard. Any future class-wide authority needs an
  approved explicit model and migration.
- Residual design limit `ATTENDANCE-SCOPE-2`: substitutes are dated rows, not
  date ranges. Approved multi-day coverage requires one confirmed row per day.
  Do not infer a range or convert substitute evidence into permanent authority.
- Resolved release gate `ATTENDANCE-SCOPE-3`: fresh namespaced copied-database,
  production HTTP and Browser negative checks passed, cleanup was inspected
  twice, and no operational Teacher/Staff/assignment was provisioned.
- Prompt 23B reconciled exactly 109 source items: 23 vendor, 10 different-role, 14 populated-data, 29 synthetic-write, 6 export-sample, 7 not-used, 11 safe-to-defer and 9 already-replaced-without-parity-evidence.
- No schema, migration, business route/API, operational record, Schoolknot data, credential, provider, deployment or DNS changed.
- FIN-2A is resolved. DEVOPS-1D remains `PAYMENT_GATED_DEFERRED`; 21B-21D remain blocked; 22B conditional and 22C-22D blocked.

## Prompt 22A-QA closure

- QA found and fixed three documentation-precision defects: official-only authority wording, explicit no-claim wording and public-read-only portal-review wording.
- No runtime or data defect was introduced or found. The Prompt 22A package is fully cleared for planning/governance, while Prompt 22B remains conditional and Prompt 22C/22D remain blocked by the existing external gates.

## Prompt 22A planning risks and release conditions

- Prompt 22A is documentation-only. No Staff DOB, EPFO/EPS status, UAN, reminder, checklist, schema, migration, route, API, permission or runtime record exists.
- The Code on Social Security commenced during November/December 2025, final Social Security (Central) Rules were notified in May 2026, and the official EPF/EPS scheme text remains part of a time-sensitive transition. Current applicability requires dated professional review before 22B/22C/22D.
- Full UAN storage is omitted. Status plus optional last four is the approved first boundary; credentials, OTPs, Aadhaar/PAN/bank data, portal sessions and source-document images are prohibited.
- Current broad Staff permissions are not sufficient. Dedicated exact-DOB, verification, EPFO-status, reminder, compliance, own-view and aggregate permissions are required.
- Current `StaffMember` has `dateOfJoining` and `status` but no employment end date. Do not duplicate joining date or infer an end date/status from DOB.
- Unknown, unverified, conflict, correction-pending and guidance-required states must remain distinct. A boolean UAN field is too lossy and is omitted in favor of a controlled availability status.
- The deterministic non-leap-year anniversary rule for a 29 February DOB is unresolved and blocks Prompt 22C reminder release, not Prompt 22B storage.
- No fixed post-employment retention schedule, privacy notice, incident owner, own-Staff self-service scope or aggregate suppression threshold is approved.
- Age 58 must never drive employment, retirement, salary, contribution, eligibility, claim or pension-amount action.
- Prompt 22B decision is `PROMPT_22B_CONDITIONALLY_APPROVED`; 22C/22D remain blocked by their separate gates. Prompt 21B/21C/21D remain blocked.

## Prompt 19B deployment limitations

- LIVE WhatsApp is intentionally disabled and was not exercised; Meta credentials and public HTTPS webhook subscription remain supervised deployment steps.
- Template creation/status synchronization is manual; only locally active mappings recorded as Meta `APPROVED` can send.
- India pricing is a versioned estimate reviewed 17 July 2026, not an invoice or finance posting.
- SQLite provides the bounded worker. Reassess claim/locking strategy before high-volume multi-instance deployment.
- Minimal inbound processing recognizes compliance opt-out keywords only; no conversational inbox or reply exists.

Latest finance expansion phase: Prompt 16A-QA  
Latest academic foundation phase: Prompt 15D-QA  
Latest UI stabilization phase: Prompt 14C-QA  
Purpose: keep critical fixes, known limitations, UI/UX issues, and future enhancements separate from feature planning.

## Current Critical Bugs

No new data/security-critical bug was confirmed during the Prompt 14A source/documentation audit. If a future browser pass finds a data loss, permission bypass, backup failure, restore failure, or money/attendance correctness issue, fix it immediately before continuing UI polish.

## Register

| Category | Item | Severity | Current state | Recommended action |
|---|---|---|---|---|
| Data/security critical | Backup version 13 does not restore `SchoolSettings` singleton | Medium | Known limitation documented in developer guide | Keep warning visible; handle in a separate backup/settings prompt if required. |
| Data/security critical | Full cross-module audit log does not exist | High | Payments/users and some workflows have audit history, but not every master-data change | Plan cross-module audit expansion before full Schoolknot replacement. |
| Data/security critical | Payment gateway is not implemented | Low now, high if online payments are required | Offline/manual fee workflows only | Do not add without signed webhook, idempotency, settlement, refund, and secret-handling design. |
| Workflow correctness | Operational Prisma baseline metadata onboarding | Completed, pending independent QA | DEVOPS-1E recorded `20260722_clean_install_baseline` exactly once after copied-database rehearsal, protected version-37 logical/raw backups, restore rehearsal, exact approval and pre-change hash recheck; application digest, zero-data controls, account states, configuration and schema remained exact | DEVOPS-1E-QA must independently verify the feature commit and evidence before merge; cloud/Postgres remains a separate migration plan. |
| Deployment | SQLite/file storage prevents horizontal or serverless staging | High | DEVOPS-1C selects restricted one-instance/local-persistent-disk staging and rejects ephemeral/serverless hosting | Move to a managed client/server database plus private object storage before multi-instance/production scale. |
| Observability | No central immutable structured redacted log sink is active | High | DEVOPS-1C defines allowlist, retention and alerts; no live service was created | Select/configure an approved sink before external staging opens. |
| Operations | Login throttling is in-memory and resets on restart | Medium | Single-instance restriction plus sanitized proxy/IP and ingress limits are required | Add shared/distributed throttling before multi-instance operation. |
| Recovery | Off-host staging backup destination is undecided | High | Local validated/encrypted backups and retention are designed | User must approve destination/region/owner; prove restore before external staging. |
| PWA | Physical Android/iPhone certification has no trusted HTTPS staging origin | Medium | Device checklist and private-cache gates are documented | Complete only after approved HTTPS staging exists. |
| Finance foundation | Expense corrections after approval/payment use cancellation only | Medium | Prompt 16A-QA confirms silent edits are blocked and payment/audit rows are preserved; no reversal voucher/refund flow exists | Design an explicit correction/reversal workflow in a separate later phase. |
| Finance foundation | Invoice documents are not stored | Medium | Prompt 16A records invoice metadata only | Add document storage only with access, malware, backup, retention, and path-disclosure controls. |
| Finance foundation | Category and department master pages are absent | Low | Safe initial master rows are seeded; expenses can select them | Add master management in a narrow later prompt if the school needs custom values. |
| Finance foundation | Expense, budget, miscellaneous-income, and daily cash-book foundations are built; payroll, tax filing, bank reconciliation, inventory, and Books/Library publisher flow remain absent | Intentional | Prompt 16A-16C boundaries | Keep Prompt 16D and later modules separate and do not merge them into student payments. |
| Workflow correctness | Browser file upload automation unavailable in some QA | Low/Medium | Some import QA relies on source/tests/manual checks | Keep preview-first import tests strong; perform manual upload QA before live migration. |
| Workflow correctness | Biometric integration not proven | Medium | Manual attendance exists; BM-70W vendor/API/export not verified | Do not approve/build direct sync until sample export/docs are verified. |
| Workflow correctness | No direct attendance-record link for substitute attendance-origin assignments | Medium | Substitute planner can review attendance/leave but assignments do not permanently link every attendance-origin record | Add only when attendance-to-substitute automation is scoped. |
| Workflow correctness | Attendance unlock/correction workflow absent | Medium | Submitted/locked sessions are intentionally final in UI | Future correction workflow should include permission, reason, audit, and reports. |
| Workflow correctness | Staff leave balances/payroll effects absent | Low/Medium | Leave foundation records requests, not balances or salary deductions | Future HR/payroll prompt only if needed. |
| Academic/compliance | Casual promotion or repeat changes could bypass lifecycle history | High | Mitigated in Prompt 15C by draft, approval, explicit transactional finalization, duplicate-target guards, and immutable finalized decisions | Keep direct current-Student mutation buttons prohibited; retain CORRECTION as review-only until a compensating-event design is approved. |
| Academic/compliance | Double promotion could be recorded without strong evidence or documented approval | High | No request/evidence/approval/rejection workflow exists | Treat as exceptional; require academic evidence, Principal/Director decision, parent acknowledgement, rejection path, and current UDISE+ review. |
| Academic/compliance | Old student academic history could be deleted or overwritten | High | Prompt 15B adds enrollment-per-year and append-only event history; final workflow/correction policy is still absent | Keep Student as identity anchor, retain restrictive links, and never hard-delete finalized history. |
| Data/privacy | Aadhaar data could be collected or exposed too broadly | High | Optional full Aadhaar value exists on Student; no dedicated masking/access/retention policy exists | Do not expand or automate Aadhaar use until school/privacy review. Mask and narrowly authorize any later display/export. |
| Academic/compliance | ERP status or summary could mismatch current UDISE+ portal definitions | High | Planning notes only; no verified mapping or portal checklist | Treat all future output as a school-review checklist and verify current portal fields/statuses before production use. |
| Academic/compliance | Class/section strength could mismatch enrollment, attendance, or portal totals | High | Current Student rows and attendance rosters can be counted, but opening/join/exit/closing reconciliation is absent | Add read-only reconciliation after lifecycle history exists; show cut-off, included statuses, and missing-data counts. |
| Academic/compliance | Transfer, left, and dropout classifications could be conflated | High | Current broad status/free-text TC fields cannot preserve structured dates, reasons, approvals, or corrections | Add distinct reviewed lifecycle events and effective dates; verify school and current UDISE+ terminology before mapping. |
| Academic/compliance | Parent request or acknowledgement for exceptional progression may be undocumented | Medium/High | Guardian links exist, but no progression-request evidence record exists | Store dated request/acknowledgement metadata with the decision; do not treat it as a substitute for school approval. |
| Policy | Promotion could be tied automatically to unpaid fees without a reviewed policy | High | Fees and academic progression are currently separate; no progression workflow exists | Keep fee clearance advisory only unless school leadership explicitly approves a lawful, carefully reviewed policy. Never silently decide progression from dues. |
| Academic evidence | Marks evidence is not available | High for progression decisions | Exams/marks/report cards are not built | Do not invent or infer marks. Record only an evidence checklist/reference until Prompt 17B or later builds an approved exams foundation. |
| UI/UX | Mobile navigation needs redesign | High | Prompt 14B replaced the mobile full sidebar with an off-canvas drawer | Continue browser QA during page-level polish; fix regressions immediately if content is pushed below navigation again. |
| UI/UX | Role-based menu clutter | Medium | Prompt 14B grouped permission-derived navigation into module sections | Continue route-specific subnav polish later; do not flatten privileged links again. |
| UI/UX | Dashboard lacks premium leadership view | Medium | Resolved in Prompt 14C; Prompt 14C-QA verified metrics, roles, themes, accessibility, and responsive behavior | Keep the dashboard on existing permission-filtered data sources. |
| UI/UX | Tables are often spreadsheet-like on phones | High | Horizontal wrappers protect layout but reduce usability | Route-specific polish after 14B. |
| UI/UX | Long forms need consistent grouping | Medium | Add Student, Add Payment, Settings, Import/Export, Timetable pages vary | Design system and route polish prompts. |
| UI/UX | Filter panels take vertical space | Medium | Prompt 14B added shared filter-panel primitives, but pages are not deeply refactored yet | Add collapsible filters during route-specific polish. |
| UI/UX | Dark/light contrast needs route QA | Medium | Theme tokens exist, not fully route-audited | Include in 14B/14D browser QA. |
| Documentation | Route/module inventory was not previously centralized | Low | Added in Prompt 14A | Refresh after new routes. |
| Documentation | Prompt order in older Schoolknot map favored feature modules before UI stabilization | Low | Updated in Prompt 14A | Keep Phase 14 stabilization first. |
| Future enhancement | Admissions/enquiry missing | High if Schoolknot handles admissions | Not built | Future scoped module. |
| Future enhancement | Exams/marks/report cards missing | High if Schoolknot is official marks system | Not built | Future scoped module. |
| Academic/compliance | UDISE+ checklist source fields remain incomplete or unverified | Medium/High | Read-only Prompt 15D checklist exists; Prompt 15D-QA verified its counts, privacy, and permissions | School must confirm fields and latest portal requirements before any Prompt 15E fix forms. |
| Future enhancement | Books/Library income, publisher payment, payroll, GST, bank reconciliation, inventory, and gateway remain missing | Medium/High | Not built | Keep as separately approved future phases. |
| Future enhancement | Library/certificates/events/PWA/notifications missing | Depends on actual usage | Not built | Prioritize by Nalanda's real current workflow. |

## Resolved during Prompt 15B-QA

- Backfill coverage previously used all non-deleted students; it now requires both active status and no soft deletion, and the overview missing-count uses the same rule.
- Detail API safety previously depended on a narrow Prisma `select`; the response serializer now independently allowlists fields and is regression-tested against injected internal record/user IDs.
- Lifecycle restore previously deduplicated events only by backup ID; it now also skips exact semantic duplicates with different IDs while retaining distinct append-only events.
- Lifecycle detail dates now use the shared school-time-zone formatter.

No existing Student row, class/section, lifecycle row, fee/payment, attendance, leave, substitute, or timetable record was rewritten by these QA fixes.

## Immediate Fix Rule

Fix immediately if found:

- permission bypass,
- direct API access bypass,
- payment amount/receipt correctness issue,
- backup file generation failure,
- restore validation/execution issue,
- destructive action without preview/confirmation,
- parent/teacher data isolation failure,
- role matrix regression,
- attendance or leave workflow state corruption.

Group and defer:

- purely visual issues,
- mobile spacing problems,
- dashboard card polish,
- filter/table readability issues,
- future module gaps.

These should be handled in Phase 14 UI/UX prompts unless they block safe operation.

## Prompt 14C-QA resolved findings

- **Local-date metric drift:** fixed dashboard collection/payment-count/month keys to use `Asia/Kolkata`, including the June-to-July midnight boundary.
- **Current notice undercount:** fixed published notices with no scheduled publish date so they remain current unless expired.
- **Legacy dashboard API overexposure risk:** replaced the broad `getDashboard()` API response with the same effective-permission-filtered command-center view used by the page.

No schema, backup/restore format, fee allocation, payment mutation, attendance transition, leave transition, or substitute workflow rule changed.

## Prompt 15C known limitations and debt

- The existing SQLite database remains non-baselined for Prisma Migrate (`P3005`); the additive progression table uses the established local `prisma db push` path while the SQL migration is retained for a future clean/baselined deployment.
- CORRECTION decisions cannot be finalized. This is intentional until a compensating-event and reconciliation design is approved; old history must never be rewritten.
- There is no bulk cohort rollover, double-promotion workflow, automatic class mapping, marks calculation, attendance calculation, fee-clearance blocker, UDISE+ export, admission, or certificate/TC linkage.
- Progression audit user links are optional so user deletion/restore mismatch cannot delete decision history. Restore maps links only when safe and preserves the decision otherwise.

## Prompt 15C-QA resolved findings

- **Draft/source mismatch:** fixed draft updates so a decision cannot be reassigned to another student or retain an academic year inconsistent with its selected source enrollment.
- **Concurrent finalization window:** finalization now atomically claims exactly one APPROVED decision inside the same transaction before enrollment/event writes; rollback tests cover target-creation failure.
- **Progression summary gap:** the decision list now shows counts by decision type as well as workflow status.

The existing SQLite `P3005` baseline debt and intentional CORRECTION-finalization limitation remain open. The first production build attempt also reproduced the known Windows Prisma DLL `EPERM`; terminating stale Node processes and rebuilding succeeded.

## Prompt 15D known limitations and safeguards

- The checklist reflects only fields already present in the ERP. Gender, admission date, staff demographic reporting fields, official UDISE+ school identifiers, and portal-specific submission fields are marked `Not tracked in ERP`; no values are inferred.
- A missing or available field is not declared legally required or compliant. School review against the latest portal and privacy/legal obligations remains mandatory.
- Aadhaar is status-only. Full Aadhaar never enters checklist page/API/CSV output; existing Aadhaar storage design was not expanded.
- Class/section strength comparison is an internal current-master versus active-enrollment consistency signal, not a government reconciliation or submission result.
- The checklist CSV is internal and formula-safe but is not an official UDISE+ schema. Viewer has no export permission by default.
- Prompt 15D required no schema or backup-format change. The existing SQLite Prisma P3005 baseline issue remains unchanged.

## Prompt 15D-QA resolved findings

- Student numeric gap totals could exceed the deduplicated visible badge set when more than one missing basic field mapped to `Missing basics`. The helper now counts unique visible non-privacy gap types.
- Academic-year text could flow directly into the checklist filename. It is now reduced to safe filename characters with a stable fallback, while retaining the non-official `planning-checklist-gap-report` wording.
- The shell theme toggle now uses the active `next-themes` provider state so the control and rendered theme stay synchronized during checklist QA.
- Static and live checks found no checklist mutation route, hidden write API, raw ID, full Aadhaar, password hash, secret, or filesystem-path disclosure.

Remaining limitations are intentional: the report reflects only existing ERP fields and current records; no official field mapping, legal-compliance decision, government exchange, Aadhaar verification, or data-fix form exists. The current database has no staff or guardian records, so those areas require school data review rather than software inference.

## Prompt 16B known limitations and debt

- The existing SQLite database is still not baselined for Prisma Migrate (`P3005`). Prompt 16B retains an additive SQL migration and uses the established direct SQLite execute path. A clean/baselined deployment process remains technical debt.
- One official APPROVED/LOCKED budget per academic year is intentional. Multi-fund or scenario budgets need a separately designed phase instead of weakening the invariant.
- Allocation actuals use a deterministic one-match hierarchy to avoid double counting. Complex shared-cost apportionment is not implemented.
- Approved expenses without a matching allocation remain in plan totals and are shown as unmatched utilized amount. They are not silently assigned.
- Revisions preserve before/after JSON allocation snapshots but are not a general version-control engine. There is no normal unlock, approved-plan delete, rollback, or direct snapshot editor.
- Thresholds are warnings only. They do not block expense creation, approval, or payment.
- No forecast, monthly budget phasing, grant/funding-source split, procurement, purchase order, inventory, payroll, cash book, income, GST filing, bank reconciliation, or gateway exists.
- Budget reports are internal management controls, not audited financial statements or statutory submissions.

## Prompt 16B-QA resolved findings and remaining gate

- **Cancellation permission bypass:** the workflow route previously treated cancellation as draft management. Cancellation now requires approval permission, and Admin/Accountant/Principal/Viewer direct calls return 403 by default.
- **Inherited threshold inconsistency:** a one-sided per-allocation override could make effective warning exceed effective critical. Validation now compares overrides after applying plan defaults.
- **Master-link transaction window:** category/department checks are now inside every plan/revision transaction that consumes them.
- **Paise display loss:** budget UI used whole-rupee formatting. Budget pages now retain up to two decimals; report aggregation remains Decimal until presentation.
- **Allocation tie ordering:** category-only and department-only matches had equal sort weight. The documented combined/category/department hierarchy is now explicit and tested.
- **Revision restore validation:** revision JSON snapshots now receive the same link, duplicate, amount, threshold, key, and total checks as live allocations, with strict plan date/year validation.

The remaining release gate is environmental: the bundled in-app Browser client throws `Cannot redefine property: process` before a page can be opened. Current responsive/theme/overflow/console QA must be rerun after the Browser runtime is repaired or restarted. This is not an application console error and does not change the prior Prompt 16B browser baseline.

## Prompt 16C resolved findings and remaining limitations

- **Received-account enum mismatch:** human-readable account labels were submitted as values and rejected by the API. Options now retain enum values while displaying public wording.
- **Prompt-based receipt cancellation:** browser prompts were fragile for kiosk and automated use. Cancellation now uses an inline reason field, explicit confirmation, and a keep-receipt action.
- **Cash-date routing defect:** serialized `Date` objects were sliced into text such as `Wed Jul 15`, causing movement and workflow APIs to reject the date. Cash-day and movement views now emit `YYYY-MM-DD`, with a defensive client normalization.
- **Browser gate cleared:** the Prompt 16C run completed at both requested viewports and themes with contained tables, no page-level overflow, and zero console errors/warnings.

The existing SQLite Prisma Migrate `P3005` baseline issue remains. The cash book is an internal physical-cash control, not bank reconciliation or an audited/statutory ledger. Locked days have no casual unlock; corrections require a documented later compensating movement. Source drift is a warning and reconciliation signal, not an automatic rewrite.

## Prompt 16D limitations and safeguards

- Book sales are operational income receipts, separate from fee `Payment` and miscellaneous-income receipt numbering and calculations.
- Book-cash settlement approval requires an existing DRAFT cash-book day. This prevents an orphaned Director handover and keeps the cash-book workflow authoritative.
- Approval creates one Director-handover movement only. Cash-counter and retained portions deliberately create no outflow; the settlement itself is not an inflow.
- Approved settlement cancellation preserves and cancels the linked movement rather than deleting it. A locked cash-book day must be corrected under the later-day compensating policy.
- Publisher pages are specialized views over the existing expense ledger. There is no separate publisher payment balance to reconcile.
- No circulation, accession register, inventory, barcode/RFID, purchase order, procurement approval, payroll, GST, bank reconciliation, gateway, or AI functionality was added.
- The existing SQLite Prisma Migrate `P3005` baseline issue remains unchanged.

## Prompt 16E library circulation planning risks

- **Sale/catalog confusion:** `BookCatalogItem` is a books-finance sale item with rates and receipt lines, not a library bibliographic title or accessioned copy. Future circulation uses separate title/copy records with optional reviewed links only.
- **Accession reuse or deletion:** accession numbers must be permanent, unique, immutable, and never reused; accessioned copies must be withdrawn/write-off preserved, not hard deleted.
- **Double issue and stale scans:** issue/return requires a server-side transaction, active-loan guard, idempotency protection, and explicit operator confirmation; browser scanner behavior alone is insufficient.
- **Transfer/exit debt:** student transfer/left finalization needs a future outstanding-library-item check or documented handover exception before records are closed.
- **Borrower privacy:** student and staff history must have allowlisted serializers, guardian-link isolation, teacher own-account scoping, masked Viewer/Auditor reports, and no raw IDs/secrets/paths.
- **Fine double collection:** future `LibraryCharge` assessment and a Miscellaneous Income receipt must be uniquely linked and transactionally guarded; never create fee `Payment` rows.
- **Historical loss:** returned/final loans, lost/damaged assessments, waivers, and stock sessions require append-only audit/correction events, not silent deletion/editing.
- **RFID lock-in/privacy:** RFID waits for reader/API/export/offline/cost/data-ownership evidence; tags are copy identifiers only, never authentication or location/child tracking.
- **Import collisions:** require preview, exact admission/staff-code matching, duplicate accession/barcode/RFID blocks, a pre-import backup, verification evidence, and reviewed recovery.
- **Stock-verification misuse:** a discrepancy is not an automatic write-off; retain session/audit history and require a separate reviewed copy-status decision.
- **Calendar dependency:** working-day due dates and holiday grace need a confirmed school calendar source; do not infer it from attendance.
- **Acquisition provenance error:** a copy-vendor/expense link must be optional and validated so the wrong vendor/invoice cannot be attached or create a duplicate expense/payment ledger.

## Prompt 16F remaining limitations

- The withdrawal guard has an explicit Prompt 16G extension point because no circulation models exist yet. Prompt 16G must replace it with a transactional open/future-loan check before enabling loans.
- ISBN is unique after normalization in this phase. Legacy records with a genuinely shared/ambiguous ISBN require operator correction or a separately reviewed migration; import does not create an exception automatically.
- Barcode is storage only. No labels, scan focus/debounce, reader integration, or RFID behavior exists.
- Import applies ready rows and reports invalid rows as partial; recovery remains pre-import backup plus reviewed correction. There is no generic rollback/delete of accessioned records because accession identity and events are permanent.
- Viewer/Auditor sees masked Vendor/Expense linkage and cannot export. Accountant, Teacher, and Parent have no library access by default.
- The documented SQLite Prisma Migrate `P3005` baseline issue remains; the schema was synchronized with the established `db:push` workflow and a migration SQL artifact is present.

## Prompt 16G remaining limitations

- Loan periods and renewals use calendar days. School-working-day, holiday, and grace-day adjustment is not built.
- Reservation expiry is an explicit staff action; there is no background scheduler.
- No borrowing policy was seeded. The school must configure and approve Student/Staff policy values before issue or reservation.
- Suspensions past `suspendedUntil` restore calculated eligibility without rewriting the preserved membership status.
- Prompt 16H Library charges collect through Miscellaneous Income exactly once. Cancelling a linked receipt does not automatically reopen the paid charge; it appends a reconciliation warning and requires an explicit authorized compensating correction, especially after Cash Book locking.
- Payment gateway, automatic fine posting, barcode labels/scanning, RFID, stock verification, procurement, purchase orders, and valuation remain intentionally absent. Barcode is Prompt 16I; stock verification is Prompt 16J.
- The SQLite Prisma `P3005` baseline limitation remains documented; the Prompt 16G migration SQL contains the membership CHECK and unique concurrency indexes.

## Prompt 16H-QA resolved findings and remaining gate

- **Incident validation gaps:** DAMAGED incidents formerly accepted cancelled loans, dates before issue, unsupported conditions, and non-available replacement copies. Server-side validation and regression tests now block each case.
- **Collection ownership recheck:** collection now revalidates the charge member's exact Student/Staff ownership inside the transaction before creating any Miscellaneous Income receipt.
- **Restore receipt collision:** a local same-ID receipt can no longer receive a paid Library charge unless its receipt identity, borrower linkage, stable Library configured item, and exact payable amount match.
- **India-local dates:** incident, assessment, resolution, and collection form defaults now use the school India-local date helper.
- **Server/client Decimal leakage:** charge and incident action/form option payloads are allowlisted and converted to plain strings/objects before entering Client Components. Production Browser smoke is clean.
- **Viewport gate:** the in-app Browser accepted the requested 390x844 override but continued rendering at 1280px; exact mobile Browser QA remains pending. Desktop overflow, table containment, labels, light/dark mode, production console, and stderr checks passed.

Intentional limitations remain unchanged: no gateway, automatic fine posting, barcode/scanner controls, RFID, stock verification, procurement, valuation, or Parent/Teacher mutation. Linked-receipt cancellation preserves the PAID charge and appends a correction warning; reopening or compensating correction remains an explicit authorized workflow. The existing SQLite Prisma `P3005` baseline issue remains.
# Prompt 16I limitation

Physical USB scanner hardware has not been certified by code alone. Keyboard-input behavior is supported; retired barcode identities have no dedicated registry in the current schema.
# Prompt 16J limitations

- USB scanner behavior is verified through keyboard-input simulation unless physical hardware is available; do not claim hardware certification.
- SQLite Prisma P3005 baseline/migration-history behavior remains documented and is not caused by the stock-verification models.
- Locked sessions have no normal unlock UI. An applied discrepancy cannot be rewritten; any correction must be a documented compensating copy event.
- Stock verification has no RFID, camera scanning, valuation, depreciation, procurement, accounting, automatic Expense/charge creation, or person-location tracking.

# Prompt 16J-QA resolved findings

- Unexpected out-of-scope observations no longer inflate expected or verified counts, and normalized exact lookups are reused when an operator explicitly adds one for review.
- Viewer is hard-limited to masked stock reports with no export or operational session navigation/API access, including when a stale role bundle still contains the former view permission.
- A restored APPLIED resolution must reference exactly one existing `LibraryCopyEvent` for that same copy; conflicting links are isolated.
- Missing application now blocks on an unresolved incident, locked scanner pages expose read-only history only, and applied corrections return idempotently without a second event.
- Reports distinguish newly proposed missing copies from existing missing copies and include safe recent scan history without actor IDs or operational notes for Viewer.
- Scanner and proposal confirmations use labeled inline reasons; mobile menu, theme, and account actions meet the 44px touch-target check.

# Prompt 17A limitations

- Teacher scope depends on active StaffMember, TimetableTeacher, and TimetableAssignment links. Incomplete ownership denies Homework access.
- Leadership create choices come from active timetable assignments.
- HomeworkViewReceipt is deferred. No viewed, delivered, completed, or submitted claim is made.
- The existing SQLite Prisma P3005 baseline issue remains unchanged.
- No submissions, uploads, grading, marks, report cards, notifications, AI generation, or attachment storage exist in Prompt 17A.
# Prompt 17B limitations and debt

- The existing SQLite Prisma P3005 baseline issue remains; Prompt 17B adds a checked-in SQL migration and uses the established baseline-safe local schema sync.
- Mark decimals allow up to four places. School policy must decide display rounding for Prompt 17C report cards.
- Admin approval/locking are intentionally disabled in recommended defaults until school policy enables them in `/roles`.
- Shared-subject Teachers can both enter only when both have explicit matching timetable assignments; there is no separate designated-primary examiner field yet.
- Approved but unlocked marks have an audited correction path. Locked assessments/exams have no normal unlock path by design.
- Internal mark reports remain assessment-level and do not persist rank, merit, progression, or Teacher performance outcomes.

# Prompt 17C limitations and debt

- Mark-based batches support one locked Exam Cycle. Multi-exam/term aggregation is deferred until the school approves a weightage policy.
- Parent acknowledgement/read receipts and a Student login are not modeled.
- Browser printing supplies A4 and ten-page KG layouts, but there is no PDF-generation package, external file storage, native signature image, or certified printer profile.
- KG attendance can be calculated only from complete locked attendance. Incomplete sources require an explicit reviewed snapshot and reason.
- Issued corrections create a new immutable version; they never overwrite an old version or alter raw mark calculations.
- Report cards display finalized progression only and never mutate Student progression.
- Teacher performance analytics and scoring remain out of scope for Prompt 17D.

## Prompt 17D limitations

- Prompt 17D implements contextual analytics but keeps composite scoring and ranking out of scope.
- Class-Teacher ownership is not a dedicated reliable source; report-card/KG completion is partial/contextual.
- Homework attribution falls back to timetable scope only without a linked creator account and is marked partial.
- Attendance denominator is available staff-attendance sessions, not an invented school calendar.
- Outcome evidence uses compatible locked aggregates and minimum cohort 5; it is never causal.
- Existing SQLite Prisma P3005 baseline remains documented; Prompt 17D uses the checked-in migration plus the established local schema-sync path.

## Prompt 18A limitations

- The school must verify TC wording/required fields with its board or state authority; the ERP does not hard-code statutory compliance.
- Corrections preserve the original number with a visible version label. A school policy requiring a new number needs a later reviewed change.
- Browser HTML print is provided; there is no certified PDF generator, signature image, authorised digital-signature system, QR verification, or public verification page.
- Attendance depends on submitted/locked records and reports missing coverage as unavailable, not zero. Study history warns when enrollment history appears incomplete.
- Certificate fees, payments, receipts, no-dues automation, and gateways are deferred to Prompt 18B.
- The existing SQLite Prisma P3005 baseline remains; Prompt 18A uses the checked-in migration plus the established local schema-sync path.
# Prompt 18B limitations and controls

- Class X Board/Migration entries are custody/status records only; no official Board document is generated.
- School leadership must verify current Board and education-authority procedures, checklist, price, wording, and handover policy.
- School certificates depend on an already issued immutable Prompt 18A version; creation is never automatic.
- Service charges use one approved Miscellaneous Income receipt and existing Cash Book derivation; there is no fee `Payment` or payment gateway.
- Parent output is ownership-isolated and masks references, contacts, actor IDs, and internal notes.
- Package eligibility/approval does not mutate lifecycle, progression, marks, exams, or report cards and does not infer Board eligibility.
- Prompt 18C is not included.
# Prompt 18C limitations

- No managed Student/Staff photo source exists. ID cards intentionally show a placeholder and reject photo-required templates or arbitrary image locations.
- SQLite migration deployment on the existing unbaselined local database reports Prisma `P3005`; schema synchronization uses the established local `prisma db push` path. A production migration baseline remains an operator task.
- Card barcodes are opaque Code 39 card numbers for authenticated exact lookup only; they do not confer authorization.

## Prompt 19A notification limitations

- `IN_APP` is the only channel. There is no WhatsApp, SMS, email, push, Firebase, service worker, provider credential/webhook, or external-delivery queue.
- Scheduled visibility is request-time deterministic rather than a background delivery job; aggregate counters are refreshed from recipient state during normal operations.
- Existing Parent Notices are a separate read-only legacy feed and intentionally have no fabricated read/acknowledgment ledger.
- Acknowledgment is operational only, not a signature or proof that a Student received/read content.
- Reports intentionally omit individual Parent non-read lists and contact/private Student data.
- Internal action paths use a deliberately narrow exact allowlist; adding a route requires an explicit role-safety review.
# Prompt 19C known limitations

- No selected SMS provider contract exists, so LIVE SMS fails closed with “SMS provider selection required” and makes no network request.
- Gmail API sending is environment-only and disabled. API acceptance produces `ACCEPTED`, never fabricated `DELIVERED`; stronger bounce/complaint evidence needs a provider with a verified webhook contract.
- SPF, DKIM, DMARC, sender alias and DLT states are operator-reviewed readiness metadata. The application does not inspect or modify DNS/DLT registration automatically.
- SMS segments, provider volumes and costs are estimates; prices and Google quotas are not hard-coded and no finance posting occurs.
- Only deterministic MOCK webhook fixtures are implemented. No inbound SMS/Email content, reply automation, attachments, HTML campaign builder, tracking pixel, OTP, or two-way inbox exists.

# Prompt 19D known limitations

- PWA installation UI and `beforeinstallprompt` vary by browser/platform; the in-app Browser may validate manifest/service-worker evidence without exposing native installation UI.
- Physical Android/iOS installation, icon masking, uninstall, standalone OS behavior, and app-store packaging are not certified.
- Production installation requires a stable HTTPS application origin; the local Windows baseline is not a public cloud deployment.
- The worker intentionally provides no offline school-data access, write queue, background sync, or push notification.
- The generic offline page is the sole cached HTML response; authenticated pages and APIs are network-only.
- A global strict CSP is deferred until the Next.js runtime-script nonce/hash strategy is separately reviewed. Prompt 19D does not weaken the existing policy.
- Prompt 19D made no schema change. Prompt 20A later added six privacy-safe AI foundation models, so backup is now version 34.

# Prompt 20A known limitations

- MOCK is the only active provider. `LOCAL_HTTP` and `CLOUD_API` fail closed and live use is disabled.
- Document retrieval is deterministic section matching over a fixed registry, not semantic/vector search.
- Aggregate tools expose only handwritten counts/sums and suppress groups below the configured privacy threshold.
- Rate/concurrency limiting is in memory per application process; multi-instance deployment needs a shared store before live-provider review.
- Audit retention is represented by `expiresAt`, but an automated purge job is not included.
- Documentation timestamps use local file modification time and do not prove external/current policy truth.
- The existing unbaselined SQLite database continues to use the established local `prisma db push` workflow after the checked-in migration; production migration baselining remains an operator task.
- No live-provider quality, privacy, cost, outage, jurisdiction, or capacity claim is made.

# Prompt 20B limitations

- OCR is untrusted and may misread handwriting. Every financial field needs source-image verification.
- Payment posting is intentionally disabled because current shared finance helpers do not prove outstanding balance, fee allocation, overpayment, receipt allocation, idempotency, and historical Cash Book behavior together.
- `LOCAL_HTTP` and `CLOUD_API` are provider-neutral disabled states only. No live provider call, process launch, model download, or image egress is supported.
- PDF/HEIC/animated images are unsupported. JPEG, PNG, and still WebP are the supported Prompt 20B source types.
- JSON backup version 35 stores workflow metadata but not source image bytes. Restored unpurged pages become `MISSING_SOURCE`.
- The established unbaselined SQLite database continues to use the documented local `prisma db push` path; migration baselining remains an operator task.
- Prompt 20C does not add OCR Payment posting or private-image backup; both boundaries remain explicit.

# Prompt 20C limitations

- MOCK objects are in-process and disappear on restart; persistent QA/rehearsal uses LOCAL_FOLDER.
- LOCAL_FOLDER is physically off-device only when the operator configures separate protected media.
- Prisma schedules require an external Windows Task Scheduler/service/hosting cron invocation.
- OBJECT_STORAGE and GOOGLE_DRIVE are deliberately disabled; no live credentials or provider SDK are present.
- Private OCR/uploaded asset bytes remain outside the version-36 database payload.
- Provider-specific immutable retention/object lock/ransomware resistance is not claimed.
- Key loss is unrecoverable; historical environment keys need independent offline custody.
- Restore rehearsal is isolated and repeated, but automated operational-database cutover is intentionally absent.
- The established SQLite P3005 baseline still requires the documented baselining task; this phase uses the checked-in migration plus local schema synchronization.
- Prompt 20D remains outside this phase.

# Prompt 21A limitations and future risks

- This phase is documentation-only. No schema, migration, route, API, permission, map, geocoder, provider call, credential, address conversion, browser location request, or persistent data change exists.
- The current Student record has one nullable unstructured `address`; its completeness, consistency, recency, and verification are unknown.
- Existing generic Student backup and CSV paths select broad Student rows. Adding coordinate fields without explicit projections could silently disclose them. This is a release blocker for Prompt 21B.
- `VIEW_STUDENTS`, `EDIT_STUDENTS`, and `EXPORT_STUDENTS` are too broad for child home-location access. Dedicated permissions and blocked-role tests are required.
- No authoritative Telangana requirement to collect residential coordinates was found in the limited official review. Qualified legal/privacy advice is required.
- Current DPDP Act/Rules commencement is staged. Exact operative dates, children’s-data duties, education exemptions, notice/consent basis, cross-border processing, and incident duties require counsel confirmation.
- Public Nominatim explicitly disallows personal/confidential submissions and is not a production option.
- Google and Mapbox pricing may be inexpensive at school scale, but storage/display terms, processor logging, transfers, deletion, key abuse, accuracy, and governance dominate the risk.
- Self-hosted Nominatim/OSM remains unbenchmarked for an India extract and would add database, update, security, backup, monitoring, licensing, and on-call duties.
- Exact residential points, live/device tracking, generic coordinate export, AI use, PWA/offline caching, public exposure, and location-based Student/family profiling are prohibited by the current decision.

# Prompt 21B preflight blockers

## SEC-1 security residuals

- SEC-1A fixed all 4 High and 18 Medium confirmed repository defects recorded in `SEC_1_SECURITY_AUDIT_AND_HARDENING_REPORT.md`; no Critical finding was confirmed.
- SEC-1-QA confirmed the reachable `xlsx@0.18.5` advisory as High and fixed it
  by exact-pinning the official SheetJS 0.20.3 tarball with lock-integrity
  regression tests. Existing 5 MB, magic, sheet, 256-column, and 2,000-row
  import limits remain defense in depth.
- Production deployment must provide bootstrap/auth/provider/pepper secrets, `APP_ORIGIN`, TLS, HSTS, immutable logs, and distributed coordination. Trust proxy headers only behind a sanitizing proxy.
- Browser restore execution is copied-QA-only and rejects operational `prisma/dev.db`.
- Report/export caps, SQLite Class X transaction uniqueness, fee log retention, and SEC-1B Browser verification remain explicit limitations.
- Prompt 21B/21C/21D remain `BLOCKED_EXTERNAL_APPROVAL`.

- Prompt 21A and Prompt 21A-QA are fully cleared, but Prompt 21B remains blocked.
- No leadership approving person, school role, approval date, scope, access/retention decision, or meeting/signature reference was supplied.
- No qualified Indian privacy/legal reviewer, professional capacity, written reference, lawful-basis assessment, child/guardian notice assessment, mandatory/optional assessment, retention/deletion assessment, processor assessment, or breach-responsibility assessment was supplied.
- The purpose, Tier 1 precision, Parent notice, field minimisation, access matrix, minimum group 10, suppressed-only export, draft retention/exit rules, incident owners, and backup/restore projection are recommendations awaiting approval.
- `OMIT_ALL_COORDINATES_FROM_21B` is the exact proposed coordinate decision, not an approved decision. Tier 3 requires a separate approval; Tier 4 and Tier 5 remain prohibited.
- All 15 mandatory release blockers are `UNRESOLVED`; final gate `PROMPT_21B_BLOCKED`.
- No schema/runtime implementation or operational data change occurred. Backup remains version 37.

## SEC-1B runtime closure

- Fixed: mobile drawer navigation links now meet the 44 px touch-target minimum.
- Fixed: unknown routes now have a neutral custom 404 with an explicit safe recovery action.
- Verified boundary: no runtime route/API 5xx or private-cache violation across 5,841 requests.
- Deployment limitation: TLS/HSTS, proxy-header stripping, centralized security logging, distributed limiter/worker coordination, and physical PWA behavior still require deployment verification.
- Dependency closure: the reachable `xlsx` advisory is fixed with exact-pinned
  official SheetJS 0.20.3; bounded file, magic-byte, sheet, column, and row
  validation remains defense in depth.
- Performance observation: copied-database full backup and the complete `/roles` matrix are the slowest safe surfaces; no destructive load test or Lighthouse claim was made.
- Governance boundary: Prompt 21B/21C/21D remain blocked and no location work was reopened.

## SEC-1-QA independent closure

- Fixed High: reachable vulnerable `xlsx@0.18.5` parser; official SheetJS 0.20.3
  is exact-pinned with lock integrity.
- Fixed Medium: ID-card print and OCR image GET paths are read-only; explicit
  same-origin POST performs print auditing.
- Fixed Medium: wrong-role Parent/Teacher notification and preference routes
  deny/redirect server-side while linked Accountant Staff consent remains
  ownership-scoped.
- Fixed Medium: exact 320×568 drawer-dismiss target now remains at least 44 px.
- Remaining dependency advisories are dev/build-only and classified
  `NOT_REACHABLE` or `MITIGATED`; deployment TLS/HSTS/proxy/log aggregation and
  multi-instance coordination remain deployment verification.
- Two cleanup inspections returned zero QASEC1QA rows/files; the copied root was
  removed and the operational database hash/totals remained unchanged.

## Prompt 23B-M Management reconciliation backlog

| Area | Current classification | Risk / evidence limit | Required next step |
|---|---|---|---|
| Cross-role Schoolknot consolidation | Evidence hold | Management is complete, but Parent, Teacher and Principal authenticated audits are pending | Do not claim Prompt 23B complete or finalise cross-role priority |
| Admissions/enquiries | Missing | Public admissions content is not CRM; Schoolknot write/export behavior is untested | M3 decision/data-minimisation/export planning before implementation |
| Payroll/payslips/salary/advance/exit | Missing / blocked approval | Staff records, Expenses and Cash Book are not payroll; salary/statutory data is highly sensitive | Respect Prompt 22/26, legal, accounting, privacy and segregation-of-duty gates |
| Events/holidays/internal calendar | Missing | Public website events are not an internal role-aware calendar | Provisional M1 only after role visibility and publication rules are evidenced |
| Transport | Missing / conditional critical | Route, vehicle, assignment, pass and reading workflows are absent; GPS was not visible | Confirm use, then safety/privacy/finance/export decision; GPS separately blocked |
| Student submissions/attachments | Missing | Homework publishing does not provide Student authorship/files/review | Hold for Parent/Teacher evidence and private storage/retention design |
| Exam consolidation | Partial | Single-source report cards exist; multiple-exam/board comparison is absent | Define academic formulas and role presentation before report work |
| Discipline/cafeteria/assets | Missing / optional | Need and role/policy evidence are incomplete | Defer to M6; do not piggyback on Library or finance models |
| Refund and Schoolknot Day Closer | Needs more evidence | No refund page was visible; Day Closer rendered blank | Obtain vendor workflow/export evidence; do not equate cancel, Daily Collection or Cash Book automatically |
| Universal audit history | Partial | Strong targeted histories exist, but not every master change has a shared audit contract | Future cross-module audit design before sensitive new modules |
| Live providers/integrations | Deployment/approval only | No Schoolknot integration centre evidence; Nalanda live adapters remain disabled | Keep credentials/providers disabled until current contract, legal, incident and reconciliation proof |
| Unsafe parity pressure | Rejected | Weak default passwords, arbitrary bulk change/export, surveillance, hard deletion and excess data would reduce safety | Enforce `SCHOOLKNOT_FEATURES_NOT_TO_COPY.md` |
| Management replacement overclassification | Documentation defect, corrected | Twelve `FULLY_REPLACED`/`NALANDA_STRONGER` rows exceeded visible/write/export/other-role evidence; inaccessible Library, backup and expense/budget/Cash Book source modules could not support comparison | Corrected to `PARTIALLY_REPLACED` or `NEEDS_MORE_EVIDENCE`; focused QA locks the decisions |

Prompt 23B-M-QA found and corrected 13 documentation-quality defects: 12 classifications plus the missing explicit evidence column in the should-not-copy register. Result: `MANAGEMENT_RECONCILIATION_CLEARED` for Management-only reconciliation. No runtime/data defect or module was introduced. Prompt 21B/21C/21D remain blocked; Prompt 22B remains conditional; final Prompt 23B awaits Parent, Teacher and Principal audits.

## DEVOPS-1A baseline limitations and controls

| Area | Status | Risk / evidence limit | Required control |
|---|---|---|---|
| Private Git visibility | Private-only baseline | A later visibility change could expose the complete source and security design | Keep `vsairohith67/nalanda-school-erp` private and independently verify visibility before every release handoff |
| Operational recovery data | Intentionally excluded | Git cannot recover the SQLite database, backup JSON, OCR/uploads, or provider objects | Use the separate versioned backup/disaster-recovery workflow and verify custody/hash before restore |
| Clean-install migrations | Known unresolved baseline limitation | The existing Prisma migration chain is not yet the trusted clean-install path | Repair only in DEVOPS-1B after DEVOPS-1A-QA; never experiment on the operational database |
| Credential history | Preventive scanner added | No scanner can prove that a provider-side value was never disclosed elsewhere | Rotate/revoke on suspected exposure; do not rely on deletion or a later commit |
| Git hosting continuity | Private GitHub dependency | Local and remote availability are separate from operational backup availability | Keep the stable annotated tag, verified local clone, and independent non-Git operational backups |

DEVOPS-1A changes no Prisma schema, migration, route/API boundary, operational record, Prompt 21/22 decision, or Schoolknot role-audit status.

## FIN-2A Accountant privacy and receipt integrity

FIN-2B intentionally supersedes only the Accountant cancellation/correction authority statements below. The retained FIN-2A privacy, projection, export, audit, split-receipt and reconciliation controls remain mandatory.

RECON-1A records the parallel Prompt 23B/FIN-2B execution and the preserved final lineage without rewriting either feature branch. FIN-2A and FIN-2B are complete: an Accountant needs the exact cancellation/correction permission; every successful action is audited and notifies active Directors/Super Admins; and non-mutable days block ordinary action without silently rewriting the stored snapshot. No approved `FIN-2C` scope exists. Refund, gateway/settlement, Day Closer, payroll and employee self-service remain separate evidence/approval items, not unfinished FIN-2A/FIN-2B defects.

Resolved:

- Broad Accountant Student access was replaced by an exact-admission finance lookup and explicit response allowlists.
- Accountant Parent/contact reminder permissions remain non-delegably denied. Final-receipt cancellation and correction are deliberately authorised only through the exact FIN-2B permissions; broad finance or legacy payment permissions cannot substitute.
- Viewer/Auditor student-level ledger access is non-delegably denied; dues and collection remain aggregate-only.
- Generic and specialized Accountant finance exports now have purpose/field contracts, formula neutralisation, private/no-store headers, safe filenames, 2,000-row limits, bounded date scopes where applicable, and append-only export audit.
- Whole-receipt cancellation is available to Super Admin, Director and an Accountant with `CANCEL_FINAL_RECEIPT`; governed correction requires `CORRECT_FINAL_RECEIPT`. Both are reasoned, versioned, transactional, append-only and safe for split Cash/UPI components. Successful Accountant actions notify active leadership.
- `Payment` components now define the effective receipt state. Mixed component state and `ReceiptNote` disagreement fail closed across receipt, ledger, dues, collection, dashboard/export, audit, and Cash Book calculations.
- New audit JSON uses a restricted snapshot; historical broad JSON is redacted before restricted output.
- Final verification caught a backup-time seeder that rewrote six existing operational permission overrides. The seeder now creates missing rows without modifying existing rows; a byte-identical rollback restored the authorised operational checkpoint and a repeat backup proved no hash/timestamp change.

Remaining:

- There is no partial final-receipt cancellation, refund, gateway reversal or chargeback. FIN-2B blocks ordinary Accountant action on non-mutable accounting days and routes review to existing authorised leadership without rewriting the locked snapshot.
- Old broad `PaymentAudit` JSON may remain at rest in an existing database. It is response-redacted, but an at-rest migration would require separate retention/legal/schema approval.
- `ReceiptNote` is synchronized metadata, not a separately versioned approval model.
- SQLite remains a supported single-instance write architecture; horizontal scaling is not approved.
- FIN-2A-QA independently verified the feature branch with new FIN2AQA fixtures. The only QA defect was missing native `required`/`minLength=3` semantics on the otherwise enforced cancellation reason fields; both dialogs were corrected and reverified.

## Prompt 23C Teacher attendance exact-scope disposition

Resolved:

- Permission-only Teacher cohort access across list, mutation, report, CSV and
  dashboard totals was replaced by one exact active
  `User -> StaffMember -> TimetableTeacher -> assignment/substitute` resolver.
- Cross-Teacher, class, section and year tampering; inactive or missing links;
  expired/cancelled substitutes; unrelated objects; and permission-only access
  fail closed without Student identity leakage.
- Mutation is POST-only, same-origin, bounded, expected-version protected,
  serializable and append-only audited. Correction requires a reason and an
  actual change.
- Prompt 23C-QA independently passed copied-database, production HTTP,
  desktop/mobile light/dark Browser, concurrency, privacy and cleanup gates.

Remaining:

- Overall Teacher replacement is still `CONDITIONAL`; own timetable,
  Classwork, marks/report-card, communication and remaining role QA are not
  made complete by this attendance clearance.
- The current model represents a multi-day substitute as one confirmed row per
  date. A range model or explicit class-wide attendance-owner concept would
  require separate schema, policy and security review.
- Horizontal multi-instance writes remain outside the supported SQLite
  architecture.

## EXAM-RC-IMPL-2 marks/calculation debt and boundaries

Resolved:

- exact Teacher object scope is shared across page, rows, draft, submit and
  correction;
- primary and contributor ownership remain distinct;
- zero, absent, exempt, N/A and not-entered are distinct;
- correction creates an immutable superseding sheet version;
- calculation fingerprints make reruns deterministic and preserve prior
  Student snapshots;
- backup version 37 now includes the complete governed examination, assignment,
  marks, audit and result-snapshot graph with validated restore ordering and
  repeated-restore idempotence;
- low-memory typecheck is split into complete sequential shards.

Retained debt:

- the legacy Exam/Marks and issued report-card models remain for compatibility
  and must not become governed calculation sources;
- calculation services use runtime-validated flat Prisma graphs with
  `@ts-nocheck` to avoid generated relation-type expansion; runtime copied-DB
  coverage and schema tests are mandatory until this is safely refactored;
- `StudentResultSnapshot.runStatus` is creation metadata; the authoritative
  lock is the append-only calculation audit event;
- no report publication, Parent/Student delivery, PDF, merged PDF, ZIP or
  physical print layout exists in this phase;
- report publication work remains gated to `EXAM-RC-IMPL-3`.
