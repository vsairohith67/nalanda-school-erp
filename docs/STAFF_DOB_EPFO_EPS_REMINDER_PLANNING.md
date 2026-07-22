# Staff DOB, EPFO/EPS Status and Age-58 Reminder Planning

## Document status

- Prompt: 22A
- Review date: 2026-07-20
- Status: planning and governance only
- Legal status: not legal, tax, pension, payroll, or employment advice
- Runtime status: no schema, migration, route, API, permission, record, reminder, provider, or backup-format change
- Required reminder wording: **Review EPFO/EPS records and obtain professional guidance.**

This plan deliberately separates an administrative review reminder from employment, retirement, pension, contribution, claim, and portal decisions. It must not be used to terminate employment, promise a pension, determine EPS eligibility, calculate a pension, stop contributions, or submit anything to EPFO.

## Current repository baseline

The current `StaffMember` model has identity, work-profile, contact, `dateOfJoining`, `status`, optional linked `User`, timetable linkage, timestamps, and attendance/leave/library/communication relations. It does not have Staff DOB, employment end date, EPFO coverage, EPS membership, UAN, KYC, e-nomination, compliance-review, or age-58 fields.

Current Staff statuses are `ACTIVE`, `INACTIVE`, and `LEFT`. The current permissions are broad Staff permissions (`VIEW_STAFF`, `MANAGE_STAFF`, `IMPORT_STAFF`). Teacher self-service is implemented only through the StaffMember linked to the signed-in User for bounded existing modules; no DOB or EPFO self-service exists. `UserAudit` and multiple module-specific event models demonstrate actor/time/detail audit patterns, but there is no Prompt 22 event model.

Prompt 22A pre-flight:

| Check | Result |
| --- | --- |
| Page routes | 274 |
| API routes | 376 |
| Lifecycle backfill | 8 active Students scanned; 8 already enrolled; 0 created |
| Typecheck | Passed |
| Staff | 0 |
| Active Staff | 0 |
| Students / active enrollments | 8 / 8 |
| Payments / collected | 19 / INR 99,100 |
| Backup format | Version 37 |
| Schema SHA-256 | `B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00` |
| Migration inventory | 40 migration directories / 41 entries including `migration_lock.toml` |
| Operational SQLite SHA-256 | `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392` |

## Official-source register

Only official Government of India, India Code, Ministry of Labour and Employment, EPFO, PIB and MeitY sources are treated as authority in this plan. No unofficial blog, vendor summary, social-media post or remembered rule is used as authority.

All sources below were reviewed on 2026-07-20. “Current” and “applicable” remain subject to the transition notes and professional review in the last column.

