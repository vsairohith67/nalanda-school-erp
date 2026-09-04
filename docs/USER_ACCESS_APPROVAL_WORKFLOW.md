# User Access Approval Workflow

## Lifecycle

The governed request states are `PREPARED`, `AWAITING_APPROVAL`, `REVIEWED`, `APPROVED_FOR_INVITATION`, `INVITATION_CREATED`, `ACTIVATION_PENDING`, `MFA_ENROLMENT_PENDING`, `TRAINING_PENDING`, `ACTIVE`, `SUSPENDED`, `LOCKED`, `DISABLED`, `ARCHIVED`, `INVITATION_EXPIRED`, `INVITATION_REVOKED` and `REJECTED`. `lib/real-user-access/lifecycle.ts` is the transition authority; arbitrary state jumps fail closed.

Preparation records a prospective person reference, type, username/contact candidate, roles, exact scopes, reason, requester, expiry, training, MFA and conflict warnings. It is preview-only by default. Submission, review and approval are separate actions with optimistic state checks and privacy-safe audit events.

## Separation of duties

- requester, reviewer and approver must be distinct for a normal governed request;
- ordinary operators cannot approve themselves or high-risk access;
- the reviewer and approver must hold a current eligible leadership role from the approval matrix;
- every approval consumes a short-lived action/session/environment-bound step-up grant;
- Super Admin access additionally requires two distinct leadership actors across review and approval;
- a duplicate identity, inactive relationship, unresolved blocking finding or stale state refuses approval.

## Minimum approval matrix

| Requested access | Approval contract |
| --- | --- |
| Super Admin | two distinct eligible leadership actors, no self-grant, mandatory MFA, step-up, 90-day review |
| Director | active Super Admin approval, mandatory MFA, step-up |
| Principal | Super Admin or Director approval, mandatory MFA, step-up |
| Accountant | leadership/finance-owner evidence, mandatory MFA, step-up and 90-day review |
| Teacher | active Staff link/assignment review; no permanent marks-write authority |
| Parent | active Guardian and linked-child review; no unrelated child context |
| Student | active Student and approved age/account-policy evidence |
| Specialised operator | exact scope, expiry, required training/MFA and eligible owner approval |
| Default low-risk | Super Admin, Director or Principal approval under exact role/scope |

## Decision history and concurrency

Each transition records actor, timestamp and bounded reason/history. Approval persists pending assignments; invitation issue snapshots their exact roles and credential version. Update conditions include the expected current state so repeated or concurrent decisions do not silently succeed.

Rejection, revocation, expiry and later certification are explicit. No approval automatically creates a delivery, credential or active login. No rollout wave begins because another wave completed.

