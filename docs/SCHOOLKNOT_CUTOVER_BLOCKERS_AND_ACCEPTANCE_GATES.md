# Schoolknot Cutover Blockers and Acceptance Gates

Status: `NO_WHOLE_SCHOOL_GO`

## Blocker classes

| Class | Current blockers | Acceptance evidence |
|---|---|---|
| Role | Teacher attendance critical blocker is cleared, but remaining Teacher workflows/role QA, broad current Principal defaults, Accountant source identity ambiguity and Parent feature gaps remain | Role/default matrix, object-scope tests, blocked-role/API tests and named role owners |
| Migration | 109 evidence items include vendor/sample dependencies; no Schoolknot data exported | Vendor dictionaries, stable IDs, counts, checksums, mapping, copied-DB rehearsal, reconciliation and rollback |
| Vendor | Role/branch matrix, exports, files, audit, integrations, backup/restore, payroll, transport/GPS and gateway details missing | Redacted/synthetic documents and samples; no credentials |
| Write workflow | Attendance, marks/report-card, files, communication, finance, admissions, password/session and bulk controls unproven | Authorised non-production synthetic tests with audits and cleanup |
| Deployment/provider | `DEVOPS-1D PAYMENT_GATED_DEFERRED`; no VPS/DNS/provider/external backup/monitoring | Restricted HTTPS staging, synthetic DB, backup/monitoring, rollback and provider approvals |
| Privacy/legal | Child attachments/location/transport, payroll, bulk export, communications and migration retention not approved | Named owner, purpose, minimisation, access, retention/deletion, incident and professional review where required |
| Training/operations | Role SOPs, correction/reversal procedures, support and rollback drills not completed | Signed role-specific training, supervised pilot, acceptance checklist and support ownership |

## Role decisions

| Role | Decision | Scope that may proceed | Blocking conditions |
|---|---|---|---|
| Management | `CONDITIONAL_GO` | Existing Nalanda core management modules in a controlled synthetic/pilot environment | Migration, deployment, vendor and training gates; no full Schoolknot parity claim |
| Parent | `CONDITIONAL_GO` | Existing linked-child read-only fees/receipts/results/Homework/Library/documents/notifications | 23D attendance/exam timetable and 23E/23F gaps before broad Parent replacement; file/object tests |
| Principal | `CONDITIONAL_GO` | Academic pilot after a reduced academic-first permission bundle is configured and tested | No implicit finance/password/role/fee/settings authority; masked views and export rules |
| Accountant | `CONDITIONAL_GO` | Implemented finance, expenses, budget, Cash Book, misc income, books, allowed charge collection, and exact-permission FIN-2B final-receipt cancellation/correction | FIN-2A and FIN-2B are resolved; every successful Accountant final-receipt action is audited and leadership-notified, while non-mutable days block ordinary action. Refunds/gateway/Day Closer/payroll/employee self-service remain outside this go; no FIN-2C is authorised |
| Teacher | `CONDITIONAL_GO` | Exact timetable/dated-substitute Student attendance scope after Prompt 23C-QA release | Critical attendance blocker is cleared; own timetable, Classwork and remaining Teacher workflow/role QA are still required before whole-role replacement |

## Acceptance levels

- `GO`: all role, object-scope, migration, deployment, privacy, training and rollback evidence for the declared scope is complete.
- `CONDITIONAL_GO`: a named, narrow pilot scope may run with explicit exclusions and rollback; it is not whole-role or whole-school parity.
- `NO_GO`: a critical authorization/integrity blocker exists or required source/migration evidence is absent.

No role currently has an unconditional `GO`. There is no whole-school cutover authorization.

## Prompt 23C gate update

The implementation branch now resolves every Teacher attendance surface from
an active linked Staff/timetable Teacher plus an exact current-year
class/section assignment, or a confirmed substitute on the exact date. It
fails closed for missing/inactive links and uses server-side target checks,
bounded bodies, same-origin protection, compare-and-set writes, reasoned
corrections and append-only audit evidence.

Prompt 23C-QA independently passed the fresh copied-database authorization,
negative-security, privacy, concurrency, production HTTP and desktop/mobile
Browser matrix. Cleanup was inspected twice and the operational zero-data
baseline, account states, migration state and backup version 37 stayed exact.
The previous Teacher attendance object-scope defect and critical attendance
blocker are therefore resolved.

Overall Teacher replacement remains `CONDITIONAL`: this clearance does not
claim own-timetable, Classwork, marks, communications or complete Teacher
parity. Prompt 23C does not change any Parent, Principal, deployment,
migration, privacy, vendor or training blocker.
