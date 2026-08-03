# Nalanda Fee Control — Major Prompt and Phase History

## AUTH-2B-QA - Independent alias, recovery and session security QA (2026-07-31)

Independent QA cleared all five governed alias types, anti-enumeration,
attempt-limited possession verification, single-use credential-version-bound
reset, forced-failure rollback, central session rotation/revocation and
privacy-safe account activity. Version-37 backup/restore preserves auth
security history while excluding every credential/hash and restoring all
sessions revoked. Fresh/copy/schema/restore rehearsals passed twice; Browser QA
passed at 1366x768 and exact 390x844 in light/dark themes with 44 px controls,
keyboard-complete dialogs, zero overflow and zero clean-runtime console/stderr.
No live provider, deployment, account activation or IAM-1A capability was added.

## AUTH-2B - Verified Login Aliases, Recovery and Session Registry (2026-07-31)

Implemented one additive migration for username/work email/personal email/mobile
and explicitly linked admission-number aliases; hashed expiring possession and
reset records; credential-version binding; persisted revocable sessions; masked
login activity; and public generic recovery. Existing usernames alone are
backfilled. Profile contact fields are not promoted. The only delivery adapter
is an operationally refused copied-database local test sink; no live provider or
account activation occurred. The retained feature branch was independently
reviewed before fast-forward release; no deployment or live-provider activation
was authorised.

## EXAM-RC-IMPL-3-QA - Independent publication and PDF QA (2026-07-31)

Independent QA cleared exact locked-snapshot sourcing, governed Principal
publication, immutable replacement/withdrawal, issued-only linked-Parent
delivery, private individual/merged/ZIP PDFs, colour and printer-safe
monochrome output, failure rollback, bounded concurrency, backup version 37 and
restore-twice idempotence. Fresh ignored `EXAM3QA` copied-database fixtures were
destroyed and cleanup was inspected twice; the operational business baseline
remained zero. Browser and print QA passed at 1366x768 and 390x844 in light and
dark application themes with 44 px actions, zero document overflow, no native
dialogs, no console/hydration errors and no production stderr. Cloud deployment
remains unauthorised.

## EXAM-RC-IMPL-3 — Report Publication, Parent Delivery and PDFs (2026-07-31)

Implemented Principal readiness and exact locked-snapshot preview,
individual/section/class publication, immutable issued versions, governed
withdrawal/replacement, Parent issued-only linked-child delivery, four frozen
template families and private colour/B&W individual, merged and ZIP PDFs.

Publication preserves the source calculation run and Student snapshot version;
it does not recalculate or change approved marks/formulas. Server-side object
authorisation, origin/CSRF, no-store, expected-version checks, idempotency,
bounded 60-report jobs, two-worker concurrency, five-minute authenticated
downloads, append-only audit and failed-package rollback are enforced.

Ignored EXAM3 copied-database QA covered five Students, all four layouts,
explicit absent/zero/exempt/N/A states, long content, two linked children, an
unrelated child, replacement v2, concurrent merged/ZIP generation and injected
PDF failure. Browser/print inspection covered 1366x768 and 390x844, light/dark
application themes and independent colour/monochrome output. This historical
implementation checkpoint was subsequently cleared by
`EXAM-RC-IMPL-3-QA`; no cloud deployment was performed.

## EXAM-RC-IMPL-1-QA - Independent scheme and assignment QA (2026-07-30)

Independently verified the pushed feature commit on the exact retained branch
and private origin while `main` remained unchanged. The EXAM1QA copied matrix
covered raw/weighted configuration, subject/paper overrides, grade,
co-scholastic and template versions, clone/freeze/archive/concurrency,
permission boundaries and exact primary/contributor Teacher ownership.

QA corrected examination-level concurrency, paper/component cross-wiring,
active/frozen assignment correction, contributor-final-owner protection,
Teacher state revalidation, human labels, accessible confirmation and 44 px
targets. Principal/Teacher Browser QA passed at 1440x900 and exact 390x844 in
light/dark with no overflow, raw IDs/enums, console errors or clean-runtime
stderr. Copied fixtures/state were destroyed and cleanup was confirmed twice.

Fresh/existing/restore-twice rehearsal passed. Protected raw and version-37
rollback artifacts were created, then the additive migration was deployed
twice idempotently to the operational database. Its physical SHA-256 became
`1288102356A1D4EE5CFCBF08C1D79306EC758FF905BC091660EC195B6BF64F8A`
while the application-data digest, zero-business baseline, four account
states, integrity and foreign keys remained exact; all new tables are empty.

Final verification passed 278 page routes, 391 API routes, zero-write
lifecycle, typecheck, 1,596 tests across 172 files, 214/214 static pages with
the bounded heap, version-37 backup and Git safety. Release tag:
`exam-scheme-foundation-v37-2026-07-30`. Next:
`EXAM-RC-IMPL-2 — Teacher Marks Entry, Moderation and Calculation Foundation`.

## EXAM-RC-IMPL-1 - Examination scheme and assignment foundation (2026-07-30)

Started from dynamically captured synchronized private `main` commit
`de5fb89a0c5582443c839bbff2e176f99d7ba293`, with
`ux-shared-shell-v37-2026-07-30` verified as an ancestor, clean Git/migration
state, and the exact zero-business/four-account operational checkpoint.
Created only `feature/exam-scheme-assignment-foundation`; history was not
reset or rewritten.

Implemented the additive, versioned examination domain, Principal configuration
pages/APIs, explicit `RAW_SUM` and `WEIGHTED_NORMALIZED` validation, components
and maxima, subject papers/groups, grade/co-scholastic/template bindings,
activation/freeze/archive audit, and exact timetable-backed primary/contributor
Teacher assignments. No universal historical weighting is supplied.

The single additive migration passed fresh and copied existing-database
rehearsals. `EXAM1` copied fixtures covered configuration, overlap rejection,
activation/freeze and version cloning. Principal and Teacher assignment views
passed desktop and exact `390x844` mobile Browser checks in light/dark;
Teacher access to Principal setup failed closed. The isolated runtime, fixture
copy, credentials and state were destroyed, and the operational business
baseline/hash remained unchanged.

Final verification passed 278 page routes, 391 API routes, lifecycle with zero
writes, default-memory sequential typecheck, all 1,594 tests across 172 files,
the 214-static-page bounded production build, version-37 backup
`nalanda-fee-control-backup-2026-07-30-20-02.json`, and Git safety. The
operational SHA-256 remained
`9A888627EA2AF32433FDBA4F2F5D02C471995145E41ACE9A6D1CD0729C6EAE93`
with integrity `ok`, zero foreign-key violations and no examination tables
applied.

The Canvs master and detailed Examination boards were updated and re-fetched.
The feature branch is intentionally not merged. Marks entry, Student result
calculation, publication and bulk PDF generation are deferred. Next:
`EXAM-RC-IMPL-1-QA`.

## UX-1A - Shared login, header, navigation, and design system (2026-07-30)

Implemented the exact Nalanda public sign-in identity, safe generic login
feedback, password visibility/Caps Lock/busy semantics, real policy/support
links, shared design tokens, official transparent logo derivative, compact
desktop/mobile role-aware shell, human designations, one authenticated
academic-year control, account/change-password/logout actions, separate health
and deployment-readiness presentation, and accessible state pages.

Browser QA uses a copied operational database and eight random-password
synthetic roles. It validates all seven required viewports, zero overflow,
light/dark, drawer focus trap/Escape/focus return, named account menus,
permission-derived navigation, logout, change-password surface, Viewer denial,
404, and no native dialogs. The operational zero-business and exact account
baseline/hash remain unchanged.

UX-1A adds no schema, migration, authentication model, real account activation,
report-card logic, Teacher-attendance scope, role switcher, password-reset
backend, academic-year creation, Sentry, or PostHog. AUTH-2B, IAM-1A,
SUPPORT-1A, and OBS-1A remain future phases. Branch
`ux/shared-login-shell-redesign` was retained through the independent UX-1A-QA
gate; the later closure entry records the cleared release.

## Prompt 23C - Teacher attendance exact timetable scope (2026-07-29)

Started from dynamically captured synchronized private `main` commit
`39d4b5a495273d45656a981cd66ea3da2eaacdde` after verifying the reachable
operational-migration-baseline tag, Git safety, clean migration status,
zero-data operational baseline and exact account states. Created only
`security/teacher-attendance-exact-scope`.

The pre-change path treated Teacher attendance permission as global cohort
authority. Prompt 23C adds one shared resolver requiring active User/session,
active linked Staff and timetable Teacher, exact active current-year
class/section assignment or confirmed same-date substitute. The same target
governs selector, list, mark/bulk/submit/correct/lock, report, CSV, Teacher
portal and dashboard paths. Cross-class/section/year/date and unrelated Student
tampering fail closed.

Mutations now have a 512 KiB route body cap, 2,500-record bound, exact
`updatedAt` compare-and-set in a serializable transaction, reasoned submitted
correction and append-only privacy-safe audit. The UI exposes only authorised
cohorts, safe one-option defaults, an unlinked empty state, dated-substitute
notice, 44 px mobile controls, wrapped tables and accessible in-app correction
confirmation.

Ignored copied-database QA uses only namespaced `QA23C` fixtures. It proves two
Teacher boundaries, unlinked empty state, date-limited substitution, shared
report/CSV scope, leadership/non-teaching role boundaries, one-winner
concurrency, operational hash preservation and exact non-QA logical restoration
after idempotent cleanup.

Final verification passed 274 page routes, 378 APIs, lifecycle zero-change dry
run, typecheck, 1,576/1,576 tests across 170 files, all 212 production-build
entries with the bounded 4 GB heap, backup version 37 and Git safety.
Production Browser QA passed 1366x768 and exact 390x844 in light and dark
modes with 44 px mobile targets, contained tables, zero page overflow, no
native dialogs, no console/hydration errors and zero production stderr. The
copied database passed all eleven proofs, two complete idempotent cleanups,
pre-fixture digest restoration and destruction. The operational database hash,
zero-data baseline, account states and sole migration remained exact.

Implementation result: `READY_FOR_PROMPT_23C_QA`. Teacher cutover remains
`NO_GO_PENDING_PROMPT_23C_QA`, the feature branch remains unmerged, and no
schema, migration, operational account, business/configuration row, Parent
attendance, timetable UI, Classwork or calendar behavior changed.

## DATA-0B - Controlled verified sample/QA cleanup (2026-07-28)

After DATA-0A-QA returned `SAMPLE_DATA_PROVENANCE_CLEARED`, DATA-0B made demo
business seeding fail closed, captured the exact required user approval,
created protected v37 and byte-identical pre-clean backups, rehearsed restore
and applied one locked transaction to the exact six-table manifest. It deleted
8 verified sample Students, 8 enrollments, 8 lifecycle events, 19 Payments
(11 verified sample and 8 verified QA), 19 audits and one receipt note. No
potentially real or unknown row was in scope.

The new operational baseline is 0 Students / 0 active enrollments / 0 Payments /
₹0 collected, with zero Guardians, Staff, residue, sample markers, or foreign
key violations. Intentional settings, roles, 2,696 permissions, masters,
templates, provider configuration and four authorized accounts remain.
Receipt sequencing was preserved. Accounts require the separate mandatory
`AUTH-2A` named-owner/password-rotation follow-up.

The first post-clean blank-database rehearsal correctly exposed a v37 defect:
the backup omitted the full `SchoolSettings` singleton. An allowlisted,
backward-compatible snapshot and idempotent restore upsert fixed it. The
post-clean backup then restored twice with the zero baseline and retained
configuration. Production Browser QA passed desktop and exact 390×844 mobile,
light/dark, empty states, portal isolation, two restarts, zero Browser
console/hydration errors and zero production stderr. DATA-0B-QA independently
repeated the protected backup/restore-twice, zero-data, integrity,
configuration, seed-refusal, ignored-artifact, Browser and restart gates. Its
result is `CLEAN_ZERO_DATA_BASELINE_CLEARED`; the branch is authorized for the
required fast-forward merge and clean-baseline tag.

## RECON-1A - Parallel Prompt 23B and FIN-2B policy reconciliation (2026-07-28)

Prompt 23B and FIN-2B were initiated as parallel workstreams. The preserved final Git lineage is Prompt 23B commits `737ee86`/`9752304`, then FIN-2B commits `65b4b00`/`f1c29de`; the common ancestor of the two retained feature branches is `9752304`. Both branches and their existing annotated tags remain visible, and synchronized `main` already contained every verified feature commit before the documentation-only reconciliation branch was created.

The final policy supersedes only stale Accountant final-receipt wording. FIN-2A privacy/export/`Payment`-`ReceiptNote` integrity is complete. Exact `CANCEL_FINAL_RECEIPT` and `CORRECT_FINAL_RECEIPT` authority governs whole-receipt cancellation and immutable correction/reissue; every successful Accountant action is audited and notifies all active Directors and Super Admins; and non-mutable days block ordinary Accountant action without silently rewriting the locked snapshot. No FIN-2C scope is approved. Refund, gateway/settlement, Day Closer, payroll and employee self-service remain separate gates. Teacher attendance NO-GO and every unrelated Prompt 23B conclusion remain unchanged.

## FIN-2B-QA - Independent Accountant receipt governance QA (2026-07-28)

Independently exercised FIN-2B on a fresh copied database with `FIN2BQA` fixtures across all eight roles. Exact permissions, authenticated page/API access, reason/version/origin validation, immutable non-financial correction, financial cancellation/reissue, receipt-number immutability and linkage, split-component and `ReceiptNote` consistency, dues/Ledger/collection/Receipt Audit/Cash Book/dashboard/print/export reconciliation, open/locked days, exactly-once private leadership inbox rows, missing-leader warning, retry/concurrency, forced rollback and in-app-only delivery all passed.

QA found and fixed two defects: generic payment viewers could load the governed correction page, and version-37 restore skipped `PaymentAudit` history when the original actor login was unavailable. The page now requires one exact governed action authority before receipt lookup. Restore preserves the original actor label while safely linking the immutable row to the authorised restore operator. A copied backup/restore retained 27 payment components, 19 audits, nine ReceiptNotes and the `973103` to `973103-R1` correction history, and a repeated restore was count-idempotent.

Production Browser QA passed at `1366x768` and exact `390x844` in light/dark mode with locked-day warning, Director/Super Admin inboxes, denied Admin page access, no overflow or sub-44px visible mobile control, accessible modal focus behavior, no native dialog, zero console/hydration warnings or errors, and zero stderr bytes. Cleanup returned zero FIN2BQA rows twice and removed the copy, credential state, scripts and logs. Full verification passed 274 pages, 378 APIs, zero-write lifecycle backfill, typecheck, 1,520 tests across 165 files, 212/212 build output, version-37 backup/restore and Git safety. Prompt 23B Teacher attendance NO-GO and every unrelated Prompt 23B decision remain unchanged.

## FIN-2B-R - Accountant final-receipt cancellation, correction and leadership notification (2026-07-27)

Resumed from the authorised Prompt 23B-QA-cleared `main` checkpoint `9752304952a02d840a5d2a629b0f1896d0589a1b`; the earlier FIN-2A commit remains an ancestor. FIN-2B intentionally supersedes only Prompt 23B/FIN-2A Accountant cancellation wording. It adds exact `CANCEL_FINAL_RECEIPT` and `CORRECT_FINAL_RECEIPT` authority, accessible in-app confirmation, whole split-receipt cancellation, immutable non-financial correction, governed linked cancellation/reissue for financial correction, locked-day protection, audit-event-keyed Director/Super Admin notifications and missing-leadership warning. Cancellation/correction is not deletion or refund.

Copied-database fixtures verified cancellation idempotence, split Cash plus two UPI components, `ReceiptNote`, dues/allocation reopening, Daily Collection/Cash Book/dashboard exclusion, print/audit state, non-financial correction, linked financial reissue, locked-day denial and leadership correction source drift, exactly-once minimized notifications, missing-leader handling and unchanged operational integrity. Final Browser/full-regression/backup/publish evidence is recorded only after those gates pass.

Prompt 23B was completed before FIN-2B. Teacher attendance NO-GO, Parent gaps, Principal least-privilege conclusions, Management evidence, the unrelated 109-item evidence ledger and all other Prompt 23B decisions remain unchanged.

## Prompt 23B-QA - Independent final consolidation QA (2026-07-26)

Independently re-fetched the complete Notion audit without reopening Schoolknot and matched all 109 unique source IDs, workflow labels, exact dispositions and rationales to the repository ledger. All eight dispositions and the 22/22/26/20/19 role split were preserved. Earlier role reports remained before the single Prompt 23B append and verification closure; the appended content contained no exposed email or phone value.

Repository inspection reconfirmed the five role decisions, Parent linked-child enforcement, academic-first Principal policy, FIN-2A clearance and the Teacher attendance defect. Teacher defaults grant Student attendance view/manage/submit, the page lists all active cohorts, and the page/GET/POST/report paths contain no `User -> StaffMember -> TimetableTeacher -> TimetableAssignment` or dated-substitute authorization. The operational database currently has no Teacher user, active teaching Staff link, timetable Teacher, assignment or substitute, so the defect is dormant rather than disproved and Teacher remains `NO_GO`.

