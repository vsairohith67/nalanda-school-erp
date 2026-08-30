# Nalanda Synthetic Pilot Acceptance Pack

**Prompt:** `SYNTHETIC-PILOT-READINESS-1A`
**Scope:** provider-independent, synthetic-only operational rehearsal
**Software candidate:** `feature/synthetic-pilot-readiness-1a` from `origin/main` `a82c3c49a6d7737fafe5ebfefb5aad304532ae03`
**Operational activation:** prohibited

This pack operates the already-built Nalanda School Management System as a synthetic school. It does not import operational records, deploy staging, activate real users, certify physical devices, or broaden a cleared role.

## Immutable boundaries

- `REAL USERS — NOT ACTIVATED`
- `REAL DATA — NOT IMPORTED`
- `PROVIDER — UNDECIDED`
- `PRIVATE STAGING — NOT DEPLOYED`
- `OCR_AND_SCANNING — NOT YET SOFTWARE-CLEARED`
- `BIOMETRIC HARDWARE — NOT CERTIFIED`
- `BIOMETRIC-STAFF-ATTENDANCE-1A` owns biometric source, schema, migration and UI work. This branch uses manual Staff-attendance foundations only.
- Transport, Cafeteria, Parent Meetings, Offline Sync, Cross-Platform Apps and public Event Media remain default-off at zero production rollout. Synthetic fixture rows do not activate them.

## Governed synthetic school

The disposable fixture is created only at `tmp/synthetic-pilot-readiness-1a/synthetic-pilot.db`. It requires explicit test opt-in, refuses production mode and the operational database path, and never writes credentials or database files to Git.

| Dataset area | Scale / variants |
| --- | --- |
| Students | 800 across Classes I–X and Sections A–D; active, inactive, transferred and withdrawn |
| Guardians | 1,200; Parent, Guardian and Grandparent labels; sibling and two-Guardian families |
| Staff | 80, including 45 teaching Staff; active/inactive variants |
| Academic history | 800 current enrollments plus 200 prior-year enrollments |
| Finance | full, partial and unpaid patterns; Cash/UPI manual evidence; expenses and misc income |
| Attendance | 800 Student records and 80 manual Staff records; present, absent and late |
| Academics | governed exam, locked marks, issued reports and classwork |
| Operations | Library, support, Parent Meetings, Admissions, Offline Sync, optional operations and private Event Media metadata |

All names begin with `Synthetic` or `SYNPILOT`; phone numbers use reserved zero prefixes and email addresses use `example.test`.

## Current gap audit

`Real-data ready` means a separately approved onboarding process could start after all listed gates; it never means data is imported now.

| Requirement | Implemented | Tested | Operationally rehearsed | Training ready | Real-data ready | External gate | Owner decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Authentication, sessions and IAM | Yes | Module/final-scope evidence | Pilot role/API matrix | Yes | No | Named accounts/MFA/private staging | Account owners and escalation owner |
| Students, Guardians and Staff | Yes | Module and scale evidence | 800/1,200/80 fixture | Yes | No | Provenance/import approval | Source-file owners |
| Timetable and Teacher scope | Yes | Exact-scope regression | Teacher-day checklist | Yes | No | School master-data confirmation | Timetable owner |
| Student attendance | Yes | Attendance regression | School-day fixture | Yes | No | Attendance policy/training | Principal |
| Staff attendance foundation | Yes | Manual workflow regression | Manual Staff day only | Yes | No | Biometric remains separate | Principal/HR |
| Fees and family payments | Yes | Finance/idempotency tests | Synthetic fee day | Yes | No | Receipt policy/opening balances | Finance owner |
| Expenses, misc income and Cash Book | Yes | Finance regression | Exact cash closing | Yes | No | Opening balance/category approval | Director/Accountant |
| Admissions | Yes; public form off | CRM/security tests | Synthetic funnel | Yes | No | Real documents/privacy/public activation | Admissions owner |
| Exams and marks | Yes | Academic Integrity tests | Exact-scope cycle | Yes | No | Academic calendar/sign-off | Principal |
| Report cards | Yes | Publication/PDF tests | Issued-only rehearsal | Yes | No | Real issue authorization | Principal |
| Classwork/homework | Yes | Module tests | Teacher/Parent flow | Yes | No | Classroom adoption | Academic owner |
| Library | Yes | Circulation/charge tests | Issue/return/overdue | Yes | No | Catalog provenance/barcode policy | Library owner |
| Support/complaints | Yes | Privacy/SLA tests | Synthetic incidents | Yes | No | Legal retention text | Support/privacy owners |
| Parent Meetings | Yes; default off | Independent QA | Synthetic lifecycle | Yes | No | Operational activation | Principal |
| Transport/Cafeteria | Yes; default off | Bounded module QA | Synthetic only | Reference only | No | School need/policy/activation | Owner decision |
| Event Media | Yes; public off | Governance/security tests | Generated private image | Yes | No | Consent/storage/retention | Privacy owner |
| Offline Sync | Yes; default off | Conflict/idempotency QA | Synthetic outage drafts | Yes | No | Managed-device/private staging | Security/finance owners |
| Native foundation | Yes; default off | Windows/Android/iOS foundation | Provider-independent contracts | Reference only | No | Private HTTPS/physical device/signing | Platform owner |
| PostgreSQL/portable staging | Software-ready | Synthetic stack evidence | Failure drills are synthetic | Ops guides ready | No | Provider/DNS/TLS/legal/budget | Owner/provider decision |
| Backup/restore v44 | Yes | Restore-twice suites | Synthetic drill | Yes | No | Off-host destination/key custody | Recovery owner |
| Smart AI | Read-only foundation; disabled | Safety/grounding tests | Super Admin read-only flow | Yes | No | Runtime activation separate | AI/privacy owner |
| OCR/scanning | No | No | No | Boundary documented | No | `OCR-BENCHMARK-1A` | Future owner decision |
| Biometric Staff attendance | Separate active thread | Not owned here | Manual foundation only | Boundary documented | No | Hardware/vendor certification | Separate release |

