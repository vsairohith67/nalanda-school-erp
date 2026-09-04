# Account and Person Linking

## Separation invariant

A `StaffMember`, `Guardian` or `Student` is a school-domain person record. A `User` is a login identity. `UserRoleAssignment` and permission-profile assignments are authorisation records. `AuthSession.activeRoleAssignmentId` is the single active role context. None implies or silently creates another.

Preparation may create an inactive candidate account and pending assignments only after explicit operator review. It must not establish credentials, enable login, send an invitation, merge people or activate any assignment. Activation remains a later atomic server decision.

## Exact linking rules

| Candidate | Required evidence | Refused shortcuts |
| --- | --- | --- |
| Staff | one existing active governed `StaffMember`, its unique reviewed identity, and an explicit operator-selected link | name-only, contact-only, fuzzy or ambiguous matches |
| Parent/Guardian | one explicit Guardian plus at least one current active `StudentGuardian` relation and human review | a supplied Student ID, surname, email or mobile match |
| Student | one explicit active Student, approved age/account policy and human review | admission/contact similarity without the governed Student relation |
| Other/view-only | documented purpose, exact scope, expiry when required and explicit approval | conversion from an unrelated domain record |

Each person reference and login alias is unique. Normalisation occurs for comparison, but the system never silently renames a requested username. Duplicate username, duplicate email, existing person link, inactive relationship, malformed contact, ambiguous identity and confusable Unicode are blockers.

## Eligibility revalidation

The workflow rechecks the live link at preparation, approval, invitation acceptance and activation. Removing or deactivating the Staff, Guardian-child or Student relationship after invitation issue prevents activation. Credential-version or approved-role-snapshot changes also invalidate the invitation.

Parent access always requires both an active Parent role context and a server-derived active linked-child context. Student access is own-record only. Teacher scope is derived from current Staff assignments. No raw client identifier expands these contexts.

## Multi-role identities

One person may have reviewed multiple roles, but permissions are never unioned implicitly. The current session selects one active assignment. Parent, Teacher, finance and administrative contexts remain separate; switching context changes navigation and server-authorised actions. Review warnings are mandatory for hazardous combinations and exact denials, such as permanent Teacher marks write, remain effective.

Rehire/reactivation is a new eligibility and approval decision. Offboarding preserves immutable audit history; it does not delete and recreate the identity to hide prior state.