QA found one documentation defect: the 23C-23J roadmap compressed schema, provider, migration, release-gate and cutover-impact details instead of naming each contract explicitly. The roadmap and focused reconciliation test now require those fields for every prompt. No business feature, schema, migration, page, API, operational record, Schoolknot export/credential, provider or deployment was added. Corrected-branch verification is 274 page routes, 378 APIs, lifecycle dry-run with no change, typecheck, 1,507 tests across 164 files, 212/212 build entries with the established bounded heap, backup version 37 and unchanged operational integrity. Prompt 23C may begin from the merged/tagged QA baseline; it does not authorize Teacher cutover.

## Prompt 23B - Final Schoolknot multi-role consolidation (2026-07-26)

Started from clean synced `main` at `a3e55f34531f1bdc0a06e8b93c25690fb4d87563` after exact operational integrity verification. Re-fetched the authoritative Notion audit without reopening Schoolknot. Verified completed Management, Parent, Principal, Teacher and Accountant/Employee evidence, `READY_FOR_PROMPT_23B`, and exactly 109 unique unresolved items with one of all eight authorised dispositions.

Created the final replacement matrix, exact evidence ledger, five-role permission/privacy comparison, Teacher attendance cutover blocker, should-not-copy supersession, role/migration/vendor/write/deployment/privacy/training gates, 23C-23J roadmap, synthetic-write plan, vendor/export pack and final decision. The current code inspection confirmed that Teacher Student attendance is permission-only and not exact-timetable scoped; Teacher remains `NO_GO`.

Prompt 23B made no schema/migration/business page/API/operational DB/Schoolknot data/provider/deployment change. FIN-2A remains `FINANCE_PRIVACY_AND_RECEIPT_INTEGRITY_CLEARED`. DEVOPS-1D is `PAYMENT_GATED_DEFERRED`; Prompt 21B-21D are blocked; Prompt 22B conditional and Prompt 22C-22D blocked. Prompt 23C was gated on independent 23B-QA, which is recorded above.

## DEVOPS-1C — HTTPS staging architecture and local readiness (2026-07-23)

Continued from the fully cleared DEVOPS-1A/1B checkpoints on feature branch `devops/staging-readiness-plan`. Inventoried Next.js/Prisma/SQLite, every persistent write class, providers/jobs, security headers, proxy/IP logic, logging, health and PWA. Selected restricted single-instance SQLite staging; recommended a 2 GB Linux VPS in Mumbai and a paid managed container with one persistent disk as fallback; rejected serverless and ephemeral-disk platforms. Added a fail-closed secret/path/provider environment validator, a non-mutating health route, trusted-proxy dual opt-in, staging process templates, synthetic deployment/rollback/privacy/PWA/cost plans and focused tests. The ignored local rehearsal passed fresh migration, synthetic seed/backup, production start, loopback HTTPS proxy, secure cookie, HSTS, private/static cache checks, persistent restart and rollback to a distinct prior build.

No cloud deployment, externally accessible server, account/resource purchase, DNS/Google Workspace change, operational database onboarding/upload/migration, production secret, live WhatsApp/SMS/Email/AI/OCR/cloud-backup/payment provider, Prompt 21/22 expansion or Schoolknot gap implementation occurred. Physical PWA certification and Parent/Teacher/Principal Schoolknot audits remain pending.

DEVOPS-1C implementation verification: 274 pages, 377 APIs, typecheck, 1,471 tests across 162 files, 211/211 static pages and Git safety passed. Final clean backup is version 37 `nalanda-fee-control-backup-2026-07-23-04-19.json`. Operational database SHA-256 `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392`, 4,771,840-byte size, timestamp, schema/migration hashes and the 8/8/19/₹99,100 business baseline remained unchanged. This is feature-branch readiness evidence, not a staging deployment claim.

DEVOPS-1C-QA independently corrected release-local `.env*` detection, PWA build-ID mixing, rehearsal cookie/PFX cleanup, environment inventory, immutable systemd boundaries and Next cache placement. A new ignored synthetic root passed fresh migration/status, validation, backup, loopback HTTPS/proxy/cookie/cache, restart and distinct-build rollback. QA regression passed 1,473 tests across 162 files and 211/211 static pages; final operational backup is version 37 `nalanda-fee-control-backup-2026-07-23-04-38.json`. No Schoolknot implementation boundary changed.

## Prompt 22A-QA — Staff DOB, EPFO/EPS and Age-58 Planning QA

Reverified the Prompt 22A package against current official EPFO, India Code, Ministry of Labour and Employment, PIB and MeitY sources. Confirmed that age 58 is only a human EPS administration review trigger; it is not automatic retirement, termination, eligibility, a claim, contribution action or a pension promise. Confirmed full-UAN omission, masked-last-four evaluation, distinct unknown/unverified states, Director-only reminder defaults, purpose-based role access, privacy/retention controls, deterministic India-local reminder design, no-certification checklist wording and exact 22B/22C/22D separation.

Fixed three documentation-precision defects: added an official-only authority statement, stated explicitly that reminders create and submit no EPFO claim, and separated public read-only portal review from prohibited authentication/provider/API/action calls. No schema, migration, route, API, permission, Staff DOB/EPFO/UAN record, reminder, compliance workflow, portal integration, credential, operational record or backup-version change was made. Final evidence: 274 pages, 376 APIs, 1,419 tests across 156 files, 211/211 static pages built, and backup version 37 `nalanda-fee-control-backup-2026-07-20-11-32.json`; schema and operational database hashes/totals remained unchanged. Release result: `PROMPT_22A_CLEARED_BUT_22B_CONDITIONAL`.

## Prompt 22A — Staff DOB, EPFO/EPS Status and Age-58 Reminder Planning

Completed a documentation-only review of the current Staff schema, employment/joining/status fields, role/permission and linked-Staff self-service architecture, audit/event patterns, sensitive identifier masking, backup/cloud encryption, PWA/AI/public boundaries and operational baseline. Reviewed current official EPFO scheme/FAQ/portal/profile-correction sources, the Code on Social Security transition and 2026 Central Rules, and phased DPDP commencement.

Defined the non-employment age-58 boundary; recommended 365/180/90/30/date-reached/overdue review milestones; classified every proposed field; omitted full UAN and the lossy UAN boolean; required controlled unknown/disputed/guidance states; specified DOB correction/history/timezone/leap-day rules; designed dedicated role permissions, retention/backup exclusions, Director-only reminders, a no-certification checklist and exact 22B/22C/22D boundaries.

Decision: `PROMPT_22B_CONDITIONALLY_APPROVED`. Prompt 22B remains limited to neutral human-reviewed fields, correction/verification, permissions, append-only events and backup/restore after leadership/professional/privacy conditions. Prompt 22C and Prompt 22D retain separate blocked gates. No schema, migration, route, API, permission, runtime field, Staff DOB/EPFO/UAN record, reminder, portal call, credential, Staff/finance/attendance mutation, backup-version increase or Prompt 21B/21C/21D work was performed. Final command evidence is recorded in the release handoff.

## SEC-1-QA — Independent adversarial security and runtime closure

Rechecked SEC-1 without trusting the earlier conclusions, using a new
byte-for-byte copied database, fresh `QASEC1QA` fixtures, local MOCK/disabled
providers, a complete 5,850-request nine-role route/API sweep, safe adversarial
probes, and an optimized Browser pass at 1366×768, 768×1024, 390×844, and
320×568 in light/dark mode.

The independent pass confirmed and fixed one High reachable SheetJS dependency
advisory and three Medium defects: state-changing GET behavior, misleading
cross-portal wrong-role 200 responses/matrix semantics, and a scrollbar-reduced
mobile drawer dismiss target. Regression tests were added. Browser console,
hydration errors, and production stderr were zero. Two cleanup inspections found
zero QA rows/files, the copied root was removed, and the operational database
hash/totals remained unchanged. Final evidence: 274 pages, 376 APIs, 1,410 tests
across 155 files, 211/211 static pages built, and clean backup version 37
`nalanda-fee-control-backup-2026-07-20-08-31.json`. Release decision:
`SEC_1_FULLY_CLEARED`. Prompt 21B/21C/21D remain blocked.

## Prompt 19B — WhatsApp Business One-Way Communication Foundation

Added official Meta Cloud API and MOCK adapters, disabled LIVE activation, explicit Guardian/Staff phone-bound consent, approved mappings, Prompt 19A reuse, preview/approval/queue/worker/retry/cancel, signed monotonic status and opt-out webhooks, quiet hours, versioned estimates, masked reports/CSV, Parent/Teacher isolation, sixteen permissions, ten pages, protected APIs/commands, and backup/restore version 31. Prompt 19C was not started.

This is a functional history, not a verbatim transcript. Exact test counts from every old phase were not preserved. Unless noted otherwise, each completed phase was checked with the relevant targeted tests and the release checks available at that time. The verified baseline after Prompt 14C-QA is 342 passing tests across 58 files, passing typecheck, passing production build, and backup version 12.

## Prompt 17B-QA — Exams and Marks Foundation QA

**Goal:** Independently verify exam configuration, assessment sheets, Teacher scope, mark workflow safety, preview-first import, internal reports, privacy, and backup/restore without adding report cards or publication.

**QA fixes:** Corrected intentionally class-wide enrollment matching across marks entry, import, reporting, backup validation, and restore; blocked approved-mark correction after exam cancellation; aligned the explicit `Apply Marks Correction` action label; and added visible zero-assessment configuration gaps plus result-distribution reporting. Version-24 restore now accepts blank class-wide sections and blank optional main-component names while retaining exact-link and collision protections.

## Phase 1 — Core fee app

**Goal:** Create the basic local school fee-control application.

**Implemented:** Dashboard, Student Master, payment entry/list, pending dues, student ledger, daily collection, fee settings, basic import/export, and local SQLite storage.

**Verification:** Functionality is covered by the current full typecheck/test/build baseline.

**Limitations:** Early scope was local-first and did not yet include mature authentication, audit, restore, import verification, or timetable.

## Branding and dark mode

**Goal:** Make the app recognizable and comfortable for daily school use.

**Implemented:** Nalanda branding, school identity display, responsive application shell, theme provider, and light/dark theme control.

**Verification:** Current build and navigation tests pass.

**Limitations:** Branding is configured for this school; there is no multi-school theming system.

## Authentication, roles, and audit

**Goal:** Protect data and separate Director, Admin, Accountant, and Viewer responsibilities.

**Implemented:** Login/logout, signed sessions, server/API permission guards, role permission map, payment cancellation/edit controls, payment audit history, and unauthorized handling.

**Verification:** Permission, password-control, payment-control, receipt-audit, and navigation tests pass in the current suite.

**Limitations:** Local password authentication only; no email recovery, SSO, MFA, or internet-facing security review.

## Receipts and reminders

**Goal:** Support reliable receipt printing and parent due communication.

**Implemented:** Grouped receipt print, split-receipt handling, cancellation markings, receipt audit classifications, WhatsApp message preparation, open-WhatsApp links, and reminder CSV export.

**Verification:** Receipt, receipt-audit, reminders, typecheck, and build pass.

**Limitations:** Browser printing only; no WhatsApp API or automated message delivery.

## Backup

**Goal:** Export a safe complete copy of operational data.

**Implemented:** Full JSON backup download, CLI backup script, timestamped filenames, Windows helper, safe user metadata, and password-hash exclusion.

**Verification:** Backup tests and `pnpm backup` pass.

**Limitations:** Backups require an operator to copy files off the computer; no automatic remote backup service.

## Restore

**Goal:** Validate and restore backup data safely.

**Implemented:** JSON validation, preview counts/warnings, exact confirmation text, transaction-based restore, created/updated/skipped/error reporting, user-login safety, and older-backup compatibility.

**Verification:** Restore tests and current full checks pass.

**Limitations:** Restore must be tested on a copied database; no one-click rollback of a restore.

## Student import

**Goal:** Import inconsistent school Student Master Excel/CSV data safely.

**Implemented:** Header normalization, preview, errors/warnings, duplicate handling, create/update modes, error CSV, Faculty Child defaults, status/class/start-month normalization.

**Verification:** Student-import and validation tests pass.

**Limitations:** Source files still require human review; ambiguous records cannot be safely guessed.

## Payment import

**Goal:** Import daily collection rows and preserve receipt/payment rules.

**Implemented:** Student matching, date/amount/mode/account normalization, duplicate fingerprints, split-receipt support, dry run, expected totals, reconciliation by date/mode/account, error CSV, and payment audit creation.

**Verification:** Payment-import, payment-control, import-verification, and current release checks pass.

**Limitations:** No batch rollback; recovery is pre-import backup plus restore.

## Workflow QA

**Goal:** Test realistic fee workflows and harden validation.

**Implemented:** Fee allocation rules, IX/X April start, other-class June start, Faculty Child discount behavior, split payments, duplicate/cancellation handling, reporting checks, and safer defaults.

**Verification:** Fee-allocation, validation, payment-control, receipt, and report-related tests pass.

**Limitations:** Real school data must still be reconciled against physical registers during the pilot.

## User management and school settings

**Goal:** Let authorized staff manage named accounts and school/receipt configuration.

**Implemented:** Create/update/deactivate users, role hierarchy, privileged password reset, own-password change, school profile, receipt settings, fee structures, and audit support.

**Verification:** User-management, password-control, school-settings, permission, typecheck, and build checks pass.

**Limitations:** No email-based self-service reset; sensitive role changes remain Director-controlled.

## First-run setup and system health

**Goal:** Make a fresh installation safe and understandable.

**Implemented:** First active Director setup, school basics, `/setup` gating, API setup-required responses, Director/Admin system health, sample/default-password/readiness warnings, and Windows helper scripts/docs.

**Verification:** Setup, seed-user, system-health, app-info, navigation, and current full checks pass.

**Limitations:** Operator must still install Node/pnpm and maintain the Windows computer.

## Import verification

**Goal:** Save trial/import history and reconcile real-data imports before go-live.

**Implemented:** `ImportBatch`, Student/Payment trial runs, payment expected totals, saved samples/errors/warnings, role-gated verification history, go-live checklist, and payment-only Accountant visibility.

**Verification:** Import-verification and related import tests pass.

**Limitations:** Verification supports human reconciliation; it cannot prove a source register is correct.

## Timetable foundation

**Goal:** Create clean timetable master data and scheduling rules.

**Implemented:** Teachers, subjects, class sections, group period templates, workload assignments, teacher unavailability, fixed periods, load/readiness warnings, and Friday timing support.

**Verification:** Timetable validation tests and current release checks pass.

**Limitations:** Foundation data must be entered correctly before generation can succeed.

## Timetable backup coverage

**Goal:** Include timetable foundation data in safe backup/restore.

**Implemented:** Backup version 3 timetable foundation arrays, optional validation for older backups, dependency-ordered restore, mapping/deduplication, and detailed preview/result counts.

**Verification:** At that phase, 103 tests passed plus typecheck, build, and backup. Current expanded suite also passes.

**Limitations:** Early live verification had some empty timetable entities; populated pilot data should be used for restore drills.

## Manual timetable builder

**Goal:** Let staff create, edit, validate, and approve timetable drafts.

**Implemented:** `TimetableDraft` and `TimetableEntry`, class grid, teacher preview, locked entries, workload progress, conflict/warning checks, draft status, activation/archive/restore, and fixed-period application.

**Verification:** Timetable draft-validation and backup/restore coverage pass in the current suite.

**Limitations:** Manual completion is still required for unusual school constraints.

## Automatic timetable generator

**Goal:** Produce a useful safe draft from foundation data.

**Implemented:** Deterministic generation, scoped class/group generation, optional base draft, locked-entry preservation, fixed-period behavior, hard constraints, soft scoring, unresolved-workload reasons, preview-before-save, and new-draft-only saving.

**Verification:** Generator tests and current typecheck/test/build baseline pass.

**Limitations:** The generator does not model rooms, leave, substitute eligibility, or every preference; output always requires review.

## Timetable print and export — Prompt 7D

**Goal:** Publish reviewed timetables for classes, teachers, workload, and free-period planning.

**Implemented:** Class-wise and teacher-wise browser print, one/all selection, active-draft preference, workload summary, free-period summary, class/teacher/workload/free-period CSV export, and print-safe layouts. Backup version 4 added timetable drafts and entries.

**Verification:** Timetable print/export, timetable backup/restore, generator, and full release checks pass. Current baseline: 128 tests across 26 files, typecheck/build/backup passing.

**Limitations:** Browser print rather than server PDF; CSV rather than XLSX; free-period reports do not model leave, room availability, or substitute qualifications.

## Documentation and handover

**Goal:** Make the completed local project operable by school staff and continuable by another developer.

**Implemented:** Project handover, beginner operating guide, developer continuation guide, prompt history, real-data pilot plan, future attendance procurement plan, short README, and documentation index.

**Verification:** Documentation was reconciled with current routes, permissions, models, backup version 4, timetable Prompt 7D behavior, and the final release command results.

**Limitations:** Repository Markdown is not exposed as an in-app help page. Operators open it from the project folder or through `docs/INDEX.md`.

## Super Admin and Role Permission Matrix — Prompt 10A

**Goal:** Create an ERP-style role and permission foundation without adding parent portal, teacher dashboard, principal dashboard, cloud deployment, attendance, payment gateway, SMS/WhatsApp API, payroll, or a redesign.

