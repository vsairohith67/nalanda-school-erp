# Real-User Activation Wave Plan

Status: planning only. No wave is authorised or automatic.

## Preconditions for every wave

The repository must be independently verified private; an accepted private HTTPS staging environment and approved provider/region must exist; the exact roster must arrive through an approved secure channel; named requester/reviewer/approvers, role matrix, training versions, policy text and MFA rules must be signed off; a private delivery provider must be configured; a synthetic invitation rehearsal, backup and rollback must pass; and the owner must give explicit approval for that wave.

Completion of one wave does not start the next. Each wave has its own go/no-go record, cohort list, invitation window, support/recovery staffing, rollback point, security monitoring and post-activation review.

| Wave | Cohort | Required focus |
| --- | --- | --- |
| 0 | Super Admin recovery and governance accounts | two-person continuity, recovery rehearsal, last-admin safety, step-up |
| 1 | Principal, Director and limited office security administrators | leadership approval, MFA, smallest viable administrative scope |
| 2 | Accountant and designated Computer/Attendance operators | finance/operations separation, exact scope and expiry |
| 3 | Teachers and Staff | active Staff/assignment links, training, Teacher marks denials |
| 4 | small Parent pilot | current Guardian-child links, privacy/support review, explicit owner approval |
| 5 | remaining Parents | only after Wave 4 acceptance and remediation |
| 6 | Students, only if School policy requires accounts | approved age/account policy, Student safety and own-record scope |

Parents and Students cannot be activated until the Staff cohort is accepted. Real invitations are never sent from public/local test infrastructure. A cohort is paused on identity ambiguity, unexplained permission expansion, delivery leakage, MFA/recovery failure, linked-child isolation failure, unresolved high-severity security issue or inability to restore/rollback.

The executable future contract is `docs/prompts/REAL_USER_ACCESS_ACTIVATION_1B.md`. Generating it does not approve it.

