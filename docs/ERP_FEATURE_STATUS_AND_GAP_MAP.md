# ERP Feature Status and Gap Map

## Prompt 23B final Schoolknot multi-role consolidation

Prompt 23A role evidence is complete for Management, Parent, Principal, Teacher and the supporting Accountant/Employee report. Prompt 23A-E finished the exact 109-item unresolved-evidence classification and the authoritative Notion handoff is `READY_FOR_PROMPT_23B`. Prompt 23B reconciles that evidence against the current repository only; it imports no Schoolknot data and implements no module.

Final decision: `REPLACEMENT_BUILD_CONTINUES_CUTOVER_NOT_READY`. Management, Parent, Principal and Accountant have narrow `CONDITIONAL_GO` pilot decisions; Teacher is `NO_GO` because Student attendance is permission-gated but not restricted to exact active timetable class/section assignments. Prompt 23C is the first proposed implementation and may begin only after 23B-QA.

FIN-2A and FIN-2A-QA are complete with `FINANCE_PRIVACY_AND_RECEIPT_INTEGRITY_CLEARED`. `DEVOPS-1D PAYMENT_GATED_DEFERRED`; no provider, VPS, DNS, external backup or monitoring was activated. Prompt 21B-21D remain blocked. Prompt 22B remains conditional and Prompt 22C-22D remain blocked.

## DEVOPS-1C staging readiness

DEVOPS-1B clean-install migration repair is fully cleared. Staging architecture/readiness is in progress on `devops/staging-readiness-plan`; this is infrastructure planning/local synthetic rehearsal, not a deployed ERP feature. SQLite is acceptable only with one process and one persistent local disk. No cloud/DNS/operational database/live provider action occurred. Physical PWA certification and external staging remain pending user provider/budget/hostname/access/backup/monitoring/uptime decisions. Prompt 21B-21D remain blocked, Prompt 22B conditional, and Parent/Teacher/Principal Schoolknot audits pending.

## Prompt 22A-QA status update

Prompt 22A is fully cleared as a current, privacy-safe and legally cautious planning package. QA fixed three documentation-precision gaps and confirmed no runtime implementation. Verification passed with 274 pages, 376 APIs, 1,419 tests across 156 files, 211/211 static pages and backup version 37. Prompt 22B remains conditional on named leadership, professional EPFO/labour-law and privacy approvals plus the decision-record controls; Prompt 22C/22D remain separately blocked. Release result: `PROMPT_22A_CLEARED_BUT_22B_CONDITIONAL`.

## Prompt 22A status update

Staff DOB, minimal EPFO/EPS status and Director-only age-58 review are **planned only**. Prompt 22A adds a current official-source register, age-58 non-employment boundary, field-minimisation decisions, full-UAN omission, DOB quality rules, dedicated access matrix, privacy/retention controls, reminder milestones, checklist draft and exact 22B/22C/22D gates. No schema, migration, route, API, permission, reminder, portal automation, Staff/finance/attendance record or backup-format change was made.

Decision: `PROMPT_22B_CONDITIONALLY_APPROVED`. Prompt 22B is limited to neutral human-reviewed DOB/status fields, correction/verification, dedicated permissions, append-only events and backup/restore after named leadership, EPFO/labour-law and privacy conditions are recorded. Prompt 22C remains blocked pending a fresh official/professional review and leap-day policy. Prompt 22D remains blocked pending a professionally approved no-certification checklist. Full UAN is omitted; backup remains version 37. Prompt 21B/21C/21D remain blocked and untouched.

## Prompt 19B status — WhatsApp one-way foundation

Implemented: official Meta Cloud API adapter boundary, deterministic MOCK default, disabled LIVE gate, explicit Guardian/Staff phone-bound consent, approved text-template mappings, Prompt 19A reuse, preview/approval/queue/retry/cancel, signed status/opt-out webhooks, quiet hours, versioned INR estimates without finance posting, masked reports/CSV, Parent/Teacher ownership, and backup version 31. Remaining deployment gaps are supervised LIVE credentials, public HTTPS webhook subscription, and real Meta account/template verification. Prompt 19C email/SMS is not started.

