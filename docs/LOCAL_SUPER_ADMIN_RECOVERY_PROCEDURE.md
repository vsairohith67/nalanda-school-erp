# Local Super Admin Recovery Procedure

Status: utility implemented, copied-database tested, and approved operational
recovery verified

Operational password reset performed by AUTH-2A-R1 implementation phase:
**no**. The separately approved AUTH-2A-P4B2 execution later completed the
recovery and verified two fresh logins without recording credential material.

## When recovery is permitted

Use `pnpm.cmd auth:recover-super-admin` only when all of the following are
true:

- the existing active `SUPER_ADMIN` password is unknown;
- normal self-service password change cannot be used;
- the target identifier and named human owner were verified separately;
- exact operational approval and a maintenance window were recorded;
- the application is stopped;
- a byte-identical rollback copy exists in ignored protected storage;
- the operational database SHA-256 and rollback SHA-256 were recorded
  independently;
- the business baseline is still 0 Students, 0 active enrollments, 0 Payments,
  INR 0 collected, 0 Guardians and 0 Staff.

The utility is a local CLI. It is not a page, API, authentication bypass,
public reset link or direct database editor. It refuses production/staging
release environments and does not accept command-line arguments.

## Required private environment

Set these values only in the local process environment. Do not commit them:

```text
DATABASE_URL=file:./dev.db
AUTH_RECOVERY_EXPECTED_DB_SHA256=<approved pre-change SHA-256>
AUTH_RECOVERY_ROLLBACK_PATH=<absolute path to the byte-identical rollback database>
AUTH_RECOVERY_ROLLBACK_SHA256=<approved rollback SHA-256>
```

Operational mode is hard-wired to the repository's exact `prisma/dev.db`.
The rollback file must be a separate database file beneath ignored
`backups/` storage. Changed hashes, missing files, alternate database paths,
non-zero business data, inactive/unknown/non-Super-Admin targets and ambiguous
identifiers are refused before mutation.

`AUTH_RECOVERY_QA_MODE=true`, `AUTH_RECOVERY_QA_ROOT` and
`AUTH_RECOVERY_QA_DATABASE_PATH` are reserved for disposable copied-database
tests beneath ignored `tmp/` storage. Never use QA mode for the operational
reset.

## Private execution

1. Stop the verified Nalanda ERP process.
2. Recalculate the operational and rollback SHA-256 values.
3. Set the required local environment values without including a password.
4. Run:

   ```powershell
   pnpm.cmd auth:recover-super-admin
   ```

5. Enter the login identifier interactively.
6. Enter the new password and confirmation in the hidden prompts. The
   characters are not echoed.
7. Type the exact confirmation phrase shown by the utility.
8. Accept only the safe completion result. The utility never prints the
   password or its hash.

Never place a password in chat, a command argument, shell history, a script,
Git, Notion, screenshots, logs, tickets or operator documentation.

## Safeguards and audit evidence

The utility:

- applies the existing application password policy;
- rejects documented/default/demo credentials;
- hashes with the existing application password helper;
- changes only the selected active `SUPER_ADMIN` credential;
- rechecks the zero-data baseline and account state inside the transaction;
- creates one append-only `SUPER_ADMIN_PASSWORD_RECOVERED` `UserAudit` event
  with role/method-only details;
- preserves role and active status, so at least one active Super Admin remains;
- invalidates stale authorization because the existing session credential tag
  is derived from the current password hash.

The event does not contain the identifier, password, password hash, email,
cookie, token or recovery value.

## Post-reset verification

After a separately approved operational execution:

1. Start the production build against the operational database.
2. Use a fresh private Browser session to verify the new password.
3. Verify the active role is `SUPER_ADMIN`.
4. Load the dashboard and one protected page.
5. Log out and repeat a fresh login.
6. Verify any preserved pre-reset authorization is rejected.
7. Confirm the account no longer matches documented seed-password provenance.
8. Recheck zero business counts and safe role/status totals.
9. Record only safe audit count, completion timestamp and post-change database
   identity.

Fresh Super Admin access was proven before P4C. P4C then disabled only
`ADMIN`, `ACCOUNTANT` and `VIEWER`, preserved their User and audit history, and
reverified Super Admin access.

## Failure and rollback

If the utility refuses before mutation, correct the stated safety condition;
do not bypass it.

If execution reports a transactional failure or the new credential cannot
authenticate:

1. Keep the ERP stopped.
2. Preserve the failed database separately in ignored protected storage.
3. Restore the approved byte-identical rollback database.
4. Verify the restored SHA-256 exactly.
5. Recheck the zero-data baseline and four role/status counts.
6. Do not disable another account.
7. Investigate through copied-database reproduction before retrying.

Direct SQL updates, hand-built password hashes, temporary public endpoints,
authentication bypasses and hash copying between accounts are prohibited.

## Future delegated-account requirement

A dedicated IAM/RBAC phase after `DEVOPS-1E` must design:

- multiple named Directors/Associate Directors, Principal, Accountant,
  Computer Operator, Teacher, Parent and other operational accounts;
- username plus separately verified personal/work login aliases;
- a selectable verified personal/work reset channel with single-use reset
  links only; never email a password;
- selectable feature permissions and reusable permission profiles;
- base roles plus explicit per-account grants and denials;
- owner, lifecycle, rotation, review and emergency-access governance;
- centralized session inventory and revocation through the deferred
  `AuthSession` work.

AUTH-2A-R1 adds no Prisma model or migration. It does not implement delegated
accounts, persisted ownership metadata or the AUTH-2B session registry.
