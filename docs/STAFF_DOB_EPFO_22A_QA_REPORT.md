# Prompt 22A-QA Staff DOB, EPFO/EPS and Age-58 Planning Report

## Result

- QA date: 2026-07-20
- Scope: documentation and governance verification only
- Prompt 22A status: fully cleared for planning and governance
- Prompt 22B status: conditional; coding and real-data work are not authorised until the decision-record conditions have dated evidence
- Release result: `PROMPT_22A_CLEARED_BUT_22B_CONDITIONAL`

## Defects found and fixed

1. The source register used official sources but did not explicitly say that no unofficial blog or vendor summary was treated as authority. The boundary is now explicit.
2. The age-58 boundary separated claim decisions but did not state in one direct sentence that a reminder creates and submits no claim. That sentence is now explicit.
3. The Unified Employer Portal row said no authenticated review occurred but did not enumerate the boundary. It now records that only the public read-only entry page was reviewed and that no login, credential, upload, form submission, provider/API call or transaction was attempted.

No runtime, data, schema, permission or portal-integration defect was created or fixed.

## Official-source QA

All authorities in the planning register are official EPFO, India Code, Ministry of Labour and Employment, PIB or MeitY sources and were reviewed on 2026-07-20. No unofficial blog was used as authority.

The QA rechecked:

- the historic Employees' Provident Funds and Miscellaneous Provisions Act, 1952 foundation and the current Code on Social Security transition/savings boundary;
- the current EPFO-hosted Employees' Provident Funds Scheme, 1952;
- the current EPFO-hosted Employees' Pension Scheme, 1995, including paragraph 12 age-58 superannuation/deferment context;
- EPFO FAQs, the public Unified Employer Portal entry and official member-profile correction material;
- official 2025 correction circulars and process-reform material;
- the Code on Social Security, its commencement material, section 164 savings and the final Social Security (Central) Rules, 2026; and
- the DPDP Act/Rules phased privacy context.

The EPFO scheme pages were current pages last updated 15 July 2026 during QA, and the public employer entry page showed a 17 July 2026 update. These page dates are freshness evidence, not proof that a rule applies to a particular Staff member. The register keeps transition uncertainty and the need for a current EPFO consultant, CA, labour-law professional or qualified lawyer visible.

## Age-58 QA

Passed. The documents state that age 58 is relevant to EPS superannuation-pension administration and is only a human review trigger. It is not automatic retirement, termination, a pension-eligibility finding, a claim, a contribution instruction or a pension promise. A reminder cannot change employment, Staff status, salary, attendance, exit, contribution or pension data and must display:

> Review EPFO/EPS records and obtain professional guidance.

## Data-minimisation and UAN QA

Passed. Every proposed Prompt 22B field is classified as required, optional, omitted or deferred. Aadhaar, PAN, bank data, passwords, OTPs, sessions, source-document images and full UAN are omitted. Full UAN has no approved operational necessity, encryption design or access case.

The safe first boundary uses a controlled UAN availability status and, only if approved, optional masked last four digits. Unknown, unverified, disputed, declined and guidance-required states remain distinct. DOB correction is append-only, invalidates prior calculations and requires deterministic recalculation after verification.

## Access QA

Passed. Super Admin, Director, Principal, Admin, Accountant, Viewer, Teacher/Staff and Parent/Public are treated separately. Director is the routine reminder owner. Super Admin is exceptional governance. Principal DOB access is optional and purpose-based. Accountant access is explicitly assigned, restricted and masked. Admin receives no EPFO identifier/compliance authority by default. Viewer receives only separately approved suppressed aggregate counts. Staff own-view is deferred until approved private self-service exists. Parent/Public have no access.

## Privacy and retention QA

Passed as design, with external approval still required. The package includes a versioned purpose notice, mandatory/optional disclosure, correction and grievance rights, field-specific access audit, masking, explicit projections, export restrictions, screenshot/print warnings, encrypted backup coverage, restore controls and post-exit hold/review/deletion design.

DOB/EPFO data is excluded from the public website, PWA/offline cache, AI Assistant, communication templates, ordinary Staff lists/search and broad CSV. A final post-employment retention schedule, privacy notice, incident owner and backup expiry procedure remain approval conditions before Prompt 22B.

