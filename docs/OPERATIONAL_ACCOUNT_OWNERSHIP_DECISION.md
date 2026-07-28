# Operational Account Ownership Decision

Status: `SECONDARY_SEED_ACCOUNTS_DISABLED`
Phase: `AUTH-2A-P4C`
Operational account changes performed: **governed Super Admin recovery in
P4B2, followed by three approved status-only disables in P4C**

This document records role-level decisions only. It must never contain a
username, email address, password, password hash, token, cookie, recovery
value, database ID, or copied credential material.

## Current safe evidence

The zero-data operational baseline now retains one active `SUPER_ADMIN`, owned
by V. Sai Rohith, whose password recovery and two fresh logins were verified.
The retained `ADMIN`, `ACCOUNTANT`, and `VIEWER` accounts are inactive. No User
was deleted, no role or role-permission row changed, and the three disabled
credentials and stale authorization are rejected.

P4C created exactly three append-only `USER_DEACTIVATED` audit events with
role-level details and the approved reason. The zero-data business baseline
remains 0 Students, 0 active enrollments, 0 Payments, INR 0 collected,
0 Guardians and 0 Staff.

Post-P4C operational database identity:

- SHA-256:
  `8688F92BD85B14D0AD46294761F0F938EE5A3F7E759B79802CEA6B669A9B5919`
- size: `4,771,840` bytes
- modified UTC: `2026-07-28T15:33:22.7523601Z`
- safe `UserAudit` total: `14` (`3` new P4C deactivation events)

AUTH-2A-P2 added no Prisma model or migration. Centralized `AuthSession` and
persisted ownership/rotation metadata remain deferred to `AUTH-2B`, after
`DEVOPS-1E` migration-baseline onboarding.

The validated decisions named V. Sai Rohith as the `SUPER_ADMIN` owner,
required private password recovery/rotation and fresh-login verification, and
approved disabling `ADMIN`, `ACCOUNTANT` and `VIEWER` only after that proof.
P4B2 and P4C completed that exact sequence.

## Applied treatment

| Role | Decision | Verified treatment | Active after P4C? |
|---|---|---|---|
| `SUPER_ADMIN` | `ASSIGN_OWNER_ROTATE_VERIFY` | Named owner recorded; password rotated; two fresh logins and protected access verified | Yes |
| `ADMIN` | `DISABLE_NOW` | Disabled pending a named owner and current operational need | No |
| `ACCOUNTANT` | `DISABLE_NOW` | Disabled pending a named Accountant and current finance need | No |
| `VIEWER` | `DISABLE_NOW` | Disabled pending a named Viewer/Auditor and current review need | No |

## Lockout-prevention sequence

AUTH-2A-P3 must execute this order and stop at the first failed check:

1. Re-run the clean-main, tag, synchronization, zero-data, account-count, and
   operational database identity gates.
2. Obtain the exact user choices below and a named `SUPER_ADMIN` owner.
3. Stop ordinary application processes before taking a private byte-identical
   SQLite rollback copy. Record only its hash, size, timestamp, and private
   location; do not commit or upload it.
4. Confirm exactly one active `SUPER_ADMIN` remains available.
5. Rotate the `SUPER_ADMIN` password using a value supplied privately by its
   named owner. Never place the value in chat, documentation, Git, screenshots,
   logs, command output, or Notion.
6. Verify a fresh `SUPER_ADMIN` login. Do not disable any other account until
   this succeeds.
7. Disable `ADMIN`, then `ACCOUNTANT`, then `VIEWER`, one at a time. After each
   change, verify the fresh `SUPER_ADMIN` session still has User Management and
   System Health access.
8. Re-run sanitized role-level inventory, System Health, zero-data counts,
   operational database identity, and backup verification.

At least one active `SUPER_ADMIN` must remain throughout. AUTH-2A-P3 must not
demote or disable the last active `SUPER_ADMIN`.

## Session-invalidation effect

The current signed session carries role and password-credential state.
Password changes reject stale authorization through the credential tag; role
changes reject a stale role; disabled users are denied both login and protected
authorization. This is checked again against the current User row on protected
requests.

Sessions remain stateless in AUTH-2A. They cannot be centrally counted or
explicitly revoked, and logout removes only the current cookie. A centralized
`AuthSession` registry, session inventory, and revoke-all controls are
deferred to `AUTH-2B`.

## Rollback procedure

The version-37 JSON backup intentionally excludes password hashes and is not an
account-credential rollback mechanism.

If any P3 change or fresh login fails:

1. Stop immediately; do not change the next account.
2. Keep the app stopped.
3. Compare the operational database with the pre-change hash, size, timestamp,
   and approved private byte-identical SQLite rollback copy.
4. If database rollback is approved, atomically restore that exact private copy
   while the app is stopped.
5. Verify the zero-data business baseline, four safe role counts, active
   leadership, foreign keys, System Health, and fresh login before restarting.
6. Retain or destroy the rollback copy only under the approved recovery and
   retention decision. Never add it to Git.

## User information required

The user must provide or confirm, outside credential-bearing chat:

- the named human owner and position/responsibility for `SUPER_ADMIN`;
- confirmation that this person accepts owner-level accountability;
- the approved P3 maintenance window and recovery witness;
- whether `ADMIN`, `ACCOUNTANT`, and `VIEWER` should each be disabled now or
  retained for a named owner with a current need;
- confirmation that the owner will enter the new password privately;
- approval for the private byte-identical rollback copy and its retention.

No password or recovery material is required in this document.

## Executed AUTH-2A choices

All four role decisions were executed in the approved lockout-safe order:

| Role | Allowed P3 choice | Recommended |
|---|---|---|
| `SUPER_ADMIN` | `ASSIGN_OWNER_ROTATE_VERIFY` | Completed; active |
| `ADMIN` | `DISABLE_NOW` | Completed; inactive |
| `ACCOUNTANT` | `DISABLE_NOW` | Completed; inactive |
| `VIEWER` | `DISABLE_NOW` | Completed; inactive |

The optional role-only System Health decision record may use:

`AUTH_SEED_ACCOUNT_DECISIONS=SUPER_ADMIN:KEEP_TEMPORARILY,ADMIN:DISABLE_UNTIL_OWNER_ASSIGNED,ACCOUNTANT:DISABLE_UNTIL_OWNER_ASSIGNED,VIEWER:DISABLE_UNTIL_OWNER_ASSIGNED`

This value contains no person or credential data. It records a decision but
does not perform, prove, or replace the account changes.

## P2 verification boundary

The ignored copied-database rehearsal proved operational-path, production,
staging, and partial-retained-set seed refusal; isolated explicit creation;
disabled-account preservation; ordinary-startup no-op behavior; password,
role, and status stale-authorization rejection; concurrent last-Super-Admin
protection; repeat idempotence; safe System Health output; the proposed future
change sequence; and exact copied-database rollback.

No operational User, password, role, status, session, or database row changed.
