# Nalanda ERP v1.1 — Academic Integrity Release

Status: `ACADEMIC-INTEGRITY-1A — CLEARED` by independent `ACADEMIC-INTEGRITY-1A-QA` on 2026-08-21.

Policy marker: `SUPERSEDED_BY_ACADEMIC_INTEGRITY_V1_1`

The V1 policy that permitted an ordinary Teacher to enter or submit marks is retained only as historical evidence. From v1.1 onward, a timetable, class, subject, class-teacher or examination assignment never grants marks-write authority.

## Authoritative authority model

| Actor context | Default marks write | Conditions |
| --- | --- | --- |
| `SUPER_ADMIN` | Allow | Direct governed leadership authority. |
| `PRINCIPAL` | Allow | Direct governed leadership authority. |
| `TEACHER` | Deny permanently | Denied through role defaults, immutable IAM denial, service scope and every mutation route. A profile, override, timetable or multi-role context cannot restore it. |
| `ADMIN`, `ACCOUNTANT`, `COMPUTER_OPERATOR`, `VIEWER` | Deny | May act only through the reserved `MARKS_ENTRY_OPERATOR` profile and an exact active scope. The base role remains unchanged. |
| Every other current or future role | Deny | No implicit or assignment-derived authority. |

Teacher read-only academic reports and existing examination information remain available only where the established read policy already permits them. `/teacher/marks` is no longer a marks-entry route.

## Scoped delegation

Principal and Super Admin can grant, inspect and revoke the reserved `MARKS_ENTRY_OPERATOR` profile. The implementation reuses the existing permission-profile, profile-entry, profile-version and user-profile-assignment models; it does not add an IAM framework or database migration.

Each grant records a server-resolved scope inside the governed profile assignment. The client submits only a target handle; the server reloads the authoritative records. Supported scopes are:

- legacy assessment: academic year, exam, assessment, class, section, subject and component;
- governed component: academic year, examination, class scope, subject paper and component.

The profile contains only the permissions needed to open the scoped entry workspaces, save, submit and request correction. It does not grant general exam administration, moderation, publication, report-card editing or unrestricted exam-report access. A delegated user cannot browse or mutate a different scope by changing a URL, query string or request body.

Eligible users must hold an active non-teaching `ADMIN`, `ACCOUNTANT`, `COMPUTER_OPERATOR` or `VIEWER` context. Any active Teacher role on the named account makes the grant or later use fail closed. Delegation may carry an expiry using existing IAM validity fields. Adding a scope cannot extend the expiry of existing scopes. A larger temporal-IAM subsystem is deliberately out of scope; per-scope independent expiry remains a future enhancement.

Grant and revocation replace the active assignment, increment the user's authorisation version and revoke sessions. This makes revocation and expiry effective through existing fresh-authorisation/session rules and prevents a stale session from retaining the profile.

## Server enforcement

Every marks mutation is protected independently. This includes legacy draft entry, batch entry, import, submission, approval, locking, correction and exam workflow, plus governed component save, final submission, correction request, moderation, reopen, calculation and calculation lock. Report-card entry and submission are leadership-only under the same prospective policy.

Mutation services resolve one of two effective authorities:

- `LEADERSHIP`: active Principal or Super Admin context;
- `DELEGATED`: the reserved active profile, the required permission and an exact matching scope.

Teacher and ineligible-role denials occur again inside the service layer after ordinary permission middleware. Consequently, a direct API request, crafted parameter, separate route, ordinary IAM override or reusable non-reserved profile cannot bypass the policy.

## Conflict-of-interest control

The primary control is permanent Teacher marks-write denial. Existing approved linkage is also used when available: if a delegated operator's user record has a Guardian link and the requested mark sheet contains that Guardian's linked Student, the mutation is denied and a privacy-bounded security event is written. No name, phone, address or other heuristic is used when an approved linkage is absent.

Principal and Super Admin remain governed leadership authorities.

## Audit and history

Delegation grants and revocations are recorded in the existing user audit ledger with actor, profile, bounded scope metadata, reason, expiry and result. Governed mark-sheet audit snapshots include effective authority and assignment evidence. Existing mark/version/event history continues to record the actor and before/after workflow evidence. Family-conflict denial uses the security-event ledger with a bounded Student identifier and no general audit disclosure of Student details.

Published report versions, locked calculation snapshots, earlier publications, historical audit rows and V1 RC1 tags remain immutable. A historic record showing Teacher entry before v1.1 remains true historical evidence and must not be rewritten.

## Operational boundaries

- No examination formula, rounding policy, report template or publication snapshot changed.
- No schema migration is introduced by `ACADEMIC-INTEGRITY-1A`.
- Production/operational data is not mutated by implementation tests.
- The feature branch must not be merged, tagged or deployed during implementation.
- Independent QA must test direct and delegated authority, exact-scope tampering, revocation, stale sessions, multi-role Teacher denial, import and family-link denial on a copied or synthetic database.

## Implementation surfaces

- `lib/academic-integrity.ts` — reserved profile, exact scope, grants/revocation, leadership/delegated resolution, family conflict and audit.
- `lib/iam/permission-governance.ts` and `lib/permissions.ts` — permanent Teacher denial and safe defaults.
- `lib/marks-scope.ts`, `lib/exam-marks-scope.ts`, `lib/marks-import.ts` and `lib/exam-marks.ts` — exact legacy/governed service enforcement.
- `/marks`, `/marks/governed` and `/marks/delegation` — leadership and delegated workspaces.
- `/api/marks/**`, `/api/exam-marks/**`, `/api/exam-moderation/**`, relevant `/api/exams/**` workflow routes and report-card mutation routes — independent server enforcement.

## Release clearance

Independent QA proved the permanent role matrix, exact-scope delegation,
multi-role Teacher denial, generic-IAM bypass prevention, linked-child denial,
revocation/session invalidation, copied-database concurrency, audit coverage and
historical immutability. The final route, lifecycle, typecheck, complete test,
production build, backup and Git-safety gates passed. See the
[QA clearance](evidence/ACADEMIC_INTEGRITY_1A_QA_CLEARANCE.md).

This code clearance does not authorise deployment, provider activation,
real-user activation or real-data onboarding.
