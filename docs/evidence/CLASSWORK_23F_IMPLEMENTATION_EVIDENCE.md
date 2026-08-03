# Prompt 23F Implementation Evidence

Date: 2026-08-03

Branch: `feature/classwork-secure-submissions`

Base main commit: `690c1d9f`

Decision: ready for independent Prompt 23F-QA; not merged or released

## Implemented controls

- Seven additive classwork models and one additive migration cover versioned
  items, instruction versions, submissions, submission versions, attachments,
  append-only feedback and append-only audit.
- Teacher scope is resolved through active User -> StaffMember ->
  TimetableTeacher -> exact TimetableAssignment.
- Parent access resolves active Parent context -> opaque version-bound child
  handle -> active Guardian/Student link -> exact academic-year enrollment.
- Student access resolves a verified admission alias and is self-only.
- Lifecycle operations require expected versions and transaction-safe request
  keys. Published instructions and submitted versions are immutable.
- Private file validation covers signature/structure, decoded dimensions,
  animation, byte and item quotas, traversal and symlink refusal.
- Authenticated attachment responses are private/no-store and storage keys are
  opaque. Public/PWA routes do not expose classwork assets.
- Encrypted AES-256-GCM asset backup includes bytes, metadata, hashes and owner
  links. Publish/submit fails closed until two isolated restores are proven.
- Principal aggregates contain completion/exceptions without learner ranking;
  Viewer results are threshold-suppressed.

## Sequential verification

| Gate | Result |
| --- | --- |
| Route inventory | Passed: 303 pages, 453 API routes |
| Copied-database `CLASS23F` lifecycle | Passed; two Teachers, multi-cohort, multi-child Parent, unrelated Parent, Student, Principal, Viewer and denied roles |
| Lifecycle/concurrency | Passed; publish, late submit, return, resubmit, review, stale/tamper refusal, forced rollback, exactly one concurrent final submit and exactly-once notification |
| Asset recovery | Passed; two encrypted assets, two isolated restores, byte hashes/counts/links matched, repeated restore idempotent, wrong-key and corrupt artifacts refused |
| Metadata recovery | Passed twice with version-37 backup/restore and ownership links intact |
| Fresh migrations | Passed deploy twice/status clean: 8 migrations, 204 models/tables, canonical schema equivalence |
| Typecheck | Passed all 13 project partitions with a 3 GB heap cap |
| Focused classwork tests | Passed 9/9 |
| Full suite | Passed 182 files and 1661 tests, serial single-worker |
| Recovery regression repetition | Passed 13/13 three consecutive times using exact bigint Windows file identities |
| Production build | Passed compile and generate with a 4 GB heap cap |
| Git safety | Passed candidate, staged and tracked secret/private-runtime scan |

## Browser proof

An isolated copied database was used and removed twice after the run.

- Teacher: exact-scope list/queue, create/publish surfaces, private preview,
  return, feedback and review.
- Parent: linked-child published list, returned feedback, private text draft,
  real PNG upload, recovery-blocked final submission and no native dialog.
- Student: verified self-only classwork and correct authenticated landing.
- Principal: aggregate completion/exceptions without surveillance ranking.
- Viewports/themes: 1366x768 and 390x844, light and dark.
- Accessibility/runtime: keyboard-operable accessible modal, visible actions at
  least 44 px, no horizontal overflow, and a fresh zero-entry console with no
  hydration or runtime stderr.

## Operational and release safety

- Operational baseline after QA: 0 Students, 0 active enrollments, 0 payments,
  0 Guardians, 0 Staff, 4 protected baseline Users, 4 role assignments, 0
  sessions and 0 active child contexts.
- A version-37 operational JSON backup was created under the ignored `backups/`
  directory. Operational classwork attachment count remains zero; attachment
  byte recovery was proven only with isolated synthetic fixtures.
- The additive classwork migration is intentionally not applied to the
  operational database during implementation. Independent QA owns migration
  approval, merge and tag decisions.
- No deployment, staging, live provider, external transfer or real-user
  onboarding was performed.
