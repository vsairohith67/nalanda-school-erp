# Prompt 22A Staff DOB and EPFO/EPS Decision Record

## Decision

`PROMPT_22B_CONDITIONALLY_APPROVED`

Decision date: 2026-07-20

This is conditional approval to prepare/implement only the minimal, neutral Prompt 22B data-quality foundation after the conditions below are evidenced. It is not approval for real-data entry, full UAN, portal automation, age-58 reminders, checklist certification, employment action, contribution action, pension determination, claims or Prompt 22C/22D.

## Why this decision is conditional

The repository can support a low-risk, permissioned, append-only DOB verification and neutral status workflow. However:

- the Code on Social Security transition is current and still developing;
- final Social Security (Central) Rules were notified in May 2026;
- official EPF/EPS scheme text and portal procedures remain relevant but must be interpreted within the current transition;
- DOB/profile correction procedures vary by UAN/Aadhaar state and have changed recently;
- DPDP duties have a phased commencement timeline;
- no named leadership approval, qualified professional opinion, final retention schedule, Staff notice, incident owner or leap-day reminder policy was supplied in Prompt 22A.

Neutral data fields may therefore proceed only after the conditions are recorded. Legal/eligibility/contribution/reminder logic may not.

## Approved Prompt 22B field boundary

Approved in principle:

- nullable exact `dateOfBirth`;
- controlled `dobSource`;
- verification status/time/actor;
- correction status and bounded safe reason;
- neutral EPFO coverage and review statuses;
- optional verified EPF joining date;
- optional neutral EPS membership status;
- tri-state/multi-state UAN availability status;
- optional UAN last four digits;
- optional e-nomination and KYC/profile statuses;
- last/next review dates;
- bounded `complianceNotesSafe`;
- opaque safe evidence reference; and
- dedicated append-only DOB/compliance events.

Existing `dateOfJoining` and Staff `status` are reused and never auto-changed. A new employment start date is omitted. Employment end date is deferred to a separate employment-lifecycle decision.

The exact enum vocabulary, mandatory/optional rules and database shape require implementation review, but may not become more sensitive than this boundary without a new decision record.

## UAN decision

Full UAN: **OMIT**.

Prompt 22B may store only availability status and optional last four digits. No full UAN, Aadhaar, PAN, bank detail, password, OTP, authentication payload, portal session or source-document image may be stored, logged, backed up, exported, cached, sent or exposed to AI/public surfaces.

## Reminder decision

Prompt 22B has no reminder or dashboard.

Prompt 22C should use 365-, 180-, 90- and 30-day windows, the date reached and overdue review as states of one restricted review item. Every reminder must say:

> Review EPFO/EPS records and obtain professional guidance.

It must never direct retirement/termination, guarantee pension, stop EPS contribution, change Staff status or send email/WhatsApp/SMS automatically. Prompt 22C is blocked until a fresh official/professional review and a recorded leap-day anniversary policy.

## Permission decision

Use dedicated permissions:

- `VIEW_STAFF_DOB`
- `MANAGE_STAFF_DOB`
- `VERIFY_STAFF_DOB`
- `VIEW_STAFF_EPFO_STATUS`
- `MANAGE_STAFF_EPFO_STATUS`
- `VIEW_EPFO_AGE58_REMINDERS`
- `MANAGE_EPFO_COMPLIANCE`
- `VIEW_OWN_STAFF_COMPLIANCE`
- `VIEW_EPFO_COMPLIANCE_AGGREGATES`

Director is the routine privileged owner. Super Admin is exceptional governance. Principal has operational DOB access only if approved, not EPFO by default. Accountant access is explicit assignment and masked. Admin manages the DOB queue but cannot verify by default. Teacher/Staff own-view is deferred until private self-service is approved. Viewer sees only separately approved suppressed aggregates. Parent/Public have no access.

## Privacy and retention decision

The architecture must include a versioned purpose notice, correction/grievance route, field/role-specific access logs, masked display, explicit DTOs, no broad CSV, print/screenshot warnings, encrypted backup coverage and exclusions from public website, PWA offline cache, AI Assistant and communication templates.