Latest implementation phase: Prompt 16D-QA; Prompt 16E is planning only.  
Purpose: summarize what exists, what is partial, and what is still missing before Nalanda can safely replace Schoolknot-style workflows.

## Built Features

| Feature area | Current status | Priority | Suggested prompt |
|---|---|---|---|
| Authentication, roles, permissions | Built: named users, role matrix, Super Admin safety, server-side page/API guards | Must-have before Schoolknot replacement | Complete; continue regression QA |
| Fee collection | Built: payments, split receipts, receipts, print, due calculation, ledger | Must-have before Schoolknot replacement | Complete; polish UI in 14B/14C |
| Daily collection and pending dues | Built: reports, filters, reminder CSV/text | Must-have before Schoolknot replacement | Complete; dashboard cards later |
| Receipt/payment audit | Built: duplicate, split, missing/cancel/reference checks, payment audit history | Must-have before Schoolknot replacement | Complete; dashboard warnings later |
| Student Master | Built: add/edit/list/import/export with fee rules | Must-have before Schoolknot replacement | Complete; mobile form polish later |
| Import/export and pilot acceptance | Built: preview-first imports, saved verification, pilot acceptance, backup/restore | Must-have before Schoolknot replacement | Complete; keep evidence-first |
| Parent/guardian foundation | Built: guardian master, links, parent accounts | Must-have before Schoolknot replacement | Complete |
| Parent portal | Built: read-only dues/receipts/notices | Must-have before Schoolknot replacement if read-only portal is enough | Complete; parent attendance is future |
| Parent notices | Built: staff notice workflow and parent visibility | High value after migration | Complete foundation |
| Staff/Teacher foundation | Built: staff master, optional user/timetable links, teacher start page | Must-have before academic modules | Complete foundation |
| Timetable foundation/builder/generator/print/export | Built: masters, assignments, manual builder, generator, active draft, print/export | Must-have if timetable is managed in ERP | Complete; UX polish needed |
| Manual student attendance | Built: daily session, save/submit/lock, reports/export | Must-have if Schoolknot holds attendance | Complete foundation |
| Manual staff attendance | Built: daily session, save/submit/lock, reports/export | Must-have if staff attendance is required | Complete foundation |
| Staff leave | Built: draft/submit/approve/reject/cancel, reports/export | High value after migration | Complete foundation |
| Substitute teacher foundation | Built: manual coverage, planner, suggestions, workflow, reports/export | High value after migration | Complete foundation |
| Academic-year enrollment/lifecycle and progression foundation | Built: one enrollment per student/year, append-only lifecycle events, protected reviewed progression decisions and explicit transactional finalization | Must-have before annual roll-over | Prompts 15B, 15B-QA, 15C, and 15C-QA complete |
| UDISE+ planning checklist | Built: read-only overview, student/staff gap reports, compact summary, safe checklist CSV, role-separated view/export | School review aid only | Prompt 15D complete; not compliance or official submission |
| Expense and vendor foundation | Built and QA-verified: vendor master, categories/departments, Decimal expense register, approval/rejection/payment/cancellation workflow, partial-payment ledger, reports/CSV, audit trail, restricted payloads, and version-15 restore safety | Must-have before finance replacement if expense register is needed | Prompt 16A and Prompt 16A-QA complete; Prompt 16B next |
| Budget and department spending controls | Built: annual plans, category/department allocations, approval/lock, preserved revisions, approved-expense commitments/actuals, thresholds, reports/CSV, and dashboard summaries | High value after expense foundation | Prompt 16B built; Prompt 16B-QA next |
| Miscellaneous income and daily cash book | Built: configurable non-fee items/rates, separate multi-line receipts, cancellation/print/reports, authoritative physical-cash calculation, deposits, Director handovers, variance, snapshots, source drift, approval/lock, and CSV | Must-have before replacing manual finance books | Prompt 16C foundation built; Prompt 16C-QA next |
| Backup/restore | Built: version 17 JSON backup/restore coverage including expense/vendor, budget, miscellaneous-income, and cash-book records | Must-have before Schoolknot replacement | Known SchoolSettings limitation remains |
| Dashboard command center | Built: permission-filtered finance, people, attendance, leave, substitute, notice, warning, activity, and quick-action summaries | High value after Phase 14 shell | Prompt 14C and 14C-QA complete |

