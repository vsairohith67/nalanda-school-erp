# Schoolknot Management Export and Migration Requirements

Status: requirements only; **no export was requested or downloaded**  
Date: 22 July 2026  
Source: authenticated Management audit plus current Nalanda models/import boundaries

## Authorisation boundary

An authorised future migration must use vendor-supported documented exports, not scraping. Each export needs a named School owner, date-bounded written authorisation, field dictionary, row count, stable source identifier, checksum, untouched encrypted archive, working copy, reconciliation result, retention decision and exception sign-off. Credentials, direct database access, bulk downloads and personal values are outside Prompt 23B-M.

Preferred tabular format is UTF-8 CSV; XLSX is acceptable only when the vendor cannot supply CSV and must be normalised without formulas/macros. Attachments use an encrypted manifest plus original files. PDF is evidence/archive, not a structured import format. JSON is appropriate for nested audit/event histories only when documented.

## Common evidence required for every export

| Requirement | Required record |
|---|---|
| Format | File type, encoding, delimiter, date/time/time-zone and decimal rules |
| Field dictionary | Field name, label, type, allowed values, null meaning, sensitivity, source/derived flag |
| Scope | Source module, school/branch, academic year/date range, filters and export timestamp |
| Counts | Source screen count, exported row count, distinct stable IDs, duplicates, missing required values |
| Identity | Stable unique identifier and every foreign-key/relationship identifier; names/phones are never primary merge keys |
| Ownership | Named School data owner, export operator, approver and migration reviewer |
| Integrity | SHA-256 of each original file and attachment; manifest hash; read-only untouched encrypted archive |
| Reconciliation | Control totals, relationship/orphan checks, sampled source comparison, import preview counts and signed exceptions |
| Privacy | Classification, minimum-field decision, access group, retention/deletion, breach handling and whether import is justified |
| Import decision | `IMPORT`, `ARCHIVE_ONLY`, `AGGREGATE_ONLY`, `DO_NOT_IMPORT`, or `PENDING_APPROVAL` |

## Export register