**Implemented:** `SUPER_ADMIN`, `PRINCIPAL`, `TEACHER`, and `PARENT` roles were added alongside existing Director/Admin/Accountant/Viewer. A database-backed `RolePermission` matrix, `/roles` page, save/reset APIs, Super Admin promotion script, user-management role updates, matrix-aware page/API guards, and backup/restore coverage were added. Teacher and Parent began as future module roles; they now have their later safe placeholder/read-only surfaces.

**Verification:** Permission, user-management, backup, restore, and full release checks pass in the current suite. Backup version 5 includes role permission rows and still excludes password hashes.

**Limitations:** No role-specific teacher, parent, or principal dashboards were built. Super Admin promotion only promotes an existing user; it does not create a new account or password.

## Role Matrix Access Testing and Lockout Safety Pass — Prompt 10A-QA

**Goal:** Test and polish the Prompt 10A permission foundation before planning Parent, Teacher, or Principal modules.

**Implemented:** Sidebar permission rules were extracted into testable access helpers, `/import-export` now redirects denied direct access to `/unauthorized`, the role matrix table was tightened with a sticky permission column and smaller checkbox columns, and QA tests were added for lockout safety, matrix save/reset, sidebar visibility, API guard declarations, direct unauthorized handling, backup/restore permission rows, Viewer / Auditor labeling, and Teacher/Parent placeholder access.

**Verification:** The required typecheck, test, build, and backup commands must pass before using this as the next stable baseline.

**Limitations:** This pass intentionally did not add Parent portal, Teacher dashboard, Principal dashboard, cloud, attendance, payment gateway, SMS/WhatsApp API, payroll, or redesign work.

## Logout Stability and Payment Form UX Polish - Prompt 10B

**Goal:** Harden logout behavior, add login password show/hide, support multiple UPI transactions under one receipt, clarify Bank/Other labels, and record the ERP calendar idea as documentation only.

**Calendar planning note:** Start with an internal ERP calendar first for school-wide tasks, reminders, academic holidays, exam schedules, alerts, and overdue work. Consider Google Calendar sync later only after the ERP calendar is stable.

**Scope guard:** No Parent portal, Teacher dashboard, Principal dashboard, calendar module, attendance, messaging automation, payment gateway, cloud sync, or redesign was part of this prompt.
# Prompt 12A — Staff/Teacher Foundation and Teacher Profile Management

Added the optional `StaffMember` master, staff list/detail/search, safe Teacher user and timetable links, preview-first staff import, staff permissions/defaults, `/teacher` placeholder routing, and backup/restore version 8 support. No leave, substitutes, attendance, biometric/RFID, payroll, ID cards, marks analytics, messaging, or broad redesign was added.

## Prompt 12A-QA — Staff/Teacher Foundation Safety Polish

Deep QA hardened staff contact/date validation, transactional and duplicate-safe User/TimetableTeacher linking, ambiguous import/restore matching, Teacher navigation isolation, role-matrix wording, and version-8 staff restore behavior. Browser and API checks covered privileged/read-only/blocked roles, staff CRUD/search/filter/import, linked and unlinked Teacher placeholders, timetable/parent regressions, and QA-data cleanup. No new staff-adjacent module was added.

## Prompt 14A - Whole ERP Audit, UI/UX, Navigation, Mobile Responsiveness, and Feature Gap Review

**Goal:** Stop feature expansion briefly and create a route/module inventory, feature and Schoolknot gap map, UI/UX redesign plan, dashboard audit, bug/tech-debt register, UDISE+ planning notes, and Codex prompt strategy.

**Implemented:** Documentation-only stabilization plan plus a tiny `pnpm.cmd routes:list` helper. No new ERP module, shell redesign, dashboard redesign, expenses, exams, UDISE+, certificates, website/app/PWA, WhatsApp/SMS/email, biometric integration, payment gateway, AI assistant, or broad style change was added.

**Follow-up:** Prompt 14B completed the app shell/navigation foundation. Continue with Prompt 14C dashboard redesign when ready.

## Prompt 14B - App Shell, Navigation, Responsive Layout, and Design System Implementation

**Goal:** Improve the whole ERP shell and responsive navigation without changing business logic, schema, backup format, or adding new modules.

**Implemented:** Permission-derived sidebar grouping, desktop sidebar hide/show preservation, mobile off-canvas navigation drawer, drawer close button/backdrop/Escape/link-close behavior, compact mobile topbar behavior, shared table overflow containment, and design-system primitives for page shells, section cards, status badges, empty states, filter panels, form panels, page tabs, and responsive grids. The dashboard was lightly moved onto the new `PageShell` and `SectionCard` primitives only.

**Verification:** Prompt 14B added navigation/shell tests for grouped permissions, Parent/Teacher/Viewer safety, drawer source contracts, and mobile off-canvas CSS. Final verification passed targeted tests, `pnpm.cmd typecheck`, `pnpm.cmd test` with 330 tests across 57 files, `pnpm.cmd build`, browser QA at 1366x768 and 390x844, production light/dark toggle proof, and `pnpm.cmd backup`.

**Limitations:** Dashboard redesign is not complete and remains Prompt 14C. Route-specific mobile table/card-row designs, collapsible filters, and deep page-level form polish remain later UI prompts. No expenses, UDISE+, exams, certificates, website/app/PWA, WhatsApp/SMS/email, biometric integration, payment gateway, AI assistant, or new ERP module was added.

## Prompt 14C - Dashboard Redesign and Premium Summary Cards

**Goal:** Turn the main dashboard into a useful modern school ERP command center using existing data only.

**Implemented:** A school/date/role/system-status welcome header; permission-filtered Today at a glance cards; finance, attendance, leave, substitute, notice, import-warning, and recent-activity summaries; premium collection emphasis; role-derived quick actions; responsive desktop/mobile grids; and light/dark dashboard styling. Parent and Teacher retain dedicated portal redirects, Accountant remains fee-focused, and Viewer / Auditor remains read-only.

**Data and safety:** `lib/dashboard.ts` conditionally queries and defensively filters each dataset using effective permissions. Existing `getDashboard()` fee logic remains authoritative and received only additive payment-count/mode totals. No schema, migration, backup/restore format, business transition, or external charting dependency changed.

**Verification:** Added six dashboard behavior/source tests covering safe metrics, no-data handling, quick actions, Parent/Teacher isolation, Viewer read-only behavior, and recent receipt/notice privacy. Final verification passed `pnpm.cmd typecheck`, 338 tests across 58 files, the production build, Browser QA at 1366x768 and 390x844 in light/dark mode with zero console errors, Director/Accountant/Parent/Teacher/Viewer role checks, and backup version 12 in `nalanda-fee-control-backup-2026-06-30-23-32.json`.

**Limitations:** No server-side last-backup history, collection trend chart, expenses/budget, exams, UDISE+, certificates, AI recommendation, biometric sync, messaging, payment gateway, website/app, or cloud feature was added. Attendance stays manual and displays an explicit no-session state when absent.

## Prompt 14C-QA - Dashboard Accuracy, Role Safety, and Responsive QA

**Goal:** Verify and minimally harden the redesigned dashboard without adding modules, changing schema/backup format, or changing fee/attendance/leave/substitute workflows.

**Bugs fixed:** Dashboard today/month collection keys now use the explicit India school timezone; current published notices include valid undated publications; and `/api/dashboard` now returns the same effective-permission-filtered view as the server-rendered page. The payment-mode heading now states that it covers all recorded payments.

**Metric evidence:** At the live 1 July midnight boundary, direct valid-payment totals matched the dashboard at `₹0` today, zero payments today, and `₹0` for July. Existing pending-dues logic matched at `₹1,90,800` across seven students. Active counts were eight students, zero active guardians, and zero active staff. No attendance sessions, pending leave, substitute rows, or current notices existed, and the dashboard showed the corresponding real zero/empty states.

**Role and visual evidence:** Director/Super Admin, Accountant, Parent, Teacher, and Viewer browser checks passed. Parent/Teacher remained isolated to their portals; Accountant showed only Add Payment and Import/Export actions; Viewer showed zero actions. Desktop `1366x768`, mobile `390x844`, light/dark contrast, mobile drawer/Escape, keyboard focus, and horizontal-overflow checks passed with no application console errors.

**Final verification:** `pnpm.cmd typecheck`, 342 tests across 58 files, and `pnpm.cmd build` passed. Backup version 12 was created as `nalanda-fee-control-backup-2026-07-01-00-29.json`; it contains zero password-hash fields. Temporary role QA changes were restored, and the shared Viewer account finished as `VIEWER` with no guardian link.

**Limitations:** In-app Browser URL policy prevented completing a new navigation click-through of every quick-action destination in this QA run. Their exact server-rendered hrefs, permission filtering, destination route guards, prior Prompt 14C browser proof, and the full regression suite were used instead. Existing limitations for backup history, trends, expenses/budget, exams, and automatic attendance estimates remain unchanged.

## Prompt 15A - UDISE+ and Academic Progression Planning / Compliance Gap Map

**Goal:** Start the academic/compliance planning phase by mapping data, workflow, privacy, approval, and reporting gaps before building annual rollover, progression, UDISE+, exams, admissions, or certificate features.

**Audit findings:** The Student master has current year/class/section, identity/contact, optional DOB/Aadhaar, broad status, and free-text TC status. Guardian and manual attendance foundations exist. The ERP does not yet preserve academic-year enrollments, lifecycle events, promotion decisions, structured transfer/left/dropout evidence, gender/category/CWSN/language data, demographic strength reports, or marks evidence.

**Documents:** Expanded `UDISE_PLUS_PLANNING_NOTES.md` and added `ACADEMIC_PROGRESSION_WORKFLOW_PLAN.md`, `STUDENT_LIFECYCLE_STATUS_MODEL_PLAN.md`, and `STUDENT_DATA_GAP_CHECKLIST_FOR_UDISE_AND_ACADEMICS.md`. The risk register, feature roadmap, developer guide, prompt history, and documentation index were updated.

**Scope guard:** Planning/checklist only. No schema, route, permission, business logic, backup format, promotion, UDISE+ exchange, Aadhaar verification, exams, admissions, or certificates were added.

**Verification:** Route inventory remained 52 page routes and 62 API routes. `pnpm.cmd typecheck`, all 342 tests across 58 files, and `pnpm.cmd build` passed. Backup version 12 was created as `nalanda-fee-control-backup-2026-07-01-09-12.json` with zero password-hash fields.

**Recommended next prompt:** Prompt 15B - Academic Year Rollover and Student Lifecycle Foundation. Prompt 15C should add reviewed progression/departure workflows only after 15B is verified; Prompt 15D should add a read-only UDISE+ checklist/data-gap dashboard before any export is considered. Exams remain Prompt 17B or later, and certificates/TC linkage remains Prompt 18A.

## Prompt 15B - Academic Year Rollover and Student Lifecycle Foundation

**Goal:** Preserve academic-year enrollment and student lifecycle history safely before any promotion/repeat/transfer/left workflow is built.

**Implemented:** Added `AcademicYearEnrollment` with a unique student/year guard and `StudentLifecycleEvent` append-only history; protected lifecycle overview/detail pages and GET APIs; lifecycle view/manage permissions with leadership defaults, Viewer read-only, and Parent/Teacher/Accountant blocked by default; a dry-run-first idempotent `pnpm.cmd lifecycle:backfill` command; and backup/restore version 13 coverage with old-backup compatibility, link validation, duplicate avoidance, local-history preservation, and password-hash exclusion.

**Scope guard:** No promotion, repeat, double promotion, transfer/left/dropout action, rejoin action, correction UI, UDISE+ export, exams, admissions, certificates, maps, notifications, or changes to fee/payment/attendance/leave/substitute business logic were added.

**Next:** Prompt 15B-QA should verify the lifecycle pages, role isolation, responsive themes, console health, backfill data, and cleanup. Prompt 15C remains the reviewed progression/departure workflow.

**Verification:** The additive schema was applied locally through the established `pnpm.cmd db:push` path because the pre-existing non-empty SQLite database is not migration-baselined and `migrate deploy` safely refused with P3005. Backfill dry-run found 8 missing enrollments, apply created 8 enrollments plus 8 ENROLLED events, and a second dry-run found zero missing. `pnpm.cmd typecheck`, all 351 tests across 60 files, and `pnpm.cmd build` passed. Browser QA passed on the production build at 1366x768 and 390x844 in light/dark mode, with working filters, detail history, no promotion/repeat actions, Parent/Teacher blocking, Viewer read-only access, contained mobile tables, and zero application console errors/warnings. The temporary QA user and logs were removed. Backup version 13 was created as `nalanda-fee-control-backup-2026-07-01-10-07.json` with 8 enrollments, 8 events, and zero password-hash fields.

## Prompt 15B-QA - Academic Year Rollover and Student Lifecycle Foundation QA

**Goal:** Verify and minimally harden the existing lifecycle foundation without adding progression, transfer/departure, UDISE+, exam, admission, certificate, or unrelated module behavior.

**Bugs fixed:** Backfill and coverage warnings now exclude non-active and soft-deleted Student rows; real backfill enrollment/event creation is transactional; detail API serialization now independently allowlists fields; restore detects exact semantic event duplicates across different backup IDs; and lifecycle dates use the shared school-time-zone formatter.

**Safety evidence:** Live data has 8 valid enrollment links and 8 valid lifecycle-event links, with zero invalid statuses/types, duplicate student/year keys, or current class/section mismatches. Live API checks returned 200 for Super Admin, Director, Admin, Principal, and Viewer, and 403 for Accountant, Teacher, and Parent; both lifecycle API payloads contained zero internal record/user ID keys. A temporary database-copy restore rehearsal preserved 8 enrollments and 8 events across two repeated restores with zero lifecycle restore errors and zero password hashes.

**Browser evidence:** Production browser QA passed at 1366x768 and 390x844 in light/dark mode. Combined year/class/section/status filters, zero-result empty state, overview counts, detail history, mobile table containment, mobile drawer/Escape, Viewer read-only access, and Accountant/Teacher/Parent blocking passed with zero application console errors/warnings. No promotion, repeat, double-promotion, transfer, left, or dropout final-action control exists.

**Final verification:** `pnpm.cmd lifecycle:backfill` reported all 8 active students already enrolled with zero changes. `pnpm.cmd typecheck`, all 353 tests across 60 files, and `pnpm.cmd build` passed. Backup version 13 was created as `nalanda-fee-control-backup-2026-07-01-14-22.json` with 8 enrollments, 8 lifecycle events, zero password-hash fields, and no temporary QA user remaining.

**Scope and next step:** Prompt 15C may now build a separately reviewed progression/departure workflow on this foundation. It must retain preview, evidence, approval/finalization, acknowledgement, reconciliation, and compensating correction safeguards; the remaining P3005 migration-baseline issue is unchanged.

## Prompt 15C - Promotion / Repeat / Transfer / Left Workflow Foundation

**Implemented:** Added the future-safe `StudentProgressionDecision` ledger; five progression permissions; protected list/create/detail pages and list/create/detail/action APIs; draft, submit, approve/reject, cancel, and explicit finalization transitions; preview text and audit fields; transactional lifecycle/enrollment finalization; duplicate-target prevention; progression links from lifecycle pages; and backup/restore version 14 coverage.

**Decision behavior:** PROMOTE and REPEAT close the source as PROMOTED/REPEATED and create one ACTIVE target-year enrollment. TRANSFER_OUT, LEFT, DROPPED_OUT, and PASSED_OUT close the source without a target. All append a lifecycle event. Repeat requires reason, evidence, and parent acknowledgement. Rejection/cancellation require reasons. Finalized records are immutable. CORRECTION remains review-only, fee warnings remain advisory, and approval never auto-finalizes.

**Scope guard:** No UDISE+ export, exam/marks module, admissions, certificates/TC, maps, Aadhaar verification, AI decision-making, notifications, biometric, payment gateway, automatic class mapping, bulk rollover, or fee/payment/attendance/leave/substitute business-rule change was added. The existing P3005 migration-baseline limitation remains documented.

**Verification:** `lifecycle:backfill` reported 8 active enrollments, 8 existing lifecycle events, and 0 missing/created events. Typecheck, 377 tests across 62 files, and the production build passed. Browser QA passed at 1366x768 and 390x844 in light/dark mode with no page-level horizontal overflow or console errors. Director/Super Admin management and Viewer read-only behavior worked; Accountant, Teacher, and Parent were blocked. Reason validation, approval/finalization warnings, and cancellation were exercised. Sample data was not finalized: 2 temporary decisions and 5 temporary users were removed, leaving 8 enrollments and 8 lifecycle events. Backup `nalanda-fee-control-backup-2026-07-01-15-04.json` is version 14 and contains no password hashes.

## Prompt 15C-QA - Progression Workflow Foundation QA Only

**Bugs fixed:** Locked draft student identity and source-year consistency, added an APPROVED compare-and-set transaction claim to prevent concurrent/double finalization, added type-count summary cards, and expanded restore/audit-field tests.

**Safety evidence:** Disposable database rehearsals finalized PROMOTE, REPEAT, TRANSFER_OUT, LEFT, DROPPED_OUT, and PASSED_OUT with the correct source status, target-enrollment behavior, and append-only event. CORRECTION finalization, duplicate targets, and repeat finalization were blocked. Forced target-write failure rolled back the decision claim and all partial work.