## Partially Built Features

| Feature area | Built now | Missing | Priority | Suggested prompt |
|---|---|---|---|---|
| Parent communication | Notices, manual WhatsApp text/CSV | SMS/WhatsApp/email provider, queue, retry, delivery audit, consent | Must-have before replacement if Schoolknot messaging is relied on | Prompt 20A or later Notification Delivery Foundation |
| Parent attendance visibility | None in parent portal | Safe read-only child attendance summary and absence details | Must-have before replacement if parents use attendance in Schoolknot | Later Parent Attendance View; keep separate from Prompt 15C progression |
| Audit logs | Payments/users and workflow-specific histories | Full cross-module change log with before/after/reason | Must-have before replacement for sensitive records | Cross-module Audit Expansion |
| Calendar/events | Future plan only | Holidays/events calendar and publishing | High value after migration | Future Calendar and Events Foundation |
| Biometric attendance | Planning only | Identity map, raw punches, file import, preview, dedupe, derived attendance | High value after manual workflows stabilize | Later Biometric Import Adapter; keep separate from Prompt 15D UDISE+ checklist |
| Finance visuals | Fee, expense, and budget-versus-actual reports exist | Cash-flow/cash-book visuals and forecast | High value after finance foundations | Prompt 16C or later |
| School-specific registers | Fees, attendance, miscellaneous-income, and daily cash-book foundations | Books/library-specific income, publisher payments, broader certificates | Must-have if currently used outside ERP | Prompt 16D and later |

## Missing Schoolknot-Replacement and Rohith-Notes Features

| Missing area | Why it matters | Priority | Suggested prompt number |
|---|---|---|---|
| Admissions/enquiry | Admission-season pipeline, enquiry tracking, document checklist, conversion to Student Master | Must-have before Schoolknot replacement if Schoolknot handles admissions | Separate future Admissions Foundation; not Phase 15 academic progression |
| Appointments/parent meetings | Parent meetings, principal appointments, follow-up notes | High value after migration | Future Parent Meeting and Appointment Log |
| Homework/assignments | Teacher-to-class homework, due dates, attachments, parent visibility | Must-have before replacement if Schoolknot is used for homework | Future Homework and Assignment Foundation |
| Exams/marks/report cards | Exam setup, marks entry, grades, report cards, parent result view | Must-have before replacement if Schoolknot stores academic results | Prompt 17B or later - Exams/Marks Foundation |
| Promotion/repeat/double-promotion/transfer/left workflow | Reviewed progression and departure decisions with evidence, approvals, acknowledgements, and audit | Must-have before annual roll-over | Prompt 15C - Promotion / Repeat / Transfer / Left Workflow |
| UDISE+ checklist/data-gap dashboard | Government-report preparation, missing-data review, and strength reconciliation without submission automation | High value after lifecycle records stabilize | Prompt 15D - UDISE+ Checklist and Student Data Gap Dashboard |
| Student attendance parent visibility | Parents need child attendance visibility if replacing Schoolknot app | Must-have before replacement if currently used | Prompt 16D - Parent Attendance Visibility |
| Biometric attendance import | Device/file-based attendance evidence | High value after manual attendance is trusted | Prompt 17A - Biometric Attendance Import Adapter |
| Expense/vendor/budget management | Expense/vendor and annual budget controls are built; Prompt 16B-QA remains | Must-have before finance replacement if expense register is needed | Prompt 16A/16B built; QA budget controls next |
| Books/library income and publisher payments | School-specific collections and payments not covered by fee module | High value after migration | Prompt 17E - Books and Publisher Ledger |
| Library management | Catalog/accession foundation built; circulation absent | Catalog titles/copies and permanent accession are built; membership, issue/return, fines, stock, barcode, and RFID remain later | Prompt 16G-16J; keep separate from books finance, procurement, and valuation |
| Bonafide/TC/migration/Class X certificate package | Official document issue register, templates, approvals, print, and transfer-event linkage | Must-have before replacement if Schoolknot provides certificates | Prompt 18A - Certificates/TC/Bonafide Linkage |
| Events/holidays calendar | Parent/staff calendar and attendance/timetable context | High value after migration | Prompt 18C - Calendar and Holidays |
| Full audit/change log | Compliance and trust across master data and workflows | Must-have before replacement for sensitive changes | Prompt 18D - Full Audit Log |
| Website/app/PWA strategy | App-like parent/staff use without native-app maintenance | Later advanced, after responsive web improves | Prompt 19A - PWA Strategy |
| WhatsApp/SMS/email notifications | Automated delivery with consent, logs, retries, failures | Must-have if Schoolknot messaging is operationally critical | Prompt 19B - Notification Delivery Foundation |
| Payment gateway | Online payments, callbacks, settlement and refund reconciliation | Must-have only if online payments are required at migration | Prompt 19C - Payment Gateway Foundation |
| Virtual ID cards | Student/staff identity cards and revocable QR/ID | Later advanced | Prompt 20A - Virtual ID Cards |
| AI assistant/chatbot | Help and retrieval layer over safe ERP docs/data | Later advanced | Prompt 20B - Safe AI Assistant |
| Handwritten fee register OCR | Assist migration/reconciliation from handwritten records | Later advanced | Prompt 20C - Handwritten Register OCR |

