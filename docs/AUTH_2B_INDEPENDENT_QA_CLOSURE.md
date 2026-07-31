# AUTH-2B Independent QA and Release Closure

Status: `AUTH_VERIFIED_RECOVERY_CLEARED`

Date: 2026-07-31

Retained branch: `auth/verified-recovery-session-registry`

Release tag: `auth-verified-recovery-v37-2026-07-31`

## Scope and release boundary

Independent QA reviewed every changed authentication model, migration, helper,
route, cookie contract, UI and backup/restore projection. It did not add named
users, permission profiles, grants/denials, delegated administration,
multi-role context, deployment, cloud processing or a live email/SMS provider.
No disabled operational account was activated. IAM-1A remains the next governed
phase.

## Independent review corrections

The release review fixed five issues before clearance:

- account-security APIs now expose version-bound HMAC handles instead of raw
  alias/session database IDs and resolve them only within the current user;
- an authorised username change removes the old governed alias append-only,
  creates a new UUID alias, invalidates pending recovery, increments credential
  version and revokes sessions with `LOGIN_IDENTIFIER_CHANGED`;
- destructive dialogs now enter focus, trap Tab/Shift+Tab, close on Escape and
  restore focus to the invoking control;
- version-37 backup now preserves alias, verification, reset, session and event
  history without password, code, reset-token or session-token hashes; restored
  sessions are always revoked and recovery records invalidated;
- account-security controls are at least 44 px and the clean runtime has no CSS,
  hydration, console or stderr warning.

The copied-operational migration checker was also corrected to compare exact
pre-migration columns. This distinguishes an expected additive
`User.credentialVersion` column from an application-data mutation while still
validating the complete post-migration schema and a second idempotent deploy.

## Copied-database matrix

Unique ignored AUTH2BQA fixtures covered active Super Admin, Teacher/Staff,
Parent/Guardian, Student-linked admission account and disabled users; all five
alias types; verified, pending and duplicate values; duplicate contact fields;
and current, expired, revoked and tampered sessions.

The matrix passed strict normalization, username/work/personal/mobile/admission
login, unverified and ambiguous refusal, cross-user takeover refusal, no contact
auto-promotion, expiry and attempt ceilings, last-identifier removal refusal,
append-only alias/audit history, masked client evidence and self-only ownership.
Disabled accounts could neither authenticate nor recover into an active state.

## Enumeration, reset and session evidence

HTTP probes produced the same generic, no-store public result for nonexistent,
wrong-password, disabled and unverified login attempts. Recovery start stayed
generic for missing, disabled, pending and unsupported channel cases; expired
and used reset tokens shared the same safe response. Source/account throttling,
origin refusal and bounded bodies were enforced.

Reset QA proved hash-only storage, short expiry, resend invalidation,
attempt limits, mismatch/weak/old-password refusal, concurrent single use,
forced-failure rollback, old-password denial, fresh-password success and full
prior-session revocation. Change Password separately proved credential-version
increment, stale-session revocation, cookie rotation and old-cookie denial.
Logout-current, revoke-one, revoke-others and revoke-all were independently
exercised. Raw internal IDs, full IP addresses, hashes and secrets were absent
from UI/API/log/audit evidence.

## Browser and accessibility QA

Login, Forgot Password, Reset Password, alias management and session activity
were exercised at 1366x768 and exact 390x844 in light and dark themes. The
document width was exactly 390 px on mobile with no overflowing descendants.
Scoped controls were at least 44 px, focus was visibly rendered, destructive
dialogs were keyboard-complete, status was accessible and no native
alert/confirm/prompt existed. Current-device marking, masked network evidence,
alias possession verification, per-session revocation, other-session revocation
and current-session confirmation for revoke-all passed. A fresh final page had
zero console warnings/errors; runtime stdout/stderr contained no fatal,
hydration, credential or token pattern.

## Migration, backup and cleanup

Fresh migration, copied-operational onboarding, schema equivalence and current
version-37 backup/restore each passed twice. The canonical migrated schema has
182 models/tables, 865 indexes and 357 foreign keys. Auth-aware restore was also
run twice, preserving counts/history while restoring no credential material and
no live session. All AUTH2BQA databases, users, aliases, challenges, reset
records, sessions, local sink records, logs and runtimes were removed; two
independent cleanup inspections found zero scoped artifacts. Operational data
retained the exact pre-release SHA-256 and zero-business/account baseline during
all QA.

## Full verification

The standard commands ran sequentially against a migrated copy with low-memory
controls:

- `pnpm.cmd routes:list`: 284 page routes and 414 API routes;
- `pnpm.cmd lifecycle:backfill`: zero writes;
- `pnpm.cmd typecheck`: passed with a bounded 3 GB heap;
- `pnpm.cmd test`: 1,622 tests across 177 files passed;
- `pnpm.cmd build`: compiled and generated 228 static entries with the permitted
  bounded 4 GB heap;
- `pnpm.cmd backup`: version 37 created inside the disposable QA root;
- `pnpm.cmd git:safety-check`: no detected secret or private runtime artifact.

The one additive operational migration was approved only after these independent
gates. The protected pre-migration rollback artifact, post-migration business and
account comparison, main/branch/tag identity and external governance references
are release evidence; they do not authorise deployment or live provider use.

## Operational release evidence

Protected ignored folder `AUTH2BQA-ROLLBACK-20260731T180043Z` retains the
5,218,304-byte byte-identical pre-migration database. Its SHA-256 is
`90ACB7F9C1BA74049ED6430DBAA8A633C84B4452BC869F3E85AF14E9DA1B5696`.
The approved migration then applied exactly once and Prisma reported all four
migrations up to date.

Post-migration `prisma/dev.db` SHA-256 is
`8949FDA0EC63062F540EABF2B8B758A2469115F7C4CD8CA32C4F690E9DDB6AF0`.
All six business counts and all four account states remained exact; four
existing usernames were the only aliases backfilled, while verification,
reset, session and security-event counts remained zero. SQLite integrity stayed
`ok` with zero foreign-key violations.

Retained backup `nalanda-fee-control-backup-2026-07-31-23-32.json` is version
37, has SHA-256
`6283B548B74CF2E788BDB8CA75FD7A1ABDA23CF133EE3F800567EE2DB68591F1`,
contains the four username aliases and has zero forbidden password/code/token
hash keys. Deployment and live provider activation remain unauthorised.