| Source export | Expected format / key field dictionary | Count, range, owner and reconciliation | Sensitivity | Import decision |
|---|---|---|---|---|
| Students | CSV; source Student ID, admission number, lifecycle status, academic year, class/section, roll/admission dates, only approved identity/custom fields | All required years; Management owner; unique ID/admission checks, active totals, enrollment joins | High child data | IMPORT approved minimum only |
| Guardians/Parents | CSV; source Guardian ID, Student link ID, relationship, account status; contact fields only if authorised | All active/historical links; Management owner; sibling/link/orphan reconciliation | High child/family/contact | IMPORT separate Guardian/link records; never flatten by name |
| Admissions/enquiries | CSV plus documented stage codes; enquiry ID, source, stage/probability, follow-up, class sought, vacancy, conversion/loss | Agreed admission cycles; Admissions owner; funnel totals, duplicate contacts, conversion mapping | High prospective-child/family | PENDING_APPROVAL until M3 |
| Classes/sections | CSV; stable class/section/master-class IDs, labels, status, academic year | All referenced years; Academic owner; every enrollment/timetable/exam reference resolves | Operational | IMPORT/MAP |
| Academic years | CSV; source year ID, label, start/end, active/closed status | Full referenced range; Academic owner; one current year and no overlap | Operational | IMPORT/MAP |
| Fees | CSV; fee-assignment ID, Student/enrollment ID, fee-head ID, period, amount, effective dates/status | Full required financial retention range; Finance owner; Student totals and opening balances | High financial | PENDING_APPROVAL; preview only |
| Fee heads | CSV; source head ID, name/code, frequency/level, class/year assignment, status | Every fee referenced; Finance owner; unique code and assignment counts | Financial configuration | IMPORT/MAP after approval |
| Concessions | CSV; concession ID, Student/fee link, type/amount/percent, effective period, reason/status/approver | Required financial years; Finance owner; totals against fee summary | High financial/sensitive reason | PENDING_APPROVAL; minimise reasons |
| Receipts/payments | CSV; immutable receipt/payment/allocation IDs, dates, Student, fee head/period, mode, amount, reference, status/reversal links | Full retention range; Finance owner; receipt count, amount by mode/day/year, allocation totals, cancellations | Critical financial | IMPORT only through dedicated reconciliation |
| Refunds | CSV/JSON events; refund ID, original payment/allocation, amount/date/mode/status/reason/approval/settlement | All retained refunds; Finance owner; original-to-refund and settlement totals | Critical financial | PENDING_APPROVAL; Nalanda refund workflow missing |
| Dues/opening balances | CSV snapshot plus as-of timestamp; Student, fee head/period, assessed, paid, waived, due | Cutover date and historical controls; Finance owner; formula tie-out to fees/receipts/concessions/refunds | Critical financial | IMPORT only as reconciled opening state |
| Staff/Teachers/Employees | CSV; source Staff ID, code, type, designation, department, status, join/exit, subject links; no excessive fields by default | Active plus approved history; HR owner; unique codes, user/timetable links | High employment | IMPORT operational minimum only |
| Student attendance | CSV/JSON events; session/record IDs, date, class/section, status, source, correction/lock history | Agreed academic years; Academic owner; session/roster/status totals | High child record | PENDING_APPROVAL; preserve source/corrections |
| Staff attendance | CSV/JSON events; Staff ID, date, in/out/status/source/correction | Agreed HR retention; HR owner; day/Staff totals and exception rules | High employment | PENDING_APPROVAL |
| Leave | CSV/JSON events; request ID, person ID, type, dates, status, approvers, balances/rules separately | Agreed years; HR owner; request/status/day totals and overlap checks | High employment/child if Student | Staff partial import; Student leave pending role audits |
| Payroll/payslips | CSV for structures/runs; PDF only as archive; Staff ID, effective salary components, deductions/contributions, run/payslip/version/status | Statutory retention range; payroll owner; gross/net/component/control-account totals | Critical salary/statutory | PENDING_APPROVAL under M2; PDFs likely ARCHIVE_ONLY |
| Timetable | CSV; class/section/subject/Teacher/period/room/effective dates/status/draft | Current and required history; Academic owner; conflict and assignment reconciliation | Operational/Staff | IMPORT/MAP only if needed; Nalanda builder already exists |
| Exams | CSV; exam/type/source ID, class, dates, status, visibility, grading link | Required academic years; Examination owner; exam/assessment counts | High academic | PENDING_APPROVAL |
| Marks | CSV; immutable mark/event ID, Student, assessment, max/pass, value/state, status/correction | Required retention; Examination owner; sheet counts, totals, absent/exempt states, lock history | Critical child academic | IMPORT only through preview-confirm and role approval |
| Report cards | CSV/JSON plus PDFs as archive; card/version IDs, sources, grades/comments/status/issue/correction | Required years; Examination owner; issued/version counts and mark-source reconciliation | Critical child academic | Structured import PENDING; PDFs ARCHIVE_ONLY unless needed |
| Notices | CSV/JSON; notice/campaign ID, audience definition, title/body, status, publication/correction history | Required years; Communications owner; counts by status/audience | Medium/high depending content | IMPORT approved plain-text/publication history only |
| Homework | CSV; assignment ID, class/subject, title/description, dates/status/author | Required years; Academic owner; assignment count/status links | Child academic | PENDING role audits; likely recent active only |
| Assignments/submissions | CSV metadata plus encrypted attachment manifest; assignment/submission/version/Student IDs, timestamps/status | Required active/recent range; Academic owner; attachment counts/hashes and ownership | Critical child-created content | PENDING M5; default historical files ARCHIVE_ONLY |
| Library | CSV sets; title/copy/accession/member/loan/reservation/incident/charge/event IDs and statuses | Full active plus approved history; Library owner; accession uniqueness, open loans/charges and event links | High member/history | PENDING source evidence; Nalanda model is ready |
| Transport | CSV sets; route/point/vehicle/assignment/pass/reading/vendor IDs and effective status | Current plus required history; Transport owner; route strength, active assignments, vehicle/pass totals | Critical child safety/location | PENDING M4; no GPS coordinates by default |
| Discipline | CSV/JSON events; incident ID, subject type/ID, category, confidential status/action/appeal; attachments manifest | Policy-defined retention only; safeguarding owner; access and event counts | Critical safeguarding | PENDING M6; may remain ARCHIVE_ONLY |
| Cafeteria | CSV; assignment/attendance/plan IDs, dates/status/amount only if operational | Confirmed usage period; Operations owner; assignment/attendance totals | Child operational/financial | PENDING use decision; exclude medical data |
| Documents/attachments | Encrypted manifest + originals; source object/version ID, file name/type/size/hash, owner, consent, retention | Only approved modules/ranges; module owner; manifest-to-file and object-link checks | Often critical | Default ARCHIVE_ONLY; import case-by-case |
| Roles and permissions | CSV/JSON; role ID/name, permission/module/action, scope, status/effective date | Current plus approved history; Director/Super Admin owner; compare role matrix and least privilege | Security sensitive | MAP manually; do not blindly import entitlements |
| Audit history | JSON/CSV events; event ID, object type/ID, time, actor stable ID/role, action, before/after hash or safe fields, reason | Full available range; Director/data owner; continuity, duplicates, orphan and timestamp checks | Security/high personal | ARCHIVE_ONLY or targeted import after design |
| Branches | CSV; branch ID/code/name/status only if operational | All referenced branches; Director owner; cross-reference admissions/classes/users | Organisational | PENDING multi-branch decision |
| School settings/integrations | JSON/CSV field dictionary; setting key/effective history; provider names without secrets | Current configuration; Director owner; compare allowlist | Security/possibly sensitive | MANUAL_REVIEW; never import credentials/tokens |
| Backup/restore evidence | Vendor documentation, backup/export manifest, retention/recovery terms, test evidence; no opaque database dump by default | Contract period; Director owner; verify custody, recoverability and exit export | Critical system | ARCHIVE evidence; use structured exports for migration |