## Phase 15 academic/compliance sequence after Prompt 14C-QA

Prompt 15A is planning only and creates the compliance/lifecycle gap map before schema or workflows. Continue narrowly:

1. **Prompt 15B - Academic Year Rollover and Student Lifecycle Foundation**
2. **Prompt 15C - Promotion / Repeat / Transfer / Left Workflow**
3. **Prompt 15D - UDISE+ Checklist and Student Data Gap Dashboard**
4. **Prompt 17B or later - Exams/Marks Foundation**
5. **Prompt 18A - Certificates/TC/Bonafide Linkage**

Do not combine these prompts. Prompt 15B must settle history, backfill, permission, correction, and backup/restore design before Prompt 15C mutates progression state. Prompt 15D should remain a reviewed checklist/dashboard before any export is considered.

## Prompt 15D checklist status

The `/udise` module is a read-only planning/review surface over existing ERP data. It provides safe status-only checks for student basics, enrollment/lifecycle, guardian/contact, staff, school settings, and Aadhaar/privacy. Its CSV is explicitly a checklist gap report, not an official UDISE+ export. No schema, backup version, portal integration, Aadhaar verification, or source-record mutation was added.

Next scoped options: Prompt 15E reviewed data-gap fix forms after school field confirmation; Prompt 17B exams/marks foundation; Prompt 18A certificates/TC/bonafide linkage; Prompt 21A student location privacy, cost, and feasibility planning.

## Migration Decision Notes

- A missing feature is not automatically a blocker; it is a blocker only if Nalanda currently depends on it in Schoolknot or an official manual register.
- Before building each future module, collect the actual source workflow, reports, exports, owners, acceptance checks, and backup/audit requirements.
- Keep new modules additive, permission-gated, backup-covered when durable, and tested independently.

## Prompt 15C progression foundation status

| Capability | Status | Boundary |
|---|---|---|
| Progression decision ledger | Built | Draft, submit, approve/reject, finalize, cancel; all records retained. |
| Promote/repeat finalization | Built | Transactional source close, target enrollment create, lifecycle append; duplicate target blocked. |
| Transfer/left/dropout/passed-out finalization | Built | Transactional source close and lifecycle append; no target enrollment. |
| Correction | Partial | Review record only; dangerous correction finalization intentionally disabled. |
| Double promotion / bulk cohort rollover | Not built | No automatic mapping or batch finalization. |
| UDISE+, exams/marks, admissions, certificates | Not built | Separate future phases; notes are text-only planning evidence. |