No fixed post-employment retention period is approved. Prompt 22B may proceed only after a qualified professional approves an interim field/event/backup schedule and hold/review owner. Deletion automation remains blocked until that schedule is complete.

## Conditions before Prompt 22B coding

1. Named school leadership approves purpose, mandatory/optional classification, role defaults and own-Staff scope.
2. A qualified EPFO consultant/CA/labour-law professional or lawyer provides a dated review of the current Code/scheme/rule transition and the neutral statuses.
3. A qualified privacy reviewer approves notice, correction, security, incident and interim retention design for the law operative at go-live.
4. Full UAN remains omitted.
5. The design uses explicit unknown/disputed/guidance-required states and never automatically determines coverage/EPS eligibility.
6. Prompt 22B backup/restore is versioned, encrypted off-device, backward-compatible and excludes prohibited data.
7. Synthetic-only QA, blocked-role testing, append-only-event testing and operational hash/totals checks are specified.
8. Prompt 21B, Prompt 21C and Prompt 21D remain untouched.

## Unresolved professional questions

- Exact effect of the Code on Social Security commencement, section 164 savings, 2026 Rules and later notifications on this establishment and each proposed status.
- Current coverage, wage, contribution and EPS membership rules for actual Staff facts; the ERP must not answer them.
- Exact current member/employer/EPFO-office correction procedure for each UAN/Aadhaar/profile scenario.
- Whether any DOB/EPFO status is mandatory for the school to collect and on what legal/operational basis.
- Appropriate source categories and whether any source may be inspected without retaining a copy.
- Post-employment retention periods for DOB, masked identifier, status, evidence reference, events and encrypted backups.
- Staff notice, correction/grievance route, incident owner and any processor obligations.
- Principal access, named Accountant assignments, own-Staff self-service and aggregate suppression threshold.
- The deterministic non-leap-year anniversary rule for a 29 February DOB before Prompt 22C.
- Checklist language/evidence sufficient for Prompt 22D without implying statutory certification.

## Phase gates

| Phase | Gate |
| --- | --- |
| Prompt 22B | Conditionally approved within this record; no real data until leadership/professional/privacy conditions are recorded |
| Prompt 22C | Blocked pending 22B QA, fresh official/professional review, leap-day policy and Director-only reminder approval |
| Prompt 22D | Blocked pending qualified checklist approval, evidence/retention ownership and no-certification report design |

## No-implementation evidence

At Prompt 22A pre-flight:

- schema SHA-256 remained `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00`;
- migration inventory remained 40 directories / 41 entries including the lock file;
- routes remained 274 pages / 376 APIs;
- backup format remained version 37;
- operational SQLite SHA-256 remained `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392`;
- Staff/active Staff remained 0/0;
- Students/active enrollments remained 8/8;
- Payments/collected remained 19 / INR 99,100; and
- no DOB/UAN/EPFO record, authenticated/transactional portal call, portal automation, credential, reminder, Staff/finance/attendance mutation or Prompt 21B/21C/21D work was created. Public official documentation pages were reviewed read-only.

Final command and backup evidence is recorded in the Prompt 22A history entry and final handoff after verification.

## Prompt 22A-QA gate

Prompt 22A-QA may begin after the final release commands pass and the post-command schema, migration, route, API, backup-version, operational-hash and business totals checks match this record. Prompt 22A-QA remains documentation/governance verification only and must not begin Prompt 22B.

## Prompt 22A-QA decision addendum

Prompt 22A-QA was performed on 2026-07-20 after its gate passed. The QA corrected three documentation-precision defects without changing runtime behavior:

1. it made the official-only authority boundary explicit;
2. it stated directly that an age-58 reminder creates and submits no EPFO claim; and
3. it distinguished public read-only portal-page review from prohibited authentication, provider/API calls and transactions.

The planning package is fully cleared for its documentation and governance purpose. Prompt 22B remains conditional on the eight conditions above; its coding and real-data work are not authorised by this addendum. Prompt 22C and Prompt 22D retain their separate blocked gates.

Prompt 22A-QA release result: `PROMPT_22A_CLEARED_BUT_22B_CONDITIONAL`.