## Untouched archive and working-copy controls

1. Receive exports only after written authorisation through an approved secure channel.
2. Compute SHA-256 immediately; place originals and manifest in an encrypted read-only archive with named custody.
3. Work only from a separate encrypted copy; never edit the original export.
4. Record tool versions, normalisation steps, row-count deltas and every rejected/changed field.
5. Run preview-only imports against a copied Nalanda database. Preserve source IDs in a migration map, not in public UI.
6. Reconcile counts and financial/academic control totals, sample records with authorised staff, and sign exceptions.
7. Remove temporary extracts and copied databases under the approved retention/cleanup plan; verify zero residue.
8. Take and verify a clean Nalanda backup before and after any future authorised import.

## Do-not-import defaults

- Passwords, password hashes, secret answers, sessions, API keys, webhooks, tokens and provider credentials.
- Full Aadhaar/UAN/bank/medical/biometric/location/family-income data without a separately approved lawful purpose and minimum field decision.
- Recipient-level read/app-login surveillance and Staff usage rankings.
- Arbitrary cached identity lists, deleted drafts without purpose, duplicate attachments, macros/executable files and unsupported formulas.
- GPS/live history, biometric templates or raw device data without separate privacy/legal/vendor approval.

## Completion gate for a future export exercise

Prompt 23B-M supplies the requirements only. An export exercise is not ready until the School names the owner and purpose for each dataset, the vendor supplies a format/field dictionary/sample with no real data, privacy/legal/financial owners approve the requested scope, and a copied-database preview/reconciliation/cleanup plan is signed. No Schoolknot export or credential is stored in this phase.