**Browser evidence:** Super Admin workflow passed draft, submit, required rejection reason, separate approval, irreversible confirmation, and finalization. The list/detail views passed 1366x768 and 390x844 containment with zero page overflow and zero console errors/warnings. Permission/API defaults remained unchanged and are covered by role-sensitive regression tests.

**Final verification:** `lifecycle:backfill`, typecheck, 381 tests across 62 files, and the production build passed; the documented Windows Prisma DLL `EPERM` was cleared with stale-Node termination. QA records/users were removed before the final version-14 backup. Prompt 15D may proceed only as a read-only UDISE+ checklist/dashboard.

## Prompt 15D - Read-only UDISE+ Checklist and Student Data Gap Dashboard

**Implemented:** Added `VIEW_UDISE_CHECKLIST` and `EXPORT_UDISE_CHECKLIST`; permission-gated `/udise`, student/staff detail reports, and compact summary; protected summary/student/staff/export APIs; an allowlisted read-only helper over existing ERP records; category counts; class/section consistency signals; and a formula-safe checklist CSV.

**Privacy and scope:** Student/staff contact, address, and DOB are availability statuses only. Full Aadhaar, raw internal IDs, password hashes, secrets, and filesystem details are excluded. The fixed planning-only and latest-portal warnings appear in UI/export. No schema, backup format, official export/submission, portal automation, Aadhaar verification, lifecycle/progression mutation, exams, admissions, certificates, maps, AI, or unrelated module was added.

**Permissions:** Super Admin, Director, Admin, and Principal view/export; Viewer view-only; Accountant, Teacher, and Parent blocked by default. Every page and API enforces its permission server-side.

**Verification:** `pnpm.cmd lifecycle:backfill` found 8 active students already enrolled and changed nothing. Typecheck, 395 tests across 64 files, and the production build passed. In-app Browser QA passed at 1366x768 and 390x844 in light/dark mode: warning/cards, student filters, empty staff report, checklist download, contained tables, zero page overflow, Viewer no-export, and Accountant/Teacher/Parent blocking all passed with zero console errors/warnings. Temporary role reuse was restored, leaving 0 QA users/students, 8 enrollments, 8 lifecycle events, and 0 progression decisions. Version-14 backup `nalanda-fee-control-backup-2026-07-01-19-58.json` contains 8 enrollments, 8 events, 0 decisions, and no password hashes or secrets.

**Future:** Prompt 15E may add reviewed gap-fix forms only after the school confirms fields. Prompt 17B remains exams/marks, Prompt 18A certificates/TC/bonafide linkage, and Prompt 21A student location privacy/cost/feasibility planning.

## Prompt 15D-QA - Read-only UDISE+ Checklist Accuracy, Privacy, and Permission QA

**Goal:** Verify the existing UDISE+ planning dashboard as a read-only, permission-safe, privacy-safe school-review tool without adding a new module or official exchange behavior.

**Bugs fixed:** Student numeric gap totals now count the same unique non-privacy gap types displayed as badges; checklist filenames sanitize academic-year text and retain clear planning/gap-report wording; and the shell theme toggle reads the active theme-provider state.

**QA evidence:** All four pages and all four APIs remain GET-only and server-protected. Live role checks allowed Super Admin, Director, Admin, and Principal to view/export; allowed Viewer to view but returned 403 for export; and blocked Accountant, Teacher, and Parent from pages, navigation, data APIs, and export. Student filters and helpful empty states worked. Page/API/CSV scans found no full Aadhaar, raw internal/user IDs, password hashes, secrets, or filesystem paths; spreadsheet-formula neutralization remained covered.

**Scope:** No schema, backup format, official UDISE+ export/submission, portal automation, Aadhaar verification, data-fix form, lifecycle/progression mutation, exams, admissions, certificates, maps, biometric, notification, payment gateway, AI, or unrelated business-logic change was made.

**Final verification:** `lifecycle:backfill` scanned 8 Active students and changed nothing. Typecheck, 397 tests across 64 files, and the production build passed. Browser QA at 1366x768 and 390x844 passed in light/dark mode with contained tables, zero page overflow, and zero console errors/warnings. Cleanup left 8 enrollments, 8 lifecycle events, 0 progression decisions, 0 staff/guardians, and 0 QA users/students. Version-14 backup `nalanda-fee-control-backup-2026-07-14-23-51.json` contains no password hashes or secrets.

**Next:** The read-only checklist is safe for school review. Prompt 15E should proceed only after the school confirms which fields and source registers it wants to maintain; Prompt 17B, 18A, and 21A remain separate future phases.

## Prompt 16A - Expense and Vendor Foundation

**Implemented:** Added Vendor, ExpenseCategory, ExpenseDepartment, ExpenseRecord, ExpensePayment, and append-only ExpenseAudit models plus an additive SQLite migration and safe initial category/department masters. Added nine permissions, permission-derived navigation, protected vendor/list/create/detail behavior, expense list/create/detail workflow, partial payment ledger, six read-only report groupings, formula-safe CSV, and two permission-filtered dashboard counts. Expenses remain completely separate from student Payment records.

**Workflow and security:** Draft is the only editable state. Submit, approve, reject, payment, and cancel are server-validated, compare-and-set, transactional actions with audit rows. Rejection/cancellation require reasons. Approved/paid records cannot be silently edited. Non-cash references and cheque details are enforced at payment time. Viewer/Auditor sees expenses/reports only; Principal is conservatively read-only; Accountant can manage/pay/report but cannot approve/cancel; Parent/Teacher are blocked. Sensitive vendor tax/banking fields require vendor-management permission and only four account digits are stored.

**Reports and backup:** Active totals exclude cancelled records. CSV uses allowlisted fields, formula-injection protection, and no raw user IDs, secrets, or vendor tax/banking details. Backup version 15 includes all six new entities, remains compatible with old backups, validates relationships/status/money, avoids duplicate expense numbers/master rows, preserves newer local vendor data, and excludes password hashes.

**Scope guard:** No budget/threshold alert, cash book, miscellaneous income, books/library income, payroll, GST/tax filing, bank reconciliation, gateway, AI, inventory/stores, invoice-document storage, or student fee/payment change was added. UDISE, lifecycle, and progression data were not changed.

**Verification:** `lifecycle:backfill` scanned 8 active students and changed nothing. Typecheck, 440 tests across 67 files, and the production build passed. Browser QA covered create/draft/submit/approve/pay, reject and cancel with reasons, blocked invalid actions, reports/CSV, Accountant/Viewer/Teacher/Parent boundaries, 1366x768 and 390x844, light/dark mode, contained tables, zero page overflow, and zero console errors/warnings. Browser QA found and fixed a date-only offset defect before sign-off. Cleanup left 8 active students, 8 enrollments, 8 lifecycle events, 0 progression decisions, 0 QA users, and 0 vendor/expense/payment/audit records. Backup version 15 is `nalanda-fee-control-backup-2026-07-15-00-48.json`; it contains 15 categories, 8 departments, no QA markers, and no password hashes. The migration was applied through the established direct SQLite execute path because the documented P3005 baseline limitation remains.

**Next:** Run Prompt 16A-QA before Prompt 16B. Later phases remain Prompt 16B budgets/budget controls, Prompt 16C daily cash book, and Prompt 16D miscellaneous income.

## Prompt 16A-QA - Expense and Vendor Foundation QA Only

**QA fixes:** Tightened vendor and expense input handling so overlong identifiers/notes and over-precision numeric money are rejected instead of silently truncated or rounded. Impossible calendar dates are rejected. Expense create/update now validates that selected vendor, category, and department masters are active inside the write transaction. Cash/cheque/electronic reference fields are normalized to the selected method. Read-only expense and vendor pages/APIs no longer serialize tax/banking, payment-reference, private-note/reason, or finance-actor fields into restricted payloads.

**Audit and restore safety:** Vendor status changes now require confirmation, rejection and cancellation use independent UI reason state, and paid/final records remain non-editable. Restore validation now applies exact two-decimal money rules, vendor privacy/format limits, workflow-status consistency, and payment-reference checks. A same-number/different-ID expense collision no longer maps dependent backup payments or audits to an unrelated local expense. Isolated copied-database QA proved first restore, repeated restore without duplicates, collision isolation with warnings, version 15, link preservation, and password-hash exclusion.

**Browser and permissions:** Full workflow QA covered vendor validation/duplicate/status/linked-history behavior; draft, submit, approve, pay, reject, and cancel; missing-reference/reason errors; report totals and CSV; Super Admin, Director, Admin, Principal, Accountant, Viewer, Teacher, and Parent defaults. Viewer payloads hid payment references, private notes/reasons, and actor names. Accountant could manage and record payment but had no approve/cancel action. At 1366x768 and 390x844, vendor/expense list/new/detail/reports passed in light and dark mode with no page overflow, mobile tables scrolling inside `.table-wrap`, and 0 console warnings/errors.

**Verification and cleanup:** `lifecycle:backfill` scanned 8 active students and changed nothing. Typecheck, 450 tests across 67 files, and the production build passed. Regression smoke coverage included payments, receipt print, pending dues, daily collection, dashboard, lifecycle/progression, UDISE checklist, attendance, leave, substitutes, timetable, role matrix, import/export, and backup. Cleanup removed every QA16A user, vendor, expense, payment, and audit; the database remains at 8 students, 8 enrollments, 8 lifecycle events, and 0 progression decisions. Clean backup `nalanda-fee-control-backup-2026-07-15-01-26.json` is version 15 with 15 categories, 8 departments, 0 finance records, 0 QA markers, and 0 password-hash fields.

**Next:** Expense and Vendor Foundation is safe to proceed to Prompt 16B. Budgets, cash book, miscellaneous income, payroll, GST/tax filing, bank reconciliation, gateway integration, AI, inventory, and student fee/payment changes remain outside this phase.

## Prompt 16B - Budget and Department Spending Controls

**Foundation:** Added `BudgetPlan`, `BudgetAllocation`, and `BudgetRevision` with Decimal amounts, calculated allocation totals, normalized duplicate-combination keys, a one-official-plan-per-year rule, and immutable approved/locked workflow boundaries. Revisions store preserved before/after allocation snapshots instead of silently overwriting approved figures.

**Spending control:** Added `lib/budgets.ts` and guarded list/detail/workflow/revision/report/export APIs. Actual spending uses only same-year APPROVED `ExpenseRecord` rows and their `ExpensePayment` rows. Paid, committed, utilized, available, utilization, over-budget, unmatched approved spend, and warning/critical states are distinct. Deterministic matching prevents one expense from counting in more than one allocation. Student payments are never queried.

**Operator surfaces and roles:** Added budget list, new-plan allocation builder with required preview, detail/workflow confirmations, revision history, and read-only category/department/combined/threshold reports with formula-safe CSV. Permission-aware dashboard cards show allocated, utilized, threshold, and pending-approval totals. Defaults: Super Admin/Director full; Admin/Accountant draft manage and export without approve/lock/revise; Principal/Viewer read-only; Teacher/Parent none.

**Data safety:** Backup version 16 adds plans, allocations, and revisions. Restore is backward-compatible, validates money/totals/thresholds/statuses/reasons/links/snapshots/official-year uniqueness, isolates same-number/different-ID plan collisions, preserves local-newer rows, avoids duplicates, never deletes local budget data, and excludes password hashes. The existing Prisma P3005 baseline issue remains documented.

**Verification checkpoint:** Final verification passed `lifecycle:backfill` with 8 active students already enrolled and no changes, typecheck, 493 tests across 69 files, and the 119-page production build. Browser QA covered the full draft/duplicate/submit/approve/lock/reject/cancel/revision workflow, paid/committed/threshold calculations, CSV, Accountant/Viewer/Teacher/Parent boundaries, 1366×768 and 390×844, light/dark mode, contained table scrolling, and zero console errors or warnings. Cleanup removed all temporary budget, expense, vendor, payment/audit, and QA-user records. Backup version 16 was written as `nalanda-fee-control-backup-2026-07-15-02-25.json`; it contains zero clean-state budget rows and no password hashes.

**Next:** Run Prompt 16B-QA after implementation sign-off. Prompt 16C daily cash book/day close and Prompt 16D miscellaneous income remain separate future phases. Payroll, GST filing, bank reconciliation, payment gateway, AI, procurement, inventory, and student fee/payment changes remain out of scope.

## Prompt 16B-QA - Budget and Department Spending Controls QA Only

**Bugs fixed:** Cancellation now needs `APPROVE_BUDGETS`, closing a direct-API path for draft managers. Effective allocation thresholds are validated after inheriting plan defaults. Master links are checked inside plan/revision transactions. Budget displays retain paise, reports aggregate with Decimal, and category-only matching has documented precedence over department-only matching. Restore now deeply validates academic years, effective dates, and revision snapshot links, keys, duplicates, exact amounts, thresholds, and reconciled totals.

**Financial/workflow evidence:** Disposable approved, paid, partial, unpaid, draft, rejected, and cancelled expenses produced exact totals of 2,200.65 allocated, 1,000.25 paid, 1,125.35 committed, 2,125.60 utilized, and 75.05 available. Draft/edit/submit/approve/lock, double-lock rejection, locked immutability, rejection/cancellation reasons, terminal-state blocking, threshold states, reports, and CSV passed. Seven-role live checks confirmed leadership control, conservative Admin/Principal/Accountant/Viewer boundaries, and Teacher/Parent denial.

**Backup/regression:** Isolated restore recreated plan/allocation/revision rows once, remained idempotent on repeat, and did not attach children to a same-number/different-ID local plan. Lifecycle backfill changed nothing; typecheck, 502 tests across 69 files, and the 119-page production build passed. Cleanup removed 4 plans, 6 allocations, 6 expenses/audits, 2 payments, 1 vendor, and 7 QA users, leaving no QA markers. Clean backup `nalanda-fee-control-backup-2026-07-15-10-25.json` is version 16 with 15 categories, 8 departments, 0 finance/budget rows, and no password hashes.

**Open gate:** The requested in-app Browser rerun could not initialize because the bundled Browser client threw `Cannot redefine property: process` before any page opened. Current 1366x768/390x844, light/dark, overflow, table-scroll, confirmation, and console-zero evidence is therefore pending. Prompt 16C is not cleared until that browser-only gate is rerun; no Prompt 16C or unrelated finance work was added.

## Prompt 16C - Miscellaneous Income and Daily Cash Book Foundation

**Foundation:** Added six independent models, an additive SQLite migration, fourteen permissions, conservative role defaults, permission-derived navigation, protected item/rate/receipt/cancel/report/export APIs and pages, black-and-white receipt print, physical-cash day list/detail/reports, movement and workflow APIs, source snapshots/drift warning, and small dashboard summaries. Miscellaneous receipts use their own numbering and never write student fee `Payment`.

**Cash control:** The formula reads active fee cash, active miscellaneous CASH receipts, non-cancelled CASH `ExpensePayment` rows, and active manual/disposition movements with exact Decimal paise. Bank deposit and Director handover are separate cash outflows and support split disposition. Counted closing and variance are preserved. Submission snapshots, approval, and lock are separate transaction-safe compare-and-set transitions; locked days are immutable and later source changes create warnings instead of rewrites.

**Security and restore:** Director/Super Admin have full control; Admin/Accountant manage and submit without default approve/lock; Principal/Viewer are read-only; Teacher/Parent are blocked. Restricted payloads omit sensitive references and actors. Backup version 17 adds all six entities, supports older backups, validates totals/links, isolates same-number/date collisions, preserves newer local rows, is idempotent, and excludes password hashes.

**Scope:** No books/library-specific accounting, payroll, GST, bank reconciliation, inventory, gateway, AI, or fee/dues/ledger change. Prompt 16D is Books/Library Income and Publisher Payment Flow.

**Verification:** Browser QA found and fixed three release defects: received-account labels now submit enum values, receipt cancellation uses an explicit inline reason confirmation instead of a browser prompt, and cash-day/movement dates serialize as `YYYY-MM-DD` before API calls. The complete cash workflow calculated authoritative sources, split ₹200 to the school current account and ₹100 to Director Sir, preserved a documented ₹-10 variance, submitted, approved, locked, rejected edits, and showed source drift without rewriting snapshots. Accountant could manage/submit but not approve/lock/cancel; Principal/Viewer were read-only without export or sensitive references; Teacher/Parent page access was denied. Reports, both CSV downloads, print output, 1366×768 and 390×844, light/dark mode, contained tables, and zero page overflow passed with zero console errors/warnings.

**Release evidence:** `lifecycle:backfill` changed nothing; typecheck, 558 tests across 72 files, and the 133-page production build passed. Cleanup removed 4 QA receipts, 5 lines, 4 rates, 2 cash days, 2 movements, and 3 temporary role users. Final state is 6 seeded items, zero Prompt 16C transactions, zero vendor/expense/budget rows, 8 students, 8 enrollments, 8 lifecycle events, and 0 progression decisions. Backup version 17 is `nalanda-fee-control-backup-2026-07-15-13-30.json` and contains no password hashes. The implementation is ready for Prompt 16C-QA.

## Prompt 16D — Books Sales, Library Income, Publisher Bills, and Payment Flow Foundation

**Implemented:** separate academic-year book catalog/rates; immutable `BOOK-...` sale receipts and line snapshots; CASH-only physical-cash sourcing; daily book-cash draft/submit/approve/cancel workflow; exactly-one Director handover; cash-book snapshot/drift; books dashboard, pages, reports, formula-safe CSV, and black-and-white receipt print.

