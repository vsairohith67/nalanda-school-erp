# SEARCH-EXTENSION-1B QA Clearance

- **Prompt:** `SEARCH-EXTENSION-1B`
- **Decision date:** 2026-08-24
- **Result:** `SEARCH_EXTENSION_1B_CLEARED`
- **Feature branch:** `feature/search-extension-1b`
- **Authorised starting main:** `37fba4673312c135a3a8be6d447c543a9ca28f95`
- **Existing release tag:** `universal-search-extension-v43-2026-08-24` at `3d51164b8214211d26e48c2c6f9920286ef9c689` (retained; never moved)
- **Corrective release tag:** `universal-search-extension-v43-2026-08-24-r1` at `e39cb93177ad389768b097791696e88902db2945`
- **Exact-head CI:** [run 32751493284](https://github.com/vsairohith67/nalanda-school-erp/actions/runs/32751493284), job `validate` / `97509259876`, passed every mandatory step at feature SHA `a8e0668bdc2785f079a1561cc5c62cdc46084b35`.
- **Merged main:** PR #8, normal merge `e39cb93177ad389768b097791696e88902db2945`.
- **Deployment:** not performed or authorised

## Exact source coverage

| Candidate module | Coverage decision | Approved global Search fields | Excluded fields and behaviours |
| --- | --- | --- | --- |
| Parent Meetings | `SAFE_METADATA_ONLY` | Meeting reference, Student safe identity, category, status, schedule, mode and follow-up state | Leadership/private notes, Parent-visible free text, cancellation reasons, participant/audit content |
| Transport | `SAFE_METADATA_ONLY` | Route code/name, vehicle safe reference, approved stop label and individually authorised Student assignment metadata | Broad rosters, addresses, driver identity/private data and change reasons |
| Cafeteria | `SAFE_METADATA_ONLY` | Item/menu metadata, enrollment state and meal-participation state | Dietary/health notes or meal-plan inference, financial inference and change reasons |
| KG Report Cards | `SAFE_METADATA_ONLY` | Issued report number, Student safe identity, academic year, evaluation/reporting period and publication state | Rubric/assessment content, comments, grades, snapshots and draft data |
| Event Media | `SAFE_METADATA_ONLY` | Opaque album/media references, event date, publication/review state, media count and safe technical dimensions/type | Free-text album title/description, captions, bytes/storage keys/hashes, Student links, consent records, EXIF, OCR and face/identity processing |

No candidate is fully `SEARCHABLE`; all five are intentionally narrower
`SAFE_METADATA_ONLY` sources. None is `UNAVAILABLE` in this release when its
governing module is enabled. Parent Meetings, Transport and Cafeteria remain
fail-closed and report `UNAVAILABLE` when their module flag is disabled or
their adapter is unsupported. Unsupported sources are never represented as
`EMPTY`.

## Authorization and isolation

- Universal Search route, API and service remain exact active
  `SUPER_ADMIN` only.
- Director, Principal, Accountant, Admin, Computer Operator, Teacher, Parent,
  Student, Gate Staff, Viewer and exact-scope `MARKS_ENTRY_OPERATOR` remain
  denied in the automated authorization matrix.
- Browser QA confirmed a Principal direct-page attempt redirects to
  `/unauthorized` with no Search workspace or result data.
- Existing Diary, Task and Contact results retain exact `actor.userId` owner
  filtering. The new adapters do not accept caller-supplied owner, projection,
  relation, destination or raw filter objects.
- Requests remain POST-only, private/no-store and bounded to 2-120 characters,
  per-source caps and a 50-result overall cap. Empty queries cannot dump a
  module.

## Retrieval and privacy evidence

Each adapter was exercised on a copied database populated only with synthetic
fixtures:

- 1,050 meetings plus follow-up metadata;
- 40 vehicles, 80 routes, 120 stops and 300 Student assignments;
- 80 cafeteria items, 30 menus, 300 enrollments and 300 meal records;
- 200 issued KG reports; and
- 60 albums and 300 media records.

Opaque forbidden sentinels were seeded in private meeting/follow-up text,
transport change/driver fields, dietary/health-like data, KG rubric/comment/
grade content, and Event Media title/description/caption/storage/hash fields.
No sentinel appeared in normalized Search results or serialized Smart AI
evidence. Event Media album titles were specifically removed from matching,
selection and output after security review; Search emits a server-owned
`Album <publicKey>` label instead.

Runtime source states preserve `OK`, `EMPTY`, `DEGRADED`, `UNAVAILABLE` and
`TIMEOUT`. Adapter failures remain isolated. Ranking remains deterministic,
and existing high-confidence exact references are not displaced by the new
safe-metadata sources.

## Smart AI boundary regression

Smart AI still has no Prisma client, SQL/raw query, module adapter or other
direct database path. It derives a bounded Universal Search request, receives
only normalized authorised Search evidence, and validates returned citations
against that evidence.

Focused tests and browser QA proved:

- grounded Event Media and Parent Meeting answers used validated citations;
- unsupported or evidence-free questions returned insufficient evidence;
- database-direct, write/action, image/OCR/face/EXIF/Student-identification and
  personal health/dietary requests were refused before provider invocation;
- no new ERP writes or conversation persistence occurred; and
- hidden notes, image data, dietary/health data and unsupported claims did not
  cross the provider boundary.

The final focused Search and Smart AI suites passed 96 tests (18 Search and 78
Smart AI), including per-source citation, insufficient-evidence, disabled,
degraded, invalid/cross-request citation, prohibited-field, prompt-injection,
no-write and inert-XSS checks.

## Performance and source limits

The extension copied-database benchmark passed with:

- result cap: 50;
- maximum Prisma queries: 42 across all enabled sources;
- local p95: 133.99 ms and maximum: 156.61 ms on the terminal copied-database run;
- the prior retained browser-fixture run measured p95 80.86 ms; and
- measured heap growth: 18,866,152 bytes.

The query count is bounded per request and did not scale with individual
result rows. No N+1 path was observed, and p95 remained well below the accepted
local Search threshold.

## Browser QA

Universal Search passed at 1366 x 768 and 390 x 844 in light and dark themes.
All five new filter cards rendered the `Safe metadata` badge. Exact Parent
Meeting, Transport, Cafeteria, KG and Event Media queries opened the server-owned
module destinations. Multi-source, exact-reference, zero-result, flag-off and
degraded-source states were visible and accessible; the timeout state is also
covered by the adapter/UI regression tests. Keyboard focus was visible, minimum
controls were 44 px, and there was no horizontal overflow. Hostile searchable
text and Smart AI citation cards remained inert. Smart AI returned one validated
current-request citation for every approved new source. Principal route access
redirected to `/unauthorized`, and its direct Search API request returned 403.
There were zero console errors or hydration errors; two known development-only
autoprefixer warnings were the only console warnings.

## Security review

Codex Security diff scan `83a1d005-b36f-40cf-bd55-e9480fd032fd` covered the
complete corrective implementation through
`75e3a836ef391d2b30b228ca0d1514ca63ee02c5`. It completed all five generated
review items plus the supporting route/API/provider/rendering chain with zero
findings at every severity and no deferred surface. The TAC advisory could not
be verified because the connector was not connected; this was advisory only and
did not reduce local scan coverage.

Manual IDOR/BOLA, exact-role, owner-scope, query abuse, injection/XSS, secret
leakage, filter manipulation, failure/timeout isolation, no-write and no-image
review found zero unresolved Critical or High issues.

## Full regression and data safety

The mandatory release gates passed:

- `pnpm.cmd routes:list`: 350 page routes and 590 API routes;
- `pnpm.cmd lifecycle:backfill`: dry run, zero rows created;
- `pnpm.cmd typecheck`: every TypeScript partition passed;
- `pnpm.cmd test`: 227 files passed, 1 intentionally skipped; 2,090 tests
  passed and 3 qpdf-capability tests intentionally skipped;
- `pnpm.cmd build`: production compile and generate passed;
- `pnpm.cmd backup`: format version 43 backup created;
- fresh migration: 22 migrations and 320 models/tables;
- copied upgrade: applied twice with the business baseline preserved;
- restore: two separately invoked rehearsals passed, each internally restoring twice;
- production and full dependency audits: no known vulnerabilities;
- corrected-scope focused acceptance: 32 files / 450 tests / zero skips / DB match; and
- independent Academic Integrity: exact Principal and Super Admin allow, Teacher and
  linked-child denial, scoped operator enforcement and one-success/one-reject concurrency.

The first full-suite attempt disclosed that a safety worktree does not inherit
ignored `.env` or `prisma/dev.db` files, and the requirement-count assertion
still expected the pre-extension ledger. A minimal ignored environment file and
an exact disposable database copy were created; the ledger assertion was updated
to require the unique `V1.5-SEARCH-039` row. All 37 affected tests then passed,
followed by the green full suite above. The worktree reference copy remained
hash-identical.

No schema or migration was added. The operational database remained 8,409,088
bytes with SHA-256
`65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`
before and after implementation, copied-database QA, browser QA, full
regression and backup.

## Closure

This release extends deterministic read-only Universal Search and its existing
Smart AI retrieval boundary only. It authorises no provider change, direct AI
database adapter, indexing/vector store, OCR/face recognition, data import,
operational mutation or deployment.