## Rehearsal sequence and evidence

1. Record operational SQLite size, timestamp, SHA-256 and sidecars.
2. Create the fresh synthetic fixture with `pnpm.cmd qa:synthetic-pilot:fixture` under explicit test opt-in.
3. Run `pnpm.cmd qa:synthetic-pilot` and the named module, security, offline, portable, PostgreSQL, native and final-scope gates.
4. Run Browser acceptance at 1366×768 and 390×844 in light/dark for Super Admin, Principal, Accountant, Teacher, Parent and Viewer/denied personas.
   The recorded synthetic result is in [Synthetic Pilot Browser Acceptance](evidence/SYNTHETIC_PILOT_BROWSER_ACCEPTANCE.md).
5. Run the v44 logical and governed private-object restore rehearsal twice. The recorded result is in [Synthetic Pilot Backup and Restore](evidence/SYNTHETIC_PILOT_BACKUP_RESTORE.md).
5. Run failure and recovery drills against disposable services/data. No injected failure may report false success or duplicate a finance write.
6. Back up the synthetic database, restore into two fresh targets, compare counts and financial totals, and record local rehearsal RTO without calling it an SLA.
7. Clean the fixture, hash the operational SQLite again, and require byte identity.

## Scorecard

No single compliance percentage is allowed. Each dimension receives `PASS`, `PARTIAL_EXTERNAL_GATE`, `REQUIRES_FIXES`, or `NOT_RUN`, with evidence in the clearance document.

| Dimension | Pass condition |
| --- | --- |
| Role access correctness | UI, route, API and service boundaries agree; direct bypass denied |
| Critical workflow pass rate | All launch-critical synthetic scenarios pass; optional features reported separately |
| Financial reconciliation | Zero paise difference; duplicates/conflicts produce no second write |
| Academic integrity | Teacher permanent marks-write remains denied; exact profile remains bounded |
| Parent isolation | Only active linked-child data and issued reports are returned |
| Offline recovery | Only three cleared draft types; restart/reconnect/conflict/revoke are controlled |
| Backup recovery | Two restores preserve counts, finance, immutable history and private-object evidence |
| Browser usability | Required role/view/theme matrix has no critical overflow, console, hydration or private flash |
| Native foundation | Provider-independent contracts pass; physical certification is explicitly open |
| High/Critical defects | Zero unresolved software Critical/High |
| Operator training | Role guides, quick sheets and escalation placeholders complete |
| Incident preparedness | Failure/security first-response steps are executable and owned |
| External gates | Every provider, legal, real-data, device and activation gate remains explicit |

## Defect classification

Use exactly: `SOFTWARE DEFECT`, `UX/TRAINING ISSUE`, `PROCESS ISSUE`, `POLICY DECISION`, or `EXTERNAL GATE`. Only an owned, low-collision software defect may be fixed here. Any biometric/shared-schema item is logged and left to its owner. Any unresolved Critical/High software defect prevents clearance.