**Expense reuse:** publisher vendors, invoice drafts, approval, partial/final bank or cheque payments, and annual library-management service drafts remain existing `Vendor`, `ExpenseRecord`, and `ExpensePayment`. No parallel publisher payment or payroll ledger was added.

**Security and backup:** eleven books permissions enforce server-side role defaults. Admin/Accountant cannot approve settlements by default; Principal/Viewer are masked read-only without export; Teacher/Parent are blocked. Backup version 18 adds all books entities and book cash snapshots, supports older backups, validates exact links/collisions/overlaps/totals, preserves newer local roots, remains idempotent, and excludes password hashes.

**Scope:** no circulation, accession, barcode/RFID, inventory, valuation, purchase order, procurement approval, payroll, GST, bank reconciliation, gateway, AI, or fee/lifecycle/UDISE/attendance/leave/timetable change.

## Prompt 16E - Library Circulation, Accession Register, Barcode/RFID, and Inventory-Boundary Planning

**Planning audit:** Reviewed the current Student/Guardian/StaffMember/User/RolePermission relationships; books-finance and publisher expense reuse; Miscellaneous Income; permissions/navigation; backup/restore version 18; parent/teacher portal boundaries; import/export and CSV safety; and Decimal/local-date helpers. `BookCatalogItem` remains a sale-item/rate model and is not the circulation catalogue.

**Plan delivered:** Added separate title/copy, membership, loan, reservation, charge, event, policy, and stock-verification model plans; permanent accession rules; server-side lifecycle and privacy rules; barcode-first and RFID evidence gates; import templates; permissions; routes; reports; financial/procurement/valuation boundaries; and a phased Prompt 16F-16J roadmap. The recommended future charge design is a dedicated operational `LibraryCharge` linked once to Miscellaneous Income only when payment is collected.

**Scope:** Documentation only: no schema/migration, route/API, feature code, backup array/version, external package, finance record, or application behavior changed. The exact next implementation prompt is **Prompt 16F - Library Catalog and Accession Register Foundation**.

## Prompt 16E-QA - Library Circulation and Accession Planning Review Only

**Planning corrections:** Made the loan record the canonical source for `OVERDUE` so copy and loan states cannot diverge; specified that `RESERVED` means a specifically allocated held copy; required migration-managed exactly-one membership linkage and an enforceable unique nullable active-loan key; added successor-copy linkage for replacements; and clarified the optional Vendor/ExpenseRecord provenance rule.

**Financial/privacy hardening:** Documented the exact once-only LibraryCharge-to-Miscellaneous-Income receipt link, pre-final cancellation/reopen path, locked-cash-day compensating-correction requirement, waiver boundary, and parent-safe receipt visibility. Barcode identifiers are normalized exact matches with UI debounce and server idempotency/transactional locking; RFID remains copy-only, non-authentication, and non-location tracking.

**16F scope gate:** Prompt 16F is limited to bibliographic titles, physical copies/accession register, preview import, non-circulation reports, permissions, and backup/restore. It explicitly excludes members, loans, returns, reservations, overdue, charges/fines, barcode/RFID, procurement, and valuation. No runtime or schema changes were made in this review.

## Prompt 16F - Library Catalog and Accession Register Foundation

**Implemented:** Added separate `LibraryTitle`, `LibraryCopy`, and append-only `LibraryCopyEvent` models; normalized/unique title code, ISBN, accession, and optional barcode; permanent accessions; audited condition/shelf/status/withdraw/correction actions; exact Vendor/Expense provenance validation; and safe masked serializers.

**Surfaces:** Added nine `/library` pages and protected `/api/library/*` title, copy, event, import-template/preview/confirm, report, and export routes. Added six permissions with Director/Admin writes, Principal/Viewer read-only, Viewer no export, and Accountant/Teacher/Parent blocked. Added exact preview-first imports through `ImportBatch` and formula-safe non-circulation reports.

**Durability:** Backup version 19 adds library title/copy/event arrays, older-backup defaults, exact link validation, collision isolation, local-newer preservation, append-only event retention, idempotent repeated restore behavior, and continued password-hash exclusion. Books-finance, fee Payment, miscellaneous income, expenses, budgets, and cash book remain separate.

**Deferred:** Prompt 16G membership/issue/return/renewal/reservation; Prompt 16H overdue/lost/damaged/charges/waivers/portals; Prompt 16I labels/scanning; Prompt 16J stock verification. RFID, procurement, and inventory valuation remain separately gated.

## Prompt 16G - Library Membership and Circulation Foundation

**Implemented:** Added exclusive Student/Staff memberships, explicit priority policies, transactional issue/return/renewal/issued-in-error cancellation, title reservation queues and fulfilment, derived overdue, append-only circulation events, and open-loan withdrawal protection. Unique database keys guard double issue and duplicate waiting reservations.

**Surfaces:** Added eleven circulation pages, protected member/policy/issue/return/loan/reservation/report APIs, nine permissions, Principal read-only access, masked Viewer/Auditor reports without export, and default blocks for Accountant/Teacher/Parent.

**Durability:** Backup version 20 adds membership, policy, loan, reservation, and loan-event arrays with exact-link validation, snapshot preservation, active-loan uniqueness, fulfilment validation, collision isolation, older-backup compatibility, idempotent event restore, and continued password-hash exclusion.

**Deferred:** Prompt 16H lost/damaged/charges/waivers/portal scope; Prompt 16I labels/scanning; Prompt 16J stock verification. No fines, payments, Parent/Teacher library portal, barcode scanner, RFID, procurement, or valuation was added.

## Prompt 16H - Library Incidents, Charges, Waivers, and Portals

**Implemented:** Added explicit LOST/DAMAGED incident lifecycles, safe copy transitions, configurable charge-rule matching, manual/rule/acquisition suggestions, overdue snapshots, separate incident and charge approval, full/partial waiver, terminal immutability, and append-only charge/incident events. Duplicate active incidents, overdue charges, collections, and concurrent workflow actions are guarded.

**Finance and portals:** Approved positive charges collect exactly once through one Miscellaneous Income receipt/line. CASH reaches Cash Book through that existing source only; no fee `Payment`, fee due, student fee ledger, or separate Library ledger changes. Linked-receipt cancellation creates a reconciliation warning. Parent access is linked-child-only and Teacher access is own-StaffMember-only; both are allowlisted and read-only.

**Surfaces and durability:** Added incident, charge, charge-rule, report/export, Parent Library, and Teacher Library pages/APIs plus server-side permissions. Backup version 21 adds all four accountability arrays and validates links, ownership, receipt identity, amounts, collisions, and append-only history while supporting older backups and excluding password hashes.

**Deferred:** Prompt 16I barcode labels/scanning; Prompt 16J stock verification. Payment gateway, automated fine posting, RFID, procurement, purchase orders, and inventory valuation remain absent.

**Prompt 16H release evidence:** Route inventory passed at 123 page routes and 154 API routes; lifecycle backfill changed nothing; typecheck passed; 713 tests across 85 files passed; and the 193-route production build passed. Browser QA passed the explicit overdue, LOST, DAMAGED, partial/full waiver, CASH/UPI collection, receipt-cancellation warning, role/ownership isolation, CSV, responsive, light/dark, focus, overflow, and table-containment checks with zero console errors/warnings and empty production stderr. Cleanup returned every temporary Prompt 16H entity and receipt count to zero while retaining the two configured Library charge Miscellaneous Income items. Backup version 21 is `nalanda-fee-control-backup-2026-07-16-10-33.json`, contains all four accountability arrays, and excludes password hashes. Prompt 16H-QA is safe to begin.

## Prompt 16H-QA - Library Incidents, Charges, Waivers, and Own-Portal QA

**Resolved findings:** QA now rejects DAMAGED incidents against cancelled loans, pre-issue incident dates, unsupported damage conditions, and unavailable replacement copies. Collection revalidates the exact Student/Staff member ownership inside the financial transaction. Charge and incident forms use India-local date defaults. Paid-charge restore rechecks the local Miscellaneous Income receipt identity, borrower, stable Library item, and exact amount before linking it. Prompt 16H client boundaries now pass allowlisted plain option/action payloads instead of Prisma Decimal graphs, eliminating the Next.js production console/stderr warning.

**Workflow and privacy evidence:** Browser QA covered explicit overdue preview without posting, due-today exclusion, exact class/staff rule matching, partial and full waiver, exactly-once concurrent CASH collection, Staff UPI reference validation, stable Student/Staff receipt items, LOST original-return and replacement resolutions, post-return DAMAGED repair resolution, receipt-cancellation correction history, Parent sibling isolation, Teacher own-account isolation, unlinked-Teacher state, Accountant collection-only scope, Principal review scope, Admin export scope, masked Viewer reports/no export, and Super Admin/Director access. Reports reconciled exact paise and showed the cancelled-receipt warning. Temporary QA counts returned to zero except the two intentionally retained stable Library charge income items; fee `Payment` stayed at 19 and no cash day/movement was created.

**Release evidence and remaining gate:** Route inventory is 123 page and 154 API routes; lifecycle backfill is a no-op; typecheck, 725 tests across 86 files, and the 193-route production build pass. Production Browser smoke has zero console errors/warnings and empty stderr. Clean backup version 21 is `nalanda-fee-control-backup-2026-07-16-11-47.json`, contains empty accountability arrays after cleanup, retains both configured Library income items, and excludes password hashes. The in-app Browser viewport override did not change the rendered viewport from its 1280px desktop surface when asked for 390x844, so the exact mobile rerun remains an environmental QA gate. Prompt 16H is not fully cleared and Prompt 16I should wait for that one Browser rerun.
# Prompt 16I

Added Library Code 39 barcode labels, preview-first assignment/correction, printable sheets, safe CSV exports, and confirmation-based keyboard scanner assistance. No RFID, camera, stock verification, or location tracking was added.
# Prompt 16J — Library Stock Verification Foundation (2026-07-16)

Added scoped/transactional stock sessions, immutable expected-copy snapshots, exact barcode/accession/manual verification, duplicate/out-of-scope/unknown/withdrawn scan logs, safe missing proposals, itemized review/application through existing append-only copy helpers, separate approval and Director-only default lock, masked reports/formula-safe CSV, permissions, backup/restore v22, tests, and Browser QA targets. No RFID, camera scanning, valuation, procurement, accounting, automatic charges/expenses, fee changes, or location tracking. Next planned Prompt 17A.

# Prompt 16J-QA — Library Stock Verification QA (2026-07-16)

# Prompt 17A - Homework and Assignments Foundation (2026-07-16)

Added HomeworkAssignment and append-only HomeworkAssignmentEvent, conservative timetable-linked Teacher scope, linked-child/current-enrollment Parent isolation, audited workflow, staff and portal pages, reports/formula-safe CSV, seven permissions, backup/restore v23, tests, and Browser QA targets. HomeworkViewReceipt was deferred. No submission/upload, grading/marks, report cards, AI generation, notifications, storage, or unrelated module changes.

QA corrected expected-versus-unexpected counting, deliberate recheck handling, normalized out-of-scope confirmation, safe scan payloads, incident guards, Viewer report-only enforcement, applied-event restore ownership validation, locked-scanner controls, detailed report/scan history, accessible inline reasons, and 44px mobile controls. Browser checks passed at 1366x768 and exact 390x844 in light/dark modes with no overflow, all tables contained, zero console warnings/errors, and empty production stderr. Temporary sessions, records, scans, events, titles, copies, loans, members, policies, users, and related events were removed before the clean v22 backup. Physical USB scanner certification remains unavailable; keyboard-input simulation passed.
# Prompt 17B — Exams and Marks Foundation

Implemented four Prisma models and the checked-in `20260716_exams_marks_foundation` migration; ten role permissions and exact timetable Teacher scope; exam and assessment workflow with concurrency checks; accessible raw-mark entry with zero/absent distinction; audited approved-mark correction; preview-confirm exact CSV import; internal privacy-safe analytics/export; nine requested pages plus guarded APIs; append-only history; backup/restore version 24; and regression/security tests. Final report cards, KG rubrics, published results, ranks, automated progression, online exams, notifications, and Teacher performance analytics remain out of scope.

## Prompt 17B-QA - Exams and Marks Foundation QA (2026-07-16)

QA corrected class-wide enrollment matching in entry, import, reports, validation, and restore; accepted blank class-wide sections and main components in version-24 backups; blocked approved-mark corrections after exam cancellation; added explicit configuration-gap, result-distribution, and configuration-only cancellation reporting; aligned the audited correction action label; made repeated exam transitions serialize safely; masked Prisma uniqueness details; and enforced Viewer exam-code masking in report responses. Targeted tests cover restore idempotence, locked history, collision isolation, workflow/scope/privacy regressions, and exact report metrics. Final clearance remains contingent on the requested in-app Browser viewport/accessibility rerun if that bridge is unavailable during QA.

# Prompt 17C - Digital Report Cards and KG Rubrics (2026-07-16)

Implemented grading schemes and templates; mark-based cards from one locked Exam Cycle; the full five-evaluation LKG/UKG rubric, attendance and growth snapshots; exact Teacher scope; separate Student/batch submission, approval, issue, archive, and pre-issue cancellation; immutable issued corrections; linked-child Parent result/history views; operational reports and safe CSV; A4 and ten-page KG print structures; eleven permissions; append-only events; and backup/restore version 25. Raw marks and progression remain read-only. No rank, automatic promotion, Teacher analytics, notifications, Student login, or external document/storage packages were added.

## Prompt 17C-QA - Digital Report Cards and KG Rubrics QA (2026-07-17)

QA corrected Teacher batch/correction scope, Parent mark snapshot field mapping, KG attendance provenance and exact evaluation/growth keys, typed approval-role enforcement, mark-card attendance/source snapshot tampering, restricted API serialization, report queue/distribution coverage, historical/cancelled print watermarks, version-25 link validation and replay tests, exact unattended dialog labels, archived Teacher history visibility, Teacher read-only issued-card controls, mobile action sizing, and confirmation-dialog focus.

Browser QA covered active mark-based and KG templates, locked-exam zero/absent/missing handling, incomplete KG issue blocking, separate workflow transitions, audited correction version 2 without overwriting version 1, all five KG evaluations, all criterion response sets, 20 personality traits, June-April attendance, I/III/V growth, linked-child Parent isolation, exact/unlinked Teacher scope, Director/Admin/Viewer/Accountant/Parent role boundaries, masked Viewer reports/no export, A4 and ten-page black-and-white KG print, CANCELLED/SUPERSEDED watermarks, 1366x768 and exact 390x844 layouts, light/dark themes, table containment, 44px mobile controls, accessible labels/focus, zero horizontal overflow, zero console warnings/errors, and empty production stderr.

Release evidence: 159 page routes and 220 API routes; lifecycle backfill scanned 8 active Students and changed nothing; typecheck passed; 915 tests across 101 files passed; and the 250-page optimized production build passed without a DLL lock or `taskkill`. Cleanup removed 8 temporary users, 3 Students, 1 Guardian, 2 exam cycles, 3 templates, 2 schemes, 3 batches/cards, 4 versions, and 15 events; every QA17C count returned to zero and progression stayed at zero. Clean backup version 25 is `nalanda-fee-control-backup-2026-07-17-02-19.json`; all eight report-card arrays are empty after cleanup, QA17C and password hashes are absent, and SHA-256 is `14BD6268CDEB9EAC175D175C662BDB3ED8051E7DDF905C56F0ABF2CF1F08FD82`. Prompt 17C is cleared and Prompt 17D is safe to begin.

## Prompt 17D - Teacher Performance Analytics and Review Foundation (2026-07-17)

Added four preserved analytics/review models; nine employment-sensitive permissions; versioned workload, attendance/approved-leave, substitute, Homework, marks workflow, aggregate Student outcome, report-card, KG, and data-quality evidence; minimum cohort 5; explicit cycle/review/share/Teacher-response/finalisation dialogs; own-Teacher isolation; aggregate Viewer reporting/no export; formula-safe leadership CSV; and backup/restore version 26. No composite score, ranking, automatic employment action, causation claim, Student identity/raw marks, AI conclusion, surveillance, or Prompt 18A work was added.

## Prompt 18A - Student Certificates, TC and Bonafide Foundation (2026-07-17)

Added the four controlled certificate types; six preserved models; thirteen permissions/defaults; validated non-executable templates; transaction-safe issue-time numbering; internal and Parent linked-child requests; separate request/certificate approval and issue; authoritative enrollment/Attendance/progression snapshots; TC active-enrollment warning and explicit leadership reason; immutable correction/reissue/cancellation history; A4 monochrome staff/Parent print; operational reports and formula-safe allowlisted CSV; and backup/restore version 27. No certificate fees/payments, Migration/board packages, public verification, QR codes, signature images, digital signatures, or automatic lifecycle/progression/financial mutation were added.
# Prompt 18B - Class X document package, Migration tracking, and payment workflow

Implemented configurable immutable package/checklist snapshots, current or historical Class X source preview, Prompt 18A school-certificate version links, external Board/Migration custody-only tracking, compare-and-set audited workflow, approved Miscellaneous Income collection or full waiver, partial/complete physical handover, Parent linked-child isolation, operational reports/formula-safe CSV, A4 acknowledgment, permission-aware navigation/APIs, focused security/regression tests, and backup/restore version 28.