## Reminder QA

Passed as Prompt 22C design only. The 58th birthday must be calculated from India-local calendar dates without UTC/timezone drift and unit-tested. A 29 February DOB is stored exactly; the non-leap-year anniversary policy must be approved before Prompt 22C.

Recommended milestones are 365, 180, 90 and 30 days before, date reached and overdue review. The design includes acknowledgement, bounded snooze, resolution reason, append-only events, aggregate counts and DOB-correction recalculation. It contains no automatic employment, pension, contribution, claim or external email/WhatsApp/SMS action.

## Compliance-checklist QA

Passed as Prompt 22D draft only. A checked item records a human review step and cannot certify statutory compliance, EPFO acceptance, eligibility, contribution correctness, a claim or pension entitlement. The draft contains evidence references, owner/reviewer/dates, discrepancies, corrective action, professional-guidance states, completion review, next review and append-only audit history.

## Phase-boundary QA

- Prompt 22B: minimal neutral DOB/EPFO-status fields, correction/verification, dedicated permissions, append-only events and backup/restore only after its conditions pass. No reminder dashboard or portal automation.
- Prompt 22C: Director-only age-58 review dashboard, acknowledgement, snooze, resolution, overdue state and recalculation only after its separate gates pass. No employment, pension, contribution, claim, portal or external-message action.
- Prompt 22D: human compliance checklist, safe evidence references, aggregate reports and append-only audit only after professional approval. No statutory certification claim or portal automation.

Prompt 21B, Prompt 21C and Prompt 21D remain blocked and untouched.

## Unresolved external questions

The following remain explicit conditions, not defects hidden by QA:

- current Code/scheme/rule applicability to the establishment and actual Staff facts;
- coverage, contribution, EPS membership and case-specific correction procedures;
- the legal/operational basis for collecting each item;
- approved source categories without retaining unnecessary copies;
- post-employment field/event/backup retention;
- Staff notice, correction/grievance and incident ownership;
- Principal, named Accountant, own-Staff and aggregate-suppression access decisions;
- the 29 February non-leap-year reminder policy before Prompt 22C; and
- professional approval of Prompt 22D wording and evidence sufficiency.

## No-implementation verification

Pre-flight confirmed:

- schema SHA-256: `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00`;
- migrations: 40 directories / 41 entries including `migration_lock.toml`;
- routes: 274 pages / 376 APIs;
- backup format: version 37;
- operational SQLite SHA-256: `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392`;
- Staff / active Staff: 0 / 0;
- Students / active enrollments: 8 / 8;
- Payments / collected: 19 / INR 99,100; and
- lifecycle backfill: 8 active Students scanned, 8 already enrolled, 0 missing and 0 created.

Final command results:

- `pnpm.cmd routes:list`: passed; 274 page routes / 376 API routes;
- `pnpm.cmd lifecycle:backfill`: passed dry-run; 8 active Students scanned, 8 already enrolled, 0 missing, 0 created and no data changed;
- `pnpm.cmd typecheck`: passed;
- `pnpm.cmd test`: 1,419 tests across 156 files passed, including 9 Prompt 22A-QA boundary tests;
- `pnpm.cmd build`: passed with the established bounded 4 GB heap and generated 211/211 static pages; and
- `pnpm.cmd backup`: created `nalanda-fee-control-backup-2026-07-20-11-32.json`, backup version 37, SHA-256 `A8EC3F536C9545DD1201A97C15A9A6D1E718F586F10D1BA1CD393D202CFCEAA7`.

Post-command verification matched the pre-flight values exactly: schema hash, migration inventory, route/API counts, backup version, operational database hash, Staff/business totals and lifecycle state were unchanged. No DOB, UAN or EPFO record was created; no authenticated or transactional EPFO portal/provider call occurred; no credential was requested or stored; and no Prompt 22B work began.

Prompt 22A is fully cleared for planning/governance. Prompt 22B is not yet safe to begin coding or real-data work because the decision-record leadership, professional and privacy conditions remain unmet.