## Prompt 16D books and library finance foundation

| Capability | Status | Boundary |
|---|---|---|
| Academic-year book catalog/rates | Built | Historical rates and receipt snapshots; no stock quantity or valuation. |
| Book-sale receipts | Built | Separate receipt number and ledger; never changes student fee or miscellaneous-income records. |
| Daily book-cash settlement | Built | Expected active CASH sales, submit snapshot, Director handover once, source drift. |
| Publisher bills/payments | Built as expense wrapper | Reuses Vendor, ExpenseRecord, and ExpensePayment; no duplicate payment ledger. |
| Annual library-management service | Built as expense draft | Vendor-based Professional Fees / Library; operator-entered amount; no payroll. |
| Books reports/CSV/receipt print | Built | Operational reports with masked/allowlisted fields and formula-safe CSV. |
| Library catalog/accession | Built foundation | Separate titles, permanent physical accessions, events, imports, reports, and v19 backup. No circulation, barcode scanning/RFID, stock, valuation, PO, or procurement. |

## Prompt 16E library circulation plan

Prompt 16E audited the books-finance, expense, miscellaneous-income, permissions, portals, import/export, and version-18 backup patterns and added planning documents only. The decision is a separate `LibraryTitle` and accessioned `LibraryCopy` model; `BookCatalogItem` remains a sales catalogue. Future library charges should use a dedicated operational charge record and create a linked Miscellaneous Income receipt only when collected. Recommended delivery: 16F catalog/accession, 16G membership/circulation/reservations, 16H overdue/lost/damaged/charges/portals, 16I barcode, and 16J stock verification. RFID, procurement, and inventory valuation remain separate later work.

## Prompt 16F library foundation status

Library bibliographic titles, permanent physical accessions, append-only copy events, preview imports, memberships, policies, issue/return/renewal, reservations, derived overdue, explicit lost/damaged incidents, approved charges, full/partial waivers, exactly-once Miscellaneous Income collection, reports/CSV, isolated Parent/Teacher views, permissions, and backup/restore version 21 are **Built**. Barcode labels/scanning (Prompt 16I), RFID, stock verification (Prompt 16J), procurement, and inventory valuation remain **Not built**. Books-finance and student-fee records remain separate.
# Prompt 16I update

Library barcode labels and keyboard scanner assistance are available; stock verification remains planned for Prompt 16J.
# Prompt 16J update

## Prompt 17A update

Homework and Assignments Foundation is implemented with timetable-scoped Teacher access, linked-child Parent isolation, audited workflow, privacy-safe reports/CSV, and backup/restore v23. Submission, uploads, grading, marks, report cards, AI generation, and external notifications remain gaps by design.

Library stock verification is implemented as a safe foundation: scoped sessions, expected snapshots, barcode/accession/manual observations, issued/repair exceptions, discrepancy review, explicit append-only corrections, final locking, masked reporting, CSV, and backup/restore v22. Physical scanner hardware certification and any RFID/camera/valuation/procurement capability remain gaps by design. Next planned Prompt 17A.
# Prompt 17B update — Exams and Marks Foundation

Exams/raw marks are now built at foundation level: exam cycles, timetable-backed assessments, exact Teacher scope, decimal marks and absent/exempt/not-applicable states, submit/approve/lock separation, controlled approved-mark correction, preview-confirm CSV import, internal analytics, append-only events, and backup/restore v24.

# Prompt 17C update

Digital report cards are built: configurable grade bands/templates, one-locked-exam mark cards, full LKG/UKG Evaluation I-V rubrics, attendance/growth snapshots, separate submission/approval/issue, immutable corrected versions, linked-child Parent views, operational reports, print layouts, and backup/restore v25. Multi-exam aggregation, Parent acknowledgement, Student login, notifications, signature images, rank/merit, automatic progression, and Teacher analytics remain intentionally missing.

## Prompt 17D status