Hard boundaries: no Board certificate generation/branding/scans, no Board eligibility inference, no fee `Payment` or payment gateway, no dues blocking, and no lifecycle/progression/marks/report-card mutation. The school must verify official procedures. Prompt 18C remains out of scope.
# Prompt 18C — Virtual Student and Teacher ID Cards

Implemented privacy-safe Student/Staff ID-card templates, number series, individual/batch lifecycle, immutable versions/events, correction/replacement/revocation, Parent/Teacher isolation, CR80/A4 printing, Code 39 exact lookup, aggregate reports and safe CSV, and backup/restore version 29. Personal-photo storage and public/authentication use are explicitly excluded.

# Prompt 19A - In-App Notification Centre and Delivery Ledger Foundation

Implemented five preserved notification models; reusable plain-text templates; separate draft, review, approval, schedule/publication, cancellation, withdrawal, archive, and correction workflow; immutable audience/template snapshots; one deduplicated recipient row per campaign/User; safe skipped-target reasons; append-only events; idempotent read/acknowledge/dismiss actions; deterministic scheduled/expiry visibility; exact Parent/Teacher/Staff/role/class/section/Student/Guardian/User targeting; conservative timetable-linked Teacher drafts; Parent/Teacher/staff inboxes and unread bells; aggregate-only reporting and formula-safe CSV; and backup/restore version 30.

Existing Parent Notices remain unchanged and are adapted into a separate linked-child-safe read-only legacy feed without duplicate campaigns or fabricated receipts. The implementation contains no WhatsApp, SMS, email, push, Firebase, service worker, external provider, credentials, webhook, contact-field recipient snapshot, or external delivery queue.
# Prompt 19C — SMS and Email One-Way Communication Foundation (2026-07-18)

Added shared privacy-safe SMS/Email profiles, independent exact-contact consent and history, DLT-safe SMS and plain-text Email mappings, published Prompt 19A audience reuse, masked preview, separate approval/send, persistent bounded MOCK queues, revalidation/retry/rate/quiet-hour/cost controls, signed mock delivery/bounce/complaint fixtures, contact-hash suppression, aggregate formula-safe reporting, role-gated Parent/Staff preferences, eight staff pages/APIs, environment-only Gmail API architecture, and backup/restore version 33. No live provider was activated, no real contact was sent, and no credentials or full destination contacts were added to channel tables.

The SMS LIVE adapter intentionally remains unavailable until the school's exact provider contract exists. Gmail API acceptance remains `ACCEPTED`, not delivery. No two-way inbox, inbound content, automatic reply, OTP, marketing, arbitrary HTML, remote image, tracking pixel, attachment, Student-direct delivery, finance posting, or Prompt 19D work was added.

# Prompt 19D — Privacy-Safe PWA Foundation and Mobile App Strategy (2026-07-18)

**Goal:** Add standards-compliant installability and a narrowly scoped service worker without caching authenticated school data, enabling offline writes, background sync, push notification, device tracking, a native wrapper, or Prompt 20A.

**Implemented:** App Router manifest, 192/512 normal and maskable icons plus Apple touch icon, production-only registration, versioned Nalanda-only caches, static allowlist, generic offline fallback, online/offline banner, user-confirmed waiting-worker updates, Install App guidance, logout/manual cache clearing, `VIEW_SYSTEM_HEALTH` diagnostics, security headers, tests, and `PWA_AND_MOBILE_APP_STRATEGY.md`.

**Data and backup:** No Prisma/schema change, device/install record, analytics, offline-operation table, or subscription table. Backup format remains version 33.

**Boundaries:** No push, notification permission, background/periodic sync, offline mutation queue, cached authenticated page/API, IndexedDB school data, wrapper/APK/IPA/store package, device permission, or Prompt 20A.

# Prompt 20A — AI Assistant Planning, Safety Boundaries and Read-Only Retrieval Foundation (2026-07-18)

Implemented a leadership-only read-only assistant for explicit local documentation and handwritten aggregate operational retrieval; seven permissions; five staff pages; protected APIs; strict instruction/personal-data/SQL/shell/file/URL/write refusal; pre/post redaction; provider schema and citation validation; timestamps, completeness and uncertainty; minimum group five; per-user throttling/concurrency; hash/count/timing-only audit; synthetic evaluations; accessible workflow dialogs; and backup/restore version 34.

Only deterministic MOCK is active. Local HTTP and cloud adapters remain disabled, have no persisted credentials/endpoints, and make no live calls. No personal-data answer, individual marks, Teacher ranking, external source, autonomous action, SQL, filesystem/model tool, write mutation, communication send, semantic/vector store, attachment ingestion, live model, or Prompt 20B work was added.

# Prompt 20B - Handwritten Fee Register OCR, Human Review and Controlled Payment Import (2026-07-19)

Implemented private JPEG/PNG/still-WebP page storage; deterministic MOCK and MANUAL modes; disabled provider-neutral local/cloud states; strict untrusted response validation; exact/conservative Student matching; immutable row revisions; field confidence and mandatory human checklist; duplicate evidence/resolution; review-version approval; zero-write posting preview; private purge; aggregate/reconciliation reports; formula-safe reviewed staging CSV; twelve workflow permissions plus explicit image permission; eight pages; protected APIs; and backup/restore version 35.

The finance audit confirmed that `Payment.date` drives historical Cash Book source dates, but the normal creation route does not expose one proven helper for all allocation, balance, overpayment, receipt, and idempotency invariants. Posting therefore remains disabled and no Payment/receipt/Cash Book mutation is performed. PDF, live local/cloud OCR, automatic Student selection, automatic payment, and Prompt 20C were not added.

# Prompt 20C - Automatic Encrypted Off-Device Backup and Disaster-Recovery Foundation (2026-07-19)

Added eight operational/history models; backup/restore version 36; gzip plus AES-256-GCM versioned containers; environment-only keys; plaintext/ciphertext SHA-256; MOCK and contained atomic LOCAL_FOLDER providers; disabled OBJECT_STORAGE/GOOGLE_DRIVE foundations; India-local database schedules and worker commands; read-after-write/decrypt/schema verification; health/RPO/failure reporting; isolated copied-database repeated-restore rehearsal; preview-first exact-object retention; twelve permissions; seven pages and protected APIs; aggregate reports/formula-safe CSV; and an incident runbook.

No live provider call, credential request/storage, Browser key input, plaintext upload, operational-database restore, finance/business mutation, private OCR image archive, provider object-lock claim, or Prompt 20D work is included. Deployment scheduling remains external to Prisma. Database coverage explicitly excludes private uploaded asset bytes.

# Prompt 21A - Student Location Mapping Privacy, Cost, Feasibility and Decision Gate (2026-07-19)

Completed a documentation-only review of current Student/Guardian/address foundations, server permissions, Parent isolation, generic Student export, backup/restore, PWA, AI, public-site boundaries, applicable Indian child-data/privacy considerations, Google Maps Platform, Mapbox, OpenStreetMap/Nominatim, self-hosting, cost scenarios, abuse controls, threat model, precision tiers, correction/verification flow, and phased 21B/21C/21D gates.

Decision: **CONDITIONAL GO FOR 21B** after leadership and qualified legal/privacy approval. The safe 21B boundary is structured postal address plus linked-Parent correction and, only if justified, a separate nullable manually verified coarse point. There is no schema/migration, route/API, map, geocoder, provider call/account/credential, address processing, browser location permission, AI/PWA/public exposure, exact coordinate, or persistent-data change. Backup remains version 37.

# Prompt 21A-QA - Student Location Mapping Planning QA Only (2026-07-19)

Re-audited the complete decision package, current schema/routes/dependencies, official MeitY/Google/Mapbox/OSM/Nominatim material, 35-threat register, access matrix, precision tiers, provider constraints, cost formulas/scenarios, lifecycle, map privacy, and 21B/21C/21D boundaries.

Fixed documentation traceability gaps for per-use-case lower-risk/module boundaries, threat-model review status, separate Super Admin/Director rows, separate admissions/correction/development calculations, explicit map-payload exclusions, one threat phase, and the current public Nominatim generic-integration warning. Added focused QA tests and `STUDENT_LOCATION_MAPPING_21A_QA_REPORT.md`.

No runtime/schema/migration/route/API/dependency/provider/key/geolocation/map/address/coordinate/data change was made. The planning decision remains **CONDITIONAL GO**: Prompt 21A is cleared after final verification; Prompt 21B remains blocked pending recorded leadership and qualified legal/privacy decisions.

# Prompt 21B-Preflight - Student Address Leadership, Legal and Privacy Approval Gate (2026-07-19)

Created a documentation-only approval record, Parent/child privacy-notice draft, retention/deletion policy draft, and access/incident matrix. Added focused stable governance tests that treat an externally blocked approval as the expected safe state.

Evidence result: no leadership approving person/date/reference and no qualified Indian privacy/legal reviewer/written reference were supplied or found. Decision status remains `PENDING`; all 15 mandatory release blockers are `UNRESOLVED`; final gate is `PROMPT_21B_BLOCKED`.

The recommended boundary is Tier 1 structured postal address and linked-Parent correction only, with optional suppressed text-derived Tier 2 aggregates. The exact proposed coordinate decision is `OMIT_ALL_COORDINATES_FROM_21B`; it is not formally approved. Tier 3 requires a separate phase; Tier 4 and Tier 5 are prohibited.

No schema, migration, field/model, route/API, correction form, map, geocoder, provider package/call/key, real Student address processing, operational record, Browser location permission, Prompt 21C, or Prompt 21D implementation was added. Backup remains version 37.

# Prompt 21B-Preflight-QA - Student Address Approval-Gate Verification Only (2026-07-19)

# SEC-1A - Whole Repository Security Audit and Critical Hardening (2026-07-20)

Audited authentication, sessions, authorization/IDOR, injection/RCE, XSS/CSRF/CORS/redirect/clickjacking, SSRF, uploads/paths, resource exhaustion, crypto/secrets, errors/logging, dependencies, backup/PWA/AI/public boundaries, and security UX against OWASP Top 10:2025 and ASVS 5.0.0.

Confirmed 0 Critical, 4 High, and 18 Medium findings. Fixed first-run claim, copied-QA restore, privileged-user races, seed/provider secrets, receipt/import invariants, streamed bodies, login denial behavior, password/session policy, proxy trust, raw errors, OCR/Class X/fee/cash controls, CSV formulas, webhook/send/AI limits, report caps, native dialogs, and permission-nav leakage. No schema change or operational database mutation was made.

Mandatory reports are `SECURITY_RUNTIME_AUDIT_AND_BACKLOG_RECONCILIATION.md`, `ERP_SECURITY_ATTACK_SURFACE_AND_THREAT_MODEL.md`, and `SEC_1_SECURITY_AUDIT_AND_HARDENING_REPORT.md`. SEC-1B must use a fresh copied database. Prompt 21B/21C/21D remain blocked.

Verified the four Prompt 21B governance documents for completeness, evidence authenticity, purpose/minimisation, precision, Parent notice, role access, retention/deletion, incident ownership, backup/PWA/AI/log/public exclusions, blocker consistency, and the no-implementation boundary.

Fixed three documentation-only traceability defects: explicitly omitted house photographs/device/live history, stated that no coordinate permission/default role exists, and independently listed ordinary-log and public-structured-data exclusions. Added focused stable QA tests and `STUDENT_ADDRESS_21B_PREFLIGHT_QA_REPORT.md`.

No leadership or qualified Indian privacy/legal evidence was supplied. All 15 blockers remain `UNRESOLVED`; no accountable incident person is named; the approval record remains `PENDING` / `PROMPT_21B_BLOCKED`. QA release decision: `PROMPT_21B_REMAINS_BLOCKED`.

No schema, migration, field/model, page/route/API, Parent correction form, coordinate, map, geocoder, provider, credential, operational record, Browser permission, Prompt 21B runtime, Prompt 21C, or Prompt 21D implementation was added. Backup remains version 37.

# Prompt 23B-M — Schoolknot Management Audit Reconciliation and Provisional Gap Backlog (2026-07-22)

Read the completed authenticated MANAGEMENT-role report from the connected Notion source and reconciled it against the actual Nalanda routes, APIs, Prisma models, permissions, navigation, helpers, reports, exports, portals, workflow history, backup/recovery and security boundaries. Source evidence is 15 top-level modules, 119 desktop observations and 39 exact 390×844 checks, all read-only and privacy-safe. Parent, Teacher and Principal evidence remains pending.

Created the Management replacement matrix, should-not-copy register, provisional M1-M6 implementation waves, authorised future export/migration requirements and explicit cross-role hold lists. Updated the status/gap map, replacement roadmap, limitation register, developer/operator guides and index. The main provisional missing areas are Admissions CRM; payroll/payslips/salary/advance/exit; transport; internal events/calendar; Student submissions/attachments; richer exam consolidation; discipline; cafeteria; and selected settings/reports. Core finance, Guardians, lifecycle, timetable, permissions, certificates/TC, Library and recovery are fully covered or stronger.

No Prisma model, migration, page, API, provider, deployment, Schoolknot export, credential or real school record was added or changed. Prompt 23B is not complete; final cross-role priorities remain held. Prompt 21B/21C/21D remain blocked and Prompt 22B remains conditional. The next safe gate is focused `Prompt 23B-M-QA` only.

Verification passed: 274 pages, 376 APIs, zero-write lifecycle backfill, typecheck, 1,429 tests across 157 files, optimized build with 211/211 static pages, and backup version 37 `nalanda-fee-control-backup-2026-07-22-02-03.json`. Schema hash, 41-entry migration inventory, operational database hash and 8 Students / 8 active enrollments / 19 Payments / INR 99,100 remained unchanged.

# Prompt 23B-M-QA — Independent Management Gap Reconciliation QA Only (2026-07-22)

Independently refetched the authenticated, completed 21 July 2026 MANAGEMENT report from the connected Notion source and rechecked its 15 top-level menus, 119 desktop observations, 39 exact 390×844 mobile checks, blank/inaccessible areas, privacy method and strict no-write boundary. Re-read the actual pages, APIs, Prisma models, permissions, reports, portals, exports, workflow histories and security guards supporting the replacement matrix.

Found and corrected 13 documentation-quality defects. Dashboard, notification compose, Add Student, Add Teacher/Employee, exam analytics, Old Fee Reports, HR daily attendance, Subjects and Classes were reduced to `PARTIALLY_REPLACED`; inaccessible Schoolknot Library, backup/restore and expense/budget/Cash Book rows were reduced to `NEEDS_MORE_EVIDENCE`; every should-not-copy row gained an explicit Schoolknot evidence column. No runtime defect or missing module was implemented.

Admissions, payroll/payslips/salary/advance/exit, events/calendar, transport, Student submissions/attachments, multiple-exam/board analytics, discipline, cafeteria, assets, refunds and Day Closer remain missing, partial, blocked or evidence-dependent as documented. M1-M6 remain provisional. Parent, Teacher and Principal holds remain binding. Exact result: `MANAGEMENT_RECONCILIATION_CLEARED`; final Prompt 23B is not complete and must wait for the three pending authenticated role audits. Prompt 21B/21C/21D and Prompt 22B remain blocked.

Final verification passed: 274 pages, 376 APIs, lifecycle dry run with 8 scanned/8 already enrolled/0 created, typecheck, 1,437 tests across 158 files, and optimized build with 211/211 static pages. Final clean backup is version 37 `nalanda-fee-control-backup-2026-07-22-02-29.json`; schema/database hashes, 41-entry migration inventory and 8 Students / 8 active enrollments / 19 Payments / INR 99,100 remain unchanged. The backup contains no password-hash key.

# SEC-1B - Production Portal Runtime Security, Role and UI/UX Regression Audit (2026-07-20)

Ran the optimized portal against a fresh byte-identical copied database, created only minimal QASEC1 role/ownership fixtures, generated the 274-page/375-API matrix, completed 5,841 authenticated/unauthenticated requests with zero network/5xx/private-cache violations, passed 40 adversarial runtime checks, exercised all eight roles, and visually inspected 41 major module surfaces.

Confirmed and fixed two Medium runtime UX defects: 37 px mobile drawer links now meet the 44 px minimum, and unknown routes now provide a safe custom 404 recovery action. Repeated the full Browser pass at 1440×900, 1366×768, 1024×768, 768×1024, 390×844, 375×667, and 320×568 in light/dark modes. Browser console and hydration errors were zero.

Two copied-database cleanup inspections returned zero QASEC1 records. Provider/upload/backup roots were empty, the server/logs/copied database were removed, and operational SHA-256/totals/`.env` remained unchanged. See `SEC_1_RUNTIME_BROWSER_AND_UI_UX_AUDIT.md`. Prompt 21B/21C/21D remain blocked.

# DEVOPS-1A - Private Git Baseline, Secret Scan and Trusted Initial Push (2026-07-22)

Installed official Git for Windows through Winget, verified the exact private empty GitHub repository, hardened `.gitignore`/`.gitattributes`, added the reusable candidate/staged/tracked safety scanner and regression tests, and created the private source/recovery workflow. The source audit removed literal non-production secret/default-password values while preserving production environment requirements and explicit demo-only behavior.

