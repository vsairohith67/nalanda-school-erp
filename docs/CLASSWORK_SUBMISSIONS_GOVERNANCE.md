# Prompt 23F Classwork and Submission Governance

## Scope

Prompt 23F adds governed `CLASSWORK`, `HOMEWORK` and `ASSIGNMENT` delivery. It
does not change examination marks, report cards, payments, chat, public-site
content or AI assessment.

Every item is bound to an exact academic year, class, section and timetable
subject. Teacher authority requires an active User -> StaffMember ->
TimetableTeacher chain and a matching TimetableAssignment. A permission token
does not widen object scope. Principal oversight is permission-gated; Viewer
aggregates suppress small cohorts and expose no item or learner handle.

Parent actions require an active Parent role context and an opaque,
version-bound linked-child context. The submission records both the Student and
the real Parent actor. Student actions resolve the verified admission alias and
may act only for self.

## Immutable lifecycle

- Item states are `DRAFT`, `PUBLISHED`, `CLOSED` and `ARCHIVED`.
- Published instructions are immutable. A correction appends a new version and
  retains the replaced version.
- Submission states are `DRAFT`, `SUBMITTED`, `LATE`, `RETURNED`,
  `RESUBMITTED` and `REVIEWED`.
- Submitted work is immutable. A returned submission opens a new draft version;
  resubmission locks that new version.
- Feedback and audit records are append-only. There is no hard-delete route or
  lifecycle transition.
- Expected row versions, transaction-scoped request keys and unique constraints
  make publication/submission retries idempotent and allow only one concurrent
  final transition. Notification creation is in the same transaction and keyed
  exactly once.

## Private files and recovery gate

Accepted files are bounded PDF, PNG, JPEG and still WebP. Validation checks the
extension, MIME, signature/structure, decoded image dimensions, animation,
size, quota and path safety. Executable, HTML/SVG, office/macro, malformed,
truncated, animated, oversized, traversal and symlink inputs fail closed.

Files use opaque private storage keys outside public and PWA paths. Retrieval is
authenticated and returns `private, no-store`; original filenames are not used
as storage keys or logs. SHA-256, byte size, media type, ownership and recovery
state are retained as evidence.

Publication or final submission with attachments is refused until every asset
has an encrypted byte backup and two isolated restores with matching byte
hashes, counts and links. JSON metadata alone never changes recovery state.

## Release boundary

The operational database, operational accounts and business data remain
unchanged. Migration deployment, merge, tag and release require the independent
Prompt 23F-QA matrix. Deployment, staging, live providers, external transfer and
real-user onboarding are outside this phase.
