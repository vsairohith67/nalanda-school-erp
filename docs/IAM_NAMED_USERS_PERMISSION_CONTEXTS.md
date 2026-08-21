# IAM-1A Named Users, Permission Profiles and Contexts

## Academic Integrity v1.1 reuse

`ACADEMIC-INTEGRITY-1A` reuses the existing reusable profile infrastructure for the reserved `MARKS_ENTRY_OPERATOR` profile. It adds no schema or parallel authorisation framework. Principal or Super Admin grants a named eligible non-teaching user an exact assessment or examination-component scope through a `UserPermissionProfileAssignment`. Grant/revoke replaces the active assignment, increments authorisation state, revokes sessions and preserves audit history. The base Viewer and Computer Operator roles remain unchanged and read-only/denied by default.

Teacher marks-write permissions are immutable denials. A Teacher role, assignment, profile, override or multi-role context cannot acquire marks-write authority. The prior policy is `SUPERSEDED_BY_ACADEMIC_INTEGRITY_V1_1`; read-only academic reporting remains governed separately. See [Academic Integrity v1.1](ACADEMIC_INTEGRITY_V1_1_PRINCIPAL_MARKS_ENTRY.md).

## Scope and status

IAM-1A adds governed named-user administration without creating or activating
real school users. It reuses `User`, the existing role and permission
catalogue, `StaffMember.userId`, `User.guardianId`, `StudentGuardian`, exact
Teacher resolvers, `AuthSession`, `UserAudit`, and credential versions. It does
not change examination formulas, report publication, finance calculation,
Teacher attendance scope, authentication-token security, deployment, or live
delivery providers.

The implementation branch is `iam/named-users-permission-contexts`. One
additive migration, `20260801110000_iam_named_users_permission_contexts`, is
rehearsed only against fresh or copied databases during this phase.

## Additive model

- `UserRoleAssignment` is the durable, validity-bounded source of role
  contexts. Ended or revoked assignments remain as history.
- `User.designation` is a human title. It never grants authority.
- `PermissionProfile`, `PermissionProfileEntry`, and
  `PermissionProfileVersion` provide reusable, versioned allow/deny policy.
- `UserPermissionProfileAssignment` and `UserPermissionOverride` preserve
  assignment and override history. Active uniqueness keys are released on
  end/revocation; rows are never hard-deleted.
- `User.authorizationVersion` and `AuthSession.authorizationVersion` make
  critical access changes invalidate stale sessions.
- `AuthSession.activeRoleAssignmentId`, `activeChildLinkId`, and
  `contextVersion` store server-side context state. Public UI handles are
  keyed HMAC values bound to user, authorization version, context version and
  a private server-side key.
- `IamSafetyLock` serializes last-Super-Admin checks under SQLite's supported
  single-instance write model.

No Staff, Guardian, Student, role, permission, or user concept is duplicated.

## Role catalogue and designations

| Display role | Authority source | Notes |
|---|---|---|
| Super Admin | Base role plus immutable safeguards | Only role that can grant Super Admin or non-delegable invariants |
| Director | Base role plus explicit delegation | Does not receive IAM mutation/delegation by title alone |
| Principal | Base role plus explicit delegation | May govern approved lower-risk users only when granted |
| Administrator | Existing Admin base role | May view named access; mutation requires governed permission |
| Accountant | Finance-oriented base role | Cannot self-grant finance or account-management authority |
| Computer Operator | Small dedicated role | Admissions/operations only; immutable denial blocks unrestricted Admin and finance authority |
| Teacher | Exact object-scoped base role | Staff and timetable/examination ownership remain mandatory |
| Parent | Linked-family base role | Guardian and exact Student link remain mandatory |
| Viewer | Read-only base role | Exports and sensitive record access remain restricted |

Director, Associate Director, Additional Director, Sub Director, and similar
leadership names are designations only. The UI always renders human labels and
never exposes raw role enums.

## Authoritative evaluation order

`lib/iam/effective-access.ts` is the server-side permission authority. It
applies exactly this order:

1. inactive, suspended, or pending account denies;
2. revoked, expired, cross-user, or authorization-stale session denies;
3. inactive, not-yet-valid, expired, or foreign role assignment denies;
4. immutable system restriction denies;
5. an exact object-scope result of false denies;
6. active individual `DENY` denies;
7. active assigned-profile `DENY` denies;
8. active individual `ALLOW` allows;
9. active assigned-profile `ALLOW` allows;
10. active base-role permission allows;
11. unknown or otherwise ungranted permission denies.