The trusted initial commit uses message `chore: establish verified Nalanda ERP baseline` and annotated tag `baseline-sec1-management-2026-07-22`. Operational SQLite/sidecars, backup JSON, OCR/private uploads, provider objects, QA/log/export/Schoolknot artifacts, dependencies, build output, coverage, and IDE/agent state remain local and ignored. No schema/migration or operational record was changed; Prompt 21/22 and pending Schoolknot role-audit boundaries remain unchanged. Independent DEVOPS-1A-QA is required before DEVOPS-1B migration repair.

# DEVOPS-1B - Clean-Install Migration-Chain Repair (2026-07-22)

Reproduced Prisma P3018 from an empty isolated SQLite file: the first historical migration altered missing `Payment`, the second altered missing `Student`, and dependency inventory found 16 legacy migrations with unresolved prior dependencies. Selected the new-squashed-baseline strategy because the original core schema was absent and the operational database had no `_prisma_migrations` checksum history.

Archived all 40 original migrations outside active `prisma/migrations` with their exact SHA-256 manifest. Prisma 6.19.3 generated `20260722_clean_install_baseline` from the byte-unchanged schema. Added fail-closed isolation, inventory, fresh-deploy/status, schema-equivalence, copied-onboarding, and version-37 restore checks plus focused regressions and operating documentation. No business schema, backup format, Prompt 21/22 boundary, operational record, deployment, DNS or `main` history changed.

Implementation remains on `devops/clean-install-migration-repair` for independent DEVOPS-1B-QA; do not merge until the final verification and remote fresh-clone proof are complete.

# FIN-2A - Accountant Data Minimisation, Export Privacy and Receipt Integrity (2026-07-26)

Started from clean synchronized `main` commit `44ab30bde1298035b58fcce0a8aacc6ea9c95705` on feature branch `finance/accountant-privacy-receipt-integrity`. The confirmed source risks were limited to excess Accountant Student/finance-export data, weak final-receipt cancellation authority/confirmation/audit, and possible `ReceiptNote`/`Payment` divergence.

Implemented an exact-admission finance Student lookup and purpose-specific Student, payment, ledger, collection, dues, and Viewer aggregate serializers. At the FIN-2A checkpoint, Accountant was non-delegably denied broad Student access, Student/reminder export, Parent communication, receipt-note management, and final-receipt cancellation. FIN-2B later superseded only the final-receipt authority rule through its exact permissions. Viewer/Auditor remains aggregate-only and non-delegably denied all exports and Student-ledger printing.

Hardened generic and specialized finance exports with explicit field/purpose contracts, formula neutralisation, a 2,000-row limit, date bounds where applicable, safe names, private/no-store headers, and append-only download audit. No export contains Parent contacts, address, date of birth, documents, marks, medical data, raw Student/internal actor IDs, passwords/secrets, or private Student notes.

Added authoritative whole-receipt integrity: all components active is `ACTIVE`, all cancelled is `CANCELLED`, and any mixture is `INCONSISTENT`. Director/Super Admin final cancellation requires permission, explicit reason, current version, accessible in-app confirmation, one transaction, one safe audit per changed component, and synchronized `ReceiptNote`. Repeat and racing final-state calls are idempotent. Receipt/admission/date/fee-type/term drift during correction is blocked, a unique `ReceiptNote` transactionally reserves every new receipt number, and receipt-audit ranges accept at most 500 positive safe integers.

Dedicated tests passed 23/23. Copied-database QA proved one 3-component concurrent cancellation, one idempotent racing result, zero-change repeat, and full rollback after a forced failure. Production Browser QA passed Accountant/Director/Viewer role boundaries, cancellation/print/dues/collection/Cash Book reconciliation, private caching, 1366x768 plus exact 390x844, light/dark mode, contained 44px mobile controls, zero final console warnings/errors, and zero final production stderr. Two short audit-detail summaries were found at mobile size, corrected to 44px, rebuilt, and reverified. FIN2A cleanup was inspected twice before the isolated database was destroyed.

The first final backup caught a six-row operational role-permission rewrite caused by the new hard-denial seeder. Release work stopped at the integrity gate. The seeder was corrected to preserve existing rows, a byte-identical candidate reproduced the authorised hash, and rollback-protected atomic recovery restored the exact hash, size, timestamp, schema/migration hashes, 8/8/19/INR 99,100 baseline, no `_prisma_migrations`, and backup version 37. The repeat backup left the database hash and timestamp unchanged.

Final verification passed 274 page routes, 378 API routes, typecheck, 1,496/1,496 tests across 163 files, 212/212 build entries, version-37 backup `nalanda-fee-control-backup-2026-07-26-19-36.json`, and Git safety. The feature branch remains unmerged pending independent FIN-2A-QA with a new `FIN2AQA` copied database.

# FIN-2A-QA - Independent Accountant Privacy and Receipt-Cancellation Closure (2026-07-26)

Independent QA used a fresh ignored operational copy with new `FIN2AQA` Director, Accountant, Viewer, Student, and three-component Cash plus two-UPI receipt fixtures. At that FIN-2A checkpoint, direct API checks proved the exact Accountant lookup allowlist, 403 broad Student access, 403 Accountant cancellation/Student export, purpose-specific CSV headers, aggregate-only Viewer data, 403 Viewer export, and Viewer ledger print redirect to `/unauthorized`. FIN-2B later superseded only the Accountant cancellation authority; the Student/export restrictions remain.

Reasonless and stale Director cancellation returned 400 and 409. Valid cancellation synchronized all three components and `ReceiptNote`, wrote three append-only audits, reopened INR 6,000, removed Daily Collection/Cash Book/dashboard residue, and printed `CANCELLED`. Repeat/concurrent cancellation was idempotent, forced failure rolled back completely, cross-request receipt append returned 409 with three components retained, and the unsafe `1e308` receipt range returned 400.

Browser QA passed 1366x768 and exact `window.innerWidth=390`, `window.innerHeight=844` in light/dark modes, with no overflow, contained tables, 44px controls, no native dialogs, zero console warnings/errors, and zero clean-run production stderr. QA found and corrected missing native `required`/`minLength=3` semantics on both cancellation-reason textareas, then rebuilt and reverified the corrected accessible modal on a fresh FIN2AQA copy. The deliberate invalid login returned only the safe generic message and one redacted warning. Both QA copies were cleaned to zero twice and destroyed; operational integrity remained exact.

Final QA regression passed 274 page routes, 378 API routes, typecheck, 1,496/1,496 tests across 163 files, 212/212 build entries, Git safety, and ignored backup version 37 `nalanda-fee-control-backup-2026-07-26-20-40.json`. The feature branch is ready for the guarded fast-forward merge and annotated release tag.
# AUTH-2A-P2 - Seed-Account Safeguards and Ownership Decision Package (2026-07-28)

Started from clean synchronized `main` commit
`414f12d4b8cf73f203bfc2d26161e69ad68bd98b` and the reachable
`clean-operational-baseline-v37-2026-07-28` tag. Preflight confirmed the exact
0 Student / 0 active enrollment / 0 Payment / INR 0 / 0 Guardian / 0 Staff
baseline, four enabled seed-origin roles, backup version 37, 274 page routes,
378 API routes, clean lifecycle dry-run, Git safety, and baseline typecheck.

Added a dedicated fail-closed demo-user gate: explicit
`ALLOW_DEMO_USERS=true`, an existing ignored copied/test database under
`DEMO_USER_DATABASE_ROOT`, four supplied unique non-documented passwords, and
a complete empty seed set are required. Production/staging, `prisma/dev.db`,
partial retained sets, documented passwords, and non-ignored roots are
refused. Existing and disabled seed accounts are preserved; ordinary startup
remains seed-free; intentional system/master seeding remains available.
Deployment validation rejects the demo-user flag.

System Health now blocks readiness using safe role-level counts when enabled
seed-origin accounts retain documented password provenance or more than one
active seed-origin account lacks a role-level operator decision. It exposes no
username, email, hash, password detail, token, cookie, or database ID.

The ignored copied-database rehearsal passed operational/release/partial-set
seed refusal, isolated creation, disabled-account preservation, ordinary
startup no-op, password/role/status stale-authorization rejection, concurrent
last-Super-Admin protection, repeat idempotence, safe System Health output, the
future rotate/disable sequence, and exact rollback. The operational database
hash, size, timestamp, business counts, and account rows remained unchanged.

Created `OPERATIONAL_ACCOUNT_OWNERSHIP_DECISION.md`. Proposed P3 treatment:
assign/rotate/verify the temporarily retained Super Admin first, then disable Admin,
Accountant, and Viewer until named owners need them. No operational account,
password, role, status, session, or database row changed. No Prisma model or
migration was added. Central `AuthSession` plus persisted ownership/rotation
metadata is deferred to AUTH-2B after DEVOPS-1E.

Final verification passed 274 page routes, 378 API routes, lifecycle zero-change
dry run, typecheck, 1,553/1,553 tests across 168 files, all 212 production-build
entries, copied-database AUTH-2A QA, and Git safety. Ignored backup version 37
`nalanda-fee-control-backup-2026-07-28-16-07.json` was created. The operational
database SHA-256, size, timestamp, exact zero-data business counts, and four
role-level account counts remained unchanged.

# AUTH-2A-P4B2/P4C - Operational Recovery and Secondary Account Disable (2026-07-28)

After exact operational approval and verified rollback artifacts, the governed
local recovery utility privately rotated the single active Super Admin
credential. Two fresh logins, dashboard/protected-page access, logout,
credential-tag invalidation and cleared seed-password provenance were verified.
No credential material was captured in chat, logs, Git, documentation or
Notion.

P4C retained that owned Super Admin as the only active leadership account and
disabled exactly the approved `ADMIN`, `ACCOUNTANT` and `VIEWER` accounts
through the governed User Management route. The route now requires the current
`updatedAt` value, applies a compare-and-set update, and requires a
privacy-safe reason for active-to-inactive changes. Exactly three append-only
`USER_DEACTIVATED` events were created. No User was deleted; role, credential
and role-permission values remained unchanged.

Read-only comparison with the byte-identical post-rotation rollback copy proved
the four User rows were preserved, the three intended active-to-inactive
transitions occurred, the Super Admin stayed active with the same credential,
role permissions were unchanged, and stale authorization for each disabled
account was rejected. One controlled documented-credential attempt per
disabled role returned the same generic 401 and no cookie. Browser verification
proved the retained Super Admin still opened Dashboard and Role Permissions.
The business baseline remained 0 Students / 0 active enrollments / 0 Payments /
INR 0 / 0 Guardians / 0 Staff.

Verification passed focused recovery/user/seed safeguards (24/24), typecheck,
all 1,567 tests across 169 files, the production build, diff checks and Git
safety. AUTH-2B remains deferred until after DEVOPS-1E for centralized sessions,
verified personal/work aliases, selectable verified reset channels and
single-use reset links that never email a password. IAM-1A remains a separate
future phase for named leadership/operational accounts, reusable permission
profiles and per-user grants/denials.

# DEVOPS-1E - Operational Prisma Migration-Baseline Onboarding (2026-07-29)

Started from the dynamically captured clean synchronized private `main`
commit `2bc71254d01d0bc57fa5b91867269f5ddba52661`. The required
`operational-account-hardening-v37-2026-07-28` tag was verified as its
ancestor. Git safety, 274 page routes, 378 API routes, lifecycle zero-write
dry-run, typecheck, the exact clean business baseline, account states,
configuration counts, SQLite integrity, and foreign keys passed before any
change.

An ignored byte-identical copy proved the complete Prisma sequence twice:
`migrate resolve --applied 20260722_clean_install_baseline`, deploy, and
status. It produced exactly one completed baseline row, no pending migration,
and no application digest, count, account, configuration, schema, integrity,
or foreign-key change. A fresh version-37 logical backup and byte-identical raw
copy were hashed in protected ignored storage; logical restore was rehearsed
twice into a disposable database.

After the exact approval phrase and an immediate operational hash recheck, the
same resolve/deploy/status sequence was run against the stopped operational
database and repeated to prove idempotence. The physical database SHA-256
changed from
`3BA84F4834C4BE4B682D3BCE624490A99337BCAEC8027EFC27B9C4FF4FE11022`
to
`9A888627EA2AF32433FDBA4F2F5D02C471995145E41ACE9A6D1CD0729C6EAE93`
because Prisma metadata was added. The application-table digest remained
`E019FCE5B0A3347BE0BFFC037AEEA207705E6ECA915B80B112E5D91AD69BA08C`.
The 0 Student / 0 active enrollment / 0 Payment / INR 0 / 0 Guardian / 0
Staff baseline and the one-active-Super-Admin/three-inactive-retained-account
state remained exact. No schema, configuration, user, permission, or business
row changed, and no rollback was required.

Implementation is on `devops/operational-migration-onboarding`. Independent
DEVOPS-1E-QA is the next gate; no merge is authorized by this implementation
record.

Recovery classified the operational state as
`ONBOARDING_ALREADY_COMPLETE`. The earlier blocked result came only from
`COPY_UNCHANGED_TIMEOUT` after a five-minute monitor waited for an unnecessary
private login on an ignored copied database; no Prisma command, operational
lock, partial metadata, or unexpected application change caused it. Recovery
therefore did not rerun `migrate resolve`. It stopped only the verified
copied-database server and proved deploy/status twice with no pending or
applied migration.

Final verification passed the focused migration suite (8/8), 274 page routes,
378 API routes, lifecycle zero-write dry-run, typecheck, all 1,567 tests across
169 files, the 212/212 production build, final version-37 backup and Git
safety. Copied-database Browser verification proved startup, protected-route
redirect and the login form with zero console warnings/errors; no credential
was submitted because operational login would update `lastLoginAt`. The final
application digest, physical post-onboarding database hash, metadata row,
zero-data baseline, account states, configuration, schema hashes, integrity,
foreign keys and rollback hashes remained exact.

## Prompt 23C-QA — Independent Teacher attendance exact-scope QA (2026-07-30)

Independently inspected the Prompt 23C implementation with no Prisma schema or
migration change. A fresh ignored `QA23CQA` operational copy created two
Teachers, active/inactive Staff and timetable links, multiple years/classes/
sections, exact assignments, confirmed/cancelled substitutes, Students,
enrollments, attendance sessions/correction evidence, linked Parent,
Principal, Director, Accountant and Viewer fixtures.

Database and production HTTP tests proved exact Teacher A scope, Teacher B and
cross-class/section/year denial, inactive and unlinked fail-closed behavior,
permission-only denial, dated substitute start/expiry/status, identical
list/mutation/report/CSV/dashboard scope, privacy-safe errors, POST-only
mutation, CSRF, body/record bounds, formula-safe CSV, append-only correction
evidence and one-winner expected-version concurrency. Leadership and
non-Teacher roles retained their documented boundaries.

Production Browser QA passed 1366x768 and exact 390x844 in light and dark:
assigned, empty, denied and substitute states; entry and correction dialog;
reports/export controls; Principal/Director review; mobile drawer; 44 px
controls; visible focus; contained tables; zero document overflow; no native
dialog; zero console/hydration errors; and zero production stderr.

Cleanup was inspected twice with every QA entity count zero. The copied
database, ignored state and logs were destroyed. The operational database hash
remained
`9a888627ea2af32433fdba4f2f5d02c471995145e41ace9a6d1cd0729c6eae93`;
the zero-data business baseline, one active owned Super Admin, inactive
Admin/Accountant/Viewer accounts, single clean
`20260722_clean_install_baseline` migration and backup version 37 were
unchanged.

Final release verification passed 274 page routes, 378 API routes, lifecycle
zero-write dry run, typecheck, 1,577/1,577 tests across 170 files, all 212
production-build entries with the bounded 4 GB heap, version-37 backup
`nalanda-fee-control-backup-2026-07-30-00-43.json` and Git safety.

Result: the previous attendance object-scope defect and critical Teacher
attendance blocker are resolved. Overall Teacher replacement remains
`CONDITIONAL`; no full Teacher parity is claimed. Release tag:
`teacher-attendance-scope-v37-2026-07-29`. Next phase: `UX-1A`.

## UX-1A — Shared Login, Header, Navigation and Design-System Redesign (2026-07-30)

Implemented a reusable navy/teal/gold token system and responsive public
sign-in/authenticated shell without changing authentication models, Prisma,
report-card logic, Teacher attendance, operational accounts, or business
records. The login now presents the exact Nalanda identity, truthful username
or email label, accessible password visibility, Caps Lock and busy status,
generic anti-enumeration failure, real policy/support links, and no invented
password-reset workflow.

The authenticated shell now has one academic-year control, official
transparent logo, compact human-labelled account menu, permission-derived
navigation, role-specific dashboard titles, separated application
health/deployment readiness, and exact mobile order
menu–logo–year–bell–avatar. Existing change-password verification, strong
policy, audit and stale-session invalidation were retained and exposed through
the account menu. AUTH-2B, IAM-1A, SUPPORT-1A and OBS-1A remain explicit future
boundaries.

Production Browser QA used an isolated operational copy and eight synthetic
roles. All seven required viewports, both themes, login failure, drawer focus
trap/Escape/focus return, account menu, logout, change-password form, denial,
404, health visibility, role-default routes, 44 px controls and zero overflow
passed. A final screenshot caught the transparent PNG missing from the public
middleware allowlist; that production-only defect was fixed before closure,
then the full 1,585-test suite and 212-entry build were repeated successfully.

