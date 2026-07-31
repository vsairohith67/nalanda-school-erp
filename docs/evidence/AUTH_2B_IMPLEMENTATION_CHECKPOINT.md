# AUTH-2B Implementation Checkpoint

Result: `AUTH_VERIFIED_RECOVERY_READY_FOR_QA`.

## Release boundary

The implementation is retained on
`auth/verified-recovery-session-registry`; it is not merged. Preflight proved
clean synchronized `main` at
`cbc4e0f110f744f65cd6500fa55aa067f66bca2b`, annotated tag
`exam-report-publication-v37-2026-07-31`, private expected origin, Git safety,
three applied release migrations, SQLite integrity/foreign keys, zero Students,
enrollments, Payments, collections, Guardians and Staff, plus one active Super
Admin and inactive Admin/Accountant/Viewer. Pre-edit typecheck passed.

AUTH-2B adds one additive migration and no operational row. No operational
account was activated, created, renamed, linked, assigned a permission, or
given a new destination. No cloud, live email or live SMS adapter was enabled.
`AUTH2B_DELIVERY_ADAPTER=DISABLED` remains the release contract, and
AUTH-2B-QA remains the sole merge gate.

## Copied-database and security evidence

`pnpm.cmd qa:auth2b` passed on an ignored operational-database copy and reported:

```text
AUTH2B_COPIED_DATABASE_QA_PASSED
migratedUsernames=4
verifiedChannels=3
duplicateRefused=true
verificationAttemptLimited=true
newerResetWins=true
sessionsRevoked=2
```

Synthetic fixtures covered the retained Super Admin baseline, enabled and
disabled accounts, verified work/personal email and mobile aliases, pending and
duplicate aliases, an explicitly Student-linked admission-number alias and
multiple sessions. The rehearsal proved attempt-limited alias verification,
newer-reset invalidation, single-use reset, masked network evidence and
all-session revocation. Its database and private delivery mailbox were
destroyed, and the operational database identity remained unchanged.

The security validation found and corrected two defects before sign-off:

- failed alias-code attempts had originally rolled back with their transaction;
  invalid attempts now commit a bounded counter and invalidate at five attempts;
- unauthenticated Forgot/Reset pages had been omitted from the AppShell public
  allowlist; both are now public while retaining no-store/no-index controls.

The final Git safety remediation also made synthetic QA passwords dynamically
generated rather than secret-shaped source literals and taught the env-example
scanner to accept only the exact non-secret `DISABLED` enum. The scanner still
fails closed for credential-shaped assignments and private runtime artifacts.

## Browser evidence

Short, sequential in-app Browser batches passed at desktop `1366x768` and exact
mobile `390x844`, in light and dark themes. Evidence covered:

- the identical generic login error for a nonexistent identifier;
- username login and login through a newly verified personal-email alias;
- masked aliases, recent activity and the current-device indicator;
- an accessible in-app session dialog and revocation of another session;
- logout revocation followed by protected-route redirection;
- identical Forgot Password responses for missing and eligible identifiers;
- reset token delivery in the URL fragment, immediate fragment removal and no
  stored destination disclosure;
- unauthenticated Forgot/Reset rendering, 44 px actions, no horizontal overflow,
  no native dialogs and zero console errors.

No password reset was submitted through Browser; the copied-database suite
proved the actual reset transaction, token consumption, password replacement
and session revocation without retaining Browser credentials or runtime files.

## Required sequential release gate

The required commands completed sequentially with Browser and other heavy work
stopped:

| Command | Evidence |
| --- | --- |
| `pnpm.cmd routes:list` | 284 page routes; 414 API routes |
| `pnpm.cmd lifecycle:backfill` | dry run; 0 active students; 0 writes |
| `pnpm.cmd typecheck` | passed under a bounded 3 GB heap |
| `pnpm.cmd test` | 176 files; 1,617 tests passed |
| `pnpm.cmd build` | production build passed under the permitted 4 GB heap |
| `pnpm.cmd backup` | protected version-37 backup created in ignored storage |
| `pnpm.cmd git:safety-check` | candidate, staged and tracked scans passed |

Operational migration, merge and provider activation remain prohibited until
independent AUTH-2B-QA.