Teacher Performance Analytics and Review Foundation is implemented with versioned category definitions, immutable snapshots/reviews/events, leadership workflow, Teacher own shared/finalised view, aggregate Viewer reporting, privacy-safe leadership CSV, and backup/restore version 26. It intentionally has no score, rank, employment automation, Student identity/raw marks, AI conclusions, surveillance, or Prompt 18A expansion.

## Prompt 18A status

Bonafide, Study, Conduct, and Transfer Certificate foundations are **Built**: validated school templates, issue-time numbering, internal/Parent requests, separate review/approval/issue, immutable correction/reissue history, linked-child isolation, source completeness warnings, TC active-enrollment confirmation without lifecycle mutation, A4 monochrome print, reports/CSV, and backup/restore v27. Certificate fees/payments (Prompt 18B), Migration/board packages, public verification, QR codes, signature uploads, and digital signatures remain **Not built**.
# Prompt 18B status

Built: configurable Class X package snapshots, current/historical Class X source preview, Prompt 18A school-certificate version links, Board/Migration custody-only tracking, approved Miscellaneous Income collection or full waiver, partial/complete physical handover, Parent linked-child status, reports/CSV, A4 acknowledgment, and backup version 28.

Boundary/gap: the ERP does not issue Board certificates, store scans, claim Board eligibility, process a payment gateway, use fee `Payment`, or mutate lifecycle/progression/marks/report cards. The school must verify official procedures. Prompt 18C remains separately scoped.
# Prompt 18C status

Virtual Student and Teacher/Staff ID cards are implemented with role-gated templates, issue-time number series, individual and batch workflows, correction/replacement/revocation history, Parent/Teacher isolation, CR80/A4 printing, exact authenticated lookup, safe reports/CSV, and backup v29. Physical printer/vendor integration, personal-photo management, RFID/NFC, attendance/access control, and public lookup remain explicit gaps/non-goals.

# Prompt 19A status

The authenticated In-App Notification Centre and delivery ledger are implemented with plain-text templates, immutable audience snapshots, deduplicated User recipients, Teacher timetable scope, Parent linked-child isolation, scheduling/expiry, read/dismiss/acknowledgment history, corrections/withdrawal, aggregate privacy-safe reports, CSV, and backup v30. Existing Parent Notices remain unchanged and appear as a separate legacy feed without fabricated receipts.

External delivery remains a gap and a hard boundary: no WhatsApp, SMS, email, push, Firebase, PWA service worker, provider integration, webhook, credential, contact-field snapshot, or external delivery queue exists.
# Prompt 19C status update

Secure one-way SMS and Email foundations are now built: independent contact-bound consent, DLT/domain readiness, Prompt 19A audience reuse, approved templates, preview/approval, persistent MOCK queues, retries, signed mock webhook evidence, suppressions, aggregate reports/CSV, permissions, and backup/restore v33. Gmail API architecture exists but remains disabled; Gmail acceptance is not inbox delivery. No live SMS adapter is installed because no school-selected provider contract is present. Live provider onboarding, production credentials, DNS/DLT evidence, and supervised activation remain deployment gates. Two-way communication and Prompt 19D remain missing by design.

# Prompt 19D status update

The ERP now has a privacy-safe PWA foundation: App Router manifest, exact normal/maskable icons, a first-party versioned service worker, static-assets-only caching, generic offline page, connection/update UX, logout-scoped cache clearing, install guidance, and permission-gated diagnostics. Authenticated pages and APIs remain network-only. There is no push, notification permission, background sync, offline write queue, native wrapper, APK/IPA, device tracking, or schema change. Backup remains version 33. Physical Android/iOS installation and any future wrapper/native package remain separate gates in `PWA_AND_MOBILE_APP_STRATEGY.md`.

# Prompt 20A status update

The leadership-only read-only AI assistant foundation is **Built** for allowlisted local documentation and handwritten aggregate operational tools. Answers carry citations, timestamps, completeness and uncertainty; input/output safety checks block instructions, secrets, personal data, individual marks, rankings, arbitrary files/URLs, SQL/shell and all mutations. Audit is hash/count/timing only. The deterministic MOCK provider is active; local HTTP and cloud providers are disabled and make no live calls. Backup/restore is version 34.