Cleanup passed twice and was inspected twice. The copy, credentials, scratch
database and UX-1A logs were destroyed; 0 fixture users remain. The operational
hash stayed
`9a888627ea2af32433fdba4f2f5d02c471995145e41ace9a6d1cd0729c6eae93`,
with the exact zero-business/four-account baseline, one clean migration,
integrity and foreign keys unchanged. Canvs master and detailed phase boards
were created and re-fetched.

Implementation branch: `ux/shared-login-shell-redesign`. It is not merged.
Next gate: independent `UX-1A-QA`; this entry does not start that phase.

## UX-1A-QA — Independent Shared Login and App-Shell QA (2026-07-30)

Independent QA resumed from the accepted UX-1A implementation handoff and
used a fresh copied-database role matrix without activating or changing real
accounts. Super Admin, Director, Principal, Admin, Accountant, Viewer,
Teacher, and Parent passed human designation, permission-derived navigation,
single-role account-menu, default-route, and unauthorized-route checks.

QA found and corrected three shared 44 px target gaps: desktop navigation
links, the System Health action, and Change Password controls. Focused
regression assertions were added. All seven required viewports passed in light
and dark with zero document overflow, correct mobile control order, contained
menus and text, visible 2 px focus, drawer focus trap, Escape, and focus
return.

Login anti-enumeration, origin/CSRF, disabled-account denial, no-store,
secure-cookie, duplicate-submit, password-control, rate-limit, error-state,
permission, credential-log, and PWA cache boundaries passed. Change Password
rejected wrong, weak, and mismatched input; a valid copied-user change expired
the stale session, rejected the old password, accepted a fresh login, and
left only privacy-safe audit evidence.

Browser regression covered Students, fees/receipts, Attendance, Homework,
Exams/Marks, report cards, Library, certificates, notifications,
communications, AI Assistant, OCR, Cloud Backup, the public website, and
Parent/Teacher portal boundaries. Console warnings/errors, hydration errors,
native dialogs, document overflow, and final production stderr were all zero.

The first copied cleanup failed closed on two copied profile `updatedAt`
timestamps changed by module smoke tests. It was safely reset only after the
operational hash was reconfirmed. Cleanup and inspection then passed twice,
and every fixture, credential, copy, harness, runtime, and namespaced log was
destroyed. The operational SHA-256 stayed
`9a888627ea2af32433fdba4f2f5d02c471995145e41ace9a6d1cd0729c6eae93`;
the exact zero-business/four-account baseline and single clean migration were
unchanged.

Final verification passed 274 page routes, 378 API routes, lifecycle
zero-write backfill, typecheck, all 1,585 tests across 171 files, the 212-entry
production build, version-37 backup
`nalanda-fee-control-backup-2026-07-30-17-05.json`, Git safety, privacy scan,
and Prisma migration status. Canvs, private GitHub, and all five governed
Notion pages were re-fetched during closure.

Result: `UX_SHARED_SHELL_CLEARED`. Release tag:
`ux-shared-shell-v37-2026-07-30`. No staging or deployment is authorized.
`AUTH-2B`, `IAM-1A`, `SUPPORT-1A`, and `OBS-1A` remain separate. Next phase:
`EXAM-RC-IMPL-1`.

## EXAM-RC-IMPL-2 — Teacher Marks, Moderation and Calculation (2026-07-30)

Implemented exact-assignment Teacher marks entry, contributor/primary
ownership, draft/autosave, explicit final submission, correction request,
Principal reopen/reject/moderation, deterministic RAW_SUM and
WEIGHTED_NORMALIZED calculation, explicit subject groups, grade/pass/rank
feature gates, locked attendance references and immutable Student result
snapshots.

One additive migration,
`20260730_teacher_marks_moderation_calculation`, adds three governed models and
frozen scheme-policy fields while reusing the existing examination audit
ledger. Fresh and copied migration rehearsals had no drift. EXAM2 copied-DB QA
proved 4 Students, 2 Teachers, 6 primary assignments, 1 contributor, distinct
entry states, correction v2, 7 sheet versions, 4 snapshots, 25 keyed audit
events, calculation idempotency and lock. The operational source hash and
zero-business/protected-account baseline remained unchanged.

The feature branch is not merged. Independent `EXAM-RC-IMPL-2-QA` is next.
Publication, delivery, PDFs, merged PDFs, ZIPs and physical layouts remain
unimplemented; cloud deployment remains unauthorized.

## EXAM-RC-IMPL-2-QA — Independent Marks, Moderation and Calculation QA (2026-07-31)

Independent QA used a fresh ignored EXAM2QA copied database and cleared exact
Teacher object scope, all six entry states, drafts/autosave, stale and
concurrent saves, one logical final submission, correction/reopen,
resubmission, moderation, RAW_SUM, WEIGHTED_NORMALIZED, explicit subject
groups, grades/pass/rank gates, exact-cohort statistics, locked attendance and
immutable calculation snapshots.

QA corrected calculation-source/fingerprint/lock invariants, autosave edit
races, governed calculation reasons, version-37 examination backup/restore,
migration double-deploy checks, examination-table scope transitions and 44 px
moderation disclosures. The final matrix passed 174 files and 1,605 tests,
279 page routes, 400 API routes, the 217-page production build, desktop/mobile
light/dark Browser checks, clean stderr, restore rehearsal and cleanup twice.

The additive operational migration applied once after byte-identical raw and
logical rollback protection. Business data and protected account states remain
exactly unchanged. Release tag:
`exam-marks-calculation-v37-2026-07-31`.

Result: `EXAM_MARKS_CALCULATION_CLEARED`. No report publication,
Parent/Student delivery, PDF, ZIP or physical print capability is claimed.
Next: `EXAM-RC-IMPL-3`.

## IAM-1A — Named Users, Permission Profiles and Multi-Role Context (2026-08-01)

Implemented governed named-user lifecycle, multiple validity-bounded role
assignments, human designations, reusable versioned permission profiles,
individual grants and explicit denials, delegated-administration boundaries,
last-Super-Admin protection, authorization-version session invalidation and
opaque server-held role/linked-child context switching.

The central evaluator enforces account, session, role-assignment, immutable
restriction, exact object scope, individual/profile deny, individual/profile
allow, base-role and default-deny precedence. Computer Operator is a dedicated
small role and cannot become unrestricted Administrator/finance authority.
Existing Staff, Guardian, Student, Parent and exact Teacher links are reused.

One additive migration was rehearsed against a copied operational database.
The 18-user IAM1A synthetic harness passed deny precedence, safe pending
creation, delegated Director administration, self-escalation refusal,
multi-role/child context isolation, stale-version concurrency, forced rollback
and version-37 backup/restore twice. The copy was destroyed and the operational
database remained byte-identical; no real user/account/business record changed.

The branch remains unmerged. Full sequential verification, production Browser
QA, external record closure and feature-branch push are required before the
implementation result. Independent IAM-1A-QA must run only after the exact
implementation readiness gate. Staging, live providers and real-user
onboarding remain unauthorised.

## IAM-1A-QA — Independent Named-User, Permission and Multi-Context QA (2026-08-01)

Independent QA used a fresh ignored 23-user `IAM1AQA` copied-database matrix
and short copied production Browser batches. It cleared all eleven permission
precedence outcomes, exact Teacher/Parent/object scope, profile lifecycle and
impact protection, pending/temporary-password user lifecycle, delegated
administration, last-Super-Admin concurrency, authorization/session
invalidation, opaque multi-role switching, linked-child family isolation,
rollback, version-37 restore twice and cleanup twice.

QA corrected legacy base-role-only authorization calls, cross-context
object-scope grant handling, Teacher-link scope, concurrent last-Super-Admin
database invariants, raw-role login responses, delegated UI controls,
reauthentication field clearing and nested audit redaction/humanisation.
Desktop and exact 390 x 844 mobile Browser QA passed in light and dark with no
overflow, sub-44 px actions, native dialogs, navigation leakage, console or
hydration errors, or clean-runtime stderr.

The additive migration applied once after two byte-identical rollback restore
rehearsals; the second deploy was a no-op. The exact zero-business baseline and
protected-account digest are unchanged. Final verification passed 288 page
routes, 423 API routes, 178 files/1,627 tests, the 234-page bounded build,
backup version 37 and Git safety.

Result: `IAM_DELEGATED_ACCESS_CLEARED`. Release tag:
`iam-delegated-access-v37-2026-08-01`. The feature branch is retained. No
staging, deployment, live-provider activation or real-user onboarding is
authorised. Next governed phase: Prompt 23D — Parent Attendance and
Examination Timetable.
## Prompt 23D — Parent Attendance and Examination Timetable (2026-08-01)

Implemented a read-only Parent attendance projection that revalidates the IAM
active Parent role and current opaque child context, active Guardian link and
exact active academic-year enrollment on every page/API request. Only official
submitted/locked rows are returned; notes, remarks, Staff identities, raw IDs,
other Students and audit content are excluded. Existing status counts are
reused. No percentage or working-day count is inferred because no approved
policy exists.

Added the smallest examination-timetable version/row/event layer over the
existing examination, class-scope and subject-paper domain. Principal workflow
supports draft/clone, conflict inspection, preview, ready, publish, replacement,
withdrawal and history with expected-version CAS, idempotency, serializable
publication, immutable published rows and append-only audit. Parent views show
only the current published exact-cohort version.

The `PARENT23D` copied-database harness passed migration idempotence, exact
one/multi-child scope, cross-family/stale/removed-link denial, multi-role
context isolation, exact attendance counts, draft denial, replacement and
withdrawal visibility, stale-version refusal, forced-failure rollback and
version-37 backup/restore. The operational database remained byte-identical.
Browser/full regression/build/external closure and independent Prompt 23D-QA
remain release gates; no merge, tag, deployment, provider or real-user
onboarding is authorised.

## Prompt 23D-QA — Independent Parent Attendance and Examination Timetable QA (2026-08-02)

Independent QA used a fresh ignored `PARENT23DQA` copied-database matrix and
three short copied-database production Browser batches. It cleared exact
one/multi-child and multi-role isolation, official attendance reconciliation,
published-only exact-cohort timetable delivery, Principal conflict/CAS/
publication/replacement governance, forced rollback, full version-37 restore
twice, authenticated print scope, light/dark desktop and exact `390x844`
accessibility, zero final console/hydration errors and zero production stderr.

QA fixed fail-closed print error handling, explicit IAM selector labelling and
containment, exact actor/reason/version lifecycle retry matching, and nested-
transaction-safe timetable restore. An independent 34-receipt security diff
scan returned zero findings. The final sequence passed 294 page routes, 429
APIs, lifecycle dry-run, typecheck, 1,636 tests across 179 files, bounded 4 GB
production build, backup version 37 and Git safety. Migration state is clean,
the copied fixtures/runtimes were removed and inspected twice, and the exact
zero-business/protected-account operational baseline remains unchanged.

Result: `PARENT_ATTENDANCE_TIMETABLE_CLEARED`. Release tag:
`parent-attendance-timetable-v37-2026-08-02`. The feature branch is retained.
No staging, deployment, live-provider activation or real-user onboarding is
authorised. Next governed phase: Prompt 23E — Events, Holidays and Academic
Calendar.

## Prompt 23E — Events, Holidays and Academic Calendar (2026-08-02)

Implemented one additive, versioned internal academic-calendar foundation.
Operational working-day classifications are governed separately from
informational events, with totals/diffs, examination conflicts, posted-
attendance impact evidence and immutable reasoned replacement history. New
attendance locks and report publications retain their calendar basis; existing
attendance is never rewritten.

Published events freeze their audience and resolve Parent, Teacher and
leadership visibility through active IAM context plus exact Guardian/enrollment
or Staff/timetable assignment scope. Parent/Teacher month, agenda, upcoming and
authenticated print views expose only authorised published entries. Current
published examination timetables are referenced read-only and never duplicated.
Exactly-once in-app notifications are isolated from publication integrity.

The focused 9-test group and `CAL23E` copied-database matrix passed, including
audience isolation, multi-child context, attendance non-rewrite, notification
deduplication, replacement history, restore twice and zero operational mutation.
Full sequential verification and short copied production Browser batches passed;
the feature branch is pushed and re-fetched with synchronized external governance
records before the implementation readiness result is issued.
Independent Prompt 23E-QA is required before main merge/tag. No staging,
deployment, public-site publishing, live provider or real-user onboarding is
authorised.

## Prompt 23E-QA — Independent Events, Holidays and Academic Calendar QA (2026-08-03)

Independent review corrected fail-closed workflow action selection, exact
emergency-closure permission, published-history database protection, current
examination-reference scope, live notification audience resolution, active-role
notification reads, leadership-only bounded export, exact attendance/report
basis scope and atomic idempotent backup restore.

Fresh `CAL23EQA` copied-database fixtures proved all six operational day types,
all eight audiences, immutable publication/replacement/withdrawal history,
posted-attendance non-rewrite, locked report basis, Parent/Teacher isolation,
multi-role/multi-child switching, current examination reference, notification
deduplication, concurrency refusal, forced rollback and restore twice. Three
short production Browser batches passed desktop/mobile light/dark checks with
44 px actions, semantic structures, visible focus, no overflow, zero console or
hydration errors and zero production stderr.

The single additive migration applied once and its second deployment was a
no-op. Protected rollback and restore evidence passed; the exact zero-business
and protected-account baseline remained unchanged. The final sequential route,
lifecycle, typecheck, 1,652-test, bounded build, version-37 backup and Git safety
gates passed. The governed release retains the feature branch and uses annotated
tag `events-holidays-calendar-v37-2026-08-03`.

Result: `EVENTS_HOLIDAYS_CALENDAR_CLEARED`. Next governed phase: Prompt 23F —
Classwork, Secure Submissions, Attachments and Feedback. No staging, deployment,
public-site event publication, live provider activation or real-user onboarding
is authorised.

## Prompt 23G - Consolidated, Comparative and Board-Exam Reporting (2026-08-03)

Implemented ten governed report families over exact locked result snapshots and
current issued report-card versions. Reports retain source/formula/rounding/
scheme/attendance versions and generation time; identical requests are
idempotent, while corrections append a superseding immutable run. Compatibility
rules refuse formula, rounding, component or calculation-mode drift and permit
explicit published-percentage comparison only when maxima alone differ.

Director/Principal, exact Teacher assignment, linked Parent/self Student and
suppressed Viewer boundaries are revalidated server-side. CSV/PDF exports are
private, bounded and deterministic; charts use text labels and patterns; Class
IX/X output carries a non-board disclaimer. No raw-mark recalculation, Teacher
ranking, Parent surveillance, public result, board submission, provider transfer
or external AI is introduced.

The `REPORT23G` copied-database harness passed two migration deployments, raw
and weighted sources, compatible/incompatible cases, all entry states, groups,
ties, multiple sections, revision/preboard evidence, role tampering, immutable
and concurrent runs, forced rollback, backup/restore twice and byte-identical
operational isolation. Independent Prompt 23G-QA remains required before merge,
tag or operational migration.

## Prompt 23G-QA - Independent Consolidated and Board-Exam Reporting QA (2026-08-03)

Fresh `REPORT23GQA` copied fixtures independently verified two years, Classes IX
and X, four sections, two Teacher scopes, linked Parent/Student, suppressed
Viewer and denied-role boundaries. Hand calculations covered deltas,
normalisation, paper/group/combined values, outcomes, averages, highest, ties and
completion. Incompatible formula/calculation structures were refused and
unissued or drifted sources failed closed.

Independent QA corrected same-name timetable-subject restore identity and 44 px
report-filter targets. Deterministic/concurrent runs, immutable summaries,
supersession, stale warnings, rollback, append-only audit, safe CSV/private PDF,
backup generation twice and restore twice all passed. Principal, Teacher, Parent
and Viewer passed 1366 x 768 and 390 x 844 Browser checks in light/dark with
visible focus, labelled patterned charts, no overflow/dialogs and zero console,
hydration or runtime-stderr errors. Cleanup was inspected twice.

The sequential 307-page/457-API route inventory, zero-change lifecycle pass,
typecheck, 184-file/1,677-test suite, 4 GB build, version-37 backup and Git safety
gates passed. The approved additive migration applied with clean status and the
exact zero-business/protected-account baseline unchanged. The retained feature
branch and annotated tag are `feature/consolidated-board-reporting` and
`consolidated-academic-reporting-v37-2026-08-03`.

Result: `ACADEMIC_REPORTING_CLEARED`. Next governed phase: Prompt 23H -
Admissions and Enquiry CRM. No deployment, public results, official board
submission, live provider or real-user/data onboarding is authorised.

## Prompt 23H - Admissions and Enquiry CRM (2026-08-03)

Implemented privacy-minimal public/staff enquiries, follow-ups/visits,
cryptographic hash-only invitations, versioned private applications, strict
private documents, exact duplicate suggestions with human resolution,
append-only decisions/offers, exactly-once Student/Guardian/enrollment
conversion and suppressed aggregate reporting.

The `ADMIT23H` copied-database matrix proves public idempotence/honeypot,
invitation expiry/single use, encrypted asset backup with two restores and
wrong-key refusal, role/object isolation, concurrency, forced rollback and
version-37 logical restore twice. Operational business data remains zero and
unchanged. Feature push, external re-fetch and independent Prompt 23H-QA remain
required before release; deployment, live providers and real applicant/data
onboarding remain unauthorised.
