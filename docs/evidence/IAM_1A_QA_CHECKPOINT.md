# IAM-1A-QA Independent Checkpoint

Date: 2026-08-01
Branch: `iam/named-users-permission-contexts`
Implementation commit under QA: `6546d238dcb277b30b7c02b328794ef3e8785090`
Release base: `e8c3d2e5e8448ddc3b850f8df11fe98984064ae3`

## Independent copied-database matrix

`pnpm.cmd qa:iam1a` passed with 23 fresh `IAM1AQA` named users and no
operational writes. The matrix independently covered two Super Admins,
sole-Super-Admin transitions, Director and Associate Director, Principal,
Administrator, Accountant, Computer Operator, two Teachers, one- and
multi-child Parents, Teacher + Parent, Director + Parent, Viewer, disabled,
inactive and expired assignments, profiles, conflicting overrides, and
multiple session/context states.

The matrix proved all eleven precedence outcomes, exact object-scope
preservation, pending lifecycle and alias/link takeover refusal,
temporary-password forced rotation, delegated-administration boundaries,
concurrent profile/account expected-version refusal, concurrent
last-Super-Admin protection, context-handle isolation, child-family isolation,
forced transaction rollback, additive migration double-deploy, version-37
backup/restore twice, secret/session exclusion, and cleanup inspection twice.

## Copied production Browser QA

Short copied-runtime batches covered Super Admin administration, profile
creation/assignment, explicit deny precedence, lifecycle confirmation,
last-Super-Admin/self-critical refusal, delegated Director administration,
Teacher + Parent switching, multi-child Parent selection, mobile navigation,
access history and session-security status.

- desktop: exact 1366 x 768, light and dark;
- mobile: exact 390 x 844, light and dark;
- document overflow: zero;
- visible IAM/mobile actions below 44 px: zero;
- keyboard focus: visible 2 px outline;
- native dialogs: zero;
- console/hydration warnings or errors: zero;
- final clean production stderr: zero.

The Browser matrix verified that a single-role Parent has no role picker,
Teacher + Parent sees exactly Teacher and Parent, the linked-child selector
exists only in Parent context, only two linked children are offered, the
unrelated child never appears, and child state disappears on return to Teacher.
Opaque context changes redirected away from the now-unauthorised page and the
new context was revalidated server-side on the next request.

## QA fixes

Independent QA corrected these defects before this checkpoint:

- page/API authorization paths that still consulted only the legacy base role
  now use the active named-user/session/context evaluator;
- object-scoped grants fail closed when the active role has no approved exact
  resolver, including Staff-to-Teacher link checks;
- the last-Super-Admin lock uses expected-version acquisition and the additive
  migration installs database triggers for concurrent suspension, role end,
  role deletion and role-expiry protection;
- login returns a governed home path instead of a raw role enum;
- reauthentication inputs clear immediately after success or refusal;
- delegated profile/override controls and role choices are derived from the
  actor's effective permissions instead of being rendered from a broad
  management flag;
- nested before/after audit evidence is recursively humanised and recursively
  filters credential, token, hash, internal-ID and handle keys.

The patched focused IAM tests pass, the 23-user matrix passes again, and the
bounded 4 GB production build generates all 234 pages. Browser cleanup ran
twice. The ignored copied database, credentials, logs and runtime are absent;
port 3217 is closed. At the end of copied-runtime QA, before the governed
operational migration, the operational database remained byte-identical at
5,332,992 bytes with SHA-256
`8949FDA0EC63062F540EABF2B8B758A2469115F7C4CD8CA32C4F690E9DDB6AF0`.

## Migration, restore and operational preservation

The protected pre-migration rollback database and two restore rehearsals are
byte-identical at the SHA-256 above. The single approved additive migration,
`20260801110000_iam_named_users_permission_contexts`, applied once to the
operational database; a second deploy was a no-op and migration status is
clean. The post-migration database is 5,509,120 bytes with SHA-256
`236B5DC718814A9729D8C451B4F647C500D715E93EFE7ACF8D3A80E3698ECA95`.

Post-migration verification proves 0 Students, 0 active enrollments, 0
Payments, INR 0 collected, 0 Guardians and 0 Staff. The protected account
digest over username, password hash, credential version, role and activation
state matches the rollback database. Exactly one owned Super Admin remains
active; Administrator, Accountant and Viewer remain suspended. There are no
operational profiles, profile assignments, overrides, sessions or `IAM1AQA`
users, and foreign-key checking returns zero violations.

## Final verification and release closure

The required commands passed sequentially after the final QA fix:

- `routes:list`: 288 page routes and 423 API routes;
- `lifecycle:backfill`: 0 active Students scanned and no writes;
- `typecheck`: every application, tool and test TypeScript project;
- `test`: 178 files and 1,627 tests;
- `build`: 234 pages with a bounded 4 GB Node heap;
- `backup`: version 37, generated 2026-08-01;
- `git:safety-check`: candidate, staged and tracked sources clean.

Fixture-owned copied databases, credentials, delivery records, logs, runtimes
and harness contents were removed, followed by two zero-residue inspections.
The retained feature branch is fast-forwarded to `main` and the annotated
release tag is `iam-delegated-access-v37-2026-08-01`; branch, main and tag are
required to resolve to the same release commit.

Result: `IAM_DELEGATED_ACCESS_CLEARED`. Next governed phase: Prompt 23D,
Parent Attendance and Examination Timetable. Staging, deployment, live
providers and real-user onboarding remain unauthorised.