Semantic search, external sources, attachments, autonomous actions, record writes, live local models, cloud AI, distributed throttling, and production provider certification remain gaps requiring separate review. See `AI_ASSISTANT_SAFETY_AND_READ_ONLY_RETRIEVAL_WORKFLOW.md`.

# Prompt 20B status update

Private handwritten fee-register OCR staging is **Built** for bounded JPEG/PNG/still-WebP uploads, deterministic MOCK extraction, MANUAL transcription, exact/conservative Student matching, immutable correction history, confidence/checklist review, duplicate evidence, version-bound approval, zero-write posting preview, private purge, reconciliation reports, formula-safe CSV, and backup/restore version 35.

Actual Payment posting is deliberately **Blocked**. The existing Payment creation path does not expose one proven helper for outstanding balances, exact fee allocation, overpayment refusal, receipt allocation, exactly-once retry, and historical Cash Book correctness. LOCAL_HTTP, CLOUD_API, PDF input, automatic matching, and future OCR payment posting remain gaps requiring separate review.

# Prompt 20C status update

Automatic encrypted database backup and disaster-recovery foundation is **Built for MOCK/LOCAL_FOLDER; LIVE disabled**: gzip-before-AES-256-GCM, versioned environment keys, plaintext/ciphertext hashes, readback verification, India-local schedules/worker commands, health/failure/RPO reporting, isolated repeated restore rehearsal, retention preview/exact pruning, reports/CSV, and backup/restore version 36.

Deployment scheduler setup, a selected/reviewed live provider, provider-specific immutable retention/ransomware controls, automated production cutover, and private OCR/uploaded-asset backup remain gaps in Prompt 20C. Prompt 20D was subsequently completed as the separate public-website foundation and does not change cloud-backup provider readiness.

# Prompt 20D status update

The controlled Premium Public Website and App Experience Foundation and QA are **Built and cleared**: public/private route separation, versioned controlled content and publication workflow, accessibility/SEO/PWA boundaries, permissions, reports, backup/restore version 37, and the GoDaddy website-only cutover runbook. Hosting purchase/deployment, DNS cutover, analytics, enquiry CRM, public Student data, native packaging, and app-store submission remain separate gates.

# Prompt 21A status update

Student location mapping is **Planned only; conditionally cleared for a restricted Prompt 21B**. The current Student model still has only its legacy nullable free-text `address`; there is no coordinate, map, geocoder, provider, location permission, route, API, browser permission, or address processing. Backup remains version 37.

Prompt 21B may begin only after leadership and qualified Indian privacy/legal review approve the purpose, child/guardian notice, precision tiers, retention, correction, incident, permission, backup, and export rules. Its safe boundary is structured postal address plus linked-Parent correction and, only if justified, a separate nullable manually verified coarse point. Automatic/live geocoding, exact-house coordinates, maps, public Nominatim, generic export, AI use, PWA caching, and public exposure remain gaps or prohibitions. See `STUDENT_LOCATION_MAPPING_PRIVACY_COST_AND_FEASIBILITY.md`.

# Prompt 21A-QA status update

Planning QA re-verified the no-implementation boundary, legal caution, 35-threat coverage, explicit role matrix, precision tiers, provider policies, transparent 800/1,000/2,000 Student calculations, lifecycle, map privacy, and separate 21B/21C/21D gates. Eight documentation/test traceability defects were corrected without product or data changes. The decision remains **CONDITIONAL GO**; Prompt 21B is blocked until its leadership and qualified privacy/legal release conditions are recorded.

# Prompt 21B preflight status update

# SEC-1 security status

Repository security hardening is **Built for local code controls; deployment controls pending verification**. Authentication, sessions, route/object authorization, copied-QA restore, receipt ownership, streamed bodies, OCR/private paths, Class X/fee/cash validation, CSV exports, webhook/send/AI limits, error redaction, report caps, headers, PWA/public boundaries, and accessible confirmations are implemented and tested.