| Source | Official URL / reference | Relevant part | What it supports | Uncertainty / professional review |
| --- | --- | --- | --- | --- |
| Employees' Provident Funds and Miscellaneous Provisions Act, 1952 | [India Code Act text](https://www.indiacode.nic.in/bitstream/123456789/12828/1/the_employees_provident_funds_and_miscellaneous_provisions_act%2C_1952_no_19_of_1952_date_04.03.1952_.pdf) | Sections 6, 6A and historic scheme authority | Historic EPF/EPS statutory foundation | The Code on Social Security commencement and section 164 savings now control the transition; lawyer/EPFO professional must confirm the exact current interaction. |
| Employees' Provident Funds Scheme, 1952 | [Current EPFO scheme text](https://www.epfo.gov.in/employees-provident-funds-scheme/) | Paragraphs 26, 26A, 29, 34, 36 and 61 | Membership, employer joiner/leaver records, contribution framework, declarations and nomination administration | Do not encode coverage, rate, wage-ceiling, or contribution conclusions. A CA/EPFO consultant must assess each case under current law and notifications. |
| Employees' Pension Scheme, 1995 | [Current EPFO scheme text](https://pmvbry.epfindia.gov.in/eps-scheme/) | Paragraphs 6A, 12(1), 12(7B) and 14 | Age 58 is relevant to EPS administration; pension may be deferred and employment/contribution facts require separate review | Never infer employment termination, eligibility, contribution stopping, or benefit amount. Professional review is required. |
| EPFO Frequently Asked Questions | [EPFO FAQ](https://www.epfo.gov.in/faq-epfo/) | DOB correction, UAN, scheme certificate and age-58 answers | UAN is a 12-digit EPFO identifier; correction and member-service procedures are external | FAQ wording can lag newer portal procedures. Confirm the live process before advising a Staff member. |
| Unified Employer Portal | [Public employer portal entry](https://unifiedportal-emp.epfindia.gov.in/epfo/) | Public entry page and employer/UAN service references | Portal remains the external system of record for employer procedures | Review was limited to the public read-only entry page. No login, credential, upload, form submission, provider/API call or transaction was attempted. The ERP must not store credentials, OTPs, sessions, or automate the portal. |
| EPFO member-profile simplification | [PIB release, 19 January 2025](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2094229) | Aadhaar-validated UAN member self-service and older-UAN employer certification exceptions | Correction paths vary by UAN/Aadhaar state and date | This differs from older generic FAQ wording. Use a professional or current EPFO instructions for a real case. |
| EPFO Joint Declaration simplification circular | [Official EPFO circular, 16 January 2025](https://pmvbry-cdn.epfindia.gov.in/wp-content/uploads/2025/09/SimplificationOfJointDeclarationProcess_WSUCircular-10.pdf) | Joint Declaration/member-profile correction workflow | A real correction may follow a member, employer or EPFO review path | Do not hard-code the procedure; confirm the current case-specific path before advising or recording an outcome. |
| EPFO Aadhaar seeding/correction circular | [Official EPFO circular, 13 August 2025](https://pmvbry-cdn.epfindia.gov.in/wp-content/uploads/2025/09/100.pdf) | Member Portal/employer/office handling for Aadhaar linkage differences | External profile discrepancy needs a neutral pending/review state | Never store Aadhaar or automate the external correction. Current professional confirmation remains required. |
| EPFO 2025 process reforms | [PIB Year End Review 2025](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2209767&reg=3&lang=1) | UMANG face-authentication UAN activation; August 2025 Aadhaar seeding/correction; revised ECR | Current procedures continue to change and may involve member, employer, or EPFO office routes | ERP status fields must not claim that an external correction was accepted. |
| Code on Social Security, 2020 | [India Code text](https://www.indiacode.nic.in/bitstream/123456789/16823/1/aA2020-36.pdf) | Chapter III and section 164 | Current code framework; repeal and savings for existing schemes/actions | Section 164 transition must be rechecked before every implementation phase and after the one-year savings period. |
| Code commencement notification S.O. 5319(E) | [Official Gazette notification](https://labour.gov.in/sites/default/files/e-_noti-ss_0.pdf) | Commencement from 21 November 2025, with subsequent completion/corrigendum | The legal framework changed after the older EPF Act-only model | Qualified labour-law review must confirm all provisions and later notifications relevant to the school. |
| Social Security (Central) Rules, 2026, G.S.R. 344(E) | [Official Gazette, 8 May 2026](https://www.labour.gov.in/static/uploads/2026/05/49aa9b62c2125499c37399b90e969d67.pdf) | Final Central Rules and supersession list | Current central procedural rules exist during this planning review | The rules do not justify an ERP coverage/eligibility conclusion. Check state/establishment facts and current EPFO directions professionally. |
| Labour Codes official hub and FAQs | [Ministry of Labour and Employment](https://www.labour.gov.in/offerings/schemes-and-services/details/labour-codes-gzNzQzMtQWa) | Current codes, rules, notifications and 2025/2026 FAQs | Official source for transition updates | Must be refreshed immediately before 22B, 22C and 22D release decisions. |
| Digital Personal Data Protection Act, 2023 | [India Code](https://www.indiacode.nic.in/handle/123456789/22037) | Sections 8 and 12, subject to commencement | Security, correction, erasure and retention-by-purpose concepts | Core processing duties are on a phased commencement timeline; counsel must confirm what is operative at implementation time and any employment-law basis. |
| DPDP commencement and Rules, 2025 | [Enforcement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf), [MeitY Rules page](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa) | Gazette dates: immediate, one-year and eighteen-month groups | Privacy controls should be designed now even while statutory commencement is phased | A qualified privacy lawyer must confirm notice, lawful basis, rights, retention, processors and incident duties as of go-live. |

### Transition conclusion

The EPF Act and schemes cannot be treated as a static pre-2025 legal package. The Code on Social Security commenced during November/December 2025; section 164 contains repeal/savings provisions; final Social Security (Central) Rules arrived in May 2026; and official EPFO pages still publish the EPF Scheme and EPS text. Prompt 22B may store neutral, human-reviewed status facts only. Prompt 22C and Prompt 22D require a fresh dated professional review before implementation.

### Contribution, eligibility and wage-ceiling non-decision

The currently published EPF/EPS scheme text includes wage-ceiling and 10%/12% contribution provisions, while the Code-era wage definition and later notifications also matter. Prompt 22A does not select a rate, ceiling, eligibility rule or contribution action because none is necessary to the proposed status/reminder workflow. A CA/EPFO consultant must refresh and apply the current provisions to actual establishment and Staff facts; the ERP must not calculate or infer them.

## Age-58 boundary

Age 58 is relevant to EPS superannuation-pension administration. It is not, by itself, an ERP instruction to end employment. These are independent questions:

1. whether employment continues under the Staff member's contract and applicable employment rules;
2. whether a retirement age or employment-end action exists outside the ERP;
3. whether the member satisfies current EPS pension conditions;
4. whether a claim, deferment, contribution, correction, or portal action is appropriate; and
5. who is professionally authorised to advise or act.

Every age-58 reminder must display exactly:

> Review EPFO/EPS records and obtain professional guidance.

An age-58 reminder is a human review task only. It creates no EPFO claim, submits no claim, does not prove pension eligibility and cannot authorise an employment, contribution or pension action.

The UI, exports, tests, events and operator guide must reject or omit instructions equivalent to:

- “Retire this employee”
- “Terminate employment”
- “Pension is guaranteed”
- “Stop EPS contribution automatically”

No reminder may change Staff status, attendance, salary, payroll, date of exit, contribution status, pension status, or employment data.

## Recommended Prompt 22C reminder windows

Implement all six windows as review milestones rather than escalating employment actions:

| Window | Purpose | Default behavior |
| --- | --- | --- |
| 365 days | Annual planning and document-quality check | Create one restricted review item; no external message |
| 180 days | Confirm owner, DOB status, external-record discrepancy and guidance need | Re-surface unresolved item |
| 90 days | Confirm professional review/evidence reference where needed | Director-only due card |
| 30 days | Final administrative readiness check | No contribution, pension, or employment action |
| Date reached | Record that the review date was reached | Show required wording and require acknowledgement |
| Overdue review | Keep an unresolved governance task visible | Never auto-resolve or change employment |

Use one logical reminder per Staff/verified-DOB/version, not six independent duplicates. Acknowledgement must not mean legal completion. Snooze requires a bounded future date and reason; recommended maximum is 30 days and it must not suppress the overdue state indefinitely. Resolution requires a controlled reason plus an append-only event.

## Prompt 22B data-minimisation decision

`REQUIRED` means required for the applicable workflow state, not that legacy Staff rows must contain invented values. Nullable/unknown states are mandatory where the fact is not known.

| Proposed field | Classification | Decision |
| --- | --- | --- |
| `dateOfBirth` | REQUIRED | Nullable calendar date. Required before a verified age-58 calculation; never fabricate an unknown date. |
| `dobSource` | REQUIRED | Required when DOB is present. Controlled source category only; do not store ID/document number or image. |
| `dobVerificationStatus` | REQUIRED | `UNKNOWN`, `UNVERIFIED`, `VERIFIED`, `CONFLICT`, `CORRECTION_PENDING`, `PROFESSIONAL_REVIEW_REQUIRED`. |
| `dobVerifiedAt` | REQUIRED | Required only when status is `VERIFIED`; otherwise null. |
| `dobVerifiedByUserId` | REQUIRED | Required only when verified; actor must have `VERIFY_STAFF_DOB`. |
| `dobCorrectionStatus` | REQUIRED | Default `NONE`; controlled request/review/outcome state. |
| `dobCorrectionReason` | OPTIONAL | Required for submitted/rejected/corrected outcomes; bounded factual text with no Aadhaar, PAN, UAN, password or medical detail. |
| `employmentStartDate` | OMIT | Do not duplicate current `dateOfJoining`; reuse it with documented semantics. |
| `employmentEndDate` | DEFER_TO_LATER_PHASE | Current model has `status` but no end date. Adding employment lifecycle semantics is outside minimal 22B. |
| Staff `status` | REQUIRED | Reuse existing `ACTIVE`/`INACTIVE`/`LEFT`; never auto-change from DOB/reminder data. |
| `epfoCoverageStatus` | REQUIRED | Neutral controlled status: `NOT_REVIEWED`, `REPORTED_COVERED`, `REPORTED_NOT_COVERED`, `DISPUTED`, `PROFESSIONAL_REVIEW_REQUIRED`. It is not a legal determination. |
| `epfoReviewStatus` | REQUIRED | `NOT_STARTED`, `IN_REVIEW`, `REVIEWED`, `DISCREPANCY`, `GUIDANCE_REQUIRED`. |
| `epfJoiningDate` | OPTIONAL | Calendar date only when verified against an approved source; no automatic comparison conclusion. |
| `epsMembershipStatus` | OPTIONAL | Neutral state: `UNKNOWN`, `REPORTED_MEMBER`, `REPORTED_NOT_MEMBER`, `DISPUTED`, `GUIDANCE_REQUIRED`; never auto-derived. |
| `uanAvailable` boolean | OMIT | A boolean loses `UNKNOWN` and `NOT_CONFIRMED`. Replace with `uanAvailabilityStatus`. |
| `uanAvailabilityStatus` | REQUIRED | `UNKNOWN`, `AVAILABLE`, `NOT_AVAILABLE`, `NOT_CONFIRMED`, `DISPUTED`. |
| `uanLast4` | OPTIONAL | Exactly four digits, shown only to restricted roles, used only as a human disambiguation aid. |
| Full UAN | OMIT | No approved operational necessity, encryption design, restricted export design or retention schedule. Portal remains the source of truth. |
| `eNominationStatus` | OPTIONAL | Status only; no nominee identity, relationship, allocation or document. |
| `kycProfileStatus` | OPTIONAL | Status only; no Aadhaar, PAN, bank number, authentication data or document image. |
| `lastComplianceReviewedAt` | REQUIRED | Required when a review is marked reviewed; use an India-local date/time display. |
| `nextComplianceReviewAt` | OPTIONAL | Human-set review date; it must not be generated from an unverified legal rule. |
| `complianceNotesSafe` | OPTIONAL | Bounded safe notes. Reject identifiers, credentials, OTPs, portal sessions, document images and pension/salary promises. |
| Source/evidence reference | OPTIONAL | Opaque internal reference or approved physical-register reference only; no public URL, absolute path, document number or image. |
| Append-only DOB/compliance event | REQUIRED | Actor, action, timestamp, reason category, safe metadata and record version; no delete/update endpoint. |

### Full-UAN decision

Full UAN storage is **OMITTED** from Prompt 22B. Status plus optional last four digits is sufficient for the first implementation. Reconsidering full UAN requires a documented necessity assessment, field-level encryption/key-custody design, restricted recovery and rotation, masked UI, explicit backup/restore behavior, export prohibition, incident plan, retention period, professional approval and dedicated tests. EPFO passwords, OTPs, Aadhaar authentication data and portal sessions are always prohibited.

Recommended `dobSource` values are `STAFF_DECLARATION`, `EMPLOYMENT_RECORD_REVIEWED`, `EPFO_PROFILE_REVIEWED`, `GOVERNMENT_ID_SIGHTED`, `OTHER_APPROVED_SOURCE`, and `SOURCE_CONFLICT`. “Sighted” records the approved category and review event only; it does not authorise storing a number or copy.

## DOB data-quality and calculation contract

- Accept an exact `YYYY-MM-DD` calendar date or explicit unknown; do not use partial/fake dates.
- Preserve unknown, unverified, conflicting and correction-pending as distinct states.
- Reject a future DOB.
- Treat an implausible age as a human-review warning, not an automatic accusation or arbitrary correction.
- Preserve 29 February exactly.
- Use one central India-calendar utility. Convert input to a date key, perform year/month/day arithmetic, and do not derive the birthday through browser/server timezone conversion.
- The 58th-birthday function must be pure, deterministic and unit-tested around UTC/IST midnight, year boundaries and daylight-saving assumptions in non-India environments.
- For a 29 February DOB in a non-leap 58th year, the anniversary rule is `PROFESSIONAL_POLICY_REQUIRED`. Prompt 22B can store and verify the exact DOB, but Prompt 22C must not silently choose 28 February or 1 March. Leadership must record the professionally reviewed rule and tests before reminders go live.
- A verified DOB correction creates a new version and append-only event, invalidates/recalculates future reminder dates, marks existing open reminders `RECALCULATION_REQUIRED`, and never erases the prior restricted history.
- A source-document reference records only approved source type, review date and safe internal reference. Do not retain an unnecessary scan/photo.
- Notify the Staff member of the correction outcome only through a separately approved private self-service or communication phase; Prompt 22B does not send messages.

## Failure and exception handling

| Case | Safe state and action |
| --- | --- |
| Missing DOB | `UNKNOWN`; exclude from age calculation; show restricted missing-data queue. |
| Conflicting DOB | `CONFLICT`; preserve source assertions in restricted history; no reminder date until resolved. |
| Staff declines optional information | Record `DECLINED_OPTIONAL` only for optional statuses; do not coerce or infer. |
| Source document inaccessible | `UNVERIFIED` / `SOURCE_UNAVAILABLE`; do not copy from memory. |
| UAN unavailable | `NOT_AVAILABLE` or `NOT_CONFIRMED`; no placeholder digits. |
| Duplicate UAN suspicion | `DISPUTED`; store no second full identifier; refer to current EPFO process/professional. |
| Portal data differs | `DISCREPANCY`; ERP does not overwrite portal/member data or claim correction. |
| Previous employment | Flag `GUIDANCE_REQUIRED`; do not merge accounts or infer service. |
| EPS status uncertain | `GUIDANCE_REQUIRED`; no eligibility calculation. |
| Staff reaches 58 and continues employment | Keep Staff status unchanged; display required review wording. |
| Correction pending | Suspend/recalculate date-based reminders; preserve restricted event trail. |
| Professional guidance pending | Keep review open with owner and next review date; acknowledgement is not resolution. |
| Reminder overdue | Director-only overdue state; no employment/contribution action. |
| Wrong role | Server-side 403/neutral redirect, access-denied audit, no sensitive response body. |
| Staff leaves before reminder | Resolve only with `STAFF_LEFT_REVIEW_REQUIRED`; do not erase data or assume no EPFO exit duty. |

## Prompt 22C reminder design

- Director-only dashboard and record routes by default; Super Admin only for governance/exceptional administration.
- Cards: missing/uncertain DOB, 365, 180, 90, 30, date reached, overdue, guidance pending and correction pending.
- No Teacher, Parent, Public or ordinary Viewer access. A separately approved aggregate permission may expose suppressed counts only.
- No full UAN, exact DOB in aggregate cards, employee ranking, salary, pension estimate or retirement recommendation.
- Detail links open a restricted Staff compliance record and re-authorize object access server-side.
- Acknowledgement stores actor/time/version and means “seen/review started,” not compliance or eligibility.
- Controlled resolution reasons: `REVIEW_COMPLETED`, `GUIDANCE_PENDING`, `CORRECTION_PENDING`, `NOT_APPLICABLE_AFTER_REVIEW`, `STAFF_LEFT_REVIEWED`, `DUPLICATE_REMINDER`.
- Append-only reminder events cover creation, window transition, acknowledgement, snooze, resolution, reopen and DOB recalculation.
- No email, WhatsApp, SMS, push, public notice, Teacher message or automatic template.
- Reports are aggregate and formula-safe. No broad Staff DOB/UAN CSV.
- Any confirmation or destructive workflow in later phases must use an accessible in-app dialog. Native `alert`, `confirm` and `prompt` are prohibited.

## Prompt 22D checklist boundary

Prompt 22D may add a human checklist, safe evidence references, aggregate reporting and append-only audit. A checked item means only that an authorised person recorded a review step. It does not certify statutory compliance, EPFO acceptance, coverage, eligibility, contribution correctness, claim success or pension entitlement.

## Exact phase boundaries

### Prompt 22B

May implement only the approved minimal DOB/status fields, controlled correction and verification, dedicated permissions, append-only events, safe projections, tests and backup/restore. It must not add the age-58 dashboard, reminders, full UAN, portal automation, external messages, pension calculations, automatic EPS/coverage decisions, employment actions or 22C/22D features.

### Prompt 22C

May implement the Director-only age-58 review dashboard, milestone reminders, acknowledgement, bounded snooze, resolution and recalculation. It requires a fresh official/professional review, an approved leap-day policy and approved permissions. It must not automate employment, pension, contribution, claim, portal or external-message actions.

### Prompt 22D

May implement the compliance checklist, safe evidence references, reports and audit only after a qualified professional approves the current checklist wording and ownership. It must not claim statutory certification or automate EPFO.

Prompt 21B, Prompt 21C and Prompt 21D remain blocked and untouched.

## Implementation readiness gates

Prompt 22B is implementation-ready only within the conditional decision record. Before coding:

1. leadership approves the purpose notice, mandatory/optional classifications and proposed role defaults;
2. a qualified EPFO consultant/CA/labour-law professional or lawyer confirms the current transition and neutral field vocabulary;
3. privacy counsel confirms the interim retention/correction/security approach and phased DPDP implications;
4. full UAN remains omitted;
5. leap-day reminder policy remains outside 22B and is resolved before 22C;
6. QA uses synthetic `QA22B` values only and never real DOB/Aadhaar/PAN/UAN data; and
7. the implementation preserves the no-employment-action boundary.
