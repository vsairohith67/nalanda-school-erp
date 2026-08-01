# IAM-1A Implementation Checkpoint

Date: 2026-08-01
Branch: `iam/named-users-permission-contexts`
Base: `e8c3d2e5e8448ddc3b850f8df11fe98984064ae3`
Release base tag: `auth-verified-recovery-v37-2026-07-31`

## Completed implementation groups

- additive IAM schema and one migration;
- named-user lifecycle, multi-role assignments and human designations;
- reusable, versioned permission profiles with allow and deny entries;
- individual grants/denials and authoritative deny-first evaluation;
- delegability classification and immutable restrictions;
- last-Super-Admin safety lock, re-authentication, session revocation and
  authorization versions;
- server-side opaque role and child contexts;
- responsive Named Users, Permission Profiles, effective-access, history,
  security/session and active-context UI;
- version-37 backup validation and repeated restore without credential or live
  context restoration;
- copied-database IAM1A implementation harness and focused unit tests.

## Copied-database checkpoint

`pnpm.cmd qa:iam1a` passed with 18 synthetic named users. The matrix includes
two Super Admins, Director/Associate Director, Principal, Administrator,
Accountant, Computer Operator, two Teachers, Parent variants, Teacher + Parent,
Director + Parent, Viewer, disabled/expired assignments, active/inactive Staff,
multiple Guardians/children, profiles, conflicting overrides and sessions.

Proved: deny precedence, immutable and exact-scope enforcement, safe pending
creation, delegated Director administration, self-escalation denial,
multi-role switching, cross-user handle refusal, Parent child isolation,
concurrent profile expected-version protection, forced rollback, and backup
restore twice without duplicate IAM rows or restored active sessions.

The copied database and fixtures were destroyed. The operational database was
verified byte-identical before/after; no real account or business record was
changed.

## Copied production Browser checkpoint

The ignored `IAM1A Browser` fixture database was exercised through the clean
production runtime and then destroyed. Browser QA proved:

- pending named-user creation without a password or activation;
- profile creation, clone, shared-profile impact acknowledgement and assignment;
- effective-access source labelling, including individual-deny precedence over
  profile/base-role allows and profile-deny precedence;
- delegated Director account administration without a School Owner option;
- Teacher + Parent role switching with opaque server context handles;
- two-child Parent selection with no unrelated-child option, followed by a
  same-session return to Teacher with the child selector removed;
- no role picker for the single-role Director fixture;
- exact 1366 x 768 and 390 x 844 containment in light and dark themes;
- zero document-level overflow, no raw enums, no native dialogs, visible 2px
  focus, and no visible IAM action below 44px;
- zero Browser console warnings/errors and zero clean production stderr.

The Browser run found and corrected three implementation defects before this
checkpoint: 38px IAM form controls, a misleading School Owner option for a
delegated Director, and stale shared context-version state after linked-child
selection. Cleanup was inspected twice: the copied database, credentials,
logs, runtime and port 3221 were absent.

## Final implementation verification

The final copied operational database accepted the additive migration, a
second deploy was idempotent, and migration status was clean. The mandatory
commands then passed sequentially:

- `routes:list`: 288 page routes and 423 API routes;
- `lifecycle:backfill`: dry run, zero active Students, zero changes;
- `typecheck`: application, tools and all split test projects passed;
- `test`: 178 files and 1,627 tests passed;
- `build`: bounded 4 GB Node heap, 234 of 234 static pages generated;
- `backup`: version 37, zero credential/token/live-context fields detected;
- `git:safety-check`: candidate, staged and tracked scans passed.

The safety scan initially rejected fixture credential-shaped template strings.
Both IAM fixture harnesses now generate ephemeral values entirely in memory;
the IAM matrix and the complete sequential verification were repeated after
that correction. Independent IAM-1A-QA has not started, the feature is not
merged, and deployment/provider activation/real-user onboarding remain
unauthorised.
