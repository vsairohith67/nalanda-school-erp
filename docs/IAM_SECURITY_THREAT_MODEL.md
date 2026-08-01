# IAM-1A Security Threat Model

| Threat | Primary control | Residual / verification rule |
|---|---|---|
| Disabled or stale identity reused | lifecycle, credential and authorization versions; session revocation | every request revalidates account, session and assignment |
| Client changes role string | server-held assignment ID and user/version-bound opaque handle | invalid context fails closed; no broad fallback |
| Explicit denial bypassed | single precedence evaluator; deny before every grant | test page, API, export, batch and direct-object access |
| Permission bypasses Teacher/Parent/finance scope | `OBJECT_SCOPED` classification plus existing exact resolver | permission allow is never object authorization |
| Computer Operator becomes unrestricted Admin | dedicated smallest-safe role and immutable security/finance denials | no profile or override can lift the invariant |
| Actor delegates authority they lack | exact `DELEGATE_IAM_ACCESS` plus effective permission check per requested grant | non-delegable permissions are refused |
| Self-escalation | own critical change refusal; role target boundaries; re-authentication | another active Super Admin is required for owner transition |
| Last Super Admin removed concurrently | database safety-lock update inside the transaction plus active-count check | SQLite single-writer architecture; independently stress in IAM-1A-QA |
| Shared profile lost update | expected profile version and affected-user acknowledgement | one concurrent update succeeds; stale update fails |
| Cross-family child access | Guardian relationship lookup on every request and version-bound handle | raw Student ID and foreign handle return no Student data |
| Removed role/link remains usable | per-request lookup, authorization/context versions, session revocation | stale handles and contexts fail immediately |
| Password/token disclosure | hidden temporary-password input, immediate hash, no return/log; backup allowlists | restore creates no user/password and revokes secretless sessions |
| CSRF or mutation via GET | same-origin mutation guard; POST-only context/IAM changes | all GET endpoints remain no-store/read-only |
| Oversized or racy mutation | request bounds, list caps, expected versions and transactions | forced-failure rollback and batch-boundary tests |
| Private identifiers in audit/error | opaque public handles, generic errors, filtered audit details | no password, hash, token, private key or raw Student ID in output/logs |
| External disclosure | no AI/provider transmission and no live adapter activation | staging/live providers remain unauthorised |

## Trust boundaries

The browser supplies only a requested opaque handle, expected context version,
bounded form input and CSRF/origin evidence. Next.js server routes resolve the
authenticated session, active assignment, permission decision and exact object
scope. Prisma transactions own state changes and append-only audit. The local
operational SQLite database remains private; copied ignored databases are the
only implementation/QA mutation environment.

## Out-of-scope risks

Multi-instance write coordination, live provider delivery, staging,
real-user onboarding, Parent attendance/timetable parity, and a broader
cross-module ownership model require separate governed phases.