Remaining gaps are deployment TLS/HSTS/proxy/logging/distributed coordination,
live-provider approval, physical device/PWA checks, and future MFA/SSO/recovery
decisions. SEC-1-QA fixed the legacy XLSX advisory with exact-pinned official
SheetJS 0.20.3. Prompt 21B/21C/21D remain blocked.

The approval record, privacy-notice draft, retention/deletion draft, and access/incident matrix are **documented but not approved**. No leadership evidence or qualified Indian privacy/legal review was found, all mandatory blockers remain `UNRESOLVED`, and the final gate is `PROMPT_21B_BLOCKED`.

The recommended boundary is Tier 1 structured postal address with linked-Parent correction and authorised office verification, plus only suppressed text-derived Tier 2 locality aggregates if later approved. The exact proposed coordinate decision is `OMIT_ALL_COORDINATES_FROM_21B`; Tier 3 requires a separate phase, and Tier 4/Tier 5 remain prohibited. No schema/runtime implementation, address/location collection, map, geocoder, provider, route/API, or backup-version change occurred. Backup remains version 37.

## SEC-1B runtime status

Production runtime security and UI/UX audit is **Built and cleared for the local copied-database boundary**: complete route/API role matrix, eight-role Browser verification, Parent/Teacher object isolation, adversarial probes, exact responsive light/dark passes, private-cache/header checks, console/stderr review, two UI fixes, repeated production pass, and zero-residue cleanup.

Deployment TLS/HSTS/proxy/log aggregation/distributed coordination,
physical-device PWA verification, live-provider certification, and future
MFA/SSO/recovery decisions remain gaps. The later independent SEC-1-QA pass
fixed the reachable `xlsx` advisory, rechecked all roles/four exact viewports,
and completed zero-residue copied-DB cleanup. Prompt 21B/21C/21D remain blocked.

## SEC-1-QA independent status

Independent static and optimized-runtime verification is **fully cleared for the
authorized local boundary**. It fixed one High supply-chain defect and three
Medium GET-semantics, role-boundary, and mobile-accessibility defects. The
current route inventory is 274 pages and 376 APIs. Deployment-only TLS/HSTS,
proxy sanitization, centralized logs, multi-instance coordination, live
providers, and physical-device PWA behavior remain explicit environment checks.

## Prompt 23B-M provisional Management reconciliation

The authenticated Schoolknot **MANAGEMENT** audit completed on 21 July 2026: 15 top-level modules, 119 desktop observations and 39 exact 390×844 checks, all under a strict no-write/no-export/privacy-safe boundary. The code-derived reconciliation is recorded in `SCHOOLKNOT_MANAGEMENT_REPLACEMENT_MATRIX.md`.

Independent Prompt 23B-M-QA corrected 12 over-strong row classifications. Nalanda is fully replacing or materially stronger only for specifically observed, code-proved parts of offline fee/payment control, Guardians, Student lifecycle/progression, timetable, role permissions and certificates/TC. Nalanda has mature local expenses/budgets/Cash Book, Library and backup/recovery foundations, but their inaccessible Schoolknot source modules remain `NEEDS_MORE_EVIDENCE`, not comparative parity claims. Partial areas include dashboard demographics, Student/Staff form depth, attendance consolidation, Staff leave depth, homework/assignments, exam consolidation, communication deployment, selected settings and universal audit coverage. Missing or conditional areas include Admissions CRM, payroll/payslips/salary/advance/exit, transport, internal events/holidays/calendar, Student submissions/attachments, discipline, cafeteria and selected reports.

This is planning/reconciliation only. No Management gap module was implemented. Parent, Teacher and Principal audits remain pending, so Prompt 23B final consolidation is **not complete** and cross-role priorities remain held. Prompt 21B/21C/21D remain blocked; Prompt 22B remains conditional and unimplemented.

Management-only QA result: `MANAGEMENT_RECONCILIATION_CLEARED`. The clearance applies only to the corrected interim reconciliation; see `SCHOOLKNOT_MANAGEMENT_RECONCILIATION_QA_REPORT.md`. Final Prompt 23B still waits for the three pending authenticated role audits.
