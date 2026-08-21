# ACADEMIC-INTEGRITY-1A-QA Clearance

Release: **Nalanda ERP v1.1 — Academic Integrity Release**

QA date: 2026-08-21

Result: `ACADEMIC_INTEGRITY_CLEARED`

Release tag: `nalanda-erp-v1.1-academic-integrity-v-2026-08-21`

The release commit is the single commit resolved by `main`, the retained
`feature/academic-integrity-principal-marks-v1-1` branch and the annotated
release tag after the guarded fast-forward release.

## Independent authorization result

| Context | Result |
| --- | --- |
| Super Admin | Permanent governed marks write and delegation governance allowed |
| Principal | Permanent governed marks write and delegation governance allowed |
| Teacher | Marks write denied at navigation, page, API, service, import, batch, submission, correction and moderation boundaries |
| Computer Operator / Viewer without grant | Denied |
| Exact-scope eligible non-teaching operator | Allowed only inside the explicit active scope |
| Teacher plus another ordinary role | Delegation and marks write denied |
| Future/unknown role | Denied |
| Delegated operator's linked child | Denied through existing Guardian/Student linkage |
| Delegated operator's unrelated in-scope Student | Allowed |

Teacher class, subject, timetable, class-teacher and examination assignments
were exercised as non-authorizing metadata. Generic IAM profile assignment and
permission-override paths were also tested and hardened so they cannot mint the
reserved operator authority. Principal/Super Admin leadership authority remains
separate from Teacher reporting assignments.

Two disjoint examination scopes were exercised. URL, body, batch, import,
Student and assignment substitutions failed closed. Revocation incremented the
authorization state, revoked sessions and denied a captured stale request.
Concurrent same-record writes produced one success and one version-conflict
rejection. A 122-Student synthetic workload completed inside an exact scope
without exposing other scope rows.

The family control uses only approved Guardian/Student links. It does not infer
relationships from names, addresses, phones or emergency-contact data.

## Security review

The approved security diff scan reviewed the complete implementation change and
reported no Critical or High finding. It found one Medium generic-IAM bypass:
generic profile/user APIs could assign the reserved profile or an allow override
for marks-write permissions. QA blocked those paths, added regression coverage,
and independently re-ran the forged profile, override, target-user, role and
replay cases. A separate delegated legacy-route permission mismatch and an
unauthorized delegation-page error surface were also fixed. Post-fix manual
authorization review and focused/full tests show zero unresolved authorization
finding at Medium or above.

## Browser evidence

- Principal: 1366x768 light/dark and exact 390x844 light/dark, including marks
  grid, grant, inspection and revoke.
- Super Admin: 1366x768 light/dark, including marks and delegation governance.
- Delegated Computer Operator: 1366x768 and 390x844; one exact assignment was
  visible, out-of-scope route selection returned no assignment, and delegation
  governance redirected to the useful unauthorized page.
- Teacher: 1366x768 and 390x844; no marks-write navigation or controls, and
  `/marks`, `/marks/governed`, `/teacher/marks` and `/marks/delegation` denied.
- Viewer without grant: denied with no marks-write navigation.

The feature surfaces had no horizontal page overflow, undersized important
targets, missing form labels, native dialogs, hydration errors or post-fix
console errors. Keyboard focus was visible. The development-only unavailable
client-version probe was not attributable to this feature.

## Final verification

- Routes: 336 page routes and 550 API routes.
- Lifecycle backfill: dry run; zero created enrollment/event rows.
- Typecheck: passed.
- Complete test suite: 217 test files passed; 1 file intentionally skipped;
  1,931 tests passed and 3 were intentionally skipped, from the optional
  qpdf adapter group because no approved qpdf executable plus pinned SHA-256 was
  configured. The existing non-qpdf PDF security and report-render suites passed.
- Production build: passed.
- Backup: version 41, created from the copied QA database.
- Git safety: passed.
- Prisma/schema migration: none added or required.
- Security: zero unresolved Critical, High or authorization-relevant Medium.

All mutation-capable QA used copied or generated synthetic databases. The
operational database stayed byte-identical before and after QA:
`65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`
(8,409,088 bytes).

Locked calculation snapshots, issued report content, publication history,
formula behavior, report templates and historic Teacher-authored audit evidence
were unchanged. The frozen V1 RC1 tag was not moved, deleted or rewritten. The
historical V1 Teacher policy remains `SUPERSEDED_BY_ACADEMIC_INTEGRITY_V1_1`.

At QA start, `main` still resolved to the cleared Command Center checkpoint.
`feature/super-admin-work-programme-1a` remained an unmerged parallel branch and
was not merged, reverted or modified by this release. No deployment, provider
activation, real-user activation or real-data import was performed.