Object-scoped permissions remain marked as scope-required even when a grant
source allows them. Existing exact Teacher, Parent, finance,
academic-year/class/section, ownership, and private-object resolvers must still
return true for the requested object. Navigation is presentation only.

## Delegability classification

- `ORDINARY_DELEGABLE`: may be delegated by an actor who has both delegation
  authority and the requested permission.
- `LEADERSHIP_RESTRICTED`: sensitive administration or approval authority;
  assignment remains explicit and actor-bounded.
- `SUPER_ADMIN_ONLY_NON_DELEGABLE`: system recovery, restore, role-matrix,
  cloud-key, first-run, purge, and Super-Admin-grant invariants. Profiles and
  individual overrides reject them.
- `OBJECT_SCOPED`: a grant opens only the feature gate; exact record scope is
  still mandatory on every list, page, API, export, batch, and mutation.

An actor cannot delegate a permission they do not effectively possess.
Non-Super-Admins cannot manage a Super Admin, and target-role boundaries limit
Director, Principal, Administrator, and Computer Operator delegation.

## Named-user lifecycle

The governed flow creates a unique named account with an opaque public handle,
display name, optional designation, one or more role assignments, optional
profiles/overrides, and an existing Staff or Guardian link when required.

When no governed AUTH-2B delivery adapter is active, the safe default is
`PENDING_ACTIVATION`. An authorised administrator may instead enter a temporary
password in a hidden field. It is hashed immediately, expires within seven
days, is never returned, emailed or logged, and requires a password change on
first login. Existing passwords are never retrievable.

Suspension, reactivation, role end, profile assignment/end, and override
change are reasoned, expected-version protected, transactional, audited, and
authorization-version invalidating. Username aliases and Staff/Guardian links
remain unique and cannot be taken over by another account.

## Profile administration and effective preview

Authorised Super Admins can create, clone, version, archive and assign a
profile. Updates require expected version, re-authentication and acknowledgement
when active assignments make the profile shared. The system shows affected
user counts and preserves every prior entry and version snapshot. Duplicate or
conflicting permissions are rejected. Archival invalidates affected sessions
but never deletes history.

Effective-access preview identifies the active role context, permission label,
allow/deny result, source, assigned profile names, delegability class, and
whether exact object scope remains required.

## Multi-role and child context

A single-role user sees no role picker. Multi-role choices are derived only
from active, currently valid assignments. Switching validates the current
session and opaque handle, performs an expected-version update, clears child
state outside Parent context, and writes a privacy-safe audit. An assignment
change increments authorization/context evidence and revokes stale sessions;
an invalid context fails closed.

Child context is separate. It is available only in an active Parent context,
is derived from current `StudentGuardian` links, and uses a user-,
authorization-, and context-version-bound opaque handle. One linked child can
be selected safely without a picker. Multiple linked children show a picker.
Cross-family reuse, raw Student IDs, removed links, and child context in a
Teacher context are denied.

Parent attendance and examination-timetable parity remain Prompt 23D.

## Developer contract

- Use `getCurrentUserEffectivePermissions`, `hasUserPermission`, or
  `evaluateEffectivePermission`; do not authorize from `User.role` or client
  role text.
- Pass the active session and assignment for mutations. Preview is the only
  deliberate target-user evaluation without the target's session.
- Preserve exact domain object-scope resolvers after the feature permission
  gate.
- Keep state changes POST-only, same-origin/CSRF protected, no-store, bounded,
  expected-version protected, and privacy-safe.
- Never hard-delete IAM history. Never log password, hash, token, opaque
  private key, Student identifier, or raw internal ID.
- Add tests for every new permission at page, API, export, batch and exact
  object access.
- Run mutation QA only through `pnpm.cmd qa:iam1a` or another ignored copied
  database. Do not migrate the operational database in the implementation
  thread.

## Verification evidence

The implementation copied-database matrix creates 18 fresh IAM1A users plus
active/inactive Staff and Guardian links, linked/unrelated children, profiles,
conflicting grants/denials, sessions, expired assignments and multi-role
contexts. It proves precedence, delegation, context isolation, concurrency,
forced rollback, and version-37 IAM backup/restore twice. All fixture data and
the copied database are destroyed by the harness; the operational database is
hash-checked before and after.

Independent IAM-1A-QA remains required before merge.
